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

// ── Shell HTML — diseño premium con progress tracking ─
function crearShellHTML(titulo, subtitulo, tipo, secciones) {
  const badges = {
    prompts:    '⚡ PROMPTS PREMIUM',
    plantilla:  '📋 PLANTILLA PREMIUM',
    guia_pdf:   '📘 GUÍA COMPLETA',
    mini_curso: '🎓 MINI CURSO',
    toolkit:    '🔧 TOOLKIT PREMIUM',
  };

  const totalSec = secciones.length;
  const productKey = titulo.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);

  const sidebarItems = secciones.map((s, i) => `
    <button class="tab-btn ${i === 0 ? 'active' : ''}" onclick="showTab(${i})" id="btn-${i}">
      <span class="tab-check" id="chk-${i}">
        <span class="check-num">${i + 1}</span>
        <span class="check-done">✓</span>
      </span>
      <span class="tab-label">${s.icono} ${s.titulo}</span>
    </button>`).join('');

  const mobileItems = secciones.map((s, i) => `
    <button class="mob-btn ${i === 0 ? 'active' : ''}" onclick="showTab(${i})" id="mbtn-${i}">
      <span class="mob-num" id="mchk-${i}">${i + 1}</span>
      <span>${s.icono} ${s.titulo}</span>
    </button>`).join('');

  const panels = secciones.map((s, i) => `
    <div class="tab-panel ${i === 0 ? 'active' : ''}" id="panel-${i}">
      <div class="panel-header">
        <div class="panel-meta">Sección ${i + 1} de ${totalSec}</div>
        <h2 class="panel-title">${s.icono} ${s.titulo}</h2>
      </div>
      <div class="panel-body">${s.contenido}</div>
      <div class="panel-nav">
        ${i > 0 ? `<button class="nav-btn nav-prev" onclick="showTab(${i - 1})">← Anterior</button>` : '<span></span>'}
        <button class="mark-btn" onclick="markDone(${i})" id="markbtn-${i}">Marcar como completado ✓</button>
        ${i < totalSec - 1 ? `<button class="nav-btn nav-next" onclick="showTab(${i + 1})">Siguiente →</button>` : '<span class="finish-badge">🎉 ¡Completaste el programa!</span>'}
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#070709;--surface:#0f0f13;--surface2:#17171d;--surface3:#1e1e26;
  --border:#23232e;--border2:#2d2d3a;
  --accent:#7c3aed;--accent2:#a855f7;--accent-dim:rgba(124,58,237,.08);
  --green:#10b981;--green-dim:rgba(16,185,129,.08);
  --amber:#f59e0b;--amber-dim:rgba(245,158,11,.08);
  --text:#eeeef0;--text2:#a0a0b0;--text3:#55556a;
  --radius:10px;--radius-lg:16px
}
html{scroll-behavior:smooth}
body{font-family:'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;font-size:15px;line-height:1.65}

/* ── Top bar ── */
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.topbar-brand{font-family:'Sora',sans-serif;font-size:0.85em;font-weight:800;color:var(--text);letter-spacing:-.3px;display:flex;align-items:center;gap:8px}
.topbar-brand span{background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.progress-wrap{flex:1;max-width:240px;margin:0 24px}
.progress-label{font-size:0.7em;color:var(--text3);margin-bottom:4px;display:flex;justify-content:space-between}
.progress-bar{height:4px;background:var(--border2);border-radius:4px;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:4px;transition:width .4s ease;width:0%}
.topbar-badge{font-size:0.7em;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--accent2);background:var(--accent-dim);border:1px solid rgba(168,85,247,.2);padding:4px 12px;border-radius:100px}

/* ── Hero header ── */
.hero{background:linear-gradient(160deg,#0f0f1a 0%,#130d1f 40%,#0a0a10 100%);border-bottom:1px solid var(--border);padding:48px 24px 40px;text-align:center;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-60px;left:50%;transform:translateX(-50%);width:600px;height:300px;background:radial-gradient(ellipse,rgba(124,58,237,.15) 0%,transparent 70%);pointer-events:none}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:var(--accent-dim);color:var(--accent2);border:1px solid rgba(168,85,247,.25);padding:5px 14px;border-radius:100px;font-size:0.7em;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px}
.hero h1{font-family:'Sora',sans-serif;color:#fff;font-size:clamp(1.5em,4.5vw,2.4em);font-weight:800;line-height:1.15;letter-spacing:-.5px;margin-bottom:12px}
.hero-sub{color:var(--text2);font-size:1em;max-width:520px;margin:0 auto 24px;line-height:1.7}
.hero-stats{display:flex;justify-content:center;gap:32px;flex-wrap:wrap}
.hero-stat{text-align:center}
.hero-stat .num{font-size:1.3em;font-weight:800;color:var(--accent2);font-family:'Sora',sans-serif}
.hero-stat .lbl{font-size:0.7em;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-top:1px}

/* ── Layout ── */
.layout{display:flex;min-height:calc(100vh - 56px)}

/* ── Sidebar ── */
.sidebar{width:260px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);padding:20px 0;position:sticky;top:56px;height:calc(100vh - 56px);overflow-y:auto;display:flex;flex-direction:column}
.sidebar-head{padding:0 18px 14px;border-bottom:1px solid var(--border);margin-bottom:8px}
.sidebar-head-label{font-size:0.66em;font-weight:700;letter-spacing:2px;color:var(--text3);text-transform:uppercase}
.sidebar-head-prog{font-size:0.78em;color:var(--accent2);font-weight:600;margin-top:2px}
.tab-btn{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:none;color:var(--text2);padding:10px 18px;cursor:pointer;font-size:0.875em;font-family:inherit;transition:all .15s;border-left:3px solid transparent;line-height:1.4;font-weight:500}
.tab-btn:hover{background:var(--surface2);color:var(--text)}
.tab-btn.active{background:var(--accent-dim);color:#fff;border-left-color:var(--accent2);font-weight:600}
.tab-btn.done{color:var(--green)}
.tab-btn.done.active{background:var(--green-dim);border-left-color:var(--green)}
.tab-check{width:22px;height:22px;border-radius:50%;background:var(--surface3);border:1px solid var(--border2);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.72em;font-weight:700;transition:all .2s;position:relative}
.tab-btn.active .tab-check{background:var(--accent);border-color:var(--accent);color:#fff}
.tab-btn.done .tab-check{background:var(--green);border-color:var(--green)}
.check-done{display:none;color:#fff;font-size:11px}
.tab-btn.done .check-num{display:none}
.tab-btn.done .check-done{display:block}
.tab-label{flex:1;line-height:1.35}
.sidebar-footer{margin-top:auto;padding:16px 18px;border-top:1px solid var(--border)}
.sidebar-footer p{font-size:0.74em;color:var(--text3);line-height:1.6}

/* ── Main content ── */
.content{flex:1;padding:36px 44px;max-width:860px;min-width:0}
.tab-panel{display:none;animation:fadeIn .22s ease}
.tab-panel.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

.panel-header{margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--border)}
.panel-meta{font-size:0.7em;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin-bottom:6px}
.panel-title{font-family:'Sora',sans-serif;font-size:clamp(1.3em,3vw,1.8em);font-weight:800;color:#fff;line-height:1.2}

/* Content elements */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px 28px;margin-bottom:16px;overflow-x:auto}
.card:hover{border-color:var(--border2)}
.card h3{color:#fff;margin-bottom:10px;font-size:1.05em;font-weight:700;font-family:'Sora',sans-serif}
.card h4{color:var(--text2);margin:18px 0 8px;font-size:0.75em;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
.card p{color:#bbbbc8;line-height:1.85;margin-bottom:10px}
.card ul,.card ol{padding-left:20px}
.card li{color:#bbbbc8;line-height:1.85;margin-bottom:8px}
.card strong{color:var(--text);font-weight:600}
.card em{color:var(--text2)}

.highlight{border-left:3px solid var(--accent2);background:var(--accent-dim);border-radius:0 var(--radius) var(--radius) 0;padding:16px 20px;margin:16px 0;color:var(--text);line-height:1.8;font-size:0.95em}
.highlight strong{color:var(--accent2)}

.tip{border-left:3px solid var(--amber);background:var(--amber-dim);border-radius:0 var(--radius) var(--radius) 0;padding:14px 20px;margin:14px 0;color:#d4a017;font-size:0.9em;line-height:1.75}
.tip::before{content:'💡 ';font-style:normal}

.info{border-left:3px solid var(--green);background:var(--green-dim);border-radius:0 var(--radius) var(--radius) 0;padding:14px 20px;margin:14px 0;color:var(--green);font-size:0.9em;line-height:1.75}

.prompt-box{background:#050508;border:1px solid var(--border2);border-radius:var(--radius);padding:20px;margin:14px 0;font-family:'Courier New',monospace;font-size:0.84em;color:#a5b4fc;white-space:pre-wrap;line-height:1.85;position:relative}
.copy-btn{position:absolute;top:10px;right:10px;background:var(--surface3);color:var(--text3);border:1px solid var(--border2);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.72em;font-weight:600;transition:all .15s;font-family:inherit}
.copy-btn:hover{color:#fff;border-color:var(--accent2)}

.checklist{list-style:none;padding:0}
.checklist li{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);color:#bbbbc8;line-height:1.75;font-size:0.93em;cursor:pointer;transition:color .15s}
.checklist li:last-child{border-bottom:none}
.checklist li:hover{color:var(--text)}
.checklist li::before{content:"☐";color:var(--accent2);font-size:1.1em;flex-shrink:0;margin-top:1px;transition:all .15s}
.checklist li.checked::before{content:"✅"}
.checklist li.checked{color:var(--text3);text-decoration:line-through}

.accordion-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;overflow:hidden;transition:border-color .15s}
.accordion-item:hover{border-color:var(--border2)}
.accordion-item.open{border-color:var(--accent2)}
.accordion-header{padding:14px 18px;cursor:pointer;color:var(--text);display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:0.9em;transition:background .15s;user-select:none}
.accordion-header:hover{background:var(--surface2)}
.accordion-body{padding:0 18px 18px;color:#bbbbc8;line-height:1.85;display:none;font-size:0.93em}
.accordion-body p{margin-bottom:10px}
.accordion-body ul{padding-left:20px}
.arrow{transition:transform .25s;color:var(--text3);font-size:0.9em}
.open .arrow{transform:rotate(180deg);color:var(--accent2)}
.open .accordion-body{display:block}

table{width:100%;border-collapse:collapse}
.table-wrap{overflow-x:auto;margin:14px 0;border-radius:var(--radius);border:1px solid var(--border)}
thead{background:var(--surface2)}
th{color:var(--text2);padding:11px 14px;text-align:left;font-size:0.75em;font-weight:700;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
td{padding:11px 14px;border-top:1px solid var(--border);color:#bbbbc8;font-size:0.875em;vertical-align:top;line-height:1.6}
tbody tr:hover{background:var(--surface2)}
td strong{color:var(--text)}

/* ── Panel navigation ── */
.panel-nav{display:flex;align-items:center;justify-content:space-between;margin-top:40px;padding-top:24px;border-top:1px solid var(--border);gap:12px;flex-wrap:wrap}
.nav-btn{background:var(--surface2);color:var(--text2);border:1px solid var(--border2);padding:10px 20px;border-radius:var(--radius);cursor:pointer;font-size:0.875em;font-weight:600;font-family:inherit;transition:all .15s}
.nav-btn:hover{background:var(--surface3);color:var(--text);border-color:var(--accent2)}
.nav-next{background:var(--accent);color:#fff;border-color:var(--accent)}
.nav-next:hover{background:var(--accent2);border-color:var(--accent2)}
.mark-btn{background:var(--green-dim);color:var(--green);border:1px solid rgba(16,185,129,.25);padding:10px 20px;border-radius:var(--radius);cursor:pointer;font-size:0.875em;font-weight:700;font-family:inherit;transition:all .15s}
.mark-btn:hover{background:var(--green);color:#fff}
.mark-btn.marked{background:var(--green);color:#fff;pointer-events:none}
.finish-badge{font-size:0.9em;font-weight:700;color:var(--accent2)}

/* ── Mobile bottom nav ── */
.mob-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding:8px 16px;overflow-x:auto;white-space:nowrap;z-index:100;scrollbar-width:none}
.mob-nav::-webkit-scrollbar{display:none}
.mob-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--text2);padding:8px 12px;cursor:pointer;font-size:0.8em;font-family:inherit;font-weight:500;border-radius:8px;white-space:nowrap;transition:all .15s}
.mob-btn.active{background:var(--accent-dim);color:var(--accent2);font-weight:700}
.mob-btn.done{color:var(--green)}
.mob-num{width:18px;height:18px;border-radius:50%;background:var(--surface3);color:var(--text3);display:inline-flex;align-items:center;justify-content:center;font-size:0.7em;font-weight:700}
.mob-btn.active .mob-num{background:var(--accent);color:#fff}
.mob-btn.done .mob-num{background:var(--green);color:#fff}

/* ── Footer ── */
.footer{background:var(--surface);border-top:1px solid var(--border);padding:20px 24px;text-align:center}
.footer p{color:var(--text3);font-size:0.76em}

@media(max-width:820px){
  .sidebar{display:none}
  .mob-nav{display:block}
  .content{padding:20px 16px;padding-bottom:80px}
  .hero{padding:32px 16px}
  .hero-stats{gap:20px}
  .topbar-badge{display:none}
}
@media(max-width:500px){
  .hero h1{font-size:1.4em}
  .progress-wrap{display:none}
}
</style>
</head>
<body>

<!-- Top bar -->
<div class="topbar">
  <div class="topbar-brand">Nexus <span>Labs</span></div>
  <div class="progress-wrap">
    <div class="progress-label">
      <span>Tu progreso</span>
      <span id="prog-label">0/${totalSec}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="prog-fill"></div></div>
  </div>
  <div class="topbar-badge">${badges[tipo] || '⚡ PREMIUM'}</div>
</div>

<!-- Hero -->
<div class="hero">
  <div class="hero-badge">${badges[tipo] || '⚡ PRODUCTO PREMIUM'}</div>
  <h1>${titulo}</h1>
  <p class="hero-sub">${subtitulo}</p>
  <div class="hero-stats">
    <div class="hero-stat"><div class="num">${totalSec}</div><div class="lbl">Secciones</div></div>
    <div class="hero-stat"><div class="num" id="hero-done">0</div><div class="lbl">Completadas</div></div>
    <div class="hero-stat"><div class="num">∞</div><div class="lbl">Acceso de por vida</div></div>
  </div>
</div>

<!-- Mobile bottom nav -->
<div class="mob-nav">${mobileItems}</div>

<!-- Layout -->
<div class="layout">
  <nav class="sidebar">
    <div class="sidebar-head">
      <div class="sidebar-head-label">Contenido del programa</div>
      <div class="sidebar-head-prog" id="sidebar-prog">0 de ${totalSec} completadas</div>
    </div>
    ${sidebarItems}
    <div class="sidebar-footer">
      <p>Nexus Labs · Todos los derechos reservados · Acceso personal e intransferible</p>
    </div>
  </nav>
  <main class="content">
    ${panels}
  </main>
</div>

<div class="footer">
  <p>© 2026 ${titulo} · Nexus Labs · hola@gananciasconai.com · Acceso personal e intransferible</p>
</div>

<script>
(function(){
  var TOTAL=${totalSec};
  var KEY='nx_prog_${productKey}';
  var done=JSON.parse(localStorage.getItem(KEY)||'[]');

  function updateProgress(){
    var pct=Math.round(done.length/TOTAL*100);
    var fill=document.getElementById('prog-fill');
    var label=document.getElementById('prog-label');
    var heroDone=document.getElementById('hero-done');
    var sideProg=document.getElementById('sidebar-prog');
    if(fill)fill.style.width=pct+'%';
    if(label)label.textContent=done.length+'/'+TOTAL;
    if(heroDone)heroDone.textContent=done.length;
    if(sideProg)sideProg.textContent=done.length+' de '+TOTAL+' completadas';
    done.forEach(function(i){
      var btn=document.getElementById('btn-'+i);
      var mbtn=document.getElementById('mbtn-'+i);
      var markbtn=document.getElementById('markbtn-'+i);
      if(btn){btn.classList.add('done');}
      if(mbtn){mbtn.classList.add('done');var mn=mbtn.querySelector('.mob-num');if(mn)mn.textContent='✓';}
      if(markbtn){markbtn.textContent='✅ Completado';markbtn.classList.add('marked');}
    });
  }

  window.showTab=function(i){
    document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
    document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.mob-btn').forEach(function(b){b.classList.remove('active');});
    var panel=document.getElementById('panel-'+i);
    var btn=document.getElementById('btn-'+i);
    var mbtn=document.getElementById('mbtn-'+i);
    if(panel)panel.classList.add('active');
    if(btn)btn.classList.add('active');
    if(mbtn)mbtn.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
  };

  window.markDone=function(i){
    if(done.indexOf(i)<0){done.push(i);localStorage.setItem(KEY,JSON.stringify(done));}
    updateProgress();
  };

  // Checklist interactivo
  document.addEventListener('click',function(e){
    var li=e.target.closest('.checklist li');
    if(li)li.classList.toggle('checked');
  });

  // Accordion
  window.toggleAccordion=function(el){el.parentElement.classList.toggle('open');};

  // Copy buttons para prompt-boxes
  document.querySelectorAll('.prompt-box').forEach(function(box){
    var btn=box.querySelector('.copy-btn');
    if(!btn)return;
    btn.addEventListener('click',function(){
      var text=box.innerText.replace(/^Copiar$/m,'').trim();
      navigator.clipboard.writeText(text).catch(function(){});
      btn.textContent='✅ Copiado';
      setTimeout(function(){btn.textContent='Copiar';},2000);
    });
  });

  // Table wrap
  document.querySelectorAll('table').forEach(function(table){
    if(table.closest('.table-wrap'))return;
    var wrap=document.createElement('div');
    wrap.className='table-wrap';
    table.parentNode.insertBefore(wrap,table);
    wrap.appendChild(table);
  });

  updateProgress();
}());
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
