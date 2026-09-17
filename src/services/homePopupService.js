const homePopupConfigModel = require('../models/homePopupConfigModel');
const cache = require('../utils/cache');

const CACHE_KEY = 'config:home_popup';
const TTL = 300;

// 首页弹窗配置（缓存）
async function getConfig() {
  const cached = await cache.get(CACHE_KEY);
  if (cached) return cached;
  const cfg = await homePopupConfigModel.getConfig();
  const result = {
    enabled: Number(cfg.enabled || 0),
    title: cfg.title || '',
    content: cfg.content || '',
    imageUrl: cfg.image_url || '',
    triggerMode: cfg.trigger_mode || 'first',
    intervalMinutes: Number(cfg.interval_minutes || 30)
  };
  await cache.set(CACHE_KEY, result, TTL);
  return result;
}

async function updateConfig(data, operatorId) {
  await homePopupConfigModel.updateConfig({ ...data, updatedBy: operatorId });
  await cache.del(CACHE_KEY);
  return { ok: true };
}

module.exports = { getConfig, updateConfig };
