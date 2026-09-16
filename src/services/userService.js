const balanceModel = require('../models/balanceModel');
const cache = require('../utils/cache');

// 用户余额（缓存 30s，仅展示用，扣款不走缓存）
async function getMyBalance(userId) {
  const key = `balance:${userId}`;
  const cached = await cache.get(key);
  if (cached) return cached;
  const bal = await balanceModel.getBalance(userId);
  const result = { amount: Number(bal.amount) };
  await cache.set(key, result, 30);
  return result;
}

// 我的流水（可按 type 筛选：1 充值 / 2 消费 / 3 退款）
async function getMyRecords(userId, params) {
  return balanceModel.listRecords(userId, params);
}

module.exports = { getMyBalance, getMyRecords };
