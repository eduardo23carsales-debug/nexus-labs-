// ════════════════════════════════════════════════════
// SCHEDULER — Registro de todos los cron jobs
// ════════════════════════════════════════════════════

import cron from 'node-cron';
import { ejecutarAnalista }    from '../agents/analista/index.js';
import { ejecutarSupervisor, enviarResumenSemanal } from '../agents/supervisor/index.js';
import { revisarExperimentos } from '../scaling_agent/index.js';
import { MetaConnector }       from '../connectors/meta.connector.js';
import { TelegramConnector }   from '../connectors/telegram.connector.js';
import { ResendConnector }     from '../connectors/resend.connector.js';

export function iniciarScheduler() {
  // Validación de token Meta — cada medianoche ET
  cron.schedule('0 0 * * *', async () => {
    const res = await MetaConnector.validarToken();
    if (!res.ok) {
      await TelegramConnector.notificar(
        `🔴 <b>Token Meta expirado</b>\n` +
        `El sistema no puede conectarse a Meta Ads.\n\n` +
        `Para renovar:\n` +
        `1. Ve a developers.facebook.com\n` +
        `2. Graph API Explorer → genera nuevo token\n` +
        `3. Actualiza META_ACCESS_TOKEN en Railway → Redeploy`
      );
    }
  }, { timezone: 'America/New_York' });

  // Analista — 8 AM diario ET
  cron.schedule('0 8 * * *', async () => {
    try {
      await ejecutarAnalista();
    } catch (e) {
      console.error('[Scheduler] Error en Analista:', e.message);
    }
  }, { timezone: 'America/New_York' });

  // Supervisor — cada 4 horas ET
  cron.schedule('0 */4 * * *', async () => {
    try {
      await ejecutarSupervisor();
    } catch (e) {
      console.error('[Scheduler] Error en Supervisor:', e.message);
    }
  }, { timezone: 'America/New_York' });

  // Supervisor — resumen semanal de aprendizaje (lunes 9AM ET)
  cron.schedule('0 9 * * 1', async () => {
    try {
      await enviarResumenSemanal();
    } catch (e) {
      console.error('[Scheduler] Error en resumen semanal Supervisor:', e.message);
    }
  }, { timezone: 'America/New_York' });

  // Scaling Agent — revisar experimentos cada 6 horas
  cron.schedule('0 */6 * * *', async () => {
    try {
      await revisarExperimentos();
    } catch (e) {
      console.error('[Scheduler] Error en ScalingAgent:', e.message);
    }
  }, { timezone: 'America/New_York' });

  // Secuencias de email — cada hora (entrega de productos + carritos abandonados + post-compra)
  cron.schedule('0 * * * *', async () => {
    if (!ResendConnector.disponible()) return;
    try {
      await ResendConnector.procesarPagosNuevos();
      await ResendConnector.procesarCarritosAbandonados();
      await ResendConnector.procesarSecuenciaPostCompra();
    } catch (e) {
      console.error('[Scheduler] Error en secuencias email:', e.message);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Scheduler] Jobs iniciados: token-check (00h), analista (8h), supervisor (cada 4h + resumen lunes 9h), scaling (cada 6h), emails (cada 1h)');
}

export default iniciarScheduler;
