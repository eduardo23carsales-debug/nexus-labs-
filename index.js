// ════════════════════════════════════════════════════
// ENTRY POINT — next-system-core
// ════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

import app      from './server/app.js';
import arrancar from './orchestrator/index.js';

arrancar(app).catch(err => {
  console.error('[Bootstrap] Error fatal al arrancar:', err.message);
  process.exit(1);
});
