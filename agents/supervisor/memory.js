// ════════════════════════════════════════════════════
// SUPERVISOR MEMORY — Historial de decisiones en PG
// Permite al Supervisor aprender de decisiones pasadas
// y que Eduardo pueda aprobar/rechazar con contexto
// ════════════════════════════════════════════════════

import { query } from '../../config/database.js';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS supervisor_decisions (
      id                SERIAL PRIMARY KEY,
      campana_id        TEXT NOT NULL,
      campana_nombre    TEXT,
      decision          TEXT NOT NULL,
      razon             TEXT,
      confianza         INTEGER,
      datos_snapshot    JSONB,
      nuevo_presupuesto NUMERIC,
      autonomo          BOOLEAN DEFAULT true,
      resultado         TEXT DEFAULT 'pendiente',
      feedback_eduardo  TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      resolved_at       TIMESTAMPTZ
    )
  `);
}

export const SupervisorMemory = {

  async guardarDecision({ campanaId, campanaNombre, decision, razon, confianza, datosSnapshot, nuevoPresupuesto, autonomo }) {
    await ensureTable();
    const { rows } = await query(`
      INSERT INTO supervisor_decisions
        (campana_id, campana_nombre, decision, razon, confianza, datos_snapshot, nuevo_presupuesto, autonomo)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      RETURNING id
    `, [campanaId, campanaNombre, decision, razon, confianza,
        JSON.stringify(datosSnapshot), nuevoPresupuesto || null, autonomo]);
    return rows[0].id;
  },

  async marcarResultado(decisionId, resultado, feedbackEduardo = null) {
    await query(`
      UPDATE supervisor_decisions
      SET resultado = $1, feedback_eduardo = $2, resolved_at = NOW()
      WHERE id = $3
    `, [resultado, feedbackEduardo, decisionId]);
  },

  async obtenerPorId(decisionId) {
    await ensureTable();
    const { rows } = await query(`
      SELECT id, campana_id, campana_nombre, decision, nuevo_presupuesto, razon, confianza
      FROM supervisor_decisions WHERE id = $1
    `, [decisionId]);
    return rows[0] || null;
  },

  async cargarHistorial(limite = 20) {
    await ensureTable();
    const { rows } = await query(`
      SELECT campana_id, campana_nombre, decision, razon, confianza,
             nuevo_presupuesto, autonomo, resultado, feedback_eduardo, created_at
      FROM supervisor_decisions
      ORDER BY created_at DESC
      LIMIT $1
    `, [limite]);
    return rows;
  },

  async resumenSemanal() {
    await ensureTable();
    const { rows } = await query(`
      SELECT decision, resultado, COUNT(*)::int AS total,
             ROUND(AVG(confianza))::int AS confianza_prom
      FROM supervisor_decisions
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND decision != 'mantener'
      GROUP BY decision, resultado
      ORDER BY total DESC
    `);
    return rows;
  },
};

export default SupervisorMemory;
