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

// ── Política de Privacidad ────────────────────────────
router.get('/privacidad', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidad — Nexus Labs</title>
  <style>body{margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#0f0f0f;color:#ccc;max-width:800px;margin:0 auto;line-height:1.8}h1,h2{color:#00ff88}a{color:#00ff88}</style>
</head>
<body>
  <h1>Política de Privacidad</h1>
  <p><strong>Nexus Labs</strong> | gananciasconai.com | Última actualización: mayo 2026</p>

  <h2>1. Información que recopilamos</h2>
  <p>Recopilamos nombre completo, correo electrónico y número de teléfono cuando el usuario completa un formulario de contacto o de compra en nuestros anuncios o sitio web.</p>

  <h2>2. Uso de la información</h2>
  <p>Usamos su información para: (a) entregar los productos digitales adquiridos, (b) enviar notificaciones transaccionales por correo electrónico y SMS relacionadas con su compra, (c) enviar comunicaciones de marketing sobre productos relevantes, únicamente si el usuario ha dado su consentimiento explícito.</p>

  <h2>3. Mensajes SMS</h2>
  <p>Al proporcionar su número de teléfono y marcar la casilla de consentimiento, el usuario acepta recibir mensajes SMS de Nexus Labs. Se aplican tarifas estándar de mensajes y datos. Puede cancelar su suscripción en cualquier momento respondiendo <strong>STOP</strong>. Para ayuda, responda <strong>HELP</strong>.</p>

  <h2>4. Compartir información</h2>
  <p>No vendemos, alquilamos ni compartimos su información personal con terceros para fines de marketing. La información puede compartirse únicamente con proveedores de servicios que nos ayudan a operar (procesadores de pago, plataformas de envío de email/SMS) bajo acuerdos de confidencialidad.</p>

  <h2>5. Seguridad</h2>
  <p>Implementamos medidas de seguridad estándar de la industria para proteger su información. Sin embargo, ningún sistema es 100% seguro.</p>

  <h2>6. Sus derechos</h2>
  <p>Puede solicitar acceso, corrección o eliminación de sus datos personales escribiendo a: <a href="mailto:hola@gananciasconai.com">hola@gananciasconai.com</a></p>

  <h2>7. Contacto</h2>
  <p>Nexus Labs | <a href="mailto:hola@gananciasconai.com">hola@gananciasconai.com</a> | gananciasconai.com</p>
</body>
</html>`);
});

// ── Términos y Condiciones ────────────────────────────
router.get('/terminos', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Términos y Condiciones — Nexus Labs</title>
  <style>body{margin:0;padding:40px 20px;font-family:Arial,sans-serif;background:#0f0f0f;color:#ccc;max-width:800px;margin:0 auto;line-height:1.8}h1,h2{color:#00ff88}a{color:#00ff88}</style>
</head>
<body>
  <h1>Términos y Condiciones</h1>
  <p><strong>Nexus Labs</strong> | gananciasconai.com | Última actualización: mayo 2026</p>

  <h2>1. Programa de mensajes SMS</h2>
  <p><strong>Nombre del programa:</strong> Nexus Labs Notifications<br>
  <strong>Descripción:</strong> Notificaciones transaccionales y de marketing sobre productos digitales adquiridos o de interés.<br>
  <strong>Frecuencia de mensajes:</strong> Varía según la actividad del usuario; generalmente entre 1 y 5 mensajes por semana.<br>
  <strong>Tarifas:</strong> Se aplican tarifas estándar de mensajes y datos de su operador.</p>

  <h2>2. Opt-out</h2>
  <p>Para dejar de recibir mensajes SMS, responda <strong>STOP</strong> en cualquier momento. Recibirá un mensaje de confirmación y no se le enviará ningún mensaje adicional.</p>

  <h2>3. Ayuda</h2>
  <p>Para asistencia, responda <strong>HELP</strong> o escriba a <a href="mailto:hola@gananciasconai.com">hola@gananciasconai.com</a></p>

  <h2>4. Productos digitales</h2>
  <p>Todos los productos vendidos son digitales y de entrega inmediata. No se aceptan reembolsos una vez entregado el acceso al producto, salvo que el producto sea defectuoso o no corresponda a la descripción.</p>

  <h2>5. Propiedad intelectual</h2>
  <p>Todo el contenido de los productos digitales es propiedad de Nexus Labs. Queda prohibida su reproducción o distribución sin autorización expresa.</p>

  <h2>6. Limitación de responsabilidad</h2>
  <p>Nexus Labs no garantiza resultados específicos derivados del uso de sus productos. Los resultados dependen del esfuerzo y circunstancias individuales de cada usuario.</p>

  <h2>7. Contacto</h2>
  <p>Nexus Labs | <a href="mailto:hola@gananciasconai.com">hola@gananciasconai.com</a> | gananciasconai.com</p>
</body>
</html>`);
});

export default router;
