// ════════════════════════════════════════════════════
// CALL AGENT — Orquestador de llamadas VAPI
// ════════════════════════════════════════════════════

import { VapiConnector }                      from '../connectors/vapi.connector.js';
import { TelegramConnector, esc }             from '../connectors/telegram.connector.js';
import { SOFIA_CONFIG, configurarSofia }      from './sofia.config.js';
import { ANA_CONFIG }                         from './ana.config.js';
import ENV                                    from '../config/env.js';
import BUSINESS                               from '../config/business.config.js';

const SEGMENTO_TEXTO = {
  'emprendedor-principiante': 'quiere empezar a generar ingresos con productos digitales',
  'emprendedor-escalar':      'tiene un negocio y quiere automatizarlo y escalarlo',
  'afiliado-hotmart':         'quiere ganar comisiones como afiliado en Hotmart',
  'infoproductor':            'quiere lanzar su propio infoproducto',
  'oferta-especial':          'vio la oferta especial de lanzamiento',
};

// ── Llamar a un lead con Sofía ────────────────────────
export async function llamarLead({ nombre, telefono, segmento }) {
  if (!ENV.VAPI_API_KEY || !ENV.VAPI_PHONE_ID) {
    console.warn('[Caller] VAPI no configurado — saltando llamada');
    return;
  }

  try {
    const call = await VapiConnector.iniciarLlamada({
      telefono,
      nombre,
      assistantConfig: configurarSofia(segmento, nombre),
    });

    const segTexto = SEGMENTO_TEXTO[segmento] || 'se registró para información';
    await TelegramConnector.notificar(
      `📞 <b>Llamando a ${esc(nombre)}</b>\n` +
      `📱 ${esc(telefono)}\n` +
      `🎯 ${esc(segTexto)}\n` +
      `🤖 Sofia en línea...`
    );

    console.log(`[Caller] Llamada iniciada: ${call.id}`);
    return { ok: true, callId: call.id };

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[Caller] Error: ${msg}`);
    await TelegramConnector.notificar(
      `⚠️ <b>VAPI Error:</b> No se pudo llamar a ${esc(nombre)}\n<code>${esc(msg)}</code>`
    );
    return { ok: false, error: msg };
  }
}

// ── Programar llamada con delay ───────────────────────
export function programarLlamada(lead) {
  const delay = BUSINESS.llamadas.delayMinutos * 60 * 1000;
  console.log(`[Caller] Llamada programada en ${BUSINESS.llamadas.delayMinutos} min para ${lead.nombre}`);

  setTimeout(async () => {
    try {
      await llamarLead(lead);
    } catch (e) {
      console.error('[Caller] Error en llamada programada:', e.message);
    }
  }, delay);
}

// ── Llamar a Eduardo con briefing de Ana ──────────────
export async function llamarBriefing(plan, resumenVoz) {
  if (!ENV.VAPI_API_KEY || !ENV.VAPI_PHONE_ID) {
    console.warn('[Ana] VAPI no configurado — solo Telegram');
    return;
  }

  const rawTel = (ENV.WHATSAPP_EDUARDO).replace(/\D/g, '');
  const tel    = rawTel.startsWith('1') && rawTel.length === 11 ? `+${rawTel}` : `+1${rawTel}`;

  const pausar  = plan.pausar?.length  ? `Pausar ${plan.pausar.length} campaña(s).` : '';
  const escalar = plan.escalar?.length ? `Escalar ${plan.escalar.length} campaña(s).` : '';
  const crear   = plan.crear?.length   ? `Crear ${plan.crear.length} campaña(s) nueva(s).` : '';
  const acciones = [pausar, escalar, crear].filter(Boolean).join(' ');

  const firstMessage = resumenVoz
    ? `Buenos días Eduardo. ${resumenVoz} ${acciones ? `Mi recomendación: ${acciones}` : ''} ¿Apruebas que lo ejecute?`
    : `Buenos días Eduardo. Tengo el análisis de tus campañas listo. ¿Tienes un momento?`;

  try {
    const call = await VapiConnector.iniciarLlamada({
      telefono:        tel,
      nombre:          'Eduardo Ferrer',
      assistantConfig: { ...ANA_CONFIG, serverUrl: ANA_CONFIG.serverUrl, firstMessage },
    });

    await TelegramConnector.notificar(`📞 <b>Ana está llamando a Eduardo</b> para el briefing...`);
    console.log(`[Ana] Briefing iniciado: ${call.id}`);
    return call.id;

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[Ana] Error: ${msg}`);
    await TelegramConnector.notificar(`⚠️ <b>Ana no pudo llamar</b>\n<code>${esc(msg)}</code>`);
  }
}

export default { llamarLead, programarLlamada, llamarBriefing };
