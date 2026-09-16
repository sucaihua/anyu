const Joi = require('joi');
const productService = require('../services/productService');
const categoryService = require('../services/categoryService');
const { success } = require('../utils/response');

async function list(req, res, next) {
  try {
    const list = await productService.listOnSale();
    return success(res, list);
  } catch (e) {
    next(e);
  }
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(200).json({ code: 1001, message: '参数错误', data: null });
    const p = await productService.getDetail(id);
    return success(res, p);
  } catch (e) {
    next(e);
  }
}

// 公开：启用中的商品分类
async function listCategories(req, res, next) {
  try {
    const categories = await categoryService.listActive();
    return success(res, categories);
  } catch (e) {
    next(e);
  }
}

const productSchema = {
  body: Joi.object({
    name: Joi.string().min(1).max(120).required(),
    price: Joi.number().min(0).max(99999999.99).required(),
    stock: Joi.number().integer().min(0).max(100000000).required(),
    cover: Joi.string().max(255).allow('', null),
    description: Joi.string().allow('', null),
    categoryId: Joi.number().integer().allow(null),
    status: Joi.number().integer().valid(0, 1).default(1)
  })
};

async function adminCreate(req, res, next) {
  try {
    const r = await productService.adminCreate(req.body);
    return success(res, r, '创建成功');
  } catch (e) {
    next(e);
  }
}

async function adminUpdate(req, res, next) {
  try {
    const id = Number(req.params.id);
    await productService.adminUpdate(id, req.body);
    return success(res, { ok: true }, '更新成功');
  } catch (e) {
    next(e);
  }
}

async function adminList(req, res, next) {
  try {
    const { keyword = '', categoryId = '', page = 1, size = 20 } = req.query;
    const data = await productService.adminList({
      keyword,
      categoryId: categoryId ? Number(categoryId) : null,
      page: Number(page),
      size: Number(size)
    });
    return success(res, data);
  } catch (e) {
    next(e);
  }
}

module.exports = { list, detail, listCategories, adminCreate, adminUpdate, adminList, productSchema };
