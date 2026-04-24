# next-system-core — Arquitectura del Sistema

## Visión

Plataforma empresarial modular para agentes autónomos de generación de leads, llamadas y campañas de publicidad. Diseñada para ser replicable en cualquier nicho de mercado.

---

## Árbol de Módulos

```
next_system_core/
│
├── index.js                    ← Entry point
│
├── config/
│   ├── env.js                  ← Variables de entorno centralizadas (único punto de lectura)
│   └── business.config.js      ← Reglas de negocio (límites, scoring, asesores)
│
├── connectors/                 ← Capa de integración con APIs externas
│   ├── meta.connector.js       ← Meta Graph API v25.0
│   ├── vapi.connector.js       ← VAPI (llamadas telefónicas IA)
│   ├── telegram.connector.js   ← Telegram Bot API
│   ├── anthropic.connector.js  ← Claude (análisis IA)
│   ├── openai.connector.js     ← DALL-E 3 (imágenes)
│   └── index.js
│
├── memory/                     ← Base de datos central (JSON en /tmp, reemplazable por DB)
│   ├── leads.db.js             ← Leads + estados del funnel
│   ├── plans.db.js             ← Planes del Analista (TTL 24h)
│   ├── calls.db.js             ← Historial de llamadas
│   ├── campaigns.db.js         ← Historial de campañas
│   ├── conversions.db.js       ← Ventas, CAC, revenue
│   └── index.js
│
├── lead_system/                ← Captura y calificación de leads
│   ├── capture.js              ← Procesamiento: scoring + CAPI + Telegram + VAPI
│   ├── scoring.js              ← Lógica de puntuación CALIENTE/TIBIO/FRIO
│   └── index.js
│
├── ads_engine/                 ← Motor de campañas Meta Ads
│   ├── segments.config.js      ← 5 segmentos con copies, hooks y prompts de imagen
│   ├── campaign-creator.js     ← Crear campaña completa (campaña + adsets + ads + formulario)
│   ├── campaign-manager.js     ← Pausar, activar, escalar presupuesto
│   └── index.js
│
├── call_agent/                 ← Agente de llamadas telefónicas
│   ├── sofia.config.js         ← Config VAPI de Sofía (BDC, voz Cartesia, prompt completo)
│   ├── ana.config.js           ← Config VAPI de Ana (briefing matutino a Eduardo)
│   ├── caller.js               ← Iniciar llamadas, programar con delay
│   ├── webhook-handler.js      ← Procesar resultados de llamadas (Sofía y Ana)
│   └── index.js
│
├── agents/                     ← Agentes inteligentes que toman decisiones
│   ├── analista/index.js       ← Análisis diario 8AM → plan con Claude
│   ├── ejecutor/index.js       ← Implementa plan aprobado en Meta Ads
│   └── supervisor/index.js     ← Vigila campañas cada 4h, pausa/escala auto
│
├── reporting/
│   └── index.js                ← Métricas, funnel, CAC, revenue
│
├── financial_control/
│   └── index.js                ← Validaciones de presupuesto y límites
│
├── orchestrator/
│   └── index.js                ← Arranca servidor, webhook, scheduler, valida token
│
├── jobs/
│   └── scheduler.js            ← Cron: token-check (00h), analista (8h), supervisor (4h)
│
├── server/
│   ├── app.js                  ← Express + rutas
│   ├── middleware/
│   │   └── rate-limiter.js
│   └── routes/
│       ├── leads.js            ← POST /api/lead
│       ├── sales.js            ← POST /api/venta
│       ├── webhooks.js         ← /api/meta/webhook, /api/vapi/webhook, /telegram/webhook
│       └── health.js           ← GET /api/ping
│
├── sandbox/
│   └── index.js                ← Experimentos locales sin afectar producción
│
│── Agentes Futuros (estructurados, pendientes de implementación):
├── market_research_agent/      ← Detecta oportunidades de mercado
├── validation_agent/           ← Testea ideas con micro-presupuesto
├── scaling_agent/              ← Replica lo que funciona gradualmente
└── product_engine/             ← Crea y gestiona productos/servicios replicables
```

---

## Flujo Principal de Datos

```
Cliente llena formulario
         ↓
POST /api/lead (o webhook Meta Lead Ads)
         ↓
lead_system/capture.js
  → scoring (CALIENTE/TIBIO/FRIO)
  → memory/leads.db (persistir)
  → CAPI evento Lead → Meta
  → Telegram notificación
  → call_agent/caller (delay 5 min)
         ↓
Sofía llama al lead (VAPI)
         ↓
POST /api/vapi/webhook (resultado)
  → call_agent/webhook-handler
  → memory/calls.db (persistir)
  → Si cita: memory/leads.db actualiza
  → Telegram: botón WhatsApp confirmación
         ↓
Jorge/Eduardo atienden en cita
         ↓
POST /api/venta (registrar cierre)
  → memory/conversions.db
  → CAPI evento Purchase → Meta
  → Telegram: reporte de venta
```

---

## Ciclo de Agentes (Automático)

```
8:00 AM ET → Analista
  → Métricas 7 días de todas las campañas
  → Claude analiza + genera plan JSON
  → Telegram: plan con botones [Aprobar/Ignorar]
  → 2 min después: Ana llama a Eduardo

Ana (llamada VAPI)
  → Briefing del plan en voz
  → Eduardo aprueba o rechaza
  → Webhook → ejecutar o descartar

Ejecutor (cuando se aprueba)
  → Pausar campañas malas
  → Escalar campañas buenas
  → Crear campañas nuevas

Cada 4h → Supervisor
  → Gasto >= $4 sin leads → PAUSA automático
  → CPL < $5 → ESCALA 20%
  → Escala grande → consulta a Eduardo
```

---

## Cómo Agregar un Nuevo Agente

1. Crear carpeta `agents/nuevo_agente/`
2. Crear `index.js` con función `export async function ejecutar()`
3. Importar conectores necesarios desde `connectors/`
4. Leer/escribir datos desde `memory/`
5. Registrar en `jobs/scheduler.js` si debe correr automáticamente
6. Agregar comando `/nuevo_agente` en `server/routes/webhooks.js`

---

## Cómo Clonar para Otro Nicho

1. Copiar toda la carpeta `next_system_core/`
2. Cambiar `config/business.config.js`: nombre del negocio, ciudad, producto
3. Reemplazar `ads_engine/segments.config.js`: segmentos del nuevo nicho
4. Actualizar `call_agent/sofia.config.js`: prompt adaptado al nicho
5. Configurar nuevo `.env` con las credenciales del cliente
6. Deploy en Railway con nuevo servicio

El 80% del código es reutilizable entre nichos. Solo cambian configs y prompts.

---

## Variables de Entorno Requeridas

Ver `.env.example` para la lista completa.

Las mínimas para funcionar:
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
- `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID`
- `VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID`
- `ANTHROPIC_API_KEY`

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Servidor | Node.js + Express |
| IA Decisiones | Anthropic Claude Sonnet 4.6 |
| IA Voz (leads) | VAPI + Cartesia + GPT-4o-mini |
| IA Voz (briefing) | VAPI + ElevenLabs + Claude |
| Transcripción | Deepgram Nova-2 |
| Imágenes | OpenAI DALL-E 3 |
| Anuncios | Meta Graph API v25.0 |
| Notificaciones | Telegram Bot API |
| Persistencia | JSON en /tmp (→ reemplazar por PostgreSQL) |
| Deploy | Railway |
| Scheduler | node-cron |
