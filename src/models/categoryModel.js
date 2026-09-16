const { query, execute } = require('../config/db');

// 前台：启用中的分类列表（含商品数可选项）
async function listActive() {
  return query(
    `SELECT c.id, c.name, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.status = 1
     WHERE c.status = 1
     GROUP BY c.id, c.name
     ORDER BY c.sort_order ASC, c.id ASC`
  );
}

// 后台：全部分类 + 商品计数
async function listForAdmin(keyword = '') {
  const where = keyword ? 'WHERE c.name LIKE ?' : '';
  const params = keyword ? [`%${keyword}%`] : [];
  const rows = await query(
    `SELECT c.id, c.name, c.sort_order, c.status, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     ${where}
     GROUP BY c.id, c.name, c.sort_order, c.status
     ORDER BY c.sort_order ASC, c.id ASC`,
    params
  );
  return rows;
}

async function findById(id) {
  const rows = await query('SELECT id, name, sort_order, status FROM categories WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function create({ name, sort_order = 0, status = 1 }) {
  const r = await execute(
    'INSERT INTO categories (name, sort_order, status) VALUES (?, ?, ?)',
    [name, sort_order, status]
  );
  return r.insertId;
}

async function update(id, { name, sort_order, status }) {
  const r = await execute(
    'UPDATE categories SET name = ?, sort_order = ?, status = ? WHERE id = ?',
    [name, sort_order, status, id]
  );
  return r.affectedRows;
}

// 删除分类：将其商品置空。返回受影响商品数
async function remove(id) {
  const affected = await execute('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
  await execute('DELETE FROM categories WHERE id = ?', [id]);
  return affected.affectedRows;
}

module.exports = { listActive, listForAdmin, findById, create, update, remove };