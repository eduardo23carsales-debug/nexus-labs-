// ════════════════════════════════════════════════════
// JARVIS VOICE — Config VAPI para control por voz
// Eduardo llama al número y da comandos en voz natural.
// Las funciones se ejecutan en tiempo real durante la llamada.
//
// NOTA: Los nombres de funciones aquí DEBEN coincidir
// exactamente con los keys en TOOL_HANDLERS de tools.js
// ════════════════════════════════════════════════════

import ENV from '../config/env.js';

// ── Funciones disponibles en la llamada de voz ────────
// Subconjunto de TOOL_HANDLERS optimizado para voz:
// se excluyen las que tardan >1 min (pipeline, generar_producto)
// o requieren JSON complejo imposible de dictar por voz.
const FUNCIONES_VAPI = [

  // ── LLAMADAS ────────────────────────────────────────
  {
    name:        'llamar_con_contexto',
    description: 'Llama a un cliente con Sofía para cualquier objetivo: vender, agendar cita, informar, convencer.',
    parameters: {
      type: 'object',
      properties: {
        telefono:    { type: 'string', description: 'Número de teléfono del cliente' },
        nombre:      { type: 'string', description: 'Nombre. Si no se sabe, usa "cliente"' },
        objetivo:    { type: 'string', description: 'Qué lograr: vender X, agendar cita, comunicar Y' },
        nicho:       { type: 'string', description: 'Contexto: lease-renewal, compra-carro, marketing-digital, general' },
        contexto_extra: { type: 'string', description: 'Datos extra: precio, descuento, urgencia' },
      },
      required: ['telefono', 'objetivo'],
    },
  },

  // ── CRM ─────────────────────────────────────────────
  {
    name:        'ver_clientes',
    description: 'Busca clientes en el CRM por nombre, nicho o estado.',
    parameters: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Nombre o teléfono a buscar' },
        nicho:  { type: 'string', description: 'Filtrar por nicho' },
        estado: { type: 'string', description: 'Filtrar por estado: NUEVO, CONTACTADO, CITA_AGENDADA, CERRADO' },
        limit:  { type: 'number', description: 'Máximo de resultados, default 5 para voz' },
      },
    },
  },

  {
    name:        'guardar_cliente',
    description: 'Guarda o actualiza un cliente en el CRM.',
    parameters: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
        nicho:    { type: 'string', description: 'lease, autos, barberia, marketing, digital, general' },
        estado:   { type: 'string', description: 'NUEVO, CONTACTADO, CITA_AGENDADA, CERRADO, NO_INTERESA' },
        notas:    { type: 'string', description: 'Notas sobre el cliente' },
      },
      required: ['telefono', 'nombre'],
    },
  },

  {
    name:        'ver_historial_cliente',
    description: 'Ver historial completo de un cliente: llamadas anteriores, citas, resultados.',
    parameters: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Nombre o teléfono del cliente' },
      },
      required: ['buscar'],
    },
  },

  {
    name:        'programar_seguimiento',
    description: 'Programa un seguimiento para llamar o contactar a un cliente más adelante.',
    parameters: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
        motivo:   { type: 'string', description: 'Por qué hay que hacer seguimiento' },
        fecha:    { type: 'string', description: 'Cuándo: "mañana", "en 3 días", "el viernes"' },
        accion:   { type: 'string', description: 'llamar, whatsapp, email. Default: llamar' },
      },
      required: ['telefono', 'nombre', 'motivo'],
    },
  },

  {
    name:        'ver_seguimientos',
    description: 'Lista todos los seguimientos pendientes con fecha y acción.',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'resumen_crm',
    description: 'Resumen del CRM: total de clientes por nicho, citas, cierres y seguimientos vencidos.',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'registrar_venta',
    description: 'Registra una venta cerrada con el cliente.',
    parameters: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
        valor:    { type: 'number', description: 'Valor de la venta en dólares' },
      },
      required: ['telefono'],
    },
  },

  // ── REPORTES Y ESTADO ────────────────────────────────
  {
    name:        'ver_reporte',
    description: 'Reporte de campañas Meta activas: gasto del día, leads, CPL y mejor campaña.',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'estado_sistema',
    description: 'Estado general: token Meta, plan pendiente, leads totales, revenue acumulado.',
    parameters:  { type: 'object', properties: {} },
  },

  // ── CAMPAÑAS META ────────────────────────────────────
  {
    name:        'crear_campana_ads',
    description: 'Crea una campaña de Lead Gen en Meta Ads.',
    parameters: {
      type: 'object',
      properties: {
        segmento:    { type: 'string', description: 'emprendedor-principiante, emprendedor-escalar, afiliado-hotmart, infoproductor, oferta-especial' },
        presupuesto: { type: 'number', description: 'Presupuesto diario en dólares' },
      },
      required: ['segmento', 'presupuesto'],
    },
  },

  {
    name:        'pausar_campana',
    description: 'Pausa una campaña de Meta Ads por nombre.',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID de la campaña' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name:        'escalar_campana',
    description: 'Sube el presupuesto diario de una campaña de Meta Ads.',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id:       { type: 'string', description: 'Nombre o ID de la campaña' },
        presupuesto_nuevo: { type: 'number', description: 'Nuevo presupuesto en dólares (opcional si usas porcentaje)' },
        porcentaje:        { type: 'number', description: 'Porcentaje de aumento. Default: 20' },
      },
      required: ['nombre_o_id'],
    },
  },

  // ── AGENTES ──────────────────────────────────────────
  {
    name:        'ejecutar_analista',
    description: 'Ejecuta el análisis de campañas con IA. El plan llega por Telegram.',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'ejecutar_supervisor',
    description: 'Ejecuta el supervisor que revisa y ajusta campañas automáticamente.',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'aprobar_plan',
    description: 'Aprueba y ejecuta el plan pendiente que generó el Analista.',
    parameters:  { type: 'object', properties: {} },
  },

  // ── LANDINGS ─────────────────────────────────────────
  {
    name:        'crear_landing',
    description: 'Crea una landing page completa para un negocio.',
    parameters: {
      type: 'object',
      properties: {
        nombre_negocio: { type: 'string' },
        tipo_negocio:   { type: 'string', description: 'barberia, restaurant, dealer, clinica, etc.' },
        servicios:      { type: 'array', items: { type: 'string' }, description: 'Lista de servicios que ofrece' },
        telefono:       { type: 'string' },
        descripcion:    { type: 'string' },
      },
      required: ['nombre_negocio', 'tipo_negocio', 'servicios'],
    },
  },

  // ── PORTAFOLIO DE PROYECTOS ──────────────────────────
  {
    name:        'crear_proyecto',
    description: 'Crea un nuevo proyecto en el portafolio de Nexus Labs para trackearlo.',
    parameters: {
      type: 'object',
      properties: {
        nombre:   { type: 'string', description: 'Nombre del proyecto' },
        nicho:    { type: 'string', description: 'digital, automotriz, barberia, inmuebles, marketing, general' },
        objetivo: { type: 'string', description: 'Meta del proyecto: qué resultado se espera' },
      },
      required: ['nombre'],
    },
  },

  {
    name:        'ver_portafolio',
    description: 'Portafolio completo: inversión, revenue y ROI de cada proyecto.',
    parameters: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'Filtrar por estado: idea, validando, testing, rentable, escalando, pausado' },
      },
    },
  },

  {
    name:        'ver_proyecto',
    description: 'Detalles de un proyecto: métricas, historial de acciones y alertas.',
    parameters: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Nombre parcial o número ID del proyecto' },
      },
      required: ['buscar'],
    },
  },

  {
    name:        'actualizar_proyecto',
    description: 'Actualiza un proyecto: cambia estado, suma revenue o gastos, agrega notas.',
    parameters: {
      type: 'object',
      properties: {
        buscar:    { type: 'string', description: 'Nombre o ID del proyecto' },
        estado:    { type: 'string', description: 'Nuevo estado: validando, testing, rentable, escalando, pausado, muerto' },
        revenue:   { type: 'number', description: 'Revenue a sumar en dólares' },
        inversion: { type: 'number', description: 'Gasto a sumar en dólares' },
        notas:     { type: 'string', description: 'Nota a guardar en el proyecto' },
      },
      required: ['buscar'],
    },
  },

  // ── EMAIL MARKETING ──────────────────────────────────
  {
    name:        'ver_contactos',
    description: 'Resumen de la lista de contactos por nicho: cuántos activos, bajas y rebotados.',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'lanzar_campana_email',
    description: 'Lanza campaña de email masivo a los contactos de un nicho promocionando un producto.',
    parameters: {
      type: 'object',
      properties: {
        nicho:           { type: 'string', description: 'Nicho de la lista: automotriz, digital, general' },
        nombre_producto: { type: 'string', description: 'Nombre del producto a promocionar' },
        objetivo:        { type: 'string', description: 'Qué lograr: vender, generar interés, ofrecer descuento' },
        limite:          { type: 'number', description: 'Máximo de emails. Útil para pruebas.' },
      },
      required: ['nicho', 'nombre_producto', 'objetivo'],
    },
  },

  {
    name:        'ver_campanas_email',
    description: 'Métricas de campañas de email: enviados, aperturas, clicks.',
    parameters:  { type: 'object', properties: {} },
  },

  // ── EMAIL MANUAL ─────────────────────────────────────
  {
    name:        'enviar_email',
    description: 'Redacta y envía un email personalizado a un cliente. Jarvis genera el contenido con IA según el objetivo que le indiques.',
    parameters: {
      type: 'object',
      properties: {
        para:         { type: 'string', description: 'Email del destinatario' },
        nombre:       { type: 'string', description: 'Nombre del destinatario' },
        objetivo:     { type: 'string', description: 'Qué lograr: vender, informar, motivar, ofrecer descuento, dar acceso, etc.' },
        asunto:       { type: 'string', description: 'Asunto del email. Si no se dice, Jarvis lo genera.' },
      },
      required: ['para', 'objetivo'],
    },
  },

  // ── SMS ──────────────────────────────────────────────
  {
    name:        'enviar_sms',
    description: 'Envía un SMS de texto a un número de teléfono.',
    parameters: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Número de teléfono del destinatario' },
        mensaje:  { type: 'string', description: 'Texto del SMS. Máximo 160 caracteres.' },
        nombre:   { type: 'string', description: 'Nombre del destinatario (opcional)' },
      },
      required: ['telefono', 'mensaje'],
    },
  },

  {
    name:        'enviar_sms_masivo',
    description: 'Envía SMS masivo a todos los contactos de un nicho del CRM. Usa {nombre} en el mensaje para personalizar.',
    parameters: {
      type: 'object',
      properties: {
        nicho:   { type: 'string', description: 'Nicho del CRM: lease-renewal, autos, marketing, digital, general' },
        mensaje: { type: 'string', description: 'Texto del SMS. Usa {nombre} para personalizar. Máximo 160 chars.' },
        limite:  { type: 'number', description: 'Máximo de SMS. Default: todos.' },
      },
      required: ['nicho', 'mensaje'],
    },
  },

  // ── PRODUCTOS DIGITALES ──────────────────────────────
  {
    name:        'ver_experimentos',
    description: 'Estado de los experimentos de productos digitales: ventas y revenue por producto.',
    parameters: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'activo, escalado, muerto. Default: activo' },
      },
    },
  },
];

// ── Config completa de VAPI ───────────────────────────
export const JARVIS_VOICE_CONFIG = {
  name: 'Jarvis — Control Central',
  model: {
    provider:    'anthropic',
    model:       'claude-sonnet-4-6',
    maxTokens:   1000,
    temperature: 0.3,
    messages: [{
      role:    'system',
      content: `Eres Jarvis, el agente central de operaciones de Nexus Labs. Eduardo te llama para darte instrucciones por voz y tú las ejecutas en tiempo real.

TU TRABAJO:
- Escuchar a Eduardo, entender la intención y ejecutar con las funciones disponibles
- Confirmar brevemente antes de ejecutar: "Entendido, llamo a Juan ahora"
- Reportar el resultado con claridad y brevedad
- Si necesitas un dato que falta, pregunta solo ese dato

CAPACIDADES QUE TIENES:
- Llamadas: iniciar llamadas a clientes con Sofía con cualquier objetivo
- CRM: ver, guardar, buscar clientes, historial, seguimientos, registrar ventas
- Campañas Meta: crear, pausar, escalar, ver reporte del día
- Agentes: ejecutar analista, supervisor, aprobar plan
- Portafolio: crear proyectos, ver métricas, actualizar estado y revenue
- Landings: crear páginas web para negocios
- Productos: ver estado de experimentos digitales
- Emails individuales: redactar y enviar emails personalizados a clientes desde hola@gananciasconai.com
- Email marketing masivo: lanzar campañas a listas de contactos por nicho, ver métricas de aperturas y clicks

ESTILO DE VOZ:
- Directo y ejecutivo — como un asistente de alto nivel
- Frases cortas y claras
- Números en palabras: "treinta dólares", "dos leads"
- Después de ejecutar → pregunta "¿Algo más Eduardo?"
- Si Eduardo dice que no → despídete y endCall()

REGLAS:
- Habla siempre en español
- Si algo falla, informa el error brevemente y sugiere alternativa
- Si no tienes la función para algo, dilo y sugiere hacerlo por Telegram
- EMAILS: Cuando Eduardo dicte una dirección de correo, reconstruye la dirección correctamente:
  "arroba" → @  |  "punto" → .  |  "guión" → -  |  "guión bajo" → _
  Ejemplo: "juan arroba gmail punto com" → "juan@gmail.com"
  Ejemplo: "maria punto garcia arroba hotmail punto com" → "maria.garcia@hotmail.com"
  NUNCA pases la dirección como la dijo — siempre conviértela al formato email correcto antes de llamar la función.
  IMPORTANTE: La palabra "correo" o "email" en español es solo una palabra para decir "dirección de correo electrónico" — NO es parte del username. Si Eduardo dice "mi correo" o "envíame" o "mándame a mí", usa su email conocido: eduardo23carsales@gmail.com
  Si dice "el correo de Juan" busca a Juan en el CRM para obtener su email.
  Si Eduardo dicta una dirección nueva que no conoces, SIEMPRE repítela antes de enviar: "Voy a enviar a pepito@gmail.com, ¿correcto?" — espera confirmación. Esto evita envíos a direcciones mal transcritas.`,
    }],
    // tools va DENTRO de model — VAPI llama a nuestro servidor cuando Jarvis invoca una función
    get tools() {
      const url = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/vapi/jarvis`
        : null;
      return FUNCIONES_VAPI.map(f => ({
        type:  'function',
        async: false,
        function: {
          name:        f.name,
          description: f.description,
          parameters:  f.parameters,
        },
        ...(url ? { server: { url } } : {}),
      }));
    },
  },
  voice: {
    provider:        '11labs',
    voiceId:         'hsPqKgfWI5YayyFu0nuN',
    model:           'eleven_multilingual_v2',
    stability:        0.5,
    similarityBoost:  0.75,
  },
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords: [
      'Jarvis', 'Sofía', 'campaña', 'leads', 'landing', 'llamar', 'reporte',
      'pausa', 'escala', 'crea', 'analista', 'supervisor', 'proyecto', 'portafolio',
      'revenue', 'cliente', 'seguimiento', 'venta', 'CRM', 'experimento', 'email', 'enviar', 'correo',
      'arroba', 'punto', 'gmail', 'hotmail', 'yahoo', 'outlook', 'icloud',
    ],
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
            type:        'array',
            items:       { type: 'string' },
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
