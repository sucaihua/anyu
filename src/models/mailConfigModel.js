const { query, execute } = require('../config/db');

async function getConfig() {
  const rows = await query(
    `SELECT id, enabled, host, port, secure, mail_user, mail_pass, from_name, from_email,
            notify_user, notify_recharge, admin_to, updated_at
     FROM mail_config WHERE id = 1 LIMIT 1`
  );
  const cfg = rows[0];
  if (!cfg) return null;
  // 密码绝不回传前端，仅标记是否已配置
  const { mail_pass, ...safe } = cfg;
  return { ...safe, has_pass: !!mail_pass };
}

// 供发送模块内部使用：返回含密码的完整配置
async function getSecretConfig() {
  const rows = await query('SELECT * FROM mail_config WHERE id = 1 LIMIT 1');
  return rows[0] || null;
}

// 更新配置：mail_pass 传空字符串表示不改动原密码
async function updateConfig(data) {
  const r = await execute(
    `INSERT INTO mail_config
        (id, enabled, host, port, secure, mail_user, mail_pass, from_name, from_email,
         notify_user, notify_recharge, admin_to, updated_by)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled),
        host = VALUES(host),
        port = VALUES(port),
        secure = VALUES(secure),
        mail_user = VALUES(mail_user),
        mail_pass = IF(VALUES(mail_pass) = '', mail_pass, VALUES(mail_pass)),
        from_name = VALUES(from_name),
        from_email = VALUES(from_email),
        notify_user = VALUES(notify_user),
        notify_recharge = VALUES(notify_recharge),
        admin_to = VALUES(admin_to),
        updated_by = VALUES(updated_by)`,
    [
      data.enabled, data.host, data.port, data.secure, data.mail_user, data.mail_pass || '',
      data.from_name, data.from_email, data.notify_user, data.notify_recharge, data.admin_to || '', data.updatedBy
    ]
  );
  return r.affectedRows;
}

module.exports = { getConfig, getSecretConfig, updateConfig };