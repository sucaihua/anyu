const { query, execute } = require('../config/db');

async function getConfig() {
  const rows = await query('SELECT * FROM order_popup_config WHERE id = 1 LIMIT 1');
  return rows[0] || {
    id: 1, enabled: 0, title: '充值提示',
    content: '请按以下银行卡信息转账，转账后提交申请等待后台确认到账。',
    account_name: '', bank_card: '', bank_name: ''
  };
}

async function updateConfig({ enabled, title, content, accountName, bankCard, bankName, updatedBy }) {
  const r = await execute(
    `UPDATE order_popup_config SET enabled = ?, title = ?, content = ?, account_name = ?, bank_card = ?, bank_name = ?, updated_by = ?, updated_at = NOW() WHERE id = 1`,
    [enabled, title, content, accountName, bankCard, bankName, updatedBy]
  );
  return r.affectedRows;
}

module.exports = { getConfig, updateConfig };
