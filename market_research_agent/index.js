// ════════════════════════════════════════════════════
// MARKET RESEARCH AGENT — Encuentra nichos rentables
// Busca 5 candidatos por ronda, filtra score >= 82,
// enriquece el ganador con todos los detalles.
// ════════════════════════════════════════════════════

import { AnthropicConnector }  from '../connectors/anthropic.connector.js';
import { TelegramConnector }   from '../connectors/telegram.connector.js';
import { ProductsMemoryDB }    from '../memory/products.db.js';

const SCORE_MINIMO         = 82;
const MAX_RONDAS           = 3;
const CANDIDATOS_POR_RONDA = 5;

const SYSTEM = `Eres el agente investigador de Nexus Labs. Tu trabajo es encontrar nichos de
productos digitales rentables en el mercado latino/hispano de USA (Miami, NY, Houston, LA)
y América Latina. Analizas tendencias reales y recomiendas productos que la gente ya está
buscando y pagando. Responde ÚNICAMENTE con JSON válido, sin texto adicional.

CRITERIOS DE SCORING (sé honesto, no infles el score):
- 90-100: Problema urgente, alta búsqueda, poca competencia en español, precio validado
- 75-89: Buen problema, demanda media-alta, algo de competencia, precio razonable
- 60-74: Nicho viable pero genérico o con competencia moderada
- Menor a 60: No lo recomiendes

NICHOS SATURADOS — NUNCA SUGERIR:
- Dropshipping genérico, "vende en Amazon sin inventario", "gana dinero en TikTok",
  "marketing de afiliados para principiantes", "curso de Forex/crypto para todos",
  "trabaja desde casa sin experiencia", "gana 5000/mes en Instagram"

AUDIENCIA — usa "Latinos en EE.UU." por defecto. Solo subgrupo específico cuando el
producto lo requiere por naturaleza (documentos/inmigración/etc).`;

// ── Paso 1: Buscar candidatos ────────────────────────
async function buscarCandidatos(ganadoresTexto, blacklistTexto, nichosYaVistos = []) {
  const evitar = nichosYaVistos.length
    ? `\nNICHOS YA EVALUADOS ESTA RONDA — NO REPETIR:\n${nichosYaVistos.join('\n')}`
    : '';

  const resultado = await AnthropicConnector.completarJSONConReintentos({
    model:     'claude-sonnet-4-6',
    maxTokens: 2000,
    system:    SYSTEM,
    prompt:    `Necesito ${CANDIDATOS_POR_RONDA} nichos DISTINTOS para productos digitales para el mercado hispano.
Fecha actual: ${new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}.

NICHOS QUE YA FUNCIONARON (replicar/mejorar):
${ganadoresTexto}

NICHOS RECHAZADOS — NO SUGERIR NI NINGUNA VARIACION:
${blacklistTexto}
${evitar}

Para cada candidato evalúa honestamente: urgencia del problema, búsqueda activa en español,
precio validado, competencia baja en español. Solo incluye nichos con score real >= 75.

Devuelve un JSON array:
[
  {
    "nicho": "nombre especifico y concreto",
    "subgrupo_latino": "grupo especifico",
    "tipo": "prompts|plantilla|guia_pdf|mini_curso|toolkit",
    "precio": 37,
    "score": 85,
    "razon_score": "justificacion honesta en 1-2 lineas",
    "problema_que_resuelve": "el dolor en palabras del cliente",
    "formato_ad_recomendado": "stories|feed"
  }
]
Solo el array JSON.`,
  });

  if (Array.isArray(resultado)) return resultado;
  if (Array.isArray(resultado?.candidatos)) return resultado.candidatos;
  if (Array.isArray(resultado?.nichos)) return resultado.nichos;
  return [];
}

// ── Paso 2: Enriquecer el ganador ────────────────────
async function enriquecerNicho(candidato, ganadoresTexto) {
  console.log(`[Researcher] Enriqueciendo: "${candidato.nicho}" (score ${candidato.score})`);

  return AnthropicConnector.completarJSONConReintentos({
    model:     'claude-sonnet-4-6',
    maxTokens: 2500,
    system:    SYSTEM,
    prompt:    `Necesito los detalles COMPLETOS para crear y vender este producto digital:

NICHO: ${candidato.nicho}
Subgrupo: ${candidato.subgrupo_latino}
Tipo: ${candidato.tipo}
Precio: $${candidato.precio}
Problema: ${candidato.problema_que_resuelve}
Score: ${candidato.score}
Formato ad: ${candidato.formato_ad_recomendado}

Ganadores previos: ${ganadoresTexto}

Devuelve JSON:
{
  "nicho": "${candidato.nicho}",
  "subgrupo_latino": "${candidato.subgrupo_latino}",
  "tipo": "${candidato.tipo}",
  "nombre_producto": "nombre que el cliente entiende en 3 segundos y quiere comprar",
  "subtitulo": "resultado concreto: que logra, en cuanto tiempo, sin que requisito",
  "precio": ${candidato.precio},
  "problema_que_resuelve": "el dolor en palabras del cliente",
  "cliente_ideal": "nombre ficticio + edad + ciudad + situacion + por que necesita esto HOY",
  "puntos_de_venta": ["resultado concreto con numero", "resultado 2", "resultado 3"],
  "quick_win": "accion exacta en los primeros 30 minutos y resultado al terminar",
  "herramientas_clave": ["Herramienta (gratis/$X/mes)", "Herramienta2", "Herramienta3"],
  "modulos_temas": ["Tema especifico", "Tema 2", "Tema 3", "Tema 4", "Tema 5"],
  "ejemplo_exito": "nombre latino + ciudad + situacion inicial + resultado con numeros",
  "score": ${candidato.score},
  "razon_score": "${candidato.razon_score}",
  "razon": "por que este nicho AHORA",
  "formato_ad_recomendado": "${candidato.formato_ad_recomendado}",
  "razon_formato": "por que este formato para este subgrupo"
}`,
  });
}

// ── Función principal exportada ──────────────────────
export async function investigarNicho() {
  console.log('[Researcher] Iniciando búsqueda multi-candidato...');

  const [ganadores, blacklist] = await Promise.all([
    ProductsMemoryDB.getGanadores('digital'),
    ProductsMemoryDB.getBlacklist('digital'),
  ]);

  const ganadoresTexto = ganadores.map(g => g.contenido?.slice(0, 200)).join('\n') || 'Ninguno aún';
  const blacklistTexto = blacklist.map(b => b.contenido?.slice(0, 200)).join('\n') || 'Ninguno aún';

  let mejorCandidato = null;
  const nichosYaVistos = [];

  for (let ronda = 1; ronda <= MAX_RONDAS; ronda++) {
    if (ronda > 1) {
      await TelegramConnector.notificar(`🔍 <b>Researcher:</b> Ronda ${ronda}/${MAX_RONDAS} — buscando nichos de mayor calidad...`).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
    }

    let candidatos = [];
    try {
      candidatos = await buscarCandidatos(ganadoresTexto, blacklistTexto, nichosYaVistos);
    } catch (err) {
      console.warn(`[Researcher] Ronda ${ronda}: error — ${err.message}`);
      continue;
    }

    if (!candidatos.length) continue;

    candidatos.forEach(c => nichosYaVistos.push(c.nicho));
    candidatos.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`[Researcher] Ronda ${ronda} — ${candidatos.length} candidatos:`);
    candidatos.forEach(c => console.log(`  • Score ${c.score}: ${c.nicho}`));

    const calificados = candidatos.filter(c => c.score >= SCORE_MINIMO);

    if (calificados.length > 0) {
      mejorCandidato = calificados[0];
      console.log(`[Researcher] Ganador ronda ${ronda}: "${mejorCandidato.nicho}" — ${mejorCandidato.score}/100`);
      break;
    }

    if (ronda === MAX_RONDAS) {
      mejorCandidato = candidatos[0];
      console.warn(`[Researcher] Ninguno superó ${SCORE_MINIMO} — usando mejor: ${mejorCandidato.score}/100`);
      await TelegramConnector.notificar(
        `⚠️ <b>Researcher:</b> Score ${mejorCandidato.score}/100 — si no convence dile a Jarvis "busca otro nicho"`
      ).catch(() => {});
    }
  }

  if (!mejorCandidato) throw new Error('No se encontraron nichos. Intenta de nuevo.');

  const nicho = await enriquecerNicho(mejorCandidato, ganadoresTexto);
  console.log(`[Researcher] Resultado: "${nicho.nombre_producto}" — Score ${nicho.score}/100`);
  return nicho;
}

export default investigarNicho;
