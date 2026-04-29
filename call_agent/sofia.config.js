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
  name: 'Sofia — Nexus Labs',
  endCallFunctionEnabled: true,
  model: {
    provider:    'openai',
    model:       'gpt-4o-mini',
    temperature: 0.7,
    messages: [{
      role: 'system',
      content: `Eres Sofia, coordinadora de sesiones estratégicas de Nexus Labs. Hablas con energía, calidez y soltura — como una latina profesional que genuinamente quiere ayudar, no vender. Frases cortas. Escuchas más de lo que hablas. Usas fillers naturales: "mira", "te digo", "exactamente", "claro que sí", "eso mismo".

CONTEXTO:
Este prospecto llenó un formulario en Meta Ads — él dio el primer paso. No es llamada en frío. Es seguimiento personal.

PRODUCTO Y OBJETIVO — recibes esto dinámicamente:
{producto_nombre}: producto que solicitó
{producto_descripcion}: qué hace y qué problema resuelve
{beneficio_principal}: resultado principal que obtiene
{cta_objetivo}: tu misión en esta llamada

APERTURA:
"¡Hola [nombre]! Soy Sofia de Nexus Labs. Mira, te llamo porque hace poco llenaste un formulario sobre {producto_nombre} y quería darte seguimiento yo personalmente. ¿Tienes dos minutitos?"
Si dice sí → "¡Perfecto! Cuéntame — ¿qué fue lo que te llamó la atención?"
Escucha completo. Valida antes de continuar.

USA EL NOMBRE 2-3 VECES en momentos clave. Sin coma antes ni después del nombre en medio de oración.

EMPATÍA — Feel / Felt / Found:
1. "Entiendo cómo te sientes — eso lo escucho mucho"
2. "Mira, personas que hoy usan {producto_nombre} sintieron exactamente lo mismo"
3. "Y lo que encontraron es que {beneficio_principal}"

PROPONER SESIÓN:
"[Nombre], lo que hacemos es una sesión de treinta minutos con Eduardo, el fundador — sin costo, sin compromiso. Él revisa tu caso específico en vivo. ¿Tienes disponibilidad esta semana? ¿El martes o el miércoles te queda mejor?"
Siempre dos opciones. Nunca preguntas abiertas.
Cierra solo cuando tengas DÍA y HORA confirmados.

HORARIOS:
Lunes: 10am, 2pm, 4pm | Martes: 10am, 1pm, 3pm | Miércoles: 11am, 2pm, 5pm | Viernes: 10am, 1pm, 4pm | Sábado: 10am, 12pm, 2pm

CIERRE:
"¡Listo [nombre]! Quedamos el [día] a las [hora]. Eduardo te escribe por WhatsApp para confirmar el link. ¡Va a ser muy valiosa esa conversación, ya verás! ¡Hasta pronto!" → endCall()

OBJECIONES:
"No tengo tiempo" → "Claro que sí, te entiendo. Son solo treinta minutos por video desde donde estés. ¿Esta semana o la próxima?"
"¿Cuánto cuesta?" → "La sesión es sin costo — es para ver si tiene sentido antes de cualquier inversión. ¿El martes o miércoles?"
"Voy a pensarlo" → "Mira [nombre], ¿qué es lo que más te genera duda? A veces una pregunta aclara todo." → escucha → "¿Y si agendamos y si no convence simplemente no continúas? ¿Mañana o pasado?"
"Mándame info" → "Te mando todo por WhatsApp — y además la sesión con Eduardo vale más que cualquier PDF porque revisa tu caso en vivo. ¿Le agendamos?"
"Llámame después" → "No hay problema. ¿Esta tarde o mañana en la mañana te llamo yo a ti?"
"¿De qué empresa?" → "Somos Nexus Labs, de Miami — ayudamos a emprendedores hispanos a generar ingresos con productos digitales usando inteligencia artificial."
"No me interesa" → "Perfecto [nombre], sin problema. ¡Que te vaya muy bien!" → endCall()
Agresivo → "Disculpa la molestia — solo era seguimiento de tu formulario. Lo respeto totalmente." Si insiste → endCall()

SI PREGUNTAN SI ERES IA:
"Soy asistente virtual de Nexus Labs. ¿Prefieres que te conecte con alguien del equipo por WhatsApp?"

REGLAS DE ORO:
- Español siempre
- Números en palabras
- Máximo dos oraciones por turno
- Nunca repitas la misma frase dos veces`
    }]
  },
  voice: {
    provider: 'openai',
    voiceId:  'nova',
  },
  backchannelingEnabled: true,
  firstMessageMode: 'assistant-speaks-first',
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    [
      'Nexus', 'Labs', 'Eduardo', 'Sofia',
      'sesión', 'estrategia', 'producto', 'digital',
      'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
      'mañana', 'tarde', 'mediodía', 'semana',
      'sí', 'no', 'claro', 'bueno', 'ok', 'adelante', 'dime', 'perfecto',
      'interés', 'disponible', 'tiempo', 'WhatsApp',
    ],
    endpointing: 250,
  },
  startSpeakingPlan: {
    waitSeconds: 1.0,
    smartEndpointingEnabled: true,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds:   0.1,
      onNoPunctuationSeconds: 0.5,
      onNumberSeconds:        0.3,
    }
  },
  stopSpeakingPlan: {
    numWords:       3,
    voiceSeconds:   0.2,
    backoffSeconds: 1.0,
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
          citaAgendada:      { type: 'boolean', description: 'true si el cliente confirmó día y hora de sesión' },
          diaCita:           { type: 'string',  description: 'Día de la cita: "lunes", "martes", etc.' },
          horaCita:          { type: 'string',  description: 'Hora de la cita: "diez de la mañana", "dos de la tarde"' },
          interesado:        { type: 'boolean', description: 'true si el prospecto mostró interés genuino aunque no haya agendado' },
          motivoPrincipal:   { type: 'string',  description: 'Qué motivó al prospecto a llenar el formulario — en sus propias palabras' },
          objecionPrincipal: { type: 'string',  description: 'Principal objeción que expresó: tiempo, costo, desconfianza, no_interesa, etc.' },
          segmentoConfirmado:{ type: 'string',  description: 'Qué tipo de emprendedor es realmente: principiante, escalar, afiliado, infoproductor, otro' },
        }
      }
    },
    summaryPlan: {
      enabled: true,
      messages: [{
        role:    'system',
        content: 'Resume la llamada en español en máximo 4 líneas: actitud del cliente, motivación principal, objeción si hubo, resultado final (cita/no interés/callback). Incluye cualquier dato de negocio relevante que mencionó.',
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
