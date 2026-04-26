// ════════════════════════════════════════════════════
// AGENTE SUPERVISOR IA
// Claude analiza campañas cada 4h con memoria histórica.
// Aprende de sus decisiones pasadas y del feedback de Eduardo.
// ════════════════════════════════════════════════════

import { MetaConnector }           from '../../connectors/meta.connector.js';
import { AnthropicConnector }      from '../../connectors/anthropic.connector.js';
import { TelegramConnector, esc }  from '../../connectors/telegram.connector.js';
import { CampaignManager }         from '../../ads_engine/campaign-manager.js';
import { SupervisorMemory }        from './memory.js';
import BUSINESS                    from '../../config/business.config.js';

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
- Aumento autónomo máximo por ciclo: $${BUSINESS.limiteEscalarSolo} (en dólares de aumento)
- Escalada máxima por ciclo: ${BUSINESS.maxEscalarPct * 100}%
- Cambios de presupuesto solo entre 9AM–7PM ET

ACCIONES DISPONIBLES:
- "pausar": detener la campaña
- "escalar": subir presupuesto (especifica nuevo_presupuesto exacto en USD/día)
- "reducir": bajar presupuesto (especifica nuevo_presupuesto exacto en USD/día)
- "mantener": no hacer nada esta ronda — observar
- "alerta": notificar a Eduardo sin ejecutar (anomalías, dudas, patrones extraños)

AUTONOMÍA:
- autonomo: true  → ejecutas la acción inmediatamente
- autonomo: false → propones a Eduardo y esperas su aprobación

CRITERIOS DE CONFIANZA:
- 90–100%: patrón claro y consistente → actúa autónomamente
- 70–89%: tendencia evidente → actúa autónomamente si el cambio es pequeño
- 50–69%: señal ambigua → pide aprobación o usa "mantener"
- < 50%: muy incierto → usa "alerta" o "mantener"

PRINCIPIOS DE DECISIÓN:
- Si llevas < 4h activo hoy y no hay datos suficientes, prefiere "mantener"
- El historial es tu memoria — si Eduardo rechazó algo similar, sé más conservador
- Una campaña con buen historial 7d pero mal día de hoy puede estar en un ciclo normal
- Un CPL excelente con < 3 leads puede ser ruido estadístico — no escalar agresivamente
- Si estás fuera de horario activo: solo puedes "pausar" (emergencias) o "mantener"
- Explica tu razonamiento en español claro (máx 120 caracteres)`;

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

    const [historial, hora, dia, ts] = await Promise.all([
      SupervisorMemory.cargarHistorial(20),
      Promise.resolve(horaET()),
      Promise.resolve(diaET()),
      Promise.resolve(tsET()),
    ]);
    const dentroHorario = hora >= 9 && hora < 19;

    const prompt = `CONTEXTO ACTUAL:
Hora: ${ts} (${hora}h ET — ${dia})
${dentroHorario
  ? '✅ Dentro de horario activo — cambios de presupuesto permitidos'
  : '⚠️ FUERA DE HORARIO ACTIVO — solo "pausar" si hay emergencia real, sino "mantener"'}

CAMPAÑAS ACTIVAS (JSON con datos de hoy y últimos 7 días):
${JSON.stringify(datosCampanas, null, 2)}

HISTORIAL DE DECISIONES PREVIAS (más reciente primero):
${historialAContexto(historial)}

Devuelve ÚNICAMENTE un JSON array con una decisión por campaña, sin markdown ni texto adicional:
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

      if (d.autonomo) {
        try {
          if (d.decision === 'pausar') {
            await CampaignManager.pausar(d.campana_id);
          } else if ((d.decision === 'escalar' || d.decision === 'reducir') && d.nuevo_presupuesto) {
            await CampaignManager.cambiarPresupuesto(d.campana_id, d.nuevo_presupuesto);
          }
          await SupervisorMemory.marcarResultado(decisionId, 'ejecutado');
          ejecutadas.push({ ...d, decisionId });
          console.log(`[Supervisor] ✓ ${d.decision} — ${d.campana_nombre} (${d.confianza}%)`);
        } catch (err) {
          console.error(`[Supervisor] Error ejecutando ${d.decision}:`, err.message);
          await SupervisorMemory.marcarResultado(decisionId, 'error_ejecucion');
        }
      } else {
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
