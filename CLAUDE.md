# CONTEXTO DEL PROYECTO — Startup Marketing Automático Estilo Jarvis

## ESTADO GENERAL
- **Nombre del negocio**: `Nexus Labs`
- **Versión de código**: next-system-core (package.json)
- **Deploy**: Railway (railway.json configurado)
- **Runtime**: Node.js v24, ES Modules (`"type": "module"`)
- **Puerto**: 3001

---

## VISIÓN DEL PROYECTO

Sistema autónomo de marketing que opera como un equipo completo de empleados digitales:
- **Genera leads** desde Meta Ads automáticamente
- **Llama** a los leads con IA (Sofia, voz real por VAPI)
- **Analiza** campañas cada mañana con Claude y propone un plan
- **Ejecuta** el plan cuando Eduardo lo aprueba (o de forma autónoma si el cambio es pequeño)
- **Supervisa** campañas cada 4 horas y ajusta presupuestos
- **Reporta** métricas por Telegram en tiempo real
- **Jarvis**: Eduardo puede dar comandos en lenguaje natural desde Telegram

### Escalones planificados (multi-tier startup)

| Escalón | Estado | Descripción |
|---------|--------|-------------|
| 1 — Core automotriz | ✅ ~70% implementado | Primer nicho funcional (base del sistema) |
| 2 — CRM multi-nicho | ✅ Arquitectura lista | client.db soporta múltiples nichos |
| 3 — Replicación de nichos | 🔲 Pendiente | Mismo sistema para barbería, inmuebles, etc. |
| 4 — Market Research Agent | 🔲 Placeholder | Investiga mercados automáticamente |
| 5 — Validation Agent | 🔲 Placeholder | Valida copys, creativos antes de publicar |
| 6 — Scaling Agent | 🔲 Placeholder | Decide cuándo escalar nichos completos |
| 7 — Product Engine | 🔲 Placeholder | Genera productos/ofertas basado en datos |

---

## ARQUITECTURA — MAPA DE MÓDULOS

```
index.js                     → Punto de entrada, arranca orchestrator
orchestrator/                → Bootstrap: servidor + scheduler + validación de env
server/                      → Express (puerto 3001) + rutas + webhooks
jobs/                        → Cron jobs: analista 8AM, supervisor cada 4h, token-check
config/
  env.js                     → Lee .env, valida required(), singleton
  business.config.js         → Reglas de negocio (thresholds, horarios, límites $)
connectors/
  meta.connector.js          → Meta Graph API v25.0
  vapi.connector.js          → VAPI (iniciar llamada, webhook)
  anthropic.connector.js     → Claude (análisis, Jarvis)
  openai.connector.js        → DALL-E 3 (creativos)
  telegram.connector.js      → Bot de Telegram
memory/                      → Módulos de acceso a PostgreSQL (persiste entre redeploys ✅)
  leads.db.js                → Leads: NUEVO→LLAMADO→CITA→CERRADO
  calls.db.js                → Historial de llamadas VAPI
  plans.db.js                → Plan del Analista (TTL 24h)
  campaigns.db.js            → Historial de campañas Meta
  conversions.db.js          → Ventas y revenue
lead_system/
  scoring.js                 → Matriz de puntos → CALIENTE/TIBIO/FRIO
  capture.js                 → Procesa lead: score + guardar + CAPI + Telegram + llamada
ads_engine/
  segments.config.js         → 5 segmentos con copies y prompts de imagen
  campaign-creator.js        → Crea Campaign+AdSets+Ads en Meta end-to-end
  campaign-manager.js        → Pausar, escalar, cambiar presupuesto
call_agent/
  sofia.config.js            → Config VAPI inline de Sofia (BDC leads)
  ana.config.js              → Config VAPI inline de Ana (briefing Eduardo)
  caller.js                  → llamarLead(), programarLlamada(), llamarBriefing()
  context-caller.js          → Llamada con datos CRM + prompt dinámico
  webhook-handler.js         → Procesa end-of-call-report de VAPI
agents/
  analista/                  → Análisis diario con Claude → plan JSON
  ejecutor/                  → Implementa el plan aprobado
  supervisor/                → Reglas automáticas cada 4h (pausa/escala)
jarvis/
  index.js                   → Claude con tool_use para comandos en lenguaje natural
  tools.js                   → 24 herramientas disponibles para Jarvis
  voice-function-handler.js  → Jarvis puede responder a Eduardo en llamadas VAPI
crm/
  client.db.js               → CRM multi-nicho (lease, autos, barbería, etc.)
  follow-up.db.js            → Seguimientos programados
financial_control/           → Validaciones de presupuesto (⚠️ no integrado aún)
reporting/                   → Dashboard de métricas por Telegram
scaling_agent/               → 🔲 Placeholder
validation_agent/            → 🔲 Placeholder
market_research_agent/       → 🔲 Placeholder
product_engine/              → 🔲 Placeholder
sandbox/                     → Experimentos y pruebas (NO es código de producción)
```

---

## REGLAS DE TRABAJO EN ESTE PROYECTO

### Nunca hacer sin preguntar primero
- Cambiar el nombre de negocio en `sofia.config.js` o `business.config.js` sin que el usuario confirme el nombre
- Cambiar límites de presupuesto (`presupuestoMaxDia`, `limiteEscalarSolo`)
- Modificar el prompt de Sofia o Ana (afecta directamente las llamadas a clientes reales)
- Borrar o resetear registros en la base de datos PostgreSQL
- Hacer push a Railway o Git

### Siempre verificar antes de proponer
- Si se va a tocar `sofia.config.js` → leer el archivo completo antes
- Si se va a tocar `business.config.js` → confirmar con el usuario los valores
- Si se va a crear una campaña real en Meta → pedir confirmación explícita

### Convenciones del código
- ES Modules (`import/export`), no CommonJS (`require`)
- Async/await en todo, no callbacks
- Logs con prefijo de módulo: `[Caller]`, `[Analista]`, `[Supervisor]`, etc.
- Configuración siempre desde `config/env.js`, nunca `process.env.X` directo
- Números de teléfono → siempre normalizar a `+1XXXXXXXXXX`

### Sobre la persistencia
- Toda la memoria está en **PostgreSQL en Railway** — persiste entre redeploys ✅
- Schema en `database/schema.sql`, migración automática al arrancar via `database/migrate.js`
- Tablas activas: `leads`, `calls`, `plans`, `campaigns`, `conversions`, `clients`, `follow_ups`, `experiments`, `customers`, `projects`, `email_sequences`, `product_memory`

---

## DEUDA TÉCNICA — PRIORIDADES

| # | Problema | Impacto | Estado |
|---|----------|---------|--------|
| 1 | ~~Persistencia en `/tmp` se borra en redeploy~~ | ~~CRÍTICO~~ | ✅ Resuelto — todo en PostgreSQL |
| 2 | `financial_control` no integrado en flujo | MEDIO | Existe pero no se llama |
| 3 | Sin retry automático en Meta API y VAPI | MEDIO | No hay backoff |
| 4 | ~~`AutoAprobado Miami` hardcodeado en configs~~ | ~~MEDIO~~ | ✅ Resuelto — nombre es Nexus Labs |
| 5 | `global._planPendiente` en Analista | BAJO | Usar PlansDB en su lugar |
| 6 | Sin tests | BAJO | No hay ninguno |
| 7 | Rate limiting solo en `/api`, no en webhooks | BAJO | Falta en webhooks |

---

## INTEGRACIONES EXTERNAS ACTIVAS

| Servicio | Variable en .env | Uso |
|----------|-----------------|-----|
| Meta Graph API | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Campañas + Lead Ads + CAPI |
| VAPI | `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID` | Llamadas Sofia y Ana |
| Anthropic Claude | `ANTHROPIC_API_KEY` | Analista + Jarvis + Sofia |
| OpenAI | `OPENAI_API_KEY` | DALL-E 3 (creativos) |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Notificaciones + comandos |
| ElevenLabs | `ELEVEN_LABS_API_KEY` | Voz de Ana |
| Twilio | `TWILIO_*` | Configurado pero no usado aún |

---

## FLUJO DE UN LEAD (referencia rápida)

```
Lead llena formulario → POST /api/lead
  → scoreLead() → CALIENTE/TIBIO/FRIO
  → LeadsDB.guardar()
  → Meta CAPI evento "Lead"
  → Telegram notificación + botones
  → setTimeout(5 min) → Sofia llama al lead por VAPI
    → Webhook end-of-call → procesar resultado
      → Si cita: LeadsDB.marcarCitaAgendada() + WhatsApp auto
  → Asesor atiende cita → POST /api/venta
    → LeadsDB.marcarCerrado() + Meta CAPI "Purchase"
```

## CICLO DIARIO AUTOMÁTICO

```
8:00 AM  → Analista: análisis Claude → plan → Telegram + Ana llama a Eduardo
           → Eduardo aprueba → Ejecutor: pausa/escala/crea campañas
Cada 4h  → Supervisor: si gasto >= $4 sin leads → pausa; si CPL < $5 → escala
On-demand → Jarvis: Eduardo escribe en Telegram → Claude interpreta → ejecuta tools
```

---

## SANDBOX — EXPERIMENTOS DISPONIBLES

```bash
node sandbox/index.js test-sofia     # Verificar config de Sofia
node sandbox/index.js test-scoring   # Probar scoring de leads
node sandbox/index.js test-plan      # Ver plan vigente en memoria
node sandbox/index.js test-leads     # Resumen de leads y conversiones
```

---

## LO QUE FALTA DEFINIR (pendiente con el usuario)

- [x] **Nombre del negocio** — ✅ Nexus Labs (reemplazo completado 2026-04-24)
- [x] **Base de datos** — ✅ PostgreSQL en Railway (migrado de /tmp, persiste entre redeploys)
- [x] **Dominio / URL pública** — ✅ gananciasconai.com (Resend verificado, webhooks activos)
- [x] **Prompt de Sofia** — ✅ Renombrado de Sofía a Sofia, voz ElevenLabs estilo Jarvis
- [ ] **Nicho(s) iniciales** — ¿solo automotriz? ¿otros desde el inicio?
- [ ] **Asesores reales** — nombres y WhatsApp en `business.config.js`
- [ ] **Presupuesto real** — validar límites de Meta ($30/día, escalas)
