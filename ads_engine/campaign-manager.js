// ════════════════════════════════════════════════════
// ADS ENGINE — Gestión de campañas existentes
// Pausar, activar, escalar presupuesto
// ════════════════════════════════════════════════════

import { MetaConnector } from '../connectors/meta.connector.js';

export const CampaignManager = {

  async pausar(campanaId) {
    return MetaConnector.post(`/${campanaId}`, { status: 'PAUSED' });
  },

  async activar(campanaId) {
    return MetaConnector.post(`/${campanaId}`, { status: 'ACTIVE' });
  },

  async cambiarPresupuesto(campanaId, presupuestoDia) {
    const centavos = Math.round(presupuestoDia * 100);
    return MetaConnector.post(`/${campanaId}`, { daily_budget: centavos });
  },

  async escalar(campanaId, presupuestoActual, pct = 0.20) {
    const nuevo = +(presupuestoActual * (1 + pct)).toFixed(2);
    await this.cambiarPresupuesto(campanaId, nuevo);
    return nuevo;
  },

  // Buscar campaña por nombre parcial entre todas las activas
  async buscarPorNombre(nombreParcial) {
    const campanas = await MetaConnector.getCampanas();
    return campanas.filter(c =>
      c.name.toLowerCase().includes(nombreParcial.toLowerCase())
    );
  },

  // Obtener datos completos de una campaña (métricas 7d + hoy)
  async getDatosCampana(campana) {
    const m7d  = await MetaConnector.getMetricas(campana.id, 'last_7d');
    const mhoy = await MetaConnector.getMetricas(campana.id, 'today');

    // Extraer segmento del nombre (formato: "Nexus Labs — Segmento — fecha")
    const partes  = campana.name.split(' — ');
    const segmento = partes[1]?.toLowerCase().replace(/\s+/g, '-') || 'desconocido';

    return {
      id:              campana.id,
      nombre:          campana.name,
      segmento,
      estado:          campana.effective_status,
      presupuesto_dia: parseFloat(campana.daily_budget || 0) / 100,
      ultimos_7_dias:  m7d,
      hoy:             mhoy,
    };
  },
};

export default CampaignManager;
