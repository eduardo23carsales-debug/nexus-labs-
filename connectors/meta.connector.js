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

  // Obtener anuncios activos con su creative (copy + imagen)
  async getAnuncios(soloActivos = true) {
    try {
      const statusFilter = soloActivos ? ['ACTIVE'] : ['ACTIVE', 'PAUSED'];
      const data = await this.get(`/${adAccount()}/ads`, {
        fields:           'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,body,title,image_url,thumbnail_url,object_story_spec,link_url}',
        effective_status: JSON.stringify(statusFilter),
        limit:            25,
      });
      return (data.data || []).map(ad => {
        const spec = ad.creative?.object_story_spec?.link_data || {};
        return {
          id:          ad.id,
          nombre:      ad.name,
          estado:      ad.effective_status,
          campaña_id:  ad.campaign_id,
          adset_id:    ad.adset_id,
          copy:        ad.creative?.body || spec.message || '—',
          titulo:      ad.creative?.title || spec.name || '—',
          imagen_url:  ad.creative?.image_url || ad.creative?.thumbnail_url || null,
          url_destino: ad.creative?.link_url || spec.link || null,
        };
      });
    } catch (err) {
      console.warn('[Meta] Error obteniendo anuncios:', err.message);
      return [];
    }
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

  // ── MÉTRICAS PROFUNDAS ─────────────────────────────

  // Métricas de TODAS las campañas en un solo request — para visión global
  async getMetricasTodasCampanas(datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${adAccount()}/insights`, {
        date_preset: datePreset,
        level:       'campaign',
        fields:      'campaign_id,campaign_name,spend,clicks,impressions,reach,frequency,actions,cpm,ctr,cpp',
        limit:       50,
      });
      return (data.data || []).map(row => {
        const actions      = row.actions || [];
        const leads        = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
        const compras      = parseInt(actions.find(a => a.action_type === 'purchase')?.value || 0);
        const visitas      = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
        const conversiones = leads > 0 ? leads : visitas;
        const spend        = parseFloat(row.spend || 0);
        return {
          campana_id:   row.campaign_id,
          campana_nombre: row.campaign_name,
          spend,
          clicks:       parseInt(row.clicks || 0),
          impressions:  parseInt(row.impressions || 0),
          reach:        parseInt(row.reach || 0),
          frequency:    parseFloat(row.frequency || 0),
          leads,
          compras,
          visitas_landing: visitas,
          conversiones,
          cpl:          conversiones > 0 ? +(spend / conversiones).toFixed(2) : null,
          cpa:          compras > 0 ? +(spend / compras).toFixed(2) : null,
          cpm:          parseFloat(row.cpm || 0),
          ctr:          parseFloat(row.ctr || 0),
          cpp:          parseFloat(row.cpp || 0),
        };
      });
    } catch (err) {
      console.warn('[Meta] Error getMetricasTodasCampanas:', err.message);
      return [];
    }
  },

  // Métricas de todos los AdSets de una campaña — qué segmento de audiencia convierte
  async getAdSetsConMetricas(campanaId, datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${campanaId}/adsets`, {
        fields: 'id,name,status,effective_status,daily_budget,targeting,optimization_goal',
        limit:  25,
      });
      const adsets = data.data || [];
      if (!adsets.length) return [];

      const insightsData = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        level:       'adset',
        fields:      'adset_id,adset_name,spend,clicks,impressions,reach,frequency,actions,cpm,ctr',
        limit:       25,
      });
      const insightsPorId = {};
      for (const row of insightsData.data || []) {
        const actions = row.actions || [];
        const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
        const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
        const compras = parseInt(actions.find(a => a.action_type === 'purchase')?.value || 0);
        const conv    = leads > 0 ? leads : visitas;
        const spend   = parseFloat(row.spend || 0);
        insightsPorId[row.adset_id] = {
          spend, leads, compras, visitas_landing: visitas, conversiones: conv,
          clicks:      parseInt(row.clicks || 0),
          impressions: parseInt(row.impressions || 0),
          reach:       parseInt(row.reach || 0),
          frequency:   parseFloat(row.frequency || 0),
          cpl:         conv > 0 ? +(spend / conv).toFixed(2) : null,
          cpm:         parseFloat(row.cpm || 0),
          ctr:         parseFloat(row.ctr || 0),
        };
      }

      return adsets.map(a => ({
        id:      a.id,
        nombre:  a.name,
        estado:  a.effective_status,
        presupuesto_dia: parseFloat(a.daily_budget || 0) / 100,
        ...(insightsPorId[a.id] || { spend: 0, leads: 0, compras: 0, conversiones: 0, cpl: null }),
      }));
    } catch (err) {
      console.warn('[Meta] Error getAdSetsConMetricas:', err.message);
      return [];
    }
  },

  // Métricas de cada anuncio individual — qué creativo (copy+imagen) gana
  async getAnunciosConMetricas(campanaId, datePreset = 'last_7d') {
    try {
      const insightsData = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        level:       'ad',
        fields:      'ad_id,ad_name,spend,clicks,impressions,reach,actions,cpm,ctr',
        limit:       50,
      });
      return (insightsData.data || []).map(row => {
        const actions = row.actions || [];
        const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
        const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
        const compras = parseInt(actions.find(a => a.action_type === 'purchase')?.value || 0);
        const conv    = leads > 0 ? leads : visitas;
        const spend   = parseFloat(row.spend || 0);
        return {
          ad_id:       row.ad_id,
          ad_nombre:   row.ad_name,
          spend,
          leads, compras, visitas_landing: visitas, conversiones: conv,
          clicks:      parseInt(row.clicks || 0),
          impressions: parseInt(row.impressions || 0),
          reach:       parseInt(row.reach || 0),
          cpl:         conv > 0 ? +(spend / conv).toFixed(2) : null,
          cpm:         parseFloat(row.cpm || 0),
          ctr:         parseFloat(row.ctr || 0),
        };
      });
    } catch (err) {
      console.warn('[Meta] Error getAnunciosConMetricas:', err.message);
      return [];
    }
  },

  // Breakdown demográfico: qué edad y género convierte mejor
  async getBreakdownDemografico(campanaId, datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        fields:      'spend,clicks,impressions,actions,ctr',
        breakdowns:  'age,gender',
        limit:       50,
      });
      return (data.data || []).map(row => {
        const actions = row.actions || [];
        const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
        const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
        const conv    = leads > 0 ? leads : visitas;
        const spend   = parseFloat(row.spend || 0);
        return {
          edad:        row.age,
          genero:      row.gender,
          spend,
          leads, visitas_landing: visitas, conversiones: conv,
          clicks:      parseInt(row.clicks || 0),
          impressions: parseInt(row.impressions || 0),
          cpl:         conv > 0 ? +(spend / conv).toFixed(2) : null,
          ctr:         parseFloat(row.ctr || 0),
        };
      });
    } catch (err) {
      console.warn('[Meta] Error getBreakdownDemografico:', err.message);
      return [];
    }
  },

  // Breakdown por placement: Facebook Feed vs Instagram vs Reels vs Stories
  async getBreakdownPlacement(campanaId, datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        fields:      'spend,clicks,impressions,actions,ctr,cpm',
        breakdowns:  'publisher_platform,platform_position',
        limit:       50,
      });
      return (data.data || []).map(row => {
        const actions = row.actions || [];
        const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
        const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
        const conv    = leads > 0 ? leads : visitas;
        const spend   = parseFloat(row.spend || 0);
        return {
          plataforma: row.publisher_platform,
          posicion:   row.platform_position,
          spend,
          leads, visitas_landing: visitas, conversiones: conv,
          clicks:     parseInt(row.clicks || 0),
          impressions:parseInt(row.impressions || 0),
          cpl:        conv > 0 ? +(spend / conv).toFixed(2) : null,
          ctr:        parseFloat(row.ctr || 0),
          cpm:        parseFloat(row.cpm || 0),
        };
      });
    } catch (err) {
      console.warn('[Meta] Error getBreakdownPlacement:', err.message);
      return [];
    }
  },

  // Frecuencia y alcance — detectar fatiga del anuncio
  async getFrecuenciaYAlcance(campanaId, datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        fields:      'spend,impressions,reach,frequency,unique_clicks,actions',
      });
      const row     = data.data?.[0] || {};
      const actions = row.actions || [];
      const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
      const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
      const conv    = leads > 0 ? leads : visitas;
      const spend   = parseFloat(row.spend || 0);
      const freq    = parseFloat(row.frequency || 0);
      return {
        spend,
        impressions:     parseInt(row.impressions || 0),
        reach:           parseInt(row.reach || 0),
        frequency:       freq,
        unique_clicks:   parseInt(row.unique_clicks || 0),
        leads, visitas_landing: visitas, conversiones: conv,
        cpl:             conv > 0 ? +(spend / conv).toFixed(2) : null,
        alerta_fatiga:   freq >= 3.5,
        nivel_fatiga:    freq < 2 ? 'fresco' : freq < 3.5 ? 'normal' : freq < 5 ? 'fatiga_moderada' : 'fatiga_critica',
      };
    } catch (err) {
      console.warn('[Meta] Error getFrecuenciaYAlcance:', err.message);
      return null;
    }
  },

  // Resumen de cuenta completo — visión general del ad account
  async getInsightsCuenta(datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${adAccount()}/insights`, {
        date_preset: datePreset,
        fields:      'spend,clicks,impressions,reach,actions,cpm,ctr',
      });
      const row     = data.data?.[0] || {};
      const actions = row.actions || [];
      const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
      const compras = parseInt(actions.find(a => a.action_type === 'purchase')?.value || 0);
      const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
      const conv    = leads > 0 ? leads : visitas;
      const spend   = parseFloat(row.spend || 0);
      return {
        spend,
        clicks:      parseInt(row.clicks || 0),
        impressions: parseInt(row.impressions || 0),
        reach:       parseInt(row.reach || 0),
        leads, compras, visitas_landing: visitas, conversiones: conv,
        cpl:         conv > 0 ? +(spend / conv).toFixed(2) : null,
        cpa:         compras > 0 ? +(spend / compras).toFixed(2) : null,
        cpm:         parseFloat(row.cpm || 0),
        ctr:         parseFloat(row.ctr || 0),
      };
    } catch (err) {
      console.warn('[Meta] Error getInsightsCuenta:', err.message);
      return null;
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
