// ════════════════════════════════════════════════════
// AGENTE PROACTIVO — Cerebro unificado de Jarvis
// Corre 7:30 AM antes del Analista
// Ve TODO el contexto y Surface insights sin que Eduardo pregunte
// No sigue reglas lineales — razona causalmente con Claude
// ════════════════════════════════════════════════════

import { AnthropicConnector }      from '../../connectors/anthropic.connector.js';
import { TelegramConnector, esc }  from '../../connectors/telegram.connector.js';
import { MetaConnector }           from '../../connectors/meta.connector.js';
import { CampaignManager }         from '../../ads_engine/campaign-manager.js';
import { ExperimentsDB }           from '../../memory/products.db.js';
import { LearningsDB }             from '../../memory/learnings.db.js';
import { SupervisorMemory }        from '../supervisor/memory.js';
import { LeadsDB }                 from '../../memory/leads.db.js';

const SYSTEM = `Eres el cerebro proactivo de Jarvis, el sistema de inteligencia de Nexus Labs.

Tu trabajo es razonar sobre TODO el contexto del negocio simultáneamente y generar insights
que Eduardo no ha pedido pero necesita saber. No sigues reglas fijas — piensas causalmente.

CONTEXTO QUE RECIBES:
- Campañas activas con métricas reales
- Experimentos pausados/muertos CON SU CAUSA (por qué fallaron)
- Últimos aprendizajes del sistema
- Historial de decisiones del Supervisor
- Resumen de leads y conversiones

TU TAREA:
1. Detectar oportunidades que el sistema lineal no vería
2. Identificar experimentos que fallaron por CONFIGURACIÓN (no por producto malo) → relanzar
3. Detectar patrones entre lo que funciona y lo que no
4. Alertar sobre problemas que nadie ha notado
5. Proponer acciones concretas con razonamiento claro

CAUSA_PAUSA — cómo interpretar:
- "config_error": el producto nunca tuvo oportunidad real → VALE LA PENA RELANZAR
- "sin_datos": muy poco tiempo o presupuesto → CONSIDERAR RELANZAR con más recursos
- "decision_automatica": el sistema lo pausó sin contexto suficiente → REVISAR
- "mal_rendimiento": genuinamente no funcionó → NO relanzar (aprender del nicho)
- "audiencia_incorrecta": producto bueno, persona equivocada → RELANZAR con otro segmento
- "timing": mala época → RELANZAR cuando el timing sea correcto
- "presupuesto_bajo": insuficiente para evaluar → RELANZAR con budget adecuado

PRINCIPIOS:
- Sé honesto sobre incertidumbre — si no hay suficientes datos, dilo
- Prioriza insights accionables sobre observaciones obvias
- Una buena pregunta vale más que diez observaciones vacías
- Máximo 5 insights para no abrumar a Eduardo

Responde en JSON:
{
  "insights": [
    {
      "tipo": "oportunidad" | "alerta" | "patron" | "relanzar" | "pregunta",
      "titulo": "Título corto del insight",
      "detalle": "Explicación en 2-3 oraciones con razonamiento causal",
      "accion_sugerida": "Qué hacer concretamente (o null si es solo observación)",
      "prioridad": "alta" | "media" | "baja",
      "experiment_id": null o el ID si aplica a un experimento específico
    }
  ],
  "resumen_salud": "Una frase sobre el estado general del negocio hoy"
}`;

export async function ejecutarProactivo() {
  console.log('[Proactivo] Iniciando análisis cerebro unificado...');

  try {
    // Construir contexto unificado — todo en paralelo
    const [
      campanasRaw,
      experimentosMuertos,
      experimentosActivos,
      learnings,
      historialSupervisor,
      resumenLeads,
    ] = await Promise.all([
      MetaConnector.getCampanas(true).catch(() => []),
      ExperimentsDB.listarConCausa(['muerto', 'extendido']).catch(() => []),
      ExperimentsDB.listar('activo').catch(() => []),
      LearningsDB.ultimos(15).catch(() => []),
      SupervisorMemory.cargarHistorial(10).catch(() => []),
      LeadsDB.resumenConversiones().catch(() => ({})),
    ]);

    // Métricas de campañas activas
    const campanas = await Promise.allSettled(
      campanasRaw.map(c => CampaignManager.getDatosCampana(c))
    ).then(res => res.filter(r => r.status === 'fulfilled').map(r => r.value));

    if (!experimentosMuertos.length && !campanas.length && !learnings.length) {
      console.log('[Proactivo] Sin suficiente contexto para analizar');
      return;
    }

    const prompt = `CONTEXTO COMPLETO DEL NEGOCIO — ${new Date().toLocaleDateString('es-US', { timeZone: 'America/New_York' })}

═══ CAMPAÑAS META ACTIVAS (${campanas.length}) ═══
${campanas.length
  ? JSON.stringify(campanas.map(c => ({
      nombre:          c.nombre,
      dias_activa:     c.dias_activa,
      tipo:            c.tipo_campana,
      hoy:             c.hoy,
      ultimos_7_dias:  c.ultimos_7_dias,
    })), null, 2)
  : 'Ninguna campaña activa'}

═══ EXPERIMENTOS ACTIVOS (${experimentosActivos.length}) ═══
${experimentosActivos.length
  ? experimentosActivos.map(e =>
      `• ${e.nombre} (${e.nicho}) | $${e.precio} | métricas: ${JSON.stringify(e.metricas || {})}`
    ).join('\n')
  : 'Ninguno'}

═══ EXPERIMENTOS PAUSADOS/MUERTOS CON CAUSA (${experimentosMuertos.length}) ═══
${experimentosMuertos.length
  ? experimentosMuertos.map(e =>
      `• [${e.estado.toUpperCase()}] ${e.nombre}\n` +
      `  Nicho: ${e.nicho} | Precio: $${e.precio}\n` +
      `  CAUSA: ${e.causa_pausa || 'sin registrar'}\n` +
      `  Notas: ${e.notas_pausa || e.notas || 'ninguna'}\n` +
      `  Métricas: ${JSON.stringify(e.metricas || {})}`
    ).join('\n\n')
  : 'Ninguno'}

═══ ÚLTIMOS APRENDIZAJES DEL SISTEMA (${learnings.length}) ═══
${learnings.length
  ? learnings.map(l =>
      `• [${l.exito ? '✅' : '❌'} ${l.tipo}] ${l.accion} → ${l.resultado}${l.hipotesis ? ` | ${l.hipotesis}` : ''}`
    ).join('\n')
  : 'Sin aprendizajes registrados aún'}

═══ HISTORIAL SUPERVISOR — ÚLTIMAS DECISIONES ═══
${historialSupervisor.length
  ? historialSupervisor.map(d =>
      `• ${d.campana_nombre} → ${d.decision} (${d.confianza}%) | ${d.razon} | resultado: ${d.resultado}`
    ).join('\n')
  : 'Sin historial'}

═══ RESUMEN LEADS Y CONVERSIONES ═══
${JSON.stringify(resumenLeads, null, 2)}

Analiza todo esto y genera los insights más valiosos para Eduardo. Prioriza experimentos que merecen una segunda oportunidad y patrones que el sistema lineal no puede detectar.`;

    const raw = await AnthropicConnector.completar({ system: SYSTEM, prompt, maxTokens: 1500 });
    let resultado;
    try {
      resultado = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      console.warn('[Proactivo] No se pudo parsear respuesta JSON');
      return;
    }

    const { insights = [], resumen_salud = '' } = resultado;
    if (!insights.length) {
      console.log('[Proactivo] Sin insights relevantes hoy');
      return;
    }

    // Construir mensaje Telegram
    const ICONOS = {
      oportunidad: '💡',
      alerta:      '⚠️',
      patron:      '🔗',
      relanzar:    '🔄',
      pregunta:    '❓',
    };
    const PRIORIDAD_ORDEN = { alta: 0, media: 1, baja: 2 };
    const sorted = [...insights].sort((a, b) => PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad]);

    const lineas = [
      `🧠 <b>Jarvis — Análisis Proactivo</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 ${esc(resumen_salud)}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    for (const ins of sorted) {
      const icono = ICONOS[ins.tipo] || '•';
      const prioTag = ins.prioridad === 'alta' ? ' 🔴' : ins.prioridad === 'media' ? ' 🟡' : '';
      lineas.push(`\n${icono} <b>${esc(ins.titulo)}${prioTag}</b>`);
      lineas.push(esc(ins.detalle));
      if (ins.accion_sugerida) lineas.push(`→ <i>${esc(ins.accion_sugerida)}</i>`);
    }

    await TelegramConnector.notificar(lineas.join('\n'));
    console.log(`[Proactivo] ${insights.length} insights enviados a Eduardo`);

    // Guardar aprendizaje de esta sesión
    LearningsDB.guardar({
      tipo:      'proactivo',
      contexto:  `Análisis proactivo — ${campanas.length} campañas, ${experimentosMuertos.length} experimentos pausados`,
      accion:    'Análisis cerebro unificado',
      resultado: `${insights.length} insights generados | ${sorted.filter(i => i.prioridad === 'alta').length} de alta prioridad`,
      exito:     insights.length > 0,
      tags:      ['proactivo', 'cerebro'],
      relevancia: 6,
    }).catch(() => {});

  } catch (err) {
    console.error('[Proactivo] Error:', err.message);
  }
}

export default ejecutarProactivo;
