// ════════════════════════════════════════════════════
// PRODUCT ENGINE — Genera productos digitales premium
// 5 tipos: prompts, plantilla, guia_pdf, mini_curso, toolkit
// Cada sección se genera por separado para evitar truncado
// ════════════════════════════════════════════════════

import { AnthropicConnector } from '../connectors/anthropic.connector.js';
import { TelegramConnector }  from '../connectors/telegram.connector.js';

const delay = ms => new Promise(r => setTimeout(r, ms));
const DELAY_SECCIONES = 2000;

const SYSTEM = `Eres un experto creador de productos digitales premium para el mercado hispano.
Tu mision: crear contenido que haga que el cliente diga "wow, pague muy poco por esto".
Escribes para latinos reales — no para marketeros. Tu tono es de amigo que sabe, no de guru.

REGLAS DE CALIDAD — OBLIGATORIAS EN CADA SECCION:
1. ESPECIFICIDAD REAL: Herramientas reales con precios reales, pasos con clicks exactos
2. NUMEROS CONCRETOS: Siempre con cifras reales del mercado
3. PERSONAJES LATINOS ESPECIFICOS: Usa el perfil del cliente ideal como personaje en ejemplos
4. ACCIONABLE HOY: Cada paso se puede ejecutar hoy
5. CERO RELLENO: Sin "es importante recordar". Directo al valor.
6. EJERCICIO PRACTICO: Termina cada seccion con una accion inmediata concreta
7. CONTEXTO CULTURAL: Menciona barrios, ciudades, formas de pago reales del subgrupo

Devuelves SOLO el HTML del contenido, sin html ni body tags.

RESTRICCIONES TECNICAS:
- NUNCA uses script ni style tags
- Si necesitas colorear texto, usa clases: .highlight .tip .info .card .section-title
- Atributos style solo para: margin, padding, gap, flex, grid, width`;

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
:root{--bg:#0F1729;--surface:#172035;--surface2:#1E2A42;--border:#2A3A55;--accent:#F5A623;--accent-dim:rgba(245,166,35,0.12);--accent-dim2:rgba(245,166,35,0.07);--blue:#4f8ef7;--blue-dim:rgba(79,142,247,0.1);--green:#34d399;--green-dim:rgba(52,211,153,0.1);--text:#E8EAF0;--text-muted:#9AA3B8;--text-faint:#4A5568;--radius:10px}
body{font-family:'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.header{background:linear-gradient(135deg,#0B1220 0%,#0F1729 50%,#0B1828 100%);padding:52px 24px 44px;text-align:center;border-bottom:1px solid var(--border)}
.badge{display:inline-flex;align-items:center;gap:6px;background:var(--accent-dim);color:var(--accent);border:1px solid rgba(245,166,35,0.3);padding:5px 16px;border-radius:20px;font-size:0.72em;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px}
.header h1{font-family:'Poppins',sans-serif;color:#fff;font-size:clamp(1.4em,4vw,2.3em);font-weight:700;line-height:1.25;margin-bottom:12px}
.header p{color:var(--text-muted);font-size:1.05em;max-width:580px;margin:0 auto;line-height:1.6}
.layout{display:flex;min-height:calc(100vh - 180px)}
.sidebar{width:256px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);padding:16px 0;position:sticky;top:0;height:100vh;overflow-y:auto}
.sidebar-label{font-size:0.68em;font-weight:700;letter-spacing:2px;color:var(--text-faint);text-transform:uppercase;padding:8px 20px 12px;display:block}
.tab-btn{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;color:var(--text-muted);padding:11px 20px;cursor:pointer;font-size:0.88em;font-family:inherit;transition:all 0.15s;border-left:3px solid transparent;line-height:1.4;font-weight:500}
.tab-btn:hover{background:var(--surface2);color:var(--text)}
.tab-btn.active{background:var(--accent-dim2);color:var(--accent);border-left-color:var(--accent);font-weight:600}
.tab-num{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--surface2);color:var(--text-faint);font-size:0.75em;font-weight:700;flex-shrink:0;transition:all 0.15s}
.tab-btn.active .tab-num{background:var(--accent);color:#000}
.content{flex:1;padding:40px 44px;max-width:860px}
.tab-panel{display:none;animation:fadeIn 0.2s ease;overflow-x:auto}
.tab-panel.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.section-title{font-family:'Poppins',sans-serif;font-size:1.5em;font-weight:700;color:#fff;margin-bottom:6px}
.section-sub{color:var(--text-muted);font-size:0.9em;margin-bottom:28px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin-bottom:16px;overflow-x:auto}
.card h3{color:#fff;margin-bottom:10px;font-size:1em;font-weight:600}
.card h4{color:var(--accent);margin:16px 0 8px;font-size:0.85em;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.card p{color:#C8CEDC;line-height:1.8;margin-bottom:10px}
.card ul,.card ol{padding-left:20px}
.card li{color:#C8CEDC;line-height:1.8;margin-bottom:6px}
.card strong{color:var(--text)}
.highlight{background:var(--accent-dim);border:1px solid rgba(245,166,35,0.25);border-radius:var(--radius);padding:16px 20px;margin:14px 0;color:var(--accent);font-weight:600;line-height:1.6}
.tip{background:var(--green-dim);border:1px solid rgba(52,211,153,0.2);border-radius:var(--radius);padding:14px 20px;margin:14px 0;color:var(--green);font-size:0.92em;line-height:1.6}
.info{background:var(--blue-dim);border:1px solid rgba(79,142,247,0.2);border-radius:var(--radius);padding:14px 20px;margin:14px 0;color:var(--blue);font-size:0.92em;line-height:1.6}
.prompt-box{background:#0B1220;border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin:14px 0;font-family:'Courier New',monospace;font-size:0.87em;color:#F5A623;white-space:pre-wrap;line-height:1.8;position:relative}
.copy-btn{position:absolute;top:12px;right:12px;background:var(--accent);color:#000;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700}
.checklist{list-style:none;padding:0}
.checklist li{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);color:#C8CEDC;line-height:1.6;font-size:0.95em}
.checklist li::before{content:"○";color:var(--accent);font-size:1em;flex-shrink:0;margin-top:1px}
.accordion-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;overflow:hidden}
.accordion-header{padding:16px 20px;cursor:pointer;color:#fff;display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:0.95em;transition:background 0.15s}
.accordion-header:hover{background:var(--surface2)}
.accordion-body{padding:0 20px 20px;color:#C8CEDC;line-height:1.8;display:none}
.accordion-body p{margin-bottom:10px}
.accordion-body ul{padding-left:20px}
.arrow{transition:transform 0.2s;color:var(--accent);font-size:0.85em}
.open .arrow{transform:rotate(180deg)}
.open .accordion-body{display:block}
.table-wrap{overflow-x:auto;margin:14px 0;border-radius:var(--radius);border:1px solid var(--border)}
table{width:100%;border-collapse:collapse}
thead{background:var(--surface2)}
th{color:var(--accent);padding:12px 16px;text-align:left;font-size:0.82em;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap}
td{padding:11px 16px;border-top:1px solid var(--border);color:#C8CEDC;font-size:0.9em;vertical-align:top}
tbody tr:hover{background:var(--surface2)}
.mobile-menu{display:none;background:var(--surface);border-bottom:1px solid var(--border);padding:8px 0}
.mobile-tab-btn{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;color:var(--text-muted);padding:12px 20px;cursor:pointer;font-size:0.9em;font-family:inherit;transition:all 0.15s;border-left:3px solid transparent;font-weight:500}
.mobile-tab-btn.active{background:var(--accent-dim2);color:var(--accent);border-left-color:var(--accent);font-weight:600}
.footer{background:var(--surface);padding:24px;text-align:center;border-top:1px solid var(--border);margin-top:40px}
.footer p{color:var(--text-faint);font-size:0.8em}
.tab-panel [style*="color:#3"],.tab-panel [style*="color: #3"],.tab-panel [style*="color:#2"],.tab-panel [style*="color: #2"],.tab-panel [style*="color:black"],.tab-panel [style*="color: black"]{color:var(--text)!important}
.tab-panel [style*="background:#f"],.tab-panel [style*="background: #f"],.tab-panel [style*="background:white"],.tab-panel [style*="background: white"]{background:var(--surface2)!important}
@media(max-width:768px){.sidebar{display:none}.mobile-menu{display:block}.layout{flex-direction:column}.content{padding:24px 16px}}
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
    const resultado = await AnthropicConnector.completarConContinuacion({ system: SYSTEM, prompt, model: 'claude-sonnet-4-6', maxTokens: 6000, maxIter: 8 });
    const limpio = resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    if (limpio.length > 200) return sanearHTML(limpio);
    throw new Error('Respuesta demasiado corta');
  } catch (err) {
    console.warn(`[Generator] Sección "${etiqueta}" falló — reintentando versión compacta: ${err.message}`);
    await TelegramConnector.notificar(`⚠️ Sección "${etiqueta || 'actual'}" requirió reintento...`).catch(() => {});
    await delay(8000);
    const resultado = await AnthropicConnector.completarConContinuacion({
      system: SYSTEM,
      prompt: prompt + `\n\nIMPORTANTE: Versión compacta. Máximo 500 palabras. Completa en una sola respuesta.`,
      model: 'claude-sonnet-4-6', maxTokens: 4000, maxIter: 4,
    });
    const limpio = resultado.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    if (limpio.length > 100) return sanearHTML(limpio);
    throw new Error(`Sección "${etiqueta}" falló en todos los intentos`);
  }
}

function resumirParaContexto(titulo, html) {
  return `[${titulo}]: ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)}...`;
}

function bloqueContexto(historial) {
  if (!historial.length) return '';
  return `\nCONTEXTO (ultimas ${Math.min(historial.length, 2)} secciones — mantén coherencia, no repitas):\n${historial.slice(-2).join('\n')}\n`;
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
// GENERADORES POR TIPO
// ════════════════════════════════════════════════════

async function generarGuiaPDF(nicho) {
  console.log('[Generator] Generando guia PDF...');
  const ctx = [];
  const temas = nicho.modulos_temas?.length >= 4 ? nicho.modulos_temas : null;

  await TelegramConnector.notificar('📝 <b>Generator:</b> Sección 1/7 — Quick Win...').catch(() => {});
  const quickWin = await generarSeccion(`
${bloqueNicho(nicho)}
Escribe la sección "Tu Primer Resultado en 30 Minutos" para "${nicho.nombre_producto}".
Quick win: ${nicho.quick_win || 'resultado inmediato concreto'}
- Pasos numerados con acciones exactas (herramientas reales, clicks específicos)
- Al final el lector tiene algo concreto
- Incluye <div class="highlight"> con el resultado
- Termina con <div class="tip">✅ Logro desbloqueado: [resultado]</div>
Formato: div card con pasos. Sin html ni body.`, 'Quick Win');
  ctx.push(resumirParaContexto('Quick Win', quickWin));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Sección 2/7 — Introducción...').catch(() => {});
  const intro = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe la introducción de "${nicho.nombre_producto}".
- Conecta con el dolor real (${nicho.problema_que_resuelve}) con historia reconocible
- Por qué la mayoría falla en ${nicho.nicho} (error más común)
- Qué van a tener al terminar (resultados con números)
- <div class="highlight"> con la promesa principal
- 400-500 palabras. Sin relleno.
Formato: div card. Sin html ni body.`, 'Introducción');
  ctx.push(resumirParaContexto('Introducción', intro));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Sección 3/7 — Capítulo 1...').catch(() => {});
  const tema1 = temas?.[0] || `Fundamentos de ${nicho.nicho}`;
  const cap1 = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Capítulo 1: "${tema1}" para "${nicho.nombre_producto}".
- 3 conceptos clave: definición + ejemplo real + por qué importa
- <div class="highlight"> con el concepto más importante
- Lista de pasos iniciales del lector
- <div class="tip"> con el error más común en esta etapa
- Ejercicio: algo concreto en 15 minutos
- Herramientas reales con nombres y precios
Formato: div card. Sin html ni body.`, tema1);
  ctx.push(resumirParaContexto(tema1, cap1));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Sección 4/7 — Capítulo 2...').catch(() => {});
  const tema2 = temas?.[1] || 'El Método Paso a Paso';
  const cap2 = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Capítulo 2: "${tema2}" para "${nicho.nombre_producto}".
- El método principal, 6+ pasos con instrucciones exactas
- Cada paso: qué hacer, cómo exactamente, cuánto tarda, qué resultado esperar
- <div class="tip"> con el atajo que los expertos usan
- Ejemplo real de hispano aplicando esto con números
- Ejercicio práctico final
Formato: div card. Sin html ni body.`, tema2);
  ctx.push(resumirParaContexto(tema2, cap2));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Sección 5/7 — Casos Reales...').catch(() => {});
  const cap3 = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe 3 casos reales de hispanohablantes para "${nicho.nombre_producto}".
Ejemplo de referencia: ${nicho.ejemplo_exito || 'persona del mercado hispano con resultados'}
Para cada caso: nombre+ciudad, situación inicial, pasos exactos, resultado con números, lección transferible.
Formato: div card por caso, highlight para resultado. Sin html ni body.`, 'Casos Reales');
  ctx.push(resumirParaContexto('Casos Reales', cap3));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Sección 6/7 — Herramientas...').catch(() => {});
  const tema4 = temas?.[3] || 'Herramientas y Errores Criticos';
  const recursos = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe "${tema4}" para "${nicho.nombre_producto}".
PARTE 1 — Tabla con 10+ herramientas reales: columnas Herramienta | Para qué | Precio | Nivel | Dónde
Herramientas base: ${nicho.herramientas_clave?.join(', ') || 'del sector'}
PARTE 2 — Los 7 errores que cuestan dinero: error + por qué + cómo evitarlo
Formato: table + div card ol. Sin html ni body.`, tema4);
  ctx.push(resumirParaContexto('Herramientas', recursos));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Sección 7/7 — Plan de Acción...').catch(() => {});
  const plan = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Escribe el Plan de 7 Días para "${nicho.nombre_producto}".
Para cada día: título + tiempo estimado + tareas específicas + resultado del día + tip de velocidad.
Día 1 conecta con el Quick Win. Día 7 entrega el resultado prometido.
Usa acordeón: div.accordion-item > div.accordion-header[onclick=toggleAccordion(this)] > span.arrow > div.accordion-body
Sin html ni body.`, 'Plan 7 Días');

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'guia_pdf', [
    { icono: '⚡', titulo: 'Resultado en 30 Min', contenido: quickWin },
    { icono: '🎯', titulo: 'Introducción', contenido: intro },
    { icono: '📚', titulo: temas?.[0] || 'Fundamentos', contenido: cap1 },
    { icono: '🔧', titulo: temas?.[1] || 'El Método', contenido: cap2 },
    { icono: '💡', titulo: 'Casos Reales', contenido: cap3 },
    { icono: '🛠️', titulo: 'Herramientas', contenido: recursos },
    { icono: '📅', titulo: 'Plan 7 Días', contenido: plan },
  ]);
}

async function generarPackPrompts(nicho) {
  console.log('[Generator] Generando pack de prompts...');
  const FORMATO = `<div class="card"><h3>Prompt #N: [Nombre]</h3><p><strong>Para qué sirve:</strong> [1 línea concreta]</p><p><strong>Cuándo usarlo:</strong> [situación]</p><div class="prompt-box"><button class="copy-btn">Copiar</button>[PROMPT COMPLETO 5+ líneas con variables en MAYUSCULAS]</div><div class="tip">💡 Tip: [consejo]</div></div>`;

  await TelegramConnector.notificar('📝 <b>Generator:</b> Prompts 1/5 — Intro...').catch(() => {});
  const intro = await generarSeccion(`
${bloqueNicho(nicho)}
Sección de bienvenida para el pack "${nicho.nombre_producto}".
- Quick Win: primer prompt a usar HOY con resultado en 10 min — <div class="highlight"> con el prompt listo
- Cómo usar: dónde pegar (ChatGPT/Claude), personalizar variables, encadenar
- Los 3 errores más comunes al usar prompts de IA para ${nicho.nicho}
Formato: div card con highlight y tips. Sin html ni body.`);
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Prompts 2/5 — #1-10...').catch(() => {});
  const prompts1 = await generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #1 al #10 para: ${nicho.nicho}. Cliente: ${nicho.cliente_ideal}
Cubren: iniciar, investigar, planificar, configurar bases.
Cada prompt DEBE ser largo y detallado (5-8 líneas mínimo), ultra-específico para el nicho.
Formato para cada uno: ${FORMATO}
Sin html ni body. Los 10 divs completos.`);
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Prompts 3/5 — #11-20...').catch(() => {});
  const prompts2 = await generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #11 al #20 para: ${nicho.nicho}. Cubren: ejecutar, optimizar, crear contenido, resultados.
Cada prompt diferente a los anteriores — casos de uso distintos.
Mismo formato: ${FORMATO}
Sin html ni body.`);
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Prompts 4/5 — #21-30...').catch(() => {});
  const prompts3 = await generarSeccion(`
${bloqueNicho(nicho)}
Crea los prompts #21 al #30 para: ${nicho.nicho}. Son los más avanzados: escalar, automatizar, analizar.
Los que los expertos usan, no los principiantes.
Mismo formato: ${FORMATO}
Sin html ni body.`);
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Prompts 5/5 — Bonus...').catch(() => {});
  const bonus = await generarSeccion(`
${bloqueNicho(nicho)}
Sección Bonus: "3 Flujos de Trabajo con IA para ${nicho.nicho}".
Para cada flujo: nombre, qué logras, secuencia de prompts (ej: Prompt #3→#7→#15), ejemplo real, tiempo.
Termina con tabla de referencia rápida: los 30 prompts con nombre y caso de uso.
Formato: div card + tabla. Sin html ni body.`);

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
  const ctx = [];

  await TelegramConnector.notificar('📝 <b>Generator:</b> Toolkit 1/5 — Checklist...').catch(() => {});
  const intro = await generarSeccion(`
${bloqueNicho(nicho)}
Intro y Checklist Maestro para "${nicho.nombre_producto}".
- Quick Win: primera acción con resultado en 20 min — <div class="highlight">
- Cómo usar el toolkit: orden, tiempo total, cómo adaptarlo
- Checklist de 50 ítems específicos en 4 fases: Configuración (1-12), Primeros resultados (13-25), Optimización (26-38), Escala (39-50)
Cada ítem: acción concreta con herramienta real.
Formato: div card + ul.checklist. Sin html ni body.`);
  ctx.push(resumirParaContexto('Checklist', intro));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Toolkit 2/5 — Plantillas...').catch(() => {});
  const plantillas = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
3 plantillas COMPLETAMENTE LLENADAS para "${nicho.nicho}".
Plantilla 1: día a día — tabla con datos reales.
Plantilla 2: tracking de resultados — con valores de referencia.
Plantilla 3: comunicación/ventas — ejemplo completo.
Para cada una: nombre, uso exacto, cómo copiar a Google Sheets, tabla HTML llenada, tip.
Formato: div card por plantilla. Sin html ni body.`);
  ctx.push(resumirParaContexto('Plantillas', plantillas));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Toolkit 3/5 — Herramientas...').catch(() => {});
  const herramientas = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Stack de 18+ herramientas para "${nicho.nombre_producto}".
Base: ${nicho.herramientas_clave?.join(', ') || 'del sector'}
Tabla: Herramienta | Qué hace exactamente | Precio | Vale la pena | Alternativa gratis
Stack recomendado: combinaciones para principiante vs avanzado.
Formato: div card + table. Sin html ni body.`);
  ctx.push(resumirParaContexto('Herramientas', herramientas));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Toolkit 4/5 — Métricas...').catch(() => {});
  const metricas = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Dashboard de Métricas y Alertas para "${nicho.nombre_producto}".
PARTE 1 — 12 métricas clave: tabla con columnas Métrica | Bueno | Preocupante | Crítico | Cómo medirla
PARTE 2 — 10 señales de alerta: qué es + por qué + impacto en $ + acción inmediata
Formato: table + div card. Sin html ni body.`);
  ctx.push(resumirParaContexto('Métricas', metricas));
  await delay(DELAY_SECCIONES);

  await TelegramConnector.notificar('📝 <b>Generator:</b> Toolkit 5/5 — Plan 30 días...').catch(() => {});
  const calendario = await generarSeccion(`
${bloqueNicho(nicho)}
${bloqueContexto(ctx)}
Plan de 30 Días para "${nicho.nombre_producto}".
S1 (días 1-7): Configuración y primer resultado.
S2 (días 8-14): Primeros clientes/ventas.
S3 (días 15-21): Optimización.
S4 (días 22-30): Escala.
Por semana: objetivo + acciones diarias + herramientas + resultado esperado.
Usa acordeón. Sin html ni body.`);

  return crearShellHTML(nicho.nombre_producto, nicho.subtitulo, 'toolkit', [
    { icono: '✅', titulo: 'Checklist Maestro', contenido: intro },
    { icono: '📋', titulo: 'Plantillas', contenido: plantillas },
    { icono: '🔧', titulo: 'Herramientas', contenido: herramientas },
    { icono: '📊', titulo: 'Métricas y Alertas', contenido: metricas },
    { icono: '📅', titulo: 'Calendario 30 días', contenido: calendario },
  ]);
}

// ── Generador principal exportado ────────────────────
export async function generarProducto(nicho) {
  console.log(`[Generator] Tipo "${nicho.tipo}": "${nicho.nombre_producto}"`);
  let html = '';

  if (nicho.tipo === 'prompts')         html = await generarPackPrompts(nicho);
  else if (nicho.tipo === 'toolkit')    html = await generarToolkit(nicho);
  else                                  html = await generarGuiaPDF(nicho); // guia_pdf, mini_curso, plantilla

  console.log(`[Generator] Producto listo — ${html.length} caracteres`);
  return html;
}

export default generarProducto;
