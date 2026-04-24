// ════════════════════════════════════════════════════
// DATABASE — Pool de conexión PostgreSQL
// Lee DATABASE_URL del entorno.
// En Railway: se inyecta automáticamente al agregar el plugin PostgreSQL.
// En local: copiar DATABASE_URL del panel de Railway al .env
// ════════════════════════════════════════════════════

import pg from 'pg';
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('[DB] DATABASE_URL no configurado. Agrégalo al .env');

  pool = new Pool({
    connectionString: url,
    // Railway y la mayoría de PG en la nube requieren SSL
    ssl: url.includes('localhost') || url.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
    max:              10,   // máximo de conexiones simultáneas
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    console.error('[DB] Error inesperado en pool:', err.message);
  });

  return pool;
}

// Helper: ejecuta una query y devuelve las filas
export async function query(sql, params = []) {
  return getPool().query(sql, params);
}

export default { getPool, query };
