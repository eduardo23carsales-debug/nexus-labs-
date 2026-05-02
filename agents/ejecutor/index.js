// ════════════════════════════════════════════════════
// AGENTE EJECUTOR
// Recibe plan aprobado y lo implementa en Meta Ads
// ════════════════════════════════════════════════════

import { MetaConnector }          from '../../connectors/meta.connector.js';
import { TelegramConnector, esc } from '../../connectors/telegram.connector.js';
import { crearCampana }           from '../../ads_engine/campaign-creator.js';
import { CampaignManager }        from '../../ads_engine/campaign-manager.js';
import { ProjectsDB }             from '../../crm/projects.db.js';
import { PlansDB }                from '../../memory/plans.db.js';
import { FinancialControl }       from '../../financial_control/index.js';

export async function ejecutarPlan(plan) {
  console.log('[Ejecutor] Ejecutando plan aprobado...');
  const acciones = [];

  try {
    // 1. Pausar campañas
    for (const p of (plan.pausar || [])) {
      try {
        await CampaignManager.pausar(p.id);
        acciones.push(`⏸ Pausada: <b>${esc(p.nombre)}</b>`);
        console.log(`[Ejecutor] Pausada: ${p.nombre}`);
      } catch (e) {
        acciones.push(`⚠️ No pude pausar ${esc(p.nombre)}: ${esc(e.message)}`);
      }
    }

    // 2. Escalar campañas (con validación financiera)
    for (const e of (plan.escalar || [])) {
      try {
        const check = FinancialControl.validarEscala(e.presupuesto_actual || 0, e.presupuesto_nuevo);
        if (!check.ok) {
          acciones.push(`🛑 Escala bloqueada: <b>${esc(e.nombre)}</b> — ${esc(check.error)}`);
          console.warn(`[Ejecutor] Escala bloqueada: ${e.nombre} — ${check.error}`);
          continue;
        }
        await CampaignManager.cambiarPresupuesto(e.id, e.presupuesto_nuevo);
        acciones.push(`📈 Escalada: <b>${esc(e.nombre)}</b> → $${e.presupuesto_nuevo}/día`);
        console.log(`[Ejecutor] Escalada: ${e.nombre} a $${e.presupuesto_nuevo}/día`);
      } catch (e2) {
        acciones.push(`⚠️ No pude escalar ${esc(e.nombre)}: ${esc(e2.message)}`);
      }
    }

    // 3. Crear campañas nuevas (con validación financiera)
    for (const c of (plan.crear || [])) {
      try {
        const check = FinancialControl.validarPresupuestoDia(c.presupuesto);
        if (!check.ok) {
          acciones.push(`🛑 Creación bloqueada: <b>${esc(c.segmento)}</b> — ${esc(check.error)}`);
          console.warn(`[Ejecutor] Creación bloqueada: ${c.segmento} — ${check.error}`);
          continue;
        }
        acciones.push(`⏳ Creando <b>${esc(c.segmento)}</b>...`);
        const result = await crearCampana(c.segmento, c.presupuesto);
        acciones.push(`🚀 Creada: <b>${esc(c.segmento)}</b> — ${result.ads.length} ads activos`);
        console.log(`[Ejecutor] Creada: ${c.segmento}`);
      } catch (e) {
        acciones.push(`⚠️ No pude crear ${esc(c.segmento)}: ${esc(e.message)}`);
      }
    }

    // Marcar el plan como ejecutado
    await PlansDB.marcarEjecutado().catch(() => {});

    // Registrar inversión adicional generada por el plan en todos los proyectos activos
    const inversionNueva = (plan.crear || []).reduce((s, c) => s + (c.presupuesto || 0), 0)
                         + (plan.escalar || []).reduce((s, e) => s + ((e.presupuesto_nuevo || 0) - (e.presupuesto_actual || 0)), 0);

    if (inversionNueva > 0) {
      // Registra en los proyectos escalando o en todos los que están activos
      const proyectos = await ProjectsDB.listar({ estado: 'escalando' }).catch(() => []);
      for (const p of proyectos) {
        await ProjectsDB.actualizarMetricas(p.id, { inversion: inversionNueva }, 'ejecutor').catch(() => {});
      }
    }

    const ts = new Date().toLocaleString('es-US', { timeZone: 'America/New_York' });
    await TelegramConnector.notificar(
      `⚡ <b>Ejecutor — Plan implementado</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      acciones.join('\n') +
      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🕐 ${ts}`
    );

    console.log('[Ejecutor] Plan completado');
    return { ok: true, acciones };

  } catch (err) {
    console.error('[Ejecutor] Error:', err.message);
    await TelegramConnector.notificar(
      `❌ <b>Ejecutor</b> — Error:\n<code>${esc(err.message)}</code>`
    );
    return { ok: false, error: err.message };
  }
}

export default ejecutarPlan;
