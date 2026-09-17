const { query, execute, getConnection } = require('../config/db');

// 查询某商品的启用 SKU 列表
async function listSkus(productId) {
  return query(
    `SELECT id, product_id, spec_json, spec_desc, price, stock, status
     FROM product_skus
     WHERE product_id = ? AND status = 1
     ORDER BY id ASC`,
    [productId]
  );
}

// 查询某商品的全部 SKU（含停用，后台用）
async function listSkusAll(productId) {
  return query(
    `SELECT id, product_id, spec_json, spec_desc, price, stock, status, created_at, updated_at
     FROM product_skus
     WHERE product_id = ?
     ORDER BY id ASC`,
    [productId]
  );
}

// 根据 id 查 SKU
async function findSkuById(id) {
  const rows = await query(
    `SELECT id, product_id, spec_json, spec_desc, price, stock, status
     FROM product_skus WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// 行锁查 SKU（事务里调用）
async function findSkuForUpdate(conn, skuId) {
  const [rows] = await conn.execute(
    `SELECT id, product_id, spec_json, spec_desc, price, stock, status
     FROM product_skus WHERE id = ? LIMIT 1 FOR UPDATE`,
    [skuId]
  );
  return rows[0] || null;
}

// 原子扣 SKU 库存
async function decreaseSkuStock(conn, skuId) {
  const [r] = await conn.execute(
    'UPDATE product_skus SET stock = stock - 1 WHERE id = ? AND stock > 0',
    [skuId]
  );
  return r.affectedRows;
}

// 事务中替换某商品的全部 SKU（先删后插）
// skus: [{ specJson, specDesc, price, stock, status }]
async function replaceSkus(conn, productId, skus = []) {
  await conn.execute('DELETE FROM product_skus WHERE product_id = ?', [productId]);
  for (const s of skus) {
    await conn.execute(
      `INSERT INTO product_skus (product_id, spec_json, spec_desc, price, stock, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        productId,
        typeof s.specJson === 'string' ? s.specJson : JSON.stringify(s.specJson || {}),
        s.specDesc || '',
        Number(s.price) || 0,
        Number(s.stock) || 0,
        Number(s.status) === 0 ? 0 : 1
      ]
    );
  }
}

async function listOnSale() {
  const rows = await query(
    `SELECT p.id, p.name, p.price, p.stock, p.cover, p.description, p.category_id,
            p.status, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.status = 1 ORDER BY p.id DESC`
  );
  // 附加每个商品的 SKU 列表（启用中），供前台判断是否需要选规格
  for (const p of rows) {
    p.skus = await listSkus(p.id);
  }
  return rows;
}

async function findById(id) {
  const rows = await query(
    `SELECT p.id, p.name, p.price, p.stock, p.cover, p.description, p.category_id,
            p.status, p.created_at, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? LIMIT 1`,
    [id]
  );
  const p = rows[0] || null;
  if (p) {
    p.skus = await listSkus(p.id);
  }
  return p;
}

async function listForAdmin({ keyword = '', categoryId = null, page = 1, size = 20 }) {
  const offset = (page - 1) * size;
  const conds = [];
  const params = [];
  if (keyword) {
    conds.push('p.name LIKE ?');
    params.push(`%${keyword}%`);
  }
  if (categoryId) {
    conds.push('p.category_id = ?');
    params.push(categoryId);
  }
  const whereSql = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = await query(
    `SELECT p.id, p.name, p.price, p.stock, p.cover, p.description, p.status,
            p.category_id, p.created_at, p.updated_at, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  const total = keyword
    ? (await query(`SELECT COUNT(*) AS c FROM products p ${whereSql}`, params))[0].c
    : (await query('SELECT COUNT(*) AS c FROM products'))[0].c;
  return { list: rows, total };
}

async function create({ name, price, stock, cover, description, category_id = null, status = 1 }) {
  const r = await execute(
    `INSERT INTO products (category_id, name, price, stock, cover, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [category_id, name, price, stock, cover, description, status]
  );
  return r.insertId;
}

async function update(id, { name, price, stock, cover, description, category_id = null, status }) {
  const r = await execute(
    `UPDATE products
     SET name = ?, price = ?, stock = ?, cover = ?, description = ?, category_id = ?, status = ?
     WHERE id = ?`,
    [name, price, stock, cover, description, category_id, status, id]
  );
  return r.affectedRows;
}

// 事务内执行版本（与 SKU 同一事务）
async function createInConn(conn, { name, price, stock, cover, description, category_id = null, status = 1 }) {
  const [r] = await conn.execute(
    `INSERT INTO products (category_id, name, price, stock, cover, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [category_id, name, price, stock, cover, description, status]
  );
  return r.insertId;
}

async function updateInConn(conn, id, { name, price, stock, cover, description, category_id = null, status }) {
  const [r] = await conn.execute(
    `UPDATE products
     SET name = ?, price = ?, stock = ?, cover = ?, description = ?, category_id = ?, status = ?
     WHERE id = ?`,
    [name, price, stock, cover, description, category_id, status, id]
  );
  return r.affectedRows;
}

// 行锁查商品（事务里调用）
async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.execute(
    `SELECT id, name, price, stock, status FROM products WHERE id = ? LIMIT 1 FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

// 原子扣库存
async function decreaseStock(conn, id) {
  const [r] = await conn.execute(
    'UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0',
    [id]
  );
  return r.affectedRows;
}

module.exports = {
  listSkus,
  listSkusAll,
  findSkuById,
  findSkuForUpdate,
  decreaseSkuStock,
  replaceSkus,
  listOnSale,
  findById,
  listForAdmin,
  create,
  update,
  createInConn,
  updateInConn,
  findByIdForUpdate,
  decreaseStock
};
