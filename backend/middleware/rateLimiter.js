const Redis = require('ioredis');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const config = require('../config');

const redisClient = new Redis(config.REDIS_URL, { enableOfflineQueue: false });

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'auth_limit',
  points: 10, // 10 requests
  duration: 60, // per 60 seconds
});

module.exports = (req, res, next) => {
  const ip = req.ip || 'unknown';
  rateLimiter.consume(ip)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many requests. Please try again later.' }));
};
