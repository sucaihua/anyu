const productModel = require('../models/productModel');
const cache = require('../utils/cache');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');

const KEY_LIST = 'products:list';
const KEY_DETAIL = (id) => `product:${id}`;
const TTL = 60;

// 上架商品列表（缓存）
async function listOnSale() {
  const cached = await cache.get(KEY_LIST);
  if (cached) return cached;
  const list = await productModel.listOnSale();
  await cache.set(KEY_LIST, list, TTL);
  return list;
}

async function getDetail(id) {
  const key = KEY_DETAIL(id);
  const cached = await cache.get(key);
  if (cached) return cached;
  const p = await productModel.findById(id);
  if (!p) throw new AppError(ERR.NOT_FOUND, '商品不存在');
  await cache.set(key, p, TTL);
  return p;
}

function toModelData(data) {
  return {
    name: data.name,
    price: data.price,
    stock: data.stock,
    cover: data.cover ?? null,
    description: data.description ?? '',
    category_id: data.categoryId ?? null,
    status: data.status
  };
}

async function adminCreate(data) {
  const id = await productModel.create(toModelData(data));
  await cache.del('products:list');
  return { id };
}

async function adminUpdate(id, data) {
  const affected = await productModel.update(id, toModelData(data));
  if (!affected) throw new AppError(ERR.NOT_FOUND, '商品不存在');
  // 失效相关缓存
  await cache.del('products:list');
  await cache.del('product:' + id);
  return { ok: true };
}

async function adminList(params) {
  return productModel.listForAdmin(params);
}

module.exports = { listOnSale, getDetail, adminCreate, adminUpdate, adminList };
