// ════════════════════════════════════════════════════
// CONECTOR OPENAI — DALL-E 3 para creativos de imagen
// ════════════════════════════════════════════════════

import OpenAI from 'openai';
import ENV from '../config/env.js';

let _client = null;
const getClient = () => {
  if (!_client) _client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
  return _client;
};

export const OpenAIConnector = {

  // Generar imagen con DALL-E 3 y retornar URL temporal
  async generarImagen({ prompt, size = '1024x1024', quality = 'standard' }) {
    const client = getClient();
    const response = await client.images.generate({
      model:   'dall-e-3',
      prompt,
      n:       1,
      size,
      quality,
    });
    return response.data[0].url;
  },
};

export default OpenAIConnector;
