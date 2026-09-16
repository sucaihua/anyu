const { getConnection } = require('../config/db');
const userModel = require('../models/userModel');
const balanceModel = require('../models/balanceModel');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// 后台：用户列表（含余额）
async function listUsers(params) {
  return userModel.listUsers(params);
}

// 后台：禁用 / 启用用户
async function setStatus(userId, status) {
  const affected = await userModel.updateStatus(userId, status);
  if (!affected) throw new AppError(ERR.NOT_FOUND, '用户不存在');
  // 禁用时立即吊销所有 refresh token，实现强制退出；启用时无需处理
  if (status === 0) {
    await userModel.revokeAllByUser(userId);
  }
  return { ok: true };
}

// 后台：手动加余额（事务：增加 + 写流水 + 取消相关刷新 token 仅在重大异常时）
async function addBalance({ userId, amount, operatorId, remark = '' }) {
  if (!(amount > 0)) throw new AppError(ERR.PARAMS, '加款金额必须为正');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    // 行锁余额
    const [rows] = await conn.execute(
      'SELECT amount, version FROM balances WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    const bal = rows[0];
    if (!bal) {
      await conn.rollback();
      throw new AppError(ERR.NOT_FOUND, '用户余额账户不存在');
    }
    await balanceModel.increaseBalance(conn, userId, amount);
    const balanceAfter = Number(bal.amount) + Number(amount);
    await balanceModel.insertRecord(conn, {
      userId,
      type: 1, // 充值
      amount,
      balanceAfter,
      operatorId,
      remark: remark || '后台手动加款'
    });
    await conn.commit();
    // 失效余额缓存（如有）
    await cache.del(`balance:${userId}`);
    return { balanceAfter };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.isAppError) throw err;
    logger.error('[admin] addBalance error', { err: err.message });
    throw new AppError(ERR.SERVER, '加款失败');
  } finally {
    conn.release();
  }
}

module.exports = { listUsers, setStatus, addBalance };
