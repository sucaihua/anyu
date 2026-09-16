const { query, execute } = require('../config/db');

async function createOrder(conn, { orderNo, userId, productId, productName, amount, status = 1 }) {
  const [r] = await conn.execute(
    `INSERT INTO orders (order_no, user_id, product_id, product_name, amount, status, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [orderNo, userId, productId, productName, amount, status]
  );
  return r.insertId;
}

async function findByOrderNo(orderNo) {
  const rows = await query('SELECT * FROM orders WHERE order_no = ? LIMIT 1', [orderNo]);
  return rows[0] || null;
}

async function findById(id) {
  const rows = await query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function listByUser(userId, { page = 1, size = 20 }) {
  const offset = (page - 1) * size;
  const rows = await query(
    `SELECT id, order_no, product_id, product_name, amount, status, created_at, paid_at
     FROM orders WHERE user_id = ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [userId, size, offset]
  );
  const total = (await query('SELECT COUNT(*) AS c FROM orders WHERE user_id = ?', [userId]))[0].c;
  return { list: rows, total };
}

async function listForAdmin({ keyword = '', status = -1, page = 1, size = 20 }) {
  const offset = (page - 1) * size;
  const conditions = [];
  const params = [];
  if (keyword) {
    conditions.push('(order_no LIKE ? OR product_name LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like);
  }
  if (status >= 0) {
    conditions.push('status = ?');
    params.push(status);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const listParams = [...params, size, offset];
  const rows = await query(
    `SELECT o.id, o.order_no, o.user_id, u.username, o.product_id, o.product_name, o.amount, o.status, o.created_at, o.paid_at
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ${where}
     ORDER BY o.id DESC
     LIMIT ? OFFSET ?`,
    listParams
  );
  const total = (await query(`SELECT COUNT(*) AS c FROM orders ${where}`, params))[0].c;
  return { list: rows, total };
}

async function updateStatus(id, status) {
  const r = await execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  return r.affectedRows;
}

module.exports = {
  createOrder,
  findByOrderNo,
  findById,
  listByUser,
  listForAdmin,
  updateStatus
};
