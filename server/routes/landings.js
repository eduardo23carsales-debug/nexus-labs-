// ════════════════════════════════════════════════════
// ROUTES — Landing pages y webhook de Stripe
// ════════════════════════════════════════════════════

import { Router }            from 'express';
import { query }             from '../../config/database.js';
import { StripeConnector }   from '../../connectors/stripe.connector.js';
import { ResendConnector }   from '../../connectors/resend.connector.js';
import { TelegramConnector } from '../../connectors/telegram.connector.js';
import ENV                   from '../../config/env.js';
import axios                 from 'axios';

const router = Router();

// ── Página de gracias post-pago ───────────────────
router.get('/gracias', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Compra exitosa!</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0f0f0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="background:#1a1a1a;border:1px solid #222;border-top:3px solid #00ff88;border-radius:12px;padding:48px 40px;max-width:560px;width:90%;text-align:center;">
    <div style="font-size:3em;margin-bottom:16px;">✅</div>
    <h1 style="color:#00ff88;font-size:1.8em;margin-bottom:12px;">¡Pago confirmado!</h1>
    <p style="color:#aaa;line-height:1.8;margin-bottom:16px;">Tu compra fue procesada correctamente.</p>
    <p style="color:#aaa;line-height:1.8;">Revisa tu correo electrónico — en los próximos minutos recibirás el link de acceso a tu producto.</p>
    <div style="background:#0d1f0d;border:1px solid #00ff88;border-radius:8px;padding:16px;color:#00ff88;font-size:0.95em;margin-top:24px;">
      📧 Si no ves el email, revisa tu carpeta de spam.
    </div>
  </div>
</body>
</html>`);
});

// ── Servir landing page por slug ──────────────────
router.get('/p/:slug', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT landing_html, nombre FROM experiments WHERE landing_slug = $1 LIMIT 1',
      [req.params.slug]
    );
    if (!rows.length || !rows[0].landing_html) {
      return res.status(404).send('Producto no encontrado.');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(rows[0].landing_html);
  } catch (err) {
    console.error('[Landings] Error sirviendo landing:', err.message);
    res.status(500).send('Error interno.');
  }
});

// ── Stripe webhook — entrega inmediata al pagar ───
router.post('/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = await StripeConnector.construirEvento(req.body, sig);
  } catch (err) {
    console.error('[Stripe Webhook] Firma inválida:', err.message);
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  res.status(200).json({ received: true });

  if (event.type === 'checkout.session.completed') {
    console.log('[Stripe Webhook] Pago confirmado — procesando entrega...');

    ResendConnector.procesarPagosNuevos().catch(err =>
      console.error('[Stripe Webhook] Error en entrega:', err.message)
    );

    // Meta Conversions API — evento Purchase server-side
    const session = event.data.object;
    const amount  = (session.amount_total || 0) / 100;
    if (ENV.META_PIXEL_ID && ENV.META_TOKEN) {
      try {
        const crypto      = await import('crypto');
        const emailRaw    = session.customer_details?.email || '';
        const hashedEmail = emailRaw
          ? crypto.default.createHash('sha256').update(emailRaw.trim().toLowerCase()).digest('hex')
          : null;

        await axios.post(
          `https://graph.facebook.com/v25.0/${ENV.META_PIXEL_ID}/events?access_token=${ENV.META_TOKEN}`,
          {
            data: [{
              event_name:   'Purchase',
              event_time:   Math.floor(Date.now() / 1000),
              action_source: 'website',
              user_data:    { ...(hashedEmail && { em: [hashedEmail] }) },
              custom_data:  { currency: 'USD', value: amount },
            }]
          },
          { timeout: 8000 }
        );
        console.log(`[Stripe Webhook] Meta Purchase enviado — $${amount}`);
      } catch (pixelErr) {
        console.warn('[Stripe Webhook] Meta CAPI falló (no crítico):', pixelErr.message);
      }
    }

    // Notificar a Eduardo
    TelegramConnector.notificar(
      `💰 <b>Nueva venta Stripe</b>\n` +
      `💵 $${amount}\n` +
      `📧 ${session.customer_details?.email || 'sin email'}\n` +
      `👤 ${session.customer_details?.name || 'desconocido'}`
    ).catch(() => {});
  }
});

export default router;
