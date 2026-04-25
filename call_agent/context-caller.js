// ════════════════════════════════════════════════════
// CONTEXT CALLER — Llamadas con contexto específico
// ════════════════════════════════════════════════════

import { VapiConnector }          from '../connectors/vapi.connector.js';
import { TelegramConnector, esc } from '../connectors/telegram.connector.js';
import { ClientDB, ESTADOS_CRM }  from '../crm/client.db.js';
import { FollowUpDB }             from '../crm/follow-up.db.js';
import { SOFIA_CONFIG }           from './sofia.config.js';
import { query }                  from '../config/database.js';
import ENV                        from '../config/env.js';

const MAX_LLAMADAS_POR_NUMERO = 2;   // máximo de llamadas al mismo número
const VENTANA_HORAS           = 4;   // en este período de horas

async function llamadasRecientes(telefono) {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS total FROM calls
       WHERE telefono = $1 AND created_at > NOW() - INTERVAL '${VENTANA_HORAS} hours'`,
      [telefono]
    );
    return parseInt(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

function generarPromptContextual(cliente, objetivo, contextoExtra = '') {
  const datos = cliente.datos_producto || {};

  const infoCliente = [
    `Nombre: ${cliente.nombre}`,
    cliente.email           ? `Email: ${cliente.email}` : null,
    cliente.nicho           ? `Nicho/categoría: ${cliente.nicho}` : null,
    datos.tipo_auto         ? `Vehículo actual: ${datos.tipo_auto}` : null,
    datos.pago_actual       ? `Pago mensual actual: $${datos.pago_actual}` : null,
    datos.pago_nuevo        ? `Nuevo pago posible: $${datos.pago_nuevo} (VENTAJA CLAVE)` : null,
    datos.fecha_vencimiento ? `Vencimiento del contrato: ${datos.fecha_vencimiento}` : null,
    datos.credito           ? `Situación crediticia: ${datos.credito}` : null,
    datos.anios_cliente     ? `Cliente hace ${datos.anios_cliente} años` : null,
    cliente.notas           ? `Notas previas: ${cliente.notas}` : null,
    contextoExtra           ? `Contexto adicional: ${contextoExtra}` : null,
  ].filter(Boolean).join('\n');

  const historial = (cliente.historial || []).slice(0, 3);
  const historialTexto = historial.length
    ? '\n\nINTERACCIONES ANTERIORES:\n' + historial.map(h =>
        `- ${new Date(h.fecha).toLocaleDateString('es-US')}: ${h.tipo} — ${h.resultado || h.notas}`
      ).join('\n')
    : '';

  return `Eres Sofía, asistente de Nexus Labs. Eres experta en comunicación, ventas consultivas y persuasión natural. Tu tono es cálido, confiado y profesional — como una persona de confianza, no una vendedora agresiva.

DATOS DE LA PERSONA A LA QUE LLAMAS:
${infoCliente}${historialTexto}

OBJETIVO DE ESTA LLAMADA — ESTO ES TU ÚNICA MISIÓN:
${objetivo}

CÓMO EJECUTAR ESTE OBJETIVO:
1. Adapta TODO lo que digas al objetivo específico de arriba — nada más importa
2. Usa los datos del cliente para personalizar cada argumento
3. Si tienes una ventaja concreta (ahorro, beneficio, urgencia), úsala como argumento central
4. Si el cliente tuvo interacciones previas, referencíalas naturalmente
5. Si no contesta: NO dejes mensaje de voz, simplemente termina la llamada

MANEJO DE OBJECIONES:
- Escucha completo antes de responder, nunca interrumpas
- Valida la objeción antes de responder: "Entiendo perfectamente..."
- Usa datos concretos del cliente para superar cada objeción
- Si dice que no le interesa después de 2 intentos, cierra con gracia y termina

REGLAS DE VOZ:
- Español siempre, aunque el cliente hable inglés
- Números en palabras: "treinta", "diez de la mañana"
- Máximo 2 oraciones por turno, escucha más de lo que hablas
- Usa el nombre del cliente 2-3 veces en momentos clave`;
}

// ── Llamar a un cliente CRM con contexto completo ────
export async function llamarConContexto({ telefono, nombre, objetivo, contextoExtra, nicho, datos_producto }) {
  if (!ENV.VAPI_API_KEY || !ENV.VAPI_PHONE_ID) {
    await TelegramConnector.notificar('⚠️ <b>Llamada fallida:</b> VAPI no configurado (falta VAPI_API_KEY o VAPI_PHONE_NUMBER_ID en Railway)');
    return { ok: false, error: 'VAPI no configurado' };
  }

  // Control de frecuencia — evitar spam a un mismo número
  const recientes = await llamadasRecientes(telefono);
  if (recientes >= MAX_LLAMADAS_POR_NUMERO) {
    await TelegramConnector.notificar(
      `⚠️ <b>Llamada bloqueada a ${esc(nombre)}</b>\n` +
      `📱 ${esc(telefono)}\n` +
      `Se han realizado ${recientes} llamadas en las últimas ${VENTANA_HORAS}h (máx ${MAX_LLAMADAS_POR_NUMERO}).\n` +
      `Espera antes de intentar de nuevo.`
    );
    return { ok: false, error: 'Límite de llamadas alcanzado' };
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
    serverUrl: SOFIA_CONFIG.serverUrl,
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
      `🤖 Sofía en línea`
    );

    console.log(`[ContextCaller] Llamada iniciada: ${nombre} — ${call.id}`);
    return { ok: true, callId: call.id, clienteId: cliente.client_id };

  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error(`[ContextCaller] Error:`, msg);
    await TelegramConnector.notificar(
      `❌ <b>Llamada fallida a ${esc(nombre)} (${esc(telefono)})</b>\n` +
      `🎯 Objetivo: ${esc(objetivo)}\n` +
      `⚠️ Error: <code>${esc(msg)}</code>`
    );
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
