import { Router } from 'express';
import { TelegramConnector } from '../../connectors/telegram.connector.js';
import ENV from '../../config/env.js';

const router = Router();

router.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), service: 'next-system-core' });
});

// Registro manual del webhook — abrir en navegador para forzar el registro
router.get('/api/admin/webhook', async (req, res) => {
  if (!ENV.TELEGRAM_TOKEN) return res.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' });
  if (!ENV.RAILWAY_DOMAIN) return res.json({ ok: false, error: 'RAILWAY_PUBLIC_DOMAIN no configurado' });

  const webhookUrl = `https://${ENV.RAILWAY_DOMAIN}/telegram/webhook`;
  try {
    const bot = TelegramConnector.bot;
    const info = await bot.setWebHook(webhookUrl);
    res.json({ ok: true, webhookUrl, result: info });
  } catch (err) {
    res.json({ ok: false, webhookUrl, error: err.message });
  }
});

export default router;
