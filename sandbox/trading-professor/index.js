// ════════════════════════════════════════════════════
// TRADING PROFESSOR — Skill standalone (sandbox)
// Profesor Carlos: IA que enseña trading en español
//
// ESTADO: Placeholder / En desarrollo
// NO integrado al sistema principal todavía.
//
// ── Cómo conectar cuando esté listo ─────────────────
// Opción A — VAPI (voz):
//   En jarvis-voice.config.js → FUNCIONES_VAPI, agregar:
//   { nombre: 'consultar_profesor_trading', descripcion: '...' }
//   En call_agent/voice-function-handler.js → case 'consultar_profesor_trading':
//     return await TradingProfessor.responder(args.pregunta);
//
// Opción B — Jarvis Telegram:
//   En jarvis/tools.js → TOOL_DEFINITIONS, agregar la tool definition
//   En TOOL_HANDLERS → 'consultar_profesor_trading': (args) => TradingProfessor.responder(args.pregunta)
//   En jarvis-voice.config.js → agregar entrada en FUNCIONES_VAPI (regla de paridad)
//
// ════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import readline  from 'readline';
import { CONOCIMIENTO } from './knowledge.js';

// ── Config ───────────────────────────────────────────
const MODEL    = 'claude-haiku-4-5-20251001'; // rápido y barato para Q&A
const MAX_HIST = 10;                           // pares usuario/asistente en memoria

// ── Construir contexto desde knowledge.js ────────────
function buildContext() {
  const conceptos = CONOCIMIENTO.conceptos
    .map(c => `• ${c.termino}: ${c.definicion}\n  Ejemplo: ${c.ejemplo}`)
    .join('\n\n');

  const patrones = CONOCIMIENTO.patrones_velas
    .map(p => `• ${p.nombre}: ${p.descripcion} → Señal: ${p.señal}`)
    .join('\n\n');

  const estrategias = CONOCIMIENTO.estrategias
    .map(e => `• ${e.nombre} (${e.timeframes}): ${e.descripcion} — Para: ${e.para_quien}`)
    .join('\n\n');

  const errores = CONOCIMIENTO.errores_comunes.join('\n• ');

  const faqs = CONOCIMIENTO.faqs
    .map(f => `P: ${f.pregunta}\nR: ${f.respuesta}`)
    .join('\n\n');

  const indicadores = CONOCIMIENTO.indicadores
    .map(i => `• ${i.nombre}: ${i.descripcion}`)
    .join('\n\n');

  const psicologia = CONOCIMIENTO.psicologia.join('\n• ');

  return `
CONCEPTOS FUNDAMENTALES:
${conceptos}

PATRONES DE VELAS:
${patrones}

ESTRATEGIAS DE TRADING:
${estrategias}

ERRORES MÁS COMUNES:
• ${errores}

INDICADORES TÉCNICOS:
${indicadores}

PSICOLOGÍA DEL TRADING:
• ${psicologia}

PREGUNTAS FRECUENTES:
${faqs}
`.trim();
}

const SYSTEM_PROMPT = `Eres el Profesor Carlos, un trader veterano con 20 años de experiencia en los mercados financieros. Enseñas trading en español de forma directa, clara y sin rodeos.

TU ESTILO:
- Hablas como un mentor que ya vio todo en el mercado — paciente pero directo
- Usas ejemplos concretos con números reales, no abstracciones
- Cuando algo es peligroso para el estudiante, lo dices sin suavizarlo
- Nunca prometes ganancias rápidas ni fáciles — la honestidad es tu marca
- Adaptas la complejidad al nivel del estudiante (si es principiante, arrancas desde cero)
- Máximo 3-4 párrafos por respuesta — concisos pero completos

TU CONOCIMIENTO:
${buildContext()}

REGLAS:
1. Si la pregunta es de trading → responde con el conocimiento del contexto, expandiendo con tu experiencia
2. Si preguntas algo fuera de trading → dices "Eso está fuera de mi especialidad, pero sobre trading puedo ayudarte con..."
3. Si el estudiante parece querer atajos o "señales mágicas" → redirigelo hacia el aprendizaje real
4. Nunca recomiendes brokers específicos que no estén en tu base de conocimiento
5. Siempre termina con una pregunta de seguimiento o sugerencia de siguiente paso para mantener el aprendizaje`;

// ── API client ───────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Core: función exportable para integración futura ─
export async function responder(pregunta, historial = []) {
  const messages = [
    ...historial.slice(-MAX_HIST * 2),
    { role: 'user', content: pregunta },
  ];

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 600,
    system:     SYSTEM_PROMPT,
    messages,
  });

  return response.content[0].text;
}

// ── CLI interactivo (solo cuando se ejecuta directo) ─
async function runCLI() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const historial = [];

  console.log('\n' + '═'.repeat(60));
  console.log('  📈 PROFESOR CARLOS — Tutor de Trading');
  console.log('  Escribe tu pregunta. "exit" para salir.');
  console.log('═'.repeat(60) + '\n');

  const preguntar = () => {
    rl.question('Tú: ', async (input) => {
      const pregunta = input.trim();
      if (!pregunta || pregunta.toLowerCase() === 'exit') {
        console.log('\nProfesor Carlos: Hasta la próxima. ¡Sigue estudiando!\n');
        rl.close();
        return;
      }

      try {
        process.stdout.write('\nProfesor Carlos: ');
        const respuesta = await responder(pregunta, historial);
        console.log(respuesta + '\n');

        historial.push(
          { role: 'user',      content: pregunta  },
          { role: 'assistant', content: respuesta },
        );
      } catch (e) {
        console.error('Error:', e.message);
      }

      preguntar();
    });
  };

  preguntar();
}

// Ejecutar CLI solo si se llama directo: node sandbox/trading-professor/index.js
if (process.argv[1].includes('trading-professor')) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Falta ANTHROPIC_API_KEY en el entorno');
    process.exit(1);
  }
  runCLI();
}
