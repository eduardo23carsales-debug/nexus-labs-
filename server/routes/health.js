import { Router } from 'express';

const router = Router();

router.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), service: 'next-system-core' });
});

export default router;
