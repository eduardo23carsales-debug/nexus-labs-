// ════════════════════════════════════════════════════
// CONFIG — Variables de entorno centralizadas
// Único lugar donde se leen las env vars del sistema
// ════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

const required = (key) => {
  const val = process.env[key]?.trim();
  if (!val) throw new Error(`Variable de entorno requerida faltante: ${key}`);
  return val;
};

const optional = (key, fallback = '') => process.env[key]?.trim() || fallback;

export const ENV = {
  // Servidor
  PORT:                   parseInt(optional('PORT', '3001')),
  RAILWAY_DOMAIN:         optional('RAILWAY_PUBLIC_DOMAIN'),

  // Base de datos
  DATABASE_URL:           optional('DATABASE_URL'),

  // Telegram
  TELEGRAM_TOKEN:         optional('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_CHAT_ID:       optional('TELEGRAM_CHAT_ID'),

  // WhatsApp asesores
  WHATSAPP_EDUARDO:       optional('WHATSAPP_EDUARDO', '17869167339'),
  WHATSAPP_JORGE:         optional('WHATSAPP_JORGE',   '17865809908'),
  WHATSAPP_PRINCIPAL:     optional('WHATSAPP_PRINCIPAL', '17869167339'),

  // Meta Ads
  META_APP_ID:            optional('META_APP_ID'),
  META_APP_SECRET:        optional('META_APP_SECRET'),
  get META_TOKEN()        { return process.env.META_ACCESS_TOKEN?.trim() || ''; },
  META_AD_ACCOUNT:        optional('META_AD_ACCOUNT_ID'),
  META_PIXEL_ID:          optional('META_PIXEL_ID'),
  META_PAGE_ID:           optional('META_PAGE_ID'),
  META_WEBHOOK_TOKEN:     optional('META_WEBHOOK_TOKEN'),

  // VAPI
  VAPI_API_KEY:           optional('VAPI_API_KEY'),
  VAPI_PHONE_ID:          optional('VAPI_PHONE_NUMBER_ID'),

  // IA
  ANTHROPIC_API_KEY:      optional('ANTHROPIC_API_KEY'),
  OPENAI_API_KEY:         optional('OPENAI_API_KEY'),

  // Reglas de negocio
  PRESUPUESTO_MAX_DIA:    parseFloat(optional('PRESUPUESTO_MAX_DIA', '30')),
  LIMITE_ESCALAR_SOLO:    parseFloat(optional('LIMITE_ESCALAR_SOLO', '10')),
  LIMITE_GASTO_SIN_LEAD:  parseFloat(optional('LIMITE_GASTO_SIN_LEAD', '4')),
  VAPI_DELAY_MINUTOS:     parseInt(optional('VAPI_DELAY_MINUTOS', '5')),

  // Hotmart
  HOTMART_CLIENT_ID:      optional('HOTMART_CLIENT_ID'),
  HOTMART_CLIENT_SECRET:  optional('HOTMART_CLIENT_SECRET'),
  HOTMART_SANDBOX:        optional('HOTMART_ENV', 'false'),

  // Stripe
  STRIPE_SECRET_KEY:      optional('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET:  optional('STRIPE_WEBHOOK_SECRET'),

  // Resend (emails transaccionales)
  RESEND_API_KEY:         optional('RESEND_API_KEY'),
  EMAIL_FROM:             optional('EMAIL_FROM', 'onboarding@resend.dev'),
  EMAIL_FROM_NAME:        optional('EMAIL_FROM_NAME', 'Nexus Labs'),

  // Twilio
  TWILIO_ACCOUNT_SID:     optional('TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN:      optional('TWILIO_AUTH_TOKEN'),
  TWILIO_WHATSAPP_FROM:   optional('TWILIO_WHATSAPP_FROM'),

  // Seguridad
  DASHBOARD_SECRET:       optional('DASHBOARD_SECRET', 'changeme'),
};

export default ENV;
