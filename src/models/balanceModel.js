const { query } = require('../config/db');
const { getConnection } = require('../config/db');

// 余额初始化（注册时事务内调用）
async function initBalance(conn, userId) {
  await conn.execute(
    'INSERT INTO balances (user_id, amount, version) VALUES (?, 0, 0)',
    [userId]
  );
}

// 查余额（展示用）
async function getBalance(userId) {
  const list = await query('SELECT amount, version FROM balances WHERE user_id = ? LIMIT 1', [userId]);
  return list[0] || { amount: 0, version: 0 };
}

// 手动加余额（事务里调用），写流水也在事务里
async function increaseBalance(conn, userId, amount) {
  await conn.execute(
    'UPDATE balances SET amount = amount + ?, version = version + 1 WHERE user_id = ?',
    [amount, userId]
  );
}

// 下单扣余额（核心：原子扣减，amount >= ? 兜底）
// 返回影响行数：1 成功，0 余额不足
async function decreaseBalance(conn, userId, amount) {
  const [result] = await conn.execute(
    'UPDATE balances SET amount = amount - ?, version = version + 1 WHERE user_id = ? AND amount >= ?',
    [amount, userId, amount]
  );
  return result.affectedRows;
}

// 写流水（事务里调用）
async function insertRecord(conn, { userId, type, amount, balanceAfter, refOrderId = null, operatorId = null, remark = '' }) {
  await conn.execute(
    `INSERT INTO balance_records (user_id, type, amount, balance_after, ref_order_id, operator_id, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, type, amount, balanceAfter, refOrderId, operatorId, remark]
  );
}

// 流水分页（按 user_id 查，可按 type 筛选）
async function listRecords(userId, { type = 0, page = 1, size = 20 }) {
  const offset = (page - 1) * size;
  const useType = type > 0;
  const where = useType ? 'WHERE user_id = ? AND type = ?' : 'WHERE user_id = ?';
  const countParams = useType ? [userId, type] : [userId];
  const listParams = useType ? [userId, type, size, offset] : [userId, size, offset];

  const rows = await query(
    `SELECT id, user_id, type, amount, balance_after, ref_order_id, operator_id, remark, created_at
     FROM balance_records ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    listParams
  );
  const total = (await query(`SELECT COUNT(*) AS c FROM balance_records ${where}`, countParams))[0].c;
  return { list: rows, total };
}

module.exports = {
  initBalance,
  getBalance,
  increaseBalance,
  decreaseBalance,
  insertRecord,
  listRecords
};
