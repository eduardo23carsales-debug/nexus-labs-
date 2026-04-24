// ════════════════════════════════════════════════════
// MEMORY — Llamadas (PostgreSQL)
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

export const CallsDB = {

  async registrar(llamada) {
    await query(`
      INSERT INTO calls (call_id, nombre, telefono, estado, razon_fin, duracion_s, cita, dia_cita, hora_cita, resumen)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
      llamada.callId       || null,
      llamada.nombre,
      llamada.telefono,
      llamada.estado,
      llamada.endedReason  || null,
      llamada.duration     || null,
      llamada.citaAgendada || false,
      llamada.diaCita      || null,
      llamada.horaCita     || null,
      llamada.summary      || null,
    ]);
  },

  async listar({ limit = 50, soloConCita = false } = {}) {
    const sql = soloConCita
      ? 'SELECT * FROM calls WHERE cita = TRUE ORDER BY llamada_en DESC LIMIT $1'
      : 'SELECT * FROM calls ORDER BY llamada_en DESC LIMIT $1';
    const { rows } = await query(sql, [limit]);
    return rows;
  },

  async resumen() {
    const { rows } = await query(`
      SELECT
        COUNT(*)                                 AS total,
        COUNT(*) FILTER (WHERE duracion_s > 10) AS contestadas,
        COUNT(*) FILTER (WHERE cita = TRUE)     AS con_cita
      FROM calls
    `);
    const r           = rows[0];
    const total       = parseInt(r.total);
    const contestadas = parseInt(r.contestadas);
    const conCita     = parseInt(r.con_cita);
    return {
      total,
      contestadas,
      sin_respuesta:   total - contestadas,
      citas_agendadas: conCita,
      tasa_respuesta:  total > 0 ? +(contestadas / total * 100).toFixed(1) : 0,
      tasa_conversion: contestadas > 0 ? +(conCita / contestadas * 100).toFixed(1) : 0,
    };
  },
};

export default CallsDB;
