const Joi = require('joi');
const rechargeService = require('../services/rechargeService');
const { success } = require('../utils/response');

const submitSchema = {
  body: Joi.object({
    amount: Joi.number().positive().max(99999999.99).required(),
    remark: Joi.string().max(255).allow('', null)
  })
};

// 用户提交充值申请
async function submit(req, res, next) {
  try {
    const r = await rechargeService.submit(req.user.id, {
      amount: req.body.amount,
      remark: req.body.remark,
      username: req.user.username
    });
    return success(res, r, '充值申请已提交，等待后台确认到账');
  } catch (e) {
    next(e);
  }
}

// 我的充值申请
async function listMine(req, res, next) {
  try {
    const { page = 1, size = 20 } = req.query;
    const data = await rechargeService.listMine(req.user.id, {
      page: Number(page),
      size: Number(size)
    });
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

// 后台：充值申请列表
async function adminList(req, res, next) {
  try {
    const { keyword = '', status = -1, page = 1, size = 20 } = req.query;
    const data = await rechargeService.adminList({
      keyword,
      status: Number(status),
      page: Number(page),
      size: Number(size)
    });
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

// 后台：确认到账
async function confirm(req, res, next) {
  try {
    const id = Number(req.params.id);
    const r = await rechargeService.adminConfirm(id, req.user.id);
    return success(res, r, '已确认到账并加余额');
  } catch (e) {
    next(e);
  }
}

// 后台：拒绝申请
async function reject(req, res, next) {
  try {
    const id = Number(req.params.id);
    await rechargeService.adminReject(id, req.user.id);
    return success(res, { ok: true }, '已拒绝该申请');
  } catch (e) {
    next(e);
  }
}

module.exports = { submitSchema, submit, listMine, adminList, confirm, reject };