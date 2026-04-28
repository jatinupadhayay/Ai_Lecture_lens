// src/queues/index.js
const { Redis } = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('⚠️ Redis unavailable after 3 retries. Queue features disabled.');
      return null;
    }
    return Math.min(times * 500, 2000);
  },
  lazyConnect: true,
};

if (process.env.REDIS_PASSWORD) redisConfig.password = process.env.REDIS_PASSWORD;
if (process.env.REDIS_TLS === 'true') redisConfig.tls = {};

const connection = new Redis(redisConfig);

let redisAvailable = false;

connection.connect().then(() => {
  redisAvailable = true;
  console.log('✅ Redis connected');
}).catch(() => {
  console.warn('⚠️ Redis not available. Lecture uploads will process inline (no queue).');
});

connection.on('error', () => {
  // Suppress repeated error logs after initial warning
});

module.exports = { connection, isRedisAvailable: () => redisAvailable };
