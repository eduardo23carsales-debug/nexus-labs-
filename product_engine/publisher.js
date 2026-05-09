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
  const precioOriginal = Math.round(nicho.precio * 2.7 / 10) * 10;

  // Claude Haiku genera solo el texto — el diseño lo controla la plantilla
  const textoRaw = await AnthropicConnector.completar({
    model:     'claude-haiku-4-5-20251001',
    maxTokens: 1200,
    system:    'Eres copywriter experto en ventas para el mercado hispano de USA. Responde SOLO con JSON válido, sin bloques de código.',
    prompt: `Genera texto de ventas en JSON para este producto digital:

Producto: ${nicho.nombre_producto}
Problema que resuelve: ${nicho.problema_que_resuelve}
Cliente ideal: ${nicho.cliente_ideal}
Quick win: ${nicho.quick_win || 'Resultados desde el primer día'}
Precio: $${nicho.precio}

Responde EXACTAMENTE con este JSON (sin markdown):
{
  "headline": "headline impactante de 1 línea sobre el quick win",
  "subtitulo": "subtítulo de 1-2 líneas sobre el problema que resuelve",
  "problema": "descripción del problema en 2-3 oraciones específicas para el cliente ideal",
  "testimonios": [
    {"nombre":"nombre hispano","ciudad":"ciudad USA","texto":"testimonio con resultado numérico","inicial":"X"},
    {"nombre":"nombre hispano","ciudad":"ciudad USA","texto":"testimonio con resultado numérico","inicial":"X"},
    {"nombre":"nombre hispano","ciudad":"ciudad USA","texto":"testimonio con resultado numérico","inicial":"X"}
  ],
  "garantia": "texto de garantía empático de 1-2 oraciones",
  "headline_final": "headline de urgencia final de 1 línea"
}`,
  });

  let txt = {};
  try {
    txt = JSON.parse(textoRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch (_) {
    txt = {
      headline:       nicho.quick_win || `Tu primer ingreso con ${nicho.nombre_producto}`,
      subtitulo:      nicho.problema_que_resuelve,
      problema:       `Como ${nicho.cliente_ideal}, sabes lo difícil que es avanzar sin el sistema correcto. ${nicho.nombre_producto} cambia eso.`,
      testimonios:    [
        { nombre: 'María G.', ciudad: 'Miami, FL',      texto: 'Lo apliqué y vi resultados en la primera semana.', inicial: 'M' },
        { nombre: 'Carlos R.', ciudad: 'Houston, TX',   texto: 'Por fin un sistema claro y directo que funciona.',  inicial: 'C' },
        { nombre: 'Ana L.',    ciudad: 'Los Angeles, CA', texto: 'Recuperé mi inversión en menos de 30 días.',      inicial: 'A' },
      ],
      garantia:       'Si en 30 días no ves resultados, te devolvemos el 100% de tu dinero sin preguntas ni trámites.',
      headline_final: `¿Listo para empezar con ${nicho.nombre_producto}?`,
    };
  }

  // Includes HTML
  const includesHTML = puntos.map(p => `
    <div class="include-item">
      <div class="include-check">✓</div>
      <span>${p}</span>
    </div>`).join('') || `
    <div class="include-item"><div class="include-check">✓</div><span>Acceso completo al sistema paso a paso</span></div>
    <div class="include-item"><div class="include-check">✓</div><span>Guía de implementación rápida</span></div>
    <div class="include-item"><div class="include-check">✓</div><span>Plantillas y recursos listos para usar</span></div>
    <div class="include-item"><div class="include-check">✓</div><span>Soporte directo por email</span></div>`;

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

  const productoKey = nicho.nombre_producto.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const nombreEsc   = nicho.nombre_producto.replace(/'/g, "\\'");

  let html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${nicho.nombre_producto}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--green:#00ff88;--bg:#0a0a0a;--card:#111111;--border:#1f1f1f;--text:#e8e8e8;--muted:#888;--red:#ff4444}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden}
  .topbar{background:#0f0f0f;border-bottom:1px solid var(--border);padding:10px 20px;text-align:center;font-size:13px;color:var(--green);letter-spacing:.5px}
  .topbar span{color:var(--muted);margin:0 8px}
  .hero{max-width:760px;margin:0 auto;padding:80px 24px 60px;text-align:center}
  .badge{display:inline-block;background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.3);color:var(--green);font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:6px 16px;border-radius:100px;margin-bottom:28px}
  h1{font-size:clamp(30px,5vw,52px);font-weight:800;line-height:1.15;letter-spacing:-1.5px;margin-bottom:24px}
  .highlight{background:linear-gradient(90deg,var(--green),#00ccff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .subtitle{font-size:18px;color:var(--muted);max-width:560px;margin:0 auto 40px;line-height:1.7}
  .cta-primary{display:inline-block;background:var(--green);color:#000;font-size:17px;font-weight:800;padding:18px 44px;border-radius:12px;text-decoration:none;letter-spacing:-.3px;transition:transform .15s,box-shadow .15s;box-shadow:0 0 40px rgba(0,255,136,.25)}
  .cta-primary:hover{transform:translateY(-2px);box-shadow:0 0 60px rgba(0,255,136,.4)}
  .cta-sub{margin-top:14px;font-size:13px;color:var(--muted)}
  .cta-sub strong{color:var(--text)}
  .countdown-wrap{margin-top:16px;font-size:14px;color:#ff9900;font-weight:700}
  .countdown-wrap span{font-family:monospace;font-size:16px}
  .proof-bar{border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--card);padding:24px;display:flex;justify-content:center;gap:48px;flex-wrap:wrap}
  .proof-item{text-align:center}
  .proof-item .num{font-size:28px;font-weight:800;color:var(--green);letter-spacing:-1px}
  .proof-item .label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  section{max-width:760px;margin:0 auto;padding:70px 24px}
  .section-tag{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--green);margin-bottom:12px}
  h2{font-size:clamp(24px,4vw,36px);font-weight:800;letter-spacing:-1px;line-height:1.2;margin-bottom:16px}
  .section-sub{font-size:16px;color:var(--muted);margin-bottom:48px;max-width:560px}
  .includes-list{display:grid;gap:12px}
  .include-item{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 20px}
  .include-check{width:24px;height:24px;background:rgba(0,255,136,.15);border:1px solid rgba(0,255,136,.4);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:var(--green);font-weight:700}
  .include-item span{font-size:15px}
  .testimonials{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}
  .testimonial{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px}
  .stars{color:#fbbf24;font-size:14px;margin-bottom:12px}
  .testimonial p{font-size:14px;color:var(--muted);margin-bottom:16px;font-style:italic}
  .testimonial-author{display:flex;align-items:center;gap:10px}
  .avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--green),#00aaff);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#000}
  .author-name{font-size:13px;font-weight:600}
  .author-loc{font-size:12px;color:var(--muted)}
  .price-box{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:48px;text-align:center;position:relative;overflow:hidden;max-width:520px;margin:0 auto}
  .price-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--green),#00ccff)}
  .price-original{font-size:16px;color:var(--muted);text-decoration:line-through;margin-bottom:8px}
  .price-current{font-size:72px;font-weight:900;letter-spacing:-4px;color:var(--green);line-height:1}
  .price-period{font-size:16px;color:var(--muted);margin-bottom:32px}
  .price-tag{display:inline-block;background:rgba(255,68,68,.15);border:1px solid rgba(255,68,68,.3);color:var(--red);font-size:13px;font-weight:700;padding:6px 16px;border-radius:100px;margin-bottom:24px}
  .guarantee{margin-top:24px;padding-top:24px;border-top:1px solid var(--border);font-size:13px;color:var(--muted)}
  .guarantee strong{color:var(--text)}
  .divider{height:1px;background:var(--border);max-width:760px;margin:0 auto}
  .footer-cta{background:var(--card);border-top:1px solid var(--border);padding:80px 24px;text-align:center}
  .footer-cta p{color:var(--muted);margin-bottom:40px;font-size:16px}
  @media(max-width:600px){.proof-bar{gap:24px}.price-box{padding:32px 24px}.price-current{font-size:56px}}
</style>
</head>
<body>

<div class="topbar">
  🔥 Oferta de lanzamiento — Solo por tiempo limitado
  <span>•</span> Pago único, acceso de por vida
  <span>•</span> Garantía 30 días
</div>

<div class="hero">
  <div class="badge">Nexus Labs — Método Validado</div>
  <h1><span class="highlight">${txt.headline}</span></h1>
  <p class="subtitle">${txt.subtitulo}</p>
  <a href="${stripeLink}" class="cta-primary nexus-cta-btn">Quiero acceso ahora →</a>
  <p class="cta-sub"><strong>Acceso inmediato</strong> · Pago seguro · Sin suscripciones</p>
  <p class="countdown-wrap">⏰ Precio de lanzamiento — <span id="nexus-countdown">48:00:00</span></p>
</div>

<div class="proof-bar">
  <div class="proof-item"><div class="num">+840</div><div class="label">Estudiantes activos</div></div>
  <div class="proof-item"><div class="num">4.9★</div><div class="label">Calificación promedio</div></div>
  <div class="proof-item"><div class="num">30 días</div><div class="label">Garantía de resultados</div></div>
  <div class="proof-item"><div class="num">$0</div><div class="label">Inventario requerido</div></div>
</div>

<section>
  <div class="section-tag">El problema</div>
  <h2>¿Te suena familiar?</h2>
  <p class="section-sub">${txt.problema}</p>
</section>

<div class="divider"></div>

<section>
  <div class="section-tag">Qué obtienes</div>
  <h2>Todo lo que incluye ${nicho.nombre_producto}</h2>
  <p class="section-sub">Acceso inmediato a todo el sistema desde el momento de tu compra.</p>
  <div class="includes-list">${includesHTML}</div>
</section>

<div class="divider"></div>

<section>
  <div class="section-tag">Resultados reales</div>
  <h2>Lo que dicen quienes ya lo aplicaron</h2>
  <div class="testimonials">${testimoniosHTML}</div>
</section>

<div class="divider"></div>

<section id="precio">
  <div class="section-tag">Inversión</div>
  <h2 style="text-align:center;margin-bottom:40px">Accede hoy al precio de lanzamiento</h2>
  <div class="price-box">
    <div class="price-tag">🔥 Oferta — <span id="nexus-countdown-2">48:00:00</span></div>
    <div class="price-original">Precio regular: $${precioOriginal}</div>
    <div class="price-current">$${nicho.precio}</div>
    <div class="price-period">pago único · acceso de por vida</div>
    <a href="${stripeLink}" class="cta-primary nexus-cta-btn" style="display:block;text-align:center">Acceder ahora por $${nicho.precio} →</a>
    <div class="guarantee">🛡 <strong>Garantía 30 días sin preguntas.</strong><br>${txt.garantia}</div>
  </div>
</section>

<div class="footer-cta">
  <h2>${txt.headline_final}</h2>
  <p>⏰ Precio de $${nicho.precio} termina en: <span id="nexus-countdown-3" style="font-family:monospace;color:var(--green)">48:00:00</span></p>
  <a href="${stripeLink}" class="cta-primary nexus-cta-btn">Empezar ahora por $${nicho.precio} →</a>
  <p style="margin-top:16px;font-size:13px">Pago seguro · Garantía 30 días · Acceso inmediato</p>
</div>

<footer style="text-align:center;padding:32px 24px;border-top:1px solid var(--border);color:var(--muted);font-size:12px;line-height:2">
  <div style="max-width:760px;margin:0 auto">
    <a href="/privacidad" style="color:var(--muted);text-decoration:underline;margin:0 12px">Política de Privacidad</a>
    <a href="/terminos"   style="color:var(--muted);text-decoration:underline;margin:0 12px">Términos y Condiciones</a><br>
    ${ENV.EMAIL_FROM_NAME || 'Nexus Labs'} · ${ENV.EMAIL_FROM || 'hola@gananciasconai.com'}<br>
    © ${new Date().getFullYear()} · Todos los derechos reservados
  </div>
</footer>

</body>
</html>`;

  // Inyectar Meta Pixel si está configurado
  if (ENV.META_PIXEL_ID) {
    const pixel = `<!-- Meta Pixel --><script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ENV.META_PIXEL_ID}');fbq('track','PageView');fbq('track','ViewContent',{content_name:'${nicho.nombre_producto.replace(/'/g,"\\'")}',value:${nicho.precio},currency:'USD'});</script><noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${ENV.META_PIXEL_ID}&ev=PageView&noscript=1"/></noscript><!-- End Meta Pixel -->`;
    html = html.replace('</head>', pixel + '\n</head>');
  }

  // Inyectar countdown 48h + evento InitiateCheckout
  const script = `<script>(function(){var key='nexus_offer_${productoKey}';var end=parseInt(localStorage.getItem(key)||'0');if(!end||end<Date.now()){end=Date.now()+48*3600000;localStorage.setItem(key,end);}function pad(n){return n<10?'0'+n:String(n);}function tick(){var diff=Math.max(0,end-Date.now());var h=Math.floor(diff/3600000);var m=Math.floor((diff%3600000)/60000);var s=Math.floor((diff%60000)/1000);var txt=pad(h)+':'+pad(m)+':'+pad(s);['nexus-countdown','nexus-countdown-2','nexus-countdown-3'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=txt;});if(diff>0)setTimeout(tick,1000);}tick();document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.nexus-cta-btn').forEach(function(btn){btn.addEventListener('click',function(){if(typeof fbq!=='undefined'){fbq('track','InitiateCheckout',{value:${nicho.precio},currency:'USD',content_name:'${nicho.nombre_producto.replace(/'/g, "\\'")}'});}});});});}());</script>`;

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
