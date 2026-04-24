// ════════════════════════════════════════════════════
// CONECTOR TELEGRAM — Notificaciones y bot interactivo
// ════════════════════════════════════════════════════

import TelegramBot from 'node-telegram-bot-api';
import ENV from '../config/env.js';

// Instancia única del bot (singleton)
let _bot = null;

export const getTelegramBot = () => {
  if (!_bot && ENV.TELEGRAM_TOKEN) {
    _bot = new TelegramBot(ENV.TELEGRAM_TOKEN, { polling: false });
  }
  return _bot;
};

// Escapar HTML para mensajes de Telegram
export const esc = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const TelegramConnector = {

  get bot() { return getTelegramBot(); },

  // Enviar mensaje al chat principal (con HTML)
  async notificar(mensaje, opciones = {}) {
    const bot = getTelegramBot();
    if (!bot || !ENV.TELEGRAM_CHAT_ID) {
      console.log('[Telegram] No configurado —', mensaje);
      return;
    }
    try {
      return await bot.sendMessage(ENV.TELEGRAM_CHAT_ID, mensaje, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...opciones,
      });
    } catch (err) {
      console.error('[Telegram] Error al notificar:', err.message);
    }
  },

  // Construir teclado inline de botones
  teclado(filas) {
    return { reply_markup: { inline_keyboard: filas } };
  },

  // Limpiar comando de grupo (@botname → comando limpio)
  parsearComando(texto = '') {
    const partes = texto.trim().split(/\s+/);
    const cmd    = partes[0].toLowerCase().replace(/@\w+$/, '');
    const args   = partes.slice(1);
    return { cmd, args };
  },
};

export default TelegramConnector;
