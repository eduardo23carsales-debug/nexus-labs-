// ════════════════════════════════════════════════════
// CONECTOR ANTHROPIC — Wrapper para Claude
// ════════════════════════════════════════════════════

import ENV from '../config/env.js';

export const AnthropicConnector = {

  // Llamada genérica a Claude
  async completar({ system, prompt, model = 'claude-sonnet-4-6', maxTokens = 1200 }) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system && { system }),
      messages: [{ role: 'user', content: prompt }],
    });

    return msg.content[0].text.trim();
  },

  // Completar y parsear JSON (limpia bloques ```json```)
  async completarJSON(opciones) {
    const raw = await this.completar(opciones);
    const limpio = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(limpio);
  },

  // Generación larga con continuación automática si Claude se corta
  // Equivalente a preguntarCompleto del sistema original
  async completarConContinuacion({ system, prompt, model = 'claude-sonnet-4-6', maxTokens = 6000, maxIter = 8 }) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY, timeout: 300_000 });

    const messages = [{ role: 'user', content: prompt }];
    let textoTotal = '';

    for (let iter = 0; iter < maxIter; iter++) {
      let response;
      for (let intento = 0; intento < 3; intento++) {
        try {
          response = await client.messages.create({
            model, max_tokens: maxTokens,
            ...(system && { system }), messages,
          });
          break;
        } catch (err) {
          const esRateLimit = err.status === 429 || String(err.message).includes('rate_limit') || String(err.message).includes('overloaded');
          if (esRateLimit && intento < 2) {
            await new Promise(r => setTimeout(r, 8000 * (intento + 1)));
          } else throw err;
        }
      }

      const fragmento = response.content[0]?.text || '';
      textoTotal += fragmento;

      if (response.stop_reason === 'end_turn') break;

      if (response.stop_reason === 'max_tokens') {
        console.log(`[Anthropic] Respuesta cortada (iter ${iter + 1}) — continuando...`);
        messages.push({ role: 'assistant', content: fragmento });
        messages.push({ role: 'user', content: 'Continúa exactamente desde donde te cortaste. NO repitas nada. Solo continúa el contenido HTML.' });
      } else {
        break;
      }
    }

    return textoTotal;
  },

  // completarJSON con reintentos (extrae JSON aunque Claude añada texto)
  async completarJSONConReintentos(opciones, intentos = 2) {
    for (let i = 0; i < intentos; i++) {
      const raw = await this.completar({ ...opciones, system: (opciones.system || '') + '\n\nResponde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.' });
      const limpio = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        return JSON.parse(limpio);
      } catch {
        const match = limpio.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (match) { try { return JSON.parse(match[0]); } catch {} }
        if (i === intentos - 1) throw new Error(`JSON inválido tras ${intentos} intentos: ${raw.slice(0, 200)}`);
      }
    }
  },

  // Análisis de campañas → retorna plan estructurado
  async analizarCampanas({ datos, resumenConversiones, presupuestoMax }) {
    return this.completarJSON({
      model:     'claude-sonnet-4-6',
      maxTokens: 1200,
      system: `Eres el analista senior de campañas de Meta Ads para Nexus Labs, una startup de marketing automatizado en Miami que escala productos digitales en Meta Ads y Hotmart.

Tu trabajo es analizar métricas reales y tomar decisiones de negocio concretas — no solo optimizar CPL, sino maximizar ventas cerradas.

Criterios de decisión:
- CPL < $5 con leads = escalar (máximo 20% de aumento)
- Gasto sin leads = pausar
- Segmentos con mejor tasa de cierre histórica = priorizar
- No crear campañas duplicadas del mismo segmento

Responde SOLO con JSON válido, sin texto adicional.`,
      prompt: `Métricas de los últimos 7 días:
${JSON.stringify(datos, null, 2)}

Resumen de conversión real (leads → ventas):
${JSON.stringify(resumenConversiones, null, 2)}

Presupuesto máximo disponible por día: $${presupuestoMax}

Genera un plan con esta estructura exacta:
{
  "pausar":  [{"id":"...","nombre":"...","razon":"..."}],
  "escalar": [{"id":"...","nombre":"...","presupuesto_actual":0,"presupuesto_nuevo":0,"razon":"..."}],
  "crear":   [{"segmento":"...","presupuesto":0,"razon":"..."}],
  "resumen_telegram": "resumen corto en español para Eduardo (máx 3 líneas)",
  "resumen_voz":      "frase natural para leer en voz alta, máx 2 oraciones"
}`,
    });
  },
};

export default AnthropicConnector;
