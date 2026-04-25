// ════════════════════════════════════════════════════
// PROJECTS DB — Portafolio de proyectos de Nexus Labs
//
// Cada proyecto es una iniciativa de negocio con:
//   - Máquina de estados: idea → validando → testing → rentable → escalando
//   - ROI calculado automáticamente
//   - Detector de riesgos automático
//   - Historial de acciones por agente
//   - Vínculos a campañas y experimentos
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';

// ── Máquina de estados ────────────────────────────────
// Define qué transiciones son válidas desde cada estado
const TRANSICIONES = {
  idea:      ['validando', 'testing', 'muerto'],
  validando: ['testing', 'pausado', 'muerto'],
  testing:   ['rentable', 'escalando', 'pausado', 'muerto'],
  rentable:  ['escalando', 'pausado', 'muerto'],
  escalando: ['rentable', 'pausado', 'muerto'],
  pausado:   ['idea', 'validando', 'testing', 'rentable', 'escalando', 'muerto'],
  muerto:    [], // estado terminal
};

const EMOJI_ESTADO = {
  idea:      '💡',
  validando: '🔍',
  testing:   '🧪',
  rentable:  '✅',
  escalando: '🚀',
  pausado:   '⏸️',
  muerto:    '💀',
};

// ── CRUD principal ────────────────────────────────────
export const ProjectsDB = {

  async crear({ nombre, nicho = 'general', tipo = 'digital', descripcion = '', objetivo = '' }) {
    if (!process.env.DATABASE_URL) return { id: null, nombre };
    const historial = [{
      fecha:   new Date().toISOString(),
      agente:  'sistema',
      accion:  'creado',
      detalle: `Proyecto "${nombre}" creado en el portafolio`,
    }];
    const { rows } = await query(
      `INSERT INTO projects (nombre, nicho, tipo, descripcion, objetivo, historial)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, nicho, tipo, descripcion, objetivo, JSON.stringify(historial)]
    ).catch(() => ({ rows: [{}] }));
    return rows[0];
  },

  async obtener(id) {
    if (!process.env.DATABASE_URL) return null;
    const { rows } = await query(
      'SELECT * FROM projects WHERE id = $1', [id]
    ).catch(() => ({ rows: [] }));
    return rows[0] || null;
  },

  async buscar(termino) {
    if (!process.env.DATABASE_URL) return [];
    const esId = /^\d+$/.test(String(termino).trim());
    if (esId) {
      const p = await this.obtener(parseInt(termino));
      return p ? [p] : [];
    }
    const { rows } = await query(
      `SELECT * FROM projects
       WHERE nombre ILIKE $1 OR nicho ILIKE $1
       ORDER BY actualizado_en DESC LIMIT 5`,
      [`%${termino}%`]
    ).catch(() => ({ rows: [] }));
    return rows;
  },

  async listar({ estado = null, tipo = null } = {}) {
    if (!process.env.DATABASE_URL) return [];
    let sql = 'SELECT * FROM projects WHERE 1=1';
    const params = [];
    if (estado) { params.push(estado); sql += ` AND estado = $${params.length}`; }
    if (tipo)   { params.push(tipo);   sql += ` AND tipo   = $${params.length}`; }
    sql += ' ORDER BY actualizado_en DESC';
    const { rows } = await query(sql, params).catch(() => ({ rows: [] }));
    return rows;
  },

  // ── Máquina de estados ────────────────────────────
  async actualizarEstado(id, estadoNuevo, agente = 'jarvis', nota = '') {
    const proyecto = await this.obtener(id);
    if (!proyecto) throw new Error(`Proyecto ${id} no encontrado`);
    if (proyecto.estado === estadoNuevo) return; // idempotente

    const validas = TRANSICIONES[proyecto.estado] || [];
    if (!validas.includes(estadoNuevo)) {
      throw new Error(
        `Transición inválida: ${proyecto.estado} → ${estadoNuevo}. ` +
        `Desde aquí puedes ir a: ${validas.join(', ') || 'ninguno (estado terminal)'}`
      );
    }

    const historial = [
      ...(proyecto.historial || []),
      {
        fecha:   new Date().toISOString(),
        agente,
        accion:  'cambio_estado',
        detalle: `${proyecto.estado} → ${estadoNuevo}${nota ? `: ${nota}` : ''}`,
      },
    ];
    await query(
      'UPDATE projects SET estado = $1, historial = $2, actualizado_en = NOW() WHERE id = $3',
      [estadoNuevo, JSON.stringify(historial), id]
    );
  },

  // ── Métricas con ROI automático y detección de riesgos ──
  async actualizarMetricas(id, {
    inversion = 0, revenue = 0, leads = 0, ventas = 0, llamadas = 0,
  } = {}, agente = 'sistema') {
    const proyecto = await this.obtener(id);
    if (!proyecto) return;

    const nuevaInversion = parseFloat(proyecto.inversion || 0) + inversion;
    const nuevoRevenue   = parseFloat(proyecto.revenue   || 0) + revenue;
    const roi = nuevaInversion > 0
      ? +((nuevoRevenue - nuevaInversion) / nuevaInversion * 100).toFixed(1)
      : null;

    const alertas = this._detectarRiesgos({
      ...proyecto,
      inversion: nuevaInversion,
      revenue:   nuevoRevenue,
      leads:     (proyecto.leads    || 0) + leads,
      ventas:    (proyecto.ventas   || 0) + ventas,
    });

    const cambios = [
      inversion ? `+$${inversion} invertido` : '',
      revenue   ? `+$${revenue} revenue`     : '',
      leads     ? `+${leads} leads`          : '',
      ventas    ? `+${ventas} venta(s)`      : '',
    ].filter(Boolean).join(', ');

    const historial = cambios
      ? [...(proyecto.historial || []),
          { fecha: new Date().toISOString(), agente, accion: 'metricas', detalle: cambios }]
      : (proyecto.historial || []);

    await query(`
      UPDATE projects
      SET inversion = $1, revenue = $2, roi = $3,
          leads     = leads    + $4,
          ventas    = ventas   + $5,
          llamadas  = llamadas + $6,
          alertas   = $7, historial = $8, actualizado_en = NOW()
      WHERE id = $9
    `, [nuevaInversion, nuevoRevenue, roi, leads, ventas, llamadas,
        JSON.stringify(alertas), JSON.stringify(historial), id]);

    // Auto-promoción: testing → rentable cuando llega revenue positivo
    if (proyecto.estado === 'testing' && revenue > 0 && roi !== null && roi >= 0) {
      await this.actualizarEstado(id, 'rentable', agente, `ROI ${roi}%`).catch(() => {});
    }
  },

  // ── Registro de acciones de agentes ──────────────
  async registrarAccionAgente(id, agente, accion, detalle = '') {
    if (!process.env.DATABASE_URL || !id) return;
    const proyecto = await this.obtener(id);
    if (!proyecto) return;
    const historial = [
      ...(proyecto.historial || []),
      { fecha: new Date().toISOString(), agente, accion, detalle },
    ];
    await query(
      'UPDATE projects SET historial = $1, actualizado_en = NOW() WHERE id = $2',
      [JSON.stringify(historial), id]
    ).catch(() => {});
  },

  // ── Vínculos a otros módulos ──────────────────────
  async linkearExperimento(projectId, experimentId) {
    if (!process.env.DATABASE_URL || !projectId) return;
    await query(
      'UPDATE projects SET experiment_id = $1, actualizado_en = NOW() WHERE id = $2',
      [experimentId, projectId]
    ).catch(() => {});
  },

  async linkearCampana(projectId, campaignId) {
    if (!process.env.DATABASE_URL || !projectId) return;
    const proyecto = await this.obtener(projectId);
    if (!proyecto) return;
    const ids = Array.isArray(proyecto.campaign_ids) ? proyecto.campaign_ids : [];
    if (!ids.includes(campaignId)) {
      await query(
        'UPDATE projects SET campaign_ids = $1, actualizado_en = NOW() WHERE id = $2',
        [JSON.stringify([...ids, campaignId]), projectId]
      ).catch(() => {});
    }
  },

  async actualizarNotas(id, notas) {
    if (!process.env.DATABASE_URL) return;
    await query(
      'UPDATE projects SET notas = $1, actualizado_en = NOW() WHERE id = $2',
      [notas, id]
    ).catch(() => {});
  },

  // ── Detector de riesgos ───────────────────────────
  _detectarRiesgos(p) {
    const alertas = [];
    const edad_h  = (Date.now() - new Date(p.creado_en || Date.now())) / 3600000;

    if (parseFloat(p.inversion) > 100 && parseFloat(p.revenue) === 0 && edad_h > 72) {
      alertas.push({
        tipo:    'gasto_sin_retorno',
        mensaje: `$${parseFloat(p.inversion).toFixed(0)} gastados sin revenue`,
        fecha:   new Date().toISOString(),
      });
    }
    if ((p.leads || 0) > 15 && (p.ventas || 0) === 0) {
      alertas.push({
        tipo:    'conversion_baja',
        mensaje: `${p.leads} leads sin ventas`,
        fecha:   new Date().toISOString(),
      });
    }
    if (p.estado === 'testing' && edad_h > 168) {
      alertas.push({
        tipo:    'testing_prolongado',
        mensaje: `Testing por ${Math.floor(edad_h / 24)} días`,
        fecha:   new Date().toISOString(),
      });
    }
    if (p.roi !== null && p.roi !== undefined && parseFloat(p.roi) < -50) {
      alertas.push({
        tipo:    'roi_negativo',
        mensaje: `ROI: ${p.roi}%`,
        fecha:   new Date().toISOString(),
      });
    }
    return alertas;
  },

  // ── Formateo para Telegram ────────────────────────
  formatear(proyecto) {
    const e    = EMOJI_ESTADO[proyecto.estado] || '📦';
    const roi  = proyecto.roi !== null && proyecto.roi !== undefined ? `${proyecto.roi}%` : 'N/A';
    const inv  = parseFloat(proyecto.inversion || 0).toFixed(2);
    const rev  = parseFloat(proyecto.revenue   || 0).toFixed(2);
    const alts = Array.isArray(proyecto.alertas) && proyecto.alertas.length
      ? '\n⚠️ <b>Alertas:</b>\n' + proyecto.alertas.map(a => `  • ${a.mensaje}`).join('\n')
      : '';
    const campIds = Array.isArray(proyecto.campaign_ids) ? proyecto.campaign_ids : [];
    const hist = (proyecto.historial || []).slice(-5).reverse().map(h =>
      `  ${new Date(h.fecha).toLocaleDateString('es-US')} [${h.agente}] ${h.detalle}`
    ).join('\n');

    return [
      `${e} <b>${proyecto.nombre}</b>  #${proyecto.id}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Estado: <b>${proyecto.estado.toUpperCase()}</b>  |  Nicho: ${proyecto.nicho}  |  Tipo: ${proyecto.tipo}`,
      proyecto.objetivo ? `🎯 ${proyecto.objetivo}` : '',
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `💸 Invertido: $${inv}`,
      `💰 Revenue:   $${rev}`,
      `📊 ROI: ${roi}`,
      `👥 Leads: ${proyecto.leads || 0}  |  🏆 Ventas: ${proyecto.ventas || 0}`,
      campIds.length ? `📣 ${campIds.length} campaña(s) vinculada(s)` : '',
      proyecto.experiment_id ? `🧪 Experimento #${proyecto.experiment_id}` : '',
      proyecto.notas ? `📝 ${proyecto.notas}` : '',
      alts,
      hist ? `\n📋 <b>Últimas acciones:</b>\n${hist}` : '',
    ].filter(Boolean).join('\n');
  },

  // ── Vista de portafolio ───────────────────────────
  async resumenPortafolio() {
    const todos = await this.listar();
    if (!todos.length) {
      return 'No hay proyectos en el portafolio aún.\nDile a Jarvis: "crea un proyecto para [nombre]" para empezar.';
    }

    const totalInversion = todos.reduce((s, p) => s + parseFloat(p.inversion || 0), 0);
    const totalRevenue   = todos.reduce((s, p) => s + parseFloat(p.revenue   || 0), 0);
    const roiGlobal      = totalInversion > 0
      ? +((totalRevenue - totalInversion) / totalInversion * 100).toFixed(1)
      : null;
    const conAlertas = todos.filter(p => Array.isArray(p.alertas) && p.alertas.length);

    const lineas = [
      `📂 <b>Portafolio Nexus Labs</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📦 ${todos.length} proyecto(s)`,
      `💸 Inversión total: $${totalInversion.toFixed(2)}`,
      `💰 Revenue total:   $${totalRevenue.toFixed(2)}`,
      `📈 ROI global: ${roiGlobal !== null ? `${roiGlobal}%` : 'N/A'}`,
      conAlertas.length ? `⚠️ ${conAlertas.length} proyecto(s) con alertas` : '✅ Sin alertas',
      `━━━━━━━━━━━━━━━━━━━━━━`,
      ...todos.map(p => {
        const e     = EMOJI_ESTADO[p.estado] || '📦';
        const rev   = parseFloat(p.revenue || 0).toFixed(0);
        const roi   = p.roi !== null && p.roi !== undefined ? ` ROI:${p.roi}%` : '';
        const alrt  = Array.isArray(p.alertas) && p.alertas.length ? ' ⚠️' : '';
        return `${e} <b>${p.nombre}</b> (#${p.id}) — $${rev}${roi}${alrt}`;
      }),
    ];
    return lineas.join('\n');
  },
};

export default ProjectsDB;
