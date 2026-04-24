// ════════════════════════════════════════════════════
// CONECTOR TWILIO — WhatsApp automático
// Envía mensajes de WhatsApp sin que Eduardo tenga
// que tocar nada. Requiere cuenta Twilio con WhatsApp.
//
// Si Twilio no está configurado → fallback silencioso
// (la notificación llega igual por Telegram con botón)
// ════════════════════════════════════════════════════

import axios from 'axios';
import ENV   from '../config/env.js';

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const TWILIO_WA    = process.env.TWILIO_WHATSAPP_FROM?.trim(); // formato: whatsapp:+14155238886

const configurado = () => TWILIO_SID && TWILIO_TOKEN && TWILIO_WA;

export const TwilioConnector = {

  disponible() {
    return !!configurado();
  },

  async enviarWhatsApp(para, mensaje) {
    if (!configurado()) return false;

    const paraWA = para.startsWith('whatsapp:') ? para : `whatsapp:+${para.replace(/\D/g, '')}`;

    try {
      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        new URLSearchParams({
          From: TWILIO_WA,
          To:   paraWA,
          Body: mensaje,
        }),
        {
          auth:    { username: TWILIO_SID, password: TWILIO_TOKEN },
          timeout: 10000,
        }
      );
      return true;
    } catch (err) {
      console.error('[Twilio] Error enviando WhatsApp:', err.response?.data || err.message);
      return false;
    }
  },
};

export default TwilioConnector;
