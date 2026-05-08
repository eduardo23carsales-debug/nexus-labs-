// ════════════════════════════════════════════════════
// PRODUCT BRAIN — Cerebro de decisión de productos
// Decide QUÉ crear basado en learnings + métricas reales
// Propone a Eduardo vía Telegram → aprueba → pipeline completo
// ════════════════════════════════════════════════════

import { AnthropicConnector }      from '../../connectors/anthropic.connector.js';
import { TelegramConnector, esc }  from '../../connectors/telegram.connector.js';
import { MetaConnector }           from '../../connectors/meta.connector.js';
import { CampaignManager }         from '../../ads_engine/campaign-manager.js';
import { ExperimentsDB }           from '../../memory/products.db.js';
import { LearningsDB }             from '../../memory/learnings.db.js';
import { query }                   from '../../config/database.js';
import { SystemState }             from '../../config/system-state.js';
import { investigarNicho, construirNichoDesdeIdea } from '../../market_research_agent/index.js';
import { generarProducto }         from '../../product_engine/index.js';
import { publicarConStripe }       from '../../product_engine/publisher.js';

const SYSTEM = `Eres el estratega de productos digitales de Nexus Labs.
Tu trabajo es analizar el contexto real del negocio y decidir cuál es el MEJOR próximo producto digital a crear y vender.

CRITERIOS DE DECISIÓN (en orden de importancia):
1. ¿Qué nichos han mostrado tracción real? (clicks, visitas, aunque sin venta aún)
2. ¿Qué productos similares fallaron y POR QUÉ? (causa_pausa — no repetir errores)
3. ¿Qué aprendizajes indican demanda no atendida?
4. ¿Qué es fácil de crear con la infraestructura actual (guía PDF, mini curso, toolkit)?
5. ¿Qué precio tiene sentido dado el mercado hispano en USA ($17-$97)?

NICHOS VALIDADOS PARA MERCADO HISPANO USA:
- Emprendimiento digital (muy competido pero probado)
- Finanzas personales en español (crédito, ahorro, primera casa)
- Servicios freelance (diseño, video, redes sociales)
- Negocios desde casa para mamás latinas
- Primeros pasos en USA (ITIN, LLC, cómo funciona el sistema)
- Salud y bienestar (diabetes, pérdida de peso para latinos)
- Carreras técnicas (CDL, cosmetología, plomería, electricidad)

EVITAR:
- Temas legales/fiscales de alto riesgo (IRS específico, visa, inmigración — la gente desconfía)
- Productos con mucho contenido de audio/video (difícil de crear rápido)
- Nichos saturados sin diferenciador claro

FORMATO DE RESPUESTA — JSON válido:
{
  "nombre_producto": "Nombre atractivo del producto",
  "nicho": "categoría del nicho",
  "tipo": "guia_pdf" | "mini_curso" | "toolkit" | "prompts" | "plantilla",
  "precio": 27,
  "problema_que_resuelve": "El problema específico que resuelve en 1 oración",
  "cliente_ideal": "Descripción del cliente ideal en 1 oración",
  "quick_win": "Resultado concreto que el cliente logra en las primeras 24-48h",
  "puntos_de_venta": ["punto 1", "punto 2", "punto 3", "punto 4"],
  "razon_ahora": "Por qué crear ESTE producto AHORA basado en los datos del contexto",
  "score": 75,
  "segmento_meta": "emprendedor-principiante" | "freelancer-hispano" | "mama-emprendedora" | "profesional-latino" | "negocio-local"
}`;

// ── Guarda propuesta temporal en DB para recuperar al aprobar ──
async function guardarPropuestaTemporal(nicho) {
  try {
    await query(
      `INSERT INTO learnings (tipo, contexto, accion, resultado, exito, hipotesis, tags, relevancia)
       VALUES ('product_brain_proposal', $1, 'propuesta_pendiente', 'esperando_aprobacion_eduardo', false, $2, '["proposal","pending"]', 5)`,
      [JSON.stringify(nicho), nicho.nombre_producto]
    );
    // Retornar el ID de la fila insertada
    const { rows } = await query(
      `SELECT id FROM learnings WHERE tipo = 'product_brain_proposal' AND exito = false ORDER BY creado_en DESC LIMIT 1`
    );
    return rows[0]?.id || null;
  } catch {
    return null;
  }
}

export async function obtenerPropuestaPendiente(proposalId) {
  try {
    const { rows } = await query(
      `SELECT contexto FROM learnings WHERE id = $1 AND tipo = 'product_brain_proposal'`,
      [proposalId]
    );
    if (!rows[0]) return null;
    return JSON.parse(rows[0].contexto);
  } catch {
    return null;
  }
}

export async function marcarPropuestaEjecutada(proposalId) {
  try {
    await query(
      `UPDATE learnings SET exito = true, resultado = 'aprobada_por_eduardo' WHERE id = $1`,
      [proposalId]
    );
  } catch { /* silencioso */ }
}

// ── Analiza el contexto y propone el mejor próximo producto ──
export async function proponerProducto({ contextoExtra = '' } = {}) {
  console.log('[ProductBrain] Analizando contexto para proponer producto...');

  try {
    // Contexto unificado
    const [
      campanasRaw,
      experimentosMuertos,
      experimentosActivos,
      learnings,
    ] = await Promise.all([
      MetaConnector.getCampanas(true).catch(() => []),
      ExperimentsDB.listarConCausa(['muerto', 'extendido']).catch(() => []),
      ExperimentsDB.listar('activo').catch(() => []),
      LearningsDB.consultar({ tipo: 'producto', limite: 10 }).catch(() => []),
    ]);

    const campanas = await Promise.allSettled(
      campanasRaw.map(c => CampaignManager.getDatosCampana(c))
    ).then(res => res.filter(r => r.status === 'fulfilled').map(r => r.value));

    const prompt = `CONTEXTO DEL NEGOCIO PARA DECIDIR EL PRÓXIMO PRODUCTO:

═══ CAMPAÑAS META CON TRACCIÓN (${campanas.length}) ═══
${campanas.length
  ? campanas.map(c =>
      `• ${c.nombre} | ${c.tipo_campana} | hoy: $${c.hoy.spend} spend, ${c.hoy.clicks} clicks, ${c.hoy.visitas_landing} visitas | 7d: $${c.ultimos_7_dias.spend}`
    ).join('\n')
  : 'Sin campañas activas'}

═══ EXPERIMENTOS ACTIVOS (${experimentosActivos.length}) ═══
${experimentosActivos.map(e => `• ${e.nombre} (${e.nicho}) | $${e.precio} | ${JSON.stringify(e.metricas || {})}`).join('\n') || 'Ninguno'}

═══ EXPERIMENTOS FALLIDOS CON CAUSA (${experimentosMuertos.length}) ═══
${experimentosMuertos.map(e =>
  `• ${e.nombre} | causa: ${e.causa_pausa || 'desconocida'} | métricas: ${JSON.stringify(e.metricas || {})}`
).join('\n') || 'Ninguno todavía'}

═══ APRENDIZAJES DE PRODUCTOS ANTERIORES ═══
${learnings.map(l =>
  `• [${l.exito ? '✅' : '❌'}] ${l.accion} → ${l.resultado}${l.hipotesis ? ` | ${l.hipotesis}` : ''}`
).join('\n') || 'Sin aprendizajes de productos aún — primera iteración'}

${contextoExtra ? `\n═══ CONTEXTO ADICIONAL ═══\n${contextoExtra}` : ''}

Basándote en todo esto, decide cuál es el MEJOR próximo producto digital para crear y lanzar ahora.
Si hay experimentos fallidos por "audiencia_incorrecta" o "sin_datos", considera si vale la pena relanzar con ajustes.
Si las campañas muestran tracción en un nicho, crea un producto para ESA audiencia.`;

    const raw = await AnthropicConnector.completar({ system: SYSTEM, prompt, maxTokens: 1000 });
    let nicho;
    try {
      nicho = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      console.warn('[ProductBrain] No se pudo parsear propuesta');
      return null;
    }

    // Auto-crear si modo autónomo activo y score suficientemente alto
    const autoMode = await SystemState.isAutoMode().catch(() => false);
    if (autoMode && nicho.score >= 85) {
      console.log(`[ProductBrain] Auto-modo: creando "${nicho.nombre_producto}" (score ${nicho.score})`);
      await TelegramConnector.notificar(
        `🤖 <b>ProductBrain — Auto-creando producto</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 ${esc(nicho.nombre_producto)}\n` +
        `⭐ Score: ${nicho.score}/100 — creando sin aprobación\n` +
        `💡 ${esc(nicho.razon_ahora)}`
      );
      try {
        const nichoCompleto = await construirNichoDesdeIdea(nicho);
        const exp           = await generarProducto(nichoCompleto);
        await publicarConStripe(exp.id);
        return { nicho, autoCreado: true };
      } catch (autoErr) {
        console.error('[ProductBrain] Error auto-creando:', autoErr.message);
        await TelegramConnector.notificar(
          `⚠️ <b>ProductBrain auto-create falló</b>\n${esc(autoErr.message)}\nProponiendo a Eduardo en su lugar...`
        );
        // Fallback: proponer normalmente
      }
    }

    // Guardar propuesta temporal para recuperar al aprobar
    const proposalId = await guardarPropuestaTemporal(nicho);

    // Mensaje a Eduardo con botones
    const msg =
      `🧠 <b>Product Brain — Propuesta de producto</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>${esc(nicho.nombre_producto)}</b>\n` +
      `🎯 Nicho: ${esc(nicho.nicho)}\n` +
      `💵 Precio: $${nicho.precio} | Tipo: ${esc(nicho.tipo)}\n` +
      `⭐ Score: ${nicho.score}/100\n\n` +
      `🔥 <b>Problema:</b> ${esc(nicho.problema_que_resuelve)}\n` +
      `👤 <b>Cliente:</b> ${esc(nicho.cliente_ideal)}\n` +
      `⚡ <b>Quick win:</b> ${esc(nicho.quick_win)}\n\n` +
      `💡 <b>¿Por qué ahora?</b>\n${esc(nicho.razon_ahora)}`;

    const teclado = {
      inline_keyboard: [[
        { text: '🚀 Crear producto ahora',  callback_data: `pb_crear:${proposalId}` },
        { text: '❌ Ignorar',               callback_data: 'pb_ignorar'             },
      ]]
    };

    await TelegramConnector.notificar(msg, { reply_markup: teclado });
    console.log(`[ProductBrain] Propuesta enviada: ${nicho.nombre_producto} (Score ${nicho.score})`);

    return { nicho, proposalId };

  } catch (err) {
    console.error('[ProductBrain] Error:', err.message);
  }
}

export default { proponerProducto, obtenerPropuestaPendiente, marcarPropuestaEjecutada };
