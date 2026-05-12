// ════════════════════════════════════════════════════
// TRADING PROFESSOR — Base de conocimiento
// Agrega aquí conceptos, estrategias, FAQs y respuestas
// modelo. Cuando más llenes esto, mejor responde el profesor.
// ════════════════════════════════════════════════════

export const CONOCIMIENTO = {

  // ── Conceptos fundamentales ──────────────────────
  conceptos: [
    {
      termino: 'Soporte y Resistencia',
      definicion: 'Niveles de precio donde el mercado históricamente rebota. El soporte es el piso (precio donde los compradores entran fuerte). La resistencia es el techo (precio donde los vendedores toman control).',
      ejemplo: 'Si el precio de EUR/USD siempre sube cuando llega a 1.0800, ese es tu soporte. No compres arriba — espera que llegue ahí.',
    },
    {
      termino: 'Vela Japonesa (Candlestick)',
      definicion: 'Representación visual de 4 precios en un período: apertura, cierre, máximo y mínimo. El cuerpo muestra si cerró arriba (verde/alcista) o abajo (roja/bajista) del precio de apertura.',
      ejemplo: 'Una vela verde larga sin sombras = compradores dominaron todo el período. Una vela con cuerpo pequeño y sombras largas = indecisión en el mercado.',
    },
    {
      termino: 'Stop Loss',
      definicion: 'Orden automática que cierra tu operación si el precio va en tu contra hasta un punto que definiste antes de entrar. No es opcional — es lo que separa a los traders profesionales de los que quiebran.',
      ejemplo: 'Compras Apple a $180. Pones stop loss en $175. Si cae a $175, la operación se cierra sola y pierdes $5 por acción, no $50.',
    },
    {
      termino: 'Take Profit',
      definicion: 'Orden automática que cierra tu operación cuando el precio llega a tu objetivo de ganancia. Te protege de la codicia — el peor enemigo del trader.',
      ejemplo: 'Compras a $180, stop loss en $175, take profit en $190. Relación riesgo/beneficio 1:2. Por cada $5 que arriesgas, ganas $10.',
    },
    {
      termino: 'Gestión de Riesgo',
      definicion: 'La regla más importante del trading. Nunca arriesgues más del 1-2% de tu capital en una sola operación. Con $1,000 de cuenta, máximo $10-$20 por trade.',
      ejemplo: 'Si arriesgas 10% por operación y pierdes 5 seguidas (algo normal), pierdes la mitad de tu cuenta. Con 1%, necesitas 100 pérdidas seguidas para perder todo.',
    },
    {
      termino: 'Tendencia',
      definicion: 'Dirección general del mercado. Alcista (Higher Highs + Higher Lows), bajista (Lower Highs + Lower Lows) o lateral (rango). La regla: opera a favor de la tendencia, no en contra.',
      ejemplo: 'Si el mercado lleva 3 meses subiendo, no busques ventas. Busca compras en cada pullback (retroceso).',
    },
    {
      termino: 'Spread',
      definicion: 'La diferencia entre el precio de compra y el precio de venta. Es cómo gana el broker. Un spread de 2 pips en EUR/USD significa que el mercado tiene que moverte 2 pips antes de empezar a ganar.',
      ejemplo: 'EUR/USD compra: 1.0802, venta: 1.0800. Spread = 2 pips. Cuanto menor el spread, mejor el broker.',
    },
    {
      termino: 'Apalancamiento',
      definicion: 'Permite controlar posiciones más grandes que tu capital real. Con apalancamiento 1:10 y $100, controlas $1,000. Amplifica ganancias Y pérdidas por igual. Peligroso para principiantes.',
      ejemplo: 'Con $100 y apalancamiento 1:100, un movimiento del 1% en tu contra = pierdes todo tu capital. Empieza con 1:5 o 1:10 máximo.',
    },
    {
      termino: 'Volumen',
      definicion: 'Cantidad de contratos o acciones operadas en un período. Alto volumen confirma movimientos. Bajo volumen = movimientos poco confiables.',
      ejemplo: 'Una ruptura de resistencia con alto volumen es real. Una ruptura con bajo volumen probablemente es una trampa.',
    },
    {
      termino: 'Pullback',
      definicion: 'Retroceso temporal dentro de una tendencia antes de continuar en la dirección original. Es la oportunidad de entrada que los profesionales esperan.',
      ejemplo: 'Tendencia alcista sube de $100 a $120. Retrocede a $115. Eso es el pullback. Entras en $115 con stop en $112 y esperas continúe a $130.',
    },
  ],

  // ── Patrones de velas ─────────────────────────────
  patrones_velas: [
    {
      nombre: 'Doji',
      descripcion: 'Vela con apertura y cierre casi iguales. Cuerpo muy pequeño o inexistente. Señal de indecisión — ni compradores ni vendedores tienen control.',
      señal: 'Después de una tendencia fuerte, un Doji puede anunciar reversión. Espera confirmación en la siguiente vela.',
    },
    {
      nombre: 'Martillo (Hammer)',
      descripcion: 'Cuerpo pequeño arriba, sombra inferior larga (mínimo 2x el cuerpo). Aparece al final de una tendencia bajista.',
      señal: 'Alcista. Los vendedores empujaron el precio abajo pero los compradores recuperaron el control. Si aparece en soporte, alta probabilidad de rebote.',
    },
    {
      nombre: 'Estrella Fugaz (Shooting Star)',
      descripcion: 'Cuerpo pequeño abajo, sombra superior larga. Lo opuesto al martillo. Aparece al final de tendencia alcista.',
      señal: 'Bajista. Los compradores llevaron el precio arriba pero los vendedores tomaron el control al cierre. En resistencia = posible caída.',
    },
    {
      nombre: 'Envolvente Alcista (Bullish Engulfing)',
      descripcion: 'Vela roja seguida de vela verde que cubre completamente el cuerpo de la anterior.',
      señal: 'Fuerte señal alcista. Los compradores superaron completamente la sesión anterior. Mejor cuando aparece en soporte o tras caída prolongada.',
    },
    {
      nombre: 'Envolvente Bajista (Bearish Engulfing)',
      descripcion: 'Vela verde seguida de vela roja que cubre completamente el cuerpo de la anterior.',
      señal: 'Fuerte señal bajista. Los vendedores tomaron el control por completo. Mejor en resistencia o tras subida prolongada.',
    },
  ],

  // ── Estrategias básicas ───────────────────────────
  estrategias: [
    {
      nombre: 'Scalping',
      descripcion: 'Operaciones de segundos a minutos. Muchas operaciones pequeñas buscando 5-15 pips por trade. Requiere máxima concentración y spreads bajos.',
      para_quien: 'Personas que pueden estar pegadas a la pantalla durante horas. NO recomendado para principiantes.',
      timeframes: 'M1, M5',
    },
    {
      nombre: 'Day Trading',
      descripcion: 'Abres y cierras operaciones en el mismo día. No dejas posiciones abiertas de noche. Evitas el riesgo de gaps o noticias nocturnas.',
      para_quien: 'Personas con 2-4 horas diarias disponibles. Requiere disciplina y reglas claras.',
      timeframes: 'M15, H1',
    },
    {
      nombre: 'Swing Trading',
      descripcion: 'Operaciones de 2 días a varias semanas. Buscas movimientos grandes. Menos tiempo en pantalla — revisas 2-3 veces al día.',
      para_quien: 'Personas con trabajo fijo que quieren hacer trading de forma semi-pasiva. El más recomendado para empezar.',
      timeframes: 'H4, Daily',
    },
    {
      nombre: 'Position Trading',
      descripcion: 'Operaciones de semanas a meses. Análisis fundamental + técnico. Muy pocas operaciones al año pero de gran tamaño.',
      para_quien: 'Inversores pacientes con visión macro. Más cercano a invertir que a hacer trading.',
      timeframes: 'Weekly, Monthly',
    },
  ],

  // ── Errores más comunes ───────────────────────────
  errores_comunes: [
    'Operar sin stop loss — "seguro regresa". El mercado no debe nada.',
    'Promediar pérdidas — añadir más contratos a una operación perdedora esperando recuperar.',
    'Revenge trading — operar impulsado por la emoción de recuperar una pérdida. Siempre termina peor.',
    'Sobreoperar — hacer 20 trades al día pensando que más = más ganancia. Calidad > cantidad.',
    'Ignorar la gestión de riesgo — arriesgar 20-50% del capital por operación.',
    'Operar sin plan — entrar porque "se ve bien" sin criterios claros de entrada y salida.',
    'Cambiar el stop loss en medio de la operación para evitar la pérdida.',
    'Creer que una racha de pérdidas significa que la siguiente sí va a ganar.',
  ],

  // ── FAQs frecuentes ───────────────────────────────
  faqs: [
    {
      pregunta: '¿Cuánto dinero necesito para empezar?',
      respuesta: 'Para practicar: $0 — usa cuenta demo (dinero virtual). Para operar real con disciplina: mínimo $500-$1,000. Con menos, el riesgo por operación es tan pequeño que no se siente real y no aprendes bien.',
    },
    {
      pregunta: '¿Cuánto tiempo tarda en aprender a ser rentable?',
      respuesta: 'Honestamente: 1-3 años de práctica constante. El 90% de los que empieza sin aprender pierde su capital en los primeros 6 meses. La curva de aprendizaje es real. Empieza con demo, luego micro-cuentas.',
    },
    {
      pregunta: '¿Cuál es el mejor mercado para empezar?',
      respuesta: 'Forex (específicamente EUR/USD o GBP/USD) para principiantes: opera 24 horas, spreads bajos, mucha liquidez. Acciones de USA si prefieres cosas conocidas como Apple, Tesla. Evita crypto al inicio — muy volátil.',
    },
    {
      pregunta: '¿Qué broker es confiable?',
      respuesta: 'Busca brokers regulados: en USA (CFTC/NFA regulados), en Europa (FCA o CySEC). OANDA, Interactive Brokers, TD Ameritrade son opciones sólidas. Evita brokers sin regulación clara que prometen bonos de depósito.',
    },
    {
      pregunta: '¿Los cursos de trading que venden en Instagram sirven?',
      respuesta: 'La mayoría vende el sueño de hacerse rico rápido. El conocimiento técnico puedes aprenderlo gratis en YouTube, BabyPips.com y libros. Lo que un buen curso SÍ puede darte: estructura, disciplina y mentoría real. Desconfía de quien muestra solo ganancias.',
    },
    {
      pregunta: '¿Se puede vivir del trading?',
      respuesta: 'Sí, pero no es rápido ni fácil. La mayoría de traders rentables tardó 3-5 años en serlo. Para vivir del trading necesitas capital real (mínimo $50,000-$100,000) o manejar cuentas de fondeo (prop firms). El camino: aprende → demo → cuenta pequeña → escalar gradualmente.',
    },
  ],

  // ── Indicadores técnicos ──────────────────────────
  indicadores: [
    {
      nombre: 'Media Móvil (MA)',
      descripcion: 'Promedio del precio en X períodos. Suaviza el ruido. La MA50 y MA200 son las más usadas. Cuando el precio está arriba de la MA200, tendencia alcista de largo plazo.',
      uso: 'Identificar tendencia y posibles soportes/resistencias dinámicos.',
    },
    {
      nombre: 'RSI (Relative Strength Index)',
      descripcion: 'Oscilador 0-100 que mide velocidad del movimiento. Por encima de 70 = sobrecomprado (posible caída). Por debajo de 30 = sobrevendido (posible rebote).',
      uso: 'Confirmar si una tendencia está agotada. No usar solo — combinar con precio.',
    },
    {
      nombre: 'MACD',
      descripcion: 'Mide la diferencia entre dos medias móviles. Cuando la línea MACD cruza hacia arriba la señal = momentum alcista. Hacia abajo = bajista.',
      uso: 'Confirmar cambios de tendencia y momentum.',
    },
    {
      nombre: 'Bandas de Bollinger',
      descripcion: 'Tres líneas: media móvil central + 2 bandas (superior e inferior). El precio tiende a rebotar entre las bandas. Cuando están muy juntas (squeeze), se aproxima un movimiento fuerte.',
      uso: 'Detectar volatilidad y posibles reversiones en los extremos.',
    },
  ],

  // ── Psicología del trading ────────────────────────
  psicologia: [
    'El trading es 20% técnica y 80% psicología. Puedes saber todo sobre análisis y perder por emociones.',
    'Acepta desde el inicio que PERDER es parte del proceso. Un trader rentable puede perder el 40% de sus operaciones y seguir ganando dinero.',
    'El miedo y la codicia son tus peores enemigos. El plan pre-escrito antes de entrar es tu mejor protección.',
    'Lleva un diario de trading: anota cada operación, por qué entraste, qué sentiste, resultado. Es la única forma de identificar tus patrones de error.',
    'El tamaño de la posición no lo decide el setup — lo decide tu gestión de riesgo. Olvida eso y perderás.',
  ],
};

export default CONOCIMIENTO;
