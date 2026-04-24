// ════════════════════════════════════════════════════
// SANDBOX — Entorno de experimentación
//
// REGLA CRÍTICA: Este módulo NUNCA llama a producción.
//   - No llama a la API de Meta con datos reales
//   - No llama a VAPI con teléfonos reales
//   - No envía notificaciones al chat de producción
//   - Usa cuentas y canales de test separados
//
// CÓMO USAR:
//   node sandbox/index.js [experimento]
//   Ejemplo: node sandbox/index.js test-sofia
//
// ════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

const experimento = process.argv[2] || 'help';

const experimentos = {

  // Simula una llamada de Sofía sin hacer la llamada real
  'test-sofia': async () => {
    const { SOFIA_CONFIG } = await import('../call_agent/sofia.config.js');
    console.log('[Sandbox] Config de Sofía cargada correctamente:');
    console.log('  Voz:', SOFIA_CONFIG.voice?.provider, '/', SOFIA_CONFIG.voice?.model);
    console.log('  Modelo IA:', SOFIA_CONFIG.model?.model);
    console.log('  First message mode:', SOFIA_CONFIG.firstMessageMode);
    console.log('  Max duración:', SOFIA_CONFIG.maxDurationSeconds, 'seg');
    console.log('[Sandbox] Para hacer una llamada real usa /testvoz en Telegram');
  },

  // Simula el scoring de un lead
  'test-scoring': async () => {
    const { scoreLead } = await import('../lead_system/scoring.js');
    const casos = [
      { segmento: 'urgente',   ingresos: 'mas_de_2500', tiempo: 'inmediato' },
      { segmento: 'mal-credito', ingresos: '1500_a_2500', tiempo: 'esta_semana' },
      { segmento: 'oferta-especial', ingresos: 'menos_de_1500', tiempo: 'explorando' },
    ];
    casos.forEach(c => {
      const { puntos, nivel } = scoreLead(c);
      console.log(`[Sandbox] ${c.segmento} + ${c.ingresos} + ${c.tiempo} → ${nivel} (${puntos} pts)`);
    });
  },

  // Muestra la estructura del plan vacío
  'test-plan': async () => {
    const { PlansDB } = await import('../memory/plans.db.js');
    const plan = await PlansDB.cargar();
    console.log('[Sandbox] Plan actual:', plan ? JSON.stringify(plan, null, 2) : 'Sin plan vigente');
  },

  // Muestra resumen de leads en memoria
  'test-leads': async () => {
    const { LeadsDB } = await import('../memory/leads.db.js');
    const resumen = await LeadsDB.resumenConversiones();
    console.log('[Sandbox] Resumen de leads:', JSON.stringify(resumen, null, 2));
  },

  'help': () => {
    console.log('[Sandbox] Experimentos disponibles:');
    console.log('  test-sofia    → Verificar config de Sofía');
    console.log('  test-scoring  → Probar lógica de scoring de leads');
    console.log('  test-plan     → Ver plan vigente en memoria');
    console.log('  test-leads    → Ver resumen de leads y conversiones');
    console.log('');
    console.log('Uso: node sandbox/index.js <experimento>');
  },
};

const fn = experimentos[experimento];
if (fn) {
  Promise.resolve(fn()).catch(err => console.error('[Sandbox] Error:', err.message));
} else {
  console.error(`[Sandbox] Experimento "${experimento}" no existe. Usa "help" para ver opciones.`);
}
