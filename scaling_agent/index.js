// ════════════════════════════════════════════════════
// SCALING AGENT — Monitorea y decide el futuro de
// cada experimento de producto digital a las 72h
// ════════════════════════════════════════════════════

import { AnthropicConnector } from '../connectors/anthropic.connector.js';
import { TelegramConnector }  from '../connectors/telegram.connector.js';
import { ExperimentsDB, ProductsMemoryDB } from '../memory/products.db.js';
import { SystemState }        from '../config/system-state.js';
import { CampaignManager }    from '../ads_engine/campaign-manager.js';
import { StripeConnector }    from '../connectors/stripe.connector.js';
import { LearningsDB }        from '../memory/learnings.db.js';
import { query }              from '../config/database.js';

const SYSTEM = `Eres el agente de scaling de Nexus Labs. Analizas experimentos de productos
digitales y decides qué hacer con ellos en base a datos reales. Responde con JSON válido.`;

// ── Busca campaign_ids vinculadas a un experimento ──
async function encontrarCampanasDeExperimento(expId) {
  try {
    const { rows } = await query(
      `SELECT campaign_ids FROM projects WHERE experiment_id = $1 LIMIT 1`,
      [expId]
    );
    if (!rows[0]?.campaign_ids) return [];
    const ids = Array.isArray(rows[0].campaign_ids) ? rows[0].campaign_ids : [];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}

// ── Decidir qué hacer con un experimento a las 72h ──
export async function decidirSuerteExperimento(exp) {
  const contexto = await ProductsMemoryDB.getContexto('digital');

  const resultado = await AnthropicConnector.completarJSONConReintentos({
    model:     'claude-sonnet-4-6',
    maxTokens: 800,
    system:    SYSTEM,
    prompt:    `Analiza este experimento a las 72 horas:

Nicho: ${exp.nicho}
Tipo: ${exp.tipo}
Precio: $${exp.precio}
Métricas: ${JSON.stringify(exp.metricas || {}, null, 2)}

MEMORIA DEL SISTEMA:
${contexto}

Decide su suerte. Devuelve JSON:
{
  "decision": "escalar" | "matar" | "extender_7_dias" | "ajustar_precio",
  "razon": "explicacion en 1-2 oraciones",
  "aprendizaje": "que aprendemos para el futuro",
  "precio_nuevo": null o numero si ajustas precio
}

REGLAS:
- revenue > 0 Y conversion_rate > 1% → escalar
- revenue = 0 Y clicks < 50 → matar (sin traccion)
- revenue = 0 Y clicks > 50 → extender_7_dias (hay trafico, falta conversion)
- precio muy alto con clicks pero sin ventas → ajustar_precio`,
  });

  return resultado;
}

// ── Revisar todos los experimentos pendientes ─────────
export async function revisarExperimentos() {
  const pendientes = await ExperimentsDB.pendientesDecision();
  if (!pendientes.length) {
    console.log('[ScalingAgent] Sin experimentos pendientes de revisión');
    return;
  }

  console.log(`[ScalingAgent] ${pendientes.length} experimento(s) listos para revisión`);

  for (const exp of pendientes) {
    try {
      const decision = await decidirSuerteExperimento(exp);

      // Aplicar la decisión
      const estadoNuevo = decision.decision === 'escalar' ? 'escalado'
        : decision.decision === 'matar' ? 'muerto'
        : decision.decision === 'extender_7_dias' ? 'extendido'
        : 'activo'; // ajustar_precio → sigue activo

      // Registrar causa_pausa para que el Agente Proactivo razone correctamente después
      const metricas = exp.metricas || {};
      const causaPausa = estadoNuevo === 'muerto'
        ? (metricas.clicks < 30
            ? 'sin_datos'             // muy poco tráfico para evaluar
            : metricas.clicks > 50 && !metricas.revenue
              ? 'audiencia_incorrecta' // tráfico sin conversión → audiencia equivocada
              : 'mal_rendimiento')     // genuinamente no funcionó
        : null;

      await ExperimentsDB.actualizarEstado(exp.id, estadoNuevo, decision.razon, causaPausa);

      // Auto-ejecución cuando modo autónomo está activo
      const autoMode = await SystemState.isAutoMode().catch(() => false);
      if (autoMode && decision.decision !== 'extender_7_dias') {
        try {
          const campaignIds = await encontrarCampanasDeExperimento(exp.id);

          if (decision.decision === 'matar' && campaignIds.length) {
            for (const cid of campaignIds) {
              await CampaignManager.pausar(cid).catch(() => {});
            }
            await LearningsDB.guardar({
              tipo: 'producto', contexto: `Auto-kill: ${exp.nombre}`,
              accion: `Campañas pausadas automáticamente (${campaignIds.length})`,
              resultado: decision.razon, exito: false,
              hipotesis: decision.aprendizaje, tags: ['auto_kill', exp.nicho], relevancia: 8,
            }).catch(() => {});
          }

          if (decision.decision === 'ajustar_precio' && decision.precio_nuevo && exp.stripe_product_id) {
            const precioAnterior = exp.precio;
            const { stripePriceId, stripePaymentLink, stripePaymentLinkId } =
              await StripeConnector.crearProductoCompleto({
                nombre: exp.nombre,
                descripcion: `${exp.nombre} — precio ajustado`,
                precio: decision.precio_nuevo,
              });
            await query(
              `UPDATE experiments SET precio = $1, stripe_price_id = $2,
               stripe_payment_link = $3, stripe_payment_link_id = $4,
               actualizado_en = NOW() WHERE id = $5`,
              [decision.precio_nuevo, stripePriceId, stripePaymentLink, stripePaymentLinkId, exp.id]
            );
            await LearningsDB.guardar({
              tipo: 'precio', contexto: `Ajuste de precio: ${exp.nombre}`,
              accion: `Precio bajado $${precioAnterior} → $${decision.precio_nuevo} (ScalingAgent automático)`,
              resultado: 'Nuevo link de Stripe generado y guardado',
              exito: true, hipotesis: decision.aprendizaje,
              tags: ['precio', 'ajuste_automatico', exp.nicho], relevancia: 8,
            }).catch(() => {});
          }

          if (decision.decision === 'escalar' && campaignIds.length) {
            for (const cid of campaignIds) {
              const nuevoPres = Math.min(40, (exp.metricas?.presupuesto || 10) * 1.5);
              await CampaignManager.cambiarPresupuesto(cid, nuevoPres).catch(() => {});
            }
            await LearningsDB.guardar({
              tipo: 'campana', contexto: `Auto-escalar: ${exp.nombre}`,
              accion: `Presupuesto aumentado automáticamente por ScalingAgent`,
              resultado: decision.razon, exito: true,
              hipotesis: decision.aprendizaje, tags: ['auto_escalar', exp.nicho], relevancia: 7,
            }).catch(() => {});
          }
        } catch (execErr) {
          console.warn('[ScalingAgent] Error en auto-ejecución:', execErr.message);
        }
      }

      // Aprender de la experiencia
      await ProductsMemoryDB.aprenderDeExperimento({
        ...exp, aprendizaje: decision.aprendizaje,
      });

      // Notificar a Eduardo
      const iconos = { escalar: '🚀', matar: '💀', extender_7_dias: '⏳', ajustar_precio: '💰' };
      const icono = iconos[decision.decision] || '📊';

      const metricasNotif = exp.metricas || {};
      await TelegramConnector.notificar(
        `${icono} <b>Experimento: ${exp.nombre}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 Nicho: ${exp.nicho}\n` +
        `💵 Precio: $${exp.precio} | Tipo: ${exp.tipo}\n` +
        `📊 Ventas: ${metricasNotif.ventas || 0} | Revenue: $${metricasNotif.revenue || 0}\n` +
        `\n🤖 <b>Decisión: ${decision.decision.toUpperCase().replace(/_/g, ' ')}</b>\n` +
        `${decision.razon}\n` +
        (decision.precio_nuevo ? `\n💰 Precio nuevo sugerido: $${decision.precio_nuevo}` : '') +
        `\n\n📚 Aprendizaje guardado: ${decision.aprendizaje}`
      ).catch(() => {});

      console.log(`[ScalingAgent] ${exp.nombre} → ${decision.decision}`);

    } catch (err) {
      console.error(`[ScalingAgent] Error revisando ${exp.nombre}:`, err.message);
    }
  }
}

// ── Evaluar si un nicho vale la pena lanzar ───────────
export async function evaluarNicho(nicho, tipo, precio) {
  const contexto = await ProductsMemoryDB.getContexto('digital');
  const blacklist = await ProductsMemoryDB.getBlacklist('digital');
  const blacklistTexto = blacklist.map(b => b.contenido).join('\n') || 'Ninguno';

  return AnthropicConnector.completarJSONConReintentos({
    model:     'claude-sonnet-4-6',
    maxTokens: 600,
    system:    SYSTEM,
    prompt:    `Evalúa este nicho para un producto digital:
- Nicho: ${nicho}
- Tipo: ${tipo}
- Precio: $${precio}

MEMORIA: ${contexto}
EVITAR: ${blacklistTexto}

Devuelve JSON:
{
  "score": 0-100,
  "decision": "lanzar" | "consultar" | "descartar",
  "razon": "en 1-2 oraciones",
  "precio_sugerido": numero,
  "riesgos": ["riesgo1", "riesgo2"]
}
score > 80 = lanzar | 60-80 = consultar | menos de 60 = descartar`,
  });
}

export default { revisarExperimentos, decidirSuerteExperimento, evaluarNicho };
