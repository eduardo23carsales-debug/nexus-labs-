// ════════════════════════════════════════════════════
// ORCHESTRATOR — Coordinador central del sistema
//
// Responsabilidades:
//   1. Iniciar el servidor Express
//   2. Registrar el webhook de Telegram
//   3. Arrancar el scheduler de cron jobs
//   4. Validar que el entorno esté correcto al inicio
// ════════════════════════════════════════════════════

import { MetaConnector }     from '../connectors/meta.connector.js';
import { TelegramConnector } from '../connectors/telegram.connector.js';
import { iniciarScheduler }  from '../jobs/scheduler.js';
import { runMigrations }     from '../database/migrate.js';
import ENV                   from '../config/env.js';
import axios                 from 'axios';

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
    } catch (err) {
      console.error('[Orchestrator] ⚠️ Error en migraciones DB:', err.message);
    }
  } else {
    console.warn('[Orchestrator] DATABASE_URL no configurado — usando modo sin DB (solo desarrollo)');
  }

  // 3. Registrar webhook de Telegram
  if (ENV.TELEGRAM_TOKEN && ENV.RAILWAY_DOMAIN) {
    try {
      const bot = TelegramConnector.bot;
      const webhookUrl = `https://${ENV.RAILWAY_DOMAIN}/telegram/webhook`;
      await bot.setWebHook(webhookUrl);
      console.log(`[Orchestrator] Telegram webhook registrado: ${webhookUrl}`);
    } catch (err) {
      console.warn('[Orchestrator] No se pudo registrar webhook Telegram:', err.message);
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

  // 5. Iniciar scheduler (cron jobs)
  iniciarScheduler();

  console.log('[Orchestrator] Sistema operativo ✅');
}

export default arrancar;
