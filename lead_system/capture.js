// ════════════════════════════════════════════════════
// LEAD CAPTURE — Procesa leads entrantes (web + Meta)
// Scoring → persistencia → notificación → llamada
// ════════════════════════════════════════════════════

import { scoreLead }                from './scoring.js';
import { LeadsDB }                  from '../memory/leads.db.js';
import { MetaConnector }            from '../connectors/meta.connector.js';
import { TelegramConnector, esc }   from '../connectors/telegram.connector.js';
import ENV                          from '../config/env.js';
import crypto                       from 'crypto';

const iconos = { CALIENTE: '🔥', TIBIO: '🌡', FRIO: '❄️' };

export async function procesarLead(datos, opciones = {}) {
  const { nombre, telefono, email, segmento, ingresos, tiempo } = datos;
  const { programarLlamada } = opciones;     // función inyectada para evitar dependencia circular

  // Scoring
  const { puntos, nivel } = scoreLead({ segmento, ingresos, tiempo });

  // Guardar en memoria
  const lead = await LeadsDB.guardar({
    nombre, telefono, email: email || null,
    segmento, score: nivel,
    fuente: datos.fuente || 'web',
  });

  // Evento CAPI → Meta (Lead)
  try {
    const event_id = `lead_${crypto.randomUUID()}`;
    await MetaConnector.enviarEventoCAPI({
      nombre_evento: 'Lead',
      email, telefono, event_id,
    });
  } catch (err) {
    console.warn('[Capture] CAPI Lead falló:', err.message);
  }

  // Notificación Telegram
  const segTexto = {
    'mal-credito':     'Mal crédito',
    'sin-credito':     'Sin historial',
    'urgente':         'Urgente',
    'upgrade':         'Upgrade',
    'oferta-especial': 'Oferta especial',
  }[segmento] || segmento;

  const telLimpio = telefono.replace(/\D/g, '');
  const botones = [[
    { text: '✅ Cerrado',       callback_data: `cerrado:${telefono}` },
    { text: '❌ No contestó',   callback_data: `no_contesto:${telefono}` },
    { text: '🔄 Rellamar',      callback_data: `rellamar:${telefono}:${nombre}` },
  ]];

  if (telLimpio) {
    botones.push([{ text: '📱 WhatsApp', url: `https://wa.me/${telLimpio}` }]);
  }

  await TelegramConnector.notificar(
    `${iconos[nivel]} <b>Nuevo lead — ${esc(nombre)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📱 ${esc(telefono)}\n` +
    `🎯 ${esc(segTexto)}\n` +
    `⭐ Score: ${nivel} (${puntos} pts)\n` +
    (email ? `📧 ${esc(email)}\n` : ''),
    { reply_markup: { inline_keyboard: botones } }
  );

  console.log(`[Capture] Lead procesado: ${nombre} — ${nivel}`);

  // Programar llamada si la función fue inyectada
  if (programarLlamada && typeof programarLlamada === 'function') {
    programarLlamada({ nombre, telefono, segmento });
  }

  return { lead, score: nivel, puntos };
}

export default procesarLead;
