// ════════════════════════════════════════════════════
// CONECTOR META — Wrapper de Meta Graph API v25.0
// Único punto de contacto con la API de Facebook/Instagram
// ════════════════════════════════════════════════════

import axios from 'axios';
import ENV from '../config/env.js';

const API_BASE = 'https://graph.facebook.com/v25.0';

// Token dinámico — se lee en cada llamada para no caducar en memoria
const token = () => ENV.META_TOKEN;

// Ad account siempre con prefijo act_ requerido por Meta API
export const adAccount = () => {
  const id = ENV.META_AD_ACCOUNT || '';
  return id.startsWith('act_') ? id : `act_${id}`;
};

export const MetaConnector = {

  async get(endpoint, params = {}) {
    const { data } = await axios.get(`${API_BASE}${endpoint}`, {
      params: { ...params, access_token: token() },
      timeout: 15000,
    });
    return data;
  },

  async post(endpoint, body = {}) {
    try {
      const { data } = await axios.post(
        `${API_BASE}${endpoint}`,
        { ...body, access_token: token() },
        { timeout: 15000 }
      );
      return data;
    } catch (err) {
      const metaError = err.response?.data?.error;
      if (metaError) {
        console.error(`[Meta] Error completo en ${endpoint}:`, JSON.stringify(metaError));
        const detalle = `Meta API ${err.response.status} — ${metaError.message} (code: ${metaError.code}, subcode: ${metaError.error_subcode || 'n/a'})${metaError.error_user_msg ? ` | ${metaError.error_user_msg}` : ''}`;
        throw new Error(detalle);
      }
      throw err;
    }
  },

  async postForm(endpoint, formData) {
    formData.append('access_token', token());
    const { data } = await axios.post(`${API_BASE}${endpoint}`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000,
    });
    return data;
  },

  // Validar token (llama a /me)
  async validarToken() {
    try {
      const data = await this.get('/me', { fields: 'id,name' });
      return { ok: true, id: data.id, nombre: data.name };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error?.message || err.message };
    }
  },

  // Obtener campañas activas de la cuenta
  async getCampanas(soloActivas = false) {
    const filter = soloActivas ? '&effective_status=["ACTIVE"]' : '';
    const data = await this.get(`/${adAccount()}/campaigns`, {
      fields:        'id,name,status,effective_status,daily_budget,lifetime_budget,start_time,created_time',
      limit:         50,
    });
    const campanas = data.data || [];
    return soloActivas
      ? campanas.filter(c => c.effective_status === 'ACTIVE')
      : campanas;
  },

  // Métricas de una campaña en un período
  async getMetricas(campanaId, datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        fields:      'spend,clicks,impressions,actions,cpm,ctr',
      });
      const row     = data.data?.[0] || {};
      const actions = row.actions || [];
      const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
      const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
      const spend   = parseFloat(row.spend || 0);
      // Conversiones reales = leads (lead gen) o visitas landing (tráfico)
      const conversiones = leads > 0 ? leads : visitas;
      return {
        spend,
        clicks:          parseInt(row.clicks     || 0),
        impressions:     parseInt(row.impressions || 0),
        leads,
        visitas_landing: visitas,
        conversiones,
        cpl:             conversiones > 0 ? +(spend / conversiones).toFixed(2) : null,
        cpm:             parseFloat(row.cpm || 0),
        ctr:             parseFloat(row.ctr || 0),
      };
    } catch {
      return { spend: 0, clicks: 0, impressions: 0, leads: 0, cpl: null, cpm: 0, ctr: 0 };
    }
  },

  // Enviar evento a Conversions API (CAPI)
  async enviarEventoCAPI(evento) {
    const { nombre_evento, email, telefono, valor, moneda = 'USD', event_id } = evento;
    const ts = Math.floor(Date.now() / 1000);

    const userData = {};
    if (email)    userData.em    = [email.toLowerCase().trim()];
    if (telefono) userData.ph    = [telefono.replace(/\D/g, '')];

    const eventData = {
      event_name:       nombre_evento,
      event_time:       ts,
      event_source_url: `https://${ENV.RAILWAY_DOMAIN || 'nexuslabs.com'}`,
      action_source:    'website',
      user_data:        userData,
      ...(event_id && { event_id }),
      ...(valor && { custom_data: { value: valor, currency: moneda } }),
    };

    return this.post(`/${ENV.META_PIXEL_ID}/events`, { data: [eventData] });
  },
};

export default MetaConnector;
