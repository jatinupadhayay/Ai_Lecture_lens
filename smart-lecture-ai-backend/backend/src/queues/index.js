// src/queues/index.js
const { Redis } = require('ioredis');

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
});

connection.on('connect', () => console.log('✅ Redis connected'));
connection.on('error', (err) => console.error('❌ Redis connection error:', err));

module.exports = { connection };
