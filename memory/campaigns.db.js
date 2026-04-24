// ════════════════════════════════════════════════════
// MEMORY — Campañas (PostgreSQL)
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

export const CampaignsDB = {

  async registrarAccion(campanaId, accion) {
    const { rows } = await query(`SELECT * FROM campaigns WHERE campaign_id = $1`, [campanaId]);
    const existing  = rows[0];
    const historial = existing ? [...existing.historial, { accion, fecha: new Date().toISOString(), ...accion.datos }] : [{ accion, fecha: new Date().toISOString() }];

    await query(`
      INSERT INTO campaigns (campaign_id, segmento, ultima_accion, historial, actualizado_en)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (campaign_id) DO UPDATE SET
        ultima_accion  = $3,
        historial      = $4,
        actualizado_en = NOW()
    `, [campanaId, accion.segmento || null, accion, historial]);
  },

  async obtener(campanaId) {
    const { rows } = await query(`SELECT * FROM campaigns WHERE campaign_id = $1`, [campanaId]);
    return rows[0] || null;
  },

  async listar() {
    const { rows } = await query(`SELECT * FROM campaigns ORDER BY actualizado_en DESC`);
    return rows;
  },

  async existeSegmento(segmento) {
    const { rows } = await query(`
      SELECT 1 FROM campaigns
      WHERE segmento = $1 AND (ultima_accion->>'tipo') != 'pausada'
      LIMIT 1
    `, [segmento]);
    return rows.length > 0;
  },
};

export default CampaignsDB;
