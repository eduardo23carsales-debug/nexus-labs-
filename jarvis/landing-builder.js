// ════════════════════════════════════════════════════
// LANDING BUILDER — Genera páginas web completas con IA
// Claude genera el HTML, se guarda en /public/landings/
// ════════════════════════════════════════════════════

import { AnthropicConnector } from '../connectors/anthropic.connector.js';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../public/landings');

export async function construirLanding(datos) {
  const { nombre_negocio, tipo_negocio, servicios, direccion, telefono, descripcion, color_primario } = datos;

  // Asegurar carpeta de destino
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const slug    = nombre_negocio.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const archivo = `${slug}.html`;
  const ruta    = path.join(OUTPUT_DIR, archivo);

  const colores = {
    azul:   { primary: '#1a56db', dark: '#1e40af', light: '#eff6ff' },
    rojo:   { primary: '#e02424', dark: '#9b1c1c', light: '#fdf2f2' },
    verde:  { primary: '#057a55', dark: '#03543f', light: '#f3faf7' },
    negro:  { primary: '#111827', dark: '#030712', light: '#f9fafb' },
    morado: { primary: '#7e3af2', dark: '#5521b5', light: '#f5f3ff' },
    dorado: { primary: '#d97706', dark: '#92400e', light: '#fffbeb' },
  };

  const color = colores[color_primario?.toLowerCase()] || colores.azul;

  const prompt = `Crea una landing page HTML completa, moderna y profesional para un negocio con estos datos:

Nombre: ${nombre_negocio}
Tipo de negocio: ${tipo_negocio}
Descripción/Slogan: ${descripcion || `El mejor ${tipo_negocio} de la zona`}
Servicios: ${servicios.join(', ')}
${direccion ? `Dirección: ${direccion}` : ''}
${telefono ? `Teléfono/WhatsApp: ${telefono}` : ''}

Colores de la marca:
- Color primario: ${color.primary}
- Color oscuro: ${color.dark}
- Color fondo claro: ${color.light}

REQUISITOS TÉCNICOS:
- HTML completo en un solo archivo (sin dependencias externas excepto Google Fonts)
- CSS inline con variables CSS
- Diseño mobile-first y completamente responsive
- Sin JavaScript de terceros — vanilla JS puro si se necesita
- Imágenes: usa fondos de gradiente CSS, SVG inline o emojis grandes — NO uses URLs de imágenes externas

SECCIONES OBLIGATORIAS (en este orden):
1. Hero — nombre del negocio, slogan, CTA principal (botón de WhatsApp o llamada)
2. Servicios — cards con cada servicio, ícono emoji + nombre + descripción corta
3. Por qué elegirnos — 3 puntos fuertes del negocio
4. Contacto/Ubicación — teléfono, dirección, horario si se conoce, botón WhatsApp
5. Footer — nombre del negocio, año, frase corta

ESTILO:
- Tipografía: Google Fonts (Inter o Poppins)
- Botones redondeados con sombra
- Secciones con padding generoso
- Animaciones CSS sutiles (fade-in al hacer scroll con IntersectionObserver)
- Look moderno tipo SaaS/startup

El botón de WhatsApp debe usar: https://wa.me/${(telefono || '').replace(/\D/g, '') || '17861234567'}

IMPORTANTE: Devuelve SOLO el código HTML completo, sin explicaciones, sin bloques de código markdown, solo el HTML puro empezando con <!DOCTYPE html>.`;

  const html = await AnthropicConnector.completar({
    model:     'claude-sonnet-4-6',
    maxTokens: 8000,
    prompt,
  });

  // Limpiar si Claude devuelve bloques de código
  const htmlLimpio = html
    .replace(/^```html\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  fs.writeFileSync(ruta, htmlLimpio, 'utf8');

  console.log(`[LandingBuilder] Creada: ${archivo}`);

  return {
    archivo,
    ruta,
    url_relativa: `/landings/${archivo}`,
    nombre_negocio,
  };
}

export default construirLanding;
