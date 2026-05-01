// ════════════════════════════════════════════════════
// CRM — Clientes (PostgreSQL)
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

function uuidv4() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const clean = (tel) => tel?.replace(/\D/g, '') || uuidv4();

export const ESTADOS_CRM = {
  NUEVO:          'NUEVO',
  CONTACTADO:     'CONTACTADO',
  NO_CONTESTO:    'NO_CONTESTO',
  CITA_AGENDADA:  'CITA_AGENDADA',
  CITA_REALIZADA: 'CITA_REALIZADA',
  CERRADO:        'CERRADO',
  NO_INTERESA:    'NO_INTERESA',
  SEGUIMIENTO:    'SEGUIMIENTO',
};

export const NICHOS = {
  'lease-renewal':     'Renovación de lease',
  'compra-carro':      'Compra de carro',
  'mal-credito':       'Financiamiento mal crédito',
  'sin-credito':       'Sin historial crediticio',
  'landing-page':      'Diseño de landing page',
  'marketing-digital': 'Marketing digital',
  'barberia':          'Barbería',
  'restaurante':       'Restaurante',
  'inmuebles':         'Bienes raíces',
  'seguros':           'Seguros',
  'general':           'General',
};

export const ClientDB = {

  async guardar(datos) {
    const tel = clean(datos.telefono);
    const { rows: existing } = await query(`SELECT * FROM clients WHERE telefono = $1`, [tel]);
    const prev = existing[0] || {};

    const datos_producto = { ...(prev.datos_producto || {}), ...(datos.datos_producto || {}) };
    const etiquetas      = datos.etiquetas || prev.etiquetas || [];

    const { rows } = await query(`
      INSERT INTO clients (telefono, client_id, nombre, email, nicho, estado, datos_producto, historial, proxima_accion, notas, etiquetas, creado_en, actualizado_en)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      ON CONFLICT (telefono) DO UPDATE SET
        nombre          = COALESCE($3, clients.nombre),
        email           = COALESCE($4, clients.email),
        nicho           = COALESCE($5, clients.nicho),
        estado          = COALESCE($6, clients.estado),
        datos_producto  = $7,
        proxima_accion  = COALESCE($9, clients.proxima_accion),
        notas           = COALESCE($10, clients.notas),
        etiquetas       = $11,
        actualizado_en  = NOW()
      RETURNING *
    `, [
      tel,
      prev.client_id || uuidv4(),
      datos.nombre   || prev.nombre,
      datos.email    || prev.email    || null,
      datos.nicho    || prev.nicho    || 'general',
      datos.estado   || prev.estado   || ESTADOS_CRM.NUEVO,
      JSON.stringify(datos_producto),
      JSON.stringify(Array.isArray(prev.historial) ? prev.historial : []),
      datos.proxima_accion || null,
      datos.notas    || prev.notas    || '',
      etiquetas,
    ]);
    return rows[0];
  },

  async registrarInteraccion(telefono, interaccion) {
    const tel = clean(telefono);
    const { rows } = await query(`SELECT historial FROM clients WHERE telefono = $1`, [tel]);
    if (!rows.length) return null;

    const nueva = {
      id:        uuidv4(),
      tipo:      interaccion.tipo,
      fecha:     new Date().toISOString(),
      resultado: interaccion.resultado || null,
      notas:     interaccion.notas     || '',
      duracion:  interaccion.duracion  || null,
    };
    const prevHistorial = Array.isArray(rows[0].historial) ? rows[0].historial : [];
    const historial = [nueva, ...prevHistorial];

    const updates = [`historial = $1`, `actualizado_en = NOW()`];
    const vals    = [JSON.stringify(historial), tel];

    if (interaccion.estado_nuevo) {
      updates.push(`estado = $3`);
      vals.push(interaccion.estado_nuevo);
    }

    const { rows: updated } = await query(
      `UPDATE clients SET ${updates.join(', ')} WHERE telefono = $2 RETURNING *`,
      vals
    );
    return updated[0];
  },

  async obtener(telefono) {
    const { rows } = await query(`SELECT * FROM clients WHERE telefono = $1`, [clean(telefono)]);
    return rows[0] || null;
  },

  async buscar(q) {
    const like = `%${q.toLowerCase()}%`;
    const { rows } = await query(`
      SELECT * FROM clients
      WHERE LOWER(nombre) LIKE $1 OR telefono LIKE $2 OR LOWER(nicho) LIKE $1
      ORDER BY actualizado_en DESC
      LIMIT 20
    `, [like, `%${q}%`]);
    return rows;
  },

  async listar({ nicho, estado, etiqueta, limit = 50 } = {}) {
    let sql  = 'SELECT * FROM clients WHERE 1=1';
    const v  = [];
    let idx  = 1;
    if (nicho)    { sql += ` AND nicho = $${idx++}`;    v.push(nicho); }
    if (estado)   { sql += ` AND estado = $${idx++}`;   v.push(estado); }
    if (etiqueta) { sql += ` AND etiquetas @> $${idx++}::jsonb`; v.push(JSON.stringify([etiqueta])); }
    sql += ` ORDER BY actualizado_en DESC LIMIT $${idx}`;
    v.push(limit);
    const { rows } = await query(sql, v);
    return rows;
  },

  async seguimientosPendientes() {
    const { rows } = await query(`
      SELECT * FROM clients
      WHERE proxima_accion <= NOW()
        AND estado NOT IN ('CERRADO','NO_INTERESA')
    `);
    return rows;
  },

  async resumenPorNicho() {
    const { rows } = await query(`
      SELECT
        nicho,
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE estado IN ('CITA_AGENDADA','CITA_REALIZADA')) AS citas,
        COUNT(*) FILTER (WHERE estado = 'CERRADO')                        AS cierres
      FROM clients
      GROUP BY nicho
    `);
    const resumen = {};
    rows.forEach(r => {
      resumen[r.nicho] = { total: parseInt(r.total), citas: parseInt(r.citas), cierres: parseInt(r.cierres) };
    });
    return resumen;
  },

  async total() {
    const { rows } = await query(`SELECT COUNT(*) AS n FROM clients`);
    return parseInt(rows[0].n);
  },
};

export default ClientDB;
