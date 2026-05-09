// ════════════════════════════════════════════════════
// JARVIS — Herramientas completas con CRM
// ════════════════════════════════════════════════════

import { llamarLead }                           from '../call_agent/caller.js';
import { llamarConContexto }                    from '../call_agent/context-caller.js';
import { procesarLead }                         from '../lead_system/capture.js';
import { ejecutarAnalista }                     from '../agents/analista/index.js';
import { ejecutarSupervisor }                   from '../agents/supervisor/index.js';
import { crearCampana, crearCampañaTrafico, generarYSubirImagen, generarCopiesParaProducto, generarSlideshowParaCampana } from '../ads_engine/campaign-creator.js';
import { CampaignManager }                      from '../ads_engine/campaign-manager.js';
import { MetaConnector }                        from '../connectors/meta.connector.js';
import { TelegramConnector, esc }               from '../connectors/telegram.connector.js';
import { ClientDB, ESTADOS_CRM, NICHOS }        from '../crm/client.db.js';
import { FollowUpDB }                           from '../crm/follow-up.db.js';
import { LeadsDB }                              from '../memory/leads.db.js';
import { ConversionsDB }                        from '../memory/conversions.db.js';
import { PlansDB }                              from '../memory/plans.db.js';
import { ejecutarPlan }                          from '../agents/ejecutor/index.js';
import { generarReporte }                       from '../reporting/index.js';
import { construirLanding }                     from './landing-builder.js';
import { investigarNicho, construirNichoDesdeIdea } from '../market_research_agent/index.js';
import { generarProducto }                      from '../product_engine/index.js';
import { publicarConStripe }                    from '../product_engine/publisher.js';
import { ResendConnector }                       from '../connectors/resend.connector.js';
import { AnthropicConnector }                    from '../connectors/anthropic.connector.js';
import { ContactsDB, EmailCampaignsDB }          from '../memory/contacts.db.js';
import { HotmartConnector }                     from '../connectors/hotmart.connector.js';
import { StripeConnector }                      from '../connectors/stripe.connector.js';
import { ExperimentsDB, ProductsMemoryDB }      from '../memory/products.db.js';
import { evaluarNicho }                         from '../scaling_agent/index.js';
import { validarIdea, verificarResultado }      from '../validation_agent/index.js';
import ENV                                      from '../config/env.js';
import BUSINESS                                 from '../config/business.config.js';
import { ProjectsDB }                           from '../crm/projects.db.js';
import { TwilioConnector }                      from '../connectors/twilio.connector.js';
import { JarvisMemoryDB }                       from '../memory/jarvis.db.js';
import { SystemConfigDB }                       from '../memory/config.db.js';
import { SystemState }                          from '../config/system-state.js';
import { query }                               from '../config/database.js';
import { GoogleCalendarConnector }              from '../connectors/google-calendar.connector.js';
import { LearningsDB }                          from '../memory/learnings.db.js';
import { CallsDB }                              from '../memory/calls.db.js';

// ── Definiciones de tools para Claude ─────────────────
export const TOOL_DEFINITIONS = [

  // ── LLAMADAS ──────────────────────────────────────
  {
    name: 'llamar_con_contexto',
    description: `Llama a CUALQUIER número de teléfono con una misión específica — vender un producto, hacer una cita, comunicar algo, convencer de algo, cualquier objetivo.
Úsalo cuando Eduardo diga cosas como:
- "llama al 786-xxx-xxxx y convéncelo de comprar el curso"
- "llama a Juan al [número] y dile que tiene hasta mañana para cerrar"
- "llama a [número] y agenda una cita"
- "llama a [nombre] y véndele el producto X"
Sofía adapta su conversación 100% al objetivo que le indiques — no está limitada a autos ni citas.
Si el nombre no se menciona, usa "cliente" como nombre.`,
    input_schema: {
      type: 'object',
      properties: {
        telefono:   { type: 'string',  description: 'Número de teléfono. Puede ser con guiones, espacios o sin ellos.' },
        nombre:     { type: 'string',  description: 'Nombre de la persona. Si no se conoce, usa "cliente".' },
        objetivo:   { type: 'string',  description: 'Misión exacta de la llamada. Sé MUY específico: qué lograr, qué producto/servicio ofrecer, qué argumento usar, qué resultado se espera.' },
        nicho:      { type: 'string',  description: 'Contexto del cliente: venta-curso, cita-negocio, lease-renewal, compra-carro, marketing-digital, general, etc.' },
        datos_producto: {
          type: 'object',
          description: 'Datos del producto, servicio o situación que se va a presentar en la llamada',
          properties: {
            tipo_auto:         { type: 'string', description: 'Modelo y año del vehículo (si aplica)' },
            pago_actual:       { type: 'number', description: 'Pago mensual actual del cliente' },
            pago_nuevo:        { type: 'number', description: 'Nuevo pago que podemos ofrecer' },
            fecha_vencimiento: { type: 'string', description: 'Fecha de vencimiento o deadline' },
            credito:           { type: 'string', description: 'Situación crediticia del cliente' },
            anios_cliente:     { type: 'number', description: 'Años que lleva siendo cliente' },
          },
        },
        contexto_extra: { type: 'string', description: 'Cualquier información adicional: precio del producto, descuento especial, urgencia, etc.' },
      },
      required: ['telefono', 'objetivo'],
    },
  },

  {
    name: 'llamar_simple',
    description: 'Llama a un número de teléfono de forma simple, sin contexto especial de CRM.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
        segmento: { type: 'string', description: 'mal-credito, sin-credito, urgente, upgrade, oferta-especial' },
      },
      required: ['telefono', 'nombre'],
    },
  },

  // ── CRM ───────────────────────────────────────────
  {
    name: 'guardar_cliente',
    description: `Guarda o actualiza un cliente en la base de datos CRM.
Úsalo cuando el usuario proporcione información de un cliente para almacenar.
También úsalo SIEMPRE después de una llamada para actualizar el estado.`,
    input_schema: {
      type: 'object',
      properties: {
        telefono:       { type: 'string'  },
        nombre:         { type: 'string'  },
        email:          { type: 'string'  },
        nicho:          { type: 'string'  },
        estado:         { type: 'string', description: 'NUEVO, CONTACTADO, NO_CONTESTO, CITA_AGENDADA, CITA_REALIZADA, CERRADO, NO_INTERESA, SEGUIMIENTO' },
        notas:          { type: 'string'  },
        datos_producto: { type: 'object'  },
        etiquetas:      { type: 'array', items: { type: 'string' } },
      },
      required: ['telefono', 'nombre'],
    },
  },

  {
    name: 'ver_clientes',
    description: 'Muestra clientes del CRM, con opción de filtrar por nicho, estado o búsqueda.',
    input_schema: {
      type: 'object',
      properties: {
        buscar: { type: 'string',  description: 'Nombre o teléfono para buscar' },
        nicho:  { type: 'string',  description: 'Filtrar por nicho' },
        estado: { type: 'string',  description: 'Filtrar por estado' },
        limit:  { type: 'number',  description: 'Máximo de resultados, default 10' },
      },
    },
  },

  {
    name: 'programar_seguimiento',
    description: `Programa un recordatorio de seguimiento para un cliente.
Úsalo cuando: el cliente no contestó, dijo "llámame mañana", se agendó cita y hay que confirmar, etc.`,
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
        nicho:    { type: 'string' },
        motivo:   { type: 'string', description: 'Por qué hay que hacer seguimiento' },
        fecha:    { type: 'string', description: 'Fecha y hora del seguimiento en formato ISO o descripción: "mañana", "en 3 días", "el viernes"' },
        accion:   { type: 'string', description: 'Qué hacer: llamar, whatsapp, email, cita' },
      },
      required: ['telefono', 'nombre', 'motivo'],
    },
  },

  {
    name: 'ver_seguimientos',
    description: 'Muestra todos los seguimientos pendientes programados.',
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'resumen_crm',
    description: 'Muestra un resumen completo del CRM: total de clientes, por nicho, por estado.',
    input_schema: { type: 'object', properties: {} },
  },

  // ── LANDINGS ──────────────────────────────────────
  {
    name: 'crear_landing',
    description: 'Crea una landing page completa para un negocio. Claude genera el HTML con diseño profesional.',
    input_schema: {
      type: 'object',
      properties: {
        nombre_negocio: { type: 'string' },
        tipo_negocio:   { type: 'string' },
        servicios:      { type: 'array', items: { type: 'string' } },
        direccion:      { type: 'string' },
        telefono:       { type: 'string' },
        descripcion:    { type: 'string' },
        color_primario: { type: 'string' },
      },
      required: ['nombre_negocio', 'tipo_negocio', 'servicios'],
    },
  },

  // ── META ADS ──────────────────────────────────────
  {
    name: 'crear_campana_ads',
    description: `Crea una campaña de Lead Gen en Meta Ads (captura nombre, teléfono y email con formulario nativo).
Los leads llegan al CRM y Sofía los llama si el ticket es alto.
Segmentos disponibles: emprendedor-principiante, emprendedor-escalar, afiliado-hotmart, infoproductor, oferta-especial.
Úsalo cuando Eduardo diga "lanza una campaña de leads", "crea anuncios para emprendedores", etc.`,
    input_schema: {
      type: 'object',
      properties: {
        segmento:    { type: 'string', description: 'Uno de: emprendedor-principiante, emprendedor-escalar, afiliado-hotmart, infoproductor, oferta-especial' },
        presupuesto: { type: 'number', description: 'Presupuesto diario en USD' },
        slideshow:   { type: 'boolean', description: 'Si true, genera un video slideshow con 5 imágenes DALL-E en vez de foto estática. Requiere nombre_producto.' },
        nombre_producto: { type: 'string', description: 'Nombre del producto (requerido si slideshow: true)' },
      },
      required: ['segmento', 'presupuesto'],
    },
  },

  {
    name: 'lanzar_campana_producto',
    description: `Crea una campaña de tráfico directo a URL de venta (Hotmart, landing page, etc).
A diferencia de crear_campana_ads, esta NO tiene formulario: el anuncio lleva directo a la página de compra.
Ideal cuando ya tienes un link de Hotmart o landing page listo.
Úsalo cuando Eduardo diga "lanza ads para el producto X con este link", "crea campaña para vender el curso", etc.`,
    input_schema: {
      type: 'object',
      properties: {
        segmento:        { type: 'string', description: 'Uno de: emprendedor-principiante, emprendedor-escalar, afiliado-hotmart, infoproductor, oferta-especial' },
        url_destino:     { type: 'string', description: 'URL de la página de venta (Hotmart checkout, landing page, etc.)' },
        presupuesto:     { type: 'number', description: 'Presupuesto diario en USD' },
        slideshow:       { type: 'boolean', description: 'Si true, genera un video slideshow con 5 imágenes DALL-E. Requiere nombre_producto.' },
        nombre_producto: { type: 'string', description: 'Nombre del producto (requerido si slideshow: true)' },
      },
      required: ['segmento', 'url_destino', 'presupuesto'],
    },
  },

  {
    name: 'lanzar_campana_slideshow',
    description: `Crea una campaña de Meta Ads con VIDEO SLIDESHOW automático.
DALL-E genera 5 imágenes distintas del producto → Meta las convierte en un video de 10 segundos → se lanza como ad.
Los slideshows tienen mucho mejor performance que fotos estáticas: más reach, mejor CTR, más barato.
Úsalo cuando Eduardo diga:
- "lanza con slideshow"
- "crea ads con video"
- "quiero video en vez de foto"
- "haz un slideshow para el producto X"
Funciona tanto para lead gen (formulario) como para tráfico a URL.`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_producto: { type: 'string', description: 'Nombre del producto para generar imágenes relevantes' },
        segmento:        { type: 'string', description: 'Segmento de audiencia. Default: emprendedor-principiante' },
        presupuesto:     { type: 'number', description: 'Presupuesto diario en USD. Default: 10' },
        url_destino:     { type: 'string', description: 'URL de venta. Si se da, campaña de tráfico. Si no, campaña de leads con formulario.' },
        nicho:           { type: 'string', description: 'Nicho del producto para personalizar las imágenes' },
      },
      required: ['nombre_producto'],
    },
  },

  {
    name: 'pausar_campana',
    description: 'Pausa una campaña de Meta Ads por nombre parcial.',
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string' },
      },
      required: ['nombre_o_id'],
    },
  },

  // ── REPORTES Y ESTADO ─────────────────────────────
  {
    name: 'ver_reporte',
    description: 'Reporte actual de campañas, leads, conversiones y revenue.',
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'estado_sistema',
    description: 'Estado general del sistema: token Meta, plan pendiente, métricas clave.',
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'ejecutar_analista',
    description: 'Ejecuta el análisis de campañas con IA y genera plan de optimización.',
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'ejecutar_supervisor',
    description: 'Ejecuta el supervisor que revisa y optimiza campañas automáticamente.',
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'registrar_venta',
    description: 'Registra una venta cerrada.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
        valor:    { type: 'number' },
      },
      required: ['telefono'],
    },
  },

  // ── NUEVAS TOOLS CEO ──────────────────────────────
  {
    name: 'ver_historial_cliente',
    description: `Muestra el historial completo de interacciones de un cliente.
Úsalo cuando Eduardo pregunte "¿qué pasó con Roberto?", "¿cuándo llamamos a Juan?", "¿tiene cita pendiente?".
Busca por nombre o teléfono.`,
    input_schema: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Nombre o teléfono del cliente' },
      },
      required: ['buscar'],
    },
  },

  {
    name: 'escalar_campana',
    description: `Sube el presupuesto diario de una campaña de Meta Ads.
Úsalo cuando Eduardo diga "escala la campaña de mal crédito", "súbele el presupuesto a urgente", etc.
Puedes indicar un porcentaje de aumento o un presupuesto nuevo fijo.`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id:       { type: 'string', description: 'Nombre parcial o ID de la campaña' },
        presupuesto_nuevo: { type: 'number', description: 'Nuevo presupuesto diario en dólares (opcional si usas porcentaje)' },
        porcentaje:        { type: 'number', description: 'Porcentaje de aumento, ej: 20 para subir 20%. Default: 20.' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name: 'aprobar_plan',
    description: `Aprueba y ejecuta el plan pendiente del Analista.
Úsalo cuando Eduardo diga "aprueba el plan", "ejecuta el plan de hoy", "dale adelante al plan", etc.
Primero muestra el resumen del plan y luego lo ejecuta.`,
    input_schema: {
      type: 'object',
      properties: {},
    },
  },

  // ── MOTOR DE PRODUCTOS DIGITALES ──────────────────
  {
    name: 'investigar_nicho',
    description: `Busca el nicho más rentable para lanzar un producto digital ahora mismo.
El sistema analiza el mercado hispano de USA y América Latina, evalúa múltiples candidatos con scoring 0-100,
y devuelve el mejor con todos los detalles: nombre del producto, precio sugerido, cliente ideal, quick win.
Si Eduardo da una idea o tema específico (ej: "productos naturales", "fitness", "immigración"), úsalo como enfoque.
Si no da ninguna idea, busca el mejor nicho disponible de forma autónoma.
Úsalo cuando Eduardo diga "busca un nicho", "investiga [tema]", "qué producto digital podemos lanzar", "busca oportunidad de [tema]".`,
    input_schema: {
      type: 'object',
      properties: {
        enfoque: { type: 'string', description: 'Tema o idea específica de Eduardo para enfocar la búsqueda (opcional). Ej: "productos naturales", "fitness para latinos", "crédito e inmigración"' },
      },
    },
  },

  {
    name: 'generar_producto',
    description: `Genera un producto digital completo (HTML interactivo con tabs) a partir de un nicho investigado.
Crea guías PDF, packs de prompts, plantillas, mini cursos o toolkits según el tipo del nicho.
El proceso tarda 5-10 minutos porque genera 5-7 secciones de contenido premium.
Úsalo cuando Eduardo diga "genera el producto", "crea el producto digital", "lanza el producto del nicho X".`,
    input_schema: {
      type: 'object',
      properties: {
        nicho_json:       { type: 'string', description: 'El JSON del nicho devuelto por investigar_nicho' },
        publicar_hotmart: { type: 'boolean', description: 'Si true, publica automáticamente en Hotmart al terminar' },
      },
      required: ['nicho_json'],
    },
  },

  {
    name: 'publicar_con_stripe',
    description: `Publica un producto en Stripe: crea el payment link, genera la landing page de ventas y la deja accesible en /p/:slug.
Cuando alguien paga, Stripe entrega el producto por email automáticamente (con Resend).
Úsalo cuando Eduardo tenga un nicho/producto y quiera lanzarlo YA a la venta con Stripe.
Requiere STRIPE_SECRET_KEY configurado en Railway.`,
    input_schema: {
      type: 'object',
      properties: {
        nicho_json:     { type: 'string', description: 'JSON del nicho de investigar_nicho' },
        experimento_id: { type: 'number', description: 'ID del experimento ya creado (opcional)' },
      },
      required: ['nicho_json'],
    },
  },

  {
    name: 'publicar_hotmart',
    description: `Publica un producto en Hotmart y devuelve el link de pago.
Úsalo cuando Eduardo tenga un producto listo y quiera ponerlo en venta en Hotmart.`,
    input_schema: {
      type: 'object',
      properties: {
        nombre:      { type: 'string', description: 'Nombre del producto' },
        descripcion: { type: 'string', description: 'Descripción breve del producto (máx 500 chars)' },
        precio:      { type: 'number', description: 'Precio en USD' },
      },
      required: ['nombre', 'descripcion', 'precio'],
    },
  },

  {
    name: 'ver_experimentos',
    description: `Muestra los experimentos de productos digitales activos.
Lista qué productos se están vendiendo, cuántas ventas tienen, y cuánto revenue generaron.
Úsalo cuando Eduardo pregunte "cómo van los productos", "cuánto hemos vendido", "qué experimentos tenemos".`,
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'Estado a filtrar: activo, escalado, muerto, extendido. Default: activo' },
      },
    },
  },

  {
    name: 'ver_producto',
    description: `Muestra los links de un producto digital específico: landing de ventas, URL del producto (lo que recibe el comprador), y Stripe.
Úsalo cuando Eduardo diga "muéstrame el producto", "ver qué recibe el cliente", "dame el link del curso", "revisa el producto X".`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID numérico del experimento' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name: 'generar_contenido_producto',
    description: `Genera el contenido del mini_curso o guía para un producto que no tiene contenido generado aún.
Úsalo cuando Eduardo diga "genera el contenido", "el producto no tiene contenido", "crea el curso", "genera el producto X".
También cuando ver_producto muestre "Sin contenido generado".`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID numérico del experimento' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name: 'pipeline_completo',
    description: `Pipeline completo de producto digital: busca nicho → genera producto → crea imagen de portada → lanza campaña en Meta Ads.
Todo en un solo comando. Tarda ~10 minutos porque genera el producto completo.
Úsalo cuando Eduardo diga "lanza todo", "haz el proceso completo", "busca nicho y lanza campaña", "arranca el pipeline", etc.
Si Eduardo menciona una idea o tema específico (ej: "ganar $1000 con IA", "fitness para latinos"), pásalo como enfoque.`,
    input_schema: {
      type: 'object',
      properties: {
        presupuesto: { type: 'number', description: 'Presupuesto diario en USD para la campaña de Meta Ads. Default: 10' },
        segmento:    { type: 'string', description: 'Segmento de Meta Ads. Default: emprendedor-principiante' },
        enfoque:     { type: 'string', description: 'Producto o idea EXACTA de Eduardo. Si menciona un producto específico (ej: "ganar $1000 con IA en 30 días"), pásalo aquí y el sistema lo construye SIN investigar alternativas.' },
      },
    },
  },

  // ── EMAIL MARKETING MASIVO ────────────────────────
  {
    name: 'ver_contactos',
    description: `Muestra el resumen de la lista de contactos por nicho: cuántos hay, cuántos activos, bajas y rebotados.
Úsalo cuando Eduardo pregunte "cuántos contactos tenemos", "cómo está la lista", "cuántos emails del nicho automotriz".`,
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'lanzar_campana_email',
    description: `Lanza una campaña de email marketing masivo a los contactos de un nicho.
Genera el email automáticamente con IA: asunto, cuerpo, oferta del producto, beneficios y link de la landing page.
Incluye pixel de tracking para medir aperturas y clicks.
Úsalo cuando Eduardo diga "manda campaña de email a los contactos automotriz sobre el curso X", "lanza email marketing a la lista", etc.`,
    input_schema: {
      type: 'object',
      properties: {
        nicho:          { type: 'string', description: 'Nicho de la lista: automotriz, digital, general, etc.' },
        nombre_producto: { type: 'string', description: 'Nombre del producto o experimento a promocionar' },
        objetivo:       { type: 'string', description: 'Qué lograr: vender, generar interés, ofrecer descuento, informar' },
        limite:         { type: 'number', description: 'Máximo de emails a enviar. Default: todos. Útil para pruebas.' },
      },
      required: ['nicho', 'nombre_producto', 'objetivo'],
    },
  },

  {
    name: 'ver_campanas_email',
    description: `Muestra las campañas de email enviadas con métricas: enviados, abiertos, clicks, tasa de apertura.
Úsalo cuando Eduardo pregunte "cómo van los emails", "qué tasa de apertura tuvo la campaña X".`,
    input_schema: { type: 'object', properties: {} },
  },

  // ── EMAIL MANUAL ──────────────────────────────────
  {
    name: 'enviar_email',
    description: `Redacta y envía un email personalizado a un cliente o cualquier dirección de correo.
Jarvis busca al cliente en el CRM si das nombre o teléfono, usa su historial para personalizar el mensaje, y lo envía desde hola@gananciasconai.com.
Si el cliente no está en el CRM, redacta según el objetivo que le indiques.
Úsalo cuando Eduardo diga:
- "manda un email a juan@gmail.com diciéndole X"
- "escríbele a María que su acceso está listo"
- "manda un email a todos los que compraron el curso"
- "envíale un email a Pedro ofreciéndole el descuento"
- "escríbele a [nombre] algo motivacional para que compre"`,
    input_schema: {
      type: 'object',
      properties: {
        para:          { type: 'string', description: 'Email del destinatario. Si no lo sabes, busca al cliente por nombre en el CRM primero.' },
        nombre:        { type: 'string', description: 'Nombre del destinatario para personalizar el saludo' },
        objetivo:      { type: 'string', description: 'Qué quieres lograr con el email: vender, informar, motivar, dar acceso, ofrecer descuento, etc.' },
        contexto_crm:  { type: 'string', description: 'Información del cliente del CRM: qué compró, estado, historial — para personalizar el mensaje' },
        asunto:        { type: 'string', description: 'Asunto del email. Si no se indica, Jarvis lo genera según el objetivo.' },
      },
      required: ['para', 'objetivo'],
    },
  },

  // ── SMS ───────────────────────────────────────────
  {
    name: 'enviar_sms',
    description: `Envía un SMS de texto a un número de teléfono específico.
Úsalo cuando Eduardo diga:
- "manda un SMS a Roberto al 786xxx diciéndole X"
- "mándale un texto a [nombre] que su cita es mañana"
- "envía un mensaje de texto a [número] sobre X"
El mensaje queda registrado en el historial del cliente en el CRM si existe.`,
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Número de teléfono del destinatario' },
        mensaje:  { type: 'string', description: 'Texto del SMS. Máximo 160 caracteres.' },
        nombre:   { type: 'string', description: 'Nombre del destinatario (opcional, para registrar en CRM)' },
      },
      required: ['telefono', 'mensaje'],
    },
  },

  {
    name: 'enviar_sms_masivo',
    description: `Envía SMS masivo a los contactos del CRM de un nicho específico.
Personaliza el mensaje con el nombre de cada contacto automáticamente.
Úsalo cuando Eduardo diga:
- "manda SMS a todos los del CRM de automotriz diciéndoles X"
- "envía texto a los clientes de lease-renewal sobre Y"
- "SMS masivo a los contactos de marketing"`,
    input_schema: {
      type: 'object',
      properties: {
        nicho:    { type: 'string', description: 'Nicho del CRM: lease-renewal, autos, marketing, digital, general, etc.' },
        mensaje:  { type: 'string', description: 'Template del mensaje. Usa {nombre} para personalizar. Máximo 160 chars.' },
        limite:   { type: 'number', description: 'Máximo de SMS a enviar. Útil para pruebas. Default: todos.' },
      },
      required: ['nicho', 'mensaje'],
    },
  },

  {
    name: 'rechazar_nicho',
    description: `Marca un nicho como rechazado para que el sistema lo evite en el futuro.
Úsalo cuando Eduardo diga "ese nicho no me gusta", "descarta ese", "no quiero ese tema", etc.`,
    input_schema: {
      type: 'object',
      properties: {
        nicho_json: { type: 'string', description: 'El JSON del nicho a rechazar (devuelto por investigar_nicho)' },
      },
      required: ['nicho_json'],
    },
  },

  // ── PORTAFOLIO DE PROYECTOS ───────────────────────
  {
    name: 'crear_proyecto',
    description: `Crea un nuevo proyecto en el portafolio de negocios de Nexus Labs.
Un proyecto es cualquier iniciativa que Eduardo quiere trackear: un nuevo nicho, un cliente importante, una campaña, una landing page.
Cada proyecto tiene su propio seguimiento de inversión, revenue, ROI, leads y estado.
Estados del ciclo de vida: idea → validando → testing → rentable → escalando | pausado | muerto.
Úsalo cuando Eduardo diga "crea un proyecto para X", "empieza a trackear X", "guarda esto como proyecto".`,
    input_schema: {
      type: 'object',
      properties: {
        nombre:      { type: 'string', description: 'Nombre del proyecto. Ej: "Curso Emprendedores", "Barbería Elite Cuts", "Dealer Hialeah"' },
        nicho:       { type: 'string', description: 'Nicho del proyecto: digital, automotriz, barberia, inmuebles, marketing, general' },
        tipo:        { type: 'string', description: 'Tipo: digital, cliente, servicio, campana. Default: digital' },
        objetivo:    { type: 'string', description: 'Meta específica: qué resultado se espera de este proyecto' },
        descripcion: { type: 'string', description: 'Descripción breve del proyecto' },
      },
      required: ['nombre'],
    },
  },

  {
    name: 'ver_portafolio',
    description: `Muestra el portafolio completo de proyectos con métricas: inversión, revenue, ROI y estado de cada uno.
Incluye ROI global del portafolio y alertas activas.
Úsalo cuando Eduardo pregunte "¿cómo van los proyectos?", "muéstrame el portafolio", "¿qué iniciativas tenemos activas?", "¿cuánto hemos ganado en total?".`,
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'Filtrar por estado: idea, validando, testing, rentable, escalando, pausado, muerto. Omitir para ver todos.' },
      },
    },
  },

  {
    name: 'ver_proyecto',
    description: `Muestra los detalles completos de un proyecto específico: métricas, historial de acciones de agentes, alertas activas, campañas y experimentos vinculados.
Úsalo cuando Eduardo pregunte "¿cómo va el proyecto X?", "¿qué pasó con el proyecto de barbería?", "muéstrame el historial del proyecto 3".`,
    input_schema: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Nombre parcial o número ID del proyecto. Ej: "barbería", "curso", "3"' },
      },
      required: ['buscar'],
    },
  },

  {
    name: 'actualizar_proyecto',
    description: `Actualiza un proyecto: cambia su estado en el ciclo de vida, registra ingresos o gastos, agrega notas, suma leads o ventas.
Úsalo cuando Eduardo diga:
- "marca el proyecto X como rentable"
- "el proyecto de barbería generó $500"
- "gastamos $200 en ads para el proyecto X"
- "anota en el proyecto X que cerró con Juan"
- "pausa el proyecto X"
- "el proyecto X consiguió 10 leads"`,
    input_schema: {
      type: 'object',
      properties: {
        buscar:    { type: 'string',  description: 'Nombre parcial o ID del proyecto a actualizar' },
        estado:    { type: 'string',  description: 'Nuevo estado: validando, testing, rentable, escalando, pausado, muerto' },
        revenue:   { type: 'number',  description: 'Revenue a sumar al proyecto en USD' },
        inversion: { type: 'number',  description: 'Inversión/gasto a sumar en USD' },
        leads:     { type: 'number',  description: 'Número de leads a sumar' },
        ventas:    { type: 'number',  description: 'Número de ventas a sumar' },
        notas:     { type: 'string',  description: 'Notas o anotación a guardar en el proyecto' },
      },
      required: ['buscar'],
    },
  },

  // ── VALIDATION AGENT ──────────────────────────────
  {
    name: 'iniciar_experimento',
    description: `Inicia un micro-experimento controlado de publicidad para validar una idea antes de escalar.
Lanza una campaña sandbox con $7/día durante 72 horas y mide si el CPL es rentable.
Úsalo cuando Eduardo diga "valida este segmento", "prueba esta idea", "quiero saber si funciona X antes de invertir más", etc.`,
    input_schema: {
      type: 'object',
      properties: {
        tipo:        { type: 'string', description: 'Tipo de experimento: segmento, copy, oferta. Default: segmento' },
        descripcion: { type: 'string', description: 'Descripción de lo que se quiere validar' },
        segmento:    { type: 'string', description: 'Segmento de Meta Ads a probar' },
        presupuesto: { type: 'number', description: 'Presupuesto diario en USD. Default: 7' },
      },
      required: ['descripcion'],
    },
  },

  {
    name: 'ver_resultado_experimento',
    description: `Verifica el resultado de un experimento de validación activo.
Consulta métricas reales (CPL, leads, CTR) y emite veredicto: validado, rechazado, o necesita más datos.
Úsalo cuando Eduardo pregunte "cómo va el experimento", "ya hay resultado del test", etc.`,
    input_schema: {
      type: 'object',
      properties: {
        experiment_id: { type: 'string', description: 'ID del experimento (lo recibiste al iniciarlo)' },
      },
      required: ['experiment_id'],
    },
  },

  {
    name: 'relanzar_producto',
    description: `Busca un producto digital YA CREADO por nombre o ID y lo publica con Stripe + campaña en Meta Ads.
ÚSALO SIEMPRE cuando Eduardo diga "go a [nombre del producto]", "lanza el que ya estaba", "publica el experimento X", "usa el producto existente", "relanza [nombre]".
NO uses pipeline_completo si Eduardo menciona un producto específico que ya existe — usa este primero.`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial del producto o ID numérico del experimento' },
        presupuesto: { type: 'number', description: 'Presupuesto diario Meta Ads en USD. Default: 10' },
        segmento:    { type: 'string', description: 'Segmento Meta Ads. Default: emprendedor-principiante' },
      },
      required: ['nombre_o_id'],
    },
  },
  // ── GOOGLE CALENDAR ───────────────────────────────
  {
    name: 'agendar_en_calendario',
    description: `Agrega un evento al Google Calendar de Eduardo.
Úsalo cuando Eduardo diga "agrégalo al calendario", "ponlo en mi agenda", "anota esa cita", o cuando alguien agenda una reunión/llamada importante.
Las citas con clientes se agregan automáticamente — este tool es para eventos que Eduardo menciona manualmente.`,
    input_schema: {
      type: 'object',
      properties: {
        titulo:       { type: 'string', description: 'Título del evento (ej: "Reunión con Carlos — propuesta landing")' },
        descripcion:  { type: 'string', description: 'Detalles del evento: quién, qué, contacto, notas' },
        fecha:        { type: 'string', description: 'Fecha y hora en lenguaje natural (ej: "mañana a las 3pm", "viernes a las 10am", "el martes")' },
        duracion_min: { type: 'number', description: 'Duración en minutos. Default: 60' },
      },
      required: ['titulo', 'fecha'],
    },
  },

  // ── MEMORIA PERSISTENTE ────────────────────────────
  {
    name: 'recordar',
    description: `Guarda algo importante en la memoria persistente de Jarvis.
Úsalo cuando Eduardo diga algo que quiere que no olvides, cuando aprendes algo relevante del negocio, o después de completar una acción importante.
Ejemplos:
- "recuerda que prefiero campañas de $10/día para probar primero"
- "guarda que SOS IRS está activo a $10/día"
- "el contacto de prueba de Eduardo es Jorge Martínez al 786-580-9908"`,
    input_schema: {
      type: 'object',
      properties: {
        titulo:      { type: 'string', description: 'Título corto descriptivo (máx 80 chars)' },
        contenido:   { type: 'string', description: 'Detalle completo de lo que se recuerda' },
        tipo:        { type: 'string', enum: ['hecho', 'preferencia', 'instruccion', 'objetivo', 'aprendizaje', 'proyecto', 'cliente', 'alerta'], description: 'Categoría de la memoria' },
        importancia: { type: 'number', description: 'Del 1 al 10. 10 = crítico, 5 = normal, 1 = trivial' },
      },
      required: ['titulo', 'contenido'],
    },
  },
  {
    name: 'ver_configuracion',
    description: 'Muestra los límites y configuración actual del sistema (presupuesto máximo, CPL objetivo, etc.). Úsalo cuando Eduardo pregunta "cuánto es el límite", "qué configuración tienes" o antes de proponer cambios de presupuesto.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'actualizar_configuracion',
    description: 'Actualiza un límite o parámetro del sistema. Úsalo cuando Eduardo dice "sube el límite a X", "cambia el CPL objetivo a Y", "pon el máximo en Z". Claves válidas: presupuesto_max_dia, limite_escalar_solo, limite_gasto_sin_lead, max_escalar_pct, cpl_objetivo.',
    input_schema: {
      type: 'object',
      properties: {
        clave: {
          type: 'string',
          description: 'Nombre del parámetro a cambiar',
          enum: ['presupuesto_max_dia', 'limite_escalar_solo', 'limite_gasto_sin_lead', 'max_escalar_pct', 'cpl_objetivo'],
        },
        valor: { type: 'number', description: 'Nuevo valor numérico' },
      },
      required: ['clave', 'valor'],
    },
  },
  {
    name: 'ver_memoria',
    description: 'Muestra todas las memorias activas de Jarvis. Úsalo cuando Eduardo pregunta qué recuerdas, o antes de tomar decisiones importantes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'olvidar',
    description: 'Desactiva una memoria específica por su ID. Úsalo cuando Eduardo dice "olvida eso", "eso ya no aplica" o quiere corregir algo que Jarvis recordó mal.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID de la memoria a desactivar (ver con ver_memoria)' },
      },
      required: ['id'],
    },
  },

  // ── TEST DE CREATIVOS ─────────────────────────────
  {
    name: 'test_creativos',
    description: `Lanza un test A/B barato para descubrir qué copy convierte mejor ANTES de invertir en serio.
Crea UNA campaña con 3 ad sets — cada uno usa un copy diferente (emocional, directo, urgencia).
Meta distribuye el presupuesto y en 3-7 días sabes cuál ganó.
Úsalo cuando Eduardo diga "prueba qué funciona mejor", "testea creativos", "quiero probar antes de escalar", "qué copy funciona para X", etc.
El analista reportará el ganador automáticamente. Ideal antes de lanzar con presupuesto grande.`,
    input_schema: {
      type: 'object',
      properties: {
        segmento:         { type: 'string', description: 'Segmento Meta: emprendedor-principiante, emprendedor-escalar, afiliado-hotmart, infoproductor, oferta-especial' },
        url_destino:      { type: 'string', description: 'URL de la landing page o link de Stripe donde va el tráfico' },
        nombre_producto:  { type: 'string', description: 'Nombre del producto (para generar copies relevantes con IA)' },
        nicho:            { type: 'string', description: 'Nicho o tema del producto (ej: "marketing digital", "fitness latinos", "IRS deudas")' },
        precio:           { type: 'number', description: 'Precio del producto en USD. Para hacer copies más específicos.' },
        presupuesto:      { type: 'number', description: 'Presupuesto diario total del test en USD. Se reparte en 3 ad sets. Default: 15 ($5/ad set/día)' },
      },
      required: ['segmento', 'url_destino'],
    },
  },

  // ── APRENDIZAJES DEL SISTEMA ──────────────────────
  {
    name: 'ver_aprendizajes',
    description: `Muestra lo que el sistema ha aprendido de campañas, llamadas, productos y ventas.
El sistema registra automáticamente qué funcionó y qué no en cada acción.
Úsalo cuando Eduardo diga "¿qué hemos aprendido?", "¿qué funciona?", "¿qué ha fallado?", "muéstrame los aprendizajes", "¿qué errores hemos cometido?".`,
    input_schema: {
      type: 'object',
      properties: {
        tipo:  { type: 'string', description: 'Filtrar por tipo: campana, llamada, producto, copy, imagen, nicho, precio, email' },
        dias:  { type: 'number', description: 'Días hacia atrás. Default: 30' },
        limite:{ type: 'number', description: 'Cuántos aprendizajes mostrar. Default: 15' },
      },
    },
  },

  // ── P&L REPORT ────────────────────────────────────
  {
    name: 'ver_pnl',
    description: `Muestra el P&L (ganancias y pérdidas) real del negocio: cuánto se gastó en Meta Ads, cuánto se ganó con Stripe y Hotmart, y cuál es la ganancia neta.
Incluye desglose por producto y ROI de cada campaña.
Úsalo cuando Eduardo diga "¿cuánto hemos ganado?", "¿cuánto hemos gastado?", "dame el P&L", "¿estamos ganando dinero?", "¿cuál es el ROI?".`,
    input_schema: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Días hacia atrás para el reporte. Default: 7' },
      },
    },
  },

  // ── ANUNCIOS DE META ───────────────────────────────
  {
    name: 'ver_anuncios',
    description: `Muestra los anuncios activos (o pausados) en Meta Ads con su copy, título e imagen.
Úsalo cuando Eduardo diga "¿qué anuncios tengo activos?", "muéstrame los ads", "¿qué copy estamos usando?", "¿cómo se ven los anuncios?", "¿qué creativos están corriendo?".`,
    input_schema: {
      type: 'object',
      properties: {
        solo_activos: { type: 'boolean', description: 'Si true (default), solo muestra anuncios activos. Si false, incluye pausados también.' },
      },
    },
  },

  // ── VENTAS STRIPE ──────────────────────────────────
  {
    name: 'ver_ventas_stripe',
    description: `Muestra las ventas recientes procesadas por Stripe: quién compró, qué producto, cuánto pagó y cuándo.
Úsalo cuando Eduardo diga "¿quién compró?", "¿tenemos ventas?", "muéstrame los pagos", "¿cuántas ventas en Stripe?", "ver compradores", "¿alguien pagó?".`,
    input_schema: {
      type: 'object',
      properties: {
        dias:   { type: 'number', description: 'Días hacia atrás. Default: 7' },
        limite: { type: 'number', description: 'Cuántas ventas mostrar. Default: 10' },
      },
    },
  },

  // ── AGENDA DE GOOGLE CALENDAR ──────────────────────
  {
    name: 'leer_agenda',
    description: `Lee los próximos eventos del Google Calendar de Eduardo para los próximos días.
Úsalo cuando Eduardo diga "¿qué tengo en la agenda?", "¿qué eventos tengo?", "¿cuándo es mi próxima cita?", "muéstrame mi calendario", "¿qué pasa esta semana?".`,
    input_schema: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Cuántos días hacia adelante ver. Default: 7' },
      },
    },
  },

  // ── TRANSCRIPCIONES DE LLAMADAS ────────────────────
  {
    name: 'ver_transcripciones',
    description: `Muestra la transcripción completa de las últimas llamadas que hizo Sofia a los leads.
Úsalo cuando Eduardo diga "¿qué dijo Sofia en la llamada?", "muéstrame la transcripción", "¿qué pasó en la llamada con [nombre]?", "¿qué objeciones puso el cliente?", "¿de qué hablaron?".`,
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Si se especifica, muestra la transcripción de la última llamada a ese número.' },
        limite:   { type: 'number', description: 'Si no hay teléfono, muestra las últimas N llamadas con transcripción. Default: 3' },
      },
    },
  },

  // ── LEADS PIPELINE ─────────────────────────────────
  {
    name: 'ver_leads',
    description: `Muestra el pipeline de leads: quién llegó, en qué estado están (NUEVO, LLAMADO, CITA, CERRADO) y cuándo.
Úsalo cuando Eduardo diga "¿qué leads tenemos?", "¿quién llegó hoy?", "muéstrame los leads nuevos", "¿cuántos leads tenemos?", "¿quién está en cita?", "ver pipeline".`,
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'Filtrar por estado: NUEVO, LLAMADO, CITA, CERRADO. Si no se da, muestra todos.' },
        limite: { type: 'number', description: 'Cuántos leads mostrar. Default: 15' },
      },
    },
  },

  // ── RESUMEN DE LLAMADAS DE SOFIA ───────────────────
  {
    name: 'ver_llamadas',
    description: `Muestra estadísticas y historial de las llamadas que hizo Sofia: total, cuántas contestaron, tasa de citas, últimas llamadas.
Úsalo cuando Eduardo diga "¿cuántas llamadas hizo Sofia?", "¿cómo van las llamadas?", "¿cuántos contestaron?", "ver historial de llamadas", "¿cuál es la tasa de respuesta?".`,
    input_schema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Cuántas llamadas recientes mostrar. Default: 10' },
      },
    },
  },

  // ── REACTIVAR CAMPAÑA ──────────────────────────────
  {
    name: 'reactivar_campana',
    description: `Reactiva (despausa) una campaña de Meta Ads que está pausada.
Úsalo cuando Eduardo diga "reactiva la campaña", "activa de nuevo [nombre]", "despausa [campaña]", "vuelve a activar [nombre]".`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID de la campaña a reactivar.' },
      },
      required: ['nombre_o_id'],
    },
  },

  // ── EXPERIMENTOS PAUSADOS CON CAUSA ───────────────
  {
    name: 'ver_experimentos_pausados',
    description: `Muestra los productos/experimentos pausados o muertos con la causa exacta de por qué se pausaron (error de configuración, sin datos, mal rendimiento, etc.).
Úsalo cuando Eduardo diga "¿qué productos pausamos?", "¿por qué se pausó [producto]?", "muéstrame los experimentos muertos", "¿cuáles podemos relanzar?".`,
    input_schema: {
      type: 'object',
      properties: {
        estados: { type: 'string', description: 'Estados a incluir separados por coma. Default: muerto,pausado' },
      },
    },
  },

  // ── AUDITORÍA COMPLETA DE PRODUCTO ─────────────────
  {
    name: 'auditar_producto',
    description: `Verifica que un producto esté completamente conectado end-to-end: landing accesible, botón Stripe en la landing, producto entregable al comprador, campaña Meta apuntando a la URL correcta.
Úsalo cuando Eduardo diga "verifica el producto", "¿está todo bien con [producto]?", "¿va a funcionar la venta?", "audita el producto", "¿qué está roto?", "revisa que esté todo conectado".`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID del producto/experimento a auditar.' },
      },
      required: ['nombre_o_id'],
    },
  },

  // ── REPARAR CONTENIDO DE PRODUCTO ──────────────────
  {
    name: 'reparar_contenido_producto',
    description: `Regenera y guarda el contenido del producto digital (el material que recibe el comprador) sin tocar Stripe ni crear nuevas campañas.
Úsalo cuando Eduardo diga "el producto no tiene contenido", "el acceso da error", "regenera el contenido del producto", "el /acceso/ da 404", "arregla el producto", "el comprador no puede ver el producto".`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID del producto a reparar.' },
      },
      required: ['nombre_o_id'],
    },
  },

  // ── TEST DE ENTREGA DE PRODUCTO ─────────────────────
  {
    name: 'test_entrega_producto',
    description: `Envía un email de prueba a Eduardo con el acceso al producto para verificar que Resend funciona y que el link de acceso lleva al producto correcto.
Úsalo cuando Eduardo diga "prueba el email de entrega", "verifica que el email llega", "mándate el producto de prueba", "¿llega el correo de confirmación?", "testea el email", "¿funciona Resend?".`,
    input_schema: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID del producto a probar. Si no se da, usa el experimento activo más reciente.' },
      },
    },
  },

  // ── CONTROL GRANULAR + CALIDAD + OPTIMIZACIÓN META ─
  {
    name: 'quality_scores',
    description: `Muestra el Quality Score de cada anuncio según Meta: calidad del ad, tasa de engagement, tasa de conversión.
Si Meta le da score bajo a tu anuncio, te cobra más y te da menos alcance.
Úsalo cuando Eduardo diga "¿por qué el CPM subió?", "¿Meta está penalizando mis ads?", "¿qué calidad tienen mis anuncios?", "quality score".`,
    input_schema: { type: 'object', properties: {
      campana: { type: 'string', description: 'Nombre parcial o ID. Si no se da, usa la de mayor gasto.' },
      periodo: { type: 'string', enum: ['last_7d', 'last_14d', 'last_30d'] },
    }},
  },
  {
    name: 'breakdown_dispositivo',
    description: `Muestra rendimiento mobile vs desktop: cuál gasta más, cuál convierte mejor, cuál tiene mejor CTR.
Crítico si la landing no está optimizada para móvil.
Úsalo cuando Eduardo diga "¿funciona en mobile?", "¿el problema es el teléfono?", "mobile vs desktop", "¿cuál dispositivo convierte?".`,
    input_schema: { type: 'object', properties: {
      campana: { type: 'string' },
      periodo: { type: 'string', enum: ['last_7d', 'last_14d', 'last_30d'] },
    }},
  },
  {
    name: 'breakdown_horario',
    description: `Muestra a qué horas del día convierten mejor los anuncios. Permite activar dayparting: correr ads solo en las horas rentables.
Úsalo cuando Eduardo diga "¿a qué hora convierten más?", "mejores horas para los ads", "dayparting", "¿cuándo hay más leads?".`,
    input_schema: { type: 'object', properties: {
      campana: { type: 'string' },
      periodo: { type: 'string', enum: ['last_7d', 'last_14d', 'last_30d'] },
    }},
  },
  {
    name: 'pausar_adset',
    description: `Pausa un adset específico sin tocar el resto de la campaña.
Úsalo cuando Eduardo diga "pausa el adset de hombres mayores", "detén ese segmento", "pausa el adset X".`,
    input_schema: { type: 'object', properties: {
      campana:      { type: 'string', description: 'Nombre parcial de la campaña' },
      nombre_adset: { type: 'string', description: 'Nombre parcial del adset a pausar' },
    }, required: ['nombre_adset'] },
  },
  {
    name: 'pausar_ad',
    description: `Pausa un anuncio específico sin tocar el adset ni la campaña.
Úsalo cuando Eduardo diga "pausa el anuncio de urgencia", "apaga ese creativo", "pausa el ad X".`,
    input_schema: { type: 'object', properties: {
      campana:    { type: 'string', description: 'Nombre parcial de la campaña' },
      nombre_ad:  { type: 'string', description: 'Nombre parcial del anuncio a pausar' },
    }, required: ['nombre_ad'] },
  },
  {
    name: 'refresh_creativo',
    description: `Detecta fatiga en los creativos de una campaña (frecuencia > 3.5) y genera un nuevo slideshow automáticamente para reemplazarlos.
Úsalo cuando Eduardo diga "rota los creativos", "la gente ya vio el anuncio", "refresca los ads", "hay fatiga en las campañas".`,
    input_schema: { type: 'object', properties: {
      campana: { type: 'string', description: 'Nombre parcial. Si no se da, revisa todas.' },
    }},
  },
  {
    name: 'analisis_breakeven',
    description: `Calcula el punto de break-even de las campañas: a qué CPL dejan de ser rentables, cuántas ventas necesitas para cubrir el gasto, y si el ROAS actual es suficiente.
Úsalo cuando Eduardo diga "¿estamos ganando dinero?", "¿cuándo es rentable?", "break-even", "¿a qué CPL conviene escalar?".`,
    input_schema: { type: 'object', properties: {
      precio_producto: { type: 'number', description: 'Precio del producto en USD. Si no se da, usa el configurado.' },
      periodo:         { type: 'string', enum: ['last_7d', 'last_14d', 'last_30d'] },
    }},
  },
  {
    name: 'escalar_escalera',
    description: `Escala una campaña al siguiente paso de la escalera de presupuesto ($10→$20→$40→$80→$150→$300) con validación de CPL antes de subir.
Nunca salta pasos para no quemar el algoritmo de Meta.
Úsalo cuando Eduardo diga "escala con cuidado", "súbele paso a paso", "escala en escalera", "siguiente nivel de presupuesto".`,
    input_schema: { type: 'object', properties: {
      campana: { type: 'string', description: 'Nombre parcial o ID de la campaña' },
    }, required: ['campana'] },
  },

  // ── BIBLIOTECA DE CREATIVOS Y AUDIENCIAS META ─────
  {
    name: 'ver_biblioteca_meta',
    description: `Muestra la biblioteca de videos e imágenes subidos a Meta Ads.
Úsalo cuando Eduardo diga:
- "¿qué videos tengo en Meta?"
- "muéstrame los creativos subidos"
- "¿qué imágenes hay en la cuenta?"
- "ver biblioteca de creativos"`,
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', description: 'videos, imagenes, o ambos (default: ambos)', enum: ['videos', 'imagenes', 'ambos'] },
      },
    },
  },

  {
    name: 'metricas_video',
    description: `Métricas específicas de video ads: vistas de 3 segundos, tasa de completado al 25%/50%/75%/100%, ThruPlay y costo por vista.
Úsalo cuando Eduardo diga:
- "¿cuántos ven el video completo?"
- "¿qué tan bien está funcionando el video?"
- "tasa de completado de los videos"
- "cuánto cuesta una vista de video"`,
    input_schema: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial o ID de la campaña. Si no se da, usa la de mayor gasto.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d', enum: ['last_7d', 'last_14d', 'last_30d'] },
      },
    },
  },

  {
    name: 'ver_audiencias',
    description: `Muestra todas las audiencias personalizadas de la cuenta Meta: compradores, visitantes, lookalikes.
Úsalo cuando Eduardo diga:
- "¿qué audiencias tenemos?"
- "muéstrame las audiencias"
- "¿tenemos lookalike?"
- "¿hay audiencias de retargeting?"`,
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'crear_audiencia_lookalike',
    description: `Crea una audiencia lookalike en Meta a partir de los compradores reales (Pixel Purchase) o leads existentes.
Es la herramienta más poderosa para escalar — Meta busca personas iguales a los que ya compraron.
Úsalo cuando Eduardo diga:
- "crea lookalike de compradores"
- "busca audiencias similares a los que compraron"
- "escala con lookalike"
- "crea una audiencia de personas similares"`,
    input_schema: {
      type: 'object',
      properties: {
        fuente:  { type: 'string', description: 'De dónde crear el lookalike: compradores, leads, visitantes. Default: compradores' },
        ratio:   { type: 'number', description: 'Tamaño del lookalike: 0.01 = 1% (más parecido, default), 0.05 = 5% (más amplio)' },
        pais:    { type: 'string', description: 'País. Default: US' },
      },
    },
  },

  {
    name: 'crear_retargeting',
    description: `Crea una audiencia de retargeting con los visitantes del sitio web que NO compraron.
Son personas que ya mostraron interés — son mucho más baratas de convertir que audiencia fría.
Úsalo cuando Eduardo diga:
- "crea retargeting de los que no compraron"
- "apunta a los que visitaron la landing"
- "quiero hacer remarketing"`,
    input_schema: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Ventana de retargeting en días. Default: 30' },
      },
    },
  },

  {
    name: 'duplicar_adset_ganador',
    description: `Duplica el Ad Set con mejor CPL de una campaña y lo lanza con más presupuesto.
Es la forma más rápida de escalar lo que ya funciona sin crear desde cero.
Úsalo cuando Eduardo diga:
- "duplica el adset que más convierte"
- "escala el segmento ganador"
- "dobla el mejor adset"
- "copia el que funciona y dale más presupuesto"`,
    input_schema: {
      type: 'object',
      properties: {
        campana:     { type: 'string', description: 'Nombre parcial o ID de la campaña. Si no se da, usa la de mayor gasto.' },
        presupuesto: { type: 'number', description: 'Presupuesto diario en USD para el adset duplicado. Default: doble del original.' },
        periodo:     { type: 'string', description: 'Período para determinar el ganador: last_7d (default), last_14d' },
      },
    },
  },

  {
    name: 'breakdown_geografico',
    description: `Muestra qué estados o regiones de USA están convirtiendo mejor y cuáles queman dinero.
Úsalo cuando Eduardo diga:
- "¿qué estado convierte más?"
- "¿dónde están los mejores leads?"
- "breakdown por región"
- "¿en qué estado debería concentrarme?"`,
    input_schema: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial o ID de la campaña. Si no se da, usa la de mayor gasto.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d', enum: ['last_7d', 'last_14d', 'last_30d'] },
      },
    },
  },

  {
    name: 'tendencia_campana',
    description: `Compara el rendimiento de una campaña esta semana vs la semana pasada: si el CPL está subiendo, bajando o estable.
Úsalo cuando Eduardo diga:
- "¿está mejorando la campaña?"
- "¿el CPL subió o bajó?"
- "¿cómo va vs la semana pasada?"
- "tendencia de las campañas"`,
    input_schema: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial o ID de la campaña. Si no se da, usa la de mayor gasto.' },
      },
    },
  },

  // ── AUDITORÍA DE CAMPAÑA META ────────────────────
  {
    name: 'auditar_campana_meta',
    description: `Audita una campaña de Meta Ads de extremo a extremo: verifica que esté activa y entregando, que los ads tengan URL válida, que la landing responda HTTP 200, que el copy sea específico al producto (no genérico), el quality score de Meta, y si hay fatiga de audiencia.
Úsalo cuando Eduardo diga:
- "¿se creó bien la campaña?"
- "audita la campaña X"
- "¿está funcionando el anuncio?"
- "¿el copy está bien para el producto?"
- "¿la landing está conectada?"
- "revisa que todo esté alineado en Meta"
- "¿qué tiene mal la campaña?"
- Si no se especifica campaña, audita la más reciente activa.`,
    input_schema: {
      type: 'object',
      properties: {
        campaign_id: {
          type: 'string',
          description: 'ID de la campaña en Meta. Si no se da, audita la campaña activa más reciente.',
        },
      },
    },
  },

  // ── INTELIGENCIA META ADS ─────────────────────────
  {
    name: 'diagnostico_meta',
    description: `Diagnóstico completo con IA de todas tus campañas de Meta Ads.
Analiza: gasto por campaña, CPL, adsets que queman dinero sin convertir, creativos que fallan, fatiga de audiencia, placement ineficiente, y comparativa con períodos anteriores.
Al final entrega recomendaciones concretas con números: qué pausar, qué escalar, qué cambiar.
Úsalo cuando Eduardo diga:
- "¿por qué no tengo ventas?"
- "¿qué está fallando en las campañas?"
- "analiza mis ads"
- "¿qué tengo que cambiar?"
- "dame un diagnóstico de Meta"
- "¿dónde se está yendo el dinero?"`,
    input_schema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          description: 'Período a analizar. Opciones: last_7d (default), last_14d, last_30d, yesterday, this_month',
          enum: ['last_7d', 'last_14d', 'last_30d', 'yesterday', 'this_month'],
        },
      },
    },
  },

  {
    name: 'metricas_adsets',
    description: `Muestra métricas de los Ad Sets (segmentos de audiencia) de una campaña específica.
Revela qué audiencia convierte mejor, cuál quema dinero, y cuál tiene CPL más bajo.
Úsalo cuando Eduardo diga:
- "¿qué audiencia está funcionando?"
- "¿qué adset está convirtiendo?"
- "muéstrame los segmentos de la campaña X"
- "¿qué audiencia pauso?"`,
    input_schema: {
      type: 'object',
      properties: {
        campana:  { type: 'string', description: 'Nombre parcial o ID de la campaña. Si no se da, analiza la campaña con más gasto.' },
        periodo:  { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d', enum: ['last_7d', 'last_14d', 'last_30d'] },
      },
    },
  },

  {
    name: 'metricas_anuncios',
    description: `Muestra qué anuncio (copy + imagen) está convirtiendo mejor dentro de una campaña.
Ordena los creativos de mejor a peor CPL para saber cuál duplicar y cuál apagar.
Úsalo cuando Eduardo diga:
- "¿qué copy está funcionando?"
- "¿qué anuncio convierte más?"
- "¿cuál creativo está ganando?"
- "muéstrame el rendimiento de los ads de la campaña X"`,
    input_schema: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial o ID de la campaña. Si no se da, usa la de mayor gasto.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d', enum: ['last_7d', 'last_14d', 'last_30d'] },
      },
    },
  },

  {
    name: 'breakdown_campana',
    description: `Desglose profundo de una campaña: demografía (edad+género), placement (Facebook vs Instagram vs Reels), y frecuencia (fatiga).
Úsalo cuando Eduardo diga:
- "¿qué edad está comprando?"
- "¿funciona mejor en Instagram o Facebook?"
- "¿en qué placement está convirtiendo?"
- "¿el anuncio está saturado?"
- "¿hay fatiga en mis ads?"
- "¿los reels están funcionando?"`,
    input_schema: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial o ID de la campaña. Si no se da, usa la de mayor gasto.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d', enum: ['last_7d', 'last_14d', 'last_30d'] },
      },
    },
  },

  // ── MODO AUTÓNOMO ─────────────────────────────────────
  {
    name: 'modo_autonomo',
    description: `Activa o desactiva el modo autónomo de Jarvis.
Cuando está ACTIVO, el sistema opera solo sin pedir aprobación:
- El Supervisor ejecuta TODAS sus decisiones (pausa, escala, refresh) sin esperar a Eduardo
- El Analista implementa el plan cada mañana sin botones de aprobación
- Solo se respetan los límites de riesgo hard-coded (nunca pasa $${BUSINESS?.presupuestoMaxDia || 30}/día)

Cuando está INACTIVO, el sistema vuelve al modo normal: propone y espera aprobación de Eduardo.

Úsalo cuando Eduardo diga:
- "toma el control autónomo"
- "opera solo de ahora en adelante"
- "modo jarvis activado"
- "gestiona todo tú solo"
- "apaga el modo autónomo"
- "vuelve a pedir permiso"
- "¿está el modo autónomo activo?"
- "¿estás operando solo?"`,
    input_schema: {
      type: 'object',
      properties: {
        accion: {
          type: 'string',
          description: 'activar o desactivar. Si Eduardo pregunta el estado, usa "estado".',
          enum: ['activar', 'desactivar', 'estado'],
        },
      },
      required: ['accion'],
    },
  },
];

// ── Inferir contexto de nicho desde el nombre del producto ─
// Usa Claude para derivar cliente_ideal, quick_win, etc. correctos
// en vez de usar defaults genéricos que mezclan temas
async function inferirContextoProducto(nombreProducto, nicho, tipo, precio) {
  try {
    const raw = await AnthropicConnector.completar({
      model:     'claude-haiku-4-5-20251001',
      maxTokens: 400,
      system:    'Responde SOLO con JSON válido, sin bloques de código ni explicaciones.',
      prompt: `Dado este producto digital para el mercado hispano en USA, infiere el contexto correcto.

Nombre del producto: ${nombreProducto}
Nicho: ${nicho}
Precio: $${precio}

Responde con este JSON exacto:
{
  "problema_que_resuelve": "El problema específico que resuelve en 1 oración",
  "cliente_ideal": "Quién es el cliente ideal en 1 oración específica",
  "quick_win": "El resultado concreto que puede lograr rápido",
  "puntos_de_venta": ["beneficio 1", "beneficio 2", "beneficio 3", "beneficio 4"]
}`,
    });
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch {
    return null;
  }
}

// ── Parser de fechas en español ────────────────────────
// Convierte texto libre como "mañana a las 3pm" o "el viernes a las 10am" a Date
// Devuelve un Date cuyas partes getHours/getDate/etc. representan hora ET (Miami)
// aunque el proceso corra en UTC — Google Calendar lo recibe sin el "Z" de UTC
function parsearFechaEspanol(texto) {
  if (!texto) return null;
  const txt  = texto.toLowerCase().trim();
  // ET = UTC-4 (EDT verano) — Miami. Sin depender de Intl que puede fallar en Railway
  const ahora = new Date(Date.now() - 4 * 60 * 60 * 1000);
  let fecha   = new Date(ahora);

  // ISO directo: "2026-05-10 15:00" o "2026-05-10T15:00"
  const isoMatch = texto.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
  if (isoMatch) {
    const d = new Date(isoMatch[0].replace(' ', 'T'));
    if (!isNaN(d)) return d;
  }

  // Formato US MM/DD/YYYY o M/D/YYYY — Eduardo está en Miami, usa formato americano
  const usMatch = texto.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (usMatch) {
    fecha.setFullYear(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
  }

  // Días relativos
  if (txt.includes('pasado mañana') || txt.includes('pasado manana')) {
    fecha.setDate(ahora.getDate() + 2);
  } else if (txt.includes('mañana') || txt.includes('manana')) {
    fecha.setDate(ahora.getDate() + 1);
  } else if (txt.includes('hoy')) {
    // sin cambio de día
  } else {
    // Días de la semana
    const diasMap = {
      lunes: 1, martes: 2, 'miércoles': 3, miercoles: 3,
      jueves: 4, viernes: 5, 'sábado': 6, sabado: 6, domingo: 0,
    };
    let hallado = false;
    for (const [nombre, numDia] of Object.entries(diasMap)) {
      if (txt.includes(nombre)) {
        const hoy  = ahora.getDay();
        let diff   = numDia - hoy;
        if (diff <= 0) diff += 7;
        fecha.setDate(ahora.getDate() + diff);
        hallado = true;
        break;
      }
    }
    // Mes + número: "mayo 10", "el 10 de mayo"
    if (!hallado) {
      const meses = {
        enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
        julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
      };
      for (const [nombre, numMes] of Object.entries(meses)) {
        if (txt.includes(nombre)) {
          const mDia = txt.match(/\b(\d{1,2})\b/);
          if (mDia) {
            fecha.setMonth(numMes, parseInt(mDia[1]));
            if (fecha < ahora) fecha.setFullYear(ahora.getFullYear() + 1);
          }
          break;
        }
      }
    }
  }

  // Hora — busca primero número con am/pm explícito, luego "a las X", luego cualquier número
  const AM_PM = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la tarde|tarde|de la noche|noche|de la ma[ñn]ana)/i;
  const A_LAS = /a\s+las?\s+(\d{1,2})(?::(\d{2}))?/i;
  let mHora = txt.match(AM_PM) || txt.match(A_LAS);

  if (mHora) {
    let h   = parseInt(mHora[1]);
    const m = parseInt(mHora[2] || '0');
    const p = (mHora[3] || '').toLowerCase();
    if ((p.includes('pm') || p.includes('tarde') || p.includes('noche')) && h < 12) h += 12;
    if ((p.includes('am') || p.includes('mañana') || p.includes('manana')) && h === 12) h = 0;
    if (!p && h < 12) {
      if (h >= 1 && h <= 5) h += 12;                        // 1-5 siempre PM
      else if (h >= 6 && ahora.getHours() >= 12) h += 12;   // 6-11: PM si estamos en tarde/noche
    }
    fecha.setHours(h, m, 0, 0);
  } else {
    fecha.setHours(10, 0, 0, 0); // default 10am
  }

  return isNaN(fecha) ? null : fecha;
}

// ── Implementaciones ───────────────────────────────────
export const TOOL_HANDLERS = {

  async llamar_con_contexto({ telefono, nombre = 'cliente', objetivo, nicho, datos_producto, contexto_extra }) {
    const res = await llamarConContexto({ telefono, nombre, objetivo, nicho, datos_producto, contextoExtra: contexto_extra });
    if (res?.ok === false) return `Llamada FALLIDA a ${nombre} (${telefono}). Error: ${res.error}`;
    return `Llamada iniciada a ${nombre} (${telefono}). Objetivo: ${objetivo}`;
  },

  async llamar_simple({ telefono, nombre, segmento = 'general' }) {
    const res = await llamarLead({ nombre, telefono, segmento });
    if (res === undefined || res?.ok === false) return `Llamada FALLIDA a ${nombre} (${telefono}).`;
    return `Llamada iniciada a ${nombre} (${telefono}).`;
  },

  async guardar_cliente(datos) {
    const cliente = await ClientDB.guardar(datos);
    return `Cliente ${cliente.nombre} guardado en CRM. Nicho: ${cliente.nicho}. Estado: ${cliente.estado}.`;
  },

  async ver_clientes({ buscar, nicho, estado, limit = 10 } = {}) {
    const lista = buscar
      ? (await ClientDB.buscar(buscar)).slice(0, limit)
      : await ClientDB.listar({ nicho, estado, limit });

    if (!lista.length) return 'No se encontraron clientes con esos criterios.';

    return lista.map(c => {
      const dp = c.datos_producto || {};
      const extra = [
        dp.tipo_auto         ? `Auto: ${dp.tipo_auto}` : null,
        dp.pago_actual        ? `Pago: $${dp.pago_actual}/mes` : null,
        dp.fecha_vencimiento  ? `Vence: ${dp.fecha_vencimiento}` : null,
      ].filter(Boolean).join(' | ');
      return `• ${c.nombre} — ${c.telefono} — ${c.nicho} — ${c.estado}${extra ? `\n  ${extra}` : ''}`;
    }).join('\n');
  },

  async programar_seguimiento({ telefono, nombre, nicho = 'general', motivo, fecha, accion = 'llamar' }) {
    // Resolver fecha relativa
    let fechaObj = new Date();
    if (!fecha || fecha === 'mañana') {
      fechaObj = new Date(Date.now() + 24 * 3600 * 1000);
    } else if (fecha.includes('días') || fecha.includes('dias')) {
      const dias = parseInt(fecha) || 3;
      fechaObj   = new Date(Date.now() + dias * 24 * 3600 * 1000);
    } else {
      fechaObj = new Date(fecha);
      if (isNaN(fechaObj)) fechaObj = new Date(Date.now() + 24 * 3600 * 1000);
    }

    const id = await FollowUpDB.programar({ telefono, nombre, nicho, motivo, fecha: fechaObj, accion });

    await ClientDB.guardar({ telefono, nombre, estado: ESTADOS_CRM.SEGUIMIENTO });

    return `Seguimiento programado para ${nombre} — ${fechaObj.toLocaleDateString('es-US')} — Acción: ${accion} — Motivo: ${motivo}`;
  },

  async ver_seguimientos() {
    const pendientes = await FollowUpDB.todos();
    if (!pendientes.length) return 'No hay seguimientos pendientes.';
    return pendientes.map(f => {
      const fecha = new Date(f.fecha_programada).toLocaleDateString('es-US');
      const vencido = new Date(f.fecha_programada) < new Date() ? ' ⚠️ VENCIDO' : '';
      return `• ${f.nombre} — ${f.telefono} — ${f.accion} — ${fecha}${vencido}\n  ${f.motivo}`;
    }).join('\n');
  },

  async resumen_crm() {
    const porNicho   = await ClientDB.resumenPorNicho();
    const total      = await ClientDB.total();
    const pendientes = (await FollowUpDB.pendientes()).length;

    if (total === 0) return 'CRM vacío — aún no hay clientes guardados.';

    const lineas = [`Total clientes: ${total}`, `Seguimientos vencidos: ${pendientes}`, ''];
    Object.entries(porNicho).forEach(([nicho, stats]) => {
      lineas.push(`${NICHOS[nicho] || nicho}: ${stats.total} clientes | ${stats.citas} citas | ${stats.cierres} cierres`);
    });
    return lineas.join('\n');
  },

  async crear_landing(datos) {
    const resultado = await construirLanding(datos);
    return `Landing creada para "${datos.nombre_negocio}". Archivo: ${resultado.url_relativa}`;
  },

  async crear_campana_ads({ segmento, presupuesto, slideshow = false, nombre_producto = null }) {
    const opts = { slideshow, nombreProducto: nombre_producto, nicho: segmento };
    const resultado = await crearCampana(segmento, presupuesto, opts);
    const tipo = slideshow ? '(video slideshow)' : '(imagen)';
    return `Campaña de leads creada ${tipo} para "${segmento}" con $${presupuesto}/día. ID: ${resultado.campaign_id}. Los leads llegarán al CRM automáticamente.`;
  },

  async lanzar_campana_producto({ segmento, url_destino, presupuesto, slideshow = false, nombre_producto = null }) {
    const opts = { slideshow, nombreProducto: nombre_producto, nicho: segmento };
    const resultado = await crearCampañaTrafico(segmento, url_destino, presupuesto, opts);
    const tipo = slideshow ? '(video slideshow)' : '(imagen)';
    return `Campaña de tráfico ${tipo} creada para "${segmento}" con $${presupuesto}/día.\nDestino: ${url_destino}\nID: ${resultado.campaign_id}\n${resultado.ads.length} ads activos.`;
  },

  async lanzar_campana_slideshow({ nombre_producto, segmento = 'emprendedor-principiante', presupuesto = 10, url_destino = null, nicho = null }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    await notif(
      `🎬 <b>Generando Slideshow Video</b>\n` +
      `📦 Producto: ${esc(nombre_producto)}\n` +
      `🎨 Generando 5 imágenes con DALL-E...\n` +
      `⏳ Esto tarda ~2 minutos`
    );

    const opts = { slideshow: true, nombreProducto: nombre_producto, nicho: nicho || segmento };
    let resultado;
    if (url_destino) {
      resultado = await crearCampañaTrafico(segmento, url_destino, presupuesto, opts);
    } else {
      resultado = await crearCampana(segmento, presupuesto, opts);
    }

    await LearningsDB.guardar({
      tipo: 'campana', contexto: `Slideshow lanzado: ${nombre_producto}`,
      accion: `lanzar_campana_slideshow $${presupuesto}/día — ${segmento}`,
      resultado: `Campaign ID: ${resultado.campaign_id}, ${resultado.ads.length} ads`,
      exito: true, tags: ['meta', 'slideshow', 'video'], relevancia: 7,
    }).catch(() => {});

    await notif(
      `✅ <b>Campaña Slideshow Activa</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 ${esc(nombre_producto)}\n` +
      `🎬 5 imágenes → video slideshow 10s\n` +
      `💰 $${presupuesto}/día | ${resultado.ads.length} ads activos\n` +
      `🆔 Campaign: ${resultado.campaign_id}\n` +
      (url_destino ? `🔗 Destino: ${url_destino}` : `📋 Tipo: Lead Gen (formulario nativo)`)
    );

    return `Campaña slideshow "${nombre_producto}" lanzada con $${presupuesto}/día. ${resultado.ads.length} ads activos. ID: ${resultado.campaign_id}.`;
  },

  async pausar_campana({ nombre_o_id }) {
    const campanas = await CampaignManager.buscarPorNombre(nombre_o_id);
    if (!campanas.length) return `No encontré campaña con "${nombre_o_id}".`;
    await CampaignManager.pausar(campanas[0].id);
    return `Campaña "${campanas[0].name}" pausada.`;
  },

  async ver_reporte() {
    return generarReporte();
  },

  async estado_sistema() {
    const [token, pagina, pixel, plan, conv, rev, crmTotal, seguim] = await Promise.all([
      MetaConnector.validarToken(),
      MetaConnector.get(`/${ENV.META_PAGE_ID}`, { fields: 'id,name' }).then(d => ({ ok: true, nombre: d.name })).catch(e => ({ ok: false, error: e.message })),
      MetaConnector.get(`/${ENV.META_PIXEL_ID}`, { fields: 'id,name' }).then(d => ({ ok: true, nombre: d.name })).catch(e => ({ ok: false, error: e.message })),
      PlansDB.hayPlanPendiente(),
      LeadsDB.resumenConversiones(),
      ConversionsDB.metricas(),
      ClientDB.total(),
      FollowUpDB.pendientes().then(p => p.length),
    ]);

    return [
      `Token Meta: ${token.ok ? '✅ válido' : `❌ inválido — ${token.error}`}`,
      `Página Meta: ${pagina.ok ? `✅ ${pagina.nombre}` : `❌ ID incorrecto — ${pagina.error}`}`,
      `Píxel Meta: ${pixel.ok ? `✅ ${pixel.nombre}` : `❌ ID incorrecto — ${pixel.error}`}`,
      `Plan pendiente: ${plan ? '⏳ sí' : '✅ ninguno'}`,
      `Leads totales: ${conv.total_leads} | Cierres: ${conv.cierres}`,
      `CRM: ${crmTotal} clientes | ${seguim} seguimientos vencidos`,
      rev.ventas > 0 ? `Revenue: $${rev.revenue}` : '',
      `Twilio SMS: ${process.env.TWILIO_ACCOUNT_SID ? '✅' : '❌ TWILIO_ACCOUNT_SID'} | ${process.env.TWILIO_AUTH_TOKEN ? '✅' : '❌ TWILIO_AUTH_TOKEN'} | ${process.env.TWILIO_SMS_FROM ? `✅ ${process.env.TWILIO_SMS_FROM}` : '❌ TWILIO_SMS_FROM'}`,
    ].filter(Boolean).join('\n');
  },

  async ejecutar_analista() {
    ejecutarAnalista().catch(console.error);
    return 'Analista ejecutándose. Plan llegará por Telegram en un momento.';
  },

  async ejecutar_supervisor() {
    ejecutarSupervisor().catch(console.error);
    return 'Supervisor ejecutándose. Revisando campañas ahora.';
  },

  async registrar_venta({ telefono, nombre, valor }) {
    await LeadsDB.marcarCerrado(telefono, valor || null);
    await ConversionsDB.registrarVenta({ telefono, nombre: nombre || telefono, valor: valor || 0, segmento: 'manual' });
    await ClientDB.guardar({ telefono, nombre: nombre || telefono, estado: ESTADOS_CRM.CERRADO });
    return `Venta registrada${valor ? ` por $${valor}` : ''} para ${nombre || telefono}.`;
  },

  async ver_historial_cliente({ buscar }) {
    const resultados = await ClientDB.buscar(buscar);
    if (!resultados.length) return `No encontré ningún cliente con "${buscar}".`;

    const cliente = resultados[0];
    const dp      = cliente.datos_producto || {};
    const lineas  = [
      `Cliente: ${cliente.nombre} — ${cliente.telefono}`,
      `Nicho: ${NICHOS[cliente.nicho] || cliente.nicho} | Estado: ${cliente.estado}`,
    ];

    if (Object.keys(dp).length) {
      const extras = Object.entries(dp)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      lineas.push(`Datos: ${extras}`);
    }

    if (cliente.notas) lineas.push(`Notas: ${cliente.notas}`);

    if (!cliente.historial?.length) {
      lineas.push('Sin interacciones registradas.');
    } else {
      lineas.push(`\nHistorial (${cliente.historial.length} interacciones):`);
      cliente.historial.slice(0, 8).forEach(h => {
        const fecha = new Date(h.fecha).toLocaleDateString('es-US');
        lineas.push(`  ${fecha} — ${h.tipo} — ${h.resultado}${h.notas ? ` — ${h.notas}` : ''}`);
      });
    }

    return lineas.join('\n');
  },

  async escalar_campana({ nombre_o_id, presupuesto_nuevo, porcentaje = 20 }) {
    const campanas = await CampaignManager.buscarPorNombre(nombre_o_id);
    if (!campanas.length) return `No encontré campaña con "${nombre_o_id}".`;

    const campana = campanas[0];

    if (presupuesto_nuevo) {
      await CampaignManager.cambiarPresupuesto(campana.id, presupuesto_nuevo);
      return `Campaña "${campana.name}" escalada a $${presupuesto_nuevo}/día.`;
    }

    // Escalar por porcentaje usando el método nativo
    const presupuestoActual = (campana.daily_budget || 500) / 100; // Meta guarda en centavos
    await CampaignManager.escalar(campana.id, presupuestoActual, porcentaje / 100);
    const nuevo = (presupuestoActual * (1 + porcentaje / 100)).toFixed(2);
    return `Campaña "${campana.name}" escalada +${porcentaje}%. Presupuesto: $${presupuestoActual} → $${nuevo}/día.`;
  },

  async aprobar_plan() {
    const plan = await PlansDB.cargar();
    if (!plan) return 'No hay ningún plan pendiente en este momento. Puedes ejecutar el analista para generar uno nuevo.';

    const resumen = [
      'Plan pendiente:',
      plan.pausar?.length  ? `  Pausar ${plan.pausar.length} campaña(s): ${plan.pausar.map(c => c.nombre).join(', ')}` : null,
      plan.escalar?.length ? `  Escalar ${plan.escalar.length} campaña(s): ${plan.escalar.map(c => `${c.nombre} → $${c.presupuesto_nuevo}/día`).join(', ')}` : null,
      plan.crear?.length   ? `  Crear ${plan.crear.length} campaña(s): ${plan.crear.map(c => `${c.segmento} $${c.presupuesto}/día`).join(', ')}` : null,
    ].filter(Boolean).join('\n');

    ejecutarPlan(plan).catch(console.error);
    await PlansDB.marcarEjecutado();

    return `${resumen}\n\nPlan aprobado y ejecutándose. Recibirás confirmación por Telegram cuando termine.`;
  },

  // ── MOTOR DE PRODUCTOS DIGITALES ──────────────────

  async investigar_nicho({ enfoque } = {}) {
    const msg = enfoque
      ? `🔍 <b>Researcher:</b> Buscando nichos de <b>${esc(enfoque)}</b> para el mercado hispano...`
      : '🔍 <b>Researcher:</b> Buscando el mejor nicho para el mercado hispano...';
    await TelegramConnector.notificar(msg).catch(() => {});
    const nicho = await investigarNicho(enfoque || null);
    await TelegramConnector.notificar(
      `✅ <b>Nicho encontrado — Score ${nicho.score}/100</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 <b>${nicho.nombre_producto}</b>\n` +
      `💡 ${nicho.subtitulo}\n` +
      `💵 Precio sugerido: $${nicho.precio}\n` +
      `🎯 Tipo: ${nicho.tipo}\n` +
      `👥 Audiencia: ${nicho.subgrupo_latino}\n` +
      `📢 Formato ad: ${nicho.formato_ad_recomendado}\n\n` +
      `🔥 <b>Razón:</b> ${nicho.razon}\n\n` +
      `¿Quieres que genere el producto? Dime: "genera el producto del nicho [nombre]"`
    ).catch(() => {});
    return JSON.stringify(nicho);
  },

  async generar_producto({ nicho_json, publicar_hotmart = false }) {
    let nicho;
    try {
      nicho = typeof nicho_json === 'string' ? JSON.parse(nicho_json) : nicho_json;
    } catch {
      return 'Error: nicho_json no es un JSON válido. Primero usa investigar_nicho.';
    }

    await TelegramConnector.notificar(`🏗️ <b>Generator:</b> Creando "${nicho.nombre_producto}"... Esto tarda 5-10 minutos.`).catch(() => {});

    const html = await generarProducto(nicho);

    // Guardar el HTML en un archivo temporal para que Eduardo lo pueda ver
    const fs = await import('fs');
    const path = await import('path');
    const dir  = path.resolve('/tmp');
    const file = path.join(dir, `producto_${Date.now()}.html`);
    fs.writeFileSync(file, html, 'utf8');

    let resultado = `✅ <b>Producto generado: "${nicho.nombre_producto}"</b>\n📄 ${html.length.toLocaleString()} caracteres de HTML premium\n\n`;

    // Crear experimento en DB
    const exp = await ExperimentsDB.crear({
      nicho:             nicho.nicho,
      nombre:            nicho.nombre_producto,
      tipo:              nicho.tipo,
      precio:            nicho.precio,
      contenidoProducto: html,
    });

    if (publicar_hotmart && HotmartConnector.disponible()) {
      try {
        const { hotmart_url } = await HotmartConnector.crearProducto({
          nombre:      nicho.nombre_producto,
          descripcion: nicho.subtitulo || nicho.problema_que_resuelve || '',
          precio:      nicho.precio,
        });
        if (exp?.id) {
          await ExperimentsDB.actualizarEstado(exp.id, 'activo',
            `Publicado en Hotmart: ${hotmart_url}`
          );
        }
        resultado += `🛒 <b>Publicado en Hotmart:</b> ${hotmart_url}\n`;
      } catch (err) {
        resultado += `⚠️ Hotmart falló: ${err.message}\n`;
      }
    } else if (publicar_hotmart) {
      resultado += `⚠️ Hotmart no configurado (HOTMART_CLIENT_ID/SECRET en .env)\n`;
    }

    resultado += `\nId experimento: ${exp?.id || 'no guardado'}\nSe monitorea automáticamente a las 72h.`;
    return resultado;
  },

  async publicar_con_stripe({ nicho_json, experimento_id = null }) {
    let nicho;
    try { nicho = typeof nicho_json === 'string' ? JSON.parse(nicho_json) : nicho_json; }
    catch { return 'JSON inválido. Primero usa investigar_nicho.'; }

    if (!StripeConnector.disponible()) {
      return '⚠️ STRIPE_SECRET_KEY no configurado. Agrega la variable en Railway y vuelve a intentarlo.';
    }

    // Si no recibimos ID, buscar el experimento existente por nombre para UPDATE en vez de INSERT
    // Evita crear filas duplicadas (una con contenido, otra con Stripe)
    if (!experimento_id && nicho.nombre_producto) {
      const { rows } = await query(
        `SELECT id FROM experiments
         WHERE nombre ILIKE $1 OR nombre ILIKE $2
         ORDER BY creado_en DESC LIMIT 1`,
        [`%${nicho.nombre_producto}%`, `${nicho.nombre_producto.slice(0, 40)}%`]
      ).catch(() => ({ rows: [] }));
      if (rows[0]?.id) {
        experimento_id = rows[0].id;
        console.log(`[Jarvis] publicar_con_stripe — vinculando a experimento existente #${experimento_id}`);
      }
    }

    const resultado = await publicarConStripe(nicho, null, experimento_id);
    const dominio   = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '[dominio Railway]';

    await TelegramConnector.notificar(
      `🛒 <b>Producto publicado con Stripe</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 ${nicho.nombre_producto}\n` +
      `💵 $${nicho.precio}\n` +
      `🌐 Landing: ${resultado.landing_url}\n` +
      `💳 Pago: ${resultado.stripe_payment_link}\n\n` +
      `Cuando alguien pague → recibe el producto por email automáticamente.`
    ).catch(() => {});

    return `Publicado. Landing: ${resultado.landing_url} | Stripe: ${resultado.stripe_payment_link}`;
  },

  async publicar_hotmart({ nombre, descripcion, precio }) {
    if (!HotmartConnector.disponible()) {
      return 'Hotmart no configurado. Agrega HOTMART_CLIENT_ID y HOTMART_CLIENT_SECRET en Railway.';
    }
    const { hotmart_url } = await HotmartConnector.crearProducto({ nombre, descripcion, precio });
    return `✅ Publicado en Hotmart: ${hotmart_url}`;
  },

  async ver_experimentos({ estado = 'activo' }) {
    const experimentos = await ExperimentsDB.listar(estado);
    if (!experimentos.length) return `No hay experimentos con estado "${estado}".`;
    const lineas = experimentos.map(e => {
      const m = e.metricas || {};
      return `• ${e.nombre} ($${e.precio}) | ${e.tipo} | Ventas: ${m.ventas || 0} | Revenue: $${m.revenue || 0} | ${e.estado}`;
    });
    return `Experimentos (${estado}):\n${lineas.join('\n')}`;
  },

  async ver_producto({ nombre_o_id }) {
    let exp = null;
    const id = parseInt(nombre_o_id);
    if (!isNaN(id)) {
      exp = await ExperimentsDB.obtener(id);
    } else {
      const lista = await ExperimentsDB.listar('activo');
      const found = lista.find(e => e.nombre.toLowerCase().includes(String(nombre_o_id).toLowerCase()));
      if (found?.id) exp = await ExperimentsDB.obtener(found.id);
    }
    if (!exp) return `No encontré producto con "${nombre_o_id}". Usa ver_experimentos para ver los disponibles.`;

    const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
    const accesoUrl  = exp.landing_slug ? `${dominio}/acceso/${exp.landing_slug}` : null;
    const landingUrl = exp.landing_slug ? `${dominio}/p/${exp.landing_slug}` : exp.producto_url || null;
    const tieneContenido = !!(exp.contenido_producto && exp.contenido_producto.length > 100);

    let respuesta = `📦 <b>${exp.nombre}</b>\n`;
    respuesta += `💵 Precio: $${exp.precio} | Tipo: ${exp.tipo}\n`;
    respuesta += `📊 Estado: ${exp.estado}\n`;
    respuesta += tieneContenido
      ? `✅ Contenido generado (${Math.round((exp.contenido_producto?.length || 0) / 1024)} KB)\n`
      : `⚠️ Sin contenido generado\n`;
    if (landingUrl) respuesta += `🌐 Landing de ventas: ${landingUrl}\n`;
    if (accesoUrl)  respuesta += `🎓 Producto (vista comprador): ${accesoUrl}\n`;
    if (exp.stripe_payment_link) respuesta += `💳 Stripe: ${exp.stripe_payment_link}\n`;

    await TelegramConnector.notificar(respuesta).catch(() => {});
    return respuesta;
  },

  async generar_contenido_producto({ nombre_o_id }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    let exp = null;
    const id = parseInt(nombre_o_id);
    if (!isNaN(id)) {
      exp = await ExperimentsDB.obtener(id);
    } else {
      const lista = await ExperimentsDB.listar('activo');
      const found = lista.find(e => e.nombre.toLowerCase().includes(String(nombre_o_id).toLowerCase()));
      if (found?.id) exp = await ExperimentsDB.obtener(found.id);
    }
    if (!exp) return `No encontré producto con "${nombre_o_id}".`;

    await notif(`⚡ <b>Generando contenido de "${esc(exp.nombre)}"...</b>\nEsto tarda ~3-4 minutos.`);

    const nicho = {
      nombre_producto:       exp.nombre,
      nicho:                 exp.nicho || exp.nombre,
      tipo:                  exp.tipo || 'mini_curso',
      precio:                exp.precio || 47,
      subtitulo:             exp.descripcion || 'Aprende a generar tus primeros ingresos digitales',
      subgrupo_latino:       'Latinos emprendedores en USA',
      cliente_ideal:         'Emprendedor hispano entre 25-45 años en USA que quiere ingresos digitales',
      problema_que_resuelve: 'No saber por dónde empezar a generar dinero online con IA',
      herramientas_clave:    ['ChatGPT (gratis)', 'Canva (gratis)', 'Gumroad (gratis)', 'Stripe ($0.30+2.9%)'],
      quick_win:             'Configurar tu primera herramienta de IA y crear un producto simple en 60 minutos',
      ejemplo_exito:         'Carlos, 32 años, Miami — generó $800 en su primer mes vendiendo prompts de ChatGPT',
      modulos_temas:         ['Fundamentos de IA para negocios', 'Crea tu primer producto digital', 'Vende sin audiencia previa', 'Automatiza y escala', 'Próximos pasos'],
    };

    const html = await generarProducto(nicho);
    await ExperimentsDB.actualizarContenido(exp.id, html);

    const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
    const accesoUrl = exp.landing_slug ? `${dominio}/acceso/${exp.landing_slug}` : null;

    await notif(
      `✅ <b>Contenido generado</b> (${Math.round(html.length / 1024)} KB)\n` +
      `📦 ${exp.nombre}\n` +
      (accesoUrl ? `🎓 Ver producto: ${accesoUrl}` : `⚠️ Sin slug — relanza con Stripe para activar URL`)
    );

    return `Contenido generado para "${exp.nombre}" — ${Math.round(html.length / 1024)} KB. ${accesoUrl ? `Acceso: ${accesoUrl}` : ''}`;
  },

  async relanzar_producto({ nombre_o_id, presupuesto = 10, segmento = 'emprendedor-principiante' }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    // Buscar experimento por ID o nombre
    let exp = null;
    const id = parseInt(nombre_o_id);
    if (!isNaN(id)) {
      exp = await ExperimentsDB.obtener(id);
    }
    if (!exp) {
      const lista = await ExperimentsDB.listar('activo');
      exp = lista.find(e => e.nombre.toLowerCase().includes(nombre_o_id.toLowerCase()));
    }
    if (!exp) {
      return `No encontré un producto con "${nombre_o_id}". Usa ver_experimentos para ver los disponibles.`;
    }

    await notif(`🔄 <b>Relanzando "${esc(exp.nombre)}"</b> (experimento #${exp.id})\n\nPaso 1/3 — Generando copies específicos del producto...`);

    // Paso 1: Copies específicos del producto
    let copies = null;
    try {
      copies = await generarCopiesParaProducto(exp.nombre, exp.nicho || exp.nombre, exp.precio || 27);
    } catch (err) {
      console.warn('[Relanzar] Copies fallaron, usando segmento genérico:', err.message);
    }

    // Inferir contexto específico del producto para que el generador no mezcle temas
    const ctx = await inferirContextoProducto(exp.nombre, exp.nicho || exp.nombre, exp.tipo || 'guia_pdf', exp.precio || 27);

    const nichoBasico = {
      nombre_producto:       exp.nombre,
      nicho:                 exp.nicho || exp.nombre,
      tipo:                  exp.tipo || 'guia_pdf',
      precio:                exp.precio || 27,
      problema_que_resuelve: ctx?.problema_que_resuelve || exp.nombre,
      subtitulo:             ctx?.quick_win || '',
      cliente_ideal:         ctx?.cliente_ideal || 'Inmigrante hispano en USA',
      quick_win:             ctx?.quick_win || 'Resultados desde el primer día',
      puntos_de_venta:       ctx?.puntos_de_venta || [],
    };

    // Paso 2: Stripe + contenido del producto
    let stripeInfo = null;
    let htmlProducto = exp.contenido_producto || null;
    if (StripeConnector.disponible()) {
      // Regenerar contenido si el experimento no lo tiene
      if (!htmlProducto || htmlProducto.length < 500) {
        await notif(`✅ Copies listos\n\nPaso 2/4 — Generando contenido del producto...`);
        try {
          htmlProducto = await generarProducto(nichoBasico);
        } catch (err) {
          console.warn('[Relanzar] Generar producto falló:', err.message);
          htmlProducto = null;
        }
      }
      await notif(`✅ Contenido listo\n\nPaso 3/4 — Publicando landing page con Stripe...`);
      try {
        stripeInfo = await publicarConStripe(nichoBasico, htmlProducto, exp.id);
      } catch (err) {
        console.warn('[Relanzar] Stripe falló:', err.message);
      }
    }

    // Paso 4: Campaña Meta — tráfico directo a Stripe si existe, sino leads
    await notif(`${stripeInfo ? '✅ Landing lista' : '⚠️ Sin Stripe'}\n\nPaso 4/4 — Lanzando campaña Meta Ads...`);

    let campaña;
    try {
      const imgOpts = { copies, nombreProducto: exp.nombre, nicho: exp.nicho || exp.nombre };
      if (stripeInfo?.landing_url) {
        campaña = await crearCampañaTrafico(segmento, stripeInfo.landing_url, presupuesto, imgOpts);
      } else {
        campaña = await crearCampana(segmento, presupuesto, imgOpts);
      }
    } catch (err) {
      return `❌ Meta Ads falló: ${err.message}\nProducto #${exp.id} guardado — intenta de nuevo cuando el token esté listo.`;
    }

    return `✅ Relanzado exitosamente:\n📦 ${exp.nombre}\n${stripeInfo ? `🌐 Landing: ${stripeInfo.landing_url}\n💳 Stripe: ${stripeInfo.stripe_payment_link}\n` : ''}📊 Campaña: ${campaña.nombre} (${stripeInfo ? 'tráfico directo' : 'formulario leads'})`;
  },

  async pipeline_completo({ presupuesto = 10, segmento = 'emprendedor-principiante', enfoque = null } = {}) {
    global._cancelarPipeline = false;
    const btnCancelar = TelegramConnector.teclado([[{ text: '🛑 Cancelar pipeline', callback_data: 'cancelar_pipeline' }]]);
    const notif = (m) => TelegramConnector.notificar(m, btnCancelar).catch(() => {});
    const checkCancelado = () => { if (global._cancelarPipeline) throw new Error('PIPELINE_CANCELADO'); };

    try {
      // Paso 1: Investigar nicho
      await notif(`🔍 <b>Pipeline iniciado</b>${enfoque ? `\n💡 Producto: ${enfoque}` : ''}\n\nPaso 1/4 — ${enfoque ? 'Construyendo producto exacto...' : 'Buscando el mejor nicho...'}`);
      let nicho;
      try {
        nicho = enfoque ? await construirNichoDesdeIdea(enfoque) : await investigarNicho();
      } catch (err) {
        await notif(`❌ <b>Pipeline falló en Paso 1</b> (investigar nicho)\n<code>${esc(err.message)}</code>`);
        throw err;
      }

      // Auto-crear proyecto en el portafolio
      let projectId = null;
      try {
        const proyecto = await ProjectsDB.crear({
          nombre:      nicho.nombre_producto,
          nicho:       nicho.nicho,
          tipo:        'digital',
          objetivo:    `Revenue con "${nicho.nombre_producto}" a $${nicho.precio} — Score ${nicho.score}/100`,
          descripcion: nicho.subtitulo || '',
        });
        projectId = proyecto?.id || null;
        if (projectId) {
          await ProjectsDB.actualizarEstado(projectId, 'validando', 'pipeline').catch(() => {});
        }
      } catch (err) {
        console.warn('[Pipeline] No pudo crear proyecto:', err.message);
      }

      checkCancelado();
      await notif(
        `✅ <b>Nicho encontrado — Score ${nicho.score}/100</b>\n` +
        `📦 ${nicho.nombre_producto}\n` +
        `💵 Precio sugerido: $${nicho.precio}\n` +
        (projectId ? `📂 Proyecto #${projectId} creado en portafolio\n` : '') +
        `\nPaso 2/4 — Generando producto digital...`
      );

      // Paso 2: Generar producto HTML
      let html;
      try {
        html = await generarProducto(nicho);
      } catch (err) {
        await notif(`❌ <b>Pipeline falló en Paso 2</b> (generar producto)\n<code>${esc(err.message)}</code>`);
        throw err;
      }

      const fs   = await import('fs');
      const path = await import('path');
      const file = path.join('/tmp', `producto_${Date.now()}.html`);
      fs.writeFileSync(file, html, 'utf8');

      const exp = await ExperimentsDB.crear({
        nicho:             nicho.nicho,
        nombre:            nicho.nombre_producto,
        tipo:              nicho.tipo,
        precio:            nicho.precio,
        contenidoProducto: html,
      });

      // Vincular experimento al proyecto y avanzar estado a testing
      if (projectId && exp?.id) {
        await ProjectsDB.linkearExperimento(projectId, exp.id).catch(() => {});
        await ProjectsDB.actualizarEstado(projectId, 'testing', 'pipeline', 'producto generado').catch(() => {});
      }

      checkCancelado();
      await notif(`✅ <b>Producto generado</b> (${(html.length / 1024).toFixed(0)} KB)\n\nPaso 3/5 — Creando imagen de portada con IA...`);

      // Paso 3: Imagen de portada (no fatal si falla)
      let imagenHash = null;
      try {
        const promptImagen = [
          `Professional ad image for: ${nicho.nombre_producto}.`,
          `Hispanic person solving a problem or achieving a goal, realistic photo style,`,
          `clean minimal background, NO TEXT, NO WORDS, NO LETTERS anywhere in the image,`,
          `cinematic lighting, 4k quality`,
        ].join(' ');
        const imagen = await generarYSubirImagen(promptImagen);
        imagenHash = imagen.hash;
        await TelegramConnector.notificarFoto(imagen.url, `🖼️ <b>Portada generada para "${nicho.nombre_producto}"</b>`).catch(() => {});
      } catch (err) {
        console.warn('[Pipeline] Imagen falló:', err.message);
      }

      checkCancelado();

      // Paso 4: Stripe primero — la campaña apunta al link de compra
      let stripeInfo = null;
      if (StripeConnector.disponible()) {
        await notif(`${imagenHash ? '✅ Imagen creada' : '⚠️ Sin imagen'}\n\nPaso 4/5 — Publicando landing page con Stripe...`);
        try {
          stripeInfo = await publicarConStripe(nicho, html, exp?.id);
          if (projectId && stripeInfo?.landing_url) {
            await ProjectsDB.registrarAccionAgente(projectId, 'stripe', 'landing_publicada', stripeInfo.landing_url).catch(() => {});
          }
        } catch (err) {
          await notif(`⚠️ Stripe falló: ${err.message}\nContinuando con formulario de leads...`);
        }
      } else {
        await notif(`${imagenHash ? '✅ Imagen creada' : '⚠️ Sin imagen'}\n\nPaso 4/5 — (Stripe no configurado, saltando...)`);
      }

      // Paso 4b: Copies específicos del producto
      let copies = null;
      try {
        copies = await generarCopiesParaProducto(nicho.nombre_producto, nicho.nicho, nicho.precio);
      } catch (err) {
        console.warn('[Pipeline] Copies fallaron, usando segmento genérico:', err.message);
      }

      checkCancelado();
      // Paso 5: Campaña Meta — tráfico directo a Stripe si existe, sino formulario de leads
      await notif(`${stripeInfo ? '✅ Landing lista' : '⚠️ Sin Stripe'}\n\nPaso 5/5 — Lanzando campaña Meta Ads ($${presupuesto}/día)...`);

      let campaña;
      try {
        const imgOpts = { copies, nombreProducto: nicho.nombre_producto, nicho: nicho.nicho };
        if (stripeInfo?.landing_url) {
          campaña = await crearCampañaTrafico(segmento, stripeInfo.landing_url, presupuesto, imgOpts);
        } else {
          campaña = await crearCampana(segmento, presupuesto, { imagenHash, ...imgOpts, stripeUrl: null });
        }
      } catch (err) {
        await notif(`❌ <b>Pipeline falló en Paso 5</b> (crear campaña Meta)\n<code>${esc(err.message)}</code>\n\nProducto ya guardado — puedes relanzar solo la campaña.`);
        throw err;
      }

      // Vincular campaña al proyecto y registrar inversión inicial
      if (projectId && campaña?.campaign_id) {
        await ProjectsDB.linkearCampana(projectId, campaña.campaign_id).catch(() => {});
        await ProjectsDB.actualizarMetricas(projectId, { inversion: presupuesto }, 'pipeline').catch(() => {});
      }

      const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
      const accesoUrl = stripeInfo?.slug ? `${dominio}/acceso/${stripeInfo.slug}` : null;
      const tipoCampaña = stripeInfo?.landing_url ? 'tráfico directo a página de compra' : 'formulario de leads';

      await notif(
        `🚀 <b>Pipeline completo</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 Producto: ${nicho.nombre_producto}\n` +
        `💵 Precio: $${nicho.precio} | Score: ${nicho.score}/100\n` +
        `📊 Campaña Meta: ${campaña.nombre}\n` +
        `🎯 Tipo: ${tipoCampaña}\n` +
        `💰 Presupuesto: $${presupuesto}/día\n` +
        `🖼️ Imagen: ${imagenHash ? 'portada específica ✅' : 'genérica del segmento'}\n` +
        (stripeInfo
          ? `🌐 Landing de ventas: ${stripeInfo.landing_url}\n` +
            `💳 Stripe checkout: ${stripeInfo.stripe_payment_link}\n` +
            (accesoUrl ? `🎓 <b>Producto (comprador recibe):</b> ${accesoUrl}\n` : '')
          : `⚠️ Stripe no configurado — agrega STRIPE_SECRET_KEY\n`) +
        `\nCuando alguien paga → recibe email con el link del producto automáticamente.`
      );

      return `Pipeline completo. Producto: "${nicho.nombre_producto}" | Campaña ID: ${campaña.campaign_id} | Tipo: ${tipoCampaña} | Landing: ${stripeInfo?.landing_url || 'sin Stripe'}`;

    } catch (err) {
      if (err.message === 'PIPELINE_CANCELADO') {
        global._cancelarPipeline = false;
        TelegramConnector.notificar('⛔ <b>Pipeline detenido</b>\n\n¿Por qué lo cancelaste? Cuéntame para no repetir el error.').catch(() => {});
        return 'Pipeline cancelado por el usuario.';
      }
      return `Pipeline abortado: ${err.message}`;
    }
  },

  async ver_contactos() {
    const resumen = await ContactsDB.resumen();
    if (!resumen.length) return 'No hay contactos importados aún. Cuando tengas el CSV dile a Jarvis "importa contactos".';
    const total = resumen.reduce((s, r) => s + parseInt(r.total), 0);
    const lineas = resumen.map(r =>
      `• ${r.nicho}: ${r.activos} activos | ${r.bajas} bajas | ${r.rebotados} rebotados`
    );
    return `📋 Total contactos: ${total}\n${lineas.join('\n')}`;
  },

  async lanzar_campana_email({ nicho, nombre_producto, objetivo, limite }) {
    if (!ResendConnector.disponible()) return '⚠️ RESEND_API_KEY no configurado.';

    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    // Buscar el producto en experimentos
    const experimentos = await ExperimentsDB.listar('activo');
    const exp = experimentos.find(e =>
      e.nombre.toLowerCase().includes(nombre_producto.toLowerCase())
    );

    const dominio   = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
    const landingUrl = exp?.landing_slug ? `${dominio}/p/${exp.landing_slug}` : null;
    const precio    = exp?.precio || null;

    // Cargar contactos del nicho
    const contactos = await ContactsDB.listarPorNicho(nicho, limite || 9999);
    if (!contactos.length) return `No hay contactos activos en el nicho "${nicho}". Importa la lista primero.`;

    await notif(
      `📧 <b>Campaña de email iniciada</b>\n` +
      `📂 Nicho: ${nicho} | ${contactos.length} contactos\n` +
      `📦 Producto: ${nombre_producto}\n` +
      `⏳ Generando contenido con IA...`
    );

    // Generar asunto y cuerpo con Claude
    const promptAsunto = `Genera SOLO el asunto de un email de marketing (máximo 9 palabras, en español, llamativo) para: ${objetivo} — producto: ${nombre_producto}. Solo el asunto.`;
    const asunto = await AnthropicConnector.completar({
      system: 'Eres un experto en email marketing para el mercado hispano en USA.',
      prompt: promptAsunto,
      maxTokens: 60,
    });

    const promptCuerpo = [
      `Redacta el cuerpo de un email de marketing en español para hispanos en USA.`,
      `Producto: ${nombre_producto}`,
      `Objetivo: ${objetivo}`,
      precio ? `Precio: $${precio}` : '',
      landingUrl ? `Link de compra: ${landingUrl}` : '',
      `El nicho de estos contactos es: ${nicho}`,
      `Instrucciones:`,
      `- Tono cercano, motivador y directo`,
      `- Entre 3 y 5 párrafos cortos`,
      `- Incluye los beneficios principales del producto`,
      `- Termina con un llamado a la acción claro${landingUrl ? ' con el link' : ''}`,
      `- NO incluyas saludo ni firma (el sistema los agrega)`,
      `- NO incluyas el asunto`,
    ].filter(Boolean).join('\n');

    const cuerpo = await AnthropicConnector.completar({
      system: 'Eres un experto en email marketing para el mercado hispano en USA.',
      prompt: promptCuerpo,
      maxTokens: 800,
    });

    // Crear registro de campaña
    const campaign = await EmailCampaignsDB.crear({
      nombre:        `${nombre_producto} → ${nicho}`,
      nicho,
      experiment_id: exp?.id || null,
      asunto,
      cuerpo,
      totalEnviados: contactos.length,
    });

    const dominioBase = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';

    // Enviar emails en lotes de 10 para no sobrecargar
    let enviados = 0;
    let errores  = 0;
    const LOTE   = 10;

    for (let i = 0; i < contactos.length; i += LOTE) {
      const lote = contactos.slice(i, i + LOTE);
      await Promise.allSettled(lote.map(async (c) => {
        try {
          const emailEnc = encodeURIComponent(c.email);
          const pixelUrl = `${dominioBase}/track/open/${campaign.id}/${emailEnc}`;

          // Agregar pixel de tracking y link trackeado al cuerpo
          const cuerpoTracking = landingUrl
            ? cuerpo.replace(landingUrl, `${dominioBase}/track/click/${campaign.id}/${emailEnc}?url=${encodeURIComponent(landingUrl)}`)
            : cuerpo;

          const cuerpoConPixel = cuerpoTracking + `\n<img src="${pixelUrl}" width="1" height="1" style="display:none">`;

          const bajaUrl = `${dominioBase}/baja/${emailEnc}`;
          const cuerpoFinal = cuerpoConPixel + `\n\nSi no deseas recibir más emails escríbenos a ${ENV.EMAIL_FROM || 'hola@gananciasconai.com'} con el asunto BAJA.`;

          const clickUrl = landingUrl
            ? `${dominioBase}/track/click/${campaign.id}/${emailEnc}?url=${encodeURIComponent(landingUrl)}`
            : (exp?.stripe_payment_link || null);
          const textoBtnCampaña = exp?.precio ? `🛒 Quiero acceder por $${exp.precio}` : '🛒 Quiero acceder ahora';

          await ResendConnector.enviarEmailManual({
            para:       c.email,
            nombre:     c.nombre,
            asunto,
            cuerpo:     cuerpoFinal,
            urlBoton:   clickUrl,
            textoBoton: textoBtnCampaña,
          });
          enviados++;
        } catch {
          errores++;
        }
      }));
      // Pausa entre lotes para respetar rate limits de Resend
      if (i + LOTE < contactos.length) await new Promise(r => setTimeout(r, 200));
    }

    await notif(
      `✅ <b>Campaña enviada</b>\n` +
      `📧 Enviados: ${enviados} | Errores: ${errores}\n` +
      `📊 Asunto: "${asunto}"\n` +
      `🔍 ID campaña: #${campaign.id} — usa "ver campañas email" para ver métricas`
    );

    return `Campaña #${campaign.id} enviada: ${enviados} emails de ${contactos.length} contactos. Asunto: "${asunto}".`;
  },

  async ver_campanas_email() {
    const campanas = await EmailCampaignsDB.listar();
    if (!campanas.length) return 'No hay campañas de email enviadas aún.';
    return campanas.map(c => {
      const apertura = c.total_enviados > 0
        ? ((c.total_abiertos / c.total_enviados) * 100).toFixed(1)
        : 0;
      const clicks = c.total_enviados > 0
        ? ((c.total_clicks / c.total_enviados) * 100).toFixed(1)
        : 0;
      return `• #${c.id} ${c.nombre}\n  📧 ${c.total_enviados} enviados | 👁 ${apertura}% apertura | 🖱 ${clicks}% clicks`;
    }).join('\n');
  },

  async enviar_email({ para, nombre, objetivo, contexto_crm, asunto }) {
    if (!ResendConnector.disponible()) return '⚠️ RESEND_API_KEY no configurado en Railway.';

    // Buscar cliente en CRM + detectar producto mencionado para el botón
    let contexto = contexto_crm || '';
    let urlBoton = null;
    let textoBoton = '🛒 Quiero acceso ahora';

    if (!contexto && nombre) {
      try {
        const resultados = await ClientDB.buscar(nombre);
        if (resultados.length) {
          const c = resultados[0];
          contexto = `Cliente: ${c.nombre} | Estado CRM: ${c.estado} | Nicho: ${c.nicho}${c.notas ? ` | Notas: ${c.notas}` : ''}`;
          if (!nombre) nombre = c.nombre;
        }
      } catch {}
    }

    // Detectar producto activo y extraer Stripe link para el botón
    try {
      const experimentos = await ExperimentsDB.listar('activo');
      const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
      // Buscar por nombre (cualquier palabra del producto en el objetivo)
      let exp = experimentos.find(e =>
        e.nombre.toLowerCase().split(' ').some(w => w.length > 4 && objetivo.toLowerCase().includes(w))
      );
      // Fallback: usar el experimento más reciente con Stripe link
      if (!exp) exp = experimentos.find(e => e.stripe_payment_link);
      if (!exp) exp = experimentos[0];

      if (exp?.stripe_payment_link) {
        urlBoton   = exp.stripe_payment_link;
        textoBoton = `🛒 Quiero acceder por $${exp.precio}`;
      } else if (exp?.landing_slug) {
        urlBoton   = `${dominio}/p/${exp.landing_slug}`;
        textoBoton = `🛒 Quiero acceder por $${exp.precio}`;
      }
    } catch {}

    // Redactar email con Claude
    const prompt = [
      `Redacta un email profesional y persuasivo en español para un negocio llamado "${ENV.EMAIL_FROM_NAME || 'Ganancias con AI'}".`,
      `Destinatario: ${nombre || 'cliente'}`,
      `Objetivo del email: ${objetivo}`,
      contexto ? `Contexto del cliente: ${contexto}` : '',
      `Instrucciones:`,
      `- Tono cálido, directo y motivador`,
      `- Sin emojis excesivos — máximo 1-2`,
      `- Entre 3 y 6 párrafos cortos`,
      `- El botón de acción lo agrega el sistema automáticamente — NO incluyas URLs ni links en el texto`,
      `- NO incluyas saludo inicial (lo agrega el sistema) ni firma (la agrega el sistema)`,
      `- Devuelve SOLO el cuerpo del email en texto plano, nada más`,
    ].filter(Boolean).join('\n');

    const asuntoFinal = asunto || await AnthropicConnector.completar({
      system: 'Eres un copywriter experto en email marketing en español.',
      prompt: `Genera SOLO el asunto de un email (máximo 8 palabras, en español) para este objetivo: ${objetivo}. Solo el asunto, sin comillas ni explicaciones.`,
      maxTokens: 50,
    }).catch(() => objetivo);

    const cuerpo = await AnthropicConnector.completar({
      system: 'Eres un copywriter experto en email marketing para el mercado hispano en USA.',
      prompt,
      maxTokens: 800,
    });

    await ResendConnector.enviarEmailManual({ para, nombre, asunto: asuntoFinal, cuerpo, urlBoton, textoBoton });

    await TelegramConnector.notificar(
      `📧 <b>Email enviado</b>\n` +
      `Para: ${nombre || para} (${para})\n` +
      `Asunto: ${asuntoFinal}\n` +
      `Objetivo: ${objetivo}`
    ).catch(() => {});

    return `Email enviado a ${nombre || para} (${para}). Asunto: "${asuntoFinal}".`;
  },

  async enviar_sms({ telefono, mensaje, nombre }) {
    // Diagnóstico exacto: leer process.env en tiempo real para ver qué falta
    const faltantes = [];
    if (!process.env.TWILIO_ACCOUNT_SID) faltantes.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN)  faltantes.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_SMS_FROM)    faltantes.push('TWILIO_SMS_FROM');
    if (faltantes.length) {
      return `⚠️ SMS no funcionará. Faltan estas variables en Railway: ${faltantes.join(', ')}`;
    }
    const res = await TwilioConnector.enviarSMS(telefono, mensaje);
    if (!res.ok) return `Error enviando SMS a ${nombre || telefono}: ${res.error}`;

    // Registrar en historial del cliente si existe
    try {
      const cliente = await ClientDB.obtener(telefono);
      if (cliente) {
        await ClientDB.registrarInteraccion(telefono, {
          tipo:      'sms',
          resultado: 'Enviado',
          notas:     mensaje.slice(0, 100),
        });
      }
    } catch {}

    await TelegramConnector.notificar(
      `💬 <b>SMS enviado</b>\n📱 ${nombre || telefono}\n📝 ${esc(mensaje.slice(0, 80))}${mensaje.length > 80 ? '…' : ''}`
    ).catch(() => {});

    return `SMS enviado a ${nombre || telefono} (${telefono}). Mensaje: "${mensaje.slice(0, 80)}${mensaje.length > 80 ? '…' : ''}".`;
  },

  async enviar_sms_masivo({ nicho, mensaje, limite }) {
    const faltantes = [];
    if (!process.env.TWILIO_ACCOUNT_SID) faltantes.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN)  faltantes.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_SMS_FROM)    faltantes.push('TWILIO_SMS_FROM');
    if (faltantes.length) {
      return `⚠️ SMS no funcionará. Faltan estas variables en Railway: ${faltantes.join(', ')}`;
    }
    const contactos = await ClientDB.listar({ nicho, limit: limite || 200 });
    if (!contactos.length) return `No hay contactos en el CRM con nicho "${nicho}".`;

    const conTelefono = contactos.filter(c => c.telefono);
    if (!conTelefono.length) return `Los contactos de "${nicho}" no tienen teléfono registrado.`;

    let enviados = 0, fallidos = 0;
    for (const c of conTelefono) {
      const texto = mensaje.replace(/\{nombre\}/gi, c.nombre || 'amigo');
      const res = await TwilioConnector.enviarSMS(c.telefono, texto);
      if (res.ok) {
        enviados++;
        try {
          await ClientDB.registrarInteraccion(c.telefono, {
            tipo: 'sms', resultado: 'Enviado', notas: texto.slice(0, 100),
          });
        } catch {}
      } else {
        fallidos++;
      }
      await new Promise(r => setTimeout(r, 1200)); // 1.2s entre SMS
    }

    await TelegramConnector.notificar(
      `💬 <b>SMS masivo completado</b>\n📊 Nicho: ${nicho}\n✅ Enviados: ${enviados} | ❌ Fallidos: ${fallidos}`
    ).catch(() => {});

    return `SMS masivo a "${nicho}": ${enviados} enviados, ${fallidos} fallidos de ${conTelefono.length} contactos.`;
  },

  async rechazar_nicho({ nicho_json }) {
    let nicho;
    try { nicho = typeof nicho_json === 'string' ? JSON.parse(nicho_json) : nicho_json; }
    catch { return 'JSON inválido. Pasa el nicho como objeto.'; }
    await ProductsMemoryDB.rechazarNicho(nicho);
    return `Nicho "${nicho.nicho || nicho}" rechazado y guardado en la blacklist. El sistema lo evitará en el futuro.`;
  },

  // ── PORTAFOLIO DE PROYECTOS ───────────────────────

  async crear_proyecto({ nombre, nicho = 'general', tipo = 'digital', objetivo = '', descripcion = '' }) {
    const proyecto = await ProjectsDB.crear({ nombre, nicho, tipo, objetivo, descripcion });
    if (!proyecto?.id) return `Proyecto "${nombre}" creado (sin DB — solo en memoria de la conversación).`;
    return (
      `Proyecto #${proyecto.id} creado: "<b>${nombre}</b>"\n` +
      `Nicho: ${nicho} | Tipo: ${tipo}\n` +
      (objetivo ? `🎯 Objetivo: ${objetivo}\n` : '') +
      `Estado: 💡 idea\n\n` +
      `Cuando avance, dime: "avanza el proyecto #${proyecto.id} a validando" o "el proyecto generó $X".`
    );
  },

  async ver_portafolio({ estado = null } = {}) {
    if (!estado) return ProjectsDB.resumenPortafolio();
    const proyectos = await ProjectsDB.listar({ estado });
    if (!proyectos.length) return `No hay proyectos con estado "${estado}".`;
    const emoji = { idea:'💡', validando:'🔍', testing:'🧪', rentable:'✅', escalando:'🚀', pausado:'⏸️', muerto:'💀' };
    const e = emoji[estado] || '📦';
    return `${e} <b>Proyectos en "${estado}"</b> (${proyectos.length}):\n` +
      proyectos.map(p => {
        const rev = parseFloat(p.revenue || 0).toFixed(0);
        const roi = p.roi !== null && p.roi !== undefined ? ` ROI:${p.roi}%` : '';
        return `  #${p.id} <b>${p.nombre}</b> — $${rev}${roi}`;
      }).join('\n');
  },

  async ver_proyecto({ buscar }) {
    const resultados = await ProjectsDB.buscar(buscar);
    if (!resultados.length) return `No encontré ningún proyecto con "${buscar}". Usa "ver portafolio" para ver todos.`;
    return ProjectsDB.formatear(resultados[0]);
  },

  async actualizar_proyecto({ buscar, estado, revenue, inversion, leads, ventas, notas }) {
    const resultados = await ProjectsDB.buscar(buscar);
    const proyecto   = resultados[0];
    if (!proyecto) return `No encontré ningún proyecto con "${buscar}". Usa "ver portafolio" para listar todos.`;

    const cambios = [];

    if (estado) {
      try {
        await ProjectsDB.actualizarEstado(proyecto.id, estado, 'jarvis');
        cambios.push(`Estado → ${EMOJI_ESTADO_MAP[estado] || ''}${estado}`);
      } catch (err) {
        return `⚠️ ${err.message}`;
      }
    }

    if (revenue || inversion || leads || ventas) {
      await ProjectsDB.actualizarMetricas(proyecto.id, {
        revenue:   revenue   || 0,
        inversion: inversion || 0,
        leads:     leads     || 0,
        ventas:    ventas    || 0,
      }, 'jarvis');
      if (revenue)   cambios.push(`+$${revenue} revenue`);
      if (inversion) cambios.push(`+$${inversion} invertido`);
      if (leads)     cambios.push(`+${leads} leads`);
      if (ventas)    cambios.push(`+${ventas} venta(s)`);
    }

    if (notas) {
      await ProjectsDB.actualizarNotas(proyecto.id, notas);
      cambios.push('notas guardadas');
    }

    if (!cambios.length) return `No se indicó qué actualizar en "${proyecto.nombre}". Especifica: estado, revenue, inversion, leads, ventas o notas.`;
    return `Proyecto "${proyecto.nombre}" actualizado: ${cambios.join(', ')}.`;
  },

  // ── VALIDATION AGENT ──────────────────────────────

  async iniciar_experimento({ tipo = 'segmento', descripcion, segmento, presupuesto = 7 }) {
    const exp = await validarIdea({ tipo, descripcion, segmento, presupuestoPrueba: presupuesto });
    return `Experimento iniciado (ID: ${exp.id}). Se corre por 72h con $${exp.presupuestoPrueba}/día. Recibirás el resultado por Telegram.`;
  },

  async ver_resultado_experimento({ experiment_id }) {
    const resultado = await verificarResultado(experiment_id);
    return (
      `Veredicto: ${resultado.veredicto} (${resultado.confianza}% confianza)\n` +
      `${resultado.razon}\n` +
      `Datos: $${resultado.datos?.spend || 0} gastados · ${resultado.datos?.leads || 0} leads\n` +
      `Siguiente paso: ${resultado.siguiente_paso}`
    );
  },

  async recordar({ titulo, contenido, tipo = 'hecho', importancia = 5 }) {
    const mem = await JarvisMemoryDB.guardar({ tipo, titulo, contenido, importancia });
    if (!mem) return '⚠️ No se pudo guardar (DATABASE_URL no configurado).';
    return `🧠 Guardado en memoria #${mem.id} [${tipo} · ${importancia}/10]: "${titulo}"`;
  },

  async ver_memoria() {
    const memorias = await JarvisMemoryDB.listar({ soloActivas: true });
    if (!memorias.length) return 'No tengo memorias guardadas aún.';
    const lineas = memorias.map(m =>
      `#${m.id} [${m.tipo} · ${m.importancia}/10] <b>${m.titulo}</b>\n   ${m.contenido}`
    );
    return `🧠 <b>Mi memoria (${memorias.length} entradas):</b>\n\n${lineas.join('\n\n')}`;
  },

  async olvidar({ id }) {
    await JarvisMemoryDB.desactivar(id);
    return `🗑️ Memoria #${id} desactivada.`;
  },

  async ver_configuracion() {
    const cfg = await SystemConfigDB.getAll();
    const lineas = Object.entries(cfg).map(([clave, { valor, descripcion }]) =>
      `• <b>${clave}</b>: <code>${valor}</code>\n  ${descripcion}`
    );
    return `⚙️ <b>Configuración del sistema</b>\n\n${lineas.join('\n\n')}`;
  },

  async actualizar_configuracion({ clave, valor }) {
    const anterior = await SystemConfigDB.get(clave);
    await SystemConfigDB.set(clave, valor);
    return `✅ <b>${clave}</b> actualizado: ${anterior} → <b>${valor}</b>\nEl cambio aplica de inmediato — sin necesidad de redesplegar.`;
  },

  async agendar_en_calendario({ titulo, fecha, duracion_min = 60, descripcion = '' }) {
    try {
      const inicio = parsearFechaEspanol(fecha);
      if (!inicio) return `⚠️ No pude entender la fecha "${fecha}". Intenta con algo como "mañana a las 3pm" o "el viernes a las 10am".`;

      const resultado = await GoogleCalendarConnector.crearEventoPersonalizado({
        titulo,
        descripcion,
        inicio,
        duracion_min,
      });

      if (!resultado) return `⚠️ Google Calendar no está configurado. Verifica GOOGLE_SERVICE_ACCOUNT_JSON en Railway.`;

      const horaStr = inicio.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
      const fechaStr = inicio.toLocaleDateString('es', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
      return `📅 Evento agendado: <b>${titulo}</b>\n🕐 ${fechaStr} a las ${horaStr} (${duracion_min} min)\n🔗 ${resultado.url || 'Ver en Google Calendar'}`;
    } catch (e) {
      return `❌ Error agendando evento: ${e.message}`;
    }
  },

  // ── TEST DE CREATIVOS ───────────────────────────────
  async test_creativos({ segmento, url_destino, nombre_producto = '', nicho = '', precio = 47, presupuesto = 15 }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    if (!segmento || !url_destino) return 'Necesito segmento y url_destino para crear el test.';

    const presupuestoDia = Math.max(9, presupuesto);

    await notif(
      `🧪 <b>Test de creativos iniciado</b>\n` +
      `🎯 ${segmento} → ${url_destino}\n` +
      `💰 $${presupuestoDia}/día — 3 ad sets (copies: emocional, directo, urgencia)\n` +
      `⏳ Generando copies con IA...`
    );

    // Generar 3 copies específicos del producto si se dan los datos
    let copies = null;
    if (nombre_producto || nicho) {
      try {
        copies = await generarCopiesParaProducto(nombre_producto || nicho, nicho || nombre_producto, precio);
        if (!Array.isArray(copies) || !copies.length) copies = null;
      } catch (err) {
        console.warn('[TestCreativos] Copies IA fallaron, usando copies genéricos del segmento:', err.message);
      }
    }

    let campaña;
    try {
      campaña = await crearCampañaTrafico(segmento, url_destino, presupuestoDia, { copies, nombreProducto: nombre_producto, nicho });
    } catch (err) {
      await notif(`❌ <b>Test falló al crear campaña</b>\n<code>${esc(err.message)}</code>`);
      return `Error creando test de creativos: ${err.message}`;
    }

    const adSetsCreados = campaña.ads?.length || 0;

    await notif(
      `✅ <b>Test A/B lanzado</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 Campaña: ${campaña.nombre}\n` +
      `🎯 ${adSetsCreados} ad sets activos (uno por copy)\n` +
      `💰 $${presupuestoDia}/día total\n` +
      `⏰ En 3-7 días el analista reporta el ganador\n\n` +
      `Cuando quieras ver cuál está ganando, dile a Jarvis "¿cuál va ganando el test?" y miro las métricas de la campaña ${campaña.campaign_id}.`
    );

    return `Test A/B lanzado. Campaña ID: ${campaña.campaign_id} | ${adSetsCreados} ad sets | $${presupuestoDia}/día. El analista reportará el ganador en 3-7 días.`;
  },

  // ── APRENDIZAJES ───────────────────────────────────
  async ver_aprendizajes({ tipo = null, dias = 30, limite = 15 } = {}) {
    const resumen  = await LearningsDB.resumen(dias);
    const ultimos  = await LearningsDB.consultar({ tipo, limite });

    if (!ultimos.length) {
      return `El sistema aún no tiene aprendizajes registrados. Se acumularán automáticamente con cada campaña, llamada y venta.`;
    }

    const lineasResumen = resumen.map(r =>
      `• ${r.tipo}: ${r.total} total (✅ ${r.exitosos} exitosos, ❌ ${r.fallidos} fallidos)`
    ).join('\n');

    const lineasUltimos = ultimos.map(l =>
      `${l.exito ? '✅' : '❌'} [${l.tipo}] ${l.accion}\n   → ${l.resultado}${l.hipotesis ? `\n   💡 ${l.hipotesis}` : ''}`
    ).join('\n\n');

    await TelegramConnector.notificar(
      `🧠 <b>Aprendizajes del Sistema (${dias} días)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${esc(lineasResumen)}\n\n` +
      `<b>Últimos ${ultimos.length} aprendizajes:</b>\n` +
      `${esc(lineasUltimos)}`
    );

    return `${ultimos.length} aprendizajes mostrados. El sistema aprende automáticamente de cada acción.`;
  },

  // ── ANUNCIOS DE META ───────────────────────────────
  async ver_anuncios({ solo_activos = true } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const ads = await MetaConnector.getAnuncios(solo_activos);
    if (!ads.length) {
      return solo_activos
        ? 'No hay anuncios activos en Meta en este momento.'
        : 'No hay anuncios (activos o pausados) en Meta.';
    }
    const lineas = ads.map(ad => [
      `• <b>${ad.nombre}</b> [${ad.estado}]`,
      ad.titulo !== '—'  ? `  📝 Título: ${ad.titulo}` : null,
      ad.copy   !== '—'  ? `  💬 Copy: ${ad.copy.slice(0, 100)}${ad.copy.length > 100 ? '…' : ''}` : null,
      ad.url_destino     ? `  🔗 URL: ${ad.url_destino}` : `  ⚠️ URL destino: no detectada`,
      ad.imagen_url      ? `  🖼️ Imagen: ${ad.imagen_url}` : null,
    ].filter(Boolean).join('\n'));

    const msg = `🖼️ <b>Anuncios en Meta (${ads.length})</b>\n━━━━━━━━━━━━━━━━━━━━━━\n${lineas.join('\n\n')}`;
    await notif(msg);
    return `${ads.length} anuncio(s) mostrado(s).`;
  },

  // ── VENTAS STRIPE ──────────────────────────────────
  async ver_ventas_stripe({ dias = 7, limite = 10 } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    if (!StripeConnector.disponible()) {
      return '⚠️ STRIPE_SECRET_KEY no configurado. Agrega la variable en Railway.';
    }
    const desdeTs = Math.floor(Date.now() / 1000) - dias * 24 * 60 * 60;
    const sesiones = await StripeConnector.getSesionesPagadas(desdeTs);
    if (!sesiones.length) {
      return `Sin ventas en Stripe en los últimos ${dias} días.`;
    }
    const top = sesiones.slice(0, limite);
    const revenue = sesiones.reduce((s, v) => s + (v.amount_total || 0) / 100, 0);
    const lineas = top.map(v => {
      const fecha  = new Date(v.created * 1000).toLocaleDateString('es-US');
      const monto  = `$${((v.amount_total || 0) / 100).toFixed(2)}`;
      const nombre = v.customer_details?.name  || '—';
      const email  = v.customer_details?.email || '—';
      return `• ${fecha} — ${nombre} (${email})\n  💵 ${monto}`;
    });
    const msg =
      `💳 <b>Ventas Stripe — Últimos ${dias} días</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total: ${sesiones.length} ventas | Revenue: $${revenue.toFixed(2)}\n\n` +
      lineas.join('\n\n');
    await notif(msg);
    return `${top.length} ventas mostradas. Revenue total: $${revenue.toFixed(2)}.`;
  },

  // ── AGENDA GOOGLE CALENDAR ─────────────────────────
  async leer_agenda({ dias = 7 } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const eventos = await GoogleCalendarConnector.leerEventos(dias);
    if (!eventos.length) {
      return `No tienes eventos en los próximos ${dias} días en Google Calendar.`;
    }
    const lineas = eventos.map(e => {
      const inicio = e.inicio
        ? new Date(e.inicio).toLocaleString('es-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })
        : '—';
      return `📅 <b>${e.titulo}</b>\n  🕐 ${inicio}${e.descripcion ? `\n  📝 ${e.descripcion.slice(0, 80)}` : ''}`;
    });
    const msg = `📆 <b>Agenda — Próximos ${dias} días (${eventos.length} eventos)</b>\n━━━━━━━━━━━━━━━━━━━━━━\n${lineas.join('\n\n')}`;
    await notif(msg);
    return `${eventos.length} evento(s) en los próximos ${dias} días.`;
  },

  // ── AUDITORÍA COMPLETA DE PRODUCTO ─────────────────
  async auditar_producto({ nombre_o_id }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const checks = [];
    const ok  = (label, detalle = '') => checks.push({ ok: true,  label, detalle });
    const err = (label, detalle = '') => checks.push({ ok: false, label, detalle });
    const warn = (label, detalle = '') => checks.push({ ok: null,  label, detalle });

    // 1. Encontrar el experimento — obtener() trae SELECT * (incluye slug, stripe, landing_html, contenido)
    let exp = null;
    const id = parseInt(nombre_o_id);
    if (!isNaN(id)) {
      exp = await ExperimentsDB.obtener(id);
    } else {
      const buscarPorNombre = async (estado) => {
        const lista = await ExperimentsDB.listar(estado);
        const match = lista.find(e => e.nombre.toLowerCase().includes(String(nombre_o_id).toLowerCase()));
        return match ? ExperimentsDB.obtener(match.id) : null;
      };
      exp = await buscarPorNombre('activo')
         || await buscarPorNombre('muerto')
         || await buscarPorNombre('extendido');
    }

    if (!exp) {
      return `No encontré producto con "${nombre_o_id}". Usa ver_experimentos para ver los disponibles.`;
    }

    const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : null;

    // CHECK 1: Landing slug
    if (exp.landing_slug) ok('Landing slug', exp.landing_slug);
    else err('Landing slug', 'Sin slug — la landing no tiene URL propia');

    // CHECK 2: Stripe payment link
    if (exp.stripe_payment_link) ok('Stripe link', exp.stripe_payment_link);
    else err('Stripe link', 'Sin Stripe — los usuarios no pueden pagar');

    // CHECK 3: Landing HTML
    if (exp.landing_html && exp.landing_html.length > 500) ok('Landing HTML generada', `${Math.round(exp.landing_html.length / 1024)} KB`);
    else err('Landing HTML', 'Sin HTML de landing — la página de ventas no existe');

    // CHECK 4: Stripe link dentro del HTML de la landing
    if (exp.landing_html && exp.stripe_payment_link && exp.landing_html.includes(exp.stripe_payment_link)) {
      ok('Stripe embebido en landing', 'El botón de compra apunta al checkout correcto');
    } else if (exp.landing_html && exp.stripe_payment_link) {
      err('Stripe embebido en landing', 'El HTML de la landing NO contiene el link de Stripe — el botón de compra está roto');
    } else {
      warn('Stripe embebido en landing', 'No se puede verificar sin landing HTML o Stripe link');
    }

    // CHECK 5: Landing accesible via HTTP
    if (dominio && exp.landing_slug) {
      const landingUrl = `${dominio}/p/${exp.landing_slug}`;
      try {
        const res = await fetch(landingUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
        if (res.ok) ok('Landing accesible', `${landingUrl} → ${res.status}`);
        else err('Landing accesible', `${landingUrl} → HTTP ${res.status}`);
      } catch (e) {
        err('Landing accesible', `No responde: ${e.message}`);
      }
    } else {
      warn('Landing accesible', dominio ? 'Sin slug' : 'RAILWAY_DOMAIN no configurado');
    }

    // CHECK 6: Producto (acceso comprador) accesible
    if (dominio && exp.landing_slug) {
      const accesoUrl = `${dominio}/acceso/${exp.landing_slug}`;
      try {
        const res = await fetch(accesoUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
        if (res.ok) ok('Producto entregable', `${accesoUrl} → ${res.status}`);
        else err('Producto entregable', `${accesoUrl} → HTTP ${res.status} — el comprador no puede acceder al producto`);
      } catch (e) {
        err('Producto entregable', `No responde: ${e.message}`);
      }
    } else {
      warn('Producto entregable', 'No se puede verificar sin dominio o slug');
    }

    // CHECK 7: Contenido del producto generado
    if (exp.contenido_producto && exp.contenido_producto.length > 10000) {
      ok('Contenido del producto', `${Math.round(exp.contenido_producto.length / 1024)} KB generados`);
    } else if (exp.contenido_producto) {
      warn('Contenido del producto', `Solo ${exp.contenido_producto.length} caracteres — puede estar incompleto`);
    } else {
      err('Contenido del producto', 'Sin contenido — el comprador recibirá una página vacía');
    }

    // CHECK 8: Campaña Meta apuntando al producto
    try {
      const campanas = await MetaConnector.getCampanas(false); // activas + pausadas
      const landingUrl = dominio && exp.landing_slug ? `${dominio}/p/${exp.landing_slug}` : null;
      const campañasProducto = [];

      for (const c of campanas) {
        const nombreMatch = exp.nombre && c.name.toLowerCase().includes(exp.nombre.toLowerCase().slice(0, 15));
        campañasProducto.push({ nombre: c.name, estado: c.effective_status, match: nombreMatch });
      }

      const activas = campañasProducto.filter(c => c.estado === 'ACTIVE');
      const conMatch = campañasProducto.filter(c => c.match);

      if (conMatch.length > 0) {
        ok('Campaña Meta vinculada', conMatch.map(c => `${c.nombre} [${c.estado}]`).join(', '));
      } else if (activas.length > 0) {
        warn('Campaña Meta vinculada', `Hay ${activas.length} campaña(s) activa(s) pero ninguna tiene el nombre del producto — verifica que apunten a: ${landingUrl || exp.stripe_payment_link || 'la landing'}`);
      } else {
        warn('Campaña Meta vinculada', 'No se encontró campaña activa para este producto');
      }
    } catch (e) {
      warn('Campaña Meta', `No se pudo verificar: ${e.message}`);
    }

    // Generar reporte final
    const pasaron = checks.filter(c => c.ok === true).length;
    const fallaron = checks.filter(c => c.ok === false).length;
    const alertas  = checks.filter(c => c.ok === null).length;
    const total    = checks.length;

    const EMOJI = { true: '✅', false: '❌', null: '⚠️' };
    const lineas = checks.map(c => `${EMOJI[String(c.ok)]} <b>${c.label}</b>${c.detalle ? `\n   ${c.detalle}` : ''}`);

    const estado = fallaron === 0 ? '🟢 LISTO PARA VENDER' : `🔴 ${fallaron} PROBLEMA(S) CRÍTICO(S)`;
    const msg =
      `🔍 <b>Auditoría — ${esc(exp.nombre)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${estado}\n` +
      `✅ ${pasaron}/${total} checks | ❌ ${fallaron} errores | ⚠️ ${alertas} alertas\n\n` +
      lineas.join('\n\n');

    await notif(msg);

    if (fallaron === 0) {
      return `Producto "${exp.nombre}" — ${pasaron}/${total} checks OK. Listo para vender.`;
    }
    const errores = checks.filter(c => c.ok === false).map(c => `${c.label}: ${c.detalle}`).join('; ');
    return `Producto "${exp.nombre}" — ${fallaron} problema(s) crítico(s): ${errores}`;
  },

  // ── LEADS PIPELINE ─────────────────────────────────
  async ver_leads({ estado = null, limite = 15 } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const leads = await LeadsDB.listar({ estado, limit: limite });
    if (!leads.length) {
      return estado ? `No hay leads con estado "${estado}".` : 'No hay leads registrados aún.';
    }
    const resumen = await LeadsDB.resumenConversiones();
    const cabecera =
      `👥 Total: ${resumen.total_leads} leads | ` +
      `📞 Llamados: ${resumen.llamados || 0} | ` +
      `🗓 Citas: ${resumen.citas || 0} | ` +
      `✅ Cerrados: ${resumen.cierres || 0}`;

    const EMOJI = { NUEVO: '🆕', LLAMADO: '📞', CITA: '🗓', CERRADO: '✅', FRIO: '🧊', TIBIO: '🌡', CALIENTE: '🔥' };
    const lineas = leads.map(l => {
      const fecha = new Date(l.creado_en).toLocaleDateString('es-US');
      const est   = EMOJI[l.estado] || '•';
      const score = EMOJI[l.score]  || '';
      return `${est}${score} <b>${l.nombre || '—'}</b> — ${l.telefono}\n  ${l.segmento || 'sin segmento'} | ${fecha}${l.dia_cita ? ` | Cita: ${l.dia_cita}` : ''}`;
    });

    const msg = `📋 <b>Pipeline de Leads</b>\n${cabecera}\n━━━━━━━━━━━━━━━━━━━━━━\n${lineas.join('\n\n')}`;
    await notif(msg);
    return `${leads.length} leads mostrados.`;
  },

  // ── RESUMEN DE LLAMADAS DE SOFIA ───────────────────
  async ver_llamadas({ limite = 10 } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const [stats, ultimas] = await Promise.all([
      CallsDB.resumen(),
      CallsDB.listar({ limit: limite }),
    ]);

    const cabecera = [
      `📞 <b>Llamadas de Sofia</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Total: ${stats.total} | Contestaron: ${stats.contestadas} | Sin respuesta: ${stats.sin_respuesta}`,
      `Citas agendadas: ${stats.citas_agendadas} | Tasa respuesta: ${stats.tasa_respuesta}% | Conversión: ${stats.tasa_conversion}%`,
    ].join('\n');

    const ICONOS = { ended: '✅', 'no-answer': '📵', busy: '📵', failed: '❌', voicemail: '📬', 'customer-ended-call': '✅', 'assistant-ended-call': '✅' };
    const lineas = ultimas.map(c => {
      const fecha = new Date(c.llamada_en).toLocaleDateString('es-US');
      const icono = ICONOS[c.razon_fin] || '📞';
      return `${icono} ${c.nombre} — ${c.telefono}\n  ${fecha} | ${c.duracion_s || 0}s${c.cita ? ' | 🗓 CITA' : ''}`;
    });

    const msg = `${cabecera}\n\n<b>Últimas ${ultimas.length}:</b>\n${lineas.join('\n\n')}`;
    await notif(msg);
    return `Stats: ${stats.total} llamadas, ${stats.citas_agendadas} citas, ${stats.tasa_respuesta}% tasa de respuesta.`;
  },

  // ── REACTIVAR CAMPAÑA ──────────────────────────────
  async reactivar_campana({ nombre_o_id }) {
    const campanas = await CampaignManager.buscarPorNombre(nombre_o_id);
    if (!campanas.length) return `No encontré campaña con "${nombre_o_id}". Usa ver_reporte para ver todas las campañas.`;
    const campana = campanas[0];
    await CampaignManager.activar(campana.id);
    await TelegramConnector.notificar(`▶️ <b>Campaña reactivada:</b> ${campana.name}`).catch(() => {});
    return `Campaña "${campana.name}" reactivada en Meta Ads.`;
  },

  // ── EXPERIMENTOS PAUSADOS CON CAUSA ───────────────
  async ver_experimentos_pausados({ estados = 'muerto,pausado' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const listaEstados = estados.split(',').map(s => s.trim());
    const exps = await ExperimentsDB.listarConCausa(listaEstados);
    if (!exps.length) return `No hay experimentos con estado: ${estados}.`;

    const CAUSA_LABEL = {
      config_error:         '⚙️ Error de configuración',
      sin_datos:            '📊 Sin datos suficientes',
      mal_rendimiento:      '📉 Mal rendimiento',
      audiencia_incorrecta: '🎯 Audiencia incorrecta',
      timing:               '⏰ Mal momento',
      presupuesto_bajo:     '💸 Presupuesto bajo',
      decision_automatica:  '🤖 Decisión automática',
    };

    const lineas = exps.map(e => {
      const causa  = CAUSA_LABEL[e.causa_pausa] || (e.causa_pausa ? `❓ ${e.causa_pausa}` : '❓ Sin causa registrada');
      const relanzable = ['config_error', 'sin_datos', 'presupuesto_bajo', 'timing'].includes(e.causa_pausa);
      return [
        `• <b>${e.nombre}</b> ($${e.precio}) — ${e.estado}`,
        `  Causa: ${causa}`,
        e.notas_pausa ? `  Nota: ${e.notas_pausa.slice(0, 80)}` : null,
        relanzable ? `  💡 <i>Candidato a relanzar</i>` : null,
      ].filter(Boolean).join('\n');
    });

    const msg = `🗂 <b>Experimentos pausados (${exps.length})</b>\n━━━━━━━━━━━━━━━━━━━━━━\n${lineas.join('\n\n')}`;
    await notif(msg);
    return `${exps.length} experimentos mostrados. Los marcados como "Candidato a relanzar" se pausaron por causas externas, no por mal producto.`;
  },

  // ── TRANSCRIPCIONES DE LLAMADAS ────────────────────
  async ver_transcripciones({ telefono = null, limite = 3 } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    if (telefono) {
      const llamada = await CallsDB.obtenerTranscript(telefono);
      if (!llamada) return `No encontré transcripción de llamadas al número ${telefono}.`;
      const fecha = new Date(llamada.llamada_en).toLocaleDateString('es-US');
      const msg =
        `📞 <b>Transcripción — ${llamada.nombre} (${llamada.telefono})</b>\n` +
        `📅 ${fecha}\n` +
        (llamada.resumen ? `\n💬 Resumen: ${llamada.resumen}\n` : '') +
        `\n📄 <b>Transcripción completa:</b>\n${llamada.transcript.slice(0, 3000)}${llamada.transcript.length > 3000 ? '\n…(truncado)' : ''}`;
      await notif(msg);
      return `Transcripción de ${llamada.nombre} mostrada.`;
    }

    const llamadas = await CallsDB.ultimasConTranscript(limite);
    if (!llamadas.length) return 'No hay transcripciones guardadas aún. Se guardan automáticamente cuando Sofia termina una llamada.';

    for (const l of llamadas) {
      const fecha = new Date(l.llamada_en).toLocaleDateString('es-US');
      const msg =
        `📞 <b>${l.nombre} (${l.telefono})</b> — ${fecha}\n` +
        `${l.cita ? '✅ Cita agendada' : '❌ Sin cita'}\n` +
        (l.resumen ? `💬 ${l.resumen}\n` : '') +
        `\n📄 ${l.transcript.slice(0, 1500)}${l.transcript.length > 1500 ? '\n…' : ''}`;
      await notif(msg);
    }
    return `${llamadas.length} transcripción(es) mostrada(s).`;
  },

  // ── REPARAR CONTENIDO DE PRODUCTO ──────────────────
  async reparar_contenido_producto({ nombre_o_id }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    const id = parseInt(nombre_o_id);
    let exp = null;
    if (!isNaN(id)) {
      exp = await ExperimentsDB.obtener(id);
    } else {
      for (const estado of ['activo', 'muerto', 'extendido']) {
        const lista = await ExperimentsDB.listar(estado);
        const match = lista.find(e => e.nombre.toLowerCase().includes(String(nombre_o_id).toLowerCase()));
        if (match) { exp = await ExperimentsDB.obtener(match.id); break; }
      }
    }
    if (!exp) return `No encontré producto con "${nombre_o_id}". Usa ver_experimentos para ver los disponibles.`;

    await notif(
      `🔧 <b>Reparando contenido — ${esc(exp.nombre)}</b>\n` +
      `⏳ Generando el producto con IA... (esto puede tardar 2-3 minutos)`
    );

    // Inferir contexto específico para que el generador no mezcle temas
    const ctx = await inferirContextoProducto(exp.nombre, exp.nicho || exp.nombre, exp.tipo || 'guia_pdf', exp.precio || 27);

    const nicho = {
      nombre_producto:       exp.nombre,
      nicho:                 exp.nicho || exp.nombre,
      tipo:                  exp.tipo || 'guia_pdf',
      precio:                exp.precio || 27,
      problema_que_resuelve: ctx?.problema_que_resuelve || exp.nombre,
      cliente_ideal:         ctx?.cliente_ideal || 'Inmigrante hispano en USA',
      quick_win:             ctx?.quick_win || 'Dominar el examen de ciudadanía',
      puntos_de_venta:       ctx?.puntos_de_venta || [],
    };

    let html;
    try {
      html = await generarProducto(nicho);
    } catch (err) {
      await notif(`❌ Error generando contenido: ${err.message}`);
      return `Error generando el contenido del producto: ${err.message}`;
    }

    const { query } = await import('../config/database.js');
    await query(
      `UPDATE experiments SET contenido_producto = $1, actualizado_en = NOW() WHERE id = $2`,
      [html, exp.id]
    );

    const dominio     = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
    const accesoUrl   = exp.landing_slug ? `${dominio}/acceso/${exp.landing_slug}` : null;

    await notif(
      `✅ <b>Contenido reparado — ${esc(exp.nombre)}</b>\n` +
      `📄 ${Math.round(html.length / 1024)} KB de contenido guardado\n` +
      (accesoUrl ? `🔗 URL de acceso: ${accesoUrl}\n` : '') +
      `\nYa puedes probar con "test_entrega_producto" para verificar que el email llega correctamente.`
    );

    return `Contenido de "${exp.nombre}" reparado — ${Math.round(html.length / 1024)} KB generados y guardados. ${accesoUrl ? `La URL de acceso ${accesoUrl} ya debería funcionar.` : ''}`;
  },

  // ── TEST DE ENTREGA DE PRODUCTO ────────────────────
  async test_entrega_producto({ nombre_o_id = null } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    if (!ResendConnector.disponible()) {
      return '⚠️ RESEND_API_KEY no configurado en Railway. El email de entrega no puede enviarse.';
    }

    // Encontrar el experimento
    let exp = null;
    if (nombre_o_id) {
      const id = parseInt(nombre_o_id);
      if (!isNaN(id)) {
        exp = await ExperimentsDB.obtener(id);
      } else {
        const lista = await ExperimentsDB.listar('activo');
        exp = lista.find(e => e.nombre.toLowerCase().includes(String(nombre_o_id).toLowerCase()));
      }
    }
    if (!exp) {
      const activos = await ExperimentsDB.listar('activo');
      exp = activos.find(e => e.contenido_producto || e.landing_slug) || activos[0];
    }
    if (!exp) {
      return 'No hay experimentos activos con producto para probar. Crea un producto primero con pipeline_completo.';
    }

    const dominio    = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
    const productoUrl = exp.landing_slug ? `${dominio}/acceso/${exp.landing_slug}` : exp.producto_url || null;
    const emailDestino = ENV.EDUARDO_EMAIL || 'eduardo23carsales@gmail.com';

    await notif(
      `🧪 <b>Test de entrega iniciado</b>\n` +
      `📦 Producto: ${exp.nombre}\n` +
      `📧 Destino: ${emailDestino}\n` +
      `🔗 URL acceso: ${productoUrl || '(sin URL)'}\n` +
      `⏳ Enviando...`
    );

    try {
      await ResendConnector.entregarProducto({
        para:            emailDestino,
        nombreCliente:   'Eduardo (TEST)',
        nombreProducto:  exp.nombre,
        contenido:       exp.contenido_producto || '',
        productoUrl,
        stripePaymentId: 'TEST_' + Date.now(),
      });

      const msg =
        `✅ <b>Email de prueba enviado</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 Producto: ${exp.nombre}\n` +
        `📧 Enviado a: ${emailDestino}\n` +
        `🔗 Link de acceso en el email: ${productoUrl || '(sin link — solo contenido)'}\n\n` +
        `Revisa tu bandeja de entrada (o spam). Si el email llegó → Resend está funcionando.\n` +
        `Si el link abre el producto → el pipeline completo está operativo.`;

      await notif(msg);
      return `Email de prueba enviado a ${emailDestino}. Revisa tu bandeja de entrada para confirmar que llegó con el link de acceso a "${exp.nombre}".`;
    } catch (err) {
      await notif(`❌ <b>Error en test de entrega</b>\n<code>${err.message}</code>`);
      return `Error enviando email de prueba: ${err.message}`;
    }
  },

  // ── P&L REPORT ─────────────────────────────────────
  async ver_pnl({ dias = 7 } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    // Stripe revenue
    let stripeRevenue = 0, stripeVentas = 0;
    if (StripeConnector.disponible()) {
      try {
        const stripe = await StripeConnector.getVentasRecientes(null, dias);
        stripeRevenue = stripe.revenue || 0;
        stripeVentas  = stripe.total_ventas || 0;
      } catch (err) {
        console.warn('[PnL] Stripe error:', err.message);
      }
    }

    // Meta spend (campañas activas)
    let metaSpend = 0;
    let campanasMeta = [];
    try {
      campanasMeta = await MetaConnector.getCampanas();
      for (const c of campanasMeta) {
        const datos = await CampaignManager.getDatosCampana(c).catch(() => null);
        if (datos?.spend) metaSpend += parseFloat(datos.spend) || 0;
      }
    } catch (err) {
      console.warn('[PnL] Meta spend error:', err.message);
    }

    // Productos por revenue (experiments)
    const experimentos = await ExperimentsDB.listar('activo').catch(() => []);
    const productosConVentas = experimentos
      .filter(e => e.metricas?.ventas > 0)
      .sort((a, b) => (b.metricas?.revenue || 0) - (a.metricas?.revenue || 0));

    const gananciaNetaEstimada = stripeRevenue - metaSpend;
    const roi = metaSpend > 0 ? ((stripeRevenue / metaSpend - 1) * 100).toFixed(0) : '∞';

    const lineas = [
      `💰 <b>P&L — Últimos ${dias} días</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📈 <b>Ingresos Stripe:</b>  $${stripeRevenue.toFixed(2)} (${stripeVentas} ventas)`,
      `📉 <b>Gasto Meta Ads:</b>   $${metaSpend.toFixed(2)}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      gananciaNetaEstimada >= 0
        ? `✅ <b>Ganancia neta:</b>    $${gananciaNetaEstimada.toFixed(2)} (ROI: ${roi}%)`
        : `🔴 <b>Pérdida neta:</b>    $${Math.abs(gananciaNetaEstimada).toFixed(2)}`,
    ];

    if (productosConVentas.length) {
      lineas.push(`\n📦 <b>Por producto:</b>`);
      productosConVentas.slice(0, 5).forEach(e => {
        lineas.push(`• ${e.nombre} — ${e.metricas.ventas} ventas | $${e.metricas.revenue || 0}`);
      });
    }

    if (campanasMeta.length) {
      lineas.push(`\n📊 <b>Campañas activas:</b> ${campanasMeta.length}`);
    }

    if (stripeRevenue === 0 && metaSpend === 0) {
      lineas.push(`\n⚠️ Sin datos todavía. Lanza un producto con pipeline_completo para ver tu primer P&L.`);
    }

    const mensaje = lineas.join('\n');
    await notif(mensaje);
    return mensaje.replace(/<[^>]+>/g, '');
  },

  // ── CONTROL GRANULAR + CALIDAD + OPTIMIZACIÓN ─────

  async quality_scores({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    let campanaId, campanaNombre;
    if (campana) {
      const list = await MetaConnector.getCampanas(false);
      const match = list.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id; campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay campañas con datos.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id; campanaNombre = top.campana_nombre;
    }
    const scores = await MetaConnector.getQualityScores(campanaId, periodo);
    if (!scores.length) return `Sin datos de quality score para "${campanaNombre}". Necesita mínimo ~500 impresiones por ad.`;

    const ordenados = [...scores].sort((a, b) => b.score_global - a.score_global);
    const lineas = [
      `⭐ <b>Quality Scores — ${esc(campanaNombre)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Meta califica cada ad: si el score es bajo, Meta te cobra más y te da menos alcance.</i>`,
      '',
    ];
    ordenados.forEach((s, i) => {
      const alerta = s.alerta ? ' ⚠️' : '';
      lineas.push(`${i === 0 ? '🏆' : `#${i + 1}`} <b>${esc(s.ad_nombre)}</b>${alerta}`);
      lineas.push(`   Calidad: ${s.quality.label}`);
      lineas.push(`   Engagement: ${s.engagement.label}`);
      lineas.push(`   Conversión: ${s.conversion.label}`);
      lineas.push(`   Gasto: $${s.spend.toFixed(2)} | Score global: ${s.score_global}/15`);
    });
    const conAlerta = scores.filter(s => s.alerta).length;
    if (conAlerta) lineas.push(`\n⚠️ ${conAlerta} ad(s) por debajo del promedio — considera pausarlos y generar nuevos creativos.`);
    await notif(lineas.join('\n'));
    return `${scores.length} ads analizados. ${conAlerta} con quality score bajo. Ver Telegram.`;
  },

  async breakdown_dispositivo({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    let campanaId, campanaNombre;
    if (campana) {
      const list = await MetaConnector.getCampanas(false);
      const match = list.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id; campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay datos.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id; campanaNombre = top.campana_nombre;
    }
    const data = await MetaConnector.getBreakdownDispositivo(campanaId, periodo);
    if (!data.length) return `Sin datos de dispositivo para "${campanaNombre}".`;
    const gastoTotal = data.reduce((s, r) => s + r.spend, 0);
    const lineas = [
      `📱 <b>Mobile vs Desktop — ${esc(campanaNombre)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];
    data.sort((a, b) => b.spend - a.spend).forEach(d => {
      const pct     = gastoTotal > 0 ? ((d.spend / gastoTotal) * 100).toFixed(0) : 0;
      const cplStr  = d.cpl !== null ? `$${d.cpl} CPL` : 'sin conv.';
      const emoji   = d.dispositivo === 'mobile' ? '📱' : d.dispositivo === 'desktop' ? '💻' : '📺';
      lineas.push(`${emoji} <b>${d.dispositivo}</b>: $${d.spend.toFixed(2)} (${pct}%) | ${cplStr} | CTR ${d.ctr.toFixed(2)}% | ${d.conversiones} conv.`);
    });
    const mobile  = data.find(d => d.dispositivo === 'mobile');
    const desktop = data.find(d => d.dispositivo === 'desktop');
    if (mobile && desktop && mobile.cpl && desktop.cpl && mobile.cpl > desktop.cpl * 1.5) {
      lineas.push(`\n⚠️ Mobile convierte ${((mobile.cpl / desktop.cpl - 1) * 100).toFixed(0)}% peor que desktop. Verifica que la landing sea mobile-friendly.`);
    }
    await notif(lineas.join('\n'));
    return `Breakdown dispositivo completado para "${campanaNombre}". Ver Telegram.`;
  },

  async breakdown_horario({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    let campanaId, campanaNombre;
    if (campana) {
      const list = await MetaConnector.getCampanas(false);
      const match = list.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id; campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay datos.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id; campanaNombre = top.campana_nombre;
    }
    const horas = await MetaConnector.getBreakdownHorario(campanaId, periodo);
    if (!horas.length) return `Sin datos horarios para "${campanaNombre}".`;

    const conConv = horas.filter(h => h.conversiones > 0).sort((a, b) => a.cpl - b.cpl);
    const top5    = conConv.slice(0, 5);
    const peores  = conConv.slice(-3);

    const lineas = [
      `⏰ <b>Breakdown Horario — ${esc(campanaNombre)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];
    if (top5.length) {
      lineas.push(`\n🟢 <b>Mejores horas (menor CPL):</b>`);
      top5.forEach(h => {
        const hr = `${h.hora}:00–${h.hora + 1}:00`;
        lineas.push(`• ${hr}: CPL $${h.cpl} | ${h.conversiones} conv. | CTR ${h.ctr.toFixed(2)}%`);
      });
    }
    if (peores.length) {
      lineas.push(`\n🔴 <b>Peores horas (mayor CPL):</b>`);
      peores.forEach(h => {
        const hr = `${h.hora}:00–${h.hora + 1}:00`;
        lineas.push(`• ${hr}: CPL $${h.cpl} | $${h.spend.toFixed(2)} gastados`);
      });
    }
    if (top5.length >= 3) {
      const mejores = top5.map(h => `${h.hora}h`).join(', ');
      lineas.push(`\n💡 <b>Dayparting sugerido:</b> Activar solo en ${mejores} para reducir CPL.`);
    }
    await notif(lineas.join('\n'));
    return `Análisis horario completado. Mejores horas: ${top5.map(h => `${h.hora}h`).join(', ')}. Ver Telegram.`;
  },

  async pausar_adset({ campana = null, nombre_adset }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const campanas = campana
      ? await MetaConnector.getCampanas(false).then(list => list.filter(c => c.name.toLowerCase().includes(campana.toLowerCase())))
      : await MetaConnector.getCampanas(false);
    if (!campanas.length) return `No encontré campaña${campana ? ` con "${campana}"` : ''}.`;

    for (const c of campanas) {
      const adsets = await MetaConnector.getAdSetsConMetricas(c.id, 'last_7d');
      const match  = adsets.find(a => a.nombre.toLowerCase().includes(nombre_adset.toLowerCase()));
      if (match) {
        await MetaConnector.pausarAdSet(match.id);
        await notif(`⏸ <b>AdSet pausado</b>\n📊 ${esc(match.nombre)}\nCampaña: ${esc(c.name)}`);
        return `AdSet "${match.nombre}" pausado en "${c.name}".`;
      }
    }
    return `No encontré adset con "${nombre_adset}". Usa metricas_adsets para ver los nombres exactos.`;
  },

  async pausar_ad({ campana = null, nombre_ad }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const campanas = campana
      ? await MetaConnector.getCampanas(false).then(list => list.filter(c => c.name.toLowerCase().includes(campana.toLowerCase())))
      : await MetaConnector.getCampanas(false);
    if (!campanas.length) return `No encontré campaña.`;

    for (const c of campanas) {
      const ads = await MetaConnector.getAnunciosConMetricas(c.id, 'last_7d');
      const match = ads.find(a => a.ad_nombre.toLowerCase().includes(nombre_ad.toLowerCase()));
      if (match) {
        await MetaConnector.pausarAd(match.ad_id);
        await notif(`⏸ <b>Anuncio pausado</b>\n🎨 ${esc(match.ad_nombre)}\nCampaña: ${esc(c.name)}`);
        return `Anuncio "${match.ad_nombre}" pausado.`;
      }
    }
    return `No encontré anuncio con "${nombre_ad}". Usa metricas_anuncios para ver los nombres exactos.`;
  },

  async refresh_creativo({ campana = null } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const campanas = campana
      ? await MetaConnector.getCampanas(true).then(list => list.filter(c => c.name.toLowerCase().includes(campana.toLowerCase())))
      : await MetaConnector.getCampanas(true);
    if (!campanas.length) return 'No hay campañas activas.';

    const resultados = [];
    for (const c of campanas) {
      const freq = await MetaConnector.getFrecuenciaYAlcance(c.id, 'last_7d');
      if (!freq) continue;
      if (freq.frequency >= 3.0) {
        const producto = c.name.split(' — ')[1] || c.name;
        await notif(`🔄 Generando slideshow para "${esc(c.name)}" (frecuencia: ${freq.frequency.toFixed(1)}x)...`);
        try {
          const sl = await generarSlideshowParaCampana(producto, 'emprendedor-principiante', {}, 5);
          await LearningsDB.guardar({
            tipo: 'campana', contexto: `Refresh creativo: ${c.name}`,
            accion: `Nuevo slideshow por fatiga ${freq.frequency.toFixed(1)}x`, resultado: `VideoID: ${sl.videoId}`,
            exito: true, tags: ['fatiga', 'refresh'], relevancia: 8,
          }).catch(() => {});
          await notif(
            `✅ <b>Creativo renovado</b>\n📊 ${esc(c.name)}\n` +
            `🎬 Nuevo video slideshow ID: ${sl.videoId}\n` +
            `📈 Frecuencia actual: ${freq.frequency.toFixed(1)}x (fatiga detectada)\n` +
            `💡 Asigna este video a los adsets activos de esta campaña.`
          );
          resultados.push(`"${c.name}" → nuevo slideshow ${sl.videoId}`);
        } catch (err) {
          resultados.push(`"${c.name}" → error: ${err.message}`);
        }
      }
    }
    if (!resultados.length) return 'Ninguna campaña tiene fatiga crítica (frecuencia < 3.0). Creativos en buen estado.';
    return `Refresh completado: ${resultados.join(' | ')}`;
  },

  async analisis_breakeven({ precio_producto = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const precio  = precio_producto || BUSINESS.breakeven?.precioProducto || 27;
    const margen  = BUSINESS.breakeven?.margenNeto || 0.70;
    const tasaConv = BUSINESS.breakeven?.tasaConversion || 0.02;
    const cplBreakeven = +(precio * margen * tasaConv).toFixed(2);

    const [cuenta, campanas] = await Promise.all([
      MetaConnector.getInsightsCuenta(periodo),
      MetaConnector.getMetricasTodasCampanas(periodo),
    ]);

    const roasPorCampana = await Promise.all(
      campanas.map(async c => {
        const r = await MetaConnector.getRoas(c.campana_id, periodo);
        return { ...c, roas_data: r };
      })
    );

    const gastoTotal   = cuenta?.spend || 0;
    const convTotal    = cuenta?.conversiones || 0;
    const cplCuenta    = convTotal > 0 ? +(gastoTotal / convTotal).toFixed(2) : null;
    const ventasNecesarias = gastoTotal > 0 ? Math.ceil(gastoTotal / (precio * margen)) : 0;

    const lineas = [
      `💰 <b>Análisis Break-Even</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Período: ${periodo} | Precio producto: $${precio}`,
      ``,
      `<b>Cuenta completa:</b>`,
      `💸 Gasto total: $${gastoTotal.toFixed(2)}`,
      `🎯 CPL actual: ${cplCuenta ? `$${cplCuenta}` : '—'}`,
      `🔑 CPL de break-even: $${cplBreakeven} (${tasaConv * 100}% conversión)`,
      `📦 Ventas necesarias para cubrir gasto: ${ventasNecesarias}`,
      ``,
      cplCuenta
        ? (cplCuenta <= cplBreakeven
            ? `✅ <b>RENTABLE</b> — CPL actual ($${cplCuenta}) está por debajo del break-even ($${cplBreakeven})`
            : `🔴 <b>NO RENTABLE</b> — CPL actual ($${cplCuenta}) supera el break-even ($${cplBreakeven}) en ${((cplCuenta / cplBreakeven - 1) * 100).toFixed(0)}%`)
        : `⚪ Sin conversiones aún — necesitas conversiones para calcular rentabilidad`,
      ``,
    ];

    const conRoas = roasPorCampana.filter(c => c.roas_data?.roas);
    if (conRoas.length) {
      lineas.push(`<b>ROAS por campaña:</b>`);
      conRoas.forEach(c => {
        const r = c.roas_data;
        const icon = r.roas >= BUSINESS.riesgo?.roasMinimo ? '✅' : '⚠️';
        lineas.push(`${icon} ${esc(c.campana_nombre)}: ROAS ${r.roas}x | Revenue $${r.revenue_atribuido.toFixed(2)} | Gasto $${r.spend.toFixed(2)}`);
      });
    }

    lineas.push(`\n💡 Para escalar con seguridad necesitas CPL < $${cplBreakeven} sostenido por mínimo 3 días.`);
    await notif(lineas.join('\n'));
    return `Break-even: $${cplBreakeven} CPL. Actual: ${cplCuenta ? `$${cplCuenta}` : 'sin datos'}. ${cplCuenta && cplCuenta <= cplBreakeven ? 'Rentable ✅' : 'No rentable aún 🔴'}.`;
  },

  async escalar_escalera({ campana }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const campanas = await MetaConnector.getCampanas(true);
    const match = campanas.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
    if (!match) return `No encontré campaña activa con "${campana}".`;

    const datos  = await CampaignManager.getDatosCampana(match);
    const pasos  = BUSINESS.escalera?.pasos || [10, 20, 40, 80, 150, 300];
    const presActual = datos.presupuesto_dia || (parseFloat(match.daily_budget || 0) / 100);
    const idxActual  = pasos.findIndex(p => p >= presActual);
    const siguiente  = idxActual >= 0 && idxActual < pasos.length - 1 ? pasos[idxActual + 1] : null;

    if (!siguiente) return `La campaña ya está en el presupuesto máximo de la escalera ($${pasos[pasos.length - 1]}/día).`;

    const cpl7d     = datos.ultimos_7_dias?.cpl;
    const objetivo  = BUSINESS.campana.cplObjetivo;
    const tolerancia = BUSINESS.escalera?.cplTolerancia || 1.3;
    const cplMax    = +(objetivo * tolerancia).toFixed(2);

    if (cpl7d && cpl7d > cplMax) {
      return `No se puede escalar. CPL actual ($${cpl7d}) supera el límite para escalar ($${cplMax}). Espera a que el CPL baje antes de subir presupuesto.`;
    }

    await notif(
      `📈 <b>Escalera de Presupuesto</b>\n` +
      `📊 ${esc(match.name)}\n` +
      `💰 $${presActual}/día → $${siguiente}/día\n` +
      `${cpl7d ? `CPL actual: $${cpl7d} (límite: $${cplMax}) ✅` : 'Sin datos de CPL — escalando con precaución'}`
    );

    await CampaignManager.cambiarPresupuesto(match.id, siguiente);

    await LearningsDB.guardar({
      tipo: 'campana', contexto: `Escalera: ${match.name}`,
      accion: `$${presActual}/día → $${siguiente}/día`,
      resultado: `CPL previo: $${cpl7d || 'n/d'}`,
      exito: true, tags: ['escalar', 'escalera'], relevancia: 8,
    }).catch(() => {});

    await notif(`✅ Presupuesto actualizado a $${siguiente}/día. Próximo paso: $${pasos[idxActual + 2] || 'máximo alcanzado'}/día (validar en 3 días).`);
    return `Campaña "${match.name}" escalada de $${presActual} a $${siguiente}/día.`;
  },

  // ── BIBLIOTECA, AUDIENCIAS Y ESCALADO META ────────

  async ver_biblioteca_meta({ tipo = 'ambos' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const [videos, imagenes] = await Promise.all([
      (tipo === 'videos' || tipo === 'ambos') ? MetaConnector.getVideoLibrary(20) : Promise.resolve([]),
      (tipo === 'imagenes' || tipo === 'ambos') ? MetaConnector.getImageLibrary(20) : Promise.resolve([]),
    ]);

    const lineas = [`🎨 <b>Biblioteca de Creativos Meta</b>`, `━━━━━━━━━━━━━━━━━━━━━━`];

    if (videos.length) {
      lineas.push(`\n🎥 <b>Videos (${videos.length})</b>`);
      videos.forEach(v => {
        const dur = v.duracion_s ? `${Math.round(v.duracion_s)}s` : '—';
        lineas.push(`• ${v.titulo} — ${dur} — ${v.estado}\n  ID: ${v.id}`);
      });
    } else if (tipo !== 'imagenes') {
      lineas.push(`\n🎥 Sin videos subidos aún.`);
    }

    if (imagenes.length) {
      lineas.push(`\n🖼 <b>Imágenes (${imagenes.length})</b>`);
      imagenes.forEach(img => {
        lineas.push(`• ${img.nombre} — ${img.ancho}x${img.alto}px`);
      });
    } else if (tipo !== 'videos') {
      lineas.push(`\n🖼 Sin imágenes subidas aún.`);
    }

    await notif(lineas.join('\n'));
    return `Biblioteca: ${videos.length} videos, ${imagenes.length} imágenes.`;
  },

  async metricas_video({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    let campanaId, campanaNombre;
    if (campana) {
      const campanas = await MetaConnector.getCampanas(false);
      const match = campanas.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id; campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay campañas con datos.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id; campanaNombre = top.campana_nombre;
    }

    const videos = await MetaConnector.getMetricasVideo(campanaId, periodo);
    if (!videos.length) return `No hay métricas de video para "${campanaNombre}". ¿Es una campaña de video?`;

    const ordenados = [...videos].sort((a, b) => a.tasa_completado > b.tasa_completado ? -1 : 1);
    const lineas = [
      `🎥 <b>Video Ads — ${esc(campanaNombre)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];
    ordenados.forEach((v, i) => {
      const medalla = i === 0 ? '🏆' : `#${i + 1}`;
      lineas.push(
        `${medalla} <b>${esc(v.ad_nombre)}</b>\n` +
        `   $${v.spend.toFixed(2)} | Vistas 3s: ${v.vistas_3s} | Completado: ${v.tasa_completado}%\n` +
        `   50% retención: ${v.tasa_p50}% | ThruPlay: ${v.thruplay} | CPV: $${v.costo_por_vista || '—'}`
      );
    });

    await notif(lineas.join('\n'));
    return `${videos.length} video ads analizados. Tasa de completado top: ${ordenados[0]?.tasa_completado}%. Ver Telegram.`;
  },

  async ver_audiencias() {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const audiencias = await MetaConnector.getAudiencias();

    if (!audiencias.length) return 'No hay audiencias personalizadas en la cuenta. Crea una con crear_audiencia_lookalike o crear_retargeting.';

    const TIPO_LABEL = {
      CUSTOM:    '📋 Custom',
      LOOKALIKE: '🔁 Lookalike',
      WEBSITE:   '🌐 Web/Retargeting',
      APP:       '📱 App',
      ENGAGEMENT:'❤️ Engagement',
    };

    const lineas = [`🎯 <b>Audiencias Personalizadas (${audiencias.length})</b>`, `━━━━━━━━━━━━━━━━━━━━━━`];
    audiencias.forEach(a => {
      const tipo = TIPO_LABEL[a.tipo] || a.tipo;
      const tam  = a.tamano_min > 0 ? `~${(a.tamano_min / 1000).toFixed(0)}K–${(a.tamano_max / 1000).toFixed(0)}K personas` : 'calculando...';
      lineas.push(`• ${tipo} <b>${esc(a.nombre)}</b>\n  ${tam} | ${a.estado}\n  ID: ${a.id}`);
    });

    await notif(lineas.join('\n'));
    return `${audiencias.length} audiencias encontradas. Ver Telegram para detalles.`;
  },

  async crear_audiencia_lookalike({ fuente = 'compradores', ratio = 0.01, pais = 'US' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    // Buscar audiencia fuente existente que coincida con el tipo pedido
    const audiencias = await MetaConnector.getAudiencias();
    let fuenteId = null;
    const keywords = fuente === 'compradores'
      ? ['comprador', 'purchas', 'buyer', 'customer', 'venta']
      : fuente === 'leads'
      ? ['lead', 'contacto', 'formulario']
      : ['visit', 'web', 'retarget', 'pixel'];

    const match = audiencias.find(a =>
      keywords.some(k => a.nombre.toLowerCase().includes(k))
    );
    if (match) fuenteId = match.id;

    if (!fuenteId) {
      return `No encontré una audiencia de "${fuente}" para usar como fuente. Primero necesitas tener compradores registrados en el Pixel de Meta (eventos Purchase). Verifica con ver_audiencias.`;
    }

    await notif(`🔁 Creando audiencia Lookalike ${ratio * 100}% de "${fuente}" en ${pais}...`);
    const resultado = await MetaConnector.crearLookalike({
      sourceAudienceId: fuenteId,
      pais, ratio,
      nombre: `Lookalike ${ratio * 100}% Compradores — ${pais}`,
    });

    if (!resultado.ok) return `Error creando lookalike: ${resultado.error}`;

    await notif(
      `✅ <b>Lookalike creada</b>\n` +
      `📊 Tamaño: ${ratio * 100}% de ${pais} (similar a tus ${fuente})\n` +
      `🆔 ID: ${resultado.id}\n\n` +
      `💡 Ahora crea una campaña usando esta audiencia para escalar a personas similares a los que ya compraron.`
    );
    return `Lookalike ${ratio * 100}% creada. ID: ${resultado.id}. Úsala en tu próxima campaña para escalar.`;
  },

  async crear_retargeting({ dias = 30 } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    await notif(`🌐 Creando audiencia de retargeting — visitantes últimos ${dias} días...`);

    const resultado = await MetaConnector.crearAudienciaRetargeting({
      dias,
      nombre: `Retargeting Visitantes ${dias}d — ${new Date().toLocaleDateString('es-US')}`,
    });

    if (!resultado.ok) return `Error creando retargeting: ${resultado.error}`;

    await notif(
      `✅ <b>Retargeting creado</b>\n` +
      `🌐 Audiencia: visitantes de los últimos ${dias} días que NO compraron\n` +
      `🆔 ID: ${resultado.id}\n\n` +
      `💡 Crea una campaña con esta audiencia con un copy diferente — oferta especial, urgencia o descuento. Son personas tibias, mucho más baratas de convertir.`
    );
    return `Audiencia de retargeting creada (${dias} días). ID: ${resultado.id}.`;
  },

  async duplicar_adset_ganador({ campana = null, presupuesto = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    let campanaId, campanaNombre;
    if (campana) {
      const campanas = await MetaConnector.getCampanas(false);
      const match = campanas.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id; campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay campañas con datos.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id; campanaNombre = top.campana_nombre;
    }

    const adsets = await MetaConnector.getAdSetsConMetricas(campanaId, periodo);
    const activos = adsets.filter(a => a.estado === 'ACTIVE' && a.cpl !== null);
    if (!activos.length) return `No hay adsets activos con conversiones en "${campanaNombre}". Necesitas leads/ventas para saber cuál es el ganador.`;

    const ganador = activos.sort((a, b) => a.cpl - b.cpl)[0];
    const nuevoPres = presupuesto || (ganador.presupuesto_dia * 2) || 20;

    await notif(
      `📈 <b>Duplicando adset ganador</b>\n` +
      `🏆 ${esc(ganador.nombre)}\n` +
      `CPL actual: $${ganador.cpl} | Nuevo presupuesto: $${nuevoPres}/día`
    );

    const resultado = await MetaConnector.duplicarAdSet(ganador.id, nuevoPres);
    if (!resultado.ok) return `Error duplicando adset: ${resultado.error}`;

    await LearningsDB.guardar({
      tipo: 'campana', contexto: `Adset ganador duplicado: ${ganador.nombre}`,
      accion: `duplicar_adset_ganador con $${nuevoPres}/día`,
      resultado: `Nuevo adset ID: ${resultado.nuevo_id}`,
      exito: true, tags: ['meta', 'escalar', 'adset'], relevancia: 8,
    }).catch(() => {});

    await notif(
      `✅ <b>Adset duplicado y activo</b>\n` +
      `📊 Nuevo adset ID: ${resultado.nuevo_id}\n` +
      `💰 Presupuesto: $${nuevoPres}/día\n` +
      `⚡ El algoritmo de Meta comenzará a optimizar el nuevo adset de inmediato.`
    );
    return `Adset ganador "${ganador.nombre}" duplicado con $${nuevoPres}/día. ID nuevo: ${resultado.nuevo_id}.`;
  },

  async breakdown_geografico({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    let campanaId, campanaNombre;
    if (campana) {
      const campanas = await MetaConnector.getCampanas(false);
      const match = campanas.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id; campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay campañas con datos.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id; campanaNombre = top.campana_nombre;
    }

    const geo = await MetaConnector.getBreakdownGeografico(campanaId, periodo);
    if (!geo.length) return `No hay datos geográficos para "${campanaNombre}" en ${periodo}.`;

    const ordenados = [...geo]
      .filter(r => r.spend > 0.1)
      .sort((a, b) => {
        if (a.cpl === null && b.cpl === null) return b.spend - a.spend;
        if (a.cpl === null) return 1; if (b.cpl === null) return -1;
        return a.cpl - b.cpl;
      })
      .slice(0, 12);

    const gastoTotal = geo.reduce((s, r) => s + r.spend, 0);
    const lineas = [
      `🗺 <b>Breakdown Geográfico — ${esc(campanaNombre)}</b>`,
      `Período: ${periodo} | Gasto total: $${gastoTotal.toFixed(2)}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];
    ordenados.forEach((r, i) => {
      const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      const cplStr  = r.cpl !== null ? `$${r.cpl} CPL` : 'sin conv.';
      const pct     = gastoTotal > 0 ? `${((r.spend / gastoTotal) * 100).toFixed(0)}%` : '';
      lineas.push(`${medalla} <b>${r.region}</b>: $${r.spend.toFixed(2)} (${pct}) | ${cplStr} | ${r.conversiones} conv.`);
    });

    await notif(lineas.join('\n'));
    return `Breakdown geográfico de "${campanaNombre}" completado. Ver Telegram para el ranking por estado.`;
  },

  async tendencia_campana({ campana = null } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    let campanaId, campanaNombre;
    if (campana) {
      const campanas = await MetaConnector.getCampanas(false);
      const match = campanas.find(c => c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase()));
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id; campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas('last_14d');
      if (!todas.length) return 'No hay campañas con datos.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id; campanaNombre = top.campana_nombre;
    }

    const tendencia = await MetaConnector.compararPeriodos(campanaId, 'last_7d', 'last_14d');
    if (!tendencia) return `No hay datos suficientes para comparar períodos de "${campanaNombre}".`;

    const r = tendencia.periodo_reciente;
    const a = tendencia.periodo_anterior;
    const flechaCpl  = tendencia.cambio_cpl_pct !== null
      ? (tendencia.cambio_cpl_pct < 0 ? `📉 ${Math.abs(tendencia.cambio_cpl_pct)}% más barato` : `📈 ${tendencia.cambio_cpl_pct}% más caro`)
      : '—';
    const flechaLeads = tendencia.cambio_leads_pct !== null
      ? (tendencia.cambio_leads_pct > 0 ? `📈 +${tendencia.cambio_leads_pct}%` : `📉 ${tendencia.cambio_leads_pct}%`)
      : '—';
    const estadoEmoji = { mejorando: '🟢', empeorando: '🔴', estable: '🟡', sin_datos: '⚪' };

    const msg = [
      `📊 <b>Tendencia — ${esc(campanaNombre)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Estado: ${estadoEmoji[tendencia.tendencia]} <b>${tendencia.tendencia.toUpperCase()}</b>`,
      ``,
      `<b>Últimos 7 días:</b>`,
      `💰 Gasto: $${r.spend.toFixed(2)} | Leads: ${r.leads} | CPL: ${r.cpl ? `$${r.cpl}` : '—'} | CTR: ${r.ctr.toFixed(2)}%`,
      ``,
      `<b>7 días anteriores:</b>`,
      `💰 Gasto: $${a.spend.toFixed(2)} | Leads: ${a.leads} | CPL: ${a.cpl ? `$${a.cpl}` : '—'} | CTR: ${a.ctr.toFixed(2)}%`,
      ``,
      `<b>Cambio:</b> CPL ${flechaCpl} | Leads ${flechaLeads}`,
    ].join('\n');

    await notif(msg);
    return `Tendencia "${campanaNombre}": ${tendencia.tendencia}. CPL ${tendencia.cambio_cpl_pct !== null ? `cambió ${tendencia.cambio_cpl_pct}%` : 'sin datos suficientes'}.`;
  },

  // ── INTELIGENCIA META ADS ─────────────────────────

  async diagnostico_meta({ periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    await notif(`🔍 <b>Diagnóstico Meta Ads iniciado</b>\nRecopilando datos de ${periodo}...`);

    // 1. Datos en paralelo: cuenta + todas las campañas + campañas activas
    const [cuenta, campanas, metricasCampanas] = await Promise.all([
      MetaConnector.getInsightsCuenta(periodo),
      MetaConnector.getCampanas(false),
      MetaConnector.getMetricasTodasCampanas(periodo),
    ]);

    if (!metricasCampanas.length) {
      return 'No hay datos de campañas para el período seleccionado. Verifica que tengas campañas activas o con gasto reciente.';
    }

    // 2. Para las 3 campañas con más gasto, obtener detalle (adsets + demografía + placement + frecuencia)
    const topCampanas = [...metricasCampanas]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 3);

    const detalles = await Promise.all(topCampanas.map(async c => {
      const [adsets, anuncios, demografia, placement, frecuencia] = await Promise.all([
        MetaConnector.getAdSetsConMetricas(c.campana_id, periodo),
        MetaConnector.getAnunciosConMetricas(c.campana_id, periodo),
        MetaConnector.getBreakdownDemografico(c.campana_id, periodo),
        MetaConnector.getBreakdownPlacement(c.campana_id, periodo),
        MetaConnector.getFrecuenciaYAlcance(c.campana_id, periodo),
      ]);
      return { ...c, adsets, anuncios, demografia, placement, frecuencia };
    }));

    // 3. Enviar todo a Claude para diagnóstico profesional
    const contexto = JSON.stringify({ cuenta, detalles }, null, 2);
    const diagnostico = await AnthropicConnector.completar({
      system: `Eres el estratega de paid media más efectivo del mundo hispano. Analizas datos de Meta Ads y das diagnósticos brutalmente honestos con recomendaciones concretas y accionables. Tu objetivo: que el negocio genere ventas reales, no solo leads.`,
      prompt: `Analiza estos datos de Meta Ads del período ${periodo} y diagnostica POR QUÉ no hay ventas.

DATOS COMPLETOS:
${contexto}

Entrega un diagnóstico profesional con:

1. RESUMEN EJECUTIVO (2-3 líneas: qué está pasando en general)
2. PROBLEMAS CRÍTICOS (lo que más está quemando dinero sin convertir)
3. QUÉ ESTÁ FUNCIONANDO (si hay algo positivo, menciona para mantenerlo)
4. PLAN DE ACCIÓN INMEDIATO (mínimo 3 acciones concretas con números: qué pausar, qué escalar, qué cambiar, qué testear)
5. SEÑALES DE ALARMA (fatiga, CPL alto, placement ineficiente, demografía incorrecta)

Sé específico con números. No digas "el CPL es alto" — di "el CPL de $47 en la campaña X está 3x por encima del objetivo de $15".
Responde en español, en tono directo como un socio estratégico, no como consultor corporativo.`,
      maxTokens: 1200,
    });

    // 4. Guardar como aprendizaje
    await LearningsDB.guardar({
      tipo:      'diagnostico_campana',
      contexto:  `Diagnóstico Meta Ads ${periodo} — Gasto total: $${cuenta?.spend || 0}`,
      accion:    'diagnostico_meta ejecutado desde Jarvis',
      resultado: diagnostico.slice(0, 300),
      exito:     true,
      tags:      ['meta', 'diagnostico', periodo],
      relevancia: 7,
    }).catch(() => {});

    // 5. Publicar en Telegram + devolver
    const msg =
      `🧠 <b>Diagnóstico Meta Ads — ${periodo}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 Gasto total: $${(cuenta?.spend || 0).toFixed(2)} | Leads: ${cuenta?.leads || 0} | Compras: ${cuenta?.compras || 0}\n` +
      `CPL cuenta: ${cuenta?.cpl ? `$${cuenta.cpl}` : '—'} | CTR: ${cuenta?.ctr ? `${cuenta.ctr.toFixed(2)}%` : '—'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      esc(diagnostico);

    await notif(msg);
    return `Diagnóstico completado. Campañas analizadas: ${metricasCampanas.length}. Ver Telegram para el análisis completo.`;
  },

  // ── AUDITORÍA DE CAMPAÑA META ─────────────────────
  async auditar_campana_meta({ campaign_id = null } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});
    const checks = [];
    const chkOk   = (label, detalle = '') => checks.push({ ok: true,  label, detalle });
    const chkErr  = (label, detalle = '') => checks.push({ ok: false, label, detalle });
    const chkWarn = (label, detalle = '') => checks.push({ ok: null,  label, detalle });

    await notif(`🔍 <b>Auditando campaña Meta Ads...</b>`);

    // 1. Resolver la campaña — por ID o la más reciente activa
    let campana;
    if (campaign_id) {
      try {
        campana = await MetaConnector.get(`/${campaign_id}`, {
          fields: 'id,name,status,effective_status,daily_budget,objective,created_time',
        });
      } catch (e) {
        return `No se pudo leer la campaña ${campaign_id}: ${e.message}`;
      }
    } else {
      const todas = await MetaConnector.getCampanas(false);
      if (!todas.length) return 'No hay campañas en la cuenta de Meta.';
      const activas = todas.filter(c => c.effective_status === 'ACTIVE');
      const pool = activas.length ? activas : todas;
      campana = pool.sort((a, b) => new Date(b.created_time) - new Date(a.created_time))[0];
    }

    // CHECK 1 — Estado de la campaña
    if (campana.effective_status === 'ACTIVE') {
      chkOk('Estado campaña', `Activa`);
    } else if (campana.effective_status === 'PAUSED') {
      chkWarn('Estado campaña', `Pausada — no está entregando impresiones`);
    } else {
      chkErr('Estado campaña', `${campana.effective_status} — verifica en Meta Business Manager`);
    }

    // 2. Leer ads con creative details de esta campaña
    let ads = [];
    try {
      const adsData = await MetaConnector.get(`/${campana.id}/ads`, {
        fields: 'id,name,status,effective_status,creative{id,body,title,image_url,thumbnail_url,object_story_spec,link_url}',
        limit:  25,
      });
      ads = adsData.data || [];
    } catch (e) {
      chkWarn('Ads de la campaña', `No se pudo leer: ${e.message}`);
    }

    // CHECK 2 — Ads activos
    const adsActivos = ads.filter(a => a.effective_status === 'ACTIVE');
    if (adsActivos.length > 0) {
      chkOk('Anuncios activos', `${adsActivos.length} de ${ads.length} activos`);
    } else if (ads.length > 0) {
      chkErr('Anuncios activos', `0 de ${ads.length} activos — ningún anuncio está entregando`);
    } else {
      chkErr('Anuncios activos', 'Sin anuncios — la campaña está vacía');
    }

    // 3. Extraer URL y copy de cada ad
    const adDetails = ads.map(ad => {
      const spec     = ad.creative?.object_story_spec || {};
      const linkData = spec.link_data || spec.video_data || {};
      const url      = ad.creative?.link_url
        || linkData.link
        || linkData.call_to_action?.value?.link
        || null;
      const copy   = ad.creative?.body   || linkData.message || null;
      const titulo = ad.creative?.title  || linkData.name || linkData.title || null;
      return { id: ad.id, nombre: ad.name, estado: ad.effective_status, url, copy, titulo };
    });

    // CHECK 3 — URL en los ads
    const adsConUrl  = adDetails.filter(a => a.url);
    const adsSinUrl  = adDetails.filter(a => !a.url);
    const esLeadForm = adsSinUrl.length === ads.length && ads.length > 0;

    if (esLeadForm) {
      chkWarn('URL destino en ads', 'Formulario nativo Lead Ads — sin URL externa. Verifica que el formulario esté activo en Meta.');
    } else if (adsConUrl.length > 0 && adsSinUrl.length === 0) {
      chkOk('URL destino en ads', `Todos los ads tienen URL destino`);
    } else if (adsConUrl.length > 0) {
      chkWarn('URL destino en ads', `${adsSinUrl.length} ad(s) sin URL — revisa sus creativos`);
    } else {
      chkErr('URL destino en ads', 'Ningún ad tiene URL — los usuarios no tienen a dónde ir');
    }

    // CHECK 4 — Landing accesible (HEAD request a cada URL única)
    const urlsUnicas = [...new Set(adsConUrl.map(a => a.url))].slice(0, 3);
    for (const url of urlsUnicas) {
      try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(9000) });
        if (res.ok) {
          chkOk('Landing accesible', `${url} → HTTP ${res.status}`);
        } else {
          chkErr('Landing accesible', `${url} → HTTP ${res.status} — página rota o redirige mal`);
        }
      } catch (e) {
        chkErr('Landing accesible', `${url} no responde — ${e.message}`);
      }
    }

    // CHECK 5 — Alineación del copy con el producto (Claude como auditor)
    const copiesParaAudit = adDetails.filter(a => a.copy || a.titulo).slice(0, 3);
    if (copiesParaAudit.length > 0) {
      const productoNombre = campana.name
        .replace(/Nexus Labs\s*[—\-–]\s*/i, '')
        .replace(/\s*[—\-–]\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}.*$/, '')
        .trim();

      const auditCopy = await AnthropicConnector.completar({
        model:     'claude-haiku-4-5-20251001',
        maxTokens: 200,
        prompt: `Eres un auditor de Meta Ads. Determina si los copies de estos anuncios son ESPECÍFICOS al producto o GENÉRICOS (términos como "ingresos digitales", "comunidad privada", "plazas limitadas" sin mencionar el producto real).

Producto de la campaña: "${productoNombre}"

Copies en los anuncios:
${copiesParaAudit.map((a, i) => `[${i + 1}] Título: "${a.titulo || '—'}" | Copy: "${(a.copy || '—').slice(0, 120)}"`).join('\n')}

Responde con exactamente este formato:
RESULTADO: ALINEADO
DETALLE: [una frase de máx 100 chars]

O:
RESULTADO: GENERICO
DETALLE: [una frase de máx 100 chars]

O:
RESULTADO: MIXTO
DETALLE: [una frase de máx 100 chars]`,
      });

      const resMatch  = auditCopy.match(/RESULTADO:\s*(\w+)/i);
      const detMatch  = auditCopy.match(/DETALLE:\s*(.+)/i);
      const resultado = resMatch?.[1]?.toUpperCase() || 'DESCONOCIDO';
      const detalle   = detMatch?.[1]?.trim() || auditCopy.slice(0, 100);

      if (resultado === 'ALINEADO') {
        chkOk('Copy alineado al producto', detalle);
      } else if (resultado === 'GENERICO' || resultado === 'GENÉRICO') {
        chkErr('Copy alineado al producto', `${detalle} — lanza la campaña de nuevo con relanzar_producto para regenerar copies`);
      } else {
        chkWarn('Copy alineado al producto', detalle);
      }
    } else {
      chkWarn('Copy alineado al producto', 'No se pudo leer el copy de los creativos');
    }

    // CHECK 6 — Métricas de entrega (últimos 7 días)
    const metricas = await MetaConnector.getMetricas(campana.id, 'last_7d');
    if (metricas.spend > 0) {
      const convStr = metricas.leads > 0
        ? `${metricas.leads} leads | CPL $${metricas.cpl}`
        : metricas.visitas_landing > 0
          ? `${metricas.visitas_landing} visitas landing`
          : 'sin conversiones aún';
      chkOk('Campaña entregando', `$${metricas.spend.toFixed(2)} gastados | ${metricas.impressions.toLocaleString()} impresiones | CTR ${metricas.ctr.toFixed(2)}% | ${convStr}`);
    } else {
      chkWarn('Campaña entregando', 'Sin gasto en los últimos 7 días — puede estar en fase de aprendizaje o sin presupuesto');
    }

    // CHECK 7 — Quality Scores (solo cuando hay suficientes impresiones)
    if (metricas.impressions >= 500) {
      try {
        const scores = await MetaConnector.getQualityScores(campana.id, 'last_7d');
        const conAlerta = scores.filter(s => s.alerta);
        if (scores.length === 0) {
          chkWarn('Quality Scores', 'Meta no reporta scores aún — normal en primeros días');
        } else if (conAlerta.length === 0) {
          chkOk('Quality Scores', `${scores.length} ad(s) con calidad promedio o superior`);
        } else {
          chkWarn('Quality Scores', `${conAlerta.length} de ${scores.length} ads con calidad BELOW_AVERAGE — Meta limita su alcance`);
        }
      } catch {
        chkWarn('Quality Scores', 'No disponible en este momento');
      }
    } else {
      chkWarn('Quality Scores', `${metricas.impressions} impresiones — se necesitan 500+ para calcular quality score`);
    }

    // CHECK 8 — Frecuencia / fatiga de audiencia
    if (metricas.impressions > 0) {
      try {
        const freq = await MetaConnector.getFrecuenciaYAlcance(campana.id, 'last_7d');
        if (freq && freq.frequency > 0) {
          if (!freq.alerta_fatiga) {
            chkOk('Frecuencia de audiencia', `${freq.frequency.toFixed(1)}x — ${freq.nivel_fatiga}`);
          } else {
            chkWarn('Frecuencia de audiencia', `${freq.frequency.toFixed(1)}x — ${freq.nivel_fatiga} — rota creativos o amplía audiencia`);
          }
        }
      } catch { /* silencioso si falla */ }
    }

    // Reporte final
    const pasaron  = checks.filter(c => c.ok === true).length;
    const fallaron = checks.filter(c => c.ok === false).length;
    const alertas  = checks.filter(c => c.ok === null).length;
    const total    = checks.length;

    const EMOJI = { true: '✅', false: '❌', null: '⚠️' };
    const lineas = checks.map(c =>
      `${EMOJI[String(c.ok)]} <b>${esc(c.label)}</b>${c.detalle ? `\n   ${esc(c.detalle)}` : ''}`
    );

    const estadoFinal = fallaron === 0
      ? (alertas === 0 ? '🟢 CAMPAÑA OK — todo correcto' : '🟡 FUNCIONAL — revisar alertas')
      : `🔴 ${fallaron} PROBLEMA(S) CRÍTICO(S)`;

    const presupuestoStr = campana.daily_budget
      ? `$${(parseInt(campana.daily_budget) / 100).toFixed(0)}/día`
      : 'presupuesto CBO';

    const msgFinal =
      `🔍 <b>Auditoría Campaña Meta</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 ${esc(campana.name)}\n` +
      `💰 ${presupuestoStr} | ${campana.objective || '—'}\n` +
      `${estadoFinal}\n` +
      `✅ ${pasaron}/${total} | ❌ ${fallaron} errores | ⚠️ ${alertas} alertas\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      lineas.join('\n\n');

    await notif(msgFinal);

    if (fallaron === 0) {
      return `Campaña "${campana.name}" — ${pasaron}/${total} checks OK. ${alertas > 0 ? `${alertas} alertas menores.` : 'Todo correcto.'}`;
    }
    const erroresStr = checks.filter(c => c.ok === false).map(c => `${c.label}: ${c.detalle}`).join('; ');
    return `Campaña "${campana.name}" — ${fallaron} problema(s) crítico(s): ${erroresStr}`;
  },

  async metricas_adsets({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    // Resolver campaña: por nombre/ID o la de mayor gasto
    let campanaId, campanaNombre;
    if (campana) {
      const campanas = await MetaConnector.getCampanas(false);
      const match = campanas.find(c =>
        c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase())
      );
      if (!match) return `No encontré campaña con "${campana}". Usa ver_reporte para ver los nombres exactos.`;
      campanaId = match.id;
      campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay campañas con datos en ese período.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id;
      campanaNombre = top.campana_nombre;
    }

    const adsets = await MetaConnector.getAdSetsConMetricas(campanaId, periodo);
    if (!adsets.length) return `No hay ad sets con datos para "${campanaNombre}" en ${periodo}.`;

    const ordenados = [...adsets].sort((a, b) => {
      if (a.cpl === null && b.cpl === null) return b.spend - a.spend;
      if (a.cpl === null) return 1;
      if (b.cpl === null) return -1;
      return a.cpl - b.cpl;
    });

    const lineas = ordenados.map((a, i) => {
      const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      const estado  = a.estado === 'ACTIVE' ? '▶️' : '⏸';
      const cplStr  = a.cpl !== null ? `CPL $${a.cpl}` : 'sin leads';
      const gastoPct = adsets.reduce((s, x) => s + x.spend, 0) > 0
        ? `${((a.spend / adsets.reduce((s, x) => s + x.spend, 0)) * 100).toFixed(0)}% del gasto`
        : '';
      return `${medalla} ${estado} <b>${esc(a.nombre)}</b>\n   $${a.spend.toFixed(2)} | ${cplStr} | ${a.leads} leads | CTR ${a.ctr.toFixed(2)}%${gastoPct ? ` | ${gastoPct}` : ''}`;
    });

    const gastoTotal = adsets.reduce((s, a) => s + a.spend, 0);
    const leadsTotal = adsets.reduce((s, a) => s + a.leads, 0);
    const msg =
      `🎯 <b>Ad Sets — ${esc(campanaNombre)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Período: ${periodo} | Gasto total: $${gastoTotal.toFixed(2)} | Leads: ${leadsTotal}\n\n` +
      lineas.join('\n\n');

    await notif(msg);
    return `${adsets.length} ad sets analizados para "${campanaNombre}". Ver Telegram para el ranking completo.`;
  },

  async metricas_anuncios({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    let campanaId, campanaNombre;
    if (campana) {
      const campanas = await MetaConnector.getCampanas(false);
      const match = campanas.find(c =>
        c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase())
      );
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id;
      campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay campañas con datos en ese período.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id;
      campanaNombre = top.campana_nombre;
    }

    const anuncios = await MetaConnector.getAnunciosConMetricas(campanaId, periodo);
    if (!anuncios.length) return `No hay anuncios con datos para "${campanaNombre}" en ${periodo}.`;

    const ordenados = [...anuncios].sort((a, b) => {
      if (a.cpl === null && b.cpl === null) return b.spend - a.spend;
      if (a.cpl === null) return 1;
      if (b.cpl === null) return -1;
      return a.cpl - b.cpl;
    });

    const lineas = ordenados.map((a, i) => {
      const medalla = i === 0 ? '🏆 GANADOR' : i === ordenados.length - 1 && ordenados.length > 1 ? '🔴 PEOR' : `#${i + 1}`;
      const cplStr  = a.cpl !== null ? `$${a.cpl} CPL` : 'sin conv.';
      return `${medalla} — <b>${esc(a.ad_nombre)}</b>\n   $${a.spend.toFixed(2)} gastado | ${cplStr} | ${a.leads} leads | ${a.clicks} clicks | CTR ${a.ctr.toFixed(2)}%`;
    });

    const gastoTotal = anuncios.reduce((s, a) => s + a.spend, 0);
    const msg =
      `🎨 <b>Rendimiento de Creativos — ${esc(campanaNombre)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Período: ${periodo} | Total: $${gastoTotal.toFixed(2)} en ${anuncios.length} ads\n\n` +
      lineas.join('\n\n') +
      (ordenados.length >= 2 ? `\n\n💡 Escala el ganador, pausa el peor.` : '');

    await notif(msg);
    return `${anuncios.length} anuncios analizados. El ganador por CPL es "${ordenados[0]?.ad_nombre}". Ver Telegram para el ranking.`;
  },

  async breakdown_campana({ campana = null, periodo = 'last_7d' } = {}) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    let campanaId, campanaNombre;
    if (campana) {
      const campanas = await MetaConnector.getCampanas(false);
      const match = campanas.find(c =>
        c.id === campana || c.name.toLowerCase().includes(campana.toLowerCase())
      );
      if (!match) return `No encontré campaña con "${campana}".`;
      campanaId = match.id;
      campanaNombre = match.name;
    } else {
      const todas = await MetaConnector.getMetricasTodasCampanas(periodo);
      if (!todas.length) return 'No hay campañas con datos en ese período.';
      const top = todas.sort((a, b) => b.spend - a.spend)[0];
      campanaId = top.campana_id;
      campanaNombre = top.campana_nombre;
    }

    const [demografia, placement, frecuencia] = await Promise.all([
      MetaConnector.getBreakdownDemografico(campanaId, periodo),
      MetaConnector.getBreakdownPlacement(campanaId, periodo),
      MetaConnector.getFrecuenciaYAlcance(campanaId, periodo),
    ]);

    const lineas = [`🔬 <b>Desglose Profundo — ${esc(campanaNombre)}</b>`, `Período: ${periodo}`, `━━━━━━━━━━━━━━━━━━━━━━`];

    // Demografía
    if (demografia.length) {
      lineas.push(`\n👥 <b>Demografía (edad + género)</b>`);
      const demOrdenada = [...demografia].sort((a, b) => {
        if (a.cpl === null && b.cpl === null) return b.spend - a.spend;
        if (a.cpl === null) return 1; if (b.cpl === null) return -1;
        return a.cpl - b.cpl;
      }).slice(0, 8);
      demOrdenada.forEach(d => {
        const genero = d.genero === 'male' ? 'Hombres' : d.genero === 'female' ? 'Mujeres' : d.genero;
        const cplStr = d.cpl !== null ? `CPL $${d.cpl}` : 'sin conv.';
        lineas.push(`• ${genero} ${d.edad}: $${d.spend.toFixed(2)} | ${cplStr} | ${d.leads} leads | CTR ${d.ctr.toFixed(2)}%`);
      });
    }

    // Placement
    if (placement.length) {
      lineas.push(`\n📱 <b>Placement (plataforma + posición)</b>`);
      const plOrdenado = [...placement].sort((a, b) => {
        if (a.cpl === null && b.cpl === null) return b.spend - a.spend;
        if (a.cpl === null) return 1; if (b.cpl === null) return -1;
        return a.cpl - b.cpl;
      }).slice(0, 8);
      plOrdenado.forEach(p => {
        const plataforma = `${p.plataforma}/${p.posicion}`.replace(/_/g, ' ');
        const cplStr = p.cpl !== null ? `CPL $${p.cpl}` : 'sin conv.';
        lineas.push(`• ${plataforma}: $${p.spend.toFixed(2)} | ${cplStr} | ${p.leads} leads | CTR ${p.ctr.toFixed(2)}%`);
      });
    }

    // Frecuencia / fatiga
    if (frecuencia) {
      lineas.push(`\n🔄 <b>Frecuencia y Alcance</b>`);
      lineas.push(`Frecuencia: ${frecuencia.frequency.toFixed(2)}x | Alcance único: ${frecuencia.reach.toLocaleString()} personas`);
      const nivelEmoji = { fresco: '🟢', normal: '🟡', fatiga_moderada: '🟠', fatiga_critica: '🔴' };
      lineas.push(`Estado: ${nivelEmoji[frecuencia.nivel_fatiga] || '⚪'} ${frecuencia.nivel_fatiga.replace(/_/g, ' ').toUpperCase()}`);
      if (frecuencia.alerta_fatiga) {
        lineas.push(`⚠️ El anuncio está siendo visto demasiadas veces por las mismas personas. Considera rotar creativos.`);
      }
    }

    const msg = lineas.join('\n');
    await notif(msg);
    return `Desglose de "${campanaNombre}" completado — demografía, placement y frecuencia. Ver Telegram para los detalles.`;
  },

  async modo_autonomo({ accion }) {
    const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

    if (accion === 'estado') {
      const activo = await SystemState.isAutoMode();
      const msg = activo
        ? `🤖 <b>Modo autónomo: ACTIVO</b>\nJarvis opera solo — pausa, escala y ejecuta planes sin pedir aprobación.\nLímites de riesgo siguen activos ($${BUSINESS.presupuestoMaxDia}/día máx).`
        : `🧑 <b>Modo autónomo: INACTIVO</b>\nJarvis opera en modo normal — propone acciones y espera aprobación de Eduardo.`;
      await notif(msg);
      return msg;
    }

    if (accion === 'activar') {
      await SystemState.activarAutoMode();
      const msg = `🤖 <b>Modo autónomo ACTIVADO</b>\n\nJarvis ahora opera de forma completamente autónoma:\n• Supervisor ejecuta pausas, escalas y refreshes solo\n• Analista implementa el plan cada mañana sin esperar botones\n• Límites de riesgo siguen activos (max $${BUSINESS.presupuestoMaxDia}/día)\n• Escala de presupuesto: ${BUSINESS.escalera.pasos.join(' → ')} USD/día\n\nPara volver al modo normal escribe "desactiva el modo autónomo".`;
      await notif(msg);
      return msg;
    }

    if (accion === 'desactivar') {
      await SystemState.desactivarAutoMode();
      const msg = `🧑 <b>Modo autónomo DESACTIVADO</b>\n\nJarvis vuelve al modo normal — todas las decisiones de campaña pasarán por tu aprobación antes de ejecutarse.`;
      await notif(msg);
      return msg;
    }

    return `Acción no reconocida: "${accion}". Usa: activar, desactivar, estado.`;
  },
};

// Mapa de emojis para mensajes de actualización
const EMOJI_ESTADO_MAP = {
  idea: '💡', validando: '🔍', testing: '🧪', rentable: '✅', escalando: '🚀', pausado: '⏸️', muerto: '💀',
};
