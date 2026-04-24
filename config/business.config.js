// ════════════════════════════════════════════════════
// BUSINESS CONFIG — Reglas de negocio del sistema
// Cambiar aquí afecta toda la lógica de decisiones
// ════════════════════════════════════════════════════

import ENV from './env.js';

export const BUSINESS = {
  // ── Límites financieros ─────────────────────────
  presupuestoMaxDia:     ENV.PRESUPUESTO_MAX_DIA,   // $30/día máx en Meta
  limiteEscalarSolo:     ENV.LIMITE_ESCALAR_SOLO,   // Escala sin pedir permiso hasta $10
  limiteGastoSinLead:    ENV.LIMITE_GASTO_SIN_LEAD, // Pausa si gasta $4 sin leads
  maxEscalarPct:         0.20,                       // Máx 20% de aumento por ciclo

  // ── Scoring de leads ────────────────────────────
  scoring: {
    CALIENTE: 70,  // >= 70 puntos → CALIENTE
    TIBIO:    40,  // >= 40 puntos → TIBIO
    // < 40 → FRIO
  },

  // ── Horarios de llamadas (ET) ───────────────────
  llamadas: {
    horaInicio: 9,   // 9 AM
    horaFin:    20,  // 8 PM
    timezone:   'America/New_York',
    delayMinutos: ENV.VAPI_DELAY_MINUTOS,
  },

  // ── Umbrales de campaña ─────────────────────────
  campana: {
    cplObjetivo:  5.0,   // CPL < $5 = buena campaña
    minimoLeads:  1,     // Mínimo de leads para no pausar
    diasAnalisis: 7,     // Ventana de análisis de métricas
  },

  // ── Asesores / Equipo ────────────────────────────
  asesores: [
    { nombre: 'Eduardo', whatsapp: ENV.WHATSAPP_EDUARDO },
  ],

  // ── Negocio ──────────────────────────────────────
  producto: {
    nombre:   'Nexus Labs',
    nicho:    'Productos digitales — Meta Ads y Hotmart',
    ciudad:   'Miami, Florida',
    ceo:      'Eduardo Ferrer',
  },
};

export default BUSINESS;
