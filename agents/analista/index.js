// ════════════════════════════════════════════════════
// AGENTE ANALISTA
// Corre diario 8 AM — analiza campañas, genera plan
// ════════════════════════════════════════════════════

import { MetaConnector }          from '../../connectors/meta.connector.js';
import { AnthropicConnector }     from '../../connectors/anthropic.connector.js';
import { TelegramConnector, esc } from '../../connectors/telegram.connector.js';
import { PlansDB }                from '../../memory/plans.db.js';
import { LeadsDB }                from '../../memory/leads.db.js';
import { CampaignManager }        from '../../ads_engine/campaign-manager.js';
import { llamarBriefing }         from '../../call_agent/caller.js';
import ENV                        from '../../config/env.js';
import BUSINESS                   from '../../config/business.config.js';

export async function ejecutarAnalista() {
  console.log('[Analista] Iniciando análisis...');

  try {
    const campanas = await MetaConnector.getCampanas();

    if (!campanas.length) {
      await TelegramConnector.notificar('📊 <b>Analista:</b> No hay campañas activas.');
      return;
    }

    // Recopilar métricas
    const datos = await Promise.all(
      campanas.map(c => CampaignManager.getDatosCampana(c))
    );

    // Analizar con Claude
    const plan = await AnthropicConnector.analizarCampanas({
      datos,
      resumenConversiones: await LeadsDB.resumenConversiones(),
      presupuestoMax:      BUSINESS.presupuestoMaxDia,
    });

    // Formatear mensaje Telegram
    const lineas = [];
    const fecha  = new Date().toLocaleDateString('es-US', { timeZone: 'America/New_York' });
    lineas.push(`🧠 <b>Plan del Analista — ${fecha}</b>`);
    lineas.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lineas.push(esc(plan.resumen_telegram));
    lineas.push(`━━━━━━━━━━━━━━━━━━━━━━`);

    if (plan.pausar?.length) {
      lineas.push(`\n⏸ <b>Pausar (${plan.pausar.length}):</b>`);
      plan.pausar.forEach(p => lineas.push(`• ${esc(p.nombre)} — ${esc(p.razon)}`));
    }
    if (plan.escalar?.length) {
      lineas.push(`\n📈 <b>Escalar (${plan.escalar.length}):</b>`);
      plan.escalar.forEach(e => lineas.push(`• ${esc(e.nombre)}: $${e.presupuesto_actual}→$${e.presupuesto_nuevo}/día`));
    }
    if (plan.crear?.length) {
      lineas.push(`\n🚀 <b>Crear (${plan.crear.length}):</b>`);
      plan.crear.forEach(c => lineas.push(`• ${esc(c.segmento)} $${c.presupuesto}/día`));
    }

    const costoExtra = (plan.escalar?.reduce((s, e) => s + (e.presupuesto_nuevo - e.presupuesto_actual), 0) || 0)
                     + (plan.crear?.reduce((s, c) => s + c.presupuesto, 0) || 0);
    if (costoExtra > 0) lineas.push(`\n💵 <b>Inversión adicional:</b> $${costoExtra.toFixed(2)}/día`);

    // Guardar plan
    plan._resumen_voz = plan.resumen_voz;
    await PlansDB.guardar(plan);

    // Enviar con botones de aprobación
    const teclado = {
      inline_keyboard: [[
        { text: '✅ Aprobar plan', callback_data: 'aprobar_plan' },
        { text: '❌ Ignorar',      callback_data: 'ignorar_plan' },
      ]]
    };

    await TelegramConnector.notificar(lineas.join('\n'), { reply_markup: teclado });
    console.log('[Analista] Plan enviado a Telegram');

    // Ana llama a Eduardo en 2 min
    setTimeout(() => {
      llamarBriefing(plan, plan.resumen_voz).catch(e =>
        console.error('[Analista] Error briefing:', e.message)
      );
    }, 2 * 60 * 1000);

  } catch (err) {
    console.error('[Analista] Error:', err.message);
    await TelegramConnector.notificar(
      `⚠️ <b>Analista</b> — Error:\n<code>${esc(err.message)}</code>`
    );
  }
}

// Punto de entrada directo: node agents/analista/index.js
const esDirecto = process.argv[1]?.replace(/\\/g, '/').endsWith('analista/index.js');
if (esDirecto) ejecutarAnalista();

export default ejecutarAnalista;
