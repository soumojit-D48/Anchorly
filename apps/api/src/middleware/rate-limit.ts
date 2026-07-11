import rateLimit from 'express-rate-limit';

export const dashboardRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  // Skip X-Forwarded-For validation when behind a proxy
  validate: { xForwardedForHeader: false },
});
