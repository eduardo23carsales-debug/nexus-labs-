-- ════════════════════════════════════════════════════
-- SCHEMA — next-system-core
-- Ejecutar con: node database/migrate.js
-- Todas las tablas usan IF NOT EXISTS → idempotente
-- ════════════════════════════════════════════════════

-- ── LEADS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  telefono        VARCHAR(20)  PRIMARY KEY,          -- dígitos limpios
  nombre          VARCHAR(255),
  segmento        VARCHAR(50),
  score           VARCHAR(20)  NOT NULL DEFAULT 'FRIO',
  estado          VARCHAR(30)  NOT NULL DEFAULT 'NUEVO',
  fuente          VARCHAR(50)  NOT NULL DEFAULT 'web',
  dia_cita        VARCHAR(50),
  hora_cita       VARCHAR(50),
  cita_en         TIMESTAMPTZ,
  cerrado_en      TIMESTAMPTZ,
  valor_venta     NUMERIC(12,2),
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_estado    ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_segmento  ON leads(segmento);
CREATE INDEX IF NOT EXISTS idx_leads_score     ON leads(score);

-- ── LLAMADAS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id          SERIAL       PRIMARY KEY,
  call_id     VARCHAR(100),
  nombre      VARCHAR(255),
  telefono    VARCHAR(20),
  estado      VARCHAR(50),
  razon_fin   VARCHAR(100),
  duracion_s  INTEGER,
  cita        BOOLEAN      NOT NULL DEFAULT FALSE,
  dia_cita    VARCHAR(50),
  hora_cita   VARCHAR(50),
  resumen     TEXT,
  llamada_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_telefono   ON calls(telefono);
CREATE INDEX IF NOT EXISTS idx_calls_llamada_en ON calls(llamada_en DESC);
CREATE INDEX IF NOT EXISTS idx_calls_cita       ON calls(cita);

-- ── PLANES DEL ANALISTA ─────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id           SERIAL      PRIMARY KEY,
  plan         JSONB       NOT NULL,
  ejecutado    BOOLEAN     NOT NULL DEFAULT FALSE,
  ejecutado_en TIMESTAMPTZ,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CAMPAÑAS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id     VARCHAR(100) PRIMARY KEY,
  segmento        VARCHAR(50),
  ultima_accion   JSONB,
  historial       JSONB        NOT NULL DEFAULT '[]',
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── CONVERSIONES / VENTAS ──────────────────────────
CREATE TABLE IF NOT EXISTS conversions (
  id             SERIAL      PRIMARY KEY,
  telefono       VARCHAR(20),
  nombre         VARCHAR(255),
  segmento       VARCHAR(50),
  valor          NUMERIC(12,2) NOT NULL DEFAULT 0,
  gasto_campana  NUMERIC(12,2) NOT NULL DEFAULT 0,
  cac            NUMERIC(12,2),
  fecha          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversions_fecha    ON conversions(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_conversions_segmento ON conversions(segmento);

-- ── CRM — CLIENTES ─────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  telefono        VARCHAR(20)  PRIMARY KEY,
  client_id       VARCHAR(50)  UNIQUE,
  nombre          VARCHAR(255),
  email           VARCHAR(255),
  nicho           VARCHAR(50)  NOT NULL DEFAULT 'general',
  estado          VARCHAR(30)  NOT NULL DEFAULT 'NUEVO',
  datos_producto  JSONB        NOT NULL DEFAULT '{}',
  historial       JSONB        NOT NULL DEFAULT '[]',
  proxima_accion  TIMESTAMPTZ,
  notas           TEXT         NOT NULL DEFAULT '',
  etiquetas       JSONB        NOT NULL DEFAULT '[]',
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_nicho  ON clients(nicho);
CREATE INDEX IF NOT EXISTS idx_clients_estado ON clients(estado);
CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients(nombre);

-- ── CRM — SEGUIMIENTOS ──────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id                VARCHAR(50)  PRIMARY KEY,
  telefono          VARCHAR(20),
  nombre            VARCHAR(255),
  nicho             VARCHAR(50),
  motivo            TEXT,
  accion            VARCHAR(30)  NOT NULL DEFAULT 'llamar',
  fecha_programada  TIMESTAMPTZ,
  completado        BOOLEAN      NOT NULL DEFAULT FALSE,
  completado_en     TIMESTAMPTZ,
  creado_en         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_fecha      ON follow_ups(fecha_programada);
CREATE INDEX IF NOT EXISTS idx_followups_completado ON follow_ups(completado);

-- ── CONVERSACIONES JARVIS ───────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  chat_id          VARCHAR(50)  PRIMARY KEY,
  messages         JSONB        NOT NULL DEFAULT '[]',
  ultima_actividad TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── MEMORIA PERSISTENTE DE JARVIS ───────────────────
CREATE TABLE IF NOT EXISTS jarvis_memory (
  id          SERIAL        PRIMARY KEY,
  tipo        VARCHAR(30)   NOT NULL DEFAULT 'hecho',  -- hecho | preferencia | instruccion | objetivo | aprendizaje | proyecto | cliente | alerta
  titulo      VARCHAR(255)  NOT NULL,
  contenido   TEXT          NOT NULL,
  importancia SMALLINT      NOT NULL DEFAULT 5,         -- 1 (baja) a 10 (crítica)
  activa      BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jarvis_memory_tipo      ON jarvis_memory(tipo);
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_activa    ON jarvis_memory(activa);
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_importancia ON jarvis_memory(importancia DESC);

-- ── MEMORIA DE PRODUCTOS DIGITALES ─────────────────
CREATE TABLE IF NOT EXISTS product_memory (
  id         SERIAL      PRIMARY KEY,
  tipo       VARCHAR(20) NOT NULL DEFAULT 'patron',  -- patron | aprendizaje | regla | insight
  categoria  VARCHAR(50) NOT NULL DEFAULT 'digital',
  contenido  TEXT        NOT NULL,
  confianza  NUMERIC(3,2) DEFAULT 0.7,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_memory_categoria ON product_memory(categoria);
CREATE INDEX IF NOT EXISTS idx_product_memory_tipo      ON product_memory(tipo);

-- ── EXPERIMENTOS DE PRODUCTOS DIGITALES ─────────────
CREATE TABLE IF NOT EXISTS experiments (
  id                  SERIAL        PRIMARY KEY,
  nicho               VARCHAR(255)  NOT NULL,
  nombre              VARCHAR(255)  NOT NULL,
  tipo                VARCHAR(30)   NOT NULL,  -- prompts|plantilla|guia_pdf|mini_curso|toolkit
  precio              NUMERIC(10,2) NOT NULL,
  estado              VARCHAR(20)   NOT NULL DEFAULT 'activo',  -- activo|escalado|muerto|extendido
  hotmart_id          VARCHAR(100),
  hotmart_url         TEXT,
  producto_url        TEXT,
  contenido_producto  TEXT,
  metricas            JSONB         NOT NULL DEFAULT '{}',
  notas               TEXT,
  creado_en           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS stripe_product_id  VARCHAR(100);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS stripe_price_id     VARCHAR(100);
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS landing_slug        VARCHAR(150) UNIQUE;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS landing_html        TEXT;

CREATE INDEX IF NOT EXISTS idx_experiments_estado    ON experiments(estado);
CREATE INDEX IF NOT EXISTS idx_experiments_creado_en ON experiments(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_slug      ON experiments(landing_slug);

-- ── COMPRADORES (post-pago Stripe) ─────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              SERIAL        PRIMARY KEY,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  nombre          VARCHAR(255),
  experiment_id   INTEGER       REFERENCES experiments(id),
  producto        VARCHAR(255),
  revenue         NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(100),
  stripe_payment_id  VARCHAR(100),
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email         ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_experiment_id ON customers(experiment_id);

-- ── PORTAFOLIO DE PROYECTOS ────────────────────────
-- Backbone central: cada iniciativa de negocio vive aquí.
-- Estado: idea → validando → testing → rentable → escalando | pausado | muerto
CREATE TABLE IF NOT EXISTS projects (
  id              SERIAL        PRIMARY KEY,
  nombre          TEXT          NOT NULL,
  nicho           TEXT          NOT NULL DEFAULT 'general',
  tipo            TEXT          NOT NULL DEFAULT 'digital',     -- digital | automotriz | servicio | cliente | campana
  estado          TEXT          NOT NULL DEFAULT 'idea',        -- state machine
  descripcion     TEXT,
  objetivo        TEXT,
  inversion       NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenue         NUMERIC(10,2) NOT NULL DEFAULT 0,
  roi             NUMERIC(8,2),
  leads           INTEGER       NOT NULL DEFAULT 0,
  ventas          INTEGER       NOT NULL DEFAULT 0,
  llamadas        INTEGER       NOT NULL DEFAULT 0,
  experiment_id   INTEGER       REFERENCES experiments(id),
  campaign_ids    JSONB         NOT NULL DEFAULT '[]',
  historial       JSONB         NOT NULL DEFAULT '[]',  -- [{fecha, agente, accion, detalle}]
  alertas         JSONB         NOT NULL DEFAULT '[]',  -- [{tipo, mensaje, fecha}]
  notas           TEXT,
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_estado        ON projects(estado);
CREATE INDEX IF NOT EXISTS idx_projects_nicho         ON projects(nicho);
CREATE INDEX IF NOT EXISTS idx_projects_actualizado   ON projects(actualizado_en DESC);
CREATE INDEX IF NOT EXISTS idx_projects_experiment_id ON projects(experiment_id);

-- ── SECUENCIAS DE EMAIL (abandono + post-compra) ────
CREATE TABLE IF NOT EXISTS email_sequences (
  id            SERIAL       PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  experiment_id INTEGER      REFERENCES experiments(id),
  fuente        VARCHAR(30)  NOT NULL,   -- abandono_1|abandono_2|seq_d1|seq_d3|seq_d7|seq_d14
  enviado_en    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(email, fuente)
);

-- ── CONTACTOS — Lista de emails propios ─────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          SERIAL        PRIMARY KEY,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  nombre      VARCHAR(255),
  telefono    VARCHAR(30),
  nicho       VARCHAR(50)   NOT NULL DEFAULT 'automotriz',
  datos       JSONB         NOT NULL DEFAULT '{}',  -- carro, año, modelo, etc.
  fuente      VARCHAR(100)  NOT NULL DEFAULT 'csv', -- csv, manual, web
  estado      VARCHAR(20)   NOT NULL DEFAULT 'activo', -- activo, baja, rebotado
  creado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_nicho   ON contacts(nicho);
CREATE INDEX IF NOT EXISTS idx_contacts_estado  ON contacts(estado);
CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts(email);

-- ── CAMPAÑAS DE EMAIL ────────────────────────────────
CREATE TABLE IF NOT EXISTS email_campaigns (
  id              SERIAL        PRIMARY KEY,
  nombre          VARCHAR(255)  NOT NULL,
  nicho           VARCHAR(50),
  experiment_id   INTEGER       REFERENCES experiments(id),
  asunto          TEXT          NOT NULL,
  cuerpo          TEXT          NOT NULL,
  total_enviados  INTEGER       NOT NULL DEFAULT 0,
  total_abiertos  INTEGER       NOT NULL DEFAULT 0,
  total_clicks    INTEGER       NOT NULL DEFAULT 0,
  total_bajas     INTEGER       NOT NULL DEFAULT 0,
  estado          VARCHAR(20)   NOT NULL DEFAULT 'enviada',
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── TRACKING DE EMAILS ───────────────────────────────
CREATE TABLE IF NOT EXISTS email_tracking (
  id           SERIAL        PRIMARY KEY,
  campaign_id  INTEGER       REFERENCES email_campaigns(id),
  email        VARCHAR(255)  NOT NULL,
  evento       VARCHAR(20)   NOT NULL, -- abierto | click | baja
  url          TEXT,
  registrado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign ON email_tracking(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_email    ON email_tracking(email);


-- ── APRENDIZAJES DEL SISTEMA ───────────────────────────
-- El negocio que nunca comete el mismo error dos veces
CREATE TABLE IF NOT EXISTS learnings (
  id          SERIAL        PRIMARY KEY,
  tipo        VARCHAR(30)   NOT NULL,  -- campana | llamada | producto | copy | imagen | nicho | precio | email
  contexto    TEXT          NOT NULL,  -- situación específica donde ocurrió
  accion      TEXT          NOT NULL,  -- qué se hizo
  resultado   TEXT          NOT NULL,  -- qué pasó (métricas reales si aplica)
  exito       BOOLEAN       NOT NULL DEFAULT TRUE,
  hipotesis   TEXT,                    -- por qué funcionó o falló (razonamiento causal)
  tags        JSONB         NOT NULL DEFAULT '[]',  -- ['hispano', 'ciudadania', 'emocional']
  relevancia  SMALLINT      NOT NULL DEFAULT 5,     -- 1 (baja) a 10 (crítica)
  creado_en   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learnings_tipo      ON learnings(tipo);
CREATE INDEX IF NOT EXISTS idx_learnings_exito     ON learnings(exito);
CREATE INDEX IF NOT EXISTS idx_learnings_relevancia ON learnings(relevancia DESC);
CREATE INDEX IF NOT EXISTS idx_learnings_creado_en ON learnings(creado_en DESC);

-- ── UPSELLS POST-COMPRA ──────────────────────────────
CREATE TABLE IF NOT EXISTS upsells (
  id                  SERIAL        PRIMARY KEY,
  customer_email      VARCHAR(255)  NOT NULL,
  experiment_id       INTEGER       REFERENCES experiments(id),
  upsell_experiment_id INTEGER      REFERENCES experiments(id),
  estado              VARCHAR(20)   NOT NULL DEFAULT 'pendiente',  -- pendiente | aceptado | rechazado | expirado
  stripe_payment_link TEXT,
  enviado_en          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  respondido_en       TIMESTAMPTZ,
  UNIQUE(customer_email, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_upsells_email  ON upsells(customer_email);
CREATE INDEX IF NOT EXISTS idx_upsells_estado ON upsells(estado);

-- ── CONFIGURACIÓN DEL SISTEMA ────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  clave          VARCHAR(100)  PRIMARY KEY,
  valor          TEXT          NOT NULL,
  descripcion    TEXT,
  actualizado_en TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Valores por defecto (INSERT ... ON CONFLICT DO NOTHING → no sobreescribe cambios)
INSERT INTO system_config (clave, valor, descripcion) VALUES
  ('presupuesto_max_dia',   '30',   'Gasto máximo diario en Meta Ads (USD)'),
  ('limite_escalar_solo',   '10',   'El Supervisor puede escalar solo hasta este monto extra (USD)'),
  ('limite_gasto_sin_lead', '4',    'Pausa campaña si gasta este monto sin generar leads (USD)'),
  ('max_escalar_pct',       '0.20', 'Máximo porcentaje de aumento de presupuesto por ciclo (0.20 = 20%)'),
  ('cpl_objetivo',          '5',    'CPL objetivo — por debajo de esto la campaña es buena (USD)')
ON CONFLICT (clave) DO NOTHING;
