const { query, execute } = require('../config/db');

async function listOnSale() {
  return query(
    `SELECT p.id, p.name, p.price, p.stock, p.cover, p.description, p.category_id,
            p.status, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.status = 1 ORDER BY p.id DESC`
  );
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
  return rows[0] || null;
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
  listOnSale,
  findById,
  listForAdmin,
  create,
  update,
  findByIdForUpdate,
  decreaseStock
};
