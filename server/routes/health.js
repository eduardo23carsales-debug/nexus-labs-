import { Router } from 'express';
import { TelegramConnector } from '../../connectors/telegram.connector.js';
import { MetaConnector } from '../../connectors/meta.connector.js';
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

router.get('/api/admin/meta-check', async (req, res) => {
  if (!ENV.META_TOKEN)       return res.json({ ok: false, error: 'META_ACCESS_TOKEN no configurado' });
  if (!ENV.META_AD_ACCOUNT)  return res.json({ ok: false, error: 'META_AD_ACCOUNT_ID no configurado' });
  try {
    const tokenInfo = await MetaConnector.validarToken();
    const campanas  = await MetaConnector.getCampanas();
    res.json({ ok: true, token: tokenInfo, campanas_count: campanas.length, account: ENV.META_AD_ACCOUNT });
  } catch (err) {
    res.json({ ok: false, error: err.response?.data?.error?.message || err.message });
  }
});

export default router;
