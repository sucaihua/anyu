const { getConnection } = require('../config/db');
const rechargeModel = require('../models/rechargeModel');
const balanceModel = require('../models/balanceModel');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// 用户提交充值申请（线下转账后填写，等待后台确认到账）
async function submit(userId, { amount, remark = '' }) {
  if (!(amount > 0)) throw new AppError(ERR.PARAMS, '充值金额必须为正');
  const id = await rechargeModel.create(userId, amount, remark);
  return { id };
}

// 我的充值申请
async function listMine(userId, params) {
  return rechargeModel.listMine(userId, params);
}

// 后台：充值申请列表
async function adminList(params) {
  return rechargeModel.listForAdmin(params);
}

// 后台：确认到账（事务：校验 + 加余额 + 写流水 + 标记状态）
async function adminConfirm(id, operatorId) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const req = await rechargeModel.findByIdForUpdate(conn, id);
    if (!req) {
      await conn.rollback();
      throw new AppError(ERR.NOT_FOUND, '充值申请不存在');
    }
    if (req.status === 1) {
      await conn.rollback();
      throw new AppError(ERR.CONFLICT, '该申请已确认到账，请勿重复操作');
    }
    if (req.status === 2) {
      await conn.rollback();
      throw new AppError(ERR.CONFLICT, '该申请已被拒绝');
    }
    // 行锁余额账户
    const [rows] = await conn.execute(
      'SELECT amount FROM balances WHERE user_id = ? FOR UPDATE',
      [req.user_id]
    );
    const bal = rows[0];
    if (!bal) {
      await conn.rollback();
      throw new AppError(ERR.NOT_FOUND, '用户余额账户不存在');
    }
    await balanceModel.increaseBalance(conn, req.user_id, req.amount);
    const balanceAfter = Number(bal.amount) + Number(req.amount);
    await balanceModel.insertRecord(conn, {
      userId: req.user_id,
      type: 1, // 充值
      amount: req.amount,
      balanceAfter,
      operatorId,
      remark: '充值确认（申请 #' + req.id + '）'
    });
    await rechargeModel.markConfirmed(conn, req.id, operatorId);
    await conn.commit();
    await cache.del(`balance:${req.user_id}`);
    return { balanceAfter, userId: req.user_id };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.isAppError) throw err;
    logger.error('[recharge] confirm error', { err: err.message });
    throw new AppError(ERR.SERVER, '确认到账失败');
  } finally {
    conn.release();
  }
}

// 后台：拒绝申请
async function adminReject(id, operatorId) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const req = await rechargeModel.findByIdForUpdate(conn, id);
    if (!req) {
      await conn.rollback();
      throw new AppError(ERR.NOT_FOUND, '充值申请不存在');
    }
    if (req.status !== 0) {
      await conn.rollback();
      throw new AppError(ERR.CONFLICT, '该申请已处理');
    }
    const r = await rechargeModel.reject(conn, id, operatorId);
    await conn.commit();
    return { ok: r.affectedRows > 0 };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.isAppError) throw err;
    logger.error('[recharge] reject error', { err: err.message });
    throw new AppError(ERR.SERVER, '操作失败');
  } finally {
    conn.release();
  }
}

module.exports = { submit, listMine, adminList, adminConfirm, adminReject };