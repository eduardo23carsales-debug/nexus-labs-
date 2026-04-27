// ════════════════════════════════════════════════════
// ADS ENGINE — Creador de campañas Meta Ads
// Crea campaña + adsets + creativos + formulario nativo
// ════════════════════════════════════════════════════

import axios      from 'axios';
import FormData   from 'form-data';
import fs         from 'fs';
import path       from 'path';
import { MetaConnector }   from '../connectors/meta.connector.js';
import { OpenAIConnector } from '../connectors/openai.connector.js';
import { SEGMENTOS }       from './segments.config.js';
import ENV from '../config/env.js';

// Targeting base para productos digitales: EEUU hispanohablante
const TARGETING_DIGITAL = {
  age_min: 22,
  age_max: 55,
  geo_locations:      { countries: ['US'] },
  locales:            [27],                      // Español
  device_platforms:   ['mobile', 'desktop'],
  facebook_positions: ['feed', 'story'],
  instagram_positions: ['stream', 'story'],
};

const ASSETS_DIR = path.resolve('assets');  // carpeta de fotos/videos locales

// ── Buscar asset local ────────────────────────────────
function buscarVideo(segmento) {
  const dir  = path.join(ASSETS_DIR, 'videos');
  if (!fs.existsSync(dir)) return null;
  const archivo = fs.readdirSync(dir).find(f => f.includes(segmento) && f.match(/\.(mp4|mov)$/i));
  return archivo ? path.join(dir, archivo) : null;
}

function buscarFoto(segmento) {
  const dir  = path.join(ASSETS_DIR, 'photos');
  if (!fs.existsSync(dir)) return null;
  const archivo = fs.readdirSync(dir).find(f => f.includes(segmento) && f.match(/\.(jpg|jpeg|png|webp)$/i));
  return archivo ? path.join(dir, archivo) : null;
}

// ── Subir foto local a Meta ──────────────────────────
async function subirFotoLocal(filePath) {
  const form = new FormData();
  form.append('filename', fs.createReadStream(filePath));
  const data = await MetaConnector.postForm(`/${ENV.META_AD_ACCOUNT}/adimages`, form);
  const hash = Object.values(data.images || {})[0]?.hash;
  if (!hash) throw new Error('Meta no retornó hash de imagen');
  return hash;
}

// ── Subir video local a Meta ─────────────────────────
async function subirVideoLocal(filePath) {
  const form = new FormData();
  form.append('source', fs.createReadStream(filePath));
  form.append('access_token', ENV.META_TOKEN);
  const { data } = await axios.post(
    `https://graph-video.facebook.com/v25.0/${ENV.META_AD_ACCOUNT}/advideos`,
    form,
    { headers: form.getHeaders(), timeout: 120000 }
  );
  if (!data.id) throw new Error('Meta no retornó ID de video');
  return data.id;
}

// ── Generar imagen con DALL-E y subirla ──────────────
export async function generarYSubirImagen(prompt) {
  const url  = await OpenAIConnector.generarImagen({ prompt });
  const resp = await axios.get(url, { responseType: 'arraybuffer' });
  const buf  = Buffer.from(resp.data);
  const tmp  = path.join('/tmp', `dalleimg_${Date.now()}.jpg`);
  fs.writeFileSync(tmp, buf);
  const hash = await subirFotoLocal(tmp);
  fs.unlinkSync(tmp);
  return { hash, url };
}

// ── Crear formulario nativo de Lead Ads ─────────────
async function crearFormulario(segmento) {
  const seg = SEGMENTOS[segmento];
  const nombre = `Nexus Labs —${seg.nombre} — ${Date.now()}`;

  const data = await MetaConnector.post(`/${ENV.META_PAGE_ID}/leadgen_forms`, {
    name: nombre,
    privacy_policy: { url: `https://${ENV.RAILWAY_DOMAIN || 'nexuslabs.com'}/privacidad`, link_text: 'Política de Privacidad' },
    questions: [
      { type: 'FULL_NAME' },
      { type: 'PHONE' },
      { type: 'EMAIL' },
      { key: 'experiencia', label: '¿Cuál es tu nivel de experiencia en negocios digitales?', type: 'CUSTOM',
        options: [
          { key: 'cero',        value: 'Estoy empezando desde cero' },
          { key: 'basico',      value: 'Tengo algo de experiencia' },
          { key: 'intermedio',  value: 'Ya vendo online, quiero escalar' },
          { key: 'avanzado',    value: 'Tengo un negocio digital activo' },
        ]
      },
      { key: 'objetivo', label: '¿Cuál es tu principal objetivo?', type: 'CUSTOM',
        options: [
          { key: 'ingresos_extra', value: 'Generar ingresos extra además de mi trabajo' },
          { key: 'reemplazar',     value: 'Reemplazar mi empleo con un negocio propio' },
          { key: 'escalar',        value: 'Escalar un negocio que ya tengo' },
          { key: 'aprender',       value: 'Aprender el sistema antes de decidir' },
        ]
      },
    ],
    thank_you_page: {
      title:    '¡Listo! Te contactamos en minutos',
      body:     'Eduardo te llamará personalmente para mostrarte cómo funciona el sistema.',
      button_text: 'Volver a Facebook',
    },
    locale:             'ES_LA',
    is_optimized_for_quality: true,
  });
  return data.id;
}

// ── CREAR CAMPAÑA COMPLETA ────────────────────────────
// imagenHash opcional: si se pasa, usa esa imagen en vez de buscar/generar una
export async function crearCampana(segmento, presupuestoDia, { imagenHash } = {}) {
  const seg = SEGMENTOS[segmento];
  if (!seg) throw new Error(`Segmento desconocido: ${segmento}`);

  // Verificar ad account antes de crear
  try {
    const acct = await MetaConnector.get(`/${ENV.META_AD_ACCOUNT}`, {
      fields: 'id,name,account_status,disable_reason,currency',
    });
    const STATUS = { 1: 'ACTIVA', 2: 'DESHABILITADA', 3: 'SIN_PAGO', 7: 'SIN_PAGO', 9: 'PENDIENTE_REVISION' };
    const estado = STATUS[acct.account_status] || `estado_${acct.account_status}`;
    console.log(`[AdsEngine] Cuenta "${acct.name}" — ${estado} (${acct.currency})`);
    if (acct.account_status !== 1) {
      throw new Error(`Ad account "${acct.name}" no está activa — estado: ${estado}. Verifica el método de pago en Meta Business Manager.`);
    }
  } catch (err) {
    if (err.message.includes('Ad account')) throw err;
    throw new Error(`No se pudo verificar el ad account ${ENV.META_AD_ACCOUNT}: ${err.message}`);
  }

  const ts     = Date.now();
  const nombre = `Nexus Labs —${seg.nombre} — ${new Date().toLocaleDateString('es-US')}`;

  // 1. Campaña
  const campana = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/campaigns`, {
    name:                              nombre,
    objective:                         'OUTCOME_LEADS',
    status:                            'PAUSED',
    special_ad_categories:             [],
    is_adset_budget_sharing_enabled:   false,
  });

  // 2. Asset (imagen override > video > foto > DALL-E)
  let assetTipo, assetId;
  const videoPath = buscarVideo(segmento);
  const fotoPath  = buscarFoto(segmento);

  if (imagenHash) {
    assetTipo = 'imagen';
    assetId   = imagenHash;
  } else if (videoPath) {
    assetTipo = 'video';
    assetId   = await subirVideoLocal(videoPath);
  } else if (fotoPath) {
    assetTipo = 'imagen';
    assetId   = await subirFotoLocal(fotoPath);
  } else {
    assetTipo = 'dalle';
    assetId   = (await generarYSubirImagen(seg.imagenPrompt)).hash;
  }

  // 3. Formulario nativo
  const formularioId = await crearFormulario(segmento);

  // 4. AdSets + Creativos + Ads (uno por copy)
  const ads = [];
  for (const copy of seg.copies) {
    try {
      const adsetNombre = `${seg.nombre} — ${copy.tipo} — ${ts}`;

      // AdSet — promoted_object requerido para Lead Ads en API v25
      const adset = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/adsets`, {
        name:              adsetNombre,
        campaign_id:       campana.id,
        status:            'ACTIVE',
        daily_budget:      Math.round(presupuestoDia / seg.copies.length * 100),
        billing_event:     'IMPRESSIONS',
        targeting:         TARGETING_DIGITAL,
        optimization_goal: 'LEAD_GENERATION',
        promoted_object:   { page_id: ENV.META_PAGE_ID },
      });

      // Creativo
      const creative_spec = assetTipo === 'video'
        ? { video_data: { video_id: assetId, title: copy.titulo, message: copy.cuerpo, call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: formularioId } } } }
        : { link_data:  { image_hash: assetId, message: copy.cuerpo, name: copy.titulo,  call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: formularioId } } } };

      const creative = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/adcreatives`, {
        name:        `Creative — ${adsetNombre}`,
        object_story_spec: { page_id: ENV.META_PAGE_ID, ...creative_spec },
      });

      // Ad
      const ad = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/ads`, {
        name:        `Ad — ${adsetNombre}`,
        adset_id:    adset.id,
        creative:    { creative_id: creative.id },
        status:      'ACTIVE',
      });

      ads.push({ adset_id: adset.id, creative_id: creative.id, ad_id: ad.id, tipo: copy.tipo });
      console.log(`[AdsEngine] Ad creado: ${copy.tipo}`);

    } catch (err) {
      console.error(`[AdsEngine] Error en copy ${copy.tipo}:`, err.message);
    }
  }

  return {
    campaign_id:  campana.id,
    segmento,
    nombre,
    formulario_id: formularioId,
    asset_tipo:   assetTipo,
    ads,
  };
}

// ── CAMPAÑA DE TRÁFICO A URL (para Hotmart / landing page) ──
export async function crearCampañaTrafico(segmento, urlDestino, presupuestoDia) {
  const seg = SEGMENTOS[segmento];
  if (!seg) throw new Error(`Segmento desconocido: ${segmento}`);
  if (!urlDestino) throw new Error('urlDestino es requerido para campañas de tráfico');

  const ts     = Date.now();
  const nombre = `Nexus Labs — ${seg.nombre} — ${new Date().toLocaleDateString('es-US')}`;

  // 1. Campaña de tráfico
  const campana = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/campaigns`, {
    name:                  nombre,
    objective:             'OUTCOME_TRAFFIC',
    status:                'ACTIVE',
    special_ad_categories: [],
  });

  // 2. Asset (video > foto > DALL-E)
  let assetTipo, assetId;
  const videoPath = buscarVideo(segmento);
  const fotoPath  = buscarFoto(segmento);

  if (videoPath) {
    assetTipo = 'video';
    assetId   = await subirVideoLocal(videoPath);
  } else if (fotoPath) {
    assetTipo = 'imagen';
    assetId   = await subirFotoLocal(fotoPath);
  } else {
    assetTipo = 'dalle';
    assetId   = await generarYSubirImagen(seg.imagenPrompt);
  }

  // 3. AdSets + Creativos + Ads
  const ads = [];
  for (const copy of seg.copies) {
    try {
      const adsetNombre = `${seg.nombre} — ${copy.tipo} — ${ts}`;

      const adset = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/adsets`, {
        name:             adsetNombre,
        campaign_id:      campana.id,
        status:           'ACTIVE',
        daily_budget:     Math.round(presupuestoDia / seg.copies.length * 100),
        billing_event:    'IMPRESSIONS',
        targeting:        TARGETING_DIGITAL,
        optimization_goal: 'LANDING_PAGE_VIEWS',
      });

      const creative_spec = assetTipo === 'video'
        ? { video_data: { video_id: assetId, title: copy.titulo, message: copy.cuerpo,
            call_to_action: { type: 'LEARN_MORE', value: { link: urlDestino } } } }
        : { link_data:  { image_hash: assetId, message: copy.cuerpo, name: copy.titulo,
            link: urlDestino,
            call_to_action: { type: 'LEARN_MORE', value: { link: urlDestino } } } };

      const creative = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/adcreatives`, {
        name:              `Creative — ${adsetNombre}`,
        object_story_spec: { page_id: ENV.META_PAGE_ID, ...creative_spec },
      });

      const ad = await MetaConnector.post(`/${ENV.META_AD_ACCOUNT}/ads`, {
        name:     `Ad — ${adsetNombre}`,
        adset_id: adset.id,
        creative: { creative_id: creative.id },
        status:   'ACTIVE',
      });

      ads.push({ adset_id: adset.id, creative_id: creative.id, ad_id: ad.id, tipo: copy.tipo });
      console.log(`[AdsEngine] Ad tráfico creado: ${copy.tipo}`);
    } catch (err) {
      console.error(`[AdsEngine] Error en copy ${copy.tipo}:`, err.message);
    }
  }

  return { campaign_id: campana.id, segmento, nombre, url_destino: urlDestino, asset_tipo: assetTipo, ads };
}

export default crearCampana;
