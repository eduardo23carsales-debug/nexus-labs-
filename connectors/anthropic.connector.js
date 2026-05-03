// ════════════════════════════════════════════════════
// CONECTOR ANTHROPIC — Wrapper para Claude
// ════════════════════════════════════════════════════

import ENV from '../config/env.js';

// Elimina surrogates sueltos que hacen explotar JSON.stringify al mandarse a la API
function limpiarUnicode(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')   // high surrogate sin pair
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');  // low surrogate sin pair
}

// Singletons — evita re-importar el SDK y re-crear el cliente en cada llamada
let _client     = null;
let _clientLong = null;

async function getClient() {
  if (!_client) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    _client = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });
  }
  return _client;
}

async function getClientLong() {
  if (!_clientLong) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    _clientLong = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY, timeout: 300_000 });
  }
  return _clientLong;
}

export const AnthropicConnector = {

  // Llamada genérica a Claude
  async completar({ system, prompt, model = 'claude-sonnet-4-6', maxTokens = 1200 }) {
    const client = await getClient();
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(system && { system: limpiarUnicode(system) }),
      messages: [{ role: 'user', content: limpiarUnicode(prompt) }],
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
  async completarConContinuacion({ system, prompt, model = 'claude-sonnet-4-6', maxTokens = 6000, maxIter = 8 }) {
    const client = await getClientLong();
    const messages = [{ role: 'user', content: limpiarUnicode(prompt) }];
    system = limpiarUnicode(system);
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
  async completarJSONConReintentos(opciones, intentos = 3) {
    for (let i = 0; i < intentos; i++) {
      const raw = await this.completar({
        ...opciones,
        system: (opciones.system || '') + '\n\nResponde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.',
      });
      const limpio = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      try {
        return JSON.parse(limpio);
      } catch {
        const match = limpio.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (match) { try { return JSON.parse(match[0]); } catch {} }
        if (i < intentos - 1) {
          console.warn(`[Anthropic] JSON inválido intento ${i + 1}/${intentos} — reintentando...`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw new Error(`JSON inválido tras ${intentos} intentos: ${raw.slice(0, 200)}`);
        }
      }
    }
  },

  // Analizar imagen con Claude Vision — imageBase64: Buffer o string base64, retorna { score: 1-10, feedback: string }
  async analizarImagen(imageBase64, contexto) {
    const client   = await getClient();
    const buf      = Buffer.isBuffer(imageBase64) ? imageBase64 : Buffer.from(imageBase64, 'base64');
    const b64      = buf.toString('base64');
    const mimeType = (buf[0] === 0x89 && buf[1] === 0x50) ? 'image/png' : 'image/jpeg';
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
          {
            type: 'text',
            text: `Evalúa esta imagen para un anuncio de Meta Ads.
Contexto: ${contexto}

Criterios (10 puntos):
- Relevancia al tema del producto (4 pts)
- Calidad visual / realismo — NO debe parecer IA (3 pts)
- Atractivo publicitario para hispanos en USA (3 pts)

Responde SOLO con JSON: {"score": <1-10>, "feedback": "<qué mejorar si score < 8, o 'ok' si es buena>"}`,
          },
        ],
      }],
    });
    const raw    = msg.content[0].text.trim();
    const limpio = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(limpio); } catch {
      const match = limpio.match(/\{[\s\S]*\}/);
      if (match) { try { return JSON.parse(match[0]); } catch {} }
      return { score: 5, feedback: 'No se pudo evaluar' };
    }
  },

  // Análisis de campañas → retorna plan estructurado
  // maxTokens=2500 para soportar análisis de 5+ campañas sin truncar
  async analizarCampanas({ datos, resumenConversiones, presupuestoMax, planAnterior = null }) {
    const contextoHistorico = planAnterior
      ? `\nPlan ejecutado ayer:\n${JSON.stringify(planAnterior, null, 2)}\n`
      : '';

    return this.completarJSON({
      model:     'claude-sonnet-4-6',
      maxTokens: 2500,
      system: `Eres el analista senior de campañas de Meta Ads para Nexus Labs, una startup de marketing automatizado en Miami que escala productos digitales en Meta Ads y Hotmart.

Tu trabajo es analizar métricas reales y tomar decisiones de negocio concretas — no solo optimizar CPL, sino maximizar ventas cerradas.

Criterios de decisión:
- CPL < $5 con leads = escalar (máximo 20% de aumento)
- Gasto sin leads = pausar
- Segmentos con mejor tasa de cierre histórica = priorizar
- No crear campañas duplicadas del mismo segmento
- Si ayer se pausó una campaña que hoy tiene leads → no recrear sin analizar causa

Responde SOLO con JSON válido, sin texto adicional.`,
      prompt: `Métricas de los últimos 7 días:
${JSON.stringify(datos, null, 2)}

Resumen de conversión real (leads → ventas por segmento):
${JSON.stringify(resumenConversiones, null, 2)}
${contextoHistorico}
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
