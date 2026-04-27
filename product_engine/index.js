// ════════════════════════════════════════════════════
// PRODUCT ENGINE — Genera productos digitales premium
// 5 tipos: prompts, plantilla, guia_pdf, mini_curso, toolkit
// Cada sección se genera por separado para evitar truncado
// ════════════════════════════════════════════════════

import { AnthropicConnector } from '../connectors/anthropic.connector.js';
import { TelegramConnector }  from '../connectors/telegram.connector.js';

const delay = ms => new Promise(r => setTimeout(r, ms));

const SYSTEM = `Eres un experto creador de productos digitales premium para el mercado hispano.
Tu misión: crear contenido que haga que el cliente diga "wow, pagué muy poco por esto".
Escribes para latinos reales — no para marketeros. Tu tono es de mentor cercano que da valor directo.

ESTÁNDAR DE CALIDAD — OBLIGATORIO EN CADA SECCIÓN:
1. LONGITUD: Mínimo 600 palabras por sección. Sin excepciones. El cliente pagó por esto.
2. PASOS EXACTOS: Cada instrucción incluye: dónde ir, qué hacer, qué esperar ver, cuánto tarda.
3. NÚMEROS REALES: Precios de herramientas, tiempos reales, porcentajes del mercado, ingresos típicos.
4. EJEMPLO CON NOMBRE: Un latino específico (nombre, ciudad, situación) que aplica esto y qué resultado logró.
5. ERROR COMÚN: Qué hace el 80% mal y cómo evitarlo.
6. ACCIÓN INMEDIATA: Termina con una tarea que se puede hacer en los próximos 30 minutos.
7. ZERO RELLENO: Sin frases vacías como "es importante recordar que" o "en conclusión". Directo al valor.
8. HERRAMIENTAS CONCRETAS: Nombra herramientas reales con su precio (gratis / $X/mes), no genéricas.

TONO Y VOZ:
- Habla de tú, no de usted
- Sé directo como un amigo que sabe del tema
- Incluye frases reales que diría alguien del mercado hispano (Hialeah, Houston, Chicago, Bogotá, CDMX)
- Cuando des un paso difícil, reconócelo: "Sé que esto puede parecer complicado, pero..."

Devuelves SOLO el HTML del contenido, sin html ni body tags.

RESTRICCIONES TÉCNICAS — CRÍTICO:
- NUNCA uses etiquetas script ni style
- Para destacar texto usa SOLO estas clases: .highlight .tip .info .card .section-title
- Atributos style solo para: margin, padding, gap, flex, grid, width, display
- NUNCA pongas colores inline (color:#xxx) — el diseño los maneja automáticamente`;

// ── Shell HTML con tabs y acordeon ───────────────────
function crearShellHTML(titulo, subtitulo, tipo, secciones) {
  const badges = {
    prompts:   '⚡ PROMPTS PREMIUM',
    plantilla: '📋 PLANTILLA PREMIUM',
    guia_pdf:  '📘 GUIA PREMIUM',
    mini_curso:'🎓 MINI CURSO',
    toolkit:   '🔧 TOOLKIT PREMIUM',
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0a;--surface:#141414;--surface2:#1c1c1c;--border:#262626;--accent:#3b82f6;--accent-dim:rgba(59,130,246,0.08);--text:#f0f0f0;--text-muted:#a3a3a3;--text-faint:#525252;--radius:8px}
body{font-family:'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.header{background:var(--surface);padding:48px 24px 40px;text-align:center;border-bottom:1px solid var(--border)}
.badge{display:inline-flex;align-items:center;gap:6px;background:var(--accent-dim);color:var(--accent);border:1px solid rgba(59,130,246,0.2);padding:4px 14px;border-radius:20px;font-size:0.7em;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:18px}
.header h1{font-family:'Poppins',sans-serif;color:#fff;font-size:clamp(1.4em,4vw,2.1em);font-weight:700;line-height:1.25;margin-bottom:10px}
.header p{color:var(--text-muted);font-size:1em;max-width:560px;margin:0 auto;line-height:1.65}
.layout{display:flex;min-height:calc(100vh - 160px)}
.sidebar{width:240px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);padding:16px 0;position:sticky;top:0;height:100vh;overflow-y:auto}
.sidebar-label{font-size:0.66em;font-weight:700;letter-spacing:2px;color:var(--text-faint);text-transform:uppercase;padding:8px 18px 10px;display:block}
.tab-btn{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;color:var(--text-muted);padding:10px 18px;cursor:pointer;font-size:0.875em;font-family:inherit;transition:all 0.15s;border-left:3px solid transparent;line-height:1.4;font-weight:500}
.tab-btn:hover{background:var(--surface2);color:var(--text)}
.tab-btn.active{background:var(--accent-dim);color:#fff;border-left-color:var(--accent);font-weight:600}
.tab-num{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--surface2);color:var(--text-faint);font-size:0.72em;font-weight:700;flex-shrink:0;transition:all 0.15s}
.tab-btn.active .tab-num{background:var(--accent);color:#fff}
.content{flex:1;padding:40px 44px;max-width:840px}
.tab-panel{display:none;animation:fadeIn 0.2s ease}
.tab-panel.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.section-title{font-family:'Poppins',sans-serif;font-size:1.4em;font-weight:700;color:#fff;margin-bottom:4px}
.section-sub{color:var(--text-faint);font-size:0.84em;margin-bottom:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:14px;overflow-x:auto}
.card h3{color:#fff;margin-bottom:10px;font-size:1em;font-weight:600}
.card h4{color:var(--text-muted);margin:16px 0 8px;font-size:0.79em;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.card p{color:#c4c4c4;line-height:1.8;margin-bottom:10px}
.card ul,.card ol{padding-left:20px}
.card li{color:#c4c4c4;line-height:1.8;margin-bottom:6px}
.card strong{color:var(--text)}
.highlight{border-left:3px solid var(--accent);background:var(--surface2);border-radius:0 var(--radius) var(--radius) 0;padding:16px 20px;margin:14px 0;color:var(--text);line-height:1.7;font-size:0.95em}
.tip{border-left:3px solid var(--text-faint);background:var(--surface2);border-radius:0 var(--radius) var(--radius) 0;padding:14px 20px;margin:14px 0;color:var(--text-muted);font-size:0.9em;line-height:1.7}
.info{border-left:3px solid var(--accent);background:var(--accent-dim);border-radius:0 var(--radius) var(--radius) 0;padding:14px 20px;margin:14px 0;color:#93c5fd;font-size:0.9em;line-height:1.7}
.prompt-box{background:#0a0a0a;border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin:12px 0;font-family:'Courier New',monospace;font-size:0.84em;color:#93c5fd;white-space:pre-wrap;line-height:1.8;position:relative}
.copy-btn{position:absolute;top:10px;right:10px;background:var(--surface2);color:var(--text-muted);border:1px solid var(--border);padding:4px 12px;border-radius:5px;cursor:pointer;font-size:0.74em;font-weight:600;transition:color 0.15s}
.copy-btn:hover{color:#fff}
.checklist{list-style:none;padding:0}
.checklist li{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);color:#c4c4c4;line-height:1.7;font-size:0.92em}
.checklist li::before{content:"□";color:var(--text-faint);font-size:1em;flex-shrink:0;margin-top:2px}
.accordion-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px;overflow:hidden}
.accordion-header{padding:14px 18px;cursor:pointer;color:#e5e7eb;display:flex;justify-content:space-between;align-items:center;font-weight:500;font-size:0.9em;transition:background 0.15s}
.accordion-header:hover{background:var(--surface2)}
.accordion-body{padding:0 18px 18px;color:#c4c4c4;line-height:1.8;display:none}
.accordion-body p{margin-bottom:8px}
.accordion-body ul{padding-left:20px}
.arrow{transition:transform 0.2s;color:var(--text-faint);font-size:0.8em}
.open .arrow{transform:rotate(180deg)}
.open .accordion-body{display:block}
.table-wrap{overflow-x:auto;margin:12px 0;border-radius:var(--radius);border:1px solid var(--border)}
table{width:100%;border-collapse:collapse}
thead{background:var(--surface2)}
th{color:var(--text-muted);padding:10px 14px;text-align:left;font-size:0.78em;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;white-space:nowrap}
td{padding:10px 14px;border-top:1px solid var(--border);color:#c4c4c4;font-size:0.88em;vertical-align:top}
tbody tr:hover{background:var(--surface2)}
.mobile-menu{display:none;background:var(--surface);border-bottom:1px solid var(--border);padding:6px 0}
.mobile-tab-btn{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:none;color:var(--text-muted);padding:11px 16px;cursor:pointer;font-size:0.88em;font-family:inherit;transition:all 0.15s;border-left:3px solid transparent;font-weight:500}
.mobile-tab-btn.active{color:#fff;border-left-color:var(--accent)}
.footer{background:var(--surface);padding:20px 24px;text-align:center;border-top:1px solid var(--border);margin-top:40px}
.footer p{color:var(--text-faint);font-size:0.78em}
@media(max-width:768px){.sidebar{display:none}.mobile-menu{display:block}.layout{flex-direction:column}.content{padding:20px 16px}}
</style>
</head>
<body>
<div class="header">
  <div class="badge">${badges[tipo] || '⚡ PRODUCTO PREMIUM'}</div>
  <h1>${titulo}</h1>
  <p>${subtitulo}</p>
</div>
<div class="mobile-menu">
  ${secciones.map((s, i) => `<button class="mobile-tab-btn ${i === 0 ? 'active' : ''}" onclick="showTab(${i})" id="mbtn-${i}"><span style="width:22px;height:22px;border-radius:50%;background:var(--surface2);color:var(--text-faint);display:inline-flex;align-items:center;justify-content:center;font-size:0.75em;font-weight:700;flex-shrink:0">${i + 1}</span> ${s.icono} ${s.titulo}</button>`).join('')}
</div>
<div class="layout">
  <nav class="sidebar">
    <span class="sidebar-label">Contenido</span>
    ${secciones.map((s, i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" onclick="showTab(${i})" id="btn-${i}"><span class="tab-num">${i + 1}</span> ${s.icono} ${s.titulo}</button>`).join('')}
  </nav>
  <main class="content">
    ${secciones.map((s, i) => `<div class="tab-panel ${i === 0 ? 'active' : ''}" id="panel-${i}"><div class="section-title">${s.icono} ${s.titulo}</div><div class="section-sub">Sección ${i + 1} de ${secciones.length}</div>${s.contenido}</div>`).join('')}
  </main>
</div>
<div class="footer"><p>© 2026 ${titulo} · Nexus Labs · Todos los derechos reservados</p></div>
<script>
function showTab(i){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.mobile-tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('panel-'+i)?.classList.add('active');document.getElementById('btn-'+i)?.classList.add('active');document.getElementById('mbtn-'+i)?.classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
function toggleAccordion(el){el.parentElement.classList.toggle('open')}
document.querySelectorAll('.prompt-box').forEach(box=>{const btn=box.querySelector('.copy-btn');if(btn)btn.addEventListener('click',()=>{navigator.clipboard.writeText(box.innerText.replace('Copiar','').trim());btn.textContent='✅ Copiado';setTimeout(()=>btn.textContent='Copiar',2000)})})
document.querySelectorAll('table').forEach((table,idx)=>{if(table.closest('.table-wrap'))return;const wrap=document.createElement('div');wrap.className='table-wrap';table.parentNode.insertBefore(wrap,table);wrap.appendChild(table)})
</script>
</body>
</html>`;
}

// ── Sanear HTML de Claude ─────────────────────────────
function sanearHTML(html) {
  let r = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<\/?script[^>]*>/gi, '');
  r = r.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<\/?style[^>]*>/gi, '');
  const abiertos = (r.match(/<div[\s>]/gi) || []).length;
  const cerrados = (r.match(/<\/div>/gi) || []).length;
  const diff = abiertos - cerrados;
  if (diff > 0) r += '</div>'.repeat(diff);
  else if (diff < 0) { for (let i = 0; i < Math.abs(diff); i++) { const idx = r.lastIndexOf('</div>'); if (idx !== -1) r = r.slice(0, idx) + r.slice(idx + 6); } }
  return r;
}

// ── Genera una sección con Claude (con reintentos) ────
async function generarSeccion(prompt, etiqueta = '') {
  try {
    const resultado = await AnthropicConnector.completarConContinuacion({ system: SYSTEM, prompt, model: 'claude-sonnet-4-6', maxTokens: 6000, maxIter: 3 });
    const limpio = resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    if (limpio.length > 200) return sanearHTML(limpio);
    throw new Error('Respuesta demasiado corta');
  } catch (err) {
    console.warn(`[Generator] Sección "${etiqueta}" falló — reintentando versión compacta: ${err.message}`);
    await TelegramConnector.notificar(`⚠️ Sección "${etiqueta || 'actual'}" requirió reintento...`).catch(() => {});
    await delay(5000);
    const resultado = await AnthropicConnector.completarConContinuacion({
      system: SYSTEM,
      prompt: prompt + `\n\nIMPORTANTE: Versión compacta. Máximo 500 palabras. Completa en una sola respuesta.`,
      model: 'claude-sonnet-4-6', maxTokens: 4000, maxIter: 2,
    });
    const limpio = resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    if (limpio.length > 100) return sanearHTML(limpio);
    throw new Error(`Sección "${etiqueta}" falló en todos los intentos`);
  }
}

function bloqueNicho(nicho) {
  return `
CONTEXTO DEL CLIENTE:
- Producto: ${nicho.nombre_producto}
- Nicho: ${nicho.nicho}
- Subgrupo latino: ${nicho.subgrupo_latino || nicho.cliente_ideal}
- Cliente ideal: ${nicho.cliente_ideal}
- Su dolor: ${nicho.problema_que_resuelve}
- Herramientas del sector: ${nicho.herramientas_clave?.join(', ') || 'del sector'}
- Quick win prometido: ${nicho.quick_win || ''}
- Historia de exito: ${nicho.ejemplo_exito || ''}

REGLAS DE ESPECIFICIDAD:
1. Usa el nombre del cliente ideal en ejemplos
2. Menciona ciudades reales donde vive ese subgrupo
3. Precios exactos, tiempos exactos, porcentajes reales
4. Minimo 1 ejemplo con nombre latino + ciudad + resultado numérico
`;
}

// ════════════════════════════════════════════════════
// GENERADORES POR TIPO — secciones en paralelo
// ════════════════════════════════════════════════════

async function generarGuiaPDF(nicho) {
  console.log('[Generator] Generando guia PDF...');
  const temas = nicho.modulos_temas?.length >= 4 ? nicho.modulos_temas : null;
  const tema1 = temas?.[0] || `Fundamentos de ${nicho.nicho}`;
  const tema2 = temas?.[1] || 'El Método Paso a Paso';
  const tema4 = temas?.[3] || 'Herramientas y Errores Criticos';
  const n = bloqueNicho(nicho);

  await TelegramConnector.notificar('⚡ <b>Generator:</b> Generando 7 secciones en paralelo...').catch(() => {});

  const [quickWin, intro, cap1, cap2, cap3, recursos, plan] = await Promise.all([
    generarSeccion(`${n}\nEscribe la sección "Tu Primer Resultado en 30 Minutos" para "${nicho.nombre_producto}".\nQuick win: ${nicho.quick_win || 'resultado inmediato concreto'}\n- Pasos numerados con acciones exactas (herramientas reales, clicks específicos)\n- Al final el lector tiene algo concreto\n- Incluye <div class="highlight"> con el resultado\n- Termina con <div class="tip">✅ Logro desbloqueado: [resultado]</div>\nFormato: div card con pasos. Sin html ni body.`, 'Quick Win'),
    generarSeccion(`${n}\nEscribe la introducción de "${nicho.nombre_producto}".\n- Conecta con el dolor real (${nicho.problema_que_resuelve}) con historia reconocible\n- Por qué la mayoría falla en ${nicho.nicho} (error más común)\n- Qué van a tener al terminar (resultados con números)\n- <div class="highlight"> con la promesa principal\n- 400-500 palabras. Sin relleno.\nFormato: div card. Sin html ni body.`, 'Introducción'),
    generarSeccion(`${n}\nEscribe el Capítulo 1: "${tema1}" para "${nicho.nombre_producto}".\n- 3 conceptos clave: definición + ejemplo real + por qué importa\n- <div class="highlight"> con el concepto más importante\n- Lista de pasos iniciales del lector\n- <div class="tip"> con el error más común en esta etapa\n- Ejercicio: algo concreto en 15 minutos\n- Herramientas reales con nombres y precios\nFormato: div card. Sin html ni body.`, tema1),
    generarSeccion(`${n}\nEscribe el Capítulo 2: "${tema2}" para "${nicho.nombre_producto}".\n- El método principal, 6+ pasos con instrucciones exactas\n- Cada paso: qué hacer, cómo exactamente, cuánto tarda, qué resultado esperar\n- <div class="tip"> con el atajo que los expertos usan\n- Ejemplo real de hispano aplicando esto con números\n- Ejercicio práctico final\nFormato: div card. Sin html ni body.`, tema2),
    generarSeccion(`${n}\nEscribe 3 casos reales de hispanohablantes para "${nicho.nombre_producto}".\nEjemplo de referencia: ${nicho.ejemplo_exito || 'persona del mercado hispano con resultados'}\nPara cada caso: nombre+ciudad, situación inicial, pasos exactos, resultado con números, lección transferible.\nFormato: div card por caso, highlight para resultado. Sin html ni body.`, 'Casos Reales'),
    generarSeccion(`${n}\nEscribe "${tema4}" para "${nicho.nombre_producto}".\nPARTE 1 — Tabla con 10+ herramientas reales: columnas Herramienta | Para qué | Precio | Nivel | Dónde\nHerramientas base: ${nicho.herramientas_clave?.join(', ') || 'del sector'}\nPARTE 2 — Los 7 errores que cuestan dinero: error + por qué + cómo evitarlo\nFormato: table + div card ol. Sin html ni body.`, tema4),
    generarSeccion(`${n}\nEscribe el Plan de 7 Días para "${nicho.nombre_producto}".\nPara cada día: título + tiempo estimado + tareas específicas + resultado del día + tip de velocidad.\nDía 1 aplica el quick win inmediato. Día 7 entrega el resultado prometido.\nUsa acordeón: div.accordion-item > div.accordion-header[onclick=toggleAccordion(this)] > span.arrow > div.accordion-body\nSin html ni body.`, 'Plan 7 Días'),
  ]);

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'guia_pdf', [
    { icono: '⚡', titulo: 'Resultado en 30 Min', contenido: quickWin },
    { icono: '🎯', titulo: 'Introducción',        contenido: intro   },
    { icono: '📚', titulo: temas?.[0] || 'Fundamentos', contenido: cap1 },
    { icono: '🔧', titulo: temas?.[1] || 'El Método',   contenido: cap2 },
    { icono: '💡', titulo: 'Casos Reales',        contenido: cap3    },
    { icono: '🛠️', titulo: 'Herramientas',        contenido: recursos},
    { icono: '📅', titulo: 'Plan 7 Días',         contenido: plan    },
  ]);
}

async function generarPackPrompts(nicho) {
  console.log('[Generator] Generando pack de prompts...');
  const FORMATO = `<div class="card"><h3>Prompt #N: [Nombre]</h3><p><strong>Para qué sirve:</strong> [1 línea concreta]</p><p><strong>Cuándo usarlo:</strong> [situación]</p><div class="prompt-box"><button class="copy-btn">Copiar</button>[PROMPT COMPLETO 5+ líneas con variables en MAYUSCULAS]</div><div class="tip">💡 Tip: [consejo]</div></div>`;

  await TelegramConnector.notificar('⚡ <b>Generator:</b> Generando 5 secciones en paralelo...').catch(() => {});

  const [intro, prompts1, prompts2, prompts3, bonus] = await Promise.all([
    generarSeccion(`
${bloqueNicho(nicho)}
Sección de bienvenida para el pack "${nicho.nombre_producto}".
- Quick Win: primer prompt a usar HOY con resultado en 10 min — <div class="highlight"> con el prompt listo
- Cómo usar: dónde pegar (ChatGPT/Claude), personalizar variables, encadenar
- Los 3 errores más comunes al usar prompts de IA para ${nicho.nicho}
Formato: div card con highlight y tips. Sin html ni body.`, 'Intro'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #1 al #10 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Cubren: iniciar, investigar, planificar, configurar bases.
Cada prompt DEBE ser largo y detallado (5-8 líneas mínimo), ultra-específico para el nicho.
Formato para cada uno: ${FORMATO}
Sin html ni body. Los 10 divs completos.`, 'Prompts #1-10'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #11 al #20 para: ${nicho.nicho}. Cubren: ejecutar, optimizar, crear contenido, resultados.
Cada prompt cubre casos de uso distintos a los básicos de inicio/investigación.
Mismo formato: ${FORMATO}
Sin html ni body.`, 'Prompts #11-20'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #21 al #30 para: ${nicho.nicho}. Son los más avanzados: escalar, automatizar, analizar.
Los que los expertos usan, no los principiantes.
Mismo formato: ${FORMATO}
Sin html ni body.`, 'Prompts #21-30'),

    generarSeccion(`
${bloqueNicho(nicho)}
Sección Bonus: "3 Flujos de Trabajo con IA para ${nicho.nicho}".
Para cada flujo: nombre, qué logras, secuencia de prompts (ej: Prompt #3→#7→#15), ejemplo real, tiempo.
Termina con tabla de referencia rápida: los 30 prompts con nombre y caso de uso.
Formato: div card + tabla. Sin html ni body.`, 'Bonus'),
  ]);

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'prompts', [
    { icono: '📖', titulo: 'Cómo usar', contenido: intro },
    { icono: '⚡', titulo: 'Prompts #1 — #10', contenido: prompts1 },
    { icono: '⚡', titulo: 'Prompts #11 — #20', contenido: prompts2 },
    { icono: '⚡', titulo: 'Prompts #21 — #30', contenido: prompts3 },
    { icono: '🎁', titulo: 'Bonus: Flujos', contenido: bonus },
  ]);
}

async function generarToolkit(nicho) {
  console.log('[Generator] Generando toolkit...');

  await TelegramConnector.notificar('⚡ <b>Generator:</b> Generando 5 secciones en paralelo...').catch(() => {});

  const [intro, plantillas, herramientas, metricas, calendario] = await Promise.all([
    generarSeccion(`
${bloqueNicho(nicho)}
Intro y Checklist Maestro para "${nicho.nombre_producto}".
- Quick Win: primera acción con resultado en 20 min — <div class="highlight">
- Cómo usar el toolkit: orden, tiempo total, cómo adaptarlo
- Checklist de 50 ítems específicos en 4 fases: Configuración (1-12), Primeros resultados (13-25), Optimización (26-38), Escala (39-50)
Cada ítem: acción concreta con herramienta real.
Formato: div card + ul.checklist. Sin html ni body.`, 'Checklist'),

    generarSeccion(`
${bloqueNicho(nicho)}
3 plantillas COMPLETAMENTE LLENADAS para "${nicho.nicho}".
Plantilla 1: día a día — tabla con datos reales.
Plantilla 2: tracking de resultados — con valores de referencia.
Plantilla 3: comunicación/ventas — ejemplo completo.
Para cada una: nombre, uso exacto, cómo copiar a Google Sheets, tabla HTML llenada, tip.
Formato: div card por plantilla. Sin html ni body.`, 'Plantillas'),

    generarSeccion(`
${bloqueNicho(nicho)}
Stack de 18+ herramientas para "${nicho.nombre_producto}".
Base: ${nicho.herramientas_clave?.join(', ') || 'del sector'}
Tabla: Herramienta | Qué hace exactamente | Precio | Vale la pena | Alternativa gratis
Stack recomendado: combinaciones para principiante vs avanzado.
Formato: div card + table. Sin html ni body.`, 'Herramientas'),

    generarSeccion(`
${bloqueNicho(nicho)}
Dashboard de Métricas y Alertas para "${nicho.nombre_producto}".
PARTE 1 — 12 métricas clave: tabla con columnas Métrica | Bueno | Preocupante | Crítico | Cómo medirla
PARTE 2 — 10 señales de alerta: qué es + por qué + impacto en $ + acción inmediata
Formato: table + div card. Sin html ni body.`, 'Métricas'),

    generarSeccion(`
${bloqueNicho(nicho)}
Plan de 30 Días para "${nicho.nombre_producto}".
S1 (días 1-7): Configuración y primer resultado.
S2 (días 8-14): Primeros clientes/ventas.
S3 (días 15-21): Optimización.
S4 (días 22-30): Escala.
Por semana: objetivo + acciones diarias + herramientas + resultado esperado.
Usa acordeón. Sin html ni body.`, 'Plan 30 días'),
  ]);

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'toolkit', [
    { icono: '✅', titulo: 'Checklist Maestro', contenido: intro },
    { icono: '📋', titulo: 'Plantillas', contenido: plantillas },
    { icono: '🔧', titulo: 'Herramientas', contenido: herramientas },
    { icono: '📊', titulo: 'Métricas y Alertas', contenido: metricas },
    { icono: '📅', titulo: 'Calendario 30 días', contenido: calendario },
  ]);
}

async function generarMiniCurso(nicho) {
  console.log('[Generator] Generando mini curso...');
  const modulos = nicho.modulos_temas?.length >= 4 ? nicho.modulos_temas : null;

  await TelegramConnector.notificar('⚡ <b>Generator:</b> Generando 5 secciones en paralelo...').catch(() => {});

  const [bienvenida, mod1, mod2, mod3, escala] = await Promise.all([
    generarSeccion(`
${bloqueNicho(nicho)}
Crea la lección de bienvenida para el mini curso "${nicho.nombre_producto}".
- Quick Win: qué van a lograr en los próximos 60 minutos de estudio
- Por qué este curso es diferente a los videos de YouTube
- Cómo usar el curso: orden, tiempo por lección, materiales necesarios
- <div class="highlight"> con la transformación prometida
- Ejercicio de activación: escribe tu situación actual y tu meta en 2 líneas
Formato: div card con highlight y tip. Sin html ni body.`, 'Bienvenida'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea el Módulo 1: "${modulos?.[0] || 'Fundamentos esenciales'}" para "${nicho.nombre_producto}".
- Concepto principal explicado en 5 minutos
- 3 pasos concretos con instrucciones exactas (herramientas reales, dónde hacer clic)
- Ejemplo real de alguien del subgrupo ${nicho.subgrupo_latino || 'latino'} aplicando esto
- <div class="tip"> con el error del 80% de principiantes
- Tarea del módulo: una acción específica a completar ANTES del módulo 2
Formato: div card con acordeón para subtemas. Sin html ni body.`, modulos?.[0] || 'Módulo 1'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea el Módulo 2: "${modulos?.[1] || 'Implementación práctica'}" para "${nicho.nombre_producto}".
- El método en 6 pasos numerados — cada paso con duración estimada
- Captura de pantalla imaginaria: describe exactamente lo que verían en su pantalla
- Números concretos: cuánto tiempo, cuánto dinero, qué resultado esperar
- <div class="highlight"> con el resultado al completar este módulo
- Tarea: entregable concreto que el alumno envía para validar
Formato: div card. Sin html ni body.`, modulos?.[1] || 'Módulo 2'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea el Módulo 3: "${modulos?.[2] || 'Optimización y primeros resultados'}" para "${nicho.nombre_producto}".
- Cómo saber si está funcionando: las 3 métricas que importan
- Los 5 ajustes que multiplican resultados
- Historia de éxito: ${nicho.ejemplo_exito || 'alumno típico con resultados reales'}
- Qué hacer si algo no está funcionando (árbol de decisiones simple)
- <div class="tip"> con el atajo que solo los avanzados conocen
Formato: div card con tabla de métricas. Sin html ni body.`, modulos?.[2] || 'Módulo 3'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea el módulo final "Escala y Próximos Pasos" para "${nicho.nombre_producto}".
- Plan de 30 días después del curso: semana 1 consolidar, semana 2-3 crecer, semana 4 escalar
- Los 3 upgrades naturales cuando ya dominas esto (producto siguiente, oferta superior)
- Comunidad y recursos: dónde encontrar personas del mismo nicho
- Celebración del logro: lista de verificación de todo lo que aprendieron
- <div class="highlight"> con el mensaje de cierre y motivación genuina
Formato: div card con checklist y acordeón. Sin html ni body.`, 'Escala'),
  ]);

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'mini_curso', [
    { icono: '👋', titulo: 'Bienvenida', contenido: bienvenida },
    { icono: '📚', titulo: modulos?.[0] || 'Módulo 1', contenido: mod1 },
    { icono: '⚡', titulo: modulos?.[1] || 'Módulo 2', contenido: mod2 },
    { icono: '📈', titulo: modulos?.[2] || 'Módulo 3', contenido: mod3 },
    { icono: '🚀', titulo: 'Escala y Próximos Pasos', contenido: escala },
  ]);
}

async function generarPlantilla(nicho) {
  console.log('[Generator] Generando plantilla...');

  await TelegramConnector.notificar('⚡ <b>Generator:</b> Generando 5 secciones en paralelo...').catch(() => {});

  const [instrucciones, principal, seguimiento, scripts, dashboard] = await Promise.all([
    generarSeccion(`
${bloqueNicho(nicho)}
Crea la página de instrucciones para la plantilla "${nicho.nombre_producto}".
- Quick Win: usa esta plantilla ahora mismo — resultado en 10 minutos
- Cómo duplicar a Google Sheets: pasos exactos con enlace imaginario (drive.google.com/template)
- Cómo personalizar: qué celdas cambiar, qué fórmulas NO tocar
- Los 3 casos de uso más comunes para ${nicho.subgrupo_latino || 'el usuario'}
- <div class="tip"> con el error que rompe la plantilla y cómo evitarlo
Formato: div card con highlight. Sin html ni body.`, 'Instrucciones'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea la plantilla principal COMPLETAMENTE LLENADA para "${nicho.nombre_producto}".
Muestra una tabla HTML con datos reales y representativos del mercado hispano.
Incluye: encabezados con formato, al menos 10 filas de ejemplo, fórmulas como texto,
colores de semaforización (verde/amarillo/rojo), notas en celdas críticas.
Debajo: explicación de cada columna y para qué sirve el dato.
Formato: div card + tabla completa llenada. Sin html ni body.`, 'Plantilla Principal'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea la plantilla de seguimiento semanal para "${nicho.nombre_producto}".
Tabla llenada con datos ejemplo de 4 semanas, mostrando progreso y tendencias.
Columnas que deben incluirse: fecha, métricas clave del nicho, objetivo, real, variación, acciones tomadas.
<div class="tip"> explicando cómo interpretar las tendencias semana a semana.
Formato: div card + tabla. Sin html ni body.`, 'Seguimiento Semanal'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea la plantilla de comunicación/mensajes para "${nicho.nombre_producto}".
5 mensajes/scripts completamente escritos para situaciones clave en ${nicho.nicho}:
1. Primer contacto, 2. Seguimiento sin respuesta, 3. Propuesta de valor, 4. Cierre, 5. Post-venta.
Cada mensaje: para qué canal (WhatsApp/email/DM), cuándo enviarlo, el mensaje completo listo para copiar.
<div class="highlight"> con el mensaje que más convierte y por qué.
Formato: div card por mensaje. Sin html ni body.`, 'Scripts y Mensajes'),

    generarSeccion(`
${bloqueNicho(nicho)}
Crea el dashboard de resultados mensuales para "${nicho.nombre_producto}".
Tabla resumen con KPIs clave llenada con datos ejemplo para un mes completo.
Gráfico de barras en HTML (usando divs con heights proporcionales, sin canvas/svg).
Semaforización automática: verde si supera meta, amarillo si está cerca, rojo si está lejos.
<div class="highlight"> con el insight más importante del mes.
Formato: div card + tabla + gráfico HTML. Sin html ni body.`, 'Dashboard'),
  ]);

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'plantilla', [
    { icono: '📖', titulo: 'Cómo usar', contenido: instrucciones },
    { icono: '📋', titulo: 'Plantilla Principal', contenido: principal },
    { icono: '📅', titulo: 'Seguimiento Semanal', contenido: seguimiento },
    { icono: '💬', titulo: 'Scripts y Mensajes', contenido: scripts },
    { icono: '📊', titulo: 'Dashboard de Resultados', contenido: dashboard },
  ]);
}

// ── Generador principal exportado ────────────────────
export async function generarProducto(nicho) {
  console.log(`[Generator] Tipo "${nicho.tipo}": "${nicho.nombre_producto}"`);
  let html = '';

  if (nicho.tipo === 'prompts')         html = await generarPackPrompts(nicho);
  else if (nicho.tipo === 'toolkit')    html = await generarToolkit(nicho);
  else if (nicho.tipo === 'mini_curso') html = await generarMiniCurso(nicho);
  else if (nicho.tipo === 'plantilla')  html = await generarPlantilla(nicho);
  else                                  html = await generarGuiaPDF(nicho); // guia_pdf y fallback

  console.log(`[Generator] Producto listo — ${html.length} caracteres`);
  return html;
}

export default generarProducto;
