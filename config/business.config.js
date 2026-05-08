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
    CALIENTE: 70,
    TIBIO:    40,
  },

  // ── Horarios de llamadas (ET) ───────────────────
  llamadas: {
    horaInicio:   9,
    horaFin:      20,
    timezone:     'America/New_York',
    delayMinutos: ENV.VAPI_DELAY_MINUTOS,
  },

  // ── Umbrales de campaña ─────────────────────────
  campana: {
    cplObjetivo:  5.0,
    minimoLeads:  1,
    diasAnalisis: 7,
  },

  // ── Reglas de riesgo automáticas ───────────────────
  riesgo: {
    cplMaxAntesPausar:    15.0,  // CPL > $15 → pausa automática
    gastoSinConversion:   8.0,   // Gasta > $8 sin conversión → pausa
    frecuenciaFatiga:     3.5,   // Frecuencia > 3.5 → refresh creativo
    ctrMinimoAlerta:      0.5,   // CTR < 0.5% → alerta
    qualityScoreMinimo:   3,     // Score global Meta < 3/15 → alerta
    roasMinimo:           1.5,   // ROAS < 1.5 → no escalar
  },

  // ── Break-even ──────────────────────────────────────
  breakeven: {
    precioProducto:  27,    // Precio promedio USD
    margenNeto:      0.70,  // 70% margen después de plataforma
    tasaConversion:  0.02,  // 2% de visitas que compran (conservador)
  },

  // ── Escalera de presupuesto (sin quemar algoritmo) ──
  escalera: {
    pasos:          [10, 20, 40, 80, 150, 300],  // USD/día
    diasValidacion: 3,    // Días mínimos antes de subir al siguiente paso
    cplTolerancia:  1.3,  // CPL puede ser 30% mayor que objetivo para subir
  },

  // ── Asesores / Equipo ────────────────────────────
  asesores: [
    { nombre: 'Eduardo', whatsapp: ENV.WHATSAPP_EDUARDO },
  ],

  // ── Negocio ──────────────────────────────────────
  producto: {
    nombre: 'Nexus Labs',
    nicho:  'Productos digitales — Meta Ads y Hotmart',
    ciudad: 'Miami, Florida',
    ceo:    'Eduardo Ferrer',
  },
};

export default BUSINESS;
