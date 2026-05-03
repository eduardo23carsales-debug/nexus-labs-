// ════════════════════════════════════════════════════
// GOOGLE CALENDAR CONNECTOR
// Crea eventos automáticamente cuando Sofia agenda citas
//
// Setup en Railway:
//   GOOGLE_SERVICE_ACCOUNT_JSON  → contenido del JSON de la cuenta de servicio
//   GOOGLE_CALENDAR_ID           → 'primary' o el ID del calendario
//
// Una sola vez en Google Cloud Console:
//   1. Habilitar Google Calendar API
//   2. Crear Service Account → descargar JSON de credenciales
//   3. Compartir tu Google Calendar con el email del service account
// ════════════════════════════════════════════════════

import ENV from '../config/env.js';

function getCredentials() {
  if (!ENV.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  try {
    return typeof ENV.GOOGLE_SERVICE_ACCOUNT_JSON === 'string'
      ? JSON.parse(ENV.GOOGLE_SERVICE_ACCOUNT_JSON)
      : ENV.GOOGLE_SERVICE_ACCOUNT_JSON;
  } catch {
    console.error('[GoogleCalendar] JSON de credenciales inválido');
    return null;
  }
}

// Convierte texto en español a Date — si no puede, usa mañana a las 10am
function parsearFechaEspanol(diaCita, horaCita) {
  const now   = new Date();
  let   fecha = new Date(now);
  fecha.setDate(now.getDate() + 1);
  fecha.setHours(10, 0, 0, 0);

  // Día de la semana
  const diasMap = {
    lunes: 1, martes: 2, 'miércoles': 3, miercoles: 3,
    jueves: 4, viernes: 5, 'sábado': 6, sabado: 6, domingo: 0,
  };
  const diaLower = (diaCita || '').toLowerCase();
  for (const [nombre, numDia] of Object.entries(diasMap)) {
    if (diaLower.includes(nombre)) {
      const hoy  = now.getDay();
      let   diff = numDia - hoy;
      if (diff <= 0) diff += 7;
      fecha = new Date(now);
      fecha.setDate(now.getDate() + diff);
      break;
    }
  }

  // Hora
  const horaLower = (horaCita || '').toLowerCase();
  const match = horaLower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la mañana|mañana|de la tarde|tarde|de la noche|noche)?/);
  if (match) {
    let h  = parseInt(match[1]);
    const m  = parseInt(match[2] || '0');
    const p  = match[3] || '';
    if ((p.includes('pm') || p.includes('tarde') || p.includes('noche')) && h < 12) h += 12;
    if ((p.includes('am') || p.includes('mañana')) && h === 12) h = 0;
    fecha.setHours(h, m, 0, 0);
  }

  return fecha;
}

export const GoogleCalendarConnector = {

  disponible() {
    return !!ENV.GOOGLE_SERVICE_ACCOUNT_JSON;
  },

  async crearEventoCita({ nombre, telefono, diaCita, horaCita, nicho, notas }) {
    const creds = getCredentials();
    if (!creds) {
      console.warn('[GoogleCalendar] GOOGLE_SERVICE_ACCOUNT_JSON no configurado — evento no creado');
      return null;
    }

    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });

    const inicio   = parsearFechaEspanol(diaCita, horaCita);
    const fin      = new Date(inicio.getTime() + 30 * 60 * 1000); // 30 minutos
    const titulo   = `📞 Cita: ${nombre}${nicho ? ` (${nicho})` : ''}`;
    const descripcion = [
      `Cliente: ${nombre}`,
      `Teléfono: ${telefono}`,
      nicho  ? `Nicho: ${nicho}` : null,
      diaCita  ? `Fecha indicada: ${diaCita}` : null,
      horaCita ? `Hora indicada: ${horaCita}`  : null,
      notas  ? `\nNotas Sofia:\n${notas}` : null,
    ].filter(Boolean).join('\n');

    const event = {
      summary:     titulo,
      description: descripcion,
      start: { dateTime: inicio.toISOString(), timeZone: 'America/New_York' },
      end:   { dateTime: fin.toISOString(),    timeZone: 'America/New_York' },
      reminders: {
        useDefault: false,
        overrides:  [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    };

    try {
      const res = await calendar.events.insert({
        calendarId: ENV.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: event,
      });
      console.log(`[GoogleCalendar] Evento creado: ${res.data.htmlLink}`);
      return { id: res.data.id, url: res.data.htmlLink, inicio };
    } catch (err) {
      console.error('[GoogleCalendar] Error creando evento:', err.message);
      return null;
    }
  },

  async crearEventoPersonalizado({ titulo, descripcion, inicio, duracion_min = 60 }) {
    const creds = getCredentials();
    if (!creds) return null;

    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });

    const fechaInicio = inicio instanceof Date ? inicio : new Date(inicio);
    const fechaFin    = new Date(fechaInicio.getTime() + duracion_min * 60 * 1000);

    try {
      const res = await calendar.events.insert({
        calendarId: ENV.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: {
          summary:     titulo,
          description: descripcion || '',
          start: { dateTime: fechaInicio.toISOString(), timeZone: 'America/New_York' },
          end:   { dateTime: fechaFin.toISOString(),    timeZone: 'America/New_York' },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 60 },
              { method: 'popup', minutes: 15 },
              { method: 'popup', minutes: 0  },
            ],
          },
        },
      });
      return { id: res.data.id, url: res.data.htmlLink };
    } catch (err) {
      console.error('[GoogleCalendar] Error creando evento personalizado:', err.message);
      return null;
    }
  },
};

export default GoogleCalendarConnector;
