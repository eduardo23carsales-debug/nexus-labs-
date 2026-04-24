// ════════════════════════════════════════════════════
// HOTMART CONNECTOR — Publica productos digitales
// Docs: https://developers.hotmart.com/docs/en/
// ════════════════════════════════════════════════════

import axios  from 'axios';
import ENV    from '../config/env.js';
import { query } from '../config/database.js';

const AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const BASE     = ENV.HOTMART_SANDBOX === 'true'
  ? 'https://sandbox.hotmart.com/product/api/v1'
  : 'https://developers.hotmart.com/product/api/v1';

// Token en memoria — dura 1h
let _token = null;
let _tokenExpira = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpira) return _token;

  if (!ENV.HOTMART_CLIENT_ID || !ENV.HOTMART_CLIENT_SECRET) {
    throw new Error('HOTMART_CLIENT_ID / HOTMART_CLIENT_SECRET no configurados');
  }

  const credentials = Buffer.from(`${ENV.HOTMART_CLIENT_ID}:${ENV.HOTMART_CLIENT_SECRET}`).toString('base64');

  const res = await axios.post(AUTH_URL, null, {
    params: {
      grant_type:    'client_credentials',
      client_id:     ENV.HOTMART_CLIENT_ID,
      client_secret: ENV.HOTMART_CLIENT_SECRET,
    },
    headers: { Authorization: `Basic ${credentials}` },
  });

  _token       = res.data.access_token;
  _tokenExpira = Date.now() + (res.data.expires_in - 60) * 1000;
  return _token;
}

export const HotmartConnector = {

  // ── Crear producto digital en Hotmart ──────────────
  async crearProducto({ nombre, descripcion, precio, productoUrl = null, imagenUrl = null }) {
    const token = await getToken();

    const payload = {
      name:          nombre,
      description:   descripcion.substring(0, 500),
      price:         { currency_code: 'USD', value: precio },
      payment_type:  'SINGLE_PAYMENT',
      product_type:  'EBOOK',
      warranty_days: 7,
      ...(productoUrl && { sales_page_url: productoUrl }),
      ...(imagenUrl   && { cover_image_url: imagenUrl }),
    };

    const res = await axios.post(`${BASE}/products`, payload, {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'NexusLabs/1.0',
      },
    });

    const producto = res.data;

    if (typeof producto === 'string' && producto.trim().toLowerCase().startsWith('<!')) {
      throw new Error('Hotmart devolvió HTML — verifica credenciales y endpoint');
    }

    const hotmartId = producto.id || producto.product_id;
    if (!hotmartId) throw new Error(`Hotmart no devolvió ID — respuesta: ${JSON.stringify(producto).slice(0, 200)}`);

    const checkoutUrl = producto.checkout_url || `https://pay.hotmart.com/${hotmartId}`;

    if (ENV.DATABASE_URL) {
      await query(
        `INSERT INTO experiments (nicho, nombre, tipo, precio, estado, hotmart_id, hotmart_url)
         VALUES ($1, $2, $3, $4, 'activo', $5, $6)
         ON CONFLICT DO NOTHING`,
        [nombre, nombre, 'ebook', precio, String(hotmartId), checkoutUrl]
      ).catch(() => {});
    }

    console.log(`[Hotmart] Producto publicado: ${checkoutUrl}`);
    return { hotmart_id: hotmartId, hotmart_url: checkoutUrl };
  },

  // ── Verificar credenciales ─────────────────────────
  async ping() {
    const token = await getToken();
    const res   = await axios.get(`${BASE}/products`, {
      headers: { Authorization: `Bearer ${token}` },
      params:  { page: 0, size: 1 },
    });
    return { ok: true, productos: res.data?.items?.length ?? 0 };
  },

  // ── ¿Está configurado? ─────────────────────────────
  disponible() {
    return !!(ENV.HOTMART_CLIENT_ID && ENV.HOTMART_CLIENT_SECRET);
  },
};

// ── Procesar webhook de compra Hotmart ────────────────
export async function procesarVentaHotmart({ data, event }) {
  if (event !== 'PURCHASE_COMPLETE' && event !== 'PURCHASE_APPROVED') return;

  const emailCliente  = data?.buyer?.email;
  const nombreCliente = data?.buyer?.name;
  const productoId    = String(data?.product?.id || '');
  const monto         = data?.purchase?.price?.value || 0;

  if (!emailCliente || !productoId || !ENV.DATABASE_URL) return;

  // Buscar experimento por hotmart_id
  const { rows } = await query(
    `SELECT * FROM experiments WHERE hotmart_id = $1 LIMIT 1`,
    [productoId]
  ).catch(() => ({ rows: [] }));

  const exp = rows[0];
  if (!exp) {
    console.warn(`[Hotmart] Compra recibida pero sin experimento con hotmart_id=${productoId}`);
    return;
  }

  // Registrar conversión
  await query(
    `INSERT INTO conversions (nombre, segmento, valor) VALUES ($1, $2, $3)`,
    [nombreCliente || emailCliente, `hotmart-${exp.nombre}`, monto]
  ).catch(() => {});

  // Actualizar métricas del experimento
  const metricas = exp.metricas || {};
  metricas.ventas   = (metricas.ventas  || 0) + 1;
  metricas.revenue  = (metricas.revenue || 0) + monto;

  await query(
    `UPDATE experiments SET metricas = $1, actualizado_en = NOW() WHERE id = $2`,
    [JSON.stringify(metricas), exp.id]
  ).catch(() => {});

  console.log(`[Hotmart] Compra registrada — ${emailCliente} — $${monto} — ${exp.nombre}`);
}

export default HotmartConnector;
