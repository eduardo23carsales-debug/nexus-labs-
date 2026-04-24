// ════════════════════════════════════════════════════
// EXPRESS APP — Setup y registro de rutas
// ════════════════════════════════════════════════════

import express       from 'express';
import path          from 'path';
import { fileURLToPath } from 'url';
import { rateLimiter }   from './middleware/rate-limiter.js';
import leadsRouter       from './routes/leads.js';
import salesRouter       from './routes/sales.js';
import webhooksRouter    from './routes/webhooks.js';
import healthRouter      from './routes/health.js';
import landingsRouter    from './routes/landings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// El webhook de Stripe necesita el body raw (sin parsear) para verificar la firma
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Rutas
app.use('/api',      rateLimiter, leadsRouter);
app.use('/api',      salesRouter);
app.use('/api',      webhooksRouter);
app.use('/telegram', webhooksRouter);
app.use('/',         landingsRouter);
app.use('/',         healthRouter);

export default app;
