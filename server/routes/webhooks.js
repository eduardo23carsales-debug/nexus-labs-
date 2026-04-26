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
import { enviarReporte }           from '../../reporting/index.js';
import { StripeConnector }         from '../../connectors/stripe.connector.js';
import { ResendConnector }         from '../../connectors/resend.connector.js';
import { SystemState }             from '../../config/system-state.js';
import { ProjectsDB }              from '../../crm/projects.db.js';
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
    case '/menu': {
      const { kill_switch, safe_mode } = await SystemState.getStatus();
      const estadoLabel = kill_switch ? '🔴 KILL SWITCH' : safe_mode ? '🟡 SAFE MODE' : '🟢 Operativo';
      await notif(`⚙️ <b>Menú Nexus Labs</b>\nEstado: ${estadoLabel}`, {
        reply_markup: { inline_keyboard: [
          [{ text: '📊 Reporte',      callback_data: 'reporte'    }, { text: '🧠 Analista',   callback_data: 'analista'   }],
          [{ text: '🔍 Supervisor',   callback_data: 'supervisor' }, { text: '📈 Ventas',     callback_data: 'ventas'     }],
          [{ text: '📂 Proyectos',    callback_data: 'proyectos'  }, { text: '🖥️ Status',     callback_data: 'status'     }],
          [{ text: '🔑 Token Meta',   callback_data: 'token'      }, { text: '📞 Jarvis Voz', callback_data: 'jarvis_voz' }],
          [{ text: '🟡 Safe Mode',    callback_data: 'safe_mode'  }, { text: '🔴 Kill Switch', callback_data: 'kill_switch'}],
        ]}
      });
      break;
    }

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

    case '/projects':
    case '/portafolio': {
      const resumen = await ProjectsDB.resumenPortafolio();
      await notif(resumen);
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

  if (data === 'proyectos') {
    const resumen = await ProjectsDB.resumenPortafolio();
    await TelegramConnector.notificar(resumen);
  }
  if (data === 'jarvis_voz') {
    try {
      const rawTel = (ENV.WHATSAPP_EDUARDO || '17869167339').replace(/\D/g, '');
      const tel    = rawTel.startsWith('1') && rawTel.length === 11 ? `+${rawTel}` : `+1${rawTel}`;
      await VapiConnector.iniciarLlamada({ telefono: tel, nombre: 'Eduardo', assistantConfig: JARVIS_VOICE_CONFIG });
      await TelegramConnector.notificar('📞 <b>Jarvis en línea</b> — contesta y dile qué necesitas.');
    } catch (err) {
      await TelegramConnector.notificar(`⚠️ Jarvis no pudo llamar: ${esc(err.message)}`);
    }
  }
  if (data === 'reporte') {
    await TelegramConnector.notificar('📊 Generando reporte...');
    enviarReporte().catch(console.error);
  }
  if (data === 'analista') {
    await TelegramConnector.notificar('🧠 Ejecutando analista...');
    ejecutarAnalista().catch(console.error);
  }
  if (data === 'supervisor') {
    await TelegramConnector.notificar('🔍 Ejecutando supervisor...');
    ejecutarSupervisor().catch(console.error);
  }
  if (data === 'ventas') {
    const conv = await LeadsDB.resumenConversiones();
    await TelegramConnector.notificar(`📈 Cierres: ${conv.cierres} / ${conv.total_leads} leads (${conv.tasa_cierre}%)`);
  }
  if (data === 'token') {
    const res = await MetaConnector.validarToken();
    await TelegramConnector.notificar(res.ok ? `✅ Token válido` : `❌ Token inválido: ${esc(res.error)}`);
  }
  if (data === 'status') {
    const { kill_switch, safe_mode } = await SystemState.getStatus();
    await TelegramConnector.notificar(
      `🖥️ <b>Estado del Sistema</b>\n` +
      `${kill_switch ? '🔴' : '🟢'} Kill Switch: <b>${kill_switch ? 'ACTIVO' : 'inactivo'}</b>\n` +
      `${safe_mode   ? '🟡' : '🟢'} Safe Mode:   <b>${safe_mode   ? 'ACTIVO' : 'inactivo'}</b>`
    );
  }
  if (data === 'safe_mode') {
    const { safe_mode } = await SystemState.getStatus();
    if (safe_mode) {
      await SystemState.desactivarSafeMode();
      await TelegramConnector.notificar('🟢 <b>Safe mode desactivado</b> — sistema operativo completo.');
    } else {
      await SystemState.activarSafeMode();
      await TelegramConnector.notificar('🟡 <b>Safe mode activado</b> — solo lectura. Toca el botón de nuevo para desactivar.');
    }
  }
  if (data === 'kill_switch') {
    const { kill_switch } = await SystemState.getStatus();
    if (kill_switch) {
      await SystemState.desactivarKillSwitch();
      await TelegramConnector.notificar('🟢 <b>Sistema reactivado</b> — Jarvis y agentes operativos.');
    } else {
      await SystemState.activarKillSwitch();
      await TelegramConnector.notificar('🔴 <b>KILL SWITCH ACTIVADO</b> — sistema detenido. Toca el botón de nuevo para reactivar.');
    }
  }
}

// ── Stripe webhook — entrega inmediata del producto ───
router.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let evento;
  try {
    evento = await StripeConnector.construirEvento(req.body, sig);
  } catch (err) {
    console.error('[Stripe Webhook] Firma inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (evento.type === 'checkout.session.completed') {
    const sesion = evento.data.object;
    if (sesion.payment_status !== 'paid') return res.sendStatus(200);

    const emailCliente  = sesion.customer_details?.email;
    const nombreCliente = sesion.customer_details?.name;
    if (!emailCliente) return res.sendStatus(200);

    res.sendStatus(200); // responder a Stripe antes de procesar

    try {
      const { query } = await import('../../config/database.js');

      // Evitar doble entrega
      const { rows: yaEntregado } = await query(
        'SELECT id FROM customers WHERE email = $1 AND stripe_payment_id = $2 LIMIT 1',
        [emailCliente, sesion.payment_intent || '']
      );
      if (yaEntregado.length) return;

      // Buscar el experimento por payment_link
      const { rows: exps } = await query(
        `SELECT * FROM experiments WHERE stripe_payment_link IS NOT NULL ORDER BY creado_en DESC LIMIT 20`
      );
      const exp = exps.find(e =>
        sesion.payment_link && e.stripe_payment_link?.includes(sesion.payment_link)
      ) || exps[0];

      if (!exp) {
        console.warn('[Stripe Webhook] No se encontró experimento para el pago', sesion.id);
        return;
      }

      const dominio    = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
      const productoUrl = exp.landing_slug ? `${dominio}/acceso/${exp.landing_slug}` : null;

      await ResendConnector.entregarProducto({
        para:            emailCliente,
        nombreCliente,
        nombreProducto:  exp.nombre,
        contenido:       exp.contenido_producto || '',
        productoUrl,
        stripePaymentId: sesion.payment_intent,
      });

      await query(
        `INSERT INTO customers (email, nombre, experiment_id, producto, revenue, stripe_customer_id, stripe_payment_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO NOTHING`,
        [emailCliente, nombreCliente || null, exp.id, exp.nombre,
         (sesion.amount_total || 0) / 100, sesion.customer || null, sesion.payment_intent || null]
      );

      await query(
        `UPDATE experiments SET metricas = jsonb_set(
          COALESCE(metricas,'{}'), '{ventas}',
          (COALESCE((metricas->>'ventas')::int,0)+1)::text::jsonb
        ), actualizado_en = NOW() WHERE id = $1`, [exp.id]
      );

      await TelegramConnector.notificar(
        `💰 <b>Venta confirmada</b>\n` +
        `📦 ${esc(exp.nombre)}\n` +
        `💵 $${((sesion.amount_total || 0) / 100).toFixed(2)}\n` +
        `📧 ${esc(emailCliente)}\n` +
        `✅ Producto entregado por email`
      );

      console.log(`[Stripe Webhook] Producto entregado a ${emailCliente}`);
    } catch (err) {
      console.error('[Stripe Webhook] Error al entregar producto:', err.message);
    }
    return;
  }

  res.sendStatus(200);
});

export default router;
