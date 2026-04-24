// ════════════════════════════════════════════════════
// JARVIS VOICE — Config VAPI para control por voz
// Eduardo llama al número y da comandos en voz natural
// Las funciones se ejecutan en tiempo real durante la llamada
// ════════════════════════════════════════════════════

import ENV from '../config/env.js';

// Funciones que Jarvis puede ejecutar durante la llamada
// VAPI las llama via serverUrl cuando el modelo las invoca
const FUNCIONES_VAPI = [
  {
    name:        'llamar_contacto',
    description: 'Llama a un número de teléfono con el agente de ventas Sofía',
    parameters: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Número de teléfono' },
        nombre:   { type: 'string', description: 'Nombre de la persona' },
        servicio: { type: 'string', description: 'Servicio a ofrecer' },
      },
      required: ['telefono', 'nombre'],
    },
  },
  {
    name:        'ver_reporte',
    description: 'Obtiene el reporte actual de campañas, leads y ventas para leerlo en voz',
    parameters:  { type: 'object', properties: {} },
  },
  {
    name:        'ejecutar_analista',
    description: 'Ejecuta el análisis de campañas con inteligencia artificial',
    parameters:  { type: 'object', properties: {} },
  },
  {
    name:        'ejecutar_supervisor',
    description: 'Ejecuta el supervisor que revisa y optimiza campañas automáticamente',
    parameters:  { type: 'object', properties: {} },
  },
  {
    name:        'crear_campana_ads',
    description: 'Crea una campaña de Meta Ads para un segmento con un presupuesto diario',
    parameters: {
      type: 'object',
      properties: {
        segmento:    { type: 'string', description: 'Segmento: mal-credito, sin-credito, urgente, upgrade, oferta-especial' },
        presupuesto: { type: 'number', description: 'Presupuesto diario en dólares' },
      },
      required: ['segmento', 'presupuesto'],
    },
  },
  {
    name:        'pausar_campana',
    description: 'Pausa una campaña de Meta Ads por nombre',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID de la campaña' },
      },
      required: ['nombre_o_id'],
    },
  },
  {
    name:        'ver_leads',
    description: 'Obtiene el resumen de leads y el estado del funnel de ventas',
    parameters:  { type: 'object', properties: {} },
  },
  {
    name:        'estado_sistema',
    description: 'Obtiene el estado general del sistema y los indicadores clave',
    parameters:  { type: 'object', properties: {} },
  },
  {
    name:        'crear_landing',
    description: 'Crea una landing page para un negocio',
    parameters: {
      type: 'object',
      properties: {
        nombre_negocio: { type: 'string' },
        tipo_negocio:   { type: 'string' },
        servicios:      { type: 'array', items: { type: 'string' } },
        direccion:      { type: 'string' },
        telefono:       { type: 'string' },
        color_primario: { type: 'string' },
      },
      required: ['nombre_negocio', 'tipo_negocio', 'servicios'],
    },
  },
];

export const JARVIS_VOICE_CONFIG = {
  name: 'Jarvis — Control Central',
  model: {
    provider:    'anthropic',
    model:       'claude-sonnet-4-6',
    maxTokens:   1000,
    temperature: 0.3,
    messages: [{
      role:    'system',
      content: `Eres Jarvis, el agente central de comando de una plataforma de marketing automatizado. Eduardo te llama para darte instrucciones por voz.

TU TRABAJO:
- Escuchar a Eduardo y ejecutar lo que pide usando las funciones disponibles
- Confirmar brevemente lo que vas a hacer antes de ejecutar
- Reportar el resultado en voz alta de forma clara y concisa
- Si necesitas datos adicionales, pregunta solo lo estrictamente necesario

ESTILO DE VOZ:
- Directo y ejecutivo — como un asistente de alto nivel
- Frases cortas, claras, sin rodeos
- Confirma acciones con seguridad: "Entendido, llamo a Juan ahora"
- Reporta resultados con claridad: "Campaña pausada. Tenías 3 leads activos en esa campaña."
- Habla siempre en español

CUANDO TERMINA:
- Después de ejecutar la tarea y reportar el resultado → pregunta "¿Algo más Eduardo?"
- Si Eduardo dice que no → despídete brevemente y endCall()
- Si hay silencio de más de 8 segundos después del reporte → endCall()

NÚMEROS: di siempre los números en palabras cuando hables.`,
    }],
    functions: FUNCIONES_VAPI,
  },
  voice: {
    provider: 'cartesia',
    voiceId:  'a0e99841-438c-4a64-b679-ae501e7d6091', // Spanish LATAM male — asistente ejecutivo
    model:    'sonic-multilingual',
    language: 'es',
  },
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    ['Jarvis', 'campaña', 'leads', 'landing', 'llamar', 'reporte', 'pausa', 'crea', 'analista', 'supervisor'],
    endpointing: 300,
  },
  startSpeakingPlan: {
    waitSeconds: 0.5,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds:   0.2,
      onNoPunctuationSeconds: 1.0,
      onNumberSeconds:        0.5,
    },
  },
  stopSpeakingPlan: {
    numWords:       5,
    voiceSeconds:   0.5,
    backoffSeconds: 2.5,
  },
  messagePlan: {
    idleMessages:              ['¿Sigues ahí Eduardo?', '¿Necesitas algo más?'],
    idleMessageMaxSpokenCount: 2,
    idleTimeoutSeconds:        12,
  },
  firstMessage:         'Jarvis en línea. ¿Qué necesitas Eduardo?',
  endCallMessage:       'Listo. Hasta pronto.',
  endCallPhrases:       ['hasta luego', 'chao', 'bye', 'eso es todo', 'nada más', 'listo gracias'],
  maxDurationSeconds:    600,
  silenceTimeoutSeconds: 30,
  backgroundSound:       'off',
  get serverUrl() {
    return process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/vapi/jarvis`
      : null;
  },
  analysisPlan: {
    structuredDataPlan: {
      enabled: true,
      schema: {
        type: 'object',
        properties: {
          comandosEjecutados: {
            type:  'array',
            items: { type: 'string' },
            description: 'Lista de acciones que Jarvis ejecutó durante la llamada',
          },
          resumen: {
            type:        'string',
            description: 'Resumen de lo que se hizo en la llamada',
          },
        },
      },
    },
    summaryPlan: { enabled: true },
  },
};

export default JARVIS_VOICE_CONFIG;
