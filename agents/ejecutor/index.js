// ════════════════════════════════════════════════════
// AGENTE EJECUTOR
// Recibe plan aprobado y lo implementa en Meta Ads
// ════════════════════════════════════════════════════

import { MetaConnector }          from '../../connectors/meta.connector.js';
import { TelegramConnector, esc } from '../../connectors/telegram.connector.js';
import { crearCampana }           from '../../ads_engine/campaign-creator.js';
import { CampaignManager }        from '../../ads_engine/campaign-manager.js';

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

    // 2. Escalar campañas
    for (const e of (plan.escalar || [])) {
      try {
        await CampaignManager.cambiarPresupuesto(e.id, e.presupuesto_nuevo);
        acciones.push(`📈 Escalada: <b>${esc(e.nombre)}</b> → $${e.presupuesto_nuevo}/día`);
        console.log(`[Ejecutor] Escalada: ${e.nombre} a $${e.presupuesto_nuevo}/día`);
      } catch (e2) {
        acciones.push(`⚠️ No pude escalar ${esc(e.nombre)}: ${esc(e2.message)}`);
      }
    }

    // 3. Crear campañas nuevas
    for (const c of (plan.crear || [])) {
      try {
        acciones.push(`⏳ Creando <b>${esc(c.segmento)}</b>...`);
        const result = await crearCampana(c.segmento, c.presupuesto);
        acciones.push(`🚀 Creada: <b>${esc(c.segmento)}</b> — ${result.ads.length} ads activos`);
        console.log(`[Ejecutor] Creada: ${c.segmento}`);
      } catch (e) {
        acciones.push(`⚠️ No pude crear ${esc(c.segmento)}: ${esc(e.message)}`);
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
