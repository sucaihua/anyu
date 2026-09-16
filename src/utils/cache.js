const redis = require('../config/redis');
const logger = require('./logger');

// 缓存封装：自动 JSON 序列化，Redis 故障时降级返回 null，不阻断主流程
async function get(key) {
  try {
    const raw = await redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('[cache] get failed', { key, err: err.message });
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  try {
    const val = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(key, val, 'EX', ttlSeconds);
    } else {
      await redis.set(key, val);
    }
  } catch (err) {
    logger.warn('[cache] set failed', { key, err: err.message });
  }
}

async function del(key) {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn('[cache] del failed', { key, err: err.message });
  }
}

// 批量删除（按 pattern，慎用 KEYS，仅用于运维场景）
async function delByPrefix(prefix) {
  try {
    // SCAN 替代 KEYS 避免阻塞
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('[cache] delByPrefix failed', { prefix, err: err.message });
  }
}

// SETNX 简易互斥锁（防缓存击穿 single-flight）
async function setLock(key, ttlSeconds = 5) {
  try {
    const r = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return r === 'OK';
  } catch (err) {
    return false;
  }
}

async function releaseLock(key) {
  await del(key);
}

module.exports = { get, set, del, delByPrefix, setLock, releaseLock };
