// ════════════════════════════════════════════════════
// ROUTES — Contactos: importación CSV + tracking emails
// ════════════════════════════════════════════════════

import { Router }          from 'express';
import { ContactsDB, EmailCampaignsDB } from '../../memory/contacts.db.js';
import { TelegramConnector } from '../../connectors/telegram.connector.js';
import ENV from '../../config/env.js';

const router = Router();

// ── Importar CSV de contactos ─────────────────────────
// POST /api/contacts/import
// Body: { contactos: [{nombre, email, telefono, carro, año, nicho}], nicho }
router.post('/contacts/import', async (req, res) => {
  try {
    const { contactos, nicho = 'automotriz' } = req.body;
    if (!Array.isArray(contactos) || !contactos.length) {
      return res.status(400).json({ error: 'Se requiere array de contactos' });
    }

    const lote = contactos.map(c => ({ ...c, nicho: c.nicho || nicho }));
    const resultado = await ContactsDB.importarLote(lote);

    await TelegramConnector.notificar(
      `📋 <b>Contactos importados</b>\n` +
      `✅ Nuevos: ${resultado.insertados}\n` +
      `⏭️ Duplicados: ${resultado.duplicados}\n` +
      `📂 Nicho: ${nicho}`
    ).catch(() => {});

    res.json({ ok: true, ...resultado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Resumen de contactos ──────────────────────────────
// GET /api/contacts/resumen
router.get('/contacts/resumen', async (req, res) => {
  try {
    const resumen = await ContactsDB.resumen();
    res.json({ ok: true, resumen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Tracking: pixel de apertura ───────────────────────
// GET /track/open/:campaignId/:email
router.get('/track/open/:campaignId/:email', async (req, res) => {
  try {
    const { campaignId, email } = req.params;
    await EmailCampaignsDB.registrarAbierto(parseInt(campaignId), decodeURIComponent(email));
  } catch {}
  // Pixel transparente 1x1
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': pixel.length });
  res.end(pixel);
});

// ── Tracking: click en link ───────────────────────────
// GET /track/click/:campaignId/:email?url=...
router.get('/track/click/:campaignId/:email', async (req, res) => {
  try {
    const { campaignId, email } = req.params;
    const url = req.query.url || '/';
    await EmailCampaignsDB.registrarClick(parseInt(campaignId), decodeURIComponent(email), url);
    res.redirect(url);
  } catch (err) {
    res.redirect(req.query.url || '/');
  }
});

// ── Baja de lista (unsubscribe) ───────────────────────
// GET /baja/:email
router.get('/baja/:email', async (req, res) => {
  try {
    await ContactsDB.marcarBaja(decodeURIComponent(req.params.email));
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f0f0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
<div style="text-align:center;padding:40px;">
  <h1 style="color:#00ff88;">✅ Listo</h1>
  <p style="color:#aaa;">Tu email ha sido removido de nuestra lista. No recibirás más correos.</p>
</div>
</body></html>`);
  } catch {
    res.status(500).send('Error al procesar tu solicitud');
  }
});

export default router;
