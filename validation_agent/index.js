// ════════════════════════════════════════════════════
// VALIDATION AGENT — Testea ideas antes de escalar
//
// PROPÓSITO:
//   Lanzar micro-experimentos controlados (bajo presupuesto,
//   tiempo limitado) para validar nuevas hipótesis antes
//   de comprometer presupuesto real.
//
// FLUJO ESPERADO:
//   1. Recibe idea (nuevo segmento, copy, oferta)
//   2. Crea campaña mínima (sandbox) con $5-10/día
//   3. Corre por 72h y mide CPL vs benchmark
//   4. Reporta: validado / rechazado / necesita más data
//   5. Si validado → pasa al scaling_agent
//
// CRITERIOS DE VALIDACIÓN:
//   - CPL < benchmark del nicho ($5 para carros)
//   - Al menos 3 leads en 72h
//   - CTR > 1%
//
// ESTADO: PENDIENTE DE IMPLEMENTACIÓN
// ════════════════════════════════════════════════════

export async function validarIdea(idea = {}) {
  // idea: { tipo, descripcion, segmento, presupuestoPrueba }
  // TODO: Implementar validación controlada de ideas
  throw new Error('ValidationAgent: aún no implementado');
}

export async function verificarResultado(experimentId) {
  // TODO: Leer resultados del experimento y retornar veredicto
  throw new Error('ValidationAgent: aún no implementado');
}

export default { validarIdea, verificarResultado };
