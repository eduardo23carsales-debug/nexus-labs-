// ════════════════════════════════════════════════════
// MEMORY — Conversiones y Revenue (PostgreSQL)
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

export const ConversionsDB = {

  async registrarVenta({ telefono, nombre, segmento, valor, gasto_campana = 0 }) {
    const cac = gasto_campana > 0 ? +(gasto_campana / 1).toFixed(2) : null;
    await query(`
      INSERT INTO conversions (telefono, nombre, segmento, valor, gasto_campana, cac)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [telefono.replace(/\D/g, ''), nombre, segmento, parseFloat(valor) || 0, parseFloat(gasto_campana) || 0, cac]);
  },

  async metricas() {
    const { rows } = await query(`
      SELECT
        COUNT(*)          AS ventas,
        SUM(valor)        AS revenue,
        SUM(gasto_campana) AS gasto,
        segmento
      FROM conversions
      GROUP BY segmento
    `);

    const totales = await query(`
      SELECT COUNT(*) AS ventas, COALESCE(SUM(valor),0) AS revenue, COALESCE(SUM(gasto_campana),0) AS gasto
      FROM conversions
    `);

    const t       = totales.rows[0];
    const ventas  = parseInt(t.ventas);
    const revenue = parseFloat(t.revenue);
    const gasto   = parseFloat(t.gasto);
    const cac     = ventas > 0 ? gasto / ventas : 0;
    const roi     = gasto  > 0 ? +((revenue - gasto) / gasto * 100).toFixed(1) : null;

    const por_segmento = {};
    rows.forEach(r => {
      por_segmento[r.segmento] = {
        ventas:  parseInt(r.ventas),
        revenue: parseFloat(r.revenue),
      };
    });

    return { ventas, revenue: +revenue.toFixed(2), gasto: +gasto.toFixed(2), cac: +cac.toFixed(2), roi, por_segmento };
  },
};

export default ConversionsDB;
