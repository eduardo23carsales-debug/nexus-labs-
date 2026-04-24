// ════════════════════════════════════════════════════
// CONECTOR VAPI — Wrapper para llamadas telefónicas con IA
// ════════════════════════════════════════════════════

import axios from 'axios';
import ENV from '../config/env.js';

const VAPI_BASE = 'https://api.vapi.ai';

const headers = () => ({
  Authorization:  `Bearer ${ENV.VAPI_API_KEY}`,
  'Content-Type': 'application/json',
});

export const VapiConnector = {

  // Iniciar una llamada con config inline (sin assistantId)
  async iniciarLlamada({ telefono, nombre, assistantConfig }) {
    let tel = telefono.replace(/\D/g, '');
    if (tel.length === 10) tel = `1${tel}`;
    if (!tel.startsWith('+')) tel = `+${tel}`;

    if (tel.length < 12) throw new Error(`Teléfono inválido: ${telefono}`);

    const { data } = await axios.post(
      `${VAPI_BASE}/call`,
      {
        phoneNumberId: ENV.VAPI_PHONE_ID,
        assistant:     assistantConfig,
        customer:      { number: tel, name: nombre },
      },
      { headers: headers(), timeout: 15000 }
    );
    return data;
  },

  // Obtener detalles de una llamada
  async getLlamada(callId) {
    const { data } = await axios.get(`${VAPI_BASE}/call/${callId}`, {
      headers: headers(),
    });
    return data;
  },

  // Parsear payload de webhook de VAPI
  parsearWebhook(body) {
    const { message } = body;
    if (!message) return null;

    const tipo = message.type;

    if (tipo === 'end-of-call-report') {
      const { call, analysis, summary } = message;
      return {
        tipo:           'resultado',
        callId:         call?.id,
        status:         call?.status,
        endedReason:    call?.endedReason,
        duration:       call?.duration,
        customer:       call?.customer,
        analysis:       analysis,
        summary:        summary,
        structuredData: analysis?.structuredData,
      };
    }

    if (tipo === 'status-update') {
      return { tipo: 'status', status: message.status, callId: message.call?.id };
    }

    return { tipo, raw: message };
  },
};

export default VapiConnector;
