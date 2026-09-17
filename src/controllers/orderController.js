const Joi = require('joi');
const orderService = require('../services/orderService');
const { success } = require('../utils/response');

const placeOrderSchema = {
  body: Joi.object({
    productId: Joi.number().integer().positive().required(),
    skuId: Joi.number().integer().positive().allow(null),
    idempotencyKey: Joi.string().max(64).allow('', null)
  })
};

async function placeOrder(req, res, next) {
  try {
    const r = await orderService.placeOrder({
      userId: req.user.id,
      productId: req.body.productId,
      skuId: req.body.skuId,
      idempotencyKey: req.body.idempotencyKey
    });
    return success(res, r, '下单成功');
  } catch (e) {
    next(e);
  }
}

async function myOrders(req, res, next) {
  try {
    const { page = 1, size = 20 } = req.query;
    const data = await orderService.listMyOrders(req.user.id, {
      page: Number(page),
      size: Number(size)
    });
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

async function adminList(req, res, next) {
  try {
    const { keyword = '', status = -1, page = 1, size = 20 } = req.query;
    const data = await orderService.adminListOrders({
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

async function adminRefund(req, res, next) {
  try {
    const id = Number(req.params.id);
    await orderService.refund(id, req.user.id);
    return success(res, { ok: true }, '退款成功');
  } catch (e) {
    next(e);
  }
}

// 下单弹窗提示配置
async function getPopup(req, res, next) {
  try {
    const cfg = await orderService.getPopupConfig();
    return success(res, cfg);
  } catch (e) {
    next(e);
  }
}

const popupSchema = {
  body: Joi.object({
    enabled: Joi.number().integer().valid(0, 1).required(),
    title: Joi.string().max(120).allow('', null).required(),
    content: Joi.string().allow('', null).required(),
    accountName: Joi.string().max(120).allow('', null).required(),
    bankCard: Joi.string().max(120).allow('', null).required(),
    bankName: Joi.string().max(120).allow('', null).required()
  })
};

async function updatePopup(req, res, next) {
  try {
    await orderService.updatePopupConfig(req.body, req.user.id);
    return success(res, { ok: true }, '更新成功');
  } catch (e) {
    next(e);
  }
}

module.exports = {
  placeOrder,
  placeOrderSchema,
  myOrders,
  adminList,
  adminRefund,
  getPopup,
  updatePopup,
  popupSchema
};
