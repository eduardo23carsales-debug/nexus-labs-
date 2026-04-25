// ════════════════════════════════════════════════════
// ROUTES — Webhooks de Meta, VAPI y Telegram
// ════════════════════════════════════════════════════

import { Router }                from 'express';
import { procesarLead }          from '../../lead_system/capture.js';
import { programarLlamada }      from '../../call_agent/caller.js';
import { procesarResultadoSofia, procesarResultadoAna } from '../../call_agent/webhook-handler.js';
import { LeadsDB }               from '../../memory/leads.db.js';
import { PlansDB }               from '../../memory/plans.db.js';
import { ejecutarPlan }          from '../../agents/ejecutor/index.js';
import { ejecutarAnalista }      from '../../agents/analista/index.js';
import { ejecutarSupervisor }    from '../../agents/supervisor/index.js';
import { MetaConnector }         from '../../connectors/meta.connector.js';
import { CampaignManager }       from '../../ads_engine/campaign-manager.js';
import { TelegramConnector, esc } from '../../connectors/telegram.connector.js';
import { llamarLead }            from '../../call_agent/caller.js';
import { procesarMensajeJarvis }   from '../../jarvis/index.js';
import { manejarFuncionVoz }       from '../../jarvis/voice-function-handler.js';
import { JARVIS_VOICE_CONFIG }     from '../../jarvis/jarvis-voice.config.js';
import { VapiConnector }           from '../../connectors/vapi.connector.js';
import { procesarVentaHotmart }    from '../../connectors/hotmart.connector.js';
import { SystemState }             from '../../config/system-state.js';
import ENV                         from '../../config/env.js';

const router = Router();

// ── Meta Lead Ads webhook ─────────────────────────────
router.get('/meta/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === ENV.META_WEBHOOK_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

router.post('/meta/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    if (change?.field !== 'leadgen') return;

    const { leadgen_id, page_id, form_id } = change.value;
    const data = await MetaConnector.get(`/${leadgen_id}`, {
      fields: 'field_data,created_time'
    });

    const campos = {};
    (data.field_data || []).forEach(f => { campos[f.name] = f.values?.[0]; });

    const nombre   = campos['full_name']  || campos['name']  || 'Lead';
    const telefono = campos['phone_number'] || campos['phone'] || '';
    const email    = campos['email'] || '';
    const segmento = 'meta-lead';

    if (telefono) {
      await procesarLead(
        { nombre, telefono, email, segmento, fuente: 'meta-leadgen' },
        { programarLlamada }
      );
    }
  } catch (err) {
    console.error('[Webhook Meta] Error:', err.message);
  }
});

// ── Jarvis Voice — iniciar llamada ───────────────────
// Eduardo llama desde Telegram con /jarvis o botón
router.post('/vapi/jarvis/llamar', async (req, res) => {
  res.json({ ok: true });
  try {
    const rawTel = (ENV.WHATSAPP_EDUARDO || '17869167339').replace(/\D/g, '');
    const tel    = rawTel.startsWith('1') && rawTel.length === 11 ? `+${rawTel}` : `+1${rawTel}`;

    await VapiConnector.iniciarLlamada({
      telefono:        tel,
      nombre:          'Eduardo',
      assistantConfig: JARVIS_VOICE_CONFIG,
    });

    await TelegramConnector.notificar('📞 <b>Jarvis te está llamando...</b> Contesta y dile qué necesitas.');
  } catch (err) {
    console.error('[Jarvis] Error al llamar:', err.message);
    await TelegramConnector.notificar(`⚠️ Jarvis no pudo llamar: ${esc(err.message)}`);
  }
});

// ── Jarvis Voice — funciones en tiempo real ───────────
// VAPI llama aquí cuando Jarvis ejecuta una función durante la llamada
router.post('/vapi/jarvis', async (req, res) => {
  try {
    const resultado = await manejarFuncionVoz(req.body);
    if (resultado) {
      res.json(resultado);
    } else {
      res.sendStatus(200);
    }
  } catch (err) {
    console.error('[Jarvis Webhook] Error:', err.message);
    res.json({ result: 'Error procesando la función.' });
  }
});

// ── VAPI webhook ──────────────────────────────────────
router.post('/vapi/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const msg = req.body?.message;
    if (msg?.type !== 'end-of-call-report') return;

    const call     = msg.call || {};
    const callData = {
      id:          call.id,
      status:      call.status,
      endedReason: call.endedReason,
      duration:    call.duration,
      customer:    call.customer,
      analysis:    msg.analysis,
      summary:     msg.summary,
    };

    const asistente = call.assistant?.name || '';

    if (asistente.includes('Ana')) {
      await procesarResultadoAna(callData);
    } else {
      await procesarResultadoSofia(callData);
    }
  } catch (err) {
    console.error('[Webhook VAPI] Error:', err.message);
  }
});

// ── Hotmart compra webhook ───────────────────────────
router.post('/hotmart/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const { event, data } = req.body || {};
    if (event && data) {
      await procesarVentaHotmart({ event, data });
    }
  } catch (err) {
    console.error('[Webhook Hotmart] Error:', err.message);
  }
});

// ── Telegram webhook ──────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const upd = req.body;
    if (!upd) return;

    const bot = TelegramConnector.bot;
    if (!bot) return;

    // Mensajes de texto (grupos / DMs)
    if (upd.message?.text) {
      await manejarComando(upd.message);
    }

    // Mensajes de canales (cuando el bot es admin del canal)
    if (upd.channel_post?.text) {
      await manejarComando(upd.channel_post);
    }

    // Callback de botones inline
    if (upd.callback_query) {
      await manejarCallback(upd.callback_query);
    }

  } catch (err) {
    console.error('[Webhook Telegram] Error:', err.message);
  }
});

// ── Validación de usuario autorizado ─────────────────
function esUsuarioAutorizado(chatId) {
  const autorizado = ENV.TELEGRAM_CHAT_ID?.toString().replace('-', '');
  const entrante   = chatId?.toString().replace('-', '');
  return autorizado && entrante && entrante === autorizado;
}

// ── Comandos Telegram ─────────────────────────────────
async function manejarComando(msg) {
  const { text, chat } = msg;
  const chatId = chat.id.toString();

  // Validar que solo Eduardo pueda controlar el sistema
  if (!esUsuarioAutorizado(chatId)) {
    console.warn(`[Telegram] Acceso denegado desde chat ${chatId}`);
    return;
  }

  // Si NO es un comando → Jarvis procesa el texto libre
  if (!text?.startsWith('/')) {
    await procesarMensajeJarvis(text, chat.id).catch(console.error);
    return;
  }

  const { cmd, args } = TelegramConnector.parsearComando(text);
  const notif  = (m, opts) => TelegramConnector.notificar(m, opts);

  switch (cmd) {
    case '/menu':
      await notif('⚙️ <b>Menú Nexus Labs</b>', {
        reply_markup: { inline_keyboard: [
          [{ text: '📊 Reporte', callback_data: 'reporte' }, { text: '🧠 Analista', callback_data: 'analista' }],
          [{ text: '🔍 Supervisor', callback_data: 'supervisor' }, { text: '📈 Ventas', callback_data: 'ventas' }],
          [{ text: '🔑 Token Meta', callback_data: 'token' }],
        ]}
      });
      break;

    case '/analista':
      await notif('🧠 Ejecutando analista...');
      ejecutarAnalista().catch(console.error);
      break;

    case '/supervisor':
      await notif('🔍 Ejecutando supervisor...');
      ejecutarSupervisor().catch(console.error);
      break;

    case '/ventas': {
      const conv = await LeadsDB.resumenConversiones();
      await notif(
        `📈 <b>Resumen de Conversiones</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👥 Leads totales: ${conv.total_leads}\n` +
        `🗓 Citas agendadas: ${conv.citas}\n` +
        `🏆 Cierres: ${conv.cierres}\n` +
        `📊 Tasa de cierre: ${conv.tasa_cierre}%`
      );
      break;
    }

    case '/venta': {
      const [tel, valor] = args;
      if (!tel) { await notif('Uso: /venta <telefono> [valor]'); break; }
      await LeadsDB.marcarCerrado(tel, parseFloat(valor) || null);
      await notif(`🏆 <b>Venta registrada</b>\n📱 ${esc(tel)}${valor ? `\n💵 $${valor}` : ''}`);
      break;
    }

    case '/token': {
      const res = await MetaConnector.validarToken();
      await notif(res.ok
        ? `✅ <b>Token Meta válido</b>\nCuenta: ${esc(res.nombre)}`
        : `❌ <b>Token Meta inválido</b>\n${esc(res.error)}`
      );
      break;
    }

    case '/testvoz': {
      const tel = args[0] || ENV.WHATSAPP_EDUARDO;
      await llamarLead({ nombre: 'Eduardo', telefono: tel, segmento: 'mal-credito' });
      break;
    }

    case '/jarvis': {
      await notif('📞 Llamando a Jarvis por voz...');
      try {
        const rawTel = (ENV.WHATSAPP_EDUARDO || '17869167339').replace(/\D/g, '');
        const tel    = rawTel.startsWith('1') && rawTel.length === 11 ? `+${rawTel}` : `+1${rawTel}`;
        await VapiConnector.iniciarLlamada({
          telefono:        tel,
          nombre:          'Eduardo',
          assistantConfig: JARVIS_VOICE_CONFIG,
        });
        await notif('📞 <b>Jarvis en línea</b> — contesta y dile qué necesitas.');
      } catch (err) {
        await notif(`⚠️ Jarvis no pudo llamar: ${esc(err.message)}`);
      }
      break;
    }

    case '/status': {
      const { kill_switch, safe_mode } = await SystemState.getStatus();
      await notif(
        `🖥️ <b>Estado del Sistema — Nexus Labs</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${kill_switch ? '🔴' : '🟢'} Kill Switch: <b>${kill_switch ? 'ACTIVO' : 'inactivo'}</b>\n` +
        `${safe_mode   ? '🟡' : '🟢'} Safe Mode:   <b>${safe_mode   ? 'ACTIVO' : 'inactivo'}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Comandos disponibles:\n` +
        `/kill_switch — detener todo\n` +
        `/kill_off — reactivar sistema\n` +
        `/safe_mode — modo solo lectura\n` +
        `/safe_off — desactivar safe mode`
      );
      break;
    }

    case '/kill_switch': {
      await SystemState.activarKillSwitch();
      await notif(
        `🔴 <b>KILL SWITCH ACTIVADO</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `El sistema está completamente detenido.\n` +
        `• Jarvis no ejecuta nada\n` +
        `• Ningún agente actúa\n` +
        `• Los webhooks siguen recibiendo datos\n\n` +
        `Usa /kill_off para reactivar.`
      );
      break;
    }

    case '/kill_off': {
      await SystemState.desactivarKillSwitch();
      await SystemState.desactivarSafeMode();
      await notif(
        `🟢 <b>Sistema reactivado</b>\n` +
        `Kill switch y safe mode desactivados.\n` +
        `Jarvis y todos los agentes operativos.`
      );
      break;
    }

    case '/safe_mode': {
      await SystemState.activarSafeMode();
      await notif(
        `🟡 <b>SAFE MODE ACTIVADO</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `El sistema está en modo lectura.\n` +
        `• Jarvis puede consultar y reportar\n` +
        `• Bloqueado: llamadas, campañas, gastos\n` +
        `• Los cron jobs siguen corriendo\n\n` +
        `Usa /safe_off para desactivar.`
      );
      break;
    }

    case '/safe_off': {
      await SystemState.desactivarSafeMode();
      await notif(`🟢 <b>Safe mode desactivado</b>\nSistema operativo completo.`);
      break;
    }
  }
}

// ── Callbacks de botones ───────────────────────────────
async function manejarCallback(cbq) {
  const data   = cbq.data || '';
  const bot    = TelegramConnector.bot;

  if (bot) {
    await bot.answerCallbackQuery(cbq.id).catch(() => {});
  }

  if (data === 'aprobar_plan') {
    const plan = await PlansDB.cargar();
    if (!plan) {
      await TelegramConnector.notificar('⚠️ No hay plan vigente. Ejecuta /analista primero.');
      return;
    }
    await TelegramConnector.notificar('✅ <b>Plan aprobado</b> — ejecutando...');
    await ejecutarPlan(plan);
    await PlansDB.marcarEjecutado();
  }

  if (data === 'ignorar_plan') {
    await PlansDB.limpiar();
    await TelegramConnector.notificar('❌ Plan descartado.');
  }

  if (data.startsWith('escalar:')) {
    const [, id, nuevo] = data.split(':');
    try {
      await CampaignManager.cambiarPresupuesto(id, parseFloat(nuevo));
      await TelegramConnector.notificar(`📈 Campaña escalada a $${nuevo}/día`);
    } catch (e) {
      await TelegramConnector.notificar(`❌ Error: ${esc(e.message)}`);
    }
  }

  if (data.startsWith('cerrado:')) {
    const tel = data.split(':')[1];
    await LeadsDB.marcarCerrado(tel);
    await TelegramConnector.notificar(`🏆 Lead ${esc(tel)} marcado como <b>CERRADO</b>`);
  }

  if (data.startsWith('rellamar:')) {
    const [, tel, nombre] = data.split(':');
    await llamarLead({ nombre: nombre || 'Lead', telefono: tel, segmento: 'mal-credito' });
  }

  if (data === 'analista') { ejecutarAnalista().catch(console.error); }
  if (data === 'supervisor') { ejecutarSupervisor().catch(console.error); }
  if (data === 'ventas') {
    const conv = await LeadsDB.resumenConversiones();
    await TelegramConnector.notificar(`📈 Cierres: ${conv.cierres} / ${conv.total_leads} leads (${conv.tasa_cierre}%)`);
  }
  if (data === 'token') {
    const res = await MetaConnector.validarToken();
    await TelegramConnector.notificar(res.ok ? `✅ Token válido` : `❌ Token inválido: ${esc(res.error)}`);
  }
}

export default router;
