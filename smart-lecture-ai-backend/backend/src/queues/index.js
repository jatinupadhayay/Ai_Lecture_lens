// src/queues/index.js
const { Redis } = require('ioredis');

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('⚠️ Redis unavailable after 3 retries. Queue features disabled.');
      return null; // stop retrying
    }
    return Math.min(times * 500, 2000);
  },
  lazyConnect: true,
});

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
