// ════════════════════════════════════════════════════
// PUBLISHER — Landing page de ventas + Stripe
// Genera la página de venta (distinta del producto HTML)
// y la sirve desde Railway en /p/:slug
// ════════════════════════════════════════════════════

import { AnthropicConnector } from '../connectors/anthropic.connector.js';
import { StripeConnector }    from '../connectors/stripe.connector.js';
import { query }              from '../config/database.js';
import { TelegramConnector }  from '../connectors/telegram.connector.js';
import ENV                    from '../config/env.js';

// Genera un slug URL-safe a partir del nombre del producto
function generarSlug(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quita tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) + '-' + Date.now().toString(36);
}

// ── Genera HTML de la landing page de ventas ───────
async function generarLandingHTML(nicho, stripeLink) {
  const puntos = (nicho.puntos_de_venta || nicho.modulos_temas || []).slice(0, 6);
  const precioOriginal = Math.round(nicho.precio * 2.5 / 5) * 5;

  const textoRaw = await AnthropicConnector.completar({
    model:     'claude-haiku-4-5-20251001',
    maxTokens: 1600,
    system:    'Eres copywriter experto en marketing directo para el mercado hispano de USA. Responde SOLO con JSON válido, sin bloques de código ni markdown.',
    prompt: `Genera copy de ventas en JSON para este producto digital. El estilo debe ser directo, específico, emocional — como lo haría un marketer de respuesta directa experto, no corporativo.

Producto: ${nicho.nombre_producto}
Problema que resuelve: ${nicho.problema_que_resuelve}
Cliente ideal: ${nicho.cliente_ideal}
Quick win: ${nicho.quick_win || 'Resultados desde el primer día'}
Precio: $${nicho.precio}

Responde EXACTAMENTE con este JSON (sin markdown):
{
  "headline": "headline de 1 línea — resultado específico con número si aplica",
  "subtitulo": "quién es para quién y el pain específico — 1-2 líneas",
  "historia_intro": "1 párrafo: el problema desde adentro — como si lo viviste tú, lenguaje coloquial",
  "antes_despues": {"antes":"situación dolorosa específica antes","despues":"transformación concreta después"},
  "problema": "descripción del problema en 2-3 oraciones, muy específica para el cliente ideal",
  "urgencia": "1 línea de escasez/urgencia real y creíble",
  "testimonios": [
    {"nombre":"nombre hispano real","ciudad":"ciudad USA","texto":"testimonio con resultado numérico específico","inicial":"X"},
    {"nombre":"nombre hispano real","ciudad":"ciudad USA","texto":"testimonio con resultado numérico específico","inicial":"X"},
    {"nombre":"nombre hispano real","ciudad":"ciudad USA","texto":"testimonio con resultado numérico específico","inicial":"X"}
  ],
  "faqs": [
    {"p":"pregunta de objeción real que tiene el cliente antes de comprar","r":"respuesta directa y convincente"},
    {"p":"segunda objeción real","r":"respuesta directa y convincente"},
    {"p":"tercera objeción real","r":"respuesta directa y convincente"}
  ],
  "garantia": "texto de garantía de 1-2 oraciones, empático y sin letra chica",
  "headline_final": "headline final de urgencia — 1 línea que impulsa a actuar ya"
}`,
  });

  let txt = {};
  try {
    txt = JSON.parse(textoRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch (_) {
    txt = {
      headline:       nicho.quick_win || `Cómo lograr resultados con ${nicho.nombre_producto} desde la primera semana`,
      subtitulo:      `Para ${nicho.cliente_ideal} que quiere ${nicho.problema_que_resuelve} sin complicaciones`,
      historia_intro: `Sé exactamente cómo se siente. Buscas resultados reales pero cada vez que intentas avanzar algo te frena. ${nicho.nombre_producto} existe porque eso tiene solución.`,
      antes_despues:  { antes: 'Días perdidos sin saber por dónde empezar', despues: 'Sistema claro que da resultados desde el primer día' },
      problema:       `Como ${nicho.cliente_ideal}, sabes lo que cuesta avanzar sin la guía correcta. ${nicho.problema_que_resuelve} no debería ser tan difícil.`,
      urgencia:       `Solo disponible al precio de lanzamiento por tiempo limitado`,
      testimonios:    [
        { nombre: 'María G.', ciudad: 'Miami, FL',       texto: 'En 2 semanas ya vi resultados concretos. Lo recomiendo al 100%.', inicial: 'M' },
        { nombre: 'Carlos R.', ciudad: 'Houston, TX',    texto: 'Por fin un sistema claro. Recuperé mi inversión en 30 días.',     inicial: 'C' },
        { nombre: 'Ana L.',   ciudad: 'Los Angeles, CA', texto: 'Simple, directo y funciona. Ojalá lo hubiera encontrado antes.',  inicial: 'A' },
      ],
      faqs: [
        { p: '¿Necesito experiencia previa?',         r: 'No. El sistema está diseñado paso a paso para que funcione desde cero.' },
        { p: '¿Cuándo recibo acceso?',                r: 'Inmediatamente después de tu pago. Te llega un email con el link de acceso.' },
        { p: '¿Y si no funciona para mí?',            r: 'Tienes 30 días de garantía. Si no estás satisfecho, te devolvemos el 100%.' },
      ],
      garantia:       'Si en 30 días no ves resultados, te devolvemos el 100% de tu dinero sin preguntas ni trámites.',
      headline_final: `Esta es tu oportunidad — actúa antes de que suba el precio`,
    };
  }

  // Value stack items
  const stackItems = puntos.length > 0
    ? puntos.map((p, i) => {
        const vals = [27, 37, 47, 19, 29, 24];
        return `<div class="stack-item">
        <div class="stack-left">
          <div class="stack-check">✓</div>
          <div class="stack-text">
            <div class="stack-name">${p}</div>
            <div class="stack-val">Valor: <s>$${vals[i] || 29}</s></div>
          </div>
        </div>
        <div class="stack-price">Incluido</div>
      </div>`;
      }).join('')
    : `<div class="stack-item"><div class="stack-left"><div class="stack-check">✓</div><div class="stack-text"><div class="stack-name">Sistema completo paso a paso</div><div class="stack-val">Valor: <s>$47</s></div></div></div><div class="stack-price">Incluido</div></div>
    <div class="stack-item"><div class="stack-left"><div class="stack-check">✓</div><div class="stack-text"><div class="stack-name">Guía de implementación rápida</div><div class="stack-val">Valor: <s>$27</s></div></div></div><div class="stack-price">Incluido</div></div>
    <div class="stack-item"><div class="stack-left"><div class="stack-check">✓</div><div class="stack-text"><div class="stack-name">Plantillas y recursos listos para usar</div><div class="stack-val">Valor: <s>$37</s></div></div></div><div class="stack-price">Incluido</div></div>
    <div class="stack-item"><div class="stack-left"><div class="stack-check">✓</div><div class="stack-text"><div class="stack-name">Soporte por email — preguntas respondidas</div><div class="stack-val">Valor: <s>$29</s></div></div></div><div class="stack-price">Incluido</div></div>`;

  // Testimonios HTML
  const testimoniosHTML = (txt.testimonios || []).map(t => `
    <div class="testimonial">
      <div class="stars">★★★★★</div>
      <p>"${t.texto}"</p>
      <div class="testimonial-author">
        <div class="avatar">${t.inicial || t.nombre[0]}</div>
        <div>
          <div class="author-name">${t.nombre}</div>
          <div class="author-loc">${t.ciudad}</div>
        </div>
      </div>
    </div>`).join('');

  // FAQs HTML
  const faqsHTML = (txt.faqs || []).map((f, i) => `
    <div class="faq-item">
      <button class="faq-q" onclick="nexusFaq(${i})">
        <span>${f.p}</span>
        <svg id="faq-arrow-${i}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a" id="faq-a-${i}">${f.r}</div>
    </div>`).join('');

  const productoKey = nicho.nombre_producto.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const nombreEsc   = nicho.nombre_producto.replace(/'/g, "\\'");
  const totalValor  = puntos.length > 0 ? puntos.length * 30 + 47 : 140;

  let html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>${nicho.nombre_producto} — Acceso inmediato</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080808;--card:#111;--card2:#161616;--border:#222;
  --text:#f0f0f0;--muted:#777;--accent:#00e87a;
  --cta:#ff6b2b;--cta-hover:#ff8447;--cta-shadow:rgba(255,107,43,.35);
  --red:#ff4444;--gold:#f5a623
}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.65;overflow-x:hidden;font-size:16px}
/* — Sticky mobile CTA bar — */
.mobile-cta-bar{display:none;position:fixed;bottom:0;left:0;right:0;z-index:999;background:#0e0e0e;border-top:1px solid var(--border);padding:12px 16px;box-shadow:0 -4px 24px rgba(0,0,0,.6)}
.mobile-cta-bar a{display:block;background:var(--cta);color:#fff;font-size:15px;font-weight:800;text-align:center;padding:14px;border-radius:10px;text-decoration:none;letter-spacing:-.2px}
@media(max-width:680px){.mobile-cta-bar{display:block}body{padding-bottom:80px}}
/* — Top bar — */
.topbar{background:#0d0d0d;border-bottom:1px solid var(--border);padding:9px 20px;text-align:center;font-size:12px;color:var(--muted);letter-spacing:.3px}
.topbar strong{color:var(--accent)}
/* — Hero — */
.hero{max-width:780px;margin:0 auto;padding:56px 20px 48px;text-align:center}
.badge-row{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.badge{display:inline-flex;align-items:center;gap:5px;background:rgba(0,232,122,.08);border:1px solid rgba(0,232,122,.2);color:var(--accent);font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:5px 12px;border-radius:100px}
.badge-orange{background:rgba(255,107,43,.1);border-color:rgba(255,107,43,.3);color:var(--cta)}
h1{font-size:clamp(28px,6vw,54px);font-weight:900;line-height:1.1;letter-spacing:-2px;margin-bottom:20px}
.grad{background:linear-gradient(135deg,#fff 30%,var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.subtitle{font-size:clamp(15px,2.5vw,19px);color:var(--muted);max-width:580px;margin:0 auto 32px;line-height:1.65}
/* CTA button */
.cta-btn{display:inline-block;background:var(--cta);color:#fff;font-size:clamp(15px,2.5vw,18px);font-weight:800;padding:18px 44px;border-radius:14px;text-decoration:none;letter-spacing:-.3px;transition:transform .15s,box-shadow .15s;box-shadow:0 4px 32px var(--cta-shadow);white-space:nowrap}
.cta-btn:hover{transform:translateY(-2px);box-shadow:0 6px 48px var(--cta-shadow)}
.cta-sub{margin-top:12px;font-size:12px;color:var(--muted);display:flex;justify-content:center;gap:12px;flex-wrap:wrap}
.cta-sub span::before{content:'✓ ';color:var(--accent)}
.urgency-bar{margin-top:18px;display:inline-flex;align-items:center;gap:8px;background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.25);color:var(--gold);font-size:13px;font-weight:700;padding:8px 18px;border-radius:100px}
.urgency-bar .cd{font-family:monospace;font-size:15px}
/* — Proof bar — */
.proof-bar{background:var(--card);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:20px 24px;display:flex;justify-content:center;gap:40px;flex-wrap:wrap}
.proof-item{text-align:center;padding:4px 0}
.proof-item .num{font-size:26px;font-weight:900;color:var(--accent);letter-spacing:-1px;line-height:1}
.proof-item .lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
/* — Live counter — */
.live-bar{text-align:center;padding:10px;font-size:13px;color:var(--muted);background:rgba(0,232,122,.04);border-bottom:1px solid var(--border)}
.live-dot{display:inline-block;width:7px;height:7px;background:#00e87a;border-radius:50%;margin-right:6px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
/* — Sections — */
.section{max-width:780px;margin:0 auto;padding:60px 20px}
.section-tag{font-size:10px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
h2{font-size:clamp(22px,4vw,38px);font-weight:900;letter-spacing:-1.2px;line-height:1.15;margin-bottom:14px}
.section-sub{font-size:15px;color:var(--muted);margin-bottom:40px;max-width:580px;line-height:1.7}
/* — Historia intro — */
.story-box{background:var(--card);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:12px;padding:24px 28px;font-size:15px;color:#ccc;line-height:1.8;font-style:italic}
/* — Antes/Después — */
.before-after{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:32px}
.ba-box{border-radius:14px;padding:24px;text-align:center}
.ba-before{background:rgba(255,68,68,.06);border:1px solid rgba(255,68,68,.2)}
.ba-after{background:rgba(0,232,122,.06);border:1px solid rgba(0,232,122,.2)}
.ba-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.ba-before .ba-label{color:var(--red)}
.ba-after .ba-label{color:var(--accent)}
.ba-text{font-size:14px;line-height:1.6;color:var(--muted)}
@media(max-width:480px){.before-after{grid-template-columns:1fr}}
/* — Value stack — */
.stack-list{display:grid;gap:10px}
.stack-item{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 18px;transition:border-color .2s}
.stack-item:hover{border-color:#333}
.stack-left{display:flex;align-items:center;gap:12px}
.stack-check{width:26px;height:26px;background:rgba(0,232,122,.12);border:1px solid rgba(0,232,122,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:var(--accent);font-weight:800}
.stack-name{font-size:14px;font-weight:600;color:var(--text)}
.stack-val{font-size:12px;color:var(--muted);margin-top:2px}
.stack-val s{color:var(--red)}
.stack-price{font-size:13px;font-weight:700;color:var(--accent);white-space:nowrap}
.stack-total{background:rgba(0,232,122,.06);border:1px solid rgba(0,232,122,.2);border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-top:6px}
.stack-total .lbl{font-size:14px;color:var(--muted)}
.stack-total .val{font-size:18px;font-weight:900;color:var(--accent)}
/* — Testimonials — */
.testimonials{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.testimonial{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:22px}
.stars{color:var(--gold);font-size:13px;margin-bottom:10px;letter-spacing:1px}
.testimonial p{font-size:13px;color:#aaa;margin-bottom:14px;font-style:italic;line-height:1.65}
.t-author{display:flex;align-items:center;gap:10px}
.avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#00aaff);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#000;flex-shrink:0}
.author-name{font-size:12px;font-weight:700;color:var(--text)}
.author-loc{font-size:11px;color:var(--muted)}
/* — Price box — */
.price-box{background:var(--card);border:2px solid var(--border);border-radius:20px;padding:40px 32px;text-align:center;position:relative;overflow:hidden;max-width:500px;margin:0 auto}
.price-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--cta),#ff9147)}
.price-tag-badge{display:inline-block;background:rgba(255,68,68,.12);border:1px solid rgba(255,68,68,.3);color:var(--red);font-size:12px;font-weight:800;padding:5px 14px;border-radius:100px;margin-bottom:20px;letter-spacing:.3px}
.price-original{font-size:15px;color:var(--muted);text-decoration:line-through;margin-bottom:4px}
.price-current{font-size:clamp(60px,14vw,80px);font-weight:900;letter-spacing:-4px;color:var(--text);line-height:1}
.price-save{font-size:13px;color:var(--accent);font-weight:700;margin:6px 0 24px}
.price-note{font-size:13px;color:var(--muted);margin-bottom:24px}
.guarantee-box{margin-top:20px;padding:16px;background:rgba(0,232,122,.05);border:1px solid rgba(0,232,122,.15);border-radius:10px;font-size:13px;color:var(--muted);line-height:1.6}
.guarantee-box strong{color:var(--text)}
/* — Payment badges — */
.payment-badges{display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
.pay-badge{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.3px}
/* — FAQ — */
.faq-list{display:grid;gap:10px}
.faq-item{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.faq-q{width:100%;background:none;border:none;color:var(--text);padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;font-size:14px;font-weight:600;text-align:left}
.faq-q svg{flex-shrink:0;color:var(--accent);transition:transform .25s}
.faq-q.open svg{transform:rotate(180deg)}
.faq-a{max-height:0;overflow:hidden;font-size:14px;color:var(--muted);line-height:1.7;padding:0 20px;transition:max-height .3s ease,padding .3s ease}
.faq-a.open{max-height:200px;padding:0 20px 18px}
/* — Footer CTA — */
.footer-cta{background:var(--card);border-top:1px solid var(--border);padding:64px 20px;text-align:center}
.footer-cta h2{margin-bottom:10px}
.footer-cta p{color:var(--muted);font-size:14px;margin-bottom:28px}
/* — Divider — */
.divider{height:1px;background:var(--border)}
/* — Footer — */
.site-footer{text-align:center;padding:28px 20px;border-top:1px solid var(--border);color:var(--muted);font-size:11px;line-height:2.2}
.site-footer a{color:var(--muted);text-decoration:underline;margin:0 10px}
</style>
</head>
<body>

<!-- Sticky mobile CTA -->
<div class="mobile-cta-bar">
  <a href="${stripeLink}" class="nexus-cta-btn">🔒 Acceder ahora por $${nicho.precio} →</a>
</div>

<!-- Top bar -->
<div class="topbar">
  🔥 Oferta de lanzamiento — precio sube pronto &nbsp;·&nbsp; <strong>Garantía 30 días</strong> &nbsp;·&nbsp; Acceso inmediato
</div>

<!-- Hero -->
<div class="hero">
  <div class="badge-row">
    <span class="badge">✓ Método Validado</span>
    <span class="badge badge-orange">🔥 Precio de lanzamiento</span>
  </div>
  <h1><span class="grad">${txt.headline}</span></h1>
  <p class="subtitle">${txt.subtitulo}</p>
  <a href="${stripeLink}" class="cta-btn nexus-cta-btn">Quiero acceso inmediato →</a>
  <div class="cta-sub">
    <span>Pago único</span>
    <span>Acceso inmediato</span>
    <span>Garantía 30 días</span>
    <span>Sin suscripciones</span>
  </div>
  <div class="urgency-bar">
    ⏰ Precio especial termina en: <span class="cd" id="nexus-cd1">48:00:00</span>
  </div>
</div>

<!-- Live visitor counter -->
<div class="live-bar">
  <span class="live-dot"></span>
  <span id="nexus-live-count">23</span> personas están viendo esto ahora mismo
</div>

<!-- Proof bar -->
<div class="proof-bar">
  <div class="proof-item"><div class="num">+1,200</div><div class="lbl">Clientes activos</div></div>
  <div class="proof-item"><div class="num">4.9★</div><div class="lbl">Calificación</div></div>
  <div class="proof-item"><div class="num">30 días</div><div class="lbl">Garantía total</div></div>
  <div class="proof-item"><div class="num">Hoy</div><div class="lbl">Acceso inmediato</div></div>
</div>

<!-- Historia / Problema -->
<div class="section">
  <div class="section-tag">Por qué esto existe</div>
  <h2>¿Te suena familiar?</h2>
  <div class="story-box">${txt.historia_intro || txt.problema}</div>
  <div class="before-after">
    <div class="ba-box ba-before">
      <div class="ba-label">Antes</div>
      <div class="ba-text">${(txt.antes_despues || {}).antes || 'Sin sistema, sin resultados, sin claridad'}</div>
    </div>
    <div class="ba-box ba-after">
      <div class="ba-label">Después</div>
      <div class="ba-text">${(txt.antes_despues || {}).despues || 'Sistema claro, resultados reales, progreso visible'}</div>
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- Value stack -->
<div class="section">
  <div class="section-tag">Qué incluye</div>
  <h2>${nicho.nombre_producto}</h2>
  <p class="section-sub">Todo lo que necesitas desde el momento que pagas. Sin extras, sin trampa.</p>
  <div class="stack-list">
    ${stackItems}
    <div class="stack-total">
      <div class="lbl">Valor total combinado</div>
      <div class="val">$${totalValor}+ → solo $${nicho.precio} hoy</div>
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- Testimonios -->
<div class="section">
  <div class="section-tag">Resultados reales</div>
  <h2>Lo que dicen quienes ya lo tienen</h2>
  <div class="testimonials">${testimoniosHTML}</div>
</div>

<div class="divider"></div>

<!-- Precio -->
<div class="section" id="precio">
  <div class="section-tag">Tu inversión</div>
  <h2 style="text-align:center;margin-bottom:32px">Accede hoy al precio de lanzamiento</h2>
  <div class="price-box">
    <div class="price-tag-badge">🔥 Oferta especial — <span class="cd" id="nexus-cd2">48:00:00</span></div>
    <div class="price-original">Precio normal: $${precioOriginal}</div>
    <div class="price-current">$${nicho.precio}</div>
    <div class="price-save">Ahorras $${precioOriginal - nicho.precio} — pago único para siempre</div>
    <div class="price-note">Acceso inmediato · Sin renovaciones · Sin sorpresas</div>
    <a href="${stripeLink}" class="cta-btn nexus-cta-btn" style="display:block;text-align:center">Acceder ahora por $${nicho.precio} →</a>
    <div class="guarantee-box">🛡 <strong>Garantía 30 días sin preguntas.</strong><br>${txt.garantia}</div>
    <div class="payment-badges">
      <div class="pay-badge">🔒 SSL Seguro</div>
      <div class="pay-badge">💳 Visa / MC</div>
      <div class="pay-badge">⚡ Stripe</div>
      <div class="pay-badge">📧 Entrega inmediata</div>
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- FAQ -->
<div class="section">
  <div class="section-tag">Preguntas frecuentes</div>
  <h2>Resolvemos tus dudas</h2>
  <div class="faq-list">${faqsHTML}</div>
</div>

<div class="divider"></div>

<!-- Footer CTA -->
<div class="footer-cta">
  <h2>${txt.headline_final}</h2>
  <p>${txt.urgencia || 'Precio de lanzamiento disponible por tiempo limitado'} — <span class="cd" id="nexus-cd3">48:00:00</span></p>
  <a href="${stripeLink}" class="cta-btn nexus-cta-btn">Empezar ahora por $${nicho.precio} →</a>
  <div style="margin-top:14px;font-size:12px;color:var(--muted)">Pago seguro · Garantía 30 días · Acceso inmediato</div>
</div>

<!-- Footer -->
<div class="site-footer">
  <div>
    <a href="/privacidad">Política de Privacidad</a>
    <a href="/terminos">Términos y Condiciones</a>
  </div>
  <div>${ENV.EMAIL_FROM_NAME || 'Nexus Labs'} · ${ENV.EMAIL_FROM || 'hola@gananciasconai.com'}</div>
  <div>© ${new Date().getFullYear()} · Todos los derechos reservados</div>
</div>

</body>
</html>`;

  // Inyectar Meta Pixel si está configurado
  if (ENV.META_PIXEL_ID) {
    const pixel = `<!-- Meta Pixel --><script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ENV.META_PIXEL_ID}');fbq('track','PageView');fbq('track','ViewContent',{content_name:'${nombreEsc}',value:${nicho.precio},currency:'USD'});</script><noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${ENV.META_PIXEL_ID}&ev=PageView&noscript=1"/></noscript><!-- End Meta Pixel -->`;
    html = html.replace('</head>', pixel + '\n</head>');
  }

  // Scripts: countdown + live counter + FAQ + InitiateCheckout pixel
  const script = `<script>(function(){
// Countdown 48h persistente
var key='nexus_offer_${productoKey}';
var end=parseInt(localStorage.getItem(key)||'0');
if(!end||end<Date.now()){end=Date.now()+48*3600000;localStorage.setItem(key,end);}
function pad(n){return n<10?'0'+n:String(n);}
function tick(){
  var diff=Math.max(0,end-Date.now());
  var h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
  var t=pad(h)+':'+pad(m)+':'+pad(s);
  document.querySelectorAll('.cd').forEach(function(el){el.textContent=t;});
  if(diff>0)setTimeout(tick,1000);
}
tick();
// Live visitor counter — oscila entre 18 y 41
var liveEl=document.getElementById('nexus-live-count');
if(liveEl){
  var base=18+Math.floor(Math.random()*14);
  liveEl.textContent=base;
  setInterval(function(){
    base=Math.max(18,Math.min(41,base+(Math.random()>.5?1:-1)));
    liveEl.textContent=base;
  },7000);
}
// FAQ accordion
window.nexusFaq=function(i){
  var a=document.getElementById('faq-a-'+i);
  var q=a?a.previousElementSibling:null;
  if(!a)return;
  var open=a.classList.toggle('open');
  if(q)q.classList.toggle('open',open);
};
// InitiateCheckout pixel + scroll depth events
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.nexus-cta-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      if(typeof fbq!=='undefined'){
        fbq('track','InitiateCheckout',{value:${nicho.precio},currency:'USD',content_name:'${nombreEsc}'});
      }
    });
  });
  // Scroll depth: 25 / 50 / 75%
  var fired={};
  window.addEventListener('scroll',function(){
    var pct=Math.round((window.scrollY/(document.body.scrollHeight-window.innerHeight))*100);
    [25,50,75].forEach(function(t){
      if(pct>=t&&!fired[t]){
        fired[t]=true;
        if(typeof fbq!=='undefined') fbq('trackCustom','ScrollDepth',{depth:t,page:'${productoKey}'});
      }
    });
  },{passive:true});
});
}());</script>`;

  html = html.replace('</body>', script + '\n</body>');
  return html;
}

// ── PUBLICAR PRODUCTO CON STRIPE ────────────────────
// Crea el payment link de Stripe, genera la landing de ventas
// y guarda todo en la BD. La landing queda accesible en /p/:slug
export async function publicarConStripe(nicho, htmlProducto, experimentoId = null) {
  const notif = (m) => TelegramConnector.notificar(m).catch(() => {});

  if (!StripeConnector.disponible()) {
    throw new Error('STRIPE_SECRET_KEY no configurado — agrega la variable en Railway');
  }

  // Reusar Stripe si el experimento ya tiene uno — evita duplicados en cada relaunch
  let stripeData = null;
  if (experimentoId) {
    const { rows } = await query(
      `SELECT stripe_product_id, stripe_price_id, stripe_payment_link, landing_slug FROM experiments WHERE id = $1`,
      [experimentoId]
    ).catch(() => ({ rows: [] }));
    const exp = rows[0];
    if (exp?.stripe_payment_link && exp?.landing_slug) {
      stripeData = {
        stripe_product_id:   exp.stripe_product_id,
        stripe_price_id:     exp.stripe_price_id,
        stripe_payment_link: exp.stripe_payment_link,
      };
      console.log(`[Publisher] Reusando Stripe existente para experimento #${experimentoId}`);
    }
  }

  if (!stripeData) {
    await notif('💳 Creando producto en Stripe...');
    stripeData = await StripeConnector.crearProductoCompleto({
      nombre:      nicho.nombre_producto,
      descripcion: nicho.problema_que_resuelve || nicho.subtitulo || '',
      precio:      nicho.precio,
    });
  }

  await notif('🎨 Generando landing page de ventas...');
  const landingHTML = await generarLandingHTML(nicho, stripeData.stripe_payment_link);

  // Reusar slug existente si el experimento ya tiene uno (mantiene la URL estable)
  let slug = null;
  if (experimentoId) {
    const { rows } = await query(
      `SELECT landing_slug FROM experiments WHERE id = $1`,
      [experimentoId]
    ).catch(() => ({ rows: [] }));
    slug = rows[0]?.landing_slug || null;
  }
  if (!slug) slug = generarSlug(nicho.nombre_producto);

  const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
  const landingUrl = `${dominio}/p/${slug}`;

  // Actualizar o crear el experimento en BD con los datos de Stripe y la landing
  if (experimentoId) {
    await query(
      `UPDATE experiments SET
        stripe_product_id      = $1,
        stripe_price_id        = $2,
        stripe_payment_link    = $3,
        stripe_payment_link_id = $4,
        landing_slug           = $5,
        landing_html           = $6,
        producto_url           = $7,
        contenido_producto     = COALESCE($8, contenido_producto),
        actualizado_en         = NOW()
       WHERE id = $9`,
      [
        stripeData.stripe_product_id,
        stripeData.stripe_price_id,
        stripeData.stripe_payment_link,
        stripeData.stripe_payment_link_id || null,
        slug,
        landingHTML,
        landingUrl,
        htmlProducto || null,
        experimentoId,
      ]
    );
  } else {
    const { rows } = await query(
      `INSERT INTO experiments (nicho, nombre, tipo, precio, stripe_product_id, stripe_price_id, stripe_payment_link, stripe_payment_link_id, landing_slug, landing_html, producto_url, contenido_producto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        nicho.nicho,
        nicho.nombre_producto,
        nicho.tipo || 'guia_pdf',
        nicho.precio,
        stripeData.stripe_product_id,
        stripeData.stripe_price_id,
        stripeData.stripe_payment_link,
        stripeData.stripe_payment_link_id || null,
        slug,
        landingHTML,
        landingUrl,
        htmlProducto || '',
      ]
    );
    experimentoId = rows[0]?.id;
  }

  console.log(`[Publisher] Publicado: ${nicho.nombre_producto} | ${landingUrl}`);
  return {
    landing_url:          landingUrl,
    stripe_payment_link:  stripeData.stripe_payment_link,
    stripe_product_id:    stripeData.stripe_product_id,
    landing_slug:         slug,
    experimento_id:       experimentoId,
  };
}

export default publicarConStripe;
