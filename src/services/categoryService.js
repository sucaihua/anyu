const categoryModel = require('../models/categoryModel');
const cache = require('../utils/cache');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');

const KEY_LIST = 'categories:active';
const TTL = 60;

function normalizeUnique(err) {
  // MySQL 唯一键 uk_name 冲突 => 分类名称重复
  return /uk_name|Duplicate entry/.test((err && err.message) || '');
}

async function listActive() {
  const cached = await cache.get(KEY_LIST);
  if (cached) return cached;
  const list = await categoryModel.listActive();
  await cache.set(KEY_LIST, list, TTL);
  return list;
}

async function adminList(keyword = '') {
  return categoryModel.listForAdmin(keyword);
}

async function adminCreate(data) {
  try {
    const id = await categoryModel.create(data);
    await cache.del(KEY_LIST);
    await cache.del('products:list'); // 分类变化会影响前台展示结构，一并失效
    return { id };
  } catch (e) {
    if (normalizeUnique(e)) throw new AppError(ERR.PARAMS, '分类名称已存在');
    throw e;
  }
}

async function adminUpdate(id, data) {
  const affected = await categoryModel.update(id, data);
  if (!affected) throw new AppError(ERR.NOT_FOUND, '分类不存在');
  await cache.del(KEY_LIST);
  await cache.del('products:list');
  return { ok: true };
}

async function adminDelete(id) {
  const cat = await categoryModel.findById(id);
  if (!cat) throw new AppError(ERR.NOT_FOUND, '分类不存在');
  if (cat.name === '未分类') throw new AppError(ERR.PARAMS, '「未分类」为系统默认分组，不可删除');
  const moved = await categoryModel.remove(id);
  await cache.del(KEY_LIST);
  await cache.del('products:list');
  return { moved };
}

module.exports = { listActive, adminList, adminCreate, adminUpdate, adminDelete };