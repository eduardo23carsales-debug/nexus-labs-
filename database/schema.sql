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
