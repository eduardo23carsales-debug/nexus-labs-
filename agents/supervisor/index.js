// ════════════════════════════════════════════════════
// AGENTE SUPERVISOR IA
// Claude analiza campañas cada 4h con memoria histórica.
// Aprende de sus decisiones pasadas y del feedback de Eduardo.
// ════════════════════════════════════════════════════

import { MetaConnector }                                    from '../../connectors/meta.connector.js';
import { AnthropicConnector }                               from '../../connectors/anthropic.connector.js';
import { TelegramConnector, esc }                           from '../../connectors/telegram.connector.js';
import { CampaignManager }                                  from '../../ads_engine/campaign-manager.js';
import { generarSlideshowParaCampana }                      from '../../ads_engine/campaign-creator.js';
import { SupervisorMemory }                                 from './memory.js';
import { LearningsDB }                                      from '../../memory/learnings.db.js';
import { SystemState }                                      from '../../config/system-state.js';
import BUSINESS                                             from '../../config/business.config.js';
import { FinancialControl }                                 from '../../financial_control/index.js';

const ICONOS = { pausar: '⏸', escalar: '📈', reducir: '📉', alerta: '⚠️', mantener: '✅' };

function horaET() {
  return parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }), 10);
}

function tsET() {
  return new Date().toLocaleString('es-US', { timeZone: 'America/New_York' });
}

function diaET() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long' });
}

function historialAContexto(rows) {
  if (!rows.length) return 'Sin historial previo — primera ejecución.';
  return rows.map(d => {
    const ts  = new Date(d.created_at).toLocaleString('es-US', { timeZone: 'America/New_York' });
    const res = d.resultado === 'pendiente' ? '(pendiente Eduardo)' : `resultado: ${d.resultado}`;
    const fb  = d.feedback_eduardo ? ` | Feedback: "${d.feedback_eduardo}"` : '';
    return `[${ts}] ${d.campana_nombre} → ${d.decision} (${d.confianza}%) | ${d.razon} | ${res}${fb}`;
  }).join('\n');
}

// System prompt — extraído fuera de la función para no reconstruirlo cada ciclo
const SYSTEM = `Eres el Supervisor de campañas de Meta Ads para Nexus Labs.
Analizas el rendimiento de cada campaña activa y decides la mejor acción para maximizar ROI.

REGLAS DE NEGOCIO:
- Presupuesto máximo diario: $${BUSINESS.presupuestoMaxDia}
- CPL objetivo: < $${BUSINESS.campana.cplObjetivo}
- Pausa si gasta > $${BUSINESS.limiteGastoSinLead} con 0 leads
- Pausa si CPL > $${BUSINESS.riesgo.cplMaxAntesPausar} (riesgo crítico)
- Aumento autónomo máximo por ciclo: $${BUSINESS.limiteEscalarSolo}
- Escalada máxima por ciclo: ${BUSINESS.maxEscalarPct * 100}%
- Escalera de presupuesto: ${BUSINESS.escalera.pasos.join(' → ')} USD/día
- Cambios de presupuesto solo entre 9AM–7PM ET

ACCIONES DISPONIBLES:
- "pausar": detener la campaña
- "escalar": subir presupuesto al siguiente paso de la escalera
- "reducir": bajar presupuesto
- "refresh_creativo": frecuencia > ${BUSINESS.riesgo.frecuenciaFatiga} — solicitar nuevo slideshow
- "mantener": observar sin cambios
- "alerta": notificar a Eduardo sin ejecutar

REGLAS DE RIESGO AUTOMÁTICAS (aplicar antes que cualquier otra decisión):
- CPL > $${BUSINESS.riesgo.cplMaxAntesPausar} → pausar inmediatamente (autonomo: true)
- Gasto > $${BUSINESS.riesgo.gastoSinConversion} sin conversión → pausar inmediatamente
- Frecuencia > ${BUSINESS.riesgo.frecuenciaFatiga} → "refresh_creativo" (autonomo: true)
- CTR < ${BUSINESS.riesgo.ctrMinimoAlerta}% → "alerta" a Eduardo
- Quality score global < ${BUSINESS.riesgo.qualityScoreMinimo} → "alerta" a Eduardo
- ROAS < ${BUSINESS.riesgo.roasMinimo} → NO escalar, usar "mantener"

ESCALERA DE PRESUPUESTO (nunca saltear pasos):
Pasos: ${BUSINESS.escalera.pasos.join(' → ')} USD/día
- Mínimo ${BUSINESS.escalera.diasValidacion} días en cada paso antes de subir
- CPL debe estar dentro del ${Math.round((BUSINESS.escalera.cplTolerancia - 1) * 100)}% del objetivo para subir
- Nunca más de un paso por ciclo

BREAK-EVEN:
- Precio producto: $${BUSINESS.breakeven.precioProducto}
- Margen neto: ${BUSINESS.breakeven.margenNeto * 100}%
- CPL de break-even estimado: $${+(BUSINESS.breakeven.precioProducto * BUSINESS.breakeven.margenNeto * BUSINESS.breakeven.tasaConversion).toFixed(2)} (asumiendo ${BUSINESS.breakeven.tasaConversion * 100}% conversión)

AUTONOMÍA:
- autonomo: true  → ejecutas inmediatamente
- autonomo: false → propones a Eduardo y esperas aprobación

CRITERIOS DE CONFIANZA:
- 90–100%: actúa autónomamente
- 70–89%: actúa si cambio es pequeño
- 50–69%: pide aprobación
- < 50%: "alerta" o "mantener"

TIPOS DE CAMPAÑA:
- "lead_gen" → métrica clave = leads
- "trafico"  → métrica clave = visitas_landing y ctr
- "desconocido" → "mantener" hasta tener datos

REGLA CRÍTICA — CAMPAÑAS NUEVAS:
- dias_activa <= 3: NUNCA pausar por falta de conversiones
- dias_activa <= 3 y gasto < $20: algoritmo en aprendizaje — mantener siempre

PRINCIPIOS:
- dias_activa es la edad real — úsala primero
- El historial es tu memoria — si Eduardo rechazó algo similar, sé conservador
- Quality score bajo = Meta te está penalizando = cambiar creativo antes de escalar
- Device data: si mobile CTR >> desktop → verificar que landing sea mobile-friendly
- Horario: si hay datos de horas pico → sugiere dayparting
- Explica en español claro (máx 120 chars)`;

// Cierra el loop de aprendizaje: compara CPL antes/después de escalar
async function cerrarLoopAprendizaje(datosActuales) {
  try {
    const escalados = await SupervisorMemory.cargarEscaladosRecientes();
    for (const d of escalados) {
      const campanaActual = datosActuales.find(c => c.id === d.campana_id);
      if (!campanaActual) continue;
      const cplAntes  = d.datos_snapshot?.ultimos_7_dias?.cpl;
      const cplAhora  = campanaActual?.ultimos_7_dias?.cpl;
      if (!cplAntes || !cplAhora) continue;
      const mejoro = cplAhora < cplAntes;
      const pct    = ((cplAhora - cplAntes) / cplAntes * 100).toFixed(1);
      await LearningsDB.guardar({
        tipo:      'campana',
        contexto:  `Escalado ${d.campana_nombre}: presupuesto → $${d.nuevo_presupuesto}/día`,
        accion:    `Subir presupuesto al siguiente paso de la escalera`,
        resultado: `CPL ${mejoro ? 'bajó' : 'subió'}: $${cplAntes} → $${cplAhora} (${mejoro ? '' : '+'}${pct}%)`,
        exito:     mejoro,
        hipotesis: mejoro
          ? `Escalar ${d.campana_nombre} mejoró el CPL — repetir cuando condiciones similares`
          : `Escalar ${d.campana_nombre} empeoró el CPL — ser más conservador con escaladas`,
        tags:      ['escalado', 'resultado_real', d.campana_nombre.toLowerCase().replace(/\s+/g, '_')],
        relevancia: mejoro ? 7 : 9,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Supervisor] Loop aprendizaje:', err.message);
  }
}

export async function ejecutarSupervisor() {
  console.log('[Supervisor] Iniciando análisis IA...');

  try {
    const campanas = await MetaConnector.getCampanas(true);
    if (!campanas.length) {
      console.log('[Supervisor] Sin campañas activas');
      return;
    }

    const resultados = await Promise.allSettled(
      campanas.map(c => CampaignManager.getDatosCampana(c))
    );

    const datosCampanas = [];
    for (let i = 0; i < campanas.length; i++) {
      const res = resultados[i];
      if (res.status === 'rejected') {
        console.error(`[Supervisor] Error campaña ${campanas[i].id}:`, res.reason?.message);
        continue;
      }
      datosCampanas.push(res.value);
    }
    if (!datosCampanas.length) return;

    // Recopilar datos profundos en paralelo para las campañas activas
    const datosExtendidos = await Promise.all(datosCampanas.map(async c => {
      const [quality, dispositivo, frecuencia, roas] = await Promise.allSettled([
        MetaConnector.getQualityScores(c.id, 'last_7d'),
        MetaConnector.getBreakdownDispositivo(c.id, 'last_7d'),
        MetaConnector.getFrecuenciaYAlcance(c.id, 'last_7d'),
        MetaConnector.getRoas(c.id, 'last_7d'),
      ]);
      return {
        ...c,
        quality_scores:  quality.status === 'fulfilled'    ? quality.value    : [],
        dispositivo:     dispositivo.status === 'fulfilled' ? dispositivo.value : [],
        frecuencia:      frecuencia.status === 'fulfilled'  ? frecuencia.value  : null,
        roas:            roas.status === 'fulfilled'        ? roas.value        : null,
      };
    }));

    // Cerrar loop de aprendizaje (no bloquea el análisis)
    cerrarLoopAprendizaje(datosCampanas).catch(() => {});

    const [historial, learnings, autoMode, hora, dia, ts] = await Promise.all([
      SupervisorMemory.cargarHistorial(20),
      LearningsDB.ultimos(8).catch(() => []),
      SystemState.isAutoMode().catch(() => false),
      Promise.resolve(horaET()),
      Promise.resolve(diaET()),
      Promise.resolve(tsET()),
    ]);
    const dentroHorario = hora >= 9 && hora < 19;

    const learningsCtx = learnings.length
      ? learnings.map(l =>
          `- [${l.exito ? '✅' : '❌'} ${l.tipo}] ${l.accion} → ${l.resultado}${l.hipotesis ? ` (${l.hipotesis})` : ''}`
        ).join('\n')
      : 'Sin aprendizajes registrados aún.';

    const prompt = `CONTEXTO ACTUAL:
Hora: ${ts} (${hora}h ET — ${dia})
Modo autónomo: ${autoMode ? '🤖 ACTIVO — ejecuta TODO con confianza ≥ 60%' : '❌ inactivo — solo acciones de riesgo crítico se auto-ejecutan'}
${dentroHorario
  ? '✅ Dentro de horario activo — cambios de presupuesto permitidos'
  : '⚠️ FUERA DE HORARIO ACTIVO — solo "pausar" si hay emergencia real, sino "mantener"'}

APRENDIZAJES PREVIOS DEL SISTEMA (qué funcionó y qué no — úsalos para mejorar decisiones):
${learningsCtx}

CAMPAÑAS ACTIVAS — datos completos con quality scores, dispositivo, frecuencia y ROAS:
${JSON.stringify(datosExtendidos, null, 2)}

HISTORIAL DE DECISIONES PREVIAS (más reciente primero):
${historialAContexto(historial)}

Devuelve ÚNICAMENTE un JSON array con una decisión por campaña. Para "refresh_creativo" incluye el campo "segmento" con el nombre del segmento de la campaña. Sin markdown ni texto adicional:
[
  {
    "campana_id": "ID_exacto_de_Meta",
    "campana_nombre": "nombre exacto",
    "decision": "mantener|pausar|escalar|reducir|alerta",
    "razon": "Explicación en español máx 120 chars",
    "confianza": 85,
    "nuevo_presupuesto": null,
    "autonomo": true
  }
]`;

    // Claude analiza y decide
    let decisiones;
    try {
      const raw = await AnthropicConnector.completar({ system: SYSTEM, prompt, maxTokens: 1200 });
      decisiones = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (!Array.isArray(decisiones)) throw new Error('La respuesta no es un array JSON');
    } catch (err) {
      console.error('[Supervisor] Error parseando decisiones AI:', err.message);
      await TelegramConnector.notificar(
        `⚠️ <b>Supervisor IA</b> — Error en análisis:\n<code>${esc(err.message)}</code>`
      );
      return;
    }

    const ejecutadas = [];
    const propuestas = [];

    for (const d of decisiones) {
      const snapshot = datosCampanas.find(c => c.id === d.campana_id) || {};

      // Guardar siempre en memoria, incluido "mantener"
      const decisionId = await SupervisorMemory.guardarDecision({
        campanaId:        d.campana_id,
        campanaNombre:    d.campana_nombre,
        decision:         d.decision,
        razon:            d.razon,
        confianza:        d.confianza,
        datosSnapshot:    snapshot,
        nuevoPresupuesto: d.nuevo_presupuesto,
        autonomo:         d.autonomo || d.decision === 'mantener',
      });

      if (d.decision === 'mantener') {
        await SupervisorMemory.marcarResultado(decisionId, 'ejecutado');
        continue;
      }

      if (d.decision === 'alerta') {
        // Notificación sin acción, pero guardar como ejecutado
        await SupervisorMemory.marcarResultado(decisionId, 'ejecutado');
        await TelegramConnector.notificar(
          `⚠️ <b>Supervisor IA — Alerta</b>\n${esc(d.campana_nombre)}\n💡 ${esc(d.razon)}`
        );
        continue;
      }

      // En modo autónomo, ejecutar todo con confianza >= 60% sin pedir permiso
      const ejecutarAhora = d.autonomo || (autoMode && d.confianza >= 60);

      if (ejecutarAhora) {
        try {
          if (d.decision === 'pausar') {
            await CampaignManager.pausar(d.campana_id);

          } else if ((d.decision === 'escalar' || d.decision === 'reducir') && d.nuevo_presupuesto) {
            const check = FinancialControl.validarPresupuestoDia(d.nuevo_presupuesto);
            if (!check.ok) {
              await TelegramConnector.notificar(`🛑 <b>Supervisor bloqueado:</b> ${esc(d.campana_nombre)}\n${esc(check.error)}`);
              await SupervisorMemory.marcarResultado(decisionId, 'bloqueado_financial');
              continue;
            }
            await CampaignManager.cambiarPresupuesto(d.campana_id, d.nuevo_presupuesto);

          } else if (d.decision === 'refresh_creativo') {
            // Fatiga detectada → generar nuevo slideshow y notificar
            const segmento  = d.segmento || 'emprendedor-principiante';
            const producto  = d.campana_nombre.split(' — ')[1] || d.campana_nombre;
            await TelegramConnector.notificar(
              `🔄 <b>Supervisor: Refresh de creativo</b>\n` +
              `📊 ${esc(d.campana_nombre)}\n` +
              `⚠️ Fatiga detectada — generando nuevo slideshow...`
            );
            try {
              const sl = await generarSlideshowParaCampana(producto, segmento, {}, 5);
              await LearningsDB.guardar({
                tipo: 'campana', contexto: `Refresh creativo por fatiga: ${d.campana_nombre}`,
                accion: `Nuevo slideshow generado (${sl.nSlides} slides, videoId: ${sl.videoId})`,
                resultado: 'Slideshow creado — pendiente de asignar al adset manualmente',
                exito: true, tags: ['fatiga', 'refresh', 'slideshow'], relevancia: 8,
              }).catch(() => {});
              await TelegramConnector.notificar(
                `✅ <b>Nuevo slideshow listo</b>\n` +
                `🎬 ${sl.nSlides} slides generados\n` +
                `🆔 Video ID: ${sl.videoId}\n` +
                `💡 Asigna este video al adset con fatiga para renovar el creativo.`
              );
            } catch (slErr) {
              await TelegramConnector.notificar(`⚠️ Refresh fallido para ${esc(d.campana_nombre)}: ${esc(slErr.message)}`);
            }
          }

          await SupervisorMemory.marcarResultado(decisionId, 'ejecutado');
          ejecutadas.push({ ...d, decisionId });
          console.log(`[Supervisor] ✓ ${d.decision} — ${d.campana_nombre} (${d.confianza}%)`);
        } catch (err) {
          console.error(`[Supervisor] Error ejecutando ${d.decision}:`, err.message);
          await SupervisorMemory.marcarResultado(decisionId, 'error_ejecucion');
        }
      } else {
        // Modo manual: proponer a Eduardo con botones de aprobación
        propuestas.push({ ...d, decisionId });
        console.log(`[Supervisor] ⏳ ${d.decision} — ${d.campana_nombre} → esperando Eduardo`);
      }
    }

    // Reporte agrupado de acciones autónomas ejecutadas
    if (ejecutadas.length) {
      const lineas = [
        `🤖 <b>Supervisor IA — ${ts}</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        ...ejecutadas.map(d => {
          const icono  = ICONOS[d.decision] || '•';
          const presup = d.nuevo_presupuesto ? ` → $${d.nuevo_presupuesto}/día` : '';
          return `${icono} <b>${esc(d.campana_nombre)}</b>${presup}\n   💡 ${esc(d.razon)} <i>(${d.confianza}%)</i>`;
        }),
      ];
      await TelegramConnector.notificar(lineas.join('\n'));
    }

    // Solicitudes de aprobación individuales
    for (const d of propuestas) {
      const datos  = datosCampanas.find(c => c.id === d.campana_id);
      const icono  = ICONOS[d.decision] || '❓';

      let msg = `${icono} <b>Supervisor IA — Aprobación requerida</b>\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📊 <b>${esc(d.campana_nombre)}</b>\n`;
      msg += `🎯 Acción: <b>${d.decision.toUpperCase()}`;
      if (d.nuevo_presupuesto && datos) msg += ` ($${datos.presupuesto_dia}/día → $${d.nuevo_presupuesto}/día)`;
      msg += `</b>\n💡 ${esc(d.razon)}\n📈 Confianza: ${d.confianza}%`;

      if (datos) {
        msg += `\n\n📋 <b>Hoy:</b> $${datos.hoy.spend} | ${datos.hoy.leads} leads`;
        if (datos.hoy.cpl) msg += ` | CPL $${datos.hoy.cpl}`;
        msg += `\n📋 <b>7 días:</b> $${datos.ultimos_7_dias.spend} | ${datos.ultimos_7_dias.leads} leads`;
        if (datos.ultimos_7_dias.cpl) msg += ` | CPL $${datos.ultimos_7_dias.cpl}`;
      }

      await TelegramConnector.notificar(msg, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Aprobar',  callback_data: `sv_aprobar:${d.decisionId}`  },
            { text: '❌ Rechazar', callback_data: `sv_rechazar:${d.decisionId}` },
          ]]
        }
      });
    }

    if (!ejecutadas.length && !propuestas.length) {
      console.log('[Supervisor] Campañas en orden — sin acciones necesarias');
    }

    console.log('[Supervisor] Análisis IA completado');

  } catch (err) {
    console.error('[Supervisor] Error:', err.message);
    await TelegramConnector.notificar(
      `⚠️ <b>Supervisor IA</b> — Error:\n<code>${esc(err.message)}</code>`
    );
  }
}

// Resumen semanal de lo que el Supervisor aprendió
export async function enviarResumenSemanal() {
  try {
    const stats = await SupervisorMemory.resumenSemanal();
    if (!stats.length) return;

    const lineas = [
      `📊 <b>Supervisor IA — Resumen Semanal</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ...stats.map(s => {
        const conf = s.confianza_prom ? ` (confianza ${s.confianza_prom}%)` : '';
        return `• ${s.decision} / ${s.resultado}: ${s.total} ${s.total > 1 ? 'veces' : 'vez'}${conf}`;
      }),
    ];

    await TelegramConnector.notificar(lineas.join('\n'));
  } catch (err) {
    console.error('[Supervisor] Error resumen semanal:', err.message);
  }
}

export default ejecutarSupervisor;
