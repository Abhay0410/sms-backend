import NodeCache from 'node-cache';
import logger from './logger.js';

// Initialize cache with standard TTL of 5 minutes (300 seconds)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

/**
 * Express middleware to cache GET requests.
 * @param {number} duration - Cache duration in seconds (defaults to 300s)
 */
export const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      logger.debug(`Cache hit for: ${key}`);
      return res.json(cachedResponse);
    }

    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.debug(`Cache miss - storing new data for: ${key}`);
        cache.set(key, body, duration);
      }
      originalJson.call(this, body);
    };

    next();
  };
};

export default cache;