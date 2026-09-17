const productModel = require('../models/productModel');
const { getConnection } = require('../config/db');
const cache = require('../utils/cache');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');
const logger = require('../utils/logger');

const KEY_LIST = 'products:list';
const KEY_DETAIL = (id) => `product:${id}`;
const TTL = 60;

// 把 SKU 行的 spec_json 字符串解析为对象，便于前端使用
function normalizeSkus(skus = []) {
  return skus.map((s) => ({
    id: s.id,
    productId: s.product_id,
    specJson: typeof s.spec_json === 'string' ? safeParse(s.spec_json) : (s.spec_json || {}),
    specDesc: s.spec_desc || '',
    price: Number(s.price),
    stock: Number(s.stock),
    status: Number(s.status)
  }));
}

function safeParse(str) {
  try { return JSON.parse(str) || {}; } catch { return {}; }
}

// 上架商品列表（缓存）
async function listOnSale() {
  const cached = await cache.get(KEY_LIST);
  if (cached) return cached;
  const list = await productModel.listOnSale();
  const norm = list.map((p) => ({ ...p, skus: normalizeSkus(p.skus) }));
  await cache.set(KEY_LIST, norm, TTL);
  return norm;
}

async function getDetail(id) {
  const key = KEY_DETAIL(id);
  const cached = await cache.get(key);
  if (cached) return cached;
  const p = await productModel.findById(id);
  if (!p) throw new AppError(ERR.NOT_FOUND, '商品不存在');
  p.skus = normalizeSkus(p.skus);
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

// 规范化入参的 skus
function toSkuRows(skus = []) {
  if (!Array.isArray(skus)) return [];
  return skus
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      specJson: typeof s.specJson === 'string' ? safeParse(s.specJson) : (s.specJson || {}),
      specDesc: s.specDesc || buildSpecDesc(s.specJson),
      price: Number(s.price) || 0,
      stock: Number(s.stock) || 0,
      status: Number(s.status) === 0 ? 0 : 1
    }));
}

// 由 specJson 自动生成展示文本，如 {"颜色":"红","尺码":"S"} -> "颜色:红 尺码:S"
function buildSpecDesc(specJson) {
  const obj = typeof specJson === 'string' ? safeParse(specJson) : (specJson || {});
  return Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(' ');
}

async function adminCreate(data) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const productId = await productModel.createInConn(conn, toModelData(data));
    const skus = toSkuRows(data.skus);
    if (skus.length) {
      await productModel.replaceSkus(conn, productId, skus);
    }
    await conn.commit();
    await cache.del('products:list');
    return { id: productId };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.isAppError) throw err;
    logger.error('[product] adminCreate error', { err: err.message });
    throw new AppError(ERR.SERVER, '创建商品失败');
  } finally {
    conn.release();
  }
}

async function adminUpdate(id, data) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const affected = await productModel.updateInConn(conn, id, toModelData(data));
    if (!affected) {
      await conn.rollback();
      throw new AppError(ERR.NOT_FOUND, '商品不存在');
    }
    // skus 字段存在（无论是否为空数组）才覆盖 SKU；未传则不动
    if (Array.isArray(data.skus)) {
      await productModel.replaceSkus(conn, id, toSkuRows(data.skus));
    }
    await conn.commit();
    await cache.del('products:list');
    await cache.del('product:' + id);
    return { ok: true };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.isAppError) throw err;
    logger.error('[product] adminUpdate error', { err: err.message });
    throw new AppError(ERR.SERVER, '更新商品失败');
  } finally {
    conn.release();
  }
}

async function adminList(params) {
  return productModel.listForAdmin(params);
}

module.exports = { listOnSale, getDetail, adminCreate, adminUpdate, adminList, normalizeSkus };
