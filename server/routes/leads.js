// ════════════════════════════════════════════════════
// ROUTE /api/lead — Captura de leads desde landing
// ════════════════════════════════════════════════════

import { Router }         from 'express';
import { procesarLead }   from '../../lead_system/capture.js';
import { programarLlamada } from '../../call_agent/caller.js';

const router = Router();

router.post('/lead', async (req, res) => {
  // Responder 200 inmediato para evitar timeouts
  res.json({ ok: true });

  try {
    const { nombre, telefono, email, segmento, ingresos, tiempo } = req.body;

    if (!nombre || !telefono) {
      console.warn('[Lead Route] Datos incompletos:', req.body);
      return;
    }

    await procesarLead(
      { nombre, telefono, email, segmento, ingresos, tiempo, fuente: 'web' },
      { programarLlamada }
    );

  } catch (err) {
    console.error('[Lead Route] Error:', err.message);
  }
});

export default router;
