// ════════════════════════════════════════════════════
// JARVIS VOICE — Handler de funciones en tiempo real
// VAPI llama a este endpoint cuando Jarvis invoca
// una función durante la llamada de voz
//
// Soporta dos formatos de VAPI:
//   tool-calls  → tools[] con server.url (formato actual)
//   function-call → model.functions legacy (compatibilidad)
// ════════════════════════════════════════════════════

import { TOOL_HANDLERS } from './tools.js';

export async function manejarFuncionVoz(body) {
  const msg = body?.message;
  if (!msg) return null;

  // ── Formato actual: tools con server.url ──────────
  // VAPI envía: { message: { type: 'tool-calls', toolCallList: [{ id, function: { name, arguments } }] } }
  if (msg.type === 'tool-calls') {
    const list = msg.toolCallList || [];
    if (!list.length) return null;

    const results = [];

    for (const toolCall of list) {
      const name = toolCall.function?.name;
      const id   = toolCall.id;
      if (!name) continue;

      let params = {};
      try {
        const args = toolCall.function?.arguments;
        params = typeof args === 'string' ? JSON.parse(args) : (args || {});
      } catch {
        params = {};
      }

      console.log(`[Jarvis Voice] Ejecutando: ${name}`, JSON.stringify(params));

      let result;
      try {
        const handler = TOOL_HANDLERS[name];
        if (!handler) {
          console.warn(`[Jarvis Voice] Handler no encontrado: ${name}`);
          result = `No tengo esa función disponible. Dímelo por Telegram.`;
        } else {
          const raw = await handler(params);
          result = limpiarParaVoz(String(raw));
          console.log(`[Jarvis Voice] Resultado de ${name}:`, result.slice(0, 200));
        }
      } catch (err) {
        console.error(`[Jarvis Voice] Error en ${name}:`, err.message);
        result = `Hubo un error ejecutando eso. ${err.message}.`;
      }

      results.push({ toolCallId: id, name, result });
    }

    // VAPI espera: { results: [{ toolCallId, result }] }
    return { results };
  }

  // ── Formato legacy: model.functions ───────────────
  // VAPI envía: { message: { type: 'function-call', functionCall: { name, parameters } } }
  if (msg.type === 'function-call') {
    const { name, parameters } = msg.functionCall || {};
    if (!name) return null;

    let params = {};
    try {
      params = typeof parameters === 'string' ? JSON.parse(parameters) : (parameters || {});
    } catch {
      params = {};
    }

    console.log(`[Jarvis Voice] Ejecutando: ${name}`, JSON.stringify(params));

    try {
      const handler = TOOL_HANDLERS[name];
      if (!handler) {
        console.warn(`[Jarvis Voice] Handler no encontrado: ${name}`);
        return { result: `No tengo esa función disponible. Dímelo por Telegram.` };
      }

      const resultado = await handler(params);
      console.log(`[Jarvis Voice] Resultado de ${name}:`, String(resultado).slice(0, 200));
      return { result: limpiarParaVoz(String(resultado)) };

    } catch (err) {
      console.error(`[Jarvis Voice] Error en ${name}:`, err.message);
      return { result: `Hubo un error ejecutando eso. ${err.message}. Intenta por Telegram.` };
    }
  }

  return null;
}

// Limpiar texto HTML/Markdown/emojis para que suene bien en voz
function limpiarParaVoz(texto) {
  return texto
    .replace(/<[^>]+>/g, '')                          // quitar HTML tags
    .replace(/━+/g, '—')                              // separadores decorativos
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')           // quitar todos los emojis (rangos Unicode)
    .replace(/[\u{2300}-\u{27BF}]/gu, '')             // técnicos, geométricos, símbolos, dingbats
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')             // símbolos y flechas misceláneas
    .replace(/[#️⃣*️⃣]/gu, '')                          // keycap emojis
    .replace(/️/g, '')                           // variation selectors (residuo de ⚠️ ⏸️ etc)
    .replace(/\*\*/g, '')                             // quitar markdown bold
    .replace(/`[^`]+`/g, '')                          // quitar code inline
    .replace(/\n{3,}/g, '\n\n')                       // máximo 2 saltos de línea seguidos
    .replace(/  +/g, ' ')                             // colapsar espacios dobles
    .trim()
    .slice(0, 800);                                   // máximo 800 chars para no saturar la voz
}

export default manejarFuncionVoz;
