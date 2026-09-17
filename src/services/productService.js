const productModel = require('../models/productModel');
const cache = require('../utils/cache');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');
const logger = require('../utils/logger');

const KEY_LIST = 'products:list';
const KEY_DETAIL = (id) => `product:${id}`;
const TTL = 60;

function safeParse(str) {
  try { return str ? JSON.parse(str) : null; } catch { return null; }
}

// 规范化商品行：spec_json 字符串 -> specJson 对象；无规格返回 null
function normalizeProduct(p) {
  if (!p) return p;
  const obj = safeParse(p.spec_json);
  // 仅当对象非空且每个维度有非空数组时视为有效规格
  const hasSpec = obj && Object.keys(obj).length > 0
    && Object.values(obj).every((v) => Array.isArray(v) && v.length > 0);
  p.specJson = hasSpec ? obj : null;
  delete p.spec_json;
  return p;
}

async function listOnSale() {
  const cached = await cache.get(KEY_LIST);
  if (cached) return cached;
  const list = (await productModel.listOnSale()).map(normalizeProduct);
  await cache.set(KEY_LIST, list, TTL);
  return list;
}

async function getDetail(id) {
  const key = KEY_DETAIL(id);
  const cached = await cache.get(key);
  if (cached) return cached;
  const p = normalizeProduct(await productModel.findById(id));
  if (!p) throw new AppError(ERR.NOT_FOUND, '商品不存在');
  await cache.set(key, p, TTL);
  return p;
}

// 入参的 specJson 对象（{颜色:[红,蓝]}）-> 存储用 JSON 字符串；空则 null
function toStorageSpec(specJson) {
  if (!specJson || typeof specJson !== 'object') return null;
  const cleaned = {};
  for (const [k, v] of Object.entries(specJson)) {
    const vs = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    if (k && vs.length) cleaned[k] = vs;
  }
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
}

function toModelData(data) {
  return {
    name: data.name,
    price: data.price,
    stock: data.stock,
    cover: data.cover ?? null,
    description: data.description ?? '',
    category_id: data.categoryId ?? null,
    status: data.status,
    spec_json: toStorageSpec(data.specJson)
  };
}

async function adminCreate(data) {
  try {
    const id = await productModel.create(toModelData(data));
    await cache.del(KEY_LIST);
    return { id };
  } catch (err) {
    if (err.isAppError) throw err;
    logger.error('[product] adminCreate error', { err: err.message });
    throw new AppError(ERR.SERVER, '创建商品失败');
  }
}

async function adminUpdate(id, data) {
  try {
    const affected = await productModel.update(id, toModelData(data));
    if (!affected) throw new AppError(ERR.NOT_FOUND, '商品不存在');
    await cache.del(KEY_LIST);
    await cache.del(KEY_DETAIL(id));
    return { ok: true };
  } catch (err) {
    if (err.isAppError) throw err;
    logger.error('[product] adminUpdate error', { err: err.message });
    throw new AppError(ERR.SERVER, '更新商品失败');
  }
}

async function adminList(params) {
  const r = await productModel.listForAdmin(params);
  r.list = r.list.map(normalizeProduct);
  return r;
}

module.exports = { listOnSale, getDetail, adminCreate, adminUpdate, adminList };
