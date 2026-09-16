// 初始化数据库：建表 + 创建默认管理员
// 用法：node src/scripts/init-db.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const config = require('../config');

async function main() {
  // 1. 连 MySQL（不指定库）创建数据库
  const root = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password
  });

  const dbName = config.db.database;
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.end();

  // 2. 用库连接执行 schema.sql
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: dbName,
    multipleStatements: true
  });

  const schemaPath = path.join(__dirname, '../../db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await conn.query(sql);

  // 3. 创建默认管理员（若不存在）
  const [rows] = await conn.query('SELECT id FROM users WHERE username = ?', ['admin']);
  if (rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    const [r] = await conn.query(
      'INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, 1, 1)',
      ['admin', 'admin@anyu.local', hash]
    );
    const adminId = r.insertId;
    await conn.query('INSERT INTO balances (user_id, amount, version) VALUES (?, 0, 0)', [adminId]);
    console.log('默认管理员创建成功：admin / admin123');
  } else {
    console.log('管理员已存在，跳过创建');
  }

  await conn.end();
  console.log('数据库初始化完成');
}

main().catch((err) => {
  console.error('init-db error:', err.message);
  process.exit(1);
});
