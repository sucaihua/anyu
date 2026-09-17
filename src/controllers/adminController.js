const Joi = require('joi');
const adminService = require('../services/adminService');
const mailConfigService = require('../services/mailConfigService');
const balanceModel = require('../models/balanceModel');
const { success } = require('../utils/response');

async function listUsers(req, res, next) {
  try {
    const { keyword = '', page = 1, size = 20 } = req.query;
    const data = await adminService.listUsers({
      keyword,
      page: Number(page),
      size: Number(size)
    });
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

const statusSchema = {
  body: Joi.object({
    status: Joi.number().integer().valid(0, 1).required()
  })
};

async function setStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    await adminService.setStatus(id, req.body.status);
    return success(res, { ok: true }, '更新成功');
  } catch (e) {
    next(e);
  }
}

const addBalanceSchema = {
  body: Joi.object({
    userId: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().max(99999999.99).required(),
    remark: Joi.string().max(255).allow('', null)
  })
};

async function addBalance(req, res, next) {
  try {
    const r = await adminService.addBalance({
      userId: req.body.userId,
      amount: req.body.amount,
      operatorId: req.user.id,
      remark: req.body.remark
    });
    return success(res, r, '加款成功');
  } catch (e) {
    next(e);
  }
}

// 后台：查指定用户流水
async function userRecords(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const { type = 0, page = 1, size = 20 } = req.query;
    const data = await balanceModel.listRecords(userId, {
      type: Number(type),
      page: Number(page),
      size: Number(size)
    });
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

// 邮件通知配置
async function getMailConfig(req, res, next) {
  try {
    const cfg = await mailConfigService.getConfig();
    return success(res, cfg);
  } catch (e) {
    next(e);
  }
}

const updateMailConfigSchema = {
  body: Joi.object({
    enabled: Joi.number().integer().valid(0, 1).required(),
    host: Joi.string().trim().max(120).allow(''),
    port: Joi.number().integer().min(1).max(65535),
    secure: Joi.number().integer().valid(0, 1),
    mailUser: Joi.string().trim().max(120).allow(''),
    mailPass: Joi.string().trim().max(120).allow(''),
    fromName: Joi.string().trim().max(60).allow(''),
    fromEmail: Joi.string().trim().max(120).email().allow(''),
    notifyUser: Joi.number().integer().valid(0, 1),
    adminTo: Joi.string().trim().max(500).allow('')
  })
};

async function updateMailConfig(req, res, next) {
  try {
    const d = req.body;
    await mailConfigService.updateConfig({
      enabled: d.enabled,
      host: d.host || '',
      port: d.port || 465,
      secure: d.secure,
      mailUser: d.mailUser || '',
      mailPass: d.mailPass || '',
      fromName: d.fromName || 'ZiyuanClub',
      fromEmail: d.fromEmail || '',
      notifyUser: d.notifyUser,
      adminTo: d.adminTo || ''
    }, req.user.id);
    return success(res, { ok: true }, '邮件配置已保存');
  } catch (e) {
    next(e);
  }
}

const testMailSchema = {
  body: Joi.object({
    to: Joi.string().trim().max(120).email().required()
  })
};

async function testMailConfig(req, res, next) {
  try {
    const r = await mailConfigService.sendTest({ to: req.body.to, operatorId: req.user.id });
    return success(res, r, '测试邮件已发送');
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listUsers,
  statusSchema,
  setStatus,
  addBalanceSchema,
  addBalance,
  userRecords,
  getMailConfig,
  updateMailConfig,
  updateMailConfigSchema,
  testMailConfig,
  testMailSchema
};
