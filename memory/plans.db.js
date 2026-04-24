// ════════════════════════════════════════════════════
// MEMORY — Planes del Analista (PostgreSQL)
// TTL: 24 horas. Solo existe un plan activo a la vez.
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

const TTL_H = 24;

export const PlansDB = {

  async guardar(plan) {
    await query(`UPDATE plans SET ejecutado = TRUE WHERE ejecutado = FALSE`);
    await query(`INSERT INTO plans (plan, ejecutado) VALUES ($1, FALSE)`, [plan]);
  },

  async cargar() {
    const { rows } = await query(`
      SELECT * FROM plans WHERE ejecutado = FALSE ORDER BY creado_en DESC LIMIT 1
    `);
    if (!rows.length) return null;
    const record = rows[0];
    const edad_h = (Date.now() - new Date(record.creado_en).getTime()) / 3_600_000;
    if (edad_h > TTL_H) { await this.limpiar(); return null; }
    return record.plan;
  },

  async marcarEjecutado() {
    await query(`UPDATE plans SET ejecutado = TRUE, ejecutado_en = NOW() WHERE ejecutado = FALSE`);
  },

  async limpiar() {
    await query(`DELETE FROM plans WHERE ejecutado = FALSE`);
  },

  async hayPlanPendiente() {
    return (await this.cargar()) !== null;
  },
};

export default PlansDB;
