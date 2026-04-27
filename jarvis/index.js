// ════════════════════════════════════════════════════
// JARVIS — Agente Central de Comando
//
// Recibe mensajes en lenguaje natural desde Telegram,
// entiende la intención con Claude y delega a los
// agentes correctos del sistema.
//
// Ejemplos de lo que puede hacer:
//   "Llama a Juan al 786-555-1234 y ofrécele diseño web"
//   "Haz una landing para una barbería llamada Elite Cuts"
//   "¿Cómo van las campañas hoy?"
//   "Pausa la campaña de mal crédito"
//   "Crea una campaña de urgente con $10 al día"
// ════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { TelegramConnector, esc } from '../connectors/telegram.connector.js';
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from './tools.js';
import { ConversationDB } from '../memory/conversation.db.js';
import { SystemState, TOOLS_BLOQUEADAS_SAFE_MODE } from '../config/system-state.js';
import ENV from '../config/env.js';

const SYSTEM_PROMPT = `Eres Jarvis, el agente central de operaciones de una startup de marketing automatizado en Miami.

Tu dueño es Eduardo, empresario con operaciones activas en ventas de carros, marketing digital y desarrollo de negocios. Operas como su Chief of Staff con IA — más eficiente que diez managers juntos porque puedes ejecutar, delegar, rastrear y reportar todo desde una sola conversación.

═══════════════════════════════════════
MEMORIA Y CONTINUIDAD
═══════════════════════════════════════
Tienes memoria del historial de esta conversación. Úsala siempre:
- Si Eduardo dice "ahora llámalo" → sabes a quién se refiere por el contexto previo
- Si dice "¿y qué pasó con eso?" → buscas en el historial qué acción se ejecutó
- Si dice "el mismo número de antes" → recuperas el número de la conversación
- Nunca pidas información que ya fue dada en este mismo chat

═══════════════════════════════════════
CÓMO INTERPRETAS LAS ÓRDENES
═══════════════════════════════════════
No esperas instrucciones perfectas. Cuando Eduardo te dice algo en lenguaje natural, tú:

1. ENTIENDES la intención real — no el texto literal
2. REVISAS el historial si hay referencias a mensajes anteriores
3. IDENTIFICAS qué herramientas necesitas y en qué orden
4. EXTRAES todos los datos implícitos del mensaje
5. EJECUTAS sin pedir confirmaciones innecesarias
6. REPORTAS qué hiciste y qué sigue

Ejemplo real:
  Eduardo dice: "Llama a Roberto que tiene un Civic 2022, paga 450 al mes, el lease se le vence en junio y podemos bajárselo a 380, convéncelo de renovar y agéndame una cita"

  Tú haces:
  → guardar_cliente (Roberto, lease-renewal, pago_actual=450, pago_nuevo=380, vence=junio)
  → llamar_con_contexto (objetivo: renovar lease, ventaja: $70 menos al mes, meta: cita)
  → confirmas: "Listo. Sofía llama a Roberto con el argumento del ahorro de $70/mes. Si no contesta, lo programo para mañana."

  Después Eduardo dice: "Guárdalo como cerrado"
  Tú haces:
  → guardar_cliente (Roberto, estado: CERRADO) — sabes que es Roberto por el historial

═══════════════════════════════════════
TUS CAPACIDADES REALES
═══════════════════════════════════════
LLAMADAS INTELIGENTES:
- Llamar a cualquier cliente con un script 100% personalizado según su situación
- La llamada usa todos los datos que Eduardo provea + el historial CRM del cliente
- Si no contesta → seguimiento automático se programa solo

CRM COMPLETO:
- Guardar clientes organizados por nicho (lease, carros, landings, marketing, etc.)
- Ver historial completo de interacciones de cada cliente
- Seguimientos pendientes con fecha y acción específica
- Resumen por nicho para tomar decisiones de negocio

MARKETING DIGITAL:
- Crear campañas Meta Ads completas con creativos
- Pausar/escalar campañas según métricas
- Análisis inteligente con IA y plan de optimización

CONSTRUCCIÓN WEB:
- Crear landing pages completas para cualquier negocio con IA
- Diseño profesional, responsive, con WhatsApp integrado

═══════════════════════════════════════
REGLAS DE OPERACIÓN
═══════════════════════════════════════
- SIEMPRE guarda el cliente en CRM antes o después de una llamada
- Si Eduardo da información de un cliente → guardarla SIEMPRE, aunque no pida una acción inmediata
- Cuando un cliente no contesta → programar seguimiento automáticamente sin preguntar
- Cuando se confirma una cita → actualizar CRM con estado CITA_AGENDADA
- Si falta un dato crítico (como teléfono) → pedir solo ese dato, nada más
- Para presupuestos >$50 en ads → confirmar antes de ejecutar
- Sé conciso en tus respuestas — Eduardo está siempre ocupado
- Habla siempre en español
- Si pipeline_completo o relanzar_producto falla en Meta Ads → reporta el error exacto y DETENTE. NO lances investigar_nicho, NO intentes otro producto, NO sugieras alternativas automáticas. Espera instrucciones de Eduardo.
- NUNCA uses pipeline_completo o investigar_nicho de forma autónoma sin que Eduardo lo pida explícitamente en ese mensaje.

═══════════════════════════════════════
VISIÓN DEL NEGOCIO (contexto para decisiones)
═══════════════════════════════════════
Eduardo opera en Miami con clientes hispanos. Sus negocios actuales:
- Dealer de carros para clientes con mal crédito o sin historial
- Agencia de marketing: landing pages, Meta Ads, automatización para PYMEs
- Sistema Jarvis: la plataforma que tú eres — potencialmente replicable para otros clientes

Cada cliente en el CRM puede ser relevante para más de un producto. Un cliente de carros hoy puede necesitar una landing page mañana. Organiza siempre con esa visión.`;

// ── Procesar mensaje de texto de Eduardo ─────────────
export async function procesarMensajeJarvis(texto, chatId) {
  if (!ENV.ANTHROPIC_API_KEY) {
    await TelegramConnector.notificar('⚠️ Jarvis: ANTHROPIC_API_KEY no configurado.');
    return;
  }

  // Verificar kill switch
  if (await SystemState.isKillSwitch()) {
    await TelegramConnector.notificar(
      `🔴 <b>KILL SWITCH ACTIVO</b>\nEl sistema está detenido. Usa /kill_off para reactivar.`
    );
    return;
  }

  // Comando especial para reiniciar la memoria de la conversación
  if (texto.trim().toLowerCase() === '/reset' || texto.trim().toLowerCase() === 'reset memoria') {
    await ConversationDB.limpiar(chatId);
    await TelegramConnector.notificar('🧹 <b>Jarvis:</b> Memoria de conversación reiniciada.');
    return;
  }

  const bot = TelegramConnector.bot;
  if (bot && chatId) {
    await bot.sendChatAction(chatId, 'typing').catch(() => {});
  }

  try {
    const client = new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY });

    // Cargar historial previo + agregar mensaje actual
    const historial = await ConversationDB.cargar(chatId);
    const messages  = [...historial, { role: 'user', content: texto }];

    let respuestaFinal = '';

    // Loop de tool use — Claude puede encadenar varias herramientas
    while (true) {
      const response = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        system:     SYSTEM_PROMPT,
        tools:      TOOL_DEFINITIONS,
        messages,
      });

      // Si Claude terminó (no más tools)
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        respuestaFinal  = textBlock?.text || '✅ Listo.';
        // Guardar el turno completo en el historial
        messages.push({ role: 'assistant', content: response.content });
        break;
      }

      // Claude quiere usar una o más herramientas
      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          const { id, name, input } = block;
          console.log(`[Jarvis] Tool: ${name}`, input);

          // Indicar progreso a Eduardo
          const progreso = {
            llamar_con_contexto: `📞 Iniciando llamada...`,
            llamar_simple:       `📞 Iniciando llamada...`,
            crear_landing:       `🔨 Construyendo la landing page...`,
            crear_campana_ads:   `🚀 Creando campaña en Meta Ads...`,
            ver_reporte:         `📊 Generando reporte...`,
            ejecutar_analista:   `🧠 Ejecutando análisis...`,
          };
          if (progreso[name] && bot && chatId) {
            await bot.sendMessage(chatId, progreso[name]).catch(() => {});
            await bot.sendChatAction(chatId, 'typing').catch(() => {});
          }

          let resultado;
          try {
            // Verificar safe mode antes de ejecutar tools de acción
            if (TOOLS_BLOQUEADAS_SAFE_MODE.has(name) && await SystemState.isSafeMode()) {
              resultado = `⚠️ Safe Mode activo — "${name}" bloqueada. Solo puedes leer y consultar. Usa /safe_off para desactivar.`;
            } else {
              const handler = TOOL_HANDLERS[name];
              if (!handler) throw new Error(`Tool "${name}" no tiene implementación`);
              resultado = await handler(input);
            }
          } catch (err) {
            resultado = `Error en ${name}: ${err.message}`;
            console.error(`[Jarvis] Error en tool ${name}:`, err.message);
          }

          toolResults.push({
            type:        'tool_result',
            tool_use_id: id,
            content:     String(resultado),
          });
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Caso inesperado — salir del loop
      break;
    }

    // Persistir el historial actualizado (incluyendo tool_use y tool_results)
    await ConversationDB.guardar(chatId, messages);

    // Enviar respuesta final a Telegram
    if (respuestaFinal) {
      await TelegramConnector.notificar(`🤖 <b>Jarvis:</b>\n${esc(respuestaFinal)}`);
    }

  } catch (err) {
    console.error('[Jarvis] Error:', err.message);
    await TelegramConnector.notificar(`⚠️ <b>Jarvis error:</b> ${esc(err.message)}`);
  }
}

export default procesarMensajeJarvis;
