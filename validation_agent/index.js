// ════════════════════════════════════════════════════
// VALIDATION AGENT — Micro-experimentos controlados
//
// FLUJO:
//   1. Recibe idea (segmento, copy, oferta)
//   2. Crea campaña sandbox con $5-10/día
//   3. Corre 72h y mide CPL vs benchmark
//   4. Reporta: validado / rechazado / más data
//   5. Si validado → notifica para pasar a scaling
// ════════════════════════════════════════════════════

import { AnthropicConnector }     from '../connectors/anthropic.connector.js';
import { TelegramConnector, esc } from '../connectors/telegram.connector.js';
import { CampaignManager }        from '../ads_engine/campaign-manager.js';
import { crearCampana }           from '../ads_engine/campaign-creator.js';
import BUSINESS                   from '../config/business.config.js';

const PRESUPUESTO_SANDBOX      = 7;     // $7/día para pruebas
const DURACION_HORAS           = 72;    // 3 días de prueba
const LEADS_MINIMOS            = 3;     // mínimo para tener datos
const CPL_BENCHMARK_DEFAULT    = BUSINESS.campana.cplObjetivo;
const CTR_MINIMO               = 1.0;   // 1% CTR mínimo

// Almacenamiento en memoria de experimentos activos
// (en producción esto debería estar en la DB)
const _experimentos = new Map();

// ── Función principal: iniciar validación ────────────
export async function validarIdea({
  tipo        = 'segmento',     // 'segmento' | 'copy' | 'oferta'
  descripcion = '',
  segmento    = '',
  presupuestoPrueba = PRESUPUESTO_SANDBOX,
  cplBenchmark      = CPL_BENCHMARK_DEFAULT,
}) {
  if (!segmento && !descripcion) {
    throw new Error('Se requiere segmento o descripcion para validar');
  }

  const segmentoTarget = segmento || descripcion.split(' ').slice(0, 3).join('-').toLowerCase();
  console.log(`[Validation] Iniciando experimento: ${tipo} — "${segmentoTarget}"`);

  // Generar brief del experimento con Claude
  const brief = await AnthropicConnector.completarJSON({
    model:     'claude-sonnet-4-6',
    maxTokens: 800,
    system: `Eres el agente de validación de Nexus Labs. Diseñas experimentos de publicidad controlados para validar ideas antes de escalar.
Responde SOLO con JSON válido.`,
    prompt: `Diseña un experimento de validación para:
Tipo: ${tipo}
Descripción: ${descripcion || segmentoTarget}
Segmento Meta: ${segmentoTarget}
Presupuesto: $${presupuestoPrueba}/día
Benchmark CPL: $${cplBenchmark}
Duración: ${DURACION_HORAS} horas (${DURACION_HORAS / 24} días)

Devuelve:
{
  "hipotesis": "qué se espera probar en una oración",
  "criterio_exito": "condición específica para declarar validado",
  "criterio_fracaso": "condición para descartar",
  "copy_sugerido": "título del ad de prueba (máx 40 chars)",
  "notas": "advertencias o consideraciones del experimento"
}`,
  });

  // Crear campaña sandbox en Meta
  let campanaSandboxId = null;
  try {
    const result = await crearCampana(segmentoTarget, presupuestoPrueba);
    campanaSandboxId = result?.campaign_id || null;
    console.log(`[Validation] Campaña sandbox creada: ${campanaSandboxId}`);
  } catch (err) {
    console.error('[Validation] No se pudo crear campaña sandbox:', err.message);
    await TelegramConnector.notificar(
      `⚠️ <b>Validation Agent:</b> No se pudo crear la campaña sandbox.\n<code>${esc(err.message)}</code>`
    );
    throw err;
  }

  const experimento = {
    id:               `val_${Date.now()}`,
    tipo,
    descripcion:      descripcion || segmentoTarget,
    segmento:         segmentoTarget,
    campanaSandboxId,
    presupuestoPrueba,
    cplBenchmark,
    hipotesis:        brief.hipotesis,
    criterio_exito:   brief.criterio_exito,
    criterio_fracaso: brief.criterio_fracaso,
    estado:           'corriendo',
    iniciadoEn:       new Date().toISOString(),
    venceEn:          new Date(Date.now() + DURACION_HORAS * 3600_000).toISOString(),
  };

  _experimentos.set(experimento.id, experimento);

  await TelegramConnector.notificar(
    `🧪 <b>Validation Agent — Experimento iniciado</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 Tipo: ${tipo}\n` +
    `🎯 ${esc(brief.hipotesis)}\n` +
    `💵 $${presupuestoPrueba}/día × ${DURACION_HORAS / 24} días = $${presupuestoPrueba * (DURACION_HORAS / 24)}\n` +
    `✅ Éxito: ${esc(brief.criterio_exito)}\n` +
    `❌ Fracaso: ${esc(brief.criterio_fracaso)}\n` +
    `⏱️ Vence: ${new Date(experimento.venceEn).toLocaleString('es-US', { timeZone: 'America/New_York' })}`
  );

  return experimento;
}

// ── Verificar resultados de un experimento ───────────
export async function verificarResultado(experimentId) {
  const exp = _experimentos.get(experimentId);
  if (!exp) {
    throw new Error(`Experimento ${experimentId} no encontrado`);
  }

  if (!exp.campanaSandboxId) {
    return { veredicto: 'sin_datos', razon: 'No hay campaña sandbox asociada' };
  }

  console.log(`[Validation] Verificando experimento ${experimentId}...`);

  // Obtener datos reales de la campaña
  let datos;
  try {
    datos = await CampaignManager.getDatosCampana({ id: exp.campanaSandboxId });
  } catch (err) {
    console.error('[Validation] Error obteniendo datos:', err.message);
    return { veredicto: 'error', razon: err.message };
  }

  const { spend, leads, cpl, ctr } = datos.total || datos.hoy || {};
  const horasTranscurridas = (Date.now() - new Date(exp.iniciadoEn)) / 3600_000;
  const completado = horasTranscurridas >= DURACION_HORAS;

  // Veredicto con IA
  const analisis = await AnthropicConnector.completarJSON({
    model:     'claude-sonnet-4-6',
    maxTokens: 600,
    system:    'Eres el agente de validación de Nexus Labs. Evalúa experimentos de publicidad con datos reales. Responde SOLO con JSON.',
    prompt: `Evalúa este experimento:
Hipótesis: ${exp.hipotesis}
Criterio de éxito: ${exp.criterio_exito}
Criterio de fracaso: ${exp.criterio_fracaso}

Datos (${Math.round(horasTranscurridas)}h de ${DURACION_HORAS}h):
- Gasto: $${spend || 0}
- Leads: ${leads || 0}
- CPL: $${cpl || 'N/A'} (benchmark: $${exp.cplBenchmark})
- CTR: ${ctr || 'N/A'}%
- Completado: ${completado}

Devuelve:
{
  "veredicto": "validado" | "rechazado" | "mas_datos" | "promisorio",
  "confianza": 0-100,
  "razon": "explicacion en 1-2 lineas",
  "siguiente_paso": "qué hacer ahora"
}`,
  });

  // Si completado, pausar la campaña sandbox para no gastar más
  if (completado && exp.campanaSandboxId) {
    await CampaignManager.pausar(exp.campanaSandboxId).catch(() => {});
    exp.estado = 'completado';
  }

  const resultado = {
    ...analisis,
    datos:    { spend, leads, cpl, ctr, horasTranscurridas: Math.round(horasTranscurridas) },
    completado,
  };

  await TelegramConnector.notificar(
    `🧪 <b>Validation Agent — Resultado</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 ${esc(exp.descripcion)}\n` +
    `${analisis.veredicto === 'validado' ? '✅' : analisis.veredicto === 'rechazado' ? '❌' : '⚠️'} <b>${analisis.veredicto.toUpperCase()}</b> (${analisis.confianza}% confianza)\n` +
    `💬 ${esc(analisis.razon)}\n` +
    `📊 $${spend || 0} gastados · ${leads || 0} leads · CPL: $${cpl || 'N/A'}\n` +
    `👉 ${esc(analisis.siguiente_paso)}`
  );

  return resultado;
}

// ── Listar experimentos activos ──────────────────────
export function listarExperimentos() {
  return Array.from(_experimentos.values());
}

export default { validarIdea, verificarResultado, listarExperimentos };
