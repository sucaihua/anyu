const Joi = require('joi');
const homePopupService = require('../services/homePopupService');
const { success } = require('../utils/response');

// 用户端公开读取
async function getPublic(req, res, next) {
  try {
    const cfg = await homePopupService.getConfig();
    return success(res, cfg);
  } catch (e) {
    next(e);
  }
}

// 后台读取（与公开接口相同数据）
async function getAdmin(req, res, next) {
  try {
    const cfg = await homePopupService.getConfig();
    return success(res, cfg);
  } catch (e) {
    next(e);
  }
}

const updateSchema = {
  body: Joi.object({
    enabled: Joi.number().integer().valid(0, 1).required(),
    title: Joi.string().trim().max(120).allow(''),
    content: Joi.string().allow(''),
    imageUrl: Joi.string().trim().max(500).allow(''),
    triggerMode: Joi.string().valid('first', 'refresh', 'timer').required(),
    intervalMinutes: Joi.number().integer().min(1).max(1440)
  })
};

async function update(req, res, next) {
  try {
    const d = req.body;
    await homePopupService.updateConfig(
      {
        enabled: d.enabled,
        title: d.title || '',
        content: d.content || '',
        imageUrl: d.imageUrl || '',
        triggerMode: d.triggerMode,
        intervalMinutes: d.intervalMinutes || 30
      },
      req.user.id
    );
    return success(res, { ok: true }, '保存成功');
  } catch (e) {
    next(e);
  }
}

module.exports = { getPublic, getAdmin, update, updateSchema };
