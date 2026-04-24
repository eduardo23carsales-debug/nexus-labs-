// ════════════════════════════════════════════════════
// LEAD SCORING — Califica leads por sus respuestas
// Retorna CALIENTE / TIBIO / FRIO + puntos
// ════════════════════════════════════════════════════

import BUSINESS from '../config/business.config.js';

const PUNTAJES = {
  segmento: {
    'urgente':         30,
    'mal-credito':     20,
    'sin-credito':     20,
    'upgrade':         15,
    'oferta-especial': 10,
  },
  ingresos: {
    'mas_de_2500': 25,
    '1500_a_2500': 15,
    'menos_de_1500': 5,
    'otro': 5,
  },
  tiempo: {
    'inmediato':  25,
    'esta_semana': 20,
    'este_mes':    10,
    'explorando':   5,
  },
};

export function scoreLead(lead) {
  let puntos = 0;

  puntos += PUNTAJES.segmento[lead.segmento] || 0;
  puntos += PUNTAJES.ingresos[lead.ingresos] || 0;
  puntos += PUNTAJES.tiempo[lead.tiempo]     || 0;

  const { CALIENTE, TIBIO } = BUSINESS.scoring;
  const nivel = puntos >= CALIENTE ? 'CALIENTE' : puntos >= TIBIO ? 'TIBIO' : 'FRIO';

  return { puntos, nivel };
}

export default scoreLead;
