// ════════════════════════════════════════════════════
// ROUTES — Landing pages (ventas + acceso a producto)
// El webhook de Stripe está en server/routes/webhooks.js
// ════════════════════════════════════════════════════

import { Router } from 'express';
import { query }  from '../../config/database.js';
import ENV        from '../../config/env.js';

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

// ── Servir landing page de ventas por slug ────────
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

// ── Servir producto digital al comprador ──────────
// Esta es la URL que va en el email post-compra
router.get('/acceso/:slug', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT contenido_producto, nombre FROM experiments WHERE landing_slug = $1 LIMIT 1',
      [req.params.slug]
    );
    if (!rows.length || !rows[0].contenido_producto) {
      return res.status(404).send('Producto no encontrado.');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(rows[0].contenido_producto);
  } catch (err) {
    console.error('[Landings] Error sirviendo producto:', err.message);
    res.status(500).send('Error interno.');
  }
});

export default router;
