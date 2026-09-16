const { execute, query } = require('../config/db');

async function findByUsername(username) {
  const rows = await query('SELECT id, username, email, password_hash, role, status FROM users WHERE username = ? LIMIT 1', [username]);
  return rows[0] || null;
}

async function findByEmail(email) {
  const rows = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const rows = await query('SELECT id, username, email, role, status, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// 查询账号状态，用于中间件实时校验（防止被禁用后凭旧 token 继续使用）
async function getStatus(id) {
  const rows = await query('SELECT status FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? rows[0].status : null;
}

// 注册用户（事务内由 service 调用，确保 balances 一起写入）
async function createUser({ username, email, passwordHash }) {
  const result = await execute(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, passwordHash]
  );
  return result.insertId;
}

async function listUsers({ keyword = '', page = 1, size = 20 }) {
  const offset = (page - 1) * size;
  const like = `%${keyword}%`;
  const where = keyword
    ? 'WHERE username LIKE ? OR email LIKE ?'
    : '';
  const params = keyword ? [like, like, size, offset] : [size, offset];
  const rows = await query(
    `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, IFNULL(b.amount, 0) AS balance
     FROM users u
     LEFT JOIN balances b ON b.user_id = u.id
     ${where}
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`,
    params
  );
  const totalRow = keyword
    ? (await query('SELECT COUNT(*) AS c FROM users WHERE username LIKE ? OR email LIKE ?', [like, like]))[0]
    : (await query('SELECT COUNT(*) AS c FROM users'))[0];
  return { list: rows, total: totalRow.c };
}

async function updateStatus(id, status) {
  const r = await execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
  return r.affectedRows;
}

async function setRole(id, role) {
  const r = await execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  return r.affectedRows;
}

// 刷新令牌
async function saveRefreshToken(userId, tokenHash, expiresAt) {
  await execute(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
}

async function findRefreshToken(tokenHash) {
  const rows = await query(
    'SELECT id, user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = ? LIMIT 1',
    [tokenHash]
  );
  return rows[0] || null;
}

async function revokeRefreshToken(id) {
  await execute('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', [id]);
}

async function revokeAllByUser(userId) {
  await execute('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
}

module.exports = {
  findByUsername,
  findByEmail,
  findById,
  getStatus,
  createUser,
  listUsers,
  updateStatus,
  setRole,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllByUser
};
