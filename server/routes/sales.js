// ════════════════════════════════════════════════════
// ROUTE /api/venta — Registrar venta cerrada
// ════════════════════════════════════════════════════

import { Router }            from 'express';
import { LeadsDB }           from '../../memory/leads.db.js';
import { ConversionsDB }     from '../../memory/conversions.db.js';
import { MetaConnector }     from '../../connectors/meta.connector.js';
import { TelegramConnector, esc } from '../../connectors/telegram.connector.js';
import ENV                   from '../../config/env.js';
import crypto                from 'crypto';

const router = Router();

router.post('/venta', async (req, res) => {
  res.json({ ok: true });

  try {
    const { telefono, nombre, valor } = req.body;
    if (!telefono) return;

    // Actualizar memoria
    await LeadsDB.marcarCerrado(telefono, parseFloat(valor) || null);
    await ConversionsDB.registrarVenta({ telefono, nombre: nombre || telefono, valor, segmento: 'desconocido' });

    // Evento Purchase a Meta CAPI
    const event_id = `purchase_${crypto.randomUUID()}`;
    await MetaConnector.enviarEventoCAPI({
      nombre_evento: 'Purchase',
      telefono,
      valor:         parseFloat(valor) || 1,
      event_id,
    }).catch(e => console.warn('[Sales] CAPI Purchase falló:', e.message));

    // Notificación Telegram
    const telLimpio = telefono.replace(/\D/g, '');
    const teclado   = telLimpio
      ? { inline_keyboard: [[{ text: '📱 WhatsApp del cliente', url: `https://wa.me/${telLimpio}` }]] }
      : undefined;

    await TelegramConnector.notificar(
      `🏆 <b>¡VENTA CERRADA!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 ${esc(nombre || telefono)}\n` +
      `📱 ${esc(telefono)}\n` +
      (valor ? `💵 $${esc(String(valor))} USD\n` : '') +
      `🕐 ${new Date().toLocaleString('es-US', { timeZone: 'America/New_York' })}`,
      teclado ? { reply_markup: teclado } : {}
    );

    console.log(`[Sales] Venta registrada: ${nombre || telefono}`);

  } catch (err) {
    console.error('[Sales Route] Error:', err.message);
  }
});

export default router;
