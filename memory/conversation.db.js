// ════════════════════════════════════════════════════
// MEMORY — Conversación de Jarvis (PostgreSQL)
// TTL: 8 horas de inactividad → resetea
// Límite: máx 40 mensajes por chat
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

const MAX_MSG   = 40;
const TTL_HORAS = 8;

export const ConversationDB = {

  async cargar(chatId) {
    const { rows } = await query(`SELECT * FROM conversations WHERE chat_id = $1`, [String(chatId)]);
    if (!rows.length) return [];
    const entrada = rows[0];
    const horas   = (Date.now() - new Date(entrada.ultima_actividad).getTime()) / 3_600_000;
    if (horas > TTL_HORAS) { await this.limpiar(chatId); return []; }
    return entrada.messages || [];
  },

  async guardar(chatId, messages) {
    let trimmed = messages;
    if (trimmed.length > MAX_MSG) {
      trimmed = trimmed.slice(trimmed.length - MAX_MSG);
    }
    // Avanzar hasta un user message de texto limpio — un user con tool_results
    // no puede iniciar conversación porque su tool_use correspondiente fue cortado
    while (trimmed.length > 0) {
      const first = trimmed[0];
      const esUserLimpio = first.role === 'user' && (
        typeof first.content === 'string' ||
        (Array.isArray(first.content) && !first.content.some(b => b.type === 'tool_result'))
      );
      if (esUserLimpio) break;
      trimmed = trimmed.slice(1);
    }
    await query(`
      INSERT INTO conversations (chat_id, messages, ultima_actividad)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (chat_id) DO UPDATE SET
        messages         = $2::jsonb,
        ultima_actividad = NOW()
    `, [String(chatId), JSON.stringify(trimmed)]);
  },

  async limpiar(chatId) {
    await query(`DELETE FROM conversations WHERE chat_id = $1`, [String(chatId)]);
    return true;
  },
};

export default ConversationDB;
