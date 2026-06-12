const rateLimit = require('express-rate-limit');

// General rate limiter: max 100 requests per 15 minutes per IP address
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limiter for authentication routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again later' }
});

module.exports = { limiter, authLimiter };
