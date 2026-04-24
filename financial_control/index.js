// ════════════════════════════════════════════════════
// FINANCIAL CONTROL — Guardianes del presupuesto
// Valida que ninguna acción supere los límites del negocio
// ════════════════════════════════════════════════════

import BUSINESS from '../config/business.config.js';

export const FinancialControl = {

  // Verifica que un presupuesto propuesto no exceda el máximo diario
  validarPresupuestoDia(presupuesto) {
    if (presupuesto > BUSINESS.presupuestoMaxDia) {
      return {
        ok: false,
        error: `Presupuesto $${presupuesto}/día excede el máximo permitido ($${BUSINESS.presupuestoMaxDia}/día)`,
      };
    }
    return { ok: true };
  },

  // Verifica que una escala sea válida (dentro del % permitido)
  validarEscala(presupuestoActual, presupuestoNuevo) {
    const aumento = presupuestoNuevo - presupuestoActual;
    const pct     = aumento / presupuestoActual;

    if (pct > BUSINESS.maxEscalarPct) {
      return {
        ok: false,
        error: `Escala ${(pct * 100).toFixed(0)}% excede el límite permitido (${BUSINESS.maxEscalarPct * 100}%)`,
      };
    }

    const requiereAprobacion = aumento > BUSINESS.limiteEscalarSolo;
    return { ok: true, requiereAprobacion, aumento };
  },

  // Calcula el gasto total proyectado de un plan
  calcularCostoPlan(plan) {
    const costoEscalar = plan.escalar?.reduce(
      (s, e) => s + (e.presupuesto_nuevo - e.presupuesto_actual), 0
    ) || 0;
    const costoCrear = plan.crear?.reduce((s, c) => s + c.presupuesto, 0) || 0;
    return { costoEscalar, costoCrear, costoTotal: costoEscalar + costoCrear };
  },

  // Retorna true si el plan está dentro de los límites del negocio
  planEsSeguro(plan, gastoActualDia = 0) {
    const { costoTotal } = this.calcularCostoPlan(plan);
    const proyeccion = gastoActualDia + costoTotal;

    if (proyeccion > BUSINESS.presupuestoMaxDia) {
      return {
        ok: false,
        error: `El plan elevaría el gasto diario a $${proyeccion.toFixed(2)}, superando el límite de $${BUSINESS.presupuestoMaxDia}`,
      };
    }

    return { ok: true, proyeccion };
  },
};

export default FinancialControl;
