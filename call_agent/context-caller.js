// ════════════════════════════════════════════════════
// CONTEXT CALLER — Llamadas con contexto específico
// ════════════════════════════════════════════════════

import { VapiConnector }          from '../connectors/vapi.connector.js';
import { TelegramConnector, esc } from '../connectors/telegram.connector.js';
import { ClientDB, ESTADOS_CRM }  from '../crm/client.db.js';
import { FollowUpDB }             from '../crm/follow-up.db.js';
import { SOFIA_CONFIG }           from './sofia.config.js';
import ENV                        from '../config/env.js';

function generarPromptContextual(cliente, objetivo, contextoExtra = '') {
  const datos = cliente.datos_producto || {};

  const infocliente = [
    `Nombre: ${cliente.nombre}`,
    cliente.email              ? `Email: ${cliente.email}` : null,
    datos.tipo_auto            ? `Vehículo actual: ${datos.tipo_auto}` : null,
    datos.pago_actual          ? `Pago mensual actual: $${datos.pago_actual}` : null,
    datos.pago_nuevo           ? `Nuevo pago posible: $${datos.pago_nuevo} (VENTAJA CLAVE)` : null,
    datos.fecha_vencimiento    ? `Vencimiento del contrato: ${datos.fecha_vencimiento}` : null,
    datos.credito              ? `Situación crediticia: ${datos.credito}` : null,
    datos.anios_cliente        ? `Cliente hace ${datos.anios_cliente} años` : null,
    cliente.notas              ? `Notas previas: ${cliente.notas}` : null,
    contextoExtra              ? `Contexto adicional: ${contextoExtra}` : null,
  ].filter(Boolean).join('\n');

  const historial = (cliente.historial || []).slice(0, 3);
  const historialTexto = historial.length
    ? '\n\nINTERACCIONES ANTERIORES:\n' + historial.map(h =>
        `- ${new Date(h.fecha).toLocaleDateString('es-US')}: ${h.tipo} — ${h.resultado || h.notas}`
      ).join('\n')
    : '';

  return `Eres Sofía, coordinadora de citas. Eres experta en BDC automotriz.

DATOS DEL CLIENTE AL QUE LLAMAS:
${infocliente}${historialTexto}

OBJETIVO DE ESTA LLAMADA:
${objetivo}

INSTRUCCIONES ESPECÍFICAS PARA ESTA LLAMADA:
1. Usa TODA la información anterior para personalizar cada frase — no suenes genérica
2. Si tienes una ventaja concreta (como un pago más bajo), úsala como argumento central
3. Si el cliente ya tuvo interacciones previas, referencíalas naturalmente
4. El objetivo es AGENDAR UNA CITA — eso es éxito en esta llamada
5. Si no contesta: NO dejes mensaje de voz, simplemente termina la llamada

APERTURA PERSONALIZADA:
"¡Hola, habló con ${cliente.nombre}? Hola ${cliente.nombre.split(' ')[0]}, soy Sofía. Te llamo porque [razón específica basada en los datos arriba]..."

MANEJO DE OBJECIONES — usa los datos reales:
- Si menciona el pago actual → "Entiendo, y por eso te llamamos — podemos reducirte el pago de $${datos.pago_actual || '...'} a $${datos.pago_nuevo || 'menos'}."
- Si dice que no tiene tiempo → propón hora específica basándote en el contexto

REGLAS DE VOZ:
- Español siempre aunque el cliente hable inglés
- Números en palabras
- Máximo 2 oraciones por turno`;
}

// ── Llamar a un cliente CRM con contexto completo ────
export async function llamarConContexto({ telefono, nombre, objetivo, contextoExtra, nicho, datos_producto }) {
  if (!ENV.VAPI_API_KEY || !ENV.VAPI_PHONE_ID) {
    console.warn('[ContextCaller] VAPI no configurado');
    return { ok: false, error: 'VAPI no configurado' };
  }

  let cliente = await ClientDB.obtener(telefono);
  if (!cliente) {
    cliente = await ClientDB.guardar({
      telefono, nombre,
      nicho:          nicho || 'general',
      datos_producto: datos_producto || {},
      estado:         ESTADOS_CRM.NUEVO,
    });
  } else if (datos_producto) {
    cliente = await ClientDB.guardar({ ...cliente, datos_producto: { ...cliente.datos_producto, ...datos_producto } });
  }

  const promptPersonalizado = generarPromptContextual(cliente, objetivo, contextoExtra);

  const configDinamica = {
    ...SOFIA_CONFIG,
    model: {
      ...SOFIA_CONFIG.model,
      messages: [{ role: 'system', content: promptPersonalizado }],
    },
    firstMessage: `¡Hola! ¿Hablo con ${nombre}?`,
    serverUrl:    SOFIA_CONFIG.serverUrl,
  };

  try {
    const call = await VapiConnector.iniciarLlamada({ telefono, nombre, assistantConfig: configDinamica });

    await ClientDB.registrarInteraccion(telefono, {
      tipo:        'llamada',
      resultado:   'Iniciada',
      notas:       objetivo,
      estado_nuevo: ESTADOS_CRM.CONTACTADO,
    });

    await TelegramConnector.notificar(
      `📞 <b>Llamando a ${esc(nombre)}</b>\n` +
      `📱 ${esc(telefono)}\n` +
      `🎯 ${esc(objetivo)}\n` +
      `🤖 Sofía con contexto personalizado`
    );

    console.log(`[ContextCaller] Llamada iniciada: ${nombre} — ${call.id}`);
    return { ok: true, callId: call.id, clienteId: cliente.client_id };

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[ContextCaller] Error:`, msg);
    await TelegramConnector.notificar(`⚠️ <b>Error al llamar a ${esc(nombre)}:</b>\n<code>${esc(msg)}</code>`);
    return { ok: false, error: msg };
  }
}

// ── Procesar resultado y actualizar CRM ──────────────
export async function procesarResultadoCRM(callData) {
  const telefono     = callData.customer?.number || '';
  const nombre       = callData.customer?.name   || '';
  const estructurado = callData.analysis?.structuredData || {};
  const citaAgendada = estructurado.citaAgendada === true;
  const diaCita      = estructurado.diaCita  || '';
  const horaCita     = estructurado.horaCita || '';
  const endedReason  = callData.endedReason || callData.status;

  if (!telefono) return;

  let estadoNuevo = ESTADOS_CRM.CONTACTADO;
  let resultado   = 'Sin resultado claro';

  if (citaAgendada) {
    estadoNuevo = ESTADOS_CRM.CITA_AGENDADA;
    resultado   = `Cita agendada: ${diaCita} a las ${horaCita}`;
  } else if (endedReason === 'no-answer' || endedReason === 'busy') {
    estadoNuevo = ESTADOS_CRM.NO_CONTESTO;
    resultado   = 'No contestó';
    const cliente = await ClientDB.obtener(telefono);
    await FollowUpDB.programar({
      telefono, nombre,
      nicho:  cliente?.nicho || 'general',
      motivo: 'No contestó — llamada automática de seguimiento',
      fecha:  new Date(Date.now() + 24 * 3600 * 1000),
      accion: 'llamar',
    });
  } else if (endedReason === 'customer-ended-call' || endedReason === 'assistant-ended-call') {
    resultado = callData.summary || 'Llamada completada';
  }

  await ClientDB.registrarInteraccion(telefono, {
    tipo:        'llamada',
    resultado,
    notas:       callData.summary || '',
    duracion:    callData.duration,
    estado_nuevo: estadoNuevo,
  });

  if (citaAgendada) {
    const clienteActual = await ClientDB.obtener(telefono);
    if (clienteActual) {
      await ClientDB.guardar({
        ...clienteActual,
        datos_producto: { ...clienteActual.datos_producto, dia_cita: diaCita, hora_cita: horaCita },
      });
    }
  }

  console.log(`[ContextCaller] CRM actualizado: ${nombre} → ${estadoNuevo}`);
}

export default { llamarConContexto, procesarResultadoCRM };
