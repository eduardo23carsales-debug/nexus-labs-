// ════════════════════════════════════════════════════
// CONFIG DB — Configuración dinámica del sistema
// Jarvis puede leer y actualizar límites desde Telegram
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

const DEFAULTS = {
  presupuesto_max_dia:   30,
  limite_escalar_solo:   10,
  limite_gasto_sin_lead: 4,
  max_escalar_pct:       0.20,
  cpl_objetivo:          5,
};

const DESCRIPCIONES = {
  presupuesto_max_dia:   'Gasto máximo diario en Meta Ads (USD)',
  limite_escalar_solo:   'El Supervisor puede escalar solo hasta este monto extra (USD)',
  limite_gasto_sin_lead: 'Pausa campaña si gasta este monto sin generar leads (USD)',
  max_escalar_pct:       'Máximo % de aumento de presupuesto por ciclo (0.20 = 20%)',
  cpl_objetivo:          'CPL objetivo — por debajo de esto la campaña es buena (USD)',
};

export const SystemConfigDB = {

  async get(clave) {
    try {
      const { rows } = await query(`SELECT valor FROM system_config WHERE clave = $1`, [clave]);
      if (rows[0]) return parseFloat(rows[0].valor);
    } catch (_) {}
    return DEFAULTS[clave] ?? null;
  },

  async getAll() {
    try {
      const { rows } = await query(`SELECT clave, valor, descripcion, actualizado_en FROM system_config ORDER BY clave`);
      return rows.reduce((acc, r) => {
        acc[r.clave] = { valor: parseFloat(r.valor), descripcion: r.descripcion, actualizado_en: r.actualizado_en };
        return acc;
      }, {});
    } catch (_) {
      return Object.fromEntries(
        Object.entries(DEFAULTS).map(([k, v]) => [k, { valor: v, descripcion: DESCRIPCIONES[k] }])
      );
    }
  },

  async set(clave, valor) {
    if (!(clave in DEFAULTS)) throw new Error(`Clave desconocida: "${clave}". Claves válidas: ${Object.keys(DEFAULTS).join(', ')}`);
    await query(
      `INSERT INTO system_config (clave, valor, descripcion) VALUES ($1, $2, $3)
       ON CONFLICT (clave) DO UPDATE SET valor = $2, actualizado_en = NOW()`,
      [clave, String(valor), DESCRIPCIONES[clave]]
    );
    return { clave, valor: parseFloat(valor) };
  },

  // Para FinancialControl — carga todos los límites de una vez
  async getLimites() {
    const all = await this.getAll();
    return {
      presupuestoMaxDia:   all.presupuesto_max_dia?.valor   ?? DEFAULTS.presupuesto_max_dia,
      limiteEscalarSolo:   all.limite_escalar_solo?.valor   ?? DEFAULTS.limite_escalar_solo,
      limiteGastoSinLead:  all.limite_gasto_sin_lead?.valor ?? DEFAULTS.limite_gasto_sin_lead,
      maxEscalarPct:       all.max_escalar_pct?.valor       ?? DEFAULTS.max_escalar_pct,
      cplObjetivo:         all.cpl_objetivo?.valor          ?? DEFAULTS.cpl_objetivo,
    };
  },
};

export default SystemConfigDB;
