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
  const beneficios = (nicho.puntos_de_venta || nicho.modulos_temas || [])
    .slice(0, 6)
    .map(p => `<li style="padding:8px 0;color:#ccc;">✅ ${p}</li>`)
    .join('\n');

  const prompt = `Crea una landing page de ventas en HTML completo. USA ESTILOS INLINE (style="") para TODO, NO uses bloques <style> ni CSS externo.

Producto: ${nicho.nombre_producto}
Subtítulo: ${nicho.subtitulo || nicho.problema_que_resuelve}
Precio: $${nicho.precio}
Problema que resuelve: ${nicho.problema_que_resuelve}
Cliente ideal: ${nicho.cliente_ideal}
Quick win (resultado rápido): ${nicho.quick_win || 'Resultados desde el primer día'}
Link de pago Stripe: ${stripeLink}

Estructura HTML EXACTA:

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${nicho.nombre_producto}</title>
</head>
<body style="margin:0;font-family:Arial,sans-serif;background:#0f0f0f;color:#fff;">

<!-- HERO -->
<div style="background:#111;padding:60px 20px;text-align:center;">
  <h1 style="font-size:2.2em;color:#00ff88;margin-bottom:16px;">[HEADLINE IMPACTANTE basado en el quick win]</h1>
  <p style="font-size:1.15em;color:#ccc;max-width:600px;margin:0 auto 32px;">[SUBTITULO basado en el problema que resuelve]</p>
  <a href="${stripeLink}" class="nexus-cta-btn" style="background:#00ff88;color:#000;padding:18px 48px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">⚡ SÍ, QUIERO ACCESO — $${nicho.precio}</a>
  <p style="color:#ff9900;margin-top:16px;font-size:0.95em;font-weight:bold;">⏰ Precio de lanzamiento — <span id="nexus-countdown" style="font-family:monospace;">48:00:00</span></p>
</div>

<!-- PROBLEMA -->
<div style="max-width:700px;margin:60px auto;padding:0 20px;">
  <h2 style="color:#00ff88;font-size:1.8em;">¿Te suena familiar?</h2>
  <p style="color:#ccc;font-size:1.1em;line-height:1.8;">[DESCRIPCION DEL PROBLEMA en 3-4 oraciones específicas del cliente ideal]</p>
</div>

<!-- BENEFICIOS -->
<div style="background:#111;padding:60px 20px;text-align:center;">
  <h2 style="color:#fff;font-size:1.8em;margin-bottom:40px;">¿Qué incluye?</h2>
  <ul style="list-style:none;max-width:600px;margin:0 auto;text-align:left;padding:0;">
    ${beneficios}
  </ul>
</div>

<!-- PRECIO -->
<div style="max-width:500px;margin:60px auto;padding:0 20px;text-align:center;">
  <div style="background:#1a1a1a;border:2px solid #00ff88;border-radius:16px;padding:40px;">
    <p style="color:#ff9900;font-size:0.9em;font-weight:bold;margin-bottom:4px;">⚠️ PRECIO DE LANZAMIENTO</p>
    <p style="color:#ff9900;font-size:1.8em;font-weight:bold;font-family:monospace;margin:0 0 12px;" id="nexus-countdown-2">48:00:00</p>
    <p style="color:#00ff88;font-size:3em;font-weight:bold;margin:0;">$${nicho.precio}</p>
    <p style="color:#888;font-size:0.9em;margin:8px 0 24px;">Pago único — Acceso inmediato</p>
    <a href="${stripeLink}" class="nexus-cta-btn" style="display:block;background:#00ff88;color:#000;padding:18px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;">🔓 QUIERO ACCESO AHORA</a>
    <p style="color:#888;font-size:0.8em;margin-top:12px;">🔒 Pago 100% seguro con Stripe · Garantía 30 días</p>
  </div>
</div>

<!-- TESTIMONIOS -->
<div style="background:#111;padding:60px 20px;">
  <h2 style="text-align:center;color:#fff;margin-bottom:40px;">Lo que dicen nuestros clientes</h2>
  <div style="max-width:700px;margin:0 auto;">
    [3 TESTIMONIOS REALISTAS con nombre hispano, ciudad de USA y resultado numérico específico]
  </div>
</div>

<!-- GARANTIA -->
<div style="max-width:600px;margin:60px auto;padding:20px;text-align:center;">
  <h2 style="color:#00ff88;">Garantía 30 días sin preguntas</h2>
  <p style="color:#ccc;">[TEXTO DE GARANTIA empático y específico]</p>
</div>

<!-- CTA FINAL -->
<div style="background:#00ff88;padding:60px 20px;text-align:center;">
  <h2 style="color:#000;font-size:2em;margin-bottom:8px;">[HEADLINE DE URGENCIA FINAL]</h2>
  <p style="color:#004400;margin-bottom:24px;font-weight:bold;">⏰ Precio de $${nicho.precio} termina en: <span id="nexus-countdown-3" style="font-family:monospace;">48:00:00</span></p>
  <a href="${stripeLink}" class="nexus-cta-btn" style="background:#000;color:#00ff88;padding:18px 40px;font-size:1.2em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">⚡ ACCESO INMEDIATO — $${nicho.precio}</a>
</div>

<!-- FOOTER -->
<div style="background:#0a0a0a;padding:20px;text-align:center;">
  <p style="color:#555;font-size:0.8em;">© 2026 ${nicho.nombre_producto} — Todos los derechos reservados</p>
</div>

</body>
</html>

Llena TODOS los [PLACEHOLDERS] con contenido real. Devuelve SOLO el HTML final.`;

  let html = await AnthropicConnector.completar({
    system:    'Eres experto en landing pages de alta conversión para el mercado hispano de USA.',
    prompt,
    maxTokens: 6000,
  });

  html = html.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

  // Inyectar Meta Pixel si está configurado
  if (ENV.META_PIXEL_ID) {
    const pixel = `<!-- Meta Pixel --><script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${ENV.META_PIXEL_ID}');fbq('track','PageView');fbq('track','ViewContent',{content_name:'${nicho.nombre_producto.replace(/'/g,"\\'")}',value:${nicho.precio},currency:'USD'});</script><noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${ENV.META_PIXEL_ID}&ev=PageView&noscript=1"/></noscript><!-- End Meta Pixel -->`;
    html = html.replace('</head>', pixel + '\n</head>');
  }

  // Inyectar countdown 48h + evento InitiateCheckout
  const productoKey = nicho.nombre_producto.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
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

  await notif('💳 Creando producto en Stripe...');

  const stripeData = await StripeConnector.crearProductoCompleto({
    nombre:      nicho.nombre_producto,
    descripcion: nicho.problema_que_resuelve || nicho.subtitulo || '',
    precio:      nicho.precio,
  });

  await notif('🎨 Generando landing page de ventas...');
  const landingHTML = await generarLandingHTML(nicho, stripeData.stripe_payment_link);

  const slug = generarSlug(nicho.nombre_producto);
  const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
  const landingUrl = `${dominio}/p/${slug}`;

  // Actualizar o crear el experimento en BD con los datos de Stripe y la landing
  if (experimentoId) {
    await query(
      `UPDATE experiments SET
        stripe_product_id   = $1,
        stripe_price_id     = $2,
        stripe_payment_link = $3,
        landing_slug        = $4,
        landing_html        = $5,
        producto_url        = $6,
        actualizado_en      = NOW()
       WHERE id = $7`,
      [
        stripeData.stripe_product_id,
        stripeData.stripe_price_id,
        stripeData.stripe_payment_link,
        slug,
        landingHTML,
        landingUrl,
        experimentoId,
      ]
    );
  } else {
    const { rows } = await query(
      `INSERT INTO experiments (nicho, nombre, tipo, precio, stripe_product_id, stripe_price_id, stripe_payment_link, landing_slug, landing_html, producto_url, contenido_producto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        nicho.nicho,
        nicho.nombre_producto,
        nicho.tipo || 'guia_pdf',
        nicho.precio,
        stripeData.stripe_product_id,
        stripeData.stripe_price_id,
        stripeData.stripe_payment_link,
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
