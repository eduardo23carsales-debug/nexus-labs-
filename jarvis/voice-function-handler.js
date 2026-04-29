// ════════════════════════════════════════════════════
// JARVIS VOICE — Handler de funciones en tiempo real
// VAPI llama a este endpoint cuando Jarvis invoca
// una función durante la llamada de voz
// ════════════════════════════════════════════════════

import { TOOL_HANDLERS } from './tools.js';

// VAPI envía: { message: { type: 'function-call', functionCall: { name, parameters } } }
export async function manejarFuncionVoz(body) {
  const msg = body?.message;
  if (msg?.type !== 'function-call') return null;

  const { name, parameters } = msg.functionCall || {};
  if (!name) return null;

  // VAPI puede mandar parameters como string JSON o como objeto
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
      return { result: `No tengo esa función disponible en este momento. Dímelo por Telegram.` };
    }

    const resultado = await handler(params);
    console.log(`[Jarvis Voice] Resultado de ${name}:`, String(resultado).slice(0, 200));

    const textoVoz = limpiarParaVoz(String(resultado));
    return { result: textoVoz };

  } catch (err) {
    console.error(`[Jarvis Voice] Error en ${name}:`, err.message);
    return { result: `Hubo un error ejecutando eso. ${err.message}. Intenta por Telegram.` };
  }
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
