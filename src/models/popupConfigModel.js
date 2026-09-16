const { query, execute } = require('../config/db');

async function getConfig() {
  const rows = await query('SELECT * FROM order_popup_config WHERE id = 1 LIMIT 1');
  return rows[0] || { id: 1, enabled: 0, title: '下单提示', content: '请确认订单信息无误后再下单。' };
}

async function updateConfig({ enabled, title, content, updatedBy }) {
  const r = await execute(
    `UPDATE order_popup_config SET enabled = ?, title = ?, content = ?, updated_by = ?, updated_at = NOW() WHERE id = 1`,
    [enabled, title, content, updatedBy]
  );
  return r.affectedRows;
}

module.exports = { getConfig, updateConfig };
