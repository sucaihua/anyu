const Joi = require('joi');
const categoryService = require('../services/categoryService');
const { success } = require('../utils/response');

const categorySchema = {
  body: Joi.object({
    name: Joi.string().min(1).max(50).required(),
    sortOrder: Joi.number().integer().min(0).max(1000000),
    status: Joi.number().integer().valid(0, 1).default(1)
  })
};

async function adminList(req, res, next) {
  try {
    const { keyword = '' } = req.query;
    const data = await categoryService.adminList(keyword);
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

async function adminCreate(req, res, next) {
  try {
    const r = await categoryService.adminCreate({
      name: req.body.name,
      sort_order: req.body.sortOrder ?? 0,
      status: req.body.status
    });
    return success(res, r, '创建成功');
  } catch (e) {
    next(e);
  }
}

async function adminUpdate(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.json({ code: 1001, message: '参数错误', data: null });
    await categoryService.adminUpdate(id, {
      name: req.body.name,
      sort_order: req.body.sortOrder ?? 0,
      status: req.body.status
    });
    return success(res, { ok: true }, '更新成功');
  } catch (e) {
    next(e);
  }
}

async function adminDelete(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.json({ code: 1001, message: '参数错误', data: null });
    const r = await categoryService.adminDelete(id);
    return success(res, r, `删除成功，已移出 ${r.moved} 个商品`);
  } catch (e) {
    next(e);
  }
}

module.exports = { categorySchema, adminList, adminCreate, adminUpdate, adminDelete };