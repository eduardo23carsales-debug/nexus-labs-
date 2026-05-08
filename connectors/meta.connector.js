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

  // ── BIBLIOTECA DE CREATIVOS ────────────────────────

  // Biblioteca de videos subidos a la cuenta de Meta
  async getVideoLibrary(limite = 25) {
    try {
      const data = await this.get(`/${adAccount()}/advideos`, {
        fields: 'id,title,description,length,picture,created_time,status',
        limit:  limite,
      });
      return (data.data || []).map(v => ({
        id:          v.id,
        titulo:      v.title || '(sin título)',
        descripcion: v.description || '',
        duracion_s:  v.length || 0,
        thumbnail:   v.picture || null,
        estado:      v.status?.processing_progress === 100 ? 'listo' : 'procesando',
        creado_en:   v.created_time,
      }));
    } catch (err) {
      console.warn('[Meta] Error getVideoLibrary:', err.message);
      return [];
    }
  },

  // Biblioteca de imágenes subidas a la cuenta
  async getImageLibrary(limite = 25) {
    try {
      const data = await this.get(`/${adAccount()}/adimages`, {
        fields: 'hash,name,url,width,height,created_time,status',
        limit:  limite,
      });
      return (data.data || []).map(img => ({
        hash:      img.hash,
        nombre:    img.name || '(sin nombre)',
        url:       img.url,
        ancho:     img.width,
        alto:      img.height,
        estado:    img.status || 'active',
        creado_en: img.created_time,
      }));
    } catch (err) {
      console.warn('[Meta] Error getImageLibrary:', err.message);
      return [];
    }
  },

  // Métricas específicas de video: vistas 3s, tasa completado, ThruPlay, etc.
  async getMetricasVideo(campanaId, datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        level:       'ad',
        fields: [
          'ad_id,ad_name,spend,impressions,reach',
          'video_play_actions',
          'video_avg_time_watched_actions',
          'video_p25_watched_actions',
          'video_p50_watched_actions',
          'video_p75_watched_actions',
          'video_p100_watched_actions',
          'video_thruplay_watched_actions',
        ].join(','),
        limit: 50,
      });

      const val = (actions, type) =>
        parseInt(actions?.find(a => a.action_type === type)?.value || 0);

      return (data.data || []).map(row => {
        const plays      = val(row.video_play_actions, 'video_view');
        const thruplay   = val(row.video_thruplay_watched_actions, 'video_view');
        const p25        = val(row.video_p25_watched_actions, 'video_view');
        const p50        = val(row.video_p50_watched_actions, 'video_view');
        const p75        = val(row.video_p75_watched_actions, 'video_view');
        const p100       = val(row.video_p100_watched_actions, 'video_view');
        const spend      = parseFloat(row.spend || 0);
        return {
          ad_id:              row.ad_id,
          ad_nombre:          row.ad_name,
          spend,
          impressions:        parseInt(row.impressions || 0),
          reach:              parseInt(row.reach || 0),
          vistas_3s:          plays,
          thruplay,
          p25, p50, p75, p100,
          tasa_completado:    plays > 0 ? +((p100 / plays) * 100).toFixed(1) : 0,
          tasa_p50:           plays > 0 ? +((p50 / plays) * 100).toFixed(1) : 0,
          costo_por_vista:    plays > 0 ? +(spend / plays).toFixed(3) : null,
          costo_thruplay:     thruplay > 0 ? +(spend / thruplay).toFixed(2) : null,
        };
      });
    } catch (err) {
      console.warn('[Meta] Error getMetricasVideo:', err.message);
      return [];
    }
  },

  // ── AUDIENCIAS ──────────────────────────────────────

  // Listar audiencias personalizadas de la cuenta
  async getAudiencias() {
    try {
      const data = await this.get(`/${adAccount()}/customaudiences`, {
        fields: 'id,name,description,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,time_created',
        limit:  50,
      });
      return (data.data || []).map(a => ({
        id:          a.id,
        nombre:      a.name,
        tipo:        a.subtype,
        descripcion: a.description || '',
        tamano_min:  a.approximate_count_lower_bound || 0,
        tamano_max:  a.approximate_count_upper_bound || 0,
        estado:      a.delivery_status?.code === 200 ? 'lista' : a.operation_status?.status || 'procesando',
        creada_en:   a.time_created,
      }));
    } catch (err) {
      console.warn('[Meta] Error getAudiencias:', err.message);
      return [];
    }
  },

  // Crear audiencia lookalike desde una fuente (compradores, leads, etc.)
  async crearLookalike({ sourceAudienceId, pais = 'US', ratio = 0.01, nombre }) {
    try {
      const data = await this.post(`/${adAccount()}/customaudiences`, {
        name:              nombre || `Lookalike ${ratio * 100}% — ${new Date().toLocaleDateString()}`,
        subtype:           'LOOKALIKE',
        origin_audience_id: sourceAudienceId,
        lookalike_spec:    JSON.stringify({
          type:    'custom_ratio',
          ratio:   ratio,
          country: pais,
        }),
      });
      return { ok: true, id: data.id, nombre: data.name };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // Crear audiencia de retargeting (visitantes del píxel en X días)
  async crearAudienciaRetargeting({ dias = 30, nombre, pixelId }) {
    try {
      const pid = pixelId || ENV.META_PIXEL_ID;
      const data = await this.post(`/${adAccount()}/customaudiences`, {
        name:             nombre || `Retargeting visitantes ${dias}d — ${new Date().toLocaleDateString()}`,
        subtype:          'WEBSITE',
        retention_days:   dias,
        rule:             JSON.stringify({
          inclusions: {
            operator: 'or',
            rules: [{
              event_sources: [{ id: pid, type: 'pixel' }],
              retention_seconds: dias * 86400,
              filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'ViewContent' }] },
            }],
          },
        }),
      });
      return { ok: true, id: data.id, nombre: data.name };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // ── ESCALADO INTELIGENTE ────────────────────────────

  // Duplicar un adset ganador con nuevo presupuesto
  async duplicarAdSet(adsetId, nuevoPResupuesto) {
    try {
      const data = await this.post(`/${adsetId}/copies`, {
        campaign_id:  null,
        deep_copy:    true,
        daily_budget: Math.round(nuevoPResupuesto * 100),
        status_option: 'ACTIVE',
      });
      return { ok: true, nuevo_id: data.copied_adset_id || data.id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // Breakdown geográfico — qué estado o región convierte mejor
  async getBreakdownGeografico(campanaId, datePreset = 'last_7d') {
    try {
      const data = await this.get(`/${campanaId}/insights`, {
        date_preset: datePreset,
        fields:      'spend,clicks,impressions,actions,ctr',
        breakdowns:  'region',
        limit:       50,
      });
      return (data.data || []).map(row => {
        const actions = row.actions || [];
        const leads   = parseInt(actions.find(a => a.action_type === 'lead')?.value || 0);
        const visitas = parseInt(actions.find(a => a.action_type === 'landing_page_view')?.value || 0);
        const compras = parseInt(actions.find(a => a.action_type === 'purchase')?.value || 0);
        const conv    = leads > 0 ? leads : (compras > 0 ? compras : visitas);
        const spend   = parseFloat(row.spend || 0);
        return {
          region:      row.region,
          spend,
          leads, compras, visitas_landing: visitas, conversiones: conv,
          clicks:      parseInt(row.clicks || 0),
          impressions: parseInt(row.impressions || 0),
          cpl:         conv > 0 ? +(spend / conv).toFixed(2) : null,
          ctr:         parseFloat(row.ctr || 0),
        };
      });
    } catch (err) {
      console.warn('[Meta] Error getBreakdownGeografico:', err.message);
      return [];
    }
  },

  // Comparar dos períodos — tendencia CPL, spend, leads
  async compararPeriodos(campanaId, preset1 = 'last_7d', preset2 = 'last_14d') {
    try {
      const [p1, p2] = await Promise.all([
        this.getMetricas(campanaId, preset1),
        this.getMetricas(campanaId, preset2),
      ]);
      const delta = (a, b) => b > 0 ? +(((a - b) / b) * 100).toFixed(1) : null;
      return {
        periodo_reciente:  { preset: preset1, ...p1 },
        periodo_anterior:  { preset: preset2, ...p2 },
        cambio_spend_pct:  delta(p1.spend, p2.spend),
        cambio_cpl_pct:    p1.cpl && p2.cpl ? delta(p1.cpl, p2.cpl) : null,
        cambio_leads_pct:  delta(p1.leads, p2.leads),
        cambio_ctr_pct:    delta(p1.ctr, p2.ctr),
        tendencia:         p1.cpl && p2.cpl
          ? (p1.cpl < p2.cpl ? 'mejorando' : p1.cpl > p2.cpl ? 'empeorando' : 'estable')
          : 'sin_datos',
      };
    } catch (err) {
      console.warn('[Meta] Error compararPeriodos:', err.message);
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
