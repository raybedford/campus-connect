const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../config/logger');

let rateLimiter;

if (config.REDIS_URL && config.REDIS_URL !== 'redis://localhost:6379') {
  try {
    const redisClient = new Redis(config.REDIS_URL, { 
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    });
    
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'auth_limit',
      points: 10,
      duration: 60,
    });
    
    logger.info('Using Redis for rate limiting');
  } catch (err) {
    logger.warn('Redis connection failed, falling back to Memory for rate limiting');
  }
}

// Fallback to memory if Redis is not configured or fails
if (!rateLimiter) {
  rateLimiter = new RateLimiterMemory({
    points: 10,
    duration: 60,
  });
  logger.info('Using Memory for rate limiting');
}

module.exports = (req, res, next) => {
  const ip = req.ip || 'unknown';
  rateLimiter.consume(ip)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many requests. Please try again later.' }));
};
