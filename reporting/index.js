// ════════════════════════════════════════════════════
// REPORTING — Métricas, conversiones y dashboard
// ════════════════════════════════════════════════════

import { MetaConnector }          from '../connectors/meta.connector.js';
import { TelegramConnector, esc } from '../connectors/telegram.connector.js';
import { LeadsDB }                from '../memory/leads.db.js';
import { CallsDB }                from '../memory/calls.db.js';
import { ConversionsDB }          from '../memory/conversions.db.js';
import { CampaignManager }        from '../ads_engine/campaign-manager.js';

export async function generarReporte() {
  const campanas = await MetaConnector.getCampanas(true);
  if (!campanas.length) return '📊 No hay campañas activas.';

  const metricas = await Promise.all(campanas.map(c => CampaignManager.getDatosCampana(c)));

  const gastoTotal  = metricas.reduce((s, m) => s + m.hoy.spend, 0);
  const leadsTotal  = metricas.reduce((s, m) => s + m.hoy.leads, 0);
  const cplPromedio = leadsTotal > 0 ? (gastoTotal / leadsTotal).toFixed(2) : 'N/A';

  const mejor = metricas
    .filter(m => m.hoy.leads > 0)
    .sort((a, b) => a.hoy.cpl - b.hoy.cpl)[0];

  const conv = await LeadsDB.resumenConversiones();
  const rev  = await ConversionsDB.metricas();

  const lineas = [
    `📊 <b>Reporte — ${new Date().toLocaleDateString('es-US', { timeZone: 'America/New_York' })}</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `💵 Gasto hoy: $${gastoTotal.toFixed(2)}`,
    `👥 Leads hoy: ${leadsTotal}`,
    `📉 CPL promedio: $${cplPromedio}`,
    mejor ? `🏆 Mejor campaña: ${esc(mejor.nombre)} (CPL $${mejor.hoy.cpl})` : '',
    ``,
    `📈 <b>Funnel acumulado</b>`,
    `👤 Total leads: ${conv.total_leads}`,
    `🗓 Citas: ${conv.citas}`,
    `🏆 Cierres: ${conv.cierres} (${conv.tasa_cierre}%)`,
    rev.ventas > 0 ? `💰 Revenue total: $${rev.revenue}` : '',
    rev.cac > 0   ? `📊 CAC: $${rev.cac}` : '',
  ].filter(Boolean);

  const msg = lineas.join('\n');

  // Tabla de campañas activas
  const tabla = metricas.map(m =>
    `• ${esc(m.segmento)} — gasto $${m.hoy.spend} | leads ${m.hoy.leads}${m.hoy.cpl ? ` | CPL $${m.hoy.cpl}` : ''}`
  ).join('\n');

  return msg + '\n\n<b>Por campaña (hoy):</b>\n' + tabla;
}

export async function enviarReporte() {
  const reporte = await generarReporte();
  await TelegramConnector.notificar(reporte);
}

export default { generarReporte, enviarReporte };
