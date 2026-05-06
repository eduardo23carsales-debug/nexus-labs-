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

  const gastoTotal = metricas.reduce((s, m) => s + m.hoy.spend, 0);

  // Separar métricas por tipo de campaña
  const campLead    = metricas.filter(m => m.tipo_campana === 'lead_gen');
  const campTrafico = metricas.filter(m => m.tipo_campana === 'trafico' || m.tipo_campana === 'desconocido');

  const leadsTotal   = campLead.reduce((s, m) => s + m.hoy.leads, 0);
  const visitasTotal = campTrafico.reduce((s, m) => s + (m.hoy.visitas_landing || 0), 0);

  const cplPromedio = leadsTotal > 0   ? (gastoTotal / leadsTotal).toFixed(2)   : null;
  const cpvPromedio = visitasTotal > 0 ? (gastoTotal / visitasTotal).toFixed(2) : null;

  const mejorLead    = campLead.filter(m => m.hoy.leads > 0).sort((a, b) => a.hoy.cpl - b.hoy.cpl)[0];
  const mejorTrafico = campTrafico.filter(m => (m.hoy.visitas_landing || 0) > 0)
    .sort((a, b) => (a.hoy.spend / (a.hoy.visitas_landing || 1)) - (b.hoy.spend / (b.hoy.visitas_landing || 1)))[0];

  const conv = await LeadsDB.resumenConversiones();
  const rev  = await ConversionsDB.metricas();

  const lineas = [
    `📊 <b>Reporte — ${new Date().toLocaleDateString('es-US', { timeZone: 'America/New_York' })}</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `💵 Gasto hoy: $${gastoTotal.toFixed(2)}`,
    campLead.length    ? `👥 Leads hoy: ${leadsTotal}${cplPromedio ? ` | CPL $${cplPromedio}` : ''}` : null,
    campTrafico.length ? `🖱 Visitas hoy: ${visitasTotal}${cpvPromedio ? ` | CPV $${cpvPromedio}` : ''}` : null,
    mejorLead    ? `🏆 Mejor lead gen: ${esc(mejorLead.nombre)} (CPL $${mejorLead.hoy.cpl})` : null,
    mejorTrafico ? `🏆 Mejor tráfico: ${esc(mejorTrafico.nombre)}` : null,
    ``,
    `📈 <b>Funnel acumulado</b>`,
    `👤 Total leads: ${conv.total_leads}`,
    `🗓 Citas: ${conv.citas}`,
    `🏆 Cierres: ${conv.cierres} (${conv.tasa_cierre}%)`,
    rev.ventas > 0 ? `💰 Revenue total: $${rev.revenue}` : null,
    rev.cac > 0   ? `📊 CAC: $${rev.cac}` : null,
  ].filter(Boolean);

  const msg = lineas.join('\n');

  // Tabla por campaña — label correcto según tipo
  const tabla = metricas.map(m => {
    const esTrafico = m.tipo_campana === 'trafico' || m.tipo_campana === 'desconocido';
    const convMetric = esTrafico
      ? `visitas ${m.hoy.visitas_landing || 0}${m.hoy.visitas_landing > 0 ? ` | CPV $${(m.hoy.spend / m.hoy.visitas_landing).toFixed(2)}` : ''}`
      : `leads ${m.hoy.leads}${m.hoy.cpl ? ` | CPL $${m.hoy.cpl}` : ''}`;
    const tipo = esTrafico ? '🖱' : '👥';
    return `${tipo} ${esc(m.nombre.replace('Nexus Labs — ', ''))} — $${m.hoy.spend} | ${convMetric}`;
  }).join('\n');

  return msg + '\n\n<b>Por campaña (hoy):</b>\n' + tabla;
}

export async function enviarReporte() {
  const reporte = await generarReporte();
  await TelegramConnector.notificar(reporte);
}

export default { generarReporte, enviarReporte };
