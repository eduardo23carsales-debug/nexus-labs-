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

  // ── LLAMADA SIMPLE ───────────────────────────────────
  {
    name:        'llamar_simple',
    description: 'Llama a un número con Sofia sin contexto CRM — para llamadas rápidas a números nuevos.',
    parameters: {
      type: 'object',
      properties: {
        telefono: { type: 'string' },
        nombre:   { type: 'string' },
        segmento: { type: 'string', description: 'emprendedor-principiante, emprendedor-escalar, afiliado-hotmart, infoproductor, oferta-especial' },
      },
      required: ['telefono', 'nombre'],
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

  {
    name:        'ver_resultado_experimento',
    description: 'Detalle completo de un experimento: ventas, revenue, conversión, leads generados.',
    parameters: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Nombre o ID del experimento' },
      },
      required: ['buscar'],
    },
  },

  {
    name:        'iniciar_experimento',
    description: 'Crea un nuevo experimento de producto digital para validar en el mercado.',
    parameters: {
      type: 'object',
      properties: {
        nombre:   { type: 'string', description: 'Nombre del producto o experimento' },
        nicho:    { type: 'string', description: 'Nicho objetivo' },
        precio:   { type: 'number', description: 'Precio de venta en dólares' },
        objetivo: { type: 'string', description: 'Qué validar con este experimento' },
      },
      required: ['nombre', 'nicho', 'precio'],
    },
  },

  {
    name:        'generar_producto',
    description: 'Genera un producto digital completo con IA: módulos, contenido, precio. Tarda varios minutos — Jarvis notifica por Telegram cuando termina.',
    parameters: {
      type: 'object',
      properties: {
        nicho_json: { type: 'string', description: 'JSON del nicho (obtenido de investigar_nicho)' },
      },
      required: ['nicho_json'],
    },
  },

  {
    name:        'generar_contenido_producto',
    description: 'Genera el contenido completo de un producto digital existente (módulos, lecciones, PDFs).',
    parameters: {
      type: 'object',
      properties: {
        experimento_id: { type: 'number', description: 'ID del experimento' },
      },
      required: ['experimento_id'],
    },
  },

  {
    name:        'publicar_con_stripe',
    description: 'Publica un producto digital con página de ventas y link de pago de Stripe.',
    parameters: {
      type: 'object',
      properties: {
        experimento_id: { type: 'number', description: 'ID del experimento a publicar' },
      },
      required: ['experimento_id'],
    },
  },

  {
    name:        'publicar_hotmart',
    description: 'Publica un producto en Hotmart para venta como infoproducto.',
    parameters: {
      type: 'object',
      properties: {
        experimento_id: { type: 'number', description: 'ID del experimento a publicar en Hotmart' },
      },
      required: ['experimento_id'],
    },
  },

  // ── CAMPAÑAS DE TRÁFICO ───────────────────────────────
  {
    name:        'lanzar_campana_producto',
    description: 'Crea una campaña de tráfico en Meta Ads apuntando a la landing page de un producto.',
    parameters: {
      type: 'object',
      properties: {
        segmento:    { type: 'string', description: 'Segmento de audiencia' },
        url_destino: { type: 'string', description: 'URL de la landing page del producto' },
        presupuesto: { type: 'number', description: 'Presupuesto diario en dólares' },
      },
      required: ['segmento', 'url_destino', 'presupuesto'],
    },
  },

  // ── INVESTIGACIÓN ─────────────────────────────────────
  {
    name:        'investigar_nicho',
    description: 'Investiga un nicho de mercado con IA para encontrar productos rentables. Tarda varios minutos — notifica por Telegram al terminar.',
    parameters: {
      type: 'object',
      properties: {
        descripcion: { type: 'string', description: 'Describe el nicho o idea a investigar' },
      },
      required: ['descripcion'],
    },
  },

  {
    name:        'pipeline_completo',
    description: 'Ejecuta el pipeline completo: investiga nicho → genera producto → crea landing → lanza campaña. Proceso largo, notifica por Telegram en cada paso.',
    parameters: {
      type: 'object',
      properties: {
        descripcion: { type: 'string', description: 'Describe el nicho o idea de producto' },
        presupuesto: { type: 'number', description: 'Presupuesto diario en Meta Ads en dólares' },
      },
      required: ['descripcion'],
    },
  },

  {
    name:        'rechazar_nicho',
    description: 'Marca un nicho como rechazado para que el sistema lo evite en el futuro.',
    parameters: {
      type: 'object',
      properties: {
        nicho_json: { type: 'string', description: 'Nombre o descripción del nicho a rechazar' },
      },
      required: ['nicho_json'],
    },
  },

  // ── PRODUCTOS (ver y relanzar) ────────────────────────
  {
    name:        'ver_producto',
    description: 'Muestra los links de un producto digital: landing de ventas, URL del producto y Stripe. Úsalo cuando Eduardo diga "muéstrame el producto", "dame el link del curso", "revisa el producto X".',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID numérico del experimento' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name:        'relanzar_producto',
    description: 'Busca un producto digital ya creado por nombre o ID y lo publica con Stripe y campaña en Meta Ads. Úsalo cuando Eduardo diga "go a [producto]", "lanza el que ya estaba", "relanza [nombre]".',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial del producto o ID numérico del experimento' },
        presupuesto: { type: 'number', description: 'Presupuesto diario Meta Ads en USD. Default: 10' },
        segmento:    { type: 'string', description: 'Segmento Meta Ads. Default: emprendedor-principiante' },
      },
      required: ['nombre_o_id'],
    },
  },

  // ── CALENDARIO ───────────────────────────────────────
  {
    name:        'agendar_en_calendario',
    description: 'Agrega un evento al Google Calendar de Eduardo. Úsalo cuando diga "agrégalo al calendario", "ponlo en mi agenda", "anota esa cita".',
    parameters: {
      type: 'object',
      properties: {
        titulo:       { type: 'string', description: 'Título del evento' },
        descripcion:  { type: 'string', description: 'Detalles: quién, qué, contacto, notas' },
        fecha:        { type: 'string', description: 'Fecha y hora en lenguaje natural: "mañana a las 3pm", "el viernes a las 10am"' },
        duracion_min: { type: 'number', description: 'Duración en minutos. Default: 60' },
      },
      required: ['titulo', 'fecha'],
    },
  },

  // ── MEMORIA PERSISTENTE ──────────────────────────────
  {
    name:        'recordar',
    description: 'Guarda algo importante en la memoria persistente de Jarvis. Úsalo cuando Eduardo diga "recuerda que...", "guarda que...", o cuando aprendes algo relevante del negocio.',
    parameters: {
      type: 'object',
      properties: {
        titulo:      { type: 'string', description: 'Título corto descriptivo' },
        contenido:   { type: 'string', description: 'Detalle completo de lo que se recuerda' },
        tipo:        { type: 'string', enum: ['hecho', 'preferencia', 'instruccion', 'objetivo', 'aprendizaje', 'proyecto', 'cliente', 'alerta'], description: 'Categoría de la memoria' },
        importancia: { type: 'number', description: 'Del 1 al 10. Default: 5' },
      },
      required: ['titulo', 'contenido'],
    },
  },

  {
    name:        'ver_memoria',
    description: 'Muestra todas las memorias activas de Jarvis. Úsalo cuando Eduardo pregunta qué recuerdas, o antes de tomar decisiones importantes.',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'olvidar',
    description: 'Desactiva una memoria por su ID. Úsalo cuando Eduardo dice "olvida eso" o quiere corregir algo que Jarvis recordó mal. Primero usa ver_memoria para obtener el ID.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'ID de la memoria a desactivar (obtenerlo con ver_memoria)' },
      },
      required: ['id'],
    },
  },

  // ── CONFIGURACIÓN DEL SISTEMA ────────────────────────
  {
    name:        'ver_configuracion',
    description: 'Muestra los límites actuales del sistema: presupuesto máximo diario, CPL objetivo, límites de escalado. Úsalo cuando Eduardo pregunta "cuánto es el límite" o "qué configuración tienes".',
    parameters:  { type: 'object', properties: {} },
  },

  {
    name:        'actualizar_configuracion',
    description: 'Cambia un límite del sistema. Úsalo cuando Eduardo dice "sube el límite a X", "cambia el CPL objetivo a Y", "pon el máximo en Z". Claves: presupuesto_max_dia, limite_escalar_solo, limite_gasto_sin_lead, max_escalar_pct, cpl_objetivo.',
    parameters: {
      type: 'object',
      properties: {
        clave: {
          type: 'string',
          description: 'Parámetro a cambiar',
          enum: ['presupuesto_max_dia', 'limite_escalar_solo', 'limite_gasto_sin_lead', 'max_escalar_pct', 'cpl_objetivo'],
        },
        valor: { type: 'number', description: 'Nuevo valor numérico' },
      },
      required: ['clave', 'valor'],
    },
  },

  // ── TEST DE CREATIVOS ──────────────────────────────
  {
    name:        'test_creativos',
    description: 'Lanza un test A/B barato con 3 copies diferentes para descubrir cuál convierte mejor antes de escalar. Úsalo cuando Eduardo dice "prueba qué funciona mejor", "testea creativos", "quiero probar antes de invertir".',
    parameters: {
      type: 'object',
      properties: {
        segmento:        { type: 'string', description: 'Segmento Meta Ads: emprendedor-principiante, afiliado-hotmart, etc.' },
        url_destino:     { type: 'string', description: 'URL de la landing page o link de Stripe' },
        nombre_producto: { type: 'string', description: 'Nombre del producto para copies relevantes' },
        nicho:           { type: 'string', description: 'Nicho o tema del producto' },
        presupuesto:     { type: 'number', description: 'Presupuesto total del test en USD. Default: 15' },
      },
      required: ['segmento', 'url_destino'],
    },
  },

  // ── APRENDIZAJES ──────────────────────────────────
  {
    name:        'ver_aprendizajes',
    description: 'Muestra lo que el sistema ha aprendido de campañas, llamadas y ventas. Úsalo cuando Eduardo dice "¿qué hemos aprendido?", "¿qué funciona?", "¿qué ha fallado?", "muéstrame los aprendizajes".',
    parameters: {
      type: 'object',
      properties: {
        tipo:   { type: 'string', description: 'Filtrar por tipo: campana, llamada, producto, copy, email' },
        dias:   { type: 'number', description: 'Días hacia atrás. Default: 30' },
        limite: { type: 'number', description: 'Cuántos mostrar. Default: 15' },
      },
    },
  },

  // ── P&L REPORT ────────────────────────────────────
  {
    name:        'ver_pnl',
    description: 'Muestra el P&L real: ingresos Stripe, gasto Meta Ads y ganancia neta. Úsalo cuando Eduardo dice "¿cuánto hemos ganado?", "dame el P&L", "¿cuánto hemos gastado?", "¿estamos ganando dinero?".',
    parameters: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Días hacia atrás para el reporte. Default: 7' },
      },
    },
  },

  {
    name:        'ver_anuncios',
    description: 'Muestra los anuncios activos en Meta con copy e imagen. Úsalo cuando Eduardo dice "¿qué anuncios tengo?", "muéstrame los ads", "¿qué copy estamos usando?", "¿cómo se ven los creativos?".',
    parameters: {
      type: 'object',
      properties: {
        solo_activos: { type: 'boolean', description: 'Default true — solo anuncios activos.' },
      },
    },
  },

  {
    name:        'ver_ventas_stripe',
    description: 'Muestra ventas recientes en Stripe: quién compró, cuánto y cuándo. Úsalo cuando Eduardo dice "¿tenemos ventas?", "¿quién compró?", "muéstrame los pagos", "¿cuántas ventas tuvimos?".',
    parameters: {
      type: 'object',
      properties: {
        dias:   { type: 'number', description: 'Días hacia atrás. Default: 7' },
        limite: { type: 'number', description: 'Cuántas ventas mostrar. Default: 10' },
      },
    },
  },

  {
    name:        'leer_agenda',
    description: 'Lee los próximos eventos del Google Calendar de Eduardo. Úsalo cuando dice "¿qué tengo en la agenda?", "¿cuándo es mi próxima cita?", "muéstrame el calendario".',
    parameters: {
      type: 'object',
      properties: {
        dias: { type: 'number', description: 'Días hacia adelante. Default: 7' },
      },
    },
  },

  {
    name:        'ver_transcripciones',
    description: 'Muestra la transcripción de las últimas llamadas de Sofia. Úsalo cuando Eduardo dice "¿qué dijo Sofia?", "muéstrame la transcripción", "¿qué objeciones puso el cliente?", "¿de qué hablaron?".',
    parameters: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Si se da, muestra la transcripción de ese número específico.' },
        limite:   { type: 'number', description: 'Si no hay teléfono, cuántas llamadas mostrar. Default: 3' },
      },
    },
  },

  {
    name:        'ver_leads',
    description: 'Muestra el pipeline de leads: quién llegó, estado (NUEVO, LLAMADO, CITA, CERRADO). Úsalo cuando Eduardo dice "¿qué leads tenemos?", "¿quién llegó hoy?", "muéstrame los leads nuevos", "ver pipeline".',
    parameters: {
      type: 'object',
      properties: {
        estado: { type: 'string', description: 'Filtrar por estado: NUEVO, LLAMADO, CITA, CERRADO.' },
        limite: { type: 'number', description: 'Cuántos leads mostrar. Default: 15' },
      },
    },
  },

  {
    name:        'ver_llamadas',
    description: 'Estadísticas e historial de llamadas de Sofia: total, cuántas contestaron, tasa de citas. Úsalo cuando Eduardo dice "¿cuántas llamadas hizo Sofia?", "¿cómo van las llamadas?", "tasa de respuesta".',
    parameters: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Cuántas llamadas recientes mostrar. Default: 10' },
      },
    },
  },

  {
    name:        'reactivar_campana',
    description: 'Reactiva una campaña de Meta Ads pausada. Úsalo cuando Eduardo dice "reactiva la campaña", "activa de nuevo [nombre]", "despausa [campaña]".',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID de la campaña.' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name:        'ver_experimentos_pausados',
    description: 'Muestra productos pausados con la causa exacta: error de configuración, sin datos, mal rendimiento, etc. Úsalo cuando Eduardo dice "¿qué productos pausamos?", "¿cuáles podemos relanzar?", "¿por qué se pausó?".',
    parameters: {
      type: 'object',
      properties: {
        estados: { type: 'string', description: 'Estados separados por coma. Default: muerto,pausado' },
      },
    },
  },

  {
    name:        'auditar_producto',
    description: 'Verifica que un producto esté completamente conectado: landing accesible, botón Stripe en la página, producto entregable, campaña Meta apuntando a la URL correcta. Úsalo cuando Eduardo dice "verifica el producto", "¿está todo bien?", "¿va a funcionar la venta?", "audita [producto]".',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID del producto a auditar.' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name:        'auditar_campana_meta',
    description: 'Audita una campaña Meta de extremo a extremo: si está activa y entregando, si la landing responde, si el copy es específico al producto o es genérico, quality score y fatiga de audiencia. Si no se dice qué campaña, audita la más reciente. Úsalo cuando Eduardo dice "¿se creó bien la campaña?", "audita la campaña X", "¿está funcionando el anuncio?", "¿el copy está bien?", "revisa que todo esté alineado".',
    parameters: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'ID de la campaña en Meta. Opcional — si no se dice, usa la más reciente.' },
      },
    },
  },

  {
    name:        'reparar_contenido_producto',
    description: 'Regenera y guarda el contenido del producto (lo que ve el comprador) sin tocar Stripe ni campañas. Úsalo cuando Eduardo dice "el acceso da error", "regenera el contenido", "el /acceso/ da 404", "arregla el producto".',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID del producto a reparar.' },
      },
      required: ['nombre_o_id'],
    },
  },

  {
    name:        'test_entrega_producto',
    description: 'Envía un email de prueba a Eduardo con el acceso al producto para verificar que el pipeline de entrega funciona. Úsalo cuando Eduardo dice "prueba el email de entrega", "mándate el producto de prueba", "¿funciona Resend?", "testea el email".',
    parameters: {
      type: 'object',
      properties: {
        nombre_o_id: { type: 'string', description: 'Nombre parcial o ID del producto a probar. Opcional — si no se da, usa el activo más reciente.' },
      },
    },
  },

  // ── SLIDESHOW (voz) ───────────────────────────────
  {
    name:        'lanzar_campana_slideshow',
    description: 'Crea una campaña Meta Ads con video slideshow automático: DALL-E genera 5 imágenes y Meta las convierte en video. Úsalo cuando Eduardo dice "lanza con slideshow", "crea ads con video", "quiero video en vez de foto", "haz un slideshow para X".',
    parameters: {
      type: 'object',
      properties: {
        nombre_producto: { type: 'string', description: 'Nombre del producto' },
        segmento:        { type: 'string', description: 'Segmento Meta. Default: emprendedor-principiante' },
        presupuesto:     { type: 'number', description: 'Presupuesto diario USD. Default: 10' },
        url_destino:     { type: 'string', description: 'URL de venta. Si no se da, usa formulario de leads.' },
      },
      required: ['nombre_producto'],
    },
  },

  // ── BIBLIOTECA, AUDIENCIAS Y ESCALADO META (voz) ──
  {
    name:        'ver_biblioteca_meta',
    description: 'Muestra videos e imágenes subidos a Meta Ads. Úsalo cuando Eduardo dice "¿qué videos tengo en Meta?", "muéstrame los creativos subidos", "ver biblioteca de videos".',
    parameters: { type: 'object', properties: { tipo: { type: 'string', enum: ['videos', 'imagenes', 'ambos'] } } },
  },

  {
    name:        'metricas_video',
    description: 'Métricas de video ads: vistas 3 segundos, tasa de completado, ThruPlay y costo por vista. Úsalo cuando Eduardo dice "¿cuántos ven el video completo?", "tasa de completado", "¿qué tan bien va el video?".',
    parameters: { type: 'object', properties: { campana: { type: 'string' }, periodo: { type: 'string' } } },
  },

  {
    name:        'ver_audiencias',
    description: 'Muestra todas las audiencias personalizadas: lookalikes, retargeting, listas de compradores. Úsalo cuando Eduardo dice "¿qué audiencias tenemos?", "¿hay lookalike?", "muéstrame las audiencias".',
    parameters: { type: 'object', properties: {} },
  },

  {
    name:        'crear_audiencia_lookalike',
    description: 'Crea lookalike de compradores o leads para escalar a personas similares. Úsalo cuando Eduardo dice "crea lookalike de compradores", "busca gente similar a los que compraron", "escala con lookalike".',
    parameters: { type: 'object', properties: { fuente: { type: 'string' }, ratio: { type: 'number' }, pais: { type: 'string' } } },
  },

  {
    name:        'crear_retargeting',
    description: 'Crea audiencia de visitantes que no compraron para remarketing. Úsalo cuando Eduardo dice "crea retargeting", "apunta a los que visitaron la landing", "quiero hacer remarketing".',
    parameters: { type: 'object', properties: { dias: { type: 'number' } } },
  },

  {
    name:        'duplicar_adset_ganador',
    description: 'Duplica el adset con mejor CPL y lo lanza con más presupuesto. Úsalo cuando Eduardo dice "duplica el mejor adset", "escala el segmento que más convierte", "dobla el que funciona".',
    parameters: { type: 'object', properties: { campana: { type: 'string' }, presupuesto: { type: 'number' }, periodo: { type: 'string' } } },
  },

  {
    name:        'breakdown_geografico',
    description: 'Qué estados o regiones de USA convierten mejor y cuáles queman dinero. Úsalo cuando Eduardo dice "¿qué estado convierte más?", "¿dónde están los mejores leads?", "breakdown por estado".',
    parameters: { type: 'object', properties: { campana: { type: 'string' }, periodo: { type: 'string' } } },
  },

  {
    name:        'tendencia_campana',
    description: 'Compara esta semana vs la semana pasada: si el CPL sube o baja, si los leads aumentan. Úsalo cuando Eduardo dice "¿está mejorando?", "¿el CPL subió?", "tendencia vs semana pasada".',
    parameters: { type: 'object', properties: { campana: { type: 'string' } } },
  },

  // ── INTELIGENCIA META ADS (voz) ───────────────────
  {
    name:        'diagnostico_meta',
    description: 'Diagnóstico completo con IA de todas las campañas Meta Ads: qué está fallando, dónde se va el dinero, qué pausar y qué escalar. Úsalo cuando Eduardo dice "¿por qué no tengo ventas?", "¿qué está fallando?", "analiza mis campañas", "dame un diagnóstico de Meta", "¿dónde se va el dinero?".',
    parameters: {
      type: 'object',
      properties: {
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d', enum: ['last_7d', 'last_14d', 'last_30d', 'yesterday', 'this_month'] },
      },
    },
  },

  {
    name:        'metricas_adsets',
    description: 'Ranking de Ad Sets por CPL: qué segmento de audiencia convierte mejor y cuál está quemando dinero. Úsalo cuando Eduardo dice "¿qué audiencia está funcionando?", "¿qué adset pauso?", "muéstrame los segmentos".',
    parameters: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial de la campaña. Opcional — si no se da, usa la de mayor gasto.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d' },
      },
    },
  },

  {
    name:        'metricas_anuncios',
    description: 'Ranking de creativos por CPL: qué copy e imagen convierte mejor y cuál es el peor. Úsalo cuando Eduardo dice "¿qué copy está funcionando?", "¿qué anuncio convierte más?", "¿cuál creativo ganó?".',
    parameters: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial de la campaña. Opcional.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d' },
      },
    },
  },

  {
    name:        'breakdown_campana',
    description: 'Desglose de una campaña por edad, género, placement (Facebook vs Instagram vs Reels) y frecuencia. Úsalo cuando Eduardo dice "¿qué edad está comprando?", "¿funciona mejor en Instagram?", "¿hay fatiga?", "¿en qué placement convierte?".',
    parameters: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial de la campaña. Opcional.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d' },
      },
    },
  },

  // ── CALIDAD, CONTROL GRANULAR Y ESCALADO (voz) ────
  {
    name:        'quality_scores',
    description: 'Calidad de los anuncios según Meta: ranking de calidad, engagement y conversión por creativo. Úsalo cuando Eduardo dice "¿qué calidad tienen mis anuncios?", "¿están penalizados mis creativos?", "quality score de Meta", "¿Meta dice que son buenos?".',
    parameters: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial de la campaña. Opcional.' },
      },
    },
  },

  {
    name:        'breakdown_dispositivo',
    description: 'Compara el rendimiento en móvil vs desktop: CPL, impresiones y gasto por dispositivo. Úsalo cuando Eduardo dice "¿funciona mejor en móvil?", "¿desktop convierte?", "breakdown por dispositivo", "¿dónde se gasta más?".',
    parameters: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial de la campaña. Opcional.' },
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d' },
      },
    },
  },

  {
    name:        'breakdown_horario',
    description: 'Muestra en qué horas del día llegan más leads y hay menor CPL. Úsalo cuando Eduardo dice "¿a qué hora convierte más?", "horario con más leads", "¿cuándo debo pausar los ads?", "dayparting".',
    parameters: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial de la campaña. Opcional.' },
      },
    },
  },

  {
    name:        'pausar_adset',
    description: 'Pausa un Ad Set específico por nombre dentro de cualquier campaña. Úsalo cuando Eduardo dice "pausa el adset X", "detén el segmento Y", "pausa ese grupo de anuncios".',
    parameters: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre parcial del Ad Set a pausar' },
      },
      required: ['nombre'],
    },
  },

  {
    name:        'pausar_ad',
    description: 'Pausa un anuncio específico por nombre. Úsalo cuando Eduardo dice "pausa el anuncio X", "detén ese creativo", "pausa el ad que dice [copy]".',
    parameters: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre parcial del anuncio a pausar' },
      },
      required: ['nombre'],
    },
  },

  {
    name:        'refresh_creativo',
    description: 'Detecta fatiga creativa (frecuencia alta) y genera un nuevo slideshow automáticamente para renovar los anuncios. Úsalo cuando Eduardo dice "refresca los creativos", "fatiga creativa", "hay que cambiar los ads", "el público ya los vio mucho".',
    parameters: {
      type: 'object',
      properties: {
        campana:         { type: 'string', description: 'Nombre parcial de la campaña. Opcional.' },
        nombre_producto: { type: 'string', description: 'Nombre del producto para generar nuevas imágenes. Opcional.' },
        nicho:           { type: 'string', description: 'Nicho del producto. Opcional.' },
      },
    },
  },

  {
    name:        'analisis_breakeven',
    description: 'Calcula el CPL máximo que podemos pagar para no perder dinero y compara contra el CPL actual de cada campaña. Úsalo cuando Eduardo dice "¿estamos ganando o perdiendo?", "¿cuál es el break even?", "¿cuánto podemos pagar por lead?", "análisis de rentabilidad".',
    parameters: {
      type: 'object',
      properties: {
        periodo: { type: 'string', description: 'Período: last_7d (default), last_14d, last_30d' },
      },
    },
  },

  {
    name:        'escalar_escalera',
    description: 'Sube el presupuesto al siguiente paso de la escalera segura: 10→20→40→80→150→300 USD/día, solo si el CPL está dentro del objetivo. Úsalo cuando Eduardo dice "sube el presupuesto al siguiente nivel", "escala la campaña", "siguiente paso en la escalera", "¿podemos escalar?".',
    parameters: {
      type: 'object',
      properties: {
        campana: { type: 'string', description: 'Nombre parcial de la campaña a escalar. Opcional — usa la de menor CPL si no se especifica.' },
      },
    },
  },

  // ── MODO AUTÓNOMO (voz) ───────────────────────────
  {
    name:        'modo_autonomo',
    description: 'Activa, desactiva o consulta el estado del modo autónomo de Jarvis. Cuando está activo, el Supervisor y el Analista operan solos sin pedir aprobación. Úsalo cuando Eduardo dice "toma el control autónomo", "opera solo", "activa el modo Jarvis", "desactiva el modo autónomo", "¿estás operando solo?", "¿está activo el modo autónomo?".',
    parameters: {
      type: 'object',
      properties: {
        accion: {
          type: 'string',
          description: 'activar, desactivar, o estado',
          enum: ['activar', 'desactivar', 'estado'],
        },
      },
      required: ['accion'],
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
- Diagnóstico Meta: analizar por qué no hay ventas, ranking de adsets y creativos, breakdown por edad/placement/frecuencia
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
