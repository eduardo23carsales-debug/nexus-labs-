// ════════════════════════════════════════════════════
// MIGRATE — Crea las tablas si no existen
// Uso: node database/migrate.js
// También se ejecuta automáticamente al iniciar el servidor.
// Es idempotente: seguro de correr múltiples veces.
// ════════════════════════════════════════════════════

import fs       from 'fs';
import path     from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const pool = getPool();
  const sql  = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  console.log('[DB] Ejecutando migraciones...');
  await pool.query(sql);
  console.log('[DB] Migraciones completadas ✅');
}

// Si se ejecuta directamente: node database/migrate.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => { console.error('[DB] Error en migración:', err.message); process.exit(1); });
}

export default runMigrations;
