// ════════════════════════════════════════════════════
// JARVIS MEMORY DB — Memoria persistente del agente
// Sobrevive redeploys. Se inyecta en cada conversación.
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

export const JarvisMemoryDB = {

  async guardar({ tipo = 'hecho', titulo, contenido, importancia = 5 }) {
    if (!process.env.DATABASE_URL) return null;
    const { rows } = await query(
      `INSERT INTO jarvis_memory (tipo, titulo, contenido, importancia)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tipo, titulo, contenido, importancia]
    ).catch(() => ({ rows: [null] }));
    return rows[0];
  },

  async actualizar(id, { titulo, contenido, importancia, activa }) {
    if (!process.env.DATABASE_URL) return;
    const campos = [];
    const vals   = [];
    let i = 1;
    if (titulo      !== undefined) { campos.push(`titulo = $${i++}`);      vals.push(titulo); }
    if (contenido   !== undefined) { campos.push(`contenido = $${i++}`);   vals.push(contenido); }
    if (importancia !== undefined) { campos.push(`importancia = $${i++}`); vals.push(importancia); }
    if (activa      !== undefined) { campos.push(`activa = $${i++}`);      vals.push(activa); }
    if (!campos.length) return;
    campos.push(`actualizado_en = NOW()`);
    vals.push(id);
    await query(
      `UPDATE jarvis_memory SET ${campos.join(', ')} WHERE id = $${i}`,
      vals
    ).catch(() => {});
  },

  async desactivar(id) {
    return this.actualizar(id, { activa: false });
  },

  async listar({ soloActivas = true, limite = 50 } = {}) {
    if (!process.env.DATABASE_URL) return [];
    const filtro = soloActivas ? 'WHERE activa = TRUE' : '';
    const { rows } = await query(
      `SELECT * FROM jarvis_memory ${filtro}
       ORDER BY importancia DESC, creado_en DESC LIMIT $1`,
      [limite]
    ).catch(() => ({ rows: [] }));
    return rows;
  },

  // Contexto condensado para inyectar en el system prompt de Jarvis
  async getContexto() {
    if (!process.env.DATABASE_URL) return '';
    const memorias = await this.listar({ soloActivas: true, limite: 30 });
    if (!memorias.length) return '';

    const porTipo = {};
    for (const m of memorias) {
      if (!porTipo[m.tipo]) porTipo[m.tipo] = [];
      porTipo[m.tipo].push(`• [${m.importancia}/10] ${m.titulo}: ${m.contenido}`);
    }

    const bloques = Object.entries(porTipo).map(([tipo, items]) =>
      `${tipo.toUpperCase()}:\n${items.join('\n')}`
    );

    return bloques.join('\n\n');
  },
};

export default JarvisMemoryDB;
