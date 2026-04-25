// ════════════════════════════════════════════════════
// AGENTE SUPERVISOR
// Vigila campañas cada 4h — pausa o escala automático
// ════════════════════════════════════════════════════

import { MetaConnector }          from '../../connectors/meta.connector.js';
import { TelegramConnector, esc } from '../../connectors/telegram.connector.js';
import { CampaignManager }        from '../../ads_engine/campaign-manager.js';
import { llamarBriefing }         from '../../call_agent/caller.js';
import BUSINESS                   from '../../config/business.config.js';

const {
  limiteGastoSinLead,
  limiteEscalarSolo,
  campana: { cplObjetivo },
  maxEscalarPct,
} = BUSINESS;

// Hora actual en ET — devuelve 0-23
function horaET() {
  return parseInt(new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }), 10);
}

export async function ejecutarSupervisor() {
  console.log('[Supervisor] Iniciando revisión...');

  try {
    const campanas = await MetaConnector.getCampanas(true);
    if (!campanas.length) {
      console.log('[Supervisor] Sin campañas activas');
      return;
    }

    // Procesamiento paralelo: obtener datos de todas las campañas a la vez
    const resultados = await Promise.allSettled(
      campanas.map(c => CampaignManager.getDatosCampana(c))
    );

    const hora = horaET();
    // Solo escalar entre 9AM y 7PM ET — evitar cambios de presupuesto fuera del horario activo
    const dentroHorario = hora >= 9 && hora < 19;

    const pausadas = [];
    const escaladas = [];
    const consultas = [];

    for (let i = 0; i < campanas.length; i++) {
      const res = resultados[i];
      if (res.status === 'rejected') {
        console.error(`[Supervisor] Error obteniendo datos de campaña ${campanas[i].id}:`, res.reason?.message);
        continue;
      }
      const datos = res.value;
      const { spend, leads, cpl } = datos.hoy;
      const presupuesto = datos.presupuesto_dia;

      // Regla 1: Gasto sin leads → PAUSA (aplica siempre, sin importar hora)
      if (spend >= limiteGastoSinLead && leads === 0) {
        try {
          await CampaignManager.pausar(campanas[i].id);
          pausadas.push(`• ${esc(datos.nombre)} — gastó $${spend} sin leads`);
          console.log(`[Supervisor] Pausada: ${datos.nombre}`);
        } catch (e) {
          console.error(`[Supervisor] Error pausando ${datos.nombre}:`, e.message);
        }
        continue;
      }

      // Regla 2: Buen CPL → ESCALAR (solo en horario activo)
      if (!dentroHorario) continue;

      if (leads > 0 && cpl !== null && cpl < cplObjetivo) {
        const nuevo = +(presupuesto * (1 + maxEscalarPct)).toFixed(2);
        const aumento = nuevo - presupuesto;

        if (aumento <= limiteEscalarSolo) {
          try {
            await CampaignManager.cambiarPresupuesto(campanas[i].id, nuevo);
            escaladas.push(`• ${esc(datos.nombre)}: $${presupuesto}→$${nuevo}/día (CPL $${cpl})`);
            console.log(`[Supervisor] Escalada: ${datos.nombre} a $${nuevo}`);
          } catch (e) {
            console.error(`[Supervisor] Error escalando ${datos.nombre}:`, e.message);
          }
        } else {
          consultas.push({ id: campanas[i].id, nombre: datos.nombre, presupuesto, nuevo, cpl });
        }
      }
    }

    // Notificar acciones
    if (pausadas.length || escaladas.length) {
      const ts = new Date().toLocaleString('es-US', { timeZone: 'America/New_York' });
      const lineas = [`🔍 <b>Supervisor — ${ts}</b>`, `━━━━━━━━━━━━━━━━━━━━━━`];
      if (pausadas.length)  lineas.push(`\n⏸ <b>Pausadas (${pausadas.length}):</b>`, ...pausadas);
      if (escaladas.length) lineas.push(`\n📈 <b>Escaladas (${escaladas.length}):</b>`, ...escaladas);
      await TelegramConnector.notificar(lineas.join('\n'));
    }

    // Consultar a Eduardo para escalas grandes
    for (const c of consultas) {
      const teclado = {
        inline_keyboard: [[
          { text: `✅ Escalar a $${c.nuevo}/día`, callback_data: `escalar:${c.id}:${c.nuevo}` },
          { text: '❌ Dejar igual',                callback_data: 'ignorar' },
        ]]
      };
      await TelegramConnector.notificar(
        `📈 <b>Supervisor — Propuesta de escala</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 ${esc(c.nombre)}\n` +
        `💵 $${c.presupuesto}/día → $${c.nuevo}/día\n` +
        `📉 CPL actual: $${c.cpl} (objetivo <$${cplObjetivo})\n` +
        `⚠️ Supera el límite autónomo ($${limiteEscalarSolo}) — ¿apruebas?`,
        { reply_markup: teclado }
      );
    }

    console.log('[Supervisor] Revisión completada');

  } catch (err) {
    console.error('[Supervisor] Error:', err.message);
    await TelegramConnector.notificar(
      `⚠️ <b>Supervisor</b> — Error:\n<code>${esc(err.message)}</code>`
    );
  }
}

export default ejecutarSupervisor;
