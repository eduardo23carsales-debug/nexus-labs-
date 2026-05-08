// ════════════════════════════════════════════════════
// ADS ENGINE — Creador de campañas Meta Ads
// Crea campaña + adsets + creativos + formulario nativo
// ════════════════════════════════════════════════════

import axios      from 'axios';
import FormData   from 'form-data';
import fs         from 'fs';
import path       from 'path';
import { MetaConnector, adAccount } from '../connectors/meta.connector.js';
import { OpenAIConnector }    from '../connectors/openai.connector.js';
import { AnthropicConnector } from '../connectors/anthropic.connector.js';
import { SEGMENTOS }          from './segments.config.js';
import ENV from '../config/env.js';

// Targeting base para productos digitales: EEUU hispanohablante
const TARGETING_DIGITAL = {
  age_min: 25,
  age_max: 65,
  geo_locations:          { countries: ['US'] },
  targeting_automation:   { advantage_audience: 1 },
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
  const data = await MetaConnector.postForm(`/${adAccount()}/adimages`, form);
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
    `https://graph-video.facebook.com/v25.0/${adAccount()}/advideos`,
    form,
    { headers: form.getHeaders(), timeout: 120000 }
  );
  if (!data.id) throw new Error('Meta no retornó ID de video');
  return data.id;
}

// ── Descargar URL de imagen y subir a Meta ────────────
async function descargarYSubir(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer' });
  const buf  = Buffer.from(resp.data);
  const tmp  = path.join('/tmp', `dalleimg_${Date.now()}.jpg`);
  fs.writeFileSync(tmp, buf);
  const hash = await subirFotoLocal(tmp);
  fs.unlinkSync(tmp);
  return { hash, url };
}

// ── Generar imagen con DALL-E y subirla ──────────────
export async function generarYSubirImagen(prompt) {
  const url = await OpenAIConnector.generarImagen({ prompt });
  return await descargarYSubir(url);
}

// ── Prompt de imagen genérico por tipo de copy (fallback sin producto) ────
function promptImagenParaCopy(copy, seg) {
  const calidad = 'photorealistic professional advertisement photo, cinematic lighting, 8K ultra-detailed, no text overlay, no watermark, no AI-looking artifacts, no cartoon style, no stock photo cliché, no hands, no faces, objects and environments only';
  const variantes = {
    emocional: `${seg.imagenPrompt}, emotional lifestyle moment, warm aspirational atmosphere, person experiencing transformation and relief, golden hour, real human emotion. ${calidad}`,
    directo:   `${seg.imagenPrompt}, clean professional environment, clear product benefit visible, high contrast, sharp focus, modern minimalist aesthetic, trustworthy and credible. ${calidad}`,
    urgencia:  `${seg.imagenPrompt}, dynamic energetic scene, bold dramatic lighting, momentum and opportunity, action-oriented composition, sense of urgency. ${calidad}`,
  };
  return variantes[copy.tipo] || `${seg.imagenPrompt}. ${calidad}`;
}

// ── Generar prompt de imagen específico al producto con Claude ─────────────
async function generarPromptImagenParaProducto(nombreProducto, nicho, tipoCopy) {
  const estilos = {
    emocional: 'emotional and aspirational — shows transformation, relief, or life improvement',
    directo:   'professional and clear — shows the solution or benefit directly',
    urgencia:  'dynamic and energetic — creates sense of opportunity or urgency',
  };
  const estilo = estilos[tipoCopy] || 'professional and appealing';

  const prompt = await AnthropicConnector.completar({
    model:     'claude-haiku-4-5-20251001',
    maxTokens: 100,
    prompt: `Create a DALL-E 3 prompt for a Meta Ads image.
Product: "${nombreProducto}"
Niche: ${nicho}
Visual style: ${estilo}

Rules (mandatory):
- NO faces, NO hands, NO body parts (DALL-E renders them poorly)
- Use objects, documents, environments, symbolic scenes only
- NO text or logos in the image
- Photorealistic, cinematic lighting, 8K, not AI-looking

Respond with ONLY the image prompt, no labels or explanation:`,
  });
  return prompt.trim();
}

// ── Generar slideshow: N imágenes DALL-E → video Meta ───────────────────────
// Genera imágenes distintas del producto, las sube y crea el slideshow en Meta
export async function generarSlideshowParaCampana(nombreProducto, nicho, seg, nImagenes = 5) {
  const estilos = ['aspirational', 'professional', 'dynamic', 'lifestyle', 'results-focused'];
  const urls    = [];

  for (let i = 0; i < nImagenes; i++) {
    try {
      const estilo = estilos[i % estilos.length];
      const prompt = await AnthropicConnector.completar({
        model:     'claude-haiku-4-5-20251001',
        maxTokens: 100,
        prompt: `Create a DALL-E 3 prompt for slide ${i + 1} of ${nImagenes} in a Meta Ads slideshow video.
Product: "${nombreProducto}"
Niche: ${nicho}
Visual style: ${estilo}
Rules: NO faces, NO hands, NO text, NO logos. Objects, environments, symbolic scenes only. Photorealistic, cinematic lighting. Each slide must look DIFFERENT from the others.
Respond with ONLY the prompt, no labels:`,
      });
      const url = await OpenAIConnector.generarImagen({ prompt: prompt.trim() });
      urls.push(url);
      console.log(`[AdsEngine] Slide ${i + 1}/${nImagenes} generado`);
    } catch (err) {
      console.warn(`[AdsEngine] Slide ${i + 1} falló:`, err.message);
    }
  }

  if (urls.length < 3) throw new Error(`Solo se generaron ${urls.length} imágenes — mínimo 3 para slideshow`);

  const videoId = await MetaConnector.crearSlideshowDesdeUrls(urls, { duracionMs: 2000, transicion: 'FADE' });
  console.log(`[AdsEngine] Slideshow creado: video ID ${videoId} (${urls.length} slides)`);
  return { videoId, nSlides: urls.length, imageUrls: urls };
}

// ── Generar imagen, validar con Claude Vision (base64), reintentar si calidad baja ──
async function generarImagenValidada(promptBase, contexto, maxIntentos = 3) {
  let prompt   = promptBase;
  let ultimaBuf = null;
  let ultimaUrl = null;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    const url  = await OpenAIConnector.generarImagen({ prompt });
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const buf  = Buffer.from(resp.data);
    ultimaBuf  = buf;
    ultimaUrl  = url;

    // Pasar como base64 — las URLs de DALL-E no son accesibles desde la API de Claude
    const val = await AnthropicConnector.analizarImagen(buf, contexto);
    console.log(`[AdsEngine] Imagen intento ${intento}/${maxIntentos} — score ${val.score}/10: ${val.feedback}`);

    if (val.score >= 6) {
      const tmp = path.join('/tmp', `dalleimg_${Date.now()}.jpg`);
      fs.writeFileSync(tmp, buf);
      const hash = await subirFotoLocal(tmp);
      fs.unlinkSync(tmp);
      return { hash, url };
    }

    if (intento < maxIntentos) {
      prompt = `${promptBase}. Improve: ${val.feedback}. Must look 100% photorealistic, not AI-generated.`;
    }
  }

  console.log(`[AdsEngine] Score insuficiente tras ${maxIntentos} intentos — usando última imagen`);
  const tmp = path.join('/tmp', `dalleimg_${Date.now()}.jpg`);
  fs.writeFileSync(tmp, ultimaBuf);
  const hash = await subirFotoLocal(tmp);
  fs.unlinkSync(tmp);
  return { hash, url: ultimaUrl };
}

// ── Generar copies específicos del producto con Claude ──
export async function generarCopiesParaProducto(nombreProducto, nicho, precio = 37) {
  return AnthropicConnector.completarJSONConReintentos({
    model:     'claude-haiku-4-5-20251001',
    maxTokens: 600,
    prompt: `Genera 3 copies de anuncios Meta Ads en español para hispanos en USA.

Producto: "${nombreProducto}"
Nicho: ${nicho}
Precio: $${precio}

Cada copy debe tener: tipo (emocional/directo/urgencia), titulo (máx 40 chars), cuerpo (máx 125 chars), cta (máx 20 chars).
Habla del PROBLEMA EXACTO del nicho. No menciones "ganar dinero" a menos que el nicho sea sobre eso.
Responde SOLO con un JSON array de 3 objetos, sin texto adicional.`,
  });
}

// ── Crear formulario nativo de Lead Ads ─────────────
async function crearFormulario(segmento, stripeUrl = null) {
  const seg = SEGMENTOS[segmento];
  const nombre = `Nexus Labs —${seg.nombre} — ${Date.now()}`;

  const baseUrl = `https://${ENV.RAILWAY_DOMAIN || 'nexuslabs.com'}`;
  const data = await MetaConnector.post(`/${ENV.META_PAGE_ID}/leadgen_forms`, {
    name:                  nombre,
    privacy_policy:        { url: `${baseUrl}/privacidad` },
    follow_up_action_url:  stripeUrl || baseUrl,
    questions: [
      { type: 'FULL_NAME' },
      { type: 'PHONE'     },
      { type: 'EMAIL'     },
    ],
    locale: 'ES_LA',
  });
  return data.id;
}

// ── CREAR CAMPAÑA COMPLETA ────────────────────────────
// imagenHash opcional: si se pasa, usa esa imagen en vez de buscar/generar una
export async function crearCampana(segmento, presupuestoDia, { imagenHash, copies, stripeUrl, nombreProducto, nicho, slideshow = true } = {}) {
  const seg = SEGMENTOS[segmento];
  if (!seg) throw new Error(`Segmento desconocido: ${segmento}`);

  // Verificar ad account antes de crear
  try {
    const acct = await MetaConnector.get(`/${adAccount()}`, {
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
  const nombre = nombreProducto
    ? `Nexus Labs — ${nombreProducto.slice(0, 40)} — ${new Date().toLocaleDateString('es-US')}`
    : `Nexus Labs — ${seg.nombre} — ${new Date().toLocaleDateString('es-US')}`;

  // 1. Campaña — presupuesto + bid_strategy a nivel campaña (requerido con CBO en API v25)
  const campana = await MetaConnector.post(`/${adAccount()}/campaigns`, {
    name:                  nombre,
    objective:             'OUTCOME_LEADS',
    status:                'ACTIVE',
    special_ad_categories: [],
    daily_budget:          Math.round(presupuestoDia * 100),
    bid_strategy:          'LOWEST_COST_WITHOUT_CAP',
  });

  // 2. Asset — prioridad: imagenHash override > slideshow > video local > foto local > DALL-E por copy
  let assetTipo, assetIdFijo = null;
  const videoPath = buscarVideo(segmento);
  const fotoPath  = buscarFoto(segmento);

  if (imagenHash) {
    assetTipo   = 'imagen';
    assetIdFijo = imagenHash;
  } else if (slideshow && nombreProducto) {
    console.log('[AdsEngine] Generando slideshow video...');
    const sl    = await generarSlideshowParaCampana(nombreProducto, nicho || seg.nombre, seg);
    assetTipo   = 'video';
    assetIdFijo = sl.videoId;
    console.log(`[AdsEngine] Slideshow listo (${sl.nSlides} slides → video ${sl.videoId})`);
  } else if (videoPath) {
    assetTipo   = 'video';
    assetIdFijo = await subirVideoLocal(videoPath);
  } else if (fotoPath) {
    assetTipo   = 'imagen';
    assetIdFijo = await subirFotoLocal(fotoPath);
  } else {
    assetTipo = 'dalle';  // cada copy genera su propia imagen dentro del loop
  }

  // 3. Formulario nativo (con redirect a Stripe si está disponible)
  const formularioId = await crearFormulario(segmento, stripeUrl);

  // 4. AdSets + Creativos + Ads — usa copies específicos del producto si se pasan
  const copiasEfectivas = (Array.isArray(copies) && copies.length) ? copies : seg.copies;
  const ads = [];
  for (const copy of copiasEfectivas) {
    try {
      const adsetNombre = `${seg.nombre} — ${copy.tipo} — ${ts}`;

      // Imagen única por copy: específica al producto si está disponible, genérica si no
      let assetId = assetIdFijo;
      if (assetTipo === 'dalle') {
        const promptCopy = nombreProducto
          ? await generarPromptImagenParaProducto(nombreProducto, nicho || seg.nombre, copy.tipo)
          : promptImagenParaCopy(copy, seg);
        const contexto = `Meta Ad para "${copy.titulo}" — ${nombreProducto || seg.nombre}, audiencia hispana USA`;
        assetId = (await generarImagenValidada(promptCopy, contexto)).hash;
      }

      // AdSet — sin budget ni bid_strategy (ambos viven en la campaña con CBO)
      const adset = await MetaConnector.post(`/${adAccount()}/adsets`, {
        name:              adsetNombre,
        campaign_id:       campana.id,
        status:            'ACTIVE',
        billing_event:     'IMPRESSIONS',
        targeting:         TARGETING_DIGITAL,
        optimization_goal: 'LEAD_GENERATION',
        destination_type:  'ON_AD',
        promoted_object:   { page_id: ENV.META_PAGE_ID },
      });

      // Creativo
      const creative_spec = assetTipo === 'video'
        ? { video_data: { video_id: assetId, title: copy.titulo, message: copy.cuerpo, call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: formularioId } } } }
        : { link_data:  { image_hash: assetId, message: copy.cuerpo, name: copy.titulo, link: `https://${ENV.RAILWAY_DOMAIN || 'nexuslabs.com'}`, call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: formularioId } } } };

      const creative = await MetaConnector.post(`/${adAccount()}/adcreatives`, {
        name:        `Creative — ${adsetNombre}`,
        object_story_spec: { page_id: ENV.META_PAGE_ID, ...creative_spec },
      });

      // Ad
      const ad = await MetaConnector.post(`/${adAccount()}/ads`, {
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

  if (ads.length === 0) {
    await MetaConnector.post(`/${campana.id}`, { status: 'PAUSED' }).catch(() => {});
    throw new Error(`Campaña creada (${campana.id}) pero ningún ad se pudo crear — campaña pausada automáticamente. Revisa los logs de adsets.`);
  }

  console.log(`[AdsEngine] Campaña lista: ${ads.length}/${seg.copies.length} ads creados`);

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
export async function crearCampañaTrafico(segmento, urlDestino, presupuestoDia, { copies, nombreProducto, nicho, slideshow = true } = {}) {
  const seg = SEGMENTOS[segmento];
  if (!seg) throw new Error(`Segmento desconocido: ${segmento}`);
  if (!urlDestino) throw new Error('urlDestino es requerido para campañas de tráfico');

  const ts     = Date.now();
  const nombre = nombreProducto
    ? `Nexus Labs — ${nombreProducto.slice(0, 40)} — ${new Date().toLocaleDateString('es-US')}`
    : `Nexus Labs — ${seg.nombre} — ${new Date().toLocaleDateString('es-US')}`;

  // 1. Campaña de tráfico — presupuesto + bid_strategy a nivel campaña (CBO)
  const campana = await MetaConnector.post(`/${adAccount()}/campaigns`, {
    name:                  nombre,
    objective:             'OUTCOME_TRAFFIC',
    status:                'ACTIVE',
    special_ad_categories: [],
    daily_budget:          Math.round(presupuestoDia * 100),
    bid_strategy:          'LOWEST_COST_WITHOUT_CAP',
  });

  // 2. Asset — prioridad: slideshow > video local > foto local > DALL-E por copy
  let assetTipo, assetIdFijo = null;
  const videoPath = buscarVideo(segmento);
  const fotoPath  = buscarFoto(segmento);

  if (slideshow && nombreProducto) {
    console.log('[AdsEngine] Generando slideshow video...');
    const sl    = await generarSlideshowParaCampana(nombreProducto, nicho || seg.nombre, seg);
    assetTipo   = 'video';
    assetIdFijo = sl.videoId;
    console.log(`[AdsEngine] Slideshow listo (${sl.nSlides} slides → video ${sl.videoId})`);
  } else if (videoPath) {
    assetTipo   = 'video';
    assetIdFijo = await subirVideoLocal(videoPath);
  } else if (fotoPath) {
    assetTipo   = 'imagen';
    assetIdFijo = await subirFotoLocal(fotoPath);
  } else {
    assetTipo = 'dalle';  // cada copy genera su propia imagen dentro del loop
  }

  // 3. AdSets + Creativos + Ads — usa copies específicos del producto si se pasan
  const copiasEfectivas = (Array.isArray(copies) && copies.length) ? copies : seg.copies;
  const ads = [];
  for (const copy of copiasEfectivas) {
    try {
      const adsetNombre = `${seg.nombre} — ${copy.tipo} — ${ts}`;

      // Imagen única por copy: específica al producto si está disponible, genérica si no
      let assetId = assetIdFijo;
      if (assetTipo === 'dalle') {
        const promptCopy = nombreProducto
          ? await generarPromptImagenParaProducto(nombreProducto, nicho || seg.nombre, copy.tipo)
          : promptImagenParaCopy(copy, seg);
        const contexto = `Meta Ad para "${copy.titulo}" — ${nombreProducto || seg.nombre}, audiencia hispana USA`;
        assetId = (await generarImagenValidada(promptCopy, contexto)).hash;
      }

      const adset = await MetaConnector.post(`/${adAccount()}/adsets`, {
        name:             adsetNombre,
        campaign_id:      campana.id,
        status:           'ACTIVE',
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

      const creative = await MetaConnector.post(`/${adAccount()}/adcreatives`, {
        name:              `Creative — ${adsetNombre}`,
        object_story_spec: { page_id: ENV.META_PAGE_ID, ...creative_spec },
      });

      const ad = await MetaConnector.post(`/${adAccount()}/ads`, {
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

  // Si ningún ad se creó, la campaña quedó vacía — limpiar y avisar
  if (ads.length === 0) {
    await MetaConnector.post(`/${campana.id}`, { status: 'PAUSED' }).catch(() => {});
    throw new Error(`Campaña creada pero sin anuncios — todos los copies fallaron. Campaña ${campana.id} pausada para evitar gasto. Reintenta con relanzar_producto.`);
  }

  return { campaign_id: campana.id, segmento, nombre, url_destino: urlDestino, asset_tipo: assetTipo, ads };
}

export default crearCampana;
