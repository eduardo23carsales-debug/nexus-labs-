// ════════════════════════════════════════════════════
// CONNECTOR — Stripe
// Crear productos, precios y payment links automáticamente
// ════════════════════════════════════════════════════

import ENV from '../config/env.js';

function getStripe() {
  if (!ENV.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY no configurado');
  return import('stripe').then(m => new m.default(ENV.STRIPE_SECRET_KEY));
}

export const StripeConnector = {

  disponible() {
    return !!ENV.STRIPE_SECRET_KEY;
  },

  // Crea producto + precio + payment link de una sola vez
  async crearProductoCompleto({ nombre, descripcion, precio, imagenUrl = null }) {
    const stripe = await getStripe();

    const productoData = { name: nombre, description: descripcion };
    if (imagenUrl) productoData.images = [imagenUrl];

    const producto = await stripe.products.create(productoData);

    const precioObj = await stripe.prices.create({
      product:     producto.id,
      unit_amount: Math.round(precio * 100),
      currency:    'usd',
    });

    const dominio = ENV.RAILWAY_DOMAIN
      ? `https://${ENV.RAILWAY_DOMAIN}`
      : 'https://nexuslabs.com';

    const paymentLink = await stripe.paymentLinks.create({
      line_items:        [{ price: precioObj.id, quantity: 1 }],
      after_completion:  {
        type:     'redirect',
        redirect: { url: `${dominio}/gracias` },
      },
    });

    console.log(`[Stripe] Producto creado: ${nombre} — $${precio} → ${paymentLink.url}`);

    return {
      stripe_product_id:    producto.id,
      stripe_price_id:      precioObj.id,
      stripe_payment_link:  paymentLink.url,
      precio,
    };
  },

  async desactivarProducto(stripeProductId) {
    const stripe = await getStripe();
    await stripe.products.update(stripeProductId, { active: false });
    console.log(`[Stripe] Producto desactivado: ${stripeProductId}`);
  },

  async getBalance() {
    const stripe = await getStripe();
    const balance = await stripe.balance.retrieve();
    return {
      disponible: balance.available.reduce((s, b) => s + b.amount, 0) / 100,
      pendiente:  balance.pending.reduce((s, b) => s + b.amount, 0) / 100,
    };
  },

  // Verifica la firma del webhook de Stripe
  construirEvento(rawBody, signature) {
    if (!ENV.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET no configurado');
    return import('stripe').then(m => {
      const stripe = new m.default(ENV.STRIPE_SECRET_KEY);
      return stripe.webhooks.constructEvent(rawBody, signature, ENV.STRIPE_WEBHOOK_SECRET);
    });
  },

  async getVentasRecientes(stripeProductId, diasAtras = 3) {
    const stripe = await getStripe();
    const desde  = Math.floor(Date.now() / 1000) - diasAtras * 24 * 60 * 60;
    const sesiones = await stripe.checkout.sessions.list({ limit: 100, created: { gte: desde } });
    const pagas    = sesiones.data.filter(s => s.payment_status === 'paid');
    return {
      total_ventas: pagas.length,
      revenue:      pagas.reduce((s, s2) => s + (s2.amount_total || 0) / 100, 0),
    };
  },

  async getSesionesPagadas(desdeTimestamp) {
    const stripe = await getStripe();
    const sesiones = await stripe.checkout.sessions.list({
      limit:    50,
      created:  { gte: desdeTimestamp },
      expand:   ['data.payment_link'],
    });
    return sesiones.data.filter(s => s.payment_status === 'paid');
  },

  async getSesionesAbandonadas(desdeTimestamp) {
    const stripe = await getStripe();
    const sesiones = await stripe.checkout.sessions.list({
      limit:   100,
      created: { gte: desdeTimestamp },
    });
    return sesiones.data.filter(
      s => s.payment_status === 'unpaid' && s.customer_details?.email
    );
  },
};

export default StripeConnector;
