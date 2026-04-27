// ════════════════════════════════════════════════════
// JARVIS — Herramientas completas con CRM
// ════════════════════════════════════════════════════

import { llamarLead }                           from '../call_agent/caller.js';
import { llamarConContexto }                    from '../call_agent/context-caller.js';
import { procesarLead }                         from '../lead_system/capture.js';
import { ejecutarAnalista }                     from '../agents/analista/index.js';
import { ejecutarSupervisor }                   from '../agents/supervisor/index.js';
import { crearCampana, crearCampañaTrafico, generarYSubirImagen } from '../ads_engine/campaign-creator.js';
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
import { ProjectsDB }                           from '../crm/projects.db.js';

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
        segmento:     { type: 'string', description: 'Uno de: emprendedor-principiante, emprendedor-escalar, afiliado-hotmart, infoproductor, oferta-especial' },
        url_destino:  { type: 'string', description: 'URL de la página de venta (Hotmart checkout, landing page, etc.)' },
        presupuesto:  { type: 'number', description: 'Presupuesto diario en USD' },
      },
      required: ['segmento', 'url_destino', 'presupuesto'],
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
];

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

  async crear_campana_ads({ segmento, presupuesto }) {
    const resultado = await crearCampana(segmento, presupuesto);
    return `Campaña de leads creada para "${segmento}" con $${presupuesto}/día. ID: ${resultado.campaign_id}. Los leads llegarán al CRM automáticamente.`;
  },

  async lanzar_campana_producto({ segmento, url_destino, presupuesto }) {
    const resultado = await crearCampañaTrafico(segmento, url_destino, presupuesto);
    return `Campaña de tráfico creada para "${segmento}" con $${presupuesto}/día.\nDestino: ${url_destino}\nID: ${resultado.campaign_id}\n${resultado.ads.length} ads activos.`;
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

    await notif(`🔄 <b>Relanzando "${esc(exp.nombre)}"</b> (experimento #${exp.id})\n\nPaso 1/2 — Lanzando campaña Meta Ads...`);

    let campaña;
    try {
      campaña = await crearCampana(segmento, presupuesto, {});
    } catch (err) {
      return `❌ Meta Ads falló: ${err.message}\nEl producto #${exp.id} sigue guardado — intenta de nuevo cuando el token esté listo.`;
    }

    if (!StripeConnector.disponible()) {
      return `✅ Campaña Meta Ads activa — "${campaña.nombre}"\n⚠️ Stripe no configurado — agrega STRIPE_SECRET_KEY para generar la landing page.`;
    }

    await notif(`✅ Campaña Meta Ads creada\n\nPaso 2/2 — Publicando landing page con Stripe...`);

    const nichoBasico = {
      nombre_producto:      exp.nombre,
      nicho:                exp.nicho || exp.nombre,
      tipo:                 exp.tipo || 'guia_pdf',
      precio:               exp.precio || 27,
      problema_que_resuelve: exp.nombre,
      subtitulo:            '',
      cliente_ideal:        'Emprendedor hispano en USA',
      quick_win:            'Resultados desde el primer día',
      puntos_de_venta:      [],
    };

    try {
      const stripeInfo = await publicarConStripe(nichoBasico, null, exp.id);
      return `✅ Relanzado exitosamente:\n📦 ${exp.nombre}\n🌐 Landing: ${stripeInfo.landing_url}\n💳 Stripe: ${stripeInfo.stripe_payment_link}\n📊 Campaña: ${campaña.nombre}`;
    } catch (err) {
      return `✅ Campaña Meta Ads activa. Stripe falló: ${err.message}`;
    }
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
      await notif(`✅ <b>Producto generado</b> (${(html.length / 1024).toFixed(0)} KB)\n\nPaso 3/4 — Creando imagen de portada con IA...`);

      // Paso 3: Imagen de portada (no fatal si falla)
      let imagenHash = null;
      try {
        const promptImagen = [
          `Modern digital marketing ad image for a course about earning money online with AI,`,
          `Hispanic entrepreneur working on a sleek laptop, phone showing cash app notifications,`,
          `clean minimal background with subtle blue light glow, professional photo style,`,
          `NO TEXT, NO WORDS, NO LETTERS anywhere in the image,`,
          `cinematic lighting, aspirational lifestyle, 4k quality`,
        ].join(' ');
        const imagen = await generarYSubirImagen(promptImagen);
        imagenHash = imagen.hash;
        await TelegramConnector.notificarFoto(imagen.url, `🖼️ <b>Portada generada para "${nicho.nombre_producto}"</b>`).catch(() => {});
        await notif(`✅ <b>Imagen de portada creada</b>\n\nPaso 4/4 — Lanzando campaña en Meta Ads con $${presupuesto}/día...`);
      } catch (err) {
        await notif(`⚠️ Imagen falló (${err.message}), usando imagen genérica del segmento.\n\nPaso 4/4 — Lanzando campaña...`);
      }

      checkCancelado();
      // Paso 4: Crear campaña en Meta Ads
      let campaña;
      try {
        campaña = await crearCampana(segmento, presupuesto, { imagenHash });
      } catch (err) {
        await notif(`❌ <b>Pipeline falló en Paso 4</b> (crear campaña Meta)\n<code>${esc(err.message)}</code>\n\nProducto ya guardado — puedes relanzar solo la campaña.`);
        throw err;
      }

      // Vincular campaña al proyecto y registrar inversión inicial
      if (projectId && campaña?.campaign_id) {
        await ProjectsDB.linkearCampana(projectId, campaña.campaign_id).catch(() => {});
        await ProjectsDB.actualizarMetricas(projectId, { inversion: presupuesto }, 'pipeline').catch(() => {});
      }

      // Paso 5: Publicar con Stripe si está configurado
      let stripeInfo = null;
      if (StripeConnector.disponible()) {
        await notif(`✅ <b>Campaña en Meta Ads activa</b>\n\nPaso 5/5 — Publicando landing page con Stripe...`);
        try {
          stripeInfo = await publicarConStripe(nicho, html, exp?.id);
          if (projectId && stripeInfo?.landing_url) {
            await ProjectsDB.registrarAccionAgente(projectId, 'stripe', 'landing_publicada', stripeInfo.landing_url).catch(() => {});
          }
        } catch (err) {
          await notif(`⚠️ Stripe falló: ${err.message}\nEl resto del pipeline está OK.`);
        }
      }

      const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
      const accesoUrl = stripeInfo?.slug ? `${dominio}/acceso/${stripeInfo.slug}` : null;

      await notif(
        `🚀 <b>Pipeline completo</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 Producto: ${nicho.nombre_producto}\n` +
        `💵 Precio: $${nicho.precio} | Score: ${nicho.score}/100\n` +
        `📊 Campaña Meta: ${campaña.nombre}\n` +
        `💰 Presupuesto: $${presupuesto}/día\n` +
        `🖼️ Imagen: ${imagenHash ? 'portada del producto ✅' : 'genérica del segmento'}\n` +
        (stripeInfo
          ? `🌐 Landing de ventas: ${stripeInfo.landing_url}\n` +
            `💳 Stripe checkout: ${stripeInfo.stripe_payment_link}\n` +
            (accesoUrl ? `🎓 <b>Producto (lo que recibe el comprador):</b> ${accesoUrl}\n` : '')
          : `⚠️ Stripe no configurado — agrega STRIPE_SECRET_KEY\n`) +
        `\nCuando alguien paga → recibe email con el link del producto automáticamente.`
      );

      return `Pipeline completo. Producto: "${nicho.nombre_producto}" | Campaña ID: ${campaña.campaign_id} | Landing: ${stripeInfo?.landing_url || 'sin Stripe'}`;

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
          const cuerpoFinal = cuerpoConPixel + `\n\n_Si no deseas recibir más emails, [haz click aquí](${bajaUrl})_`;

          await ResendConnector.enviarEmailManual({
            para:   c.email,
            nombre: c.nombre,
            asunto,
            cuerpo: cuerpoFinal,
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

    // Buscar cliente en CRM si no hay contexto
    let contexto = contexto_crm || '';
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

    // Redactar email con Claude
    const prompt = [
      `Redacta un email profesional y persuasivo en español para un negocio llamado "${FROM_NAME ? 'Ganancias con AI' : 'Nexus Labs'}".`,
      `Destinatario: ${nombre || 'cliente'}`,
      `Objetivo del email: ${objetivo}`,
      contexto ? `Contexto del cliente: ${contexto}` : '',
      `Instrucciones:`,
      `- Tono cálido, directo y motivador`,
      `- Sin emojis excesivos — máximo 1-2`,
      `- Entre 3 y 6 párrafos cortos`,
      `- Incluye un llamado a la acción claro al final`,
      `- NO incluyas saludo inicial (lo agrega el sistema) ni firma (la agrega el sistema)`,
      `- Devuelve SOLO el cuerpo del email, nada más`,
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

    await ResendConnector.enviarEmailManual({ para, nombre, asunto: asuntoFinal, cuerpo });

    await TelegramConnector.notificar(
      `📧 <b>Email enviado</b>\n` +
      `Para: ${nombre || para} (${para})\n` +
      `Asunto: ${asuntoFinal}\n` +
      `Objetivo: ${objetivo}`
    ).catch(() => {});

    return `Email enviado a ${nombre || para} (${para}). Asunto: "${asuntoFinal}".`;
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
};

// Mapa de emojis para mensajes de actualización
const EMOJI_ESTADO_MAP = {
  idea: '💡', validando: '🔍', testing: '🧪', rentable: '✅', escalando: '🚀', pausado: '⏸️', muerto: '💀',
};
