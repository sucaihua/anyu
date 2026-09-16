const Redis = require('ioredis');
const config = require('../config');

// 单例 Redis 连接
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  keyPrefix: config.redis.keyPrefix,
  retryStrategy: (times) => Math.min(times * 100, 2000),
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true
});

redis.on('connect', () => {
  // 静默，避免日志噪声
});
redis.on('error', (err) => {
  // Redis 故障不应阻断主流程（缓存只读不写时降级）
  // eslint-disable-next-line no-console
  console.error('[redis] error', err.message);
});

module.exports = redis;
