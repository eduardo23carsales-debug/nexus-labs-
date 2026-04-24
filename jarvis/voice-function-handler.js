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

  console.log(`[Jarvis Voice] Función: ${name}`, parameters);

  try {
    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      return { result: `Función "${name}" no disponible en este momento.` };
    }

    const resultado = await handler(parameters || {});

    // Adaptar el resultado para lectura en voz
    // (textos cortos, sin HTML, sin símbolos especiales)
    const textoVoz = limpiarParaVoz(String(resultado));

    return { result: textoVoz };

  } catch (err) {
    console.error(`[Jarvis Voice] Error en ${name}:`, err.message);
    return { result: `Hubo un error al ejecutar ${name}. ${err.message}` };
  }
}

// Limpiar texto HTML/Markdown para que suene bien en voz
function limpiarParaVoz(texto) {
  return texto
    .replace(/<[^>]+>/g, '')          // quitar HTML
    .replace(/━+/g, '—')              // separadores
    .replace(/[🔥🌡❄️📊💵👥🏆📈📉⭐✅❌⚠️🚀⏸📞🔍🤖]/gu, '') // quitar emojis
    .replace(/\*\*/g, '')             // quitar markdown bold
    .replace(/`[^`]+`/g, '')          // quitar code
    .replace(/\n{3,}/g, '\n\n')       // máximo 2 saltos de línea
    .trim()
    .slice(0, 800);                   // máximo 800 chars para no saturar la voz
}

export default manejarFuncionVoz;
