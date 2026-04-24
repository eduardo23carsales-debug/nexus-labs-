import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message:  { error: 'Demasiadas solicitudes — intenta en un minuto' },
  standardHeaders: true,
  legacyHeaders:   false,
});

export default rateLimiter;
