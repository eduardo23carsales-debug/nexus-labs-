// ════════════════════════════════════════════════════
// ORCHESTRATOR — Coordinador central del sistema
//
// Responsabilidades:
//   1. Iniciar el servidor Express
//   2. Registrar el webhook de Telegram
//   3. Arrancar el scheduler de cron jobs
//   4. Validar que el entorno esté correcto al inicio
// ════════════════════════════════════════════════════

import { MetaConnector }       from '../connectors/meta.connector.js';
import { TelegramConnector }   from '../connectors/telegram.connector.js';
import { iniciarScheduler }    from '../jobs/scheduler.js';
import { runMigrations }       from '../database/migrate.js';
import { initSystemState }     from '../config/system-state.js';
import ENV                     from '../config/env.js';
import axios                   from 'axios';

export async function arrancar(app) {
  const PORT = ENV.PORT;

  // 1. Iniciar servidor
  app.listen(PORT, () => {
    console.log(`[Orchestrator] Servidor corriendo en puerto ${PORT}`);
  });

  // 2. Migraciones de base de datos
  if (ENV.DATABASE_URL) {
    try {
      await runMigrations();
      await initSystemState();
      console.log('[Orchestrator] System state inicializado ✅');
    } catch (err) {
      console.error('[Orchestrator] ⚠️ Error en migraciones DB:', err.message);
    }
  } else {
    console.warn('[Orchestrator] DATABASE_URL no configurado — usando modo sin DB (solo desarrollo)');
  }

  // 3. Registrar webhook de Telegram
  if (!ENV.TELEGRAM_TOKEN) {
    console.warn('[Orchestrator] TELEGRAM_BOT_TOKEN no configurado — Jarvis desactivado');
  } else if (!ENV.RAILWAY_DOMAIN) {
    console.warn('[Orchestrator] RAILWAY_PUBLIC_DOMAIN no configurado — webhook Telegram no registrado');
  } else {
    try {
      const bot = TelegramConnector.bot;
      const webhookUrl = `https://${ENV.RAILWAY_DOMAIN}/telegram/webhook`;
      console.log(`[Orchestrator] Intentando registrar webhook: "${webhookUrl}"`);
      const info = await bot.setWebHook(webhookUrl);
      console.log(`[Orchestrator] Telegram webhook registrado: ${webhookUrl} — ok=${info}`);
    } catch (err) {
      console.warn(`[Orchestrator] No se pudo registrar webhook Telegram: ${err.message}`);
      console.warn(`[Orchestrator] RAILWAY_DOMAIN value: "${ENV.RAILWAY_DOMAIN}"`);
    }
  }

  // 4. Validar token Meta
  const tokenCheck = await MetaConnector.validarToken();
  if (!tokenCheck.ok) {
    console.warn('[Orchestrator] ⚠️ Token Meta inválido al inicio:', tokenCheck.error);
    await TelegramConnector.notificar(
      `🔴 <b>Sistema iniciado con token Meta inválido</b>\n` +
      `Actualiza META_ACCESS_TOKEN en Railway.\n` +
      `Error: <code>${tokenCheck.error}</code>`
    ).catch(() => {});
  } else {
    console.log(`[Orchestrator] Token Meta válido — cuenta: ${tokenCheck.nombre}`);
  }

  // 5. Registrar suscripción de Meta Lead Ads webhook
  if (!ENV.META_WEBHOOK_TOKEN) {
    console.warn('[Orchestrator] META_WEBHOOK_TOKEN no configurado — leads de Meta NO llegarán al sistema');
  } else if (!ENV.RAILWAY_DOMAIN) {
    console.warn('[Orchestrator] RAILWAY_PUBLIC_DOMAIN no configurado — webhook Meta no registrado');
  } else if (!ENV.META_PAGE_ID) {
    console.warn('[Orchestrator] META_PAGE_ID no configurado — webhook Meta no registrado');
  } else {
    try {
      // Intentar obtener Page Access Token primero
      let tokenParaSub = ENV.META_ACCESS_TOKEN;
      try {
        const pageData = await MetaConnector.get(`/${ENV.META_PAGE_ID}`, { fields: 'access_token' });
        if (pageData.access_token) tokenParaSub = pageData.access_token;
      } catch (_) {
        // Si no se puede obtener page token, usar user token directamente
      }

      const { data: subData } = await axios.post(
        `https://graph.facebook.com/v25.0/${ENV.META_PAGE_ID}/subscribed_apps`,
        { subscribed_fields: 'leadgen', access_token: tokenParaSub },
        { timeout: 15000 }
      );
      console.log(`[Orchestrator] Meta Lead Ads webhook suscrito ✅ → https://${ENV.RAILWAY_DOMAIN}/api/meta/webhook (success=${subData.success})`);
    } catch (err) {
      console.warn(`[Orchestrator] No se pudo suscribir webhook Meta: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  // 6. Iniciar scheduler (cron jobs)
  iniciarScheduler();

  console.log('[Orchestrator] Sistema operativo ✅');
}

export default arrancar;
