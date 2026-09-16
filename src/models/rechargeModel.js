const { query, execute } = require('../config/db');

// 新建充值申请（待确认）
async function create(userId, amount, remark = '') {
  const r = await execute(
    'INSERT INTO recharge_requests (user_id, amount, remark) VALUES (?, ?, ?)',
    [userId, amount, remark || null]
  );
  return r.insertId;
}

// 我的充值申请
async function listMine(userId, { page = 1, size = 20 }) {
  const offset = (page - 1) * size;
  const rows = await query(
    `SELECT id, amount, status, remark, operator_id, confirmed_at, created_at
     FROM recharge_requests WHERE user_id = ?
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    [userId, size, offset]
  );
  const total = (await query('SELECT COUNT(*) AS c FROM recharge_requests WHERE user_id = ?', [userId]))[0].c;
  return { list: rows, total };
}

// 后台列表（含用户名）
async function listForAdmin({ keyword = '', status = -1, page = 1, size = 20 }) {
  const offset = (page - 1) * size;
  const conds = [];
  const params = [];
  if (status >= 0) {
    conds.push('r.status = ?');
    params.push(status);
  }
  if (keyword) {
    conds.push('(u.username LIKE ? OR u.email LIKE ? OR r.id LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const whereSql = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const rows = await query(
    `SELECT r.id, r.user_id, r.amount, r.status, r.remark, r.operator_id, r.confirmed_at, r.created_at,
            u.username, u.email
     FROM recharge_requests r
     LEFT JOIN users u ON u.id = r.user_id
     ${whereSql}
     ORDER BY (r.status = 0) DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );
  const total = (await query(
    `SELECT COUNT(*) AS c FROM recharge_requests r LEFT JOIN users u ON u.id = r.user_id ${whereSql}`,
    params
  ))[0].c;
  return { list: rows, total };
}

// 行锁查单条申请（事务内）
async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.execute(
    'SELECT id, user_id, amount, status FROM recharge_requests WHERE id = ? LIMIT 1 FOR UPDATE',
    [id]
  );
  return rows[0] || null;
}

// 标记申请已确认
async function markConfirmed(conn, id, operatorId) {
  await conn.execute(
    "UPDATE recharge_requests SET status = 1, operator_id = ?, confirmed_at = NOW() WHERE id = ?",
    [operatorId, id]
  );
}

// 标记申请已拒绝
async function reject(conn, id, operatorId) {
  await conn.execute(
    "UPDATE recharge_requests SET status = 2, operator_id = ?, confirmed_at = NOW() WHERE id = ? AND status = 0",
    [operatorId, id]
  );
}

module.exports = { create, listMine, listForAdmin, findByIdForUpdate, markConfirmed, reject };