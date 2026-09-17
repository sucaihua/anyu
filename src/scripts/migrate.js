// 增量迁移脚本：仅新增缺失的表/列，不破坏已有数据
// 用法：node src/scripts/migrate.js
const mysql = require('mysql2/promise');
const config = require('../config');

async function main() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true
  });

  // 1. mail_config 邮件通知配置表
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`mail_config\` (
      \`id\` INT NOT NULL DEFAULT 1,
      \`enabled\` TINYINT NOT NULL DEFAULT 0 COMMENT '是否开启下单邮箱提醒',
      \`host\` VARCHAR(120) NOT NULL DEFAULT '' COMMENT 'SMTP 主机',
      \`port\` INT NOT NULL DEFAULT 465 COMMENT 'SMTP 端口',
      \`secure\` TINYINT NOT NULL DEFAULT 1 COMMENT '是否 SSL 连接',
      \`mail_user\` VARCHAR(120) NOT NULL DEFAULT '' COMMENT 'SMTP 账号',
      \`mail_pass\` VARCHAR(120) NOT NULL DEFAULT '' COMMENT 'SMTP 授权码',
      \`from_name\` VARCHAR(60) NOT NULL DEFAULT 'Anyu',
      \`from_email\` VARCHAR(120) NOT NULL DEFAULT '' COMMENT '发件邮箱',
      \`notify_user\` TINYINT NOT NULL DEFAULT 1 COMMENT '是否给下单用户发邮件',
      \`admin_to\` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '额外通知的管理员邮箱，多个用英文逗号分隔',
      \`updated_by\` BIGINT NULL,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮件通知配置'
  `);
  await conn.query('INSERT IGNORE INTO `mail_config` (`id`) VALUES (1)');
  // mail_config 增加充值邮件提醒开关（幂等）
  const mc = await conn.query(`SHOW COLUMNS FROM \`mail_config\` LIKE 'notify_recharge'`);
  if (!mc[0].length) {
    await conn.query(`ALTER TABLE \`mail_config\`
      ADD COLUMN \`notify_recharge\` TINYINT NOT NULL DEFAULT 1 COMMENT '是否开启充值邮件提醒' AFTER \`notify_user\``);
  }

  // 2. categories 商品分类表 + 默认分类
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`categories\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(50) NOT NULL,
      \`sort_order\` INT NOT NULL DEFAULT 0,
      \`status\` TINYINT NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_name\` (\`name\`),
      KEY \`idx_sort\` (\`sort_order\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类'
  `);
  await conn.query(`INSERT IGNORE INTO \`categories\` (\`name\`, \`sort_order\`) VALUES ('未分类', 9999)`);

  // 3. products 增加 category_id 列（幂等：不存在才加）
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`products\` LIKE 'category_id'`);
  if (!cols.length) {
    await conn.query(`ALTER TABLE \`products\`
      ADD COLUMN \`category_id\` INT NULL AFTER \`id\`,
      ADD KEY \`idx_category\` (\`category_id\`)`);
    // 尝试建外键（如已有依赖冲突则跳过，外键非必需）
    try {
      await conn.query(`ALTER TABLE \`products\`
        ADD CONSTRAINT \`fk_products_category\`
        FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE SET NULL`);
    } catch (e) {
      console.warn('[migrate] 跳过外键约束:', e.message);
    }
  }
  // 4. 回填：让现有商品归入「未分类」
  const def = await conn.query(`SELECT id FROM \`categories\` WHERE name='未分类' LIMIT 1`);
  const defId = def[0][0].id;
  await conn.query(`UPDATE \`products\` SET \`category_id\` = ? WHERE \`category_id\` IS NULL`, [defId]);

  // 5. recharge_requests 充值申请单
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`recharge_requests\` (
      \`id\` BIGINT NOT NULL AUTO_INCREMENT,
      \`user_id\` BIGINT NOT NULL,
      \`amount\` DECIMAL(12,2) NOT NULL,
      \`status\` TINYINT NOT NULL DEFAULT 0 COMMENT '0 待确认 / 1 已到账 / 2 已拒绝',
      \`remark\` VARCHAR(255) NULL,
      \`operator_id\` BIGINT NULL COMMENT '处理该申请的管理员',
      \`confirmed_at\` DATETIME NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_user\` (\`user_id\`),
      KEY \`idx_status\` (\`status\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户充值申请单'
  `);

  // 6. order_popup_config 增加银行卡收款字段（幂等）
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`order_popup_config\` (
      \`id\` INT NOT NULL DEFAULT 1,
      \`enabled\` TINYINT NOT NULL DEFAULT 0,
      \`title\` VARCHAR(120) NULL,
      \`content\` TEXT NULL,
      \`account_name\` VARCHAR(120) NULL,
      \`bank_card\` VARCHAR(120) NULL,
      \`bank_name\` VARCHAR(120) NULL,
      \`updated_by\` BIGINT NULL,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='下单/充值弹窗配置（含银行卡收款信息）'
  `);
  await conn.query('INSERT IGNORE INTO `order_popup_config` (`id`, `enabled`, `title`, `content`) VALUES (1, 0, \'充值提示\', \'请按以下银行卡信息转账，转账后提交申请等待后台确认到账。\')');
  for (const col of ['account_name', 'bank_card', 'bank_name']) {
    const c = await conn.query(`SHOW COLUMNS FROM \`order_popup_config\` LIKE '${col}'`);
    if (!c[0].length) {
      const colType = col === 'bank_card' ? 'VARCHAR(120) NULL' : 'VARCHAR(120) NULL';
      await conn.query(`ALTER TABLE \`order_popup_config\` ADD COLUMN \`${col}\` ${colType} AFTER \`content\``);
    }
  }

  // 7. products 表增加 spec_json 字段（规格维度配置，如 {"颜色":["红","蓝"],"尺码":["S","M"]}）
  const pc = await conn.query(`SHOW COLUMNS FROM \`products\` LIKE 'spec_json'`);
  if (!pc[0].length) {
    await conn.query(`ALTER TABLE \`products\`
      ADD COLUMN \`spec_json\` TEXT NULL COMMENT '规格维度配置 JSON，空或无字段表示无规格' AFTER \`description\``);
  }

  // 8. orders 表增加 spec_desc 快照字段（幂等）
  const oc2 = await conn.query(`SHOW COLUMNS FROM \`orders\` LIKE 'spec_desc'`);
  if (!oc2[0].length) {
    await conn.query(`ALTER TABLE \`orders\`
      ADD COLUMN \`spec_desc\` VARCHAR(255) NULL COMMENT '用户所选规格快照文本' AFTER \`product_name\``);
  }

  await conn.end();
  console.log('[migrate] 完成，已有数据未受影响');
}

main().catch((err) => {
  console.error('[migrate] 失败:', err.message);
  process.exit(1);
});