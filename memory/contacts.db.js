// ════════════════════════════════════════════════════
// CONTACTS DB — Lista de emails propios (PostgreSQL)
// Importados desde CSV con nombre, correo, teléfono,
// carro/modelo/año y cualquier dato extra por nicho.
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

export const ContactsDB = {

  // Importar array de contactos (upsert por email)
  async importarLote(contactos) {
    let insertados = 0;
    let duplicados = 0;

    for (const c of contactos) {
      if (!c.email || !c.email.includes('@')) continue;

      const datos = {};
      if (c.carro)  datos.carro  = c.carro;
      if (c.modelo) datos.modelo = c.modelo;
      if (c.año)    datos.año    = c.año;

      const { rows } = await query(`
        INSERT INTO contacts (email, nombre, telefono, nicho, datos, fuente)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [
        c.email.trim().toLowerCase(),
        c.nombre  || null,
        c.telefono ? c.telefono.replace(/\D/g, '') : null,
        c.nicho   || 'automotriz',
        JSON.stringify(datos),
        c.fuente  || 'csv',
      ]).catch(() => ({ rows: [] }));

      rows.length ? insertados++ : duplicados++;
    }

    return { insertados, duplicados };
  },

  async total(nicho = null) {
    const sql = nicho
      ? `SELECT COUNT(*) AS total FROM contacts WHERE estado = 'activo' AND nicho = $1`
      : `SELECT COUNT(*) AS total FROM contacts WHERE estado = 'activo'`;
    const { rows } = await query(sql, nicho ? [nicho] : []);
    return parseInt(rows[0]?.total || 0);
  },

  async listarPorNicho(nicho, limite = 5000) {
    const { rows } = await query(`
      SELECT * FROM contacts
      WHERE estado = 'activo' AND nicho = $1
      ORDER BY creado_en DESC LIMIT $2
    `, [nicho, limite]);
    return rows;
  },

  async marcarBaja(email) {
    await query(
      `UPDATE contacts SET estado = 'baja' WHERE email = $1`,
      [email.trim().toLowerCase()]
    ).catch(() => {});
  },

  async marcarRebotado(email) {
    await query(
      `UPDATE contacts SET estado = 'rebotado' WHERE email = $1`,
      [email.trim().toLowerCase()]
    ).catch(() => {});
  },

  async resumen() {
    const { rows } = await query(`
      SELECT nicho, COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado = 'activo')   AS activos,
        COUNT(*) FILTER (WHERE estado = 'baja')     AS bajas,
        COUNT(*) FILTER (WHERE estado = 'rebotado') AS rebotados
      FROM contacts
      GROUP BY nicho
      ORDER BY total DESC
    `);
    return rows;
  },
};

// ── Campañas de email masivo ──────────────────────────
export const EmailCampaignsDB = {

  async crear({ nombre, nicho, experiment_id, asunto, cuerpo, totalEnviados }) {
    const { rows } = await query(`
      INSERT INTO email_campaigns (nombre, nicho, experiment_id, asunto, cuerpo, total_enviados)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [nombre, nicho, experiment_id || null, asunto, cuerpo, totalEnviados || 0]);
    return rows[0];
  },

  async registrarAbierto(campaignId, email) {
    await query(
      `UPDATE email_campaigns SET total_abiertos = total_abiertos + 1 WHERE id = $1`,
      [campaignId]
    ).catch(() => {});
    await query(
      `INSERT INTO email_tracking (campaign_id, email, evento) VALUES ($1, $2, 'abierto') ON CONFLICT DO NOTHING`,
      [campaignId, email]
    ).catch(() => {});
  },

  async registrarClick(campaignId, email, url) {
    await query(
      `UPDATE email_campaigns SET total_clicks = total_clicks + 1 WHERE id = $1`,
      [campaignId]
    ).catch(() => {});
    await query(
      `INSERT INTO email_tracking (campaign_id, email, evento, url) VALUES ($1, $2, 'click', $3)`,
      [campaignId, email, url]
    ).catch(() => {});
  },

  async listar() {
    const { rows } = await query(`
      SELECT ec.*, e.nombre AS producto_nombre
      FROM email_campaigns ec
      LEFT JOIN experiments e ON e.id = ec.experiment_id
      ORDER BY ec.creado_en DESC LIMIT 20
    `);
    return rows;
  },

  async metricas(campaignId) {
    const { rows } = await query(
      `SELECT * FROM email_campaigns WHERE id = $1`, [campaignId]
    );
    const c = rows[0];
    if (!c) return null;
    return {
      nombre:        c.nombre,
      enviados:      c.total_enviados,
      abiertos:      c.total_abiertos,
      clicks:        c.total_clicks,
      tasa_apertura: c.total_enviados > 0 ? +((c.total_abiertos / c.total_enviados) * 100).toFixed(1) : 0,
      tasa_click:    c.total_enviados > 0 ? +((c.total_clicks   / c.total_enviados) * 100).toFixed(1) : 0,
    };
  },
};

export default { ContactsDB, EmailCampaignsDB };
