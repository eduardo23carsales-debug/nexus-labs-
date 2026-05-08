// ════════════════════════════════════════════════════
// SYSTEM STATE — Kill switch y safe mode
// Persiste en PostgreSQL para sobrevivir redeploys
// ════════════════════════════════════════════════════

import { query } from './database.js';

// Crea la tabla si no existe (se llama al arrancar)
export async function initSystemState() {
  await query(`
    CREATE TABLE IF NOT EXISTS system_state (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Insertar valores por defecto si no existen
  await query(`
    INSERT INTO system_state (key, value)
    VALUES ('kill_switch', 'false'), ('safe_mode', 'false'), ('auto_mode', 'false')
    ON CONFLICT (key) DO NOTHING
  `);
}

async function getState(key) {
  const { rows } = await query('SELECT value FROM system_state WHERE key = $1', [key]);
  return rows[0]?.value === 'true';
}

async function setState(key, value) {
  await query(
    'UPDATE system_state SET value = $1, updated_at = NOW() WHERE key = $2',
    [String(value), key]
  );
}

export const SystemState = {
  async isKillSwitch() { return getState('kill_switch'); },
  async isSafeMode()   { return getState('safe_mode');   },
  async isAutoMode()   { return getState('auto_mode');   },

  async activarKillSwitch()    { await setState('kill_switch', true);  },
  async desactivarKillSwitch() { await setState('kill_switch', false); },
  async activarSafeMode()      { await setState('safe_mode', true);    },
  async desactivarSafeMode()   { await setState('safe_mode', false);   },
  async activarAutoMode()      { await setState('auto_mode', true);    },
  async desactivarAutoMode()   { await setState('auto_mode', false);   },

  async getStatus() {
    const [kill, safe, auto_] = await Promise.all([
      getState('kill_switch'), getState('safe_mode'), getState('auto_mode'),
    ]);
    return { kill_switch: kill, safe_mode: safe, auto_mode: auto_ };
  },
};

// Herramientas bloqueadas en safe mode (escriben/gastan/llaman)
export const TOOLS_BLOQUEADAS_SAFE_MODE = new Set([
  'llamar_con_contexto',
  'llamar_simple',
  'crear_campana_ads',
  'lanzar_campana_producto',
  'escalar_campana',
  'pausar_campana',
  'pipeline_completo',
  'generar_producto',
  'publicar_con_stripe',
  'publicar_hotmart',
  'ejecutar_analista',
  'ejecutar_supervisor',
  'aprobar_plan',
]);

export default SystemState;
