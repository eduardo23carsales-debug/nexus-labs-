// ════════════════════════════════════════════════════
// ROUTES — Memoria de Jarvis
// POST /memory/save  → guardar memoria
// GET  /memory/context → contexto para inyectar
// ════════════════════════════════════════════════════

import { Router } from 'express';
import { JarvisMemoryDB } from '../../memory/jarvis.db.js';

const router = Router();

router.post('/memory/save', async (req, res) => {
  try {
    const { tipo, titulo, contenido, importancia } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ ok: false, error: 'titulo y contenido son requeridos' });
    }
    const mem = await JarvisMemoryDB.guardar({ tipo, titulo, contenido, importancia });
    res.json({ ok: true, memoria: mem });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/memory/context', async (req, res) => {
  try {
    const memorias = await JarvisMemoryDB.listar({ soloActivas: true });
    const contexto = await JarvisMemoryDB.getContexto();
    res.json({ ok: true, total: memorias.length, contexto, memorias });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/memory/:id', async (req, res) => {
  try {
    await JarvisMemoryDB.desactivar(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
