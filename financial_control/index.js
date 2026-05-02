// ════════════════════════════════════════════════════
// FINANCIAL CONTROL — Guardianes del presupuesto
// Lee límites desde DB (actualizables por Jarvis)
// con fallback a business.config.js si DB no disponible
// ════════════════════════════════════════════════════

import { SystemConfigDB } from '../memory/config.db.js';

async function getLimites() {
  return SystemConfigDB.getLimites();
}

export const FinancialControl = {

  async validarPresupuestoDia(presupuesto) {
    const { presupuestoMaxDia } = await getLimites();
    if (presupuesto > presupuestoMaxDia) {
      return { ok: false, error: `Presupuesto $${presupuesto}/día excede el máximo permitido ($${presupuestoMaxDia}/día)` };
    }
    return { ok: true };
  },

  async validarEscala(presupuestoActual, presupuestoNuevo) {
    const { maxEscalarPct, limiteEscalarSolo } = await getLimites();
    const aumento = presupuestoNuevo - presupuestoActual;
    const pct     = presupuestoActual > 0 ? aumento / presupuestoActual : 1;

    if (pct > maxEscalarPct) {
      return { ok: false, error: `Escala ${(pct * 100).toFixed(0)}% excede el límite permitido (${(maxEscalarPct * 100).toFixed(0)}%)` };
    }

    return { ok: true, requiereAprobacion: aumento > limiteEscalarSolo, aumento };
  },

  calcularCostoPlan(plan) {
    const costoEscalar = plan.escalar?.reduce((s, e) => s + (e.presupuesto_nuevo - e.presupuesto_actual), 0) || 0;
    const costoCrear   = plan.crear?.reduce((s, c) => s + c.presupuesto, 0) || 0;
    return { costoEscalar, costoCrear, costoTotal: costoEscalar + costoCrear };
  },

  async planEsSeguro(plan, gastoActualDia = 0) {
    const { presupuestoMaxDia } = await getLimites();
    const { costoTotal } = this.calcularCostoPlan(plan);
    const proyeccion = gastoActualDia + costoTotal;

    if (proyeccion > presupuestoMaxDia) {
      return { ok: false, error: `El plan elevaría el gasto diario a $${proyeccion.toFixed(2)}, superando el límite de $${presupuestoMaxDia}` };
    }
    return { ok: true, proyeccion };
  },
};

export default FinancialControl;
