// ════════════════════════════════════════════════════
// MEMORY — Leads (PostgreSQL)
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

export const ESTADOS = {
  NUEVO:       'NUEVO',
  LLAMADO:     'LLAMADO',
  CITA:        'CITA',
  CERRADO:     'CERRADO',
  NO_CONTESTO: 'NO_CONTESTO',
  NO_INTERESA: 'NO_INTERESA',
};

const clean = (tel) => tel.replace(/\D/g, '');

export const LeadsDB = {

  async guardar(lead) {
    const tel = clean(lead.telefono);
    const { rows } = await query(`
      INSERT INTO leads (telefono, nombre, email, segmento, score, estado, fuente, creado_en, actualizado_en)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (telefono) DO UPDATE SET
        nombre         = EXCLUDED.nombre,
        email          = COALESCE(EXCLUDED.email, leads.email),
        segmento       = EXCLUDED.segmento,
        score          = EXCLUDED.score,
        estado         = COALESCE(EXCLUDED.estado, leads.estado),
        fuente         = EXCLUDED.fuente,
        actualizado_en = NOW()
      RETURNING *
    `, [tel, lead.nombre, lead.email || null, lead.segmento, lead.score || 'FRIO', lead.estado || ESTADOS.NUEVO, lead.fuente || 'web']);
    return rows[0];
  },

  async actualizar(telefono, cambios) {
    const tel     = clean(telefono);
    const sets    = [];
    const valores = [];
    let   idx     = 1;

    for (const [col, val] of Object.entries(cambios)) {
      sets.push(`${col} = $${idx++}`);
      valores.push(val);
    }
    sets.push(`actualizado_en = NOW()`);
    valores.push(tel);

    const { rows } = await query(
      `UPDATE leads SET ${sets.join(', ')} WHERE telefono = $${idx} RETURNING *`,
      valores
    );
    return rows[0] || null;
  },

  async obtener(telefono) {
    const { rows } = await query('SELECT * FROM leads WHERE telefono = $1', [clean(telefono)]);
    return rows[0] || null;
  },

  async listar(filtro = {}) {
    let sql    = 'SELECT * FROM leads WHERE 1=1';
    const vals = [];
    let   idx  = 1;
    if (filtro.estado)   { sql += ` AND estado = $${idx++}`;   vals.push(filtro.estado); }
    if (filtro.segmento) { sql += ` AND segmento = $${idx++}`; vals.push(filtro.segmento); }
    if (filtro.score)    { sql += ` AND score = $${idx++}`;    vals.push(filtro.score); }
    sql += ' ORDER BY actualizado_en DESC';
    const { rows } = await query(sql, vals);
    return rows;
  },

  async marcarCitaAgendada(telefono, { dia, hora }) {
    return this.actualizar(telefono, {
      estado:    ESTADOS.CITA,
      dia_cita:  dia,
      hora_cita: hora,
      cita_en:   new Date().toISOString(),
    });
  },

  async marcarCerrado(telefono, valor = null) {
    return this.actualizar(telefono, {
      estado:      ESTADOS.CERRADO,
      cerrado_en:  new Date().toISOString(),
      valor_venta: valor,
    });
  },

  async resumenConversiones() {
    const { rows } = await query(`
      SELECT
        COUNT(*)                                                    AS total_leads,
        COUNT(*) FILTER (WHERE estado IN ('CITA','CERRADO'))       AS citas,
        COUNT(*) FILTER (WHERE estado = 'CERRADO')                 AS cierres,
        segmento
      FROM leads
      GROUP BY segmento
    `);

    const totales = await query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE estado IN ('CITA','CERRADO')) AS citas,
        COUNT(*) FILTER (WHERE estado = 'CERRADO')           AS cierres
      FROM leads
    `);

    const t            = totales.rows[0];
    const total_leads  = parseInt(t.total);
    const citas        = parseInt(t.citas);
    const cierres      = parseInt(t.cierres);
    const por_segmento = {};

    rows.forEach(r => {
      por_segmento[r.segmento] = {
        leads:   parseInt(r.total_leads),
        citas:   parseInt(r.citas),
        cierres: parseInt(r.cierres),
      };
    });

    return {
      total_leads,
      citas,
      cierres,
      tasa_cierre: total_leads > 0 ? +(cierres / total_leads * 100).toFixed(1) : 0,
      por_segmento,
    };
  },

  async conEmailSinCompra() {
    try {
      const { rows } = await query(`
        SELECT l.telefono, l.nombre, l.email, l.segmento, l.creado_en
        FROM leads l
        WHERE l.email IS NOT NULL
          AND l.estado NOT IN ('CERRADO', 'NO_INTERESA')
          AND l.creado_en > NOW() - INTERVAL '30 days'
          AND l.creado_en < NOW() - INTERVAL '23 hours'
          AND NOT EXISTS (
            SELECT 1 FROM customers c WHERE c.email = l.email
          )
      `);
      return rows;
    } catch (err) {
      console.warn('[LeadsDB] Error en conEmailSinCompra:', err.message);
      return [];
    }
  },
};

export default LeadsDB;
