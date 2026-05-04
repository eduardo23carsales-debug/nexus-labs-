// ════════════════════════════════════════════════════
// LEARNINGS DB — El negocio que nunca comete el mismo error dos veces
// Jarvis escribe aquí después de cada decisión + resultado
// y consulta antes de tomar nuevas decisiones
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

export const LearningsDB = {

  // Guardar un aprendizaje después de cualquier acción con resultado
  async guardar({ tipo, contexto, accion, resultado, exito = true, hipotesis = null, tags = [], relevancia = 5 }) {
    try {
      await query(
        `INSERT INTO learnings (tipo, contexto, accion, resultado, exito, hipotesis, tags, relevancia)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tipo, contexto, accion, resultado, exito, hipotesis, JSON.stringify(tags), relevancia]
      );
    } catch (err) {
      console.warn('[LearningsDB] Error guardando aprendizaje:', err.message);
    }
  },

  // Consultar aprendizajes relevantes antes de tomar una decisión
  // Busca por tipo y tags similares, ordenados por relevancia y recencia
  async consultar({ tipo = null, tags = [], limite = 10, soloExitos = false } = {}) {
    try {
      let conditions = [];
      let params = [];
      let idx = 1;

      if (tipo) {
        conditions.push(`tipo = $${idx++}`);
        params.push(tipo);
      }
      if (soloExitos) {
        conditions.push(`exito = true`);
      }
      if (tags.length > 0) {
        conditions.push(`tags ?| $${idx++}`);
        params.push(tags);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limite);

      const { rows } = await query(
        `SELECT * FROM learnings ${where}
         ORDER BY relevancia DESC, creado_en DESC
         LIMIT $${idx}`,
        params
      );
      return rows;
    } catch (err) {
      console.warn('[LearningsDB] Error consultando:', err.message);
      return [];
    }
  },

  // Consulta inteligente antes de una decisión — busca por tipo y contexto similar
  async consultarAntesDeDecision(tipo, contextoActual, limite = 5) {
    try {
      const { rows } = await query(
        `SELECT tipo, contexto, accion, resultado, exito, hipotesis, tags, relevancia, creado_en
         FROM learnings
         WHERE tipo = $1
         ORDER BY relevancia DESC, creado_en DESC
         LIMIT $2`,
        [tipo, limite * 3]  // traemos más para filtrar los más relevantes
      );

      // Filtrar los que tienen contexto más similar (keywords en común)
      const palabrasActual = contextoActual.toLowerCase().split(/\s+/);
      const scored = rows.map(r => {
        const palabrasContexto = (r.contexto + ' ' + (r.hipotesis || '')).toLowerCase();
        const matches = palabrasActual.filter(p => p.length > 4 && palabrasContexto.includes(p)).length;
        return { ...r, _score: matches + r.relevancia };
      });

      return scored
        .sort((a, b) => b._score - a._score)
        .slice(0, limite)
        .map(({ _score, ...r }) => r);
    } catch (err) {
      console.warn('[LearningsDB] Error en consultarAntesDeDecision:', err.message);
      return [];
    }
  },

  // Resumen de aprendizajes para mostrar a Eduardo
  async resumen(dias = 30) {
    try {
      const { rows } = await query(
        `SELECT
           tipo,
           COUNT(*)                                        AS total,
           COUNT(*) FILTER (WHERE exito = true)           AS exitosos,
           COUNT(*) FILTER (WHERE exito = false)          AS fallidos,
           ROUND(AVG(relevancia), 1)                      AS relevancia_promedio
         FROM learnings
         WHERE creado_en > NOW() - INTERVAL '${dias} days'
         GROUP BY tipo
         ORDER BY total DESC`,
        []
      );
      return rows;
    } catch (err) {
      console.warn('[LearningsDB] Error en resumen:', err.message);
      return [];
    }
  },

  // Últimos N aprendizajes de cualquier tipo
  async ultimos(limite = 20) {
    try {
      const { rows } = await query(
        `SELECT * FROM learnings ORDER BY creado_en DESC LIMIT $1`,
        [limite]
      );
      return rows;
    } catch (err) {
      console.warn('[LearningsDB] Error en ultimos:', err.message);
      return [];
    }
  },

  // Formatear aprendizajes como contexto para Claude (antes de una decisión)
  formatearParaPrompt(learnings) {
    if (!learnings.length) return '';
    const lines = learnings.map(l =>
      `- [${l.exito ? '✅' : '❌'} ${l.tipo}] ${l.accion} → ${l.resultado}${l.hipotesis ? ` (${l.hipotesis})` : ''}`
    );
    return `\nAprendizajes previos relevantes:\n${lines.join('\n')}\n`;
  },
};

export default LearningsDB;
