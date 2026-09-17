const { query, execute } = require('../config/db');

async function getConfig() {
  const rows = await query('SELECT * FROM home_popup_config WHERE id = 1 LIMIT 1');
  return rows[0] || {
    id: 1, enabled: 0, title: '公告', content: '',
    image_url: '', trigger_mode: 'first', interval_minutes: 30
  };
}

async function updateConfig({ enabled, title, content, imageUrl, triggerMode, intervalMinutes, updatedBy }) {
  const r = await execute(
    `UPDATE home_popup_config
     SET enabled = ?, title = ?, content = ?, image_url = ?, trigger_mode = ?, interval_minutes = ?, updated_by = ?, updated_at = NOW()
     WHERE id = 1`,
    [enabled, title, content, imageUrl, triggerMode, intervalMinutes, updatedBy]
  );
  return r.affectedRows;
}

module.exports = { getConfig, updateConfig };
