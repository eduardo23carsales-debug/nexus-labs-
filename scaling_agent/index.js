// ════════════════════════════════════════════════════
// SCALING AGENT — Monitorea y decide el futuro de
// cada experimento de producto digital a las 72h
// ════════════════════════════════════════════════════

import { AnthropicConnector } from '../connectors/anthropic.connector.js';
import { TelegramConnector }  from '../connectors/telegram.connector.js';
import { ExperimentsDB, ProductsMemoryDB } from '../memory/products.db.js';

const SYSTEM = `Eres el agente de scaling de Nexus Labs. Analizas experimentos de productos
digitales y decides qué hacer con ellos en base a datos reales. Responde con JSON válido.`;

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

      await ExperimentsDB.actualizarEstado(exp.id, estadoNuevo, decision.razon);

      // Aprender de la experiencia
      await ProductsMemoryDB.aprenderDeExperimento({
        ...exp, aprendizaje: decision.aprendizaje,
      });

      // Notificar a Eduardo
      const iconos = { escalar: '🚀', matar: '💀', extender_7_dias: '⏳', ajustar_precio: '💰' };
      const icono = iconos[decision.decision] || '📊';

      const metricas = exp.metricas || {};
      await TelegramConnector.notificar(
        `${icono} <b>Experimento: ${exp.nombre}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 Nicho: ${exp.nicho}\n` +
        `💵 Precio: $${exp.precio} | Tipo: ${exp.tipo}\n` +
        `📊 Ventas: ${metricas.ventas || 0} | Revenue: $${metricas.revenue || 0}\n` +
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
