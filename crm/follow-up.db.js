// ════════════════════════════════════════════════════
// CRM — Seguimientos (PostgreSQL)
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

function uuidv4() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

export const FollowUpDB = {

  async programar({ telefono, nombre, nicho, motivo, fecha, accion = 'llamar' }) {
    const id       = uuidv4();
    const fechaISO = fecha instanceof Date ? fecha.toISOString() : fecha;
    await query(`
      INSERT INTO follow_ups (id, telefono, nombre, nicho, motivo, accion, fecha_programada)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [id, telefono.replace(/\D/g, ''), nombre, nicho, motivo, accion, fechaISO]);
    return id;
  },

  async pendientes() {
    const { rows } = await query(`
      SELECT * FROM follow_ups
      WHERE completado = FALSE AND fecha_programada <= NOW()
      ORDER BY fecha_programada ASC
    `);
    return rows;
  },

  async todos() {
    const { rows } = await query(`
      SELECT * FROM follow_ups
      WHERE completado = FALSE
      ORDER BY fecha_programada ASC
    `);
    return rows;
  },

  async marcarCompletado(id) {
    await query(`
      UPDATE follow_ups SET completado = TRUE, completado_en = NOW() WHERE id = $1
    `, [id]);
  },
};

export default FollowUpDB;
