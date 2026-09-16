// 生成业务订单号：时间戳 + 用户ID片段 + 随机串，防重复
function generateOrderNo(userId) {
  const ts = Date.now().toString();
  const uid = (userId || 0).toString().padStart(6, '0').slice(-6);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${ts}${uid}${rand}`;
}

module.exports = { generateOrderNo };
