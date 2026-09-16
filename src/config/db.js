const mysql = require('mysql2/promise');
const config = require('../config');

// 连接池：所有 SQL 使用 execute（Prepared Statement），杜绝 SQL 注入
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  charset: config.db.charset,
  timezone: config.db.timezone,
  waitForConnections: true,
  queueLimit: 0,
  namedPlaceholders: false
});

// 获取连接（用于事务）
async function getConnection() {
  return pool.getConnection();
}

// 参数兜底：undefined → null（mysql2 拒绝 undefined，要求显式 null 表示 SQL NULL）
function normalizeParams(params) {
  if (!Array.isArray(params)) return params;
  return params.map((p) => (p === undefined ? null : p));
}

// 简单查询封装（带参数化，禁止拼字符串）
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, normalizeParams(params));
  return rows;
}

// 写入返回辅助
async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, normalizeParams(params));
  return result;
}

module.exports = { pool, getConnection, query, execute };
