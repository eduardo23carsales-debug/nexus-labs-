// ════════════════════════════════════════════════════
// CONNECTOR — Resend
// Entrega productos por email + secuencias automáticas
// ════════════════════════════════════════════════════

import { query } from '../config/database.js';
import ENV from '../config/env.js';

function getResend() {
  if (!ENV.RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurado');
  return import('resend').then(m => new m.Resend(ENV.RESEND_API_KEY));
}

const FROM      = () => ENV.EMAIL_FROM      || 'onboarding@resend.dev';
const FROM_NAME = () => ENV.EMAIL_FROM_NAME || 'Nexus Labs';

export const ResendConnector = {

  disponible() {
    return !!ENV.RESEND_API_KEY;
  },

  async ping() {
    if (!ENV.RESEND_API_KEY) throw new Error('RESEND_API_KEY no configurada');
    return true;
  },

  // ── Entrega el producto digital al comprador ───────
  async entregarProducto({ para, nombreCliente, nombreProducto, contenido, productoUrl, stripePaymentId }) {
    const resend = await getResend();
    const html = _htmlEntrega({ nombreCliente, nombreProducto, contenido, productoUrl, stripePaymentId });

    const { data, error } = await resend.emails.send({
      from:    `${FROM_NAME()} <${FROM()}>`,
      to:      para,
      subject: `✅ Tu acceso a "${nombreProducto}" — Aquí está todo`,
      html,
    });

    if (error) throw new Error(`Resend error: ${error.message}`);
    console.log(`[Resend] Producto entregado a ${para}`);
    return data;
  },

  // ── Procesa pagos nuevos en Stripe y entrega productos ──
  async procesarPagosNuevos() {
    const { StripeConnector } = await import('./stripe.connector.js');
    if (!StripeConnector.disponible()) return 0;

    const desde = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
    const sesiones = await StripeConnector.getSesionesPagadas(desde);
    console.log(`[Resend] ${sesiones.length} pagos recientes encontrados`);

    let entregados = 0;
    for (const sesion of sesiones) {
      const emailCliente = sesion.customer_details?.email;
      if (!emailCliente) continue;

      const { rows: yaEntregado } = await query(
        'SELECT id FROM customers WHERE email = $1 LIMIT 1', [emailCliente]
      );
      if (yaEntregado.length) continue;

      const { rows: exps } = await query(
        `SELECT * FROM experiments WHERE stripe_payment_link IS NOT NULL ORDER BY creado_en DESC LIMIT 20`
      );
      if (!exps.length) continue;

      const exp = exps.find(e =>
        sesion.payment_link && e.stripe_payment_link?.includes(sesion.payment_link)
      ) || exps[0];

      try {
        const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';
        const productoUrl = exp.landing_slug ? `${dominio}/acceso/${exp.landing_slug}` : null;

        await this.entregarProducto({
          para:            emailCliente,
          nombreCliente:   sesion.customer_details?.name,
          nombreProducto:  exp.nombre,
          contenido:       exp.contenido_producto || '',
          productoUrl,
          stripePaymentId: sesion.payment_intent,
        });

        await query(
          `INSERT INTO customers (email, nombre, experiment_id, producto, revenue, stripe_customer_id, stripe_payment_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING`,
          [
            emailCliente,
            sesion.customer_details?.name || null,
            exp.id,
            exp.nombre,
            (sesion.amount_total || 0) / 100,
            sesion.customer || null,
            sesion.payment_intent || null,
          ]
        );

        await query(
          `UPDATE experiments SET metricas = jsonb_set(
            COALESCE(metricas,'{}'),
            '{ventas}',
            (COALESCE((metricas->>'ventas')::int, 0) + 1)::text::jsonb
          ), actualizado_en = NOW() WHERE id = $1`,
          [exp.id]
        );

        entregados++;
      } catch (err) {
        console.error(`[Resend] Error entregando a ${emailCliente}:`, err.message);
      }
    }

    if (entregados > 0) console.log(`[Resend] ${entregados} productos entregados`);
    return entregados;
  },

  // ── Carritos abandonados: 2 emails (2h y 24h) ───────
  async procesarCarritosAbandonados() {
    const { StripeConnector } = await import('./stripe.connector.js');
    if (!StripeConnector.disponible()) return 0;

    const ahora   = Math.floor(Date.now() / 1000);
    const hace26h = ahora - 26 * 60 * 60;
    const abandonadas = await StripeConnector.getSesionesAbandonadas(hace26h);

    const { rows: exps } = await query(
      `SELECT id, nombre, precio, stripe_payment_link FROM experiments WHERE stripe_payment_link IS NOT NULL ORDER BY creado_en DESC LIMIT 20`
    );

    let enviados = 0;
    for (const sesion of abandonadas) {
      const emailCliente  = sesion.customer_details.email;
      const nombreCliente = sesion.customer_details.name?.split(' ')[0] || '';
      const edadHoras     = (ahora - sesion.created) / 3600;

      const { rows: comprador } = await query('SELECT id FROM customers WHERE email = $1', [emailCliente]);
      if (comprador.length) continue;

      const exp = exps.find(e =>
        sesion.payment_link && e.stripe_payment_link?.includes(sesion.payment_link)
      ) || exps[0];
      if (!exp) continue;

      try {
        if (edadHoras >= 2 && edadHoras < 24) {
          const { rows: ya } = await query(
            `SELECT id FROM email_sequences WHERE email = $1 AND fuente = 'abandono_1'`, [emailCliente]
          );
          if (ya.length) continue;
          await this._enviarAbandono1({ para: emailCliente, nombre: nombreCliente, producto: exp.nombre, precio: exp.precio, linkPago: exp.stripe_payment_link });
          await query(`INSERT INTO email_sequences (email, experiment_id, fuente) VALUES ($1,$2,'abandono_1') ON CONFLICT DO NOTHING`, [emailCliente, exp.id]);
          enviados++;
        } else if (edadHoras >= 24) {
          const { rows: ya } = await query(
            `SELECT id FROM email_sequences WHERE email = $1 AND fuente = 'abandono_2'`, [emailCliente]
          );
          if (ya.length) continue;
          await this._enviarAbandono2({ para: emailCliente, nombre: nombreCliente, producto: exp.nombre, precio: exp.precio, linkPago: exp.stripe_payment_link });
          await query(`INSERT INTO email_sequences (email, experiment_id, fuente) VALUES ($1,$2,'abandono_2') ON CONFLICT DO NOTHING`, [emailCliente, exp.id]);
          enviados++;
        }
      } catch (err) {
        console.warn(`[Resend] Abandono error ${emailCliente}:`, err.message);
      }
    }
    if (enviados > 0) console.log(`[Resend] ${enviados} emails de carrito abandonado enviados`);
    return enviados;
  },

  // ── Secuencia post-compra: días 1, 3, 7, 14 ────────
  async procesarSecuenciaPostCompra() {
    const { rows: customers } = await query(
      `SELECT c.email, c.nombre, c.producto, c.experiment_id, c.creado_en,
              e.landing_slug, e.precio, e.stripe_payment_link
       FROM customers c LEFT JOIN experiments e ON e.id = c.experiment_id
       ORDER BY c.creado_en DESC LIMIT 500`
    );
    if (!customers.length) return 0;

    const PASOS = [
      { fuente: 'seq_d1',  minDias: 1,  maxDias: 3  },
      { fuente: 'seq_d3',  minDias: 3,  maxDias: 7  },
      { fuente: 'seq_d7',  minDias: 7,  maxDias: 14 },
      { fuente: 'seq_d14', minDias: 14, maxDias: 31 },
    ];

    let enviados = 0;
    const dominio = ENV.RAILWAY_DOMAIN ? `https://${ENV.RAILWAY_DOMAIN}` : '';

    for (const c of customers) {
      const diasDesdeCompra = (Date.now() - new Date(c.creado_en)) / 86400000;
      const productoUrl = c.landing_slug ? `${dominio}/p/${c.landing_slug}` : null;

      for (const paso of PASOS) {
        if (diasDesdeCompra < paso.minDias || diasDesdeCompra >= paso.maxDias) continue;
        const { rows: ya } = await query(
          `SELECT id FROM email_sequences WHERE email = $1 AND fuente = $2`, [c.email, paso.fuente]
        );
        if (ya.length) break;
        try {
          await this[`_seq_${paso.fuente}`]({ para: c.email, nombre: c.nombre?.split(' ')[0] || '', producto: c.producto, productoUrl, stripeLink: c.stripe_payment_link });
          await query(`INSERT INTO email_sequences (email, experiment_id, fuente) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [c.email, c.experiment_id, paso.fuente]);
          enviados++;
        } catch (err) {
          console.warn(`[Resend] Secuencia ${paso.fuente} falló ${c.email}:`, err.message);
        }
        break;
      }
    }
    if (enviados > 0) console.log(`[Resend] ${enviados} emails post-compra enviados`);
    return enviados;
  },

  // ── Emails internos ────────────────────────────────
  async _enviarAbandono1({ para, nombre, producto, precio, linkPago }) {
    const resend = await getResend();
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const { error } = await resend.emails.send({
      from:    `${FROM_NAME()} <${FROM()}>`,
      to:      para,
      subject: `¿Tuviste algún problema con tu compra de "${producto}"?`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px 32px;text-align:center;border-bottom:3px solid #f0a500;">
    <h1 style="color:#fff;margin:0;font-size:1.5em;">¿Tuviste algún problema?</h1>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.1em;color:#e0e0e0;margin:0 0 16px;">${saludo},</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 24px;">Notamos que empezaste a adquirir <strong style="color:#fff;">${producto}</strong> pero no completaste tu compra. Si hubo algún problema técnico o tienes dudas, responde este email y te ayudamos de inmediato.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;">
      <tr><td align="center" style="border-radius:8px;background:#f0a500;">
        <a href="${linkPago}" target="_blank" style="background:#f0a500;color:#000;padding:18px 40px;font-size:1.1em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;mso-padding-alt:0;">Completar mi compra — $${precio}</a>
      </td></tr>
    </table>
  </div>
  <div style="background:#111;padding:20px 32px;text-align:center;border-top:1px solid #222;">
    <p style="color:#444;font-size:0.8em;margin:0;">${FROM_NAME()} · Responde si necesitas ayuda</p>
  </div>
</div></body></html>`,
    });
    if (error) throw new Error(error.message);
  },

  async _enviarAbandono2({ para, nombre, producto, precio, linkPago }) {
    const resend = await getResend();
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const { error } = await resend.emails.send({
      from:    `${FROM_NAME()} <${FROM()}>`,
      to:      para,
      subject: `⏰ Última oportunidad — "${producto}" por $${precio}`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#2e1a1a,#3e1616);padding:40px 32px;text-align:center;border-bottom:3px solid #ff4444;">
    <p style="color:#ff4444;font-size:0.85em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">ÚLTIMA OPORTUNIDAD</p>
    <h1 style="color:#fff;margin:0;font-size:1.5em;">⏰ Tu acceso a "${producto}" sigue disponible</h1>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.1em;color:#e0e0e0;margin:0 0 16px;">${saludo},</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 32px;">Ayer casi adquiriste <strong style="color:#fff;">${producto}</strong>. No sabemos cuánto tiempo más estará disponible a este precio.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;">
      <tr><td align="center" style="border-radius:8px;background:#ff4444;">
        <a href="${linkPago}" target="_blank" style="background:#ff4444;color:#fff;padding:18px 40px;font-size:1.15em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;mso-padding-alt:0;">Quiero mi acceso ahora — $${precio}</a>
      </td></tr>
    </table>
    <div style="background:#1a0d0d;border:1px solid #ff4444;border-radius:8px;padding:16px;text-align:center;">
      <p style="margin:0;color:#ff8888;font-size:0.9em;">⚠️ Este es el último recordatorio que te enviaremos.</p>
    </div>
  </div>
</div></body></html>`,
    });
    if (error) throw new Error(error.message);
  },

  async _seq_seq_d1({ para, nombre, producto, productoUrl }) {
    const resend = await getResend();
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const boton  = productoUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;"><tr><td align="center" style="border-radius:8px;background:#00ff88;"><a href="${productoUrl}" target="_blank" style="background:#00ff88;color:#000;padding:16px 36px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;mso-padding-alt:0;">📖 Abrir mi producto</a></td></tr></table>` : '';
    const { error } = await resend.emails.send({
      from: `${FROM_NAME()} <${FROM()}>`, to: para,
      subject: `🚀 Empieza aquí — tu primer resultado con "${producto}"`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;"><div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;"><div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:36px 32px;text-align:center;border-bottom:3px solid #00ff88;"><p style="color:#00ff88;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 1</p><h1 style="color:#fff;margin:0;font-size:1.5em;">🚀 Empieza aquí — tu primer resultado hoy</h1></div><div style="padding:40px 32px;"><p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p><p style="color:#aaa;line-height:1.8;margin:0 0 20px;">Ya tienes acceso a <strong style="color:#fff;">${producto}</strong>. Haz esto HOY:</p><div style="background:#0d1f0d;border-left:4px solid #00ff88;border-radius:4px;padding:16px;margin-bottom:12px;"><p style="margin:0;color:#00ff88;font-weight:bold;">Paso 1 — Abre el producto</p><p style="margin:8px 0 0;color:#aaa;font-size:0.9em;">Dedica 10 minutos a leer la introducción completa.</p></div><div style="background:#1f1a0d;border-left:4px solid #f0a500;border-radius:4px;padding:16px;"><p style="margin:0;color:#f0a500;font-weight:bold;">Paso 2 — Ejecuta UNA sola cosa</p><p style="margin:8px 0 0;color:#aaa;font-size:0.9em;">No trates de aplicar todo a la vez. Una acción concreta hoy.</p></div>${boton}</div></div></body></html>`,
    });
    if (error) throw new Error(error.message);
  },

  async _seq_seq_d3({ para, nombre, producto, productoUrl }) {
    const resend = await getResend();
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const boton  = productoUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;"><tr><td align="center" style="border-radius:8px;background:#4f8ef7;"><a href="${productoUrl}" target="_blank" style="background:#4f8ef7;color:#fff;padding:16px 36px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;mso-padding-alt:0;">▶ Continuar donde lo dejé</a></td></tr></table>` : '';
    const { error } = await resend.emails.send({
      from: `${FROM_NAME()} <${FROM()}>`, to: para,
      subject: `¿Ya aplicaste "${producto}"? Esto te va a ayudar`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;"><div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;"><div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:36px 32px;text-align:center;border-bottom:3px solid #4f8ef7;"><p style="color:#4f8ef7;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 3</p><h1 style="color:#fff;margin:0;font-size:1.5em;">¿Ya tuviste tu primer resultado?</h1></div><div style="padding:40px 32px;"><p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p><p style="color:#aaa;line-height:1.8;margin:0 0 20px;">Ya llevas 3 días con <strong style="color:#fff;">${producto}</strong>. Las personas que ven resultados rápidos ejecutan antes de entenderlo todo.</p><div style="background:#111;border:1px solid #333;border-radius:8px;padding:20px;margin:0 0 24px;"><p style="margin:0 0 12px;color:#fff;font-weight:bold;">⏱ El método de los 15 minutos</p><p style="margin:0;color:#aaa;font-size:0.95em;line-height:1.8;">Pon un timer de 15 minutos. Lee solo hasta donde llegues. Haz UNA cosa de lo que leíste.</p></div>${boton}</div></div></body></html>`,
    });
    if (error) throw new Error(error.message);
  },

  async _seq_seq_d7({ para, nombre, producto, productoUrl }) {
    const resend = await getResend();
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const boton  = productoUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;"><tr><td align="center" style="border-radius:8px;background:#00ff88;"><a href="${productoUrl}" target="_blank" style="background:#00ff88;color:#000;padding:16px 36px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;mso-padding-alt:0;">📖 Seguir aprendiendo</a></td></tr></table>` : '';
    const { error } = await resend.emails.send({
      from: `${FROM_NAME()} <${FROM()}>`, to: para,
      subject: `🏆 Una semana con "${producto}" — ¿cuál fue tu resultado?`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;"><div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;"><div style="background:linear-gradient(135deg,#1a2e1a,#163e16);padding:36px 32px;text-align:center;border-bottom:3px solid #00ff88;"><p style="color:#00ff88;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 7</p><h1 style="color:#fff;margin:0;font-size:1.5em;">🏆 Una semana — mira lo que otros lograron</h1></div><div style="padding:40px 32px;"><p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p><p style="color:#aaa;line-height:1.8;margin:0 0 24px;">Ya llevas una semana con <strong style="color:#fff;">${producto}</strong>. ¿Cuál es tu resultado? Responde este email y cuéntanos.</p><div style="background:#0d1f0d;border-radius:8px;padding:20px;margin-bottom:12px;border-left:4px solid #00ff88;"><p style="margin:0 0 4px;color:#00ff88;font-weight:bold;">💬 "Lo apliqué el primer día y ahorré 2 horas de trabajo"</p><p style="margin:0;color:#666;font-size:0.85em;">— Cliente de Miami</p></div>${boton}</div></div></body></html>`,
    });
    if (error) throw new Error(error.message);
  },

  async _seq_seq_d14({ para, nombre, producto, productoUrl }) {
    const resend = await getResend();
    const saludo = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const { error } = await resend.emails.send({
      from: `${FROM_NAME()} <${FROM()}>`, to: para,
      subject: `🎁 Tu regalo de 2 semanas — solo para ti, ${nombre || 'amigo'}`,
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;"><div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;"><div style="background:linear-gradient(135deg,#2e1a2e,#3e163e);padding:36px 32px;text-align:center;border-bottom:3px solid #f0a500;"><p style="color:#f0a500;font-size:0.8em;font-weight:bold;margin:0 0 8px;letter-spacing:2px;">DÍA 14 — EXCLUSIVO</p><h1 style="color:#fff;margin:0;font-size:1.5em;">🎁 Un regalo por ser parte de nuestra comunidad</h1></div><div style="padding:40px 32px;"><p style="font-size:1.05em;color:#e0e0e0;margin:0 0 20px;">${saludo},</p><p style="color:#aaa;line-height:1.8;margin:0 0 24px;">Ya llevas 2 semanas con <strong style="color:#fff;">${producto}</strong>. Escríbenos respondiendo este email y te decimos cuál es el siguiente recurso que te conviene según tu situación.</p><div style="background:#1f150d;border:2px solid #f0a500;border-radius:8px;padding:24px;text-align:center;"><a href="mailto:${FROM()}" style="background:#f0a500;color:#000;padding:14px 32px;font-size:1em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;">Quiero saber mi siguiente paso</a></div></div></div></body></html>`,
    });
    if (error) throw new Error(error.message);
  },

  // ── Email manual redactado por Jarvis ───────────────
  async enviarEmailManual({ para, nombre, asunto, cuerpo, urlBoton = null, textoBoton = '🛒 Quiero acceso ahora' }) {
    if (!this.disponible()) throw new Error('RESEND_API_KEY no configurado');
    const resend      = await getResend();
    const saludo      = nombre ? `Hola <strong style="color:#00ff88;">${nombre}</strong>` : 'Hola';
    const firmaNombre = FROM_NAME();
    const firmaEmail  = FROM();

    // Extraer URLs del cuerpo y convertirlas en botón si no hay urlBoton explícita
    let urlDetectada = urlBoton;
    let cuerpoLimpio = cuerpo;
    if (!urlDetectada) {
      // Detectar markdown [texto](url) y extraer la URL
      const mdMatch = cuerpo.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (mdMatch) {
        urlDetectada = mdMatch[2];
        textoBoton   = `🛒 ${mdMatch[1]}`;
        cuerpoLimpio = cuerpo.replace(mdMatch[0], '');
      } else {
        // Detectar URL suelta
        const urlMatch = cuerpo.match(/https?:\/\/[^\s<>"]+/);
        if (urlMatch) {
          urlDetectada = urlMatch[0];
          cuerpoLimpio = cuerpo.replace(urlMatch[0], '').trim();
        }
      }
    }

    const parrafos = cuerpoLimpio
      .split('\n')
      .filter(l => l.trim())
      .map(l => `<p style="color:#ccc;line-height:1.8;margin:0 0 16px;">${l}</p>`)
      .join('');

    const botonHtml = urlDetectada
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;">
          <tr><td align="center" style="border-radius:8px;background:#00ff88;">
            <a href="${urlDetectada}" target="_blank" style="background:#00ff88;color:#000;padding:16px 36px;font-size:1.05em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;mso-padding-alt:0;">${textoBoton}</a>
          </td></tr>
        </table>`
      : '';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:36px 32px;text-align:center;border-bottom:3px solid #00ff88;">
    <h1 style="color:#fff;margin:0;font-size:1.4em;">${asunto}</h1>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.05em;color:#e0e0e0;margin:0 0 24px;">${saludo},</p>
    ${parrafos}
    ${botonHtml}
  </div>
  <div style="background:#111;padding:20px 32px;text-align:center;border-top:1px solid #222;">
    <p style="color:#444;font-size:0.8em;margin:0;">${firmaNombre} · <a href="mailto:${firmaEmail}" style="color:#555;">${firmaEmail}</a></p>
  </div>
</div>
</body></html>`;

    const { error } = await resend.emails.send({
      from:    `${firmaNombre} <${firmaEmail}>`,
      to:      para,
      subject: asunto,
      html,
    });

    if (error) throw new Error(error.message);
    return { ok: true, para, asunto };
  },
};

// ── HTML de entrega de producto ────────────────────
function _htmlEntrega({ nombreCliente, nombreProducto, contenido, productoUrl, stripePaymentId }) {
  const saludo = nombreCliente ? `Hola <strong style="color:#00ff88;">${nombreCliente}</strong>` : 'Hola';
  const cuerpo = productoUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;">
        <tr><td align="center" style="border-radius:8px;background:#00ff88;">
          <a href="${productoUrl}" target="_blank" style="background:#00ff88;color:#000;padding:18px 40px;font-size:1.15em;font-weight:bold;text-decoration:none;border-radius:8px;display:inline-block;mso-padding-alt:0;">🚀 Abrir mi producto ahora</a>
        </td></tr>
      </table>
      <p style="text-align:center;color:#666;font-size:0.85em;margin:8px 0 0;">Guarda este link — es tu acceso permanente</p>
      <div style="background:#0d1f0d;border:1px solid #00ff88;border-radius:8px;padding:20px;margin:24px 0;">
        <p style="margin:0;color:#00ff88;font-size:0.95em;">📌 <strong>Tu link:</strong><br><a href="${productoUrl}" style="color:#00ff88;">${productoUrl}</a></p>
      </div>`
    : `<div style="background:#111;border-left:4px solid #00ff88;padding:24px;border-radius:8px;margin:24px 0;">
        <p style="color:#00ff88;font-weight:bold;margin:0 0 16px;">📦 Tu producto:</p>
        <div style="color:#ccc;line-height:1.8;font-size:0.95em;">${contenido.slice(0, 5000)}</div>
      </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;">
<div style="max-width:600px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #222;">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:40px 32px;text-align:center;border-bottom:3px solid #00ff88;">
    <h1 style="color:#fff;margin:0 0 8px;font-size:1.6em;">✅ ¡Tu compra fue exitosa!</h1>
    <p style="color:#aaa;margin:0;">Tu producto está listo para usar</p>
  </div>
  <div style="padding:40px 32px;">
    <p style="font-size:1.1em;color:#e0e0e0;margin:0 0 16px;">${saludo},</p>
    <p style="color:#aaa;line-height:1.8;margin:0 0 32px;">Gracias por tu compra de <strong style="color:#fff;">${nombreProducto}</strong>.</p>
    ${cuerpo}
    <div style="background:#111;border:1px solid #333;border-radius:8px;padding:20px;margin:24px 0;">
      <p style="margin:0;color:#888;font-size:0.9em;">💬 <strong style="color:#ccc;">¿Necesitas ayuda?</strong> Responde este email.<br>🔒 Pago seguro procesado por Stripe.${stripePaymentId ? ` Referencia: ${stripePaymentId.slice(-8)}` : ''}</p>
    </div>
  </div>
</div></body></html>`;
}

export default ResendConnector;
