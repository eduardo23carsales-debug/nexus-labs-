// ════════════════════════════════════════════════════
// SEGMENTOS — Definición de audiencias y mensajes
// Cada segmento = un tipo de prospecto con su copy
// Modificar aquí cambia todos los ads de ese segmento
// ════════════════════════════════════════════════════

// ⚠️ PENDIENTE: Actualizar copies con el producto real
// del primer lanzamiento. Los segmentos de abajo son
// el framework genérico para productos digitales.

export const SEGMENTOS = {

  'emprendedor-principiante': {
    nombre:   'Emprendedor Principiante',
    hook:     '¿Quieres generar ingresos online pero no sabes por dónde empezar?',
    copies: [
      {
        tipo:    'emocional',
        titulo:  '¿Trabajas duro pero el dinero no alcanza?',
        cuerpo:  'Miles de personas en Miami y toda América Latina ya están generando ingresos extra desde casa con productos digitales. Sin experiencia previa, sin inventario, sin horarios fijos.',
        cta:     'Quiero ver cómo',
      },
      {
        tipo:    'directo',
        titulo:  'Tu primer ingreso digital en 30 días',
        cuerpo:  'Sistema probado: elige el nicho, lanza el producto, automatiza las ventas. Nosotros te mostramos el camino exacto.',
        cta:     'Ver el sistema',
      },
      {
        tipo:    'social',
        titulo:  '"No sabía nada de internet y hoy genero $2,000 al mes"',
        cuerpo:  'Personas como tú están usando este sistema ahora mismo. La diferencia es que dieron el primer paso.',
        cta:     'Quiero empezar',
      },
    ],
    imagenPrompt: 'Hands typing on a sleek MacBook in a cozy modern home office, warm golden ambient lamp, small succulent on desk, shallow depth of field bokeh background, no faces, no text on screen, shot on Canon EOS R5 f/1.8, cinematic color grading, 8K ultra-detailed',
  },

  'emprendedor-escalar': {
    nombre:   'Emprendedor que Quiere Escalar',
    hook:     '¿Ya vendes online pero sigues intercambiando tiempo por dinero?',
    copies: [
      {
        tipo:    'emocional',
        titulo:  'Tienes un negocio, pero aún no tienes libertad',
        cuerpo:  'Si te vas de vacaciones, el negocio para. Es hora de construir un sistema que venda por ti mientras duermes.',
        cta:     'Ver cómo automatizar',
      },
      {
        tipo:    'directo',
        titulo:  'Automatiza tus ventas con IA y Meta Ads',
        cuerpo:  'Publicidad inteligente + producto digital + sistema de seguimiento automático = ingresos predecibles sin depender de tu tiempo.',
        cta:     'Quiero esto para mi negocio',
      },
      {
        tipo:    'social',
        titulo:  'De $3K a $15K al mes sin contratar personal',
        cuerpo:  'El mismo sistema que usaron estos emprendedores está disponible para ti. La automatización no es para las grandes empresas — es para quien quiere crecer sin agotarse.',
        cta:     'Cómo lo lograron',
      },
    ],
    imagenPrompt: 'Minimalist entrepreneur workspace with dual monitors showing revenue growth charts, morning light through floor-to-ceiling window, organized desk with open notebook and coffee cup, over-the-shoulder angle no face visible, no text labels, professional commercial photography, cinematic lighting, 8K',
  },

  'afiliado-hotmart': {
    nombre:   'Afiliado Hotmart',
    hook:     '¿Quieres ganar comisiones vendiendo productos digitales sin crearlos tú?',
    copies: [
      {
        tipo:    'emocional',
        titulo:  'Gana comisiones mientras duermes — sin crear nada',
        cuerpo:  'El marketing de afiliados en Hotmart te permite ganar entre 40% y 80% de comisión por cada venta. Sin inventario, sin soporte, sin riesgos.',
        cta:     'Quiero ser afiliado',
      },
      {
        tipo:    'directo',
        titulo:  'Sistema de afiliados con Meta Ads: comisiones automáticas',
        cuerpo:  'Conecta tus campañas de Meta con los productos más vendidos de Hotmart. Nosotros te enseñamos la configuración exacta que funciona.',
        cta:     'Ver el método',
      },
      {
        tipo:    'social',
        titulo:  '"Gané mis primeras comisiones en la primera semana"',
        cuerpo:  'Con el sistema correcto, los primeros resultados llegan rápido. La clave está en elegir el producto correcto y la audiencia correcta.',
        cta:     'Empezar ahora',
      },
    ],
    imagenPrompt: 'Close-up of hands holding smartphone showing large dollar commission amounts on a clean earnings app, blurred modern home office background, warm ambient lighting, no face visible, no brand logos, shallow depth of field, professional product photography, cinematic color grade, 8K',
  },

  'infoproductor': {
    nombre:   'Creador de Infoproductos',
    hook:     '¿Tienes conocimiento valioso pero no sabes cómo monetizarlo?',
    copies: [
      {
        tipo:    'emocional',
        titulo:  'Tu conocimiento vale miles de dólares — pero aún no lo sabes',
        cuerpo:  'Lo que tú sabes hacer, miles de personas necesitan aprenderlo. Un curso, una mentoría, un ebook — y ya tienes un producto digital que se vende solo.',
        cta:     'Quiero lanzar mi producto',
      },
      {
        tipo:    'directo',
        titulo:  'Lanza tu infoproducto en 21 días con IA',
        cuerpo:  'Usamos inteligencia artificial para crear el contenido, diseñar el embudo y lanzar las campañas. Tú solo traes el conocimiento.',
        cta:     'Ver el proceso',
      },
      {
        tipo:    'social',
        titulo:  'De experto a dueño de un negocio digital',
        cuerpo:  'Coaches, consultores, técnicos y profesionales ya están monetizando lo que saben. El mercado hispanohablante está hambriento de contenido de calidad.',
        cta:     'Monetizar mi conocimiento',
      },
    ],
    imagenPrompt: 'Professional home studio recording setup: large ring light illuminating a microphone and open laptop, dark background with warm accent lighting, no faces, notebooks and headphones on desk, over-the-shoulder view, commercial studio photography, 8K cinematic',
  },

  'oferta-especial': {
    nombre:   'Oferta Especial',
    hook:     'Acceso limitado — sistema completo de ingresos digitales',
    copies: [
      {
        tipo:    'emocional',
        titulo:  'Esta semana: acceso al sistema completo con descuento',
        cuerpo:  'Todo lo que necesitas para generar tus primeros ingresos digitales, en un solo lugar. Precio de lanzamiento por tiempo limitado.',
        cta:     'Ver oferta',
      },
      {
        tipo:    'directo',
        titulo:  'Oferta de lanzamiento — plazas limitadas',
        cuerpo:  'Sistema de ventas automáticas + soporte directo + comunidad privada. Solo esta semana al precio especial de lanzamiento.',
        cta:     'Reservar mi plaza',
      },
      {
        tipo:    'social',
        titulo:  'Los primeros 50 ya están adentro',
        cuerpo:  'El grupo inicial está generando resultados. Quedan pocas plazas al precio de lanzamiento antes de que suba.',
        cta:     'Entrar ahora',
      },
    ],
    imagenPrompt: 'Premium laptop on dark luxury desk displaying a glowing countdown timer, dramatic moody lighting with gold accents, sense of scarcity and exclusivity, no people, no faces, wide bokeh background, high-end commercial photography, 8K cinematic lighting',
  },

};

export const SEGMENTOS_LISTA = Object.keys(SEGMENTOS);

export default SEGMENTOS;
