// ════════════════════════════════════════════════════
// CALL AGENT — Procesador de webhooks VAPI
// Resultado de llamadas → Telegram + memoria
// ════════════════════════════════════════════════════

import { TelegramConnector, esc }  from '../connectors/telegram.connector.js';
import { CallsDB }                 from '../memory/calls.db.js';
import { LeadsDB, ESTADOS }        from '../memory/leads.db.js';
import { PlansDB }                 from '../memory/plans.db.js';
import { ejecutarPlan }            from '../agents/ejecutor/index.js';
import { ClientDB, ESTADOS_CRM }   from '../crm/client.db.js';
import { notificarCitaConfirmada } from '../jarvis/notificar-cita.js';
import { ConversationDB }          from '../memory/conversation.db.js';
import ENV                         from '../config/env.js';

const ICONOS = {
  'ended':               '✅',
  'no-answer':           '📵',
  'busy':                '📵',
  'failed':              '❌',
  'voicemail':           '📬',
  'customer-ended-call': '✅',
  'assistant-ended-call':'✅',
  'silence-timed-out':   '🔇',
  'max-duration-exceeded':'⏱',
};

const ESTADOS_ES = {
  'ended':               'Completada',
  'no-answer':           'Sin respuesta',
  'busy':                'Ocupado',
  'failed':              'Falló',
  'voicemail':           'Buzón de voz',
  'customer-ended-call': 'Cliente colgó',
  'assistant-ended-call':'Sofía colgó',
  'silence-timed-out':   'Silencio — tiempo agotado',
  'max-duration-exceeded':'Duración máxima',
};

// ── Resultado de llamada de Sofía a un lead ───────────
export async function procesarResultadoSofia(callData) {
  try {
    const { status, endedReason, duration, summary, successEval, customer, analysis } = callData;
    const nombre   = customer?.name   || 'Lead';
    const telefono = customer?.number || '—';
    const duracion = duration ? `${Math.round(duration)}s` : '—';
    const telLimpio = telefono.replace(/\D/g, '');

    const estructurado = analysis?.structuredData || {};
    const citaAgendada = estructurado.citaAgendada === true;
    const diaCita      = estructurado.diaCita  || '';
    const horaCita     = estructurado.horaCita || '';
    const detalleCita  = [diaCita, horaCita].filter(Boolean).join(' a las ');

    // Persistir en memoria
    await CallsDB.registrar({
      callId: callData.id, nombre, telefono,
      estado: status, endedReason, duration,
      citaAgendada, diaCita, horaCita,
      summary,
    });

    if (citaAgendada) {
      await LeadsDB.marcarCitaAgendada(telefono, { dia: diaCita, hora: horaCita });
      const clienteCita = await ClientDB.obtener(telefono);
      await notificarCitaConfirmada({
        nombre, telefono, diaCita, horaCita,
        nicho:  clienteCita?.nicho || null,
        notas:  callData.summary || null,
      });
    }

    // Siempre actualizar CRM con el resultado completo de la llamada
    const estadoCRM = citaAgendada
      ? ESTADOS_CRM.CITA_AGENDADA
      : (endedReason === 'no-answer' || endedReason === 'busy')
        ? ESTADOS_CRM.NO_CONTESTO
        : ESTADOS_CRM.CONTACTADO;

    const clienteExiste = await ClientDB.obtener(telefono);
    if (clienteExiste) {
      await ClientDB.registrarInteraccion(telefono, {
        tipo:        'llamada',
        resultado:   citaAgendada ? `Cita agendada: ${detalleCita}` : (ESTADOS_ES[endedReason] || endedReason || 'Completada'),
        notas:       summary || '',
        duracion:    duration,
        estado_nuevo: estadoCRM,
      });
    }

    // Mensaje Telegram (resultado general de la llamada)
    const icono     = ICONOS[endedReason] || ICONOS[status] || '📞';
    const estadoTxt = ESTADOS_ES[endedReason] || ESTADOS_ES[status] || endedReason || '—';
    const scoreTxt  = successEval != null ? `⭐ Score: ${successEval}/10` : '';

    let msg =
      `${icono} <b>Resultado llamada — ${esc(nombre)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 ${esc(telefono)}\n` +
      `⏱ Duración: ${esc(duracion)}\n` +
      `📋 Estado: ${esc(estadoTxt)}\n` +
      (citaAgendada ? `🗓 <b>CITA AGENDADA${detalleCita ? ` — ${esc(detalleCita)}` : ''}</b>\n` : `❌ Sin cita\n`) +
      (scoreTxt ? `${scoreTxt}\n` : '');

    if (summary) msg += `\n💬 <b>Resumen:</b>\n${esc(summary)}`;

    const botones = [{ text: '🔄 Rellamar', callback_data: `rellamar:${telefono}:${nombre}` }];

    if (citaAgendada && telLimpio) {
      const textoWA = encodeURIComponent(
        `Hola ${nombre} 👋 Le escribe el equipo de Nexus Labs.\n\n` +
        `✅ Su sesión está confirmada${detalleCita ? ` para el ${detalleCita}` : ''}.\n\n` +
        `Eduardo le enviará el link de la videollamada por WhatsApp.\n` +
        `Si necesita cambiar el horario, escríbanos aquí.\n\n` +
        `¡Hasta pronto! 💡`
      );
      botones.unshift({ text: '✅ Confirmar cita por WhatsApp', url: `https://wa.me/${telLimpio}?text=${textoWA}` });
    } else if (telLimpio) {
      botones.unshift({ text: '📱 WhatsApp', url: `https://wa.me/${telLimpio}` });
    }

    await TelegramConnector.notificar(msg, { reply_markup: { inline_keyboard: [botones] } });
    console.log(`[Webhook] Resultado: ${nombre} — ${endedReason || status}${citaAgendada ? ' — CITA ✅' : ''}`);

    // Inyectar el resultado en el historial de Jarvis para que sepa sin que Eduardo tenga que preguntar
    const chatId = ENV.TELEGRAM_CHAT_ID;
    if (chatId) {
      try {
        const historial = await ConversationDB.cargar(chatId);
        if (historial.length > 0) {
          const infoLlamada = [
            `[Resultado de llamada automática]`,
            `Sofía llamó a ${nombre} (${telefono}).`,
            `Estado: ${estadoTxt}.`,
            citaAgendada ? `CITA AGENDADA: ${detalleCita}.` : null,
            summary      ? `Resumen: ${summary}`            : null,
          ].filter(Boolean).join(' ');

          historial.push({ role: 'user',      content: infoLlamada });
          historial.push({ role: 'assistant', content: `Entendido. Resultado de la llamada a ${nombre} guardado en CRM. ${citaAgendada ? `Cita confirmada para ${detalleCita}.` : `Estado: ${estadoTxt}.`}` });
          await ConversationDB.guardar(chatId, historial);
        }
      } catch (e) {
        console.warn('[Webhook] No se pudo inyectar resultado en conversación Jarvis:', e.message);
      }
    }

  } catch (err) {
    console.error('[Webhook] Error procesando resultado Sofía:', err.message);
  }
}

// ── Resultado de briefing de Ana ──────────────────────
export async function procesarResultadoAna(callData) {
  try {
    const planAprobado = callData.analysis?.structuredData?.planAprobado;
    const notas        = callData.analysis?.structuredData?.notasEduardo || '';

    if (planAprobado === true) {
      await TelegramConnector.notificar(`✅ <b>Eduardo aprobó el plan</b> — ejecutando ahora...`);
      const plan = await PlansDB.cargar();
      if (plan) {
        await ejecutarPlan(plan);
        await PlansDB.marcarEjecutado();
      } else {
        await TelegramConnector.notificar(`⚠️ Plan no encontrado — usa /analista para regenerar.`);
      }
    } else if (planAprobado === false) {
      await TelegramConnector.notificar(
        `❌ <b>Eduardo rechazó el plan</b>\n` +
        (notas ? `📝 Notas: ${esc(notas)}` : '')
      );
      await PlansDB.limpiar();
    }

  } catch (err) {
    console.error('[Webhook] Error procesando resultado Ana:', err.message);
  }
}

export default { procesarResultadoSofia, procesarResultadoAna };
