// ════════════════════════════════════════════════════
// PRODUCTS DB — Memoria de productos digitales
// Guarda ganadores, blacklist y experimentos activos
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

// ── Memoria de patrones (qué funciona / qué evitar) ──
export const ProductsMemoryDB = {

  async getGanadores(categoria = 'digital') {
    if (!process.env.DATABASE_URL) return [];
    const { rows } = await query(
      `SELECT * FROM product_memory
       WHERE categoria = $1 AND tipo = 'patron' AND contenido NOT ILIKE '[EVITAR]%'
       ORDER BY confianza DESC, creado_en DESC LIMIT 20`,
      [categoria]
    ).catch(() => ({ rows: [] }));
    return rows;
  },

  async getBlacklist(categoria = 'digital') {
    if (!process.env.DATABASE_URL) return [];
    const { rows } = await query(
      `SELECT * FROM product_memory
       WHERE categoria = $1 AND contenido ILIKE '[EVITAR]%'
       ORDER BY creado_en DESC LIMIT 50`,
      [categoria]
    ).catch(() => ({ rows: [] }));
    return rows;
  },

  async getContexto(categoria = 'digital') {
    if (!process.env.DATABASE_URL) return 'Sin memoria previa.';
    const { rows } = await query(
      `SELECT * FROM product_memory WHERE categoria = $1
       ORDER BY confianza DESC, creado_en DESC LIMIT 20`,
      [categoria]
    ).catch(() => ({ rows: [] }));
    if (!rows.length) return 'Sin memoria previa para esta categoría.';
    return rows.map(m => `[${m.tipo.toUpperCase()}] ${m.contenido} (confianza: ${m.confianza})`).join('\n');
  },

  async guardar({ tipo = 'patron', categoria = 'digital', contenido, confianza = 0.7 }) {
    if (!process.env.DATABASE_URL) return;
    await query(
      `INSERT INTO product_memory (tipo, categoria, contenido, confianza) VALUES ($1, $2, $3, $4)`,
      [tipo, categoria, contenido, confianza]
    ).catch(() => {});
  },

  async guardarGanador(categoria, contenido) {
    return this.guardar({ tipo: 'patron', categoria, contenido, confianza: 0.8 });
  },

  async guardarBlacklist(categoria, contenido) {
    return this.guardar({ tipo: 'aprendizaje', categoria, contenido: `[EVITAR] ${contenido}`, confianza: 0.9 });
  },

  async rechazarNicho(nicho) {
    const nombre    = nicho.nicho || nicho;
    const subgrupo  = nicho.subgrupo_latino ? ` | Subgrupo: ${nicho.subgrupo_latino}` : '';
    const palabras  = nombre.toLowerCase().replace(/[^a-záéíóúüñ\s]/gi, '').split(' ').filter(w => w.length > 3).slice(0, 5).join(', ');
    await this.guardar({
      tipo:      'aprendizaje',
      categoria: 'digital',
      contenido: `[EVITAR] "${nombre}" (${nicho.tipo || '?'} $${nicho.precio || '?'})${subgrupo} — Palabras clave: ${palabras}. Evitar CUALQUIER variación.`,
      confianza: 1.0,
    });
  },

  async aprenderDeExperimento(exp) {
    const gano = (exp.metricas?.revenue || 0) > 0;
    if (gano) {
      await this.guardarGanador('digital',
        `Nicho "${exp.nicho}" tipo ${exp.tipo} a $${exp.precio} generó $${exp.metricas.revenue} en revenue`
      );
    } else {
      await this.guardarBlacklist('digital',
        `Nicho "${exp.nicho}" tipo ${exp.tipo} a $${exp.precio} — $0 revenue después de 72h`
      );
    }
  },
};

// ── Experimentos activos ──────────────────────────────
export const ExperimentsDB = {

  async crear({ nicho, nombre, tipo, precio, hotmartId = null, hotmartUrl = null, productoUrl = null, contenidoProducto = null }) {
    if (!process.env.DATABASE_URL) return { id: null };
    const { rows } = await query(
      `INSERT INTO experiments (nicho, nombre, tipo, precio, hotmart_id, hotmart_url, producto_url, contenido_producto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nicho, nombre, tipo, precio, hotmartId, hotmartUrl, productoUrl, contenidoProducto]
    ).catch(() => ({ rows: [{}] }));
    return rows[0];
  },

  async listar(estado = 'activo') {
    if (!process.env.DATABASE_URL) return [];
    const { rows } = await query(
      `SELECT id, nicho, nombre, tipo, precio, estado, hotmart_url, metricas, creado_en
       FROM experiments WHERE estado = $1 ORDER BY creado_en DESC`,
      [estado]
    ).catch(() => ({ rows: [] }));
    return rows;
  },

  async obtener(id) {
    if (!process.env.DATABASE_URL) return null;
    const { rows } = await query(`SELECT * FROM experiments WHERE id = $1`, [id]).catch(() => ({ rows: [] }));
    return rows[0] || null;
  },

  async actualizarEstado(id, estado, notas = null) {
    if (!process.env.DATABASE_URL) return;
    await query(
      `UPDATE experiments SET estado = $1, notas = COALESCE($2, notas), actualizado_en = NOW() WHERE id = $3`,
      [estado, notas, id]
    ).catch(() => {});
  },

  async actualizarMetricas(id, metricas) {
    if (!process.env.DATABASE_URL) return;
    await query(
      `UPDATE experiments SET metricas = $1, actualizado_en = NOW() WHERE id = $2`,
      [JSON.stringify(metricas), id]
    ).catch(() => {});
  },

  // Buscar experimentos con más de 72h sin decisión
  async pendientesDecision() {
    if (!process.env.DATABASE_URL) return [];
    const { rows } = await query(
      `SELECT * FROM experiments
       WHERE estado = 'activo'
         AND creado_en < NOW() - INTERVAL '72 hours'
       ORDER BY creado_en ASC`,
    ).catch(() => ({ rows: [] }));
    return rows;
  },
};

export default { ProductsMemoryDB, ExperimentsDB };
