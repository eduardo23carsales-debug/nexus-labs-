// ════════════════════════════════════════════════════
// NOTIFICAR CITA — Dispara Telegram + WhatsApp juntos
// Se llama cuando cualquier llamada confirma una cita
// ════════════════════════════════════════════════════

import { TelegramConnector, esc } from '../connectors/telegram.connector.js';
import { TwilioConnector }        from '../connectors/twilio.connector.js';
import ENV                        from '../config/env.js';

export async function notificarCitaConfirmada({ nombre, telefono, diaCita, horaCita, nicho, notas }) {
  const detalle   = [diaCita, horaCita].filter(Boolean).join(' a las ');
  const telLimpio = telefono?.replace(/\D/g, '') || '';

  // ── Mensaje estructurado ─────────────────────────
  const msgTexto =
    `🗓 CITA CONFIRMADA\n` +
    `Cliente: ${nombre}\n` +
    `Teléfono: ${telefono}\n` +
    (detalle ? `Cuando: ${detalle}\n` : '') +
    (nicho   ? `Nicho: ${nicho}\n`   : '') +
    (notas   ? `Notas: ${notas}\n`   : '');

  // ── 1. Telegram (siempre) ────────────────────────
  const botones = [];

  if (telLimpio) {
    const textoWA = encodeURIComponent(
      `Hola ${nombre} 👋 Le escribe el equipo de Nexus Labs.\n\n` +
      `✅ Tu sesión está confirmada${detalle ? ` para el ${detalle}` : ''}.\n\n` +
      `Eduardo te contactará por este mismo número para enviarte el link de la videollamada.\n` +
      `Si necesitas cambiar el horario escríbenos aquí.\n\n` +
      `¡Hasta pronto! 💡`
    );
    botones.push({ text: '✅ Enviar confirmación al cliente', url: `https://wa.me/${telLimpio}?text=${textoWA}` });
    botones.push({ text: '📱 WhatsApp cliente', url: `https://wa.me/${telLimpio}` });
  }

  await TelegramConnector.notificar(
    `🗓 <b>¡CITA CONFIRMADA!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>${esc(nombre)}</b>\n` +
    `📱 ${esc(telefono)}\n` +
    (detalle ? `🕐 <b>${esc(detalle)}</b>\n` : '') +
    (nicho   ? `🎯 ${esc(nicho)}\n`   : '') +
    (notas   ? `📝 ${esc(notas)}\n`   : ''),
    botones.length ? { reply_markup: { inline_keyboard: [botones] } } : {}
  );

  // ── 2. WhatsApp a Eduardo (si Twilio configurado) ─
  if (TwilioConnector.disponible()) {
    const enviado = await TwilioConnector.enviarWhatsApp(
      ENV.WHATSAPP_EDUARDO,
      msgTexto
    );
    if (enviado) {
      console.log(`[NotificarCita] WhatsApp enviado a Eduardo — ${nombre}`);
    }
  } else {
    // Sin Twilio: el botón de Telegram es el fallback
    console.log('[NotificarCita] Twilio no configurado — notificación solo por Telegram');
  }

  console.log(`[NotificarCita] Cita notificada: ${nombre} — ${detalle}`);
}

export default notificarCitaConfirmada;
