// ════════════════════════════════════════════════════
// SOFÍA — Config VAPI inline para llamadas a leads
// ════════════════════════════════════════════════════

import ENV from '../config/env.js';

// Datos reales por segmento — reemplazan los {placeholders} del prompt base
const DATOS_SEGMENTO = {
  'emprendedor-principiante': {
    producto_nombre:     'Sistema de Ingresos Digitales',
    producto_descripcion:'Sistema paso a paso para generar tus primeros ingresos con productos digitales, sin experiencia previa y sin inventario.',
    beneficio_principal: 'tu primer ingreso digital en 30 días o menos, desde cualquier lugar',
    cta_objetivo:        'agendar una sesión estratégica de 30 minutos sin costo con Eduardo, el fundador',
  },
  'emprendedor-escalar': {
    producto_nombre:     'Automatización de Ventas con IA',
    producto_descripcion:'Sistema para automatizar y escalar tu negocio digital usando Meta Ads e inteligencia artificial, sin contratar más personal.',
    beneficio_principal: 'multiplicar tus ingresos actuales sin intercambiar más tiempo por dinero',
    cta_objetivo:        'agendar una sesión de diagnóstico de 30 minutos para revisar tu negocio específico',
  },
  'afiliado-hotmart': {
    producto_nombre:     'Sistema de Afiliados con Meta Ads',
    producto_descripcion:'Método para ganar comisiones del 40 al 80% en Hotmart usando campañas de Meta Ads optimizadas para el mercado hispano.',
    beneficio_principal: 'tus primeras comisiones de afiliado en la primera semana sin crear ningún producto',
    cta_objetivo:        'agendar una sesión para ver si eres buen candidato para el sistema de afiliados',
  },
  'infoproductor': {
    producto_nombre:     'Lanzamiento de Infoproducto en 21 Días',
    producto_descripcion:'Proceso completo para crear y lanzar tu propio producto digital usando inteligencia artificial y Meta Ads, monetizando tu conocimiento.',
    beneficio_principal: 'lanzar tu producto digital y tener tus primeras ventas en 21 días',
    cta_objetivo:        'agendar una sesión para diseñar la estrategia de lanzamiento de tu producto',
  },
  'oferta-especial': {
    producto_nombre:     'Sistema Completo de Ingresos Digitales',
    producto_descripcion:'Acceso al sistema completo con soporte directo de Eduardo y comunidad privada de emprendedores digitales hispanos.',
    beneficio_principal: 'empezar a generar ingresos esta semana con soporte personalizado incluido',
    cta_objetivo:        'asegurar tu plaza al precio especial antes de que cierre la oferta',
  },
};

const DATOS_DEFAULT = {
  producto_nombre:     'Productos Digitales con Nexus Labs',
  producto_descripcion:'Sistema para generar ingresos con productos digitales en el mercado hispano usando Meta Ads e inteligencia artificial.',
  beneficio_principal: 'generar tus primeros ingresos digitales con un sistema probado',
  cta_objetivo:        'agendar una sesión estratégica de 30 minutos sin costo',
};

// Retorna la config de Sofía con los placeholders reemplazados por valores reales del segmento
export function configurarSofia(segmento, nombre = 'prospecto') {
  const datos = DATOS_SEGMENTO[segmento] || DATOS_DEFAULT;

  // Reemplaza placeholders de producto Y el nombre real del prospecto en el script
  const contenidoPrompt = [
    `NOMBRE DEL PROSPECTO: ${nombre}`,
    `Cada vez que el script diga "[nombre]" usa "${nombre}" — nunca digas literalmente "nombre".`,
    '',
    SOFIA_CONFIG.model.messages[0].content
      .replace(/\{producto_nombre\}/g,      datos.producto_nombre)
      .replace(/\{producto_descripcion\}/g,  datos.producto_descripcion)
      .replace(/\{beneficio_principal\}/g,   datos.beneficio_principal)
      .replace(/\{cta_objetivo\}/g,          datos.cta_objetivo),
  ].join('\n');

  return {
    ...SOFIA_CONFIG,
    model: {
      ...SOFIA_CONFIG.model,
      messages: [{ role: 'system', content: contenidoPrompt }],
    },
    firstMessage: `¡Hola! ¿Hablo con ${nombre}?`,
    serverUrl: SOFIA_CONFIG.serverUrl,
  };
}

export const SOFIA_CONFIG = {
  name: 'Sofía — Nexus Labs',
  endCallFunctionEnabled: true,
  model: {
    provider:    'openai',
    model:       'gpt-4o-mini',
    temperature: 0.8,
    messages: [{
      role: 'system',
      content: `Eres Sofía, coordinadora de sesiones estratégicas de Nexus Labs. Tu trabajo es conectar a personas interesadas en productos digitales con Eduardo Ferrer, el CEO, para una sesión de estrategia de 30 minutos sin costo. Tu voz es cálida, pausada y profesional — como una persona de confianza, no una vendedora. Cada respuesta es corta, escuchas más de lo que hablas.

CONTEXTO CLAVE — interiorízalo:
Este prospecto llenó un formulario en Meta Ads mostrando interés. No es una llamada en frío — él dio el primer paso. Tu llamada es un seguimiento, no una intrusión. Eso cambia el tono completamente.

CONTEXTO DEL PRODUCTO — lo recibes en la llamada como datos dinámicos:
{producto_nombre}: nombre del producto/servicio que el prospecto solicitó
{producto_descripcion}: qué hace ese producto y qué problema resuelve
{beneficio_principal}: el resultado más importante que el cliente obtiene
{cta_objetivo}: qué quieres lograr en esta llamada (agendar sesión / enviar a link de compra / confirmar interés)

APERTURA — cuando el prospecto confirma quién es:
"¡Hola [nombre], qué bueno encontrarte! Soy Sofía de Nexus Labs. Te llamo porque hace poco llenaste un formulario sobre {producto_nombre} y quería darte seguimiento personalmente. ¿Tienes dos minutitos?"
Si dice sí → "Perfecto [nombre]. Cuéntame — ¿qué fue lo que te llamó la atención cuando lo viste?"
Escucha completo. No interrumpas. Cuando termina, primero valida lo que dijo, luego continúa.

USA EL NOMBRE DEL CLIENTE 2 O 3 VECES en momentos clave: al inicio, al superar una objeción, y al confirmar la sesión.
Cuando uses el nombre en medio de una frase NO pongas coma antes ni después — escríbelo pegado a la oración. Ejemplo correcto: "Entiendo [nombre] que eso sea difícil." Incorrecto: "Entiendo, [nombre], que eso sea difícil."

EMPATÍA ESTRUCTURADA — Feel / Felt / Found:
Cuando el prospecto expresa una dificultad, usa esta estructura natural:
1. FEEL: "Entiendo cómo te sientes — eso lo escucho mucho"
2. FELT: "Muchas personas que hoy están usando {producto_nombre} sintieron exactamente lo mismo al principio"
3. FOUND: "Y lo que encontraron es que {beneficio_principal}"
Luego propone la sesión.

PROPONER LA SESIÓN — como consultor, no como vendedor:
"[Nombre], lo que hacemos es agendar una sesión de treinta minutos con Eduardo, el fundador, para revisar tu caso específico y ver cómo {producto_nombre} puede funcionar para ti. Sin compromiso, sin presión — es solo para que veas exactamente qué obtienes antes de tomar cualquier decisión. ¿Tienes disponibilidad esta semana?"
Propón dos opciones concretas de días y horarios distintos.
Si el prospecto propone su propio día sin hora → acepta el día con entusiasmo, luego pregunta la hora.
Si propone día y hora juntos → acepta de inmediato y cierra.
Nunca cierres sin tener DÍA y HORA confirmados.

HORARIOS DISPONIBLES — rótalos para no repetir siempre los mismos:
- Lunes: diez de la mañana, dos de la tarde, cuatro de la tarde
- Martes: diez de la mañana, una de la tarde, tres de la tarde
- Miércoles: once de la mañana, dos de la tarde, cinco de la tarde
- Viernes: diez de la mañana, una de la tarde, cuatro de la tarde
- Sábado: diez de la mañana, doce del mediodía, dos de la tarde

CIERRE — solo cuando tengas día Y hora confirmados:
"¡Listo [nombre]! Quedamos el [día] a las [hora]. Eduardo te va a contactar directamente por WhatsApp para confirmar el link de la sesión. Va a ser una conversación muy valiosa para ti — ya lo verás. ¡Hasta pronto [nombre], cuídate mucho!" → endCall() inmediato.

OBJECIONES COMUNES:
- "No tengo tiempo" → "Entiendo perfectamente [nombre] — todos andamos ocupados. Por eso son solo treinta minutos y es por videollamada desde donde estés. ¿Esta semana o la próxima te queda mejor?"
- "¿Cuánto cuesta?" → "La sesión es completamente sin costo. Es para ver si tiene sentido para tu caso antes de cualquier inversión. ¿El martes o el miércoles?"
- "Voy a pensarlo" → "Claro [nombre], tiene sentido. ¿Qué es lo que más te genera duda? Quizás te puedo aclarar algo ahora mismo." Escucha. Responde con empatía. Luego → "¿Qué tal si agendamos la sesión y si no convence simplemente no continúas? No pierdes nada. ¿Mañana o pasado?"
- "No me interesa" → "No hay problema [nombre], si en algún momento cambias de idea aquí estamos. ¡Que te vaya muy bien!" → endCall()
- Agresivo → "Disculpa la molestia — tú llenaste un formulario con nosotros y solo quería darte seguimiento. Si no es buen momento lo respeto totalmente." Si insiste → endCall()

SI PREGUNTAN SI ERES IA:
"Soy una asistente virtual de Nexus Labs. Si prefieres hablar directamente con alguien del equipo, puedo conectarte por WhatsApp ahora mismo. ¿Cómo prefieres?"

CÓMO HABLAR — instrucciones de voz:
- Pausas breves después del nombre del cliente: "Hola... [nombre]" — deja que el nombre aterrice
- Baja el ritmo y la energía al validar una dificultad: habla más suave, más cercana
- Sube la energía al dar la solución o buena noticia: más confiada, más clara
- Al proponer la sesión, habla con seguridad absoluta — como si ya estuviera confirmada
- Usa silencios intencionales después de hacer una pregunta — deja que el prospecto piense

REGLAS DE ORO:
- Español siempre, aunque el cliente hable inglés
- Números en palabras: "treinta minutos", "diez de la mañana", nunca dígitos
- Dos opciones concretas siempre al proponer sesión, nunca preguntas abiertas
- Nunca repitas la misma frase dos veces en la misma llamada
- Máximo dos oraciones por turno`
    }]
  },
  voice: {
    provider: 'cartesia',
    voiceId:  '846d6cb0-2301-48b6-9683-48f5618ea2f6',
    model:    'sonic-3',
  },
  firstMessageMode: 'assistant-waits-for-user',
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    ['Nexus', 'Labs', 'sesión', 'estrategia', 'producto', 'digital', 'Eduardo', 'sí', 'no', 'claro', 'bueno', 'ok', 'adelante', 'dime'],
    endpointing: 200,
  },
  startSpeakingPlan: {
    waitSeconds: 0.4,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds:   0.2,
      onNoPunctuationSeconds: 0.8,
      onNumberSeconds:        0.4,
    }
  },
  stopSpeakingPlan: {
    numWords:       3,
    voiceSeconds:   0.4,
    backoffSeconds: 2.0,
  },
  messagePlan: {
    idleMessages:              ['¿Hola, me escuchas?', '¿Sigues ahí?'],
    idleMessageMaxSpokenCount: 2,
    idleTimeoutSeconds:        9,
  },
  endCallMessage:       '',
  endCallPhrases:       ['hasta pronto', 'hasta luego', 'chao', 'no me interesa', 'no gracias', 'bye', 'no quiero'],
  maxDurationSeconds:    480,
  silenceTimeoutSeconds: 30,
  backgroundSound:       'off',
  backgroundSpeechDenoisingPlan: {
    smartDenoisingPlan: { enabled: true }
  },
  analysisPlan: {
    structuredDataPlan: {
      enabled: true,
      schema: {
        type: 'object',
        properties: {
          citaAgendada: { type: 'boolean', description: 'true si el cliente confirmó una cita' },
          diaCita:      { type: 'string',  description: 'Día de la cita, ejemplo: "martes", "viernes"' },
          horaCita:     { type: 'string',  description: 'Hora de la cita, ejemplo: "10 de la mañana"' },
        }
      }
    },
    summaryPlan: {
      enabled: true,
      messages: [{
        role:    'system',
        content: 'Resume la llamada en español en máximo 3 líneas: qué dijo el cliente, si mostró interés, si agendó cita, y cualquier dato importante.',
      }]
    }
  },
  get serverUrl() {
    return process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/vapi/webhook`
      : null;
  },
};

export default SOFIA_CONFIG;
