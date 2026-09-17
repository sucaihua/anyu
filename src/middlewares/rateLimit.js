const rateLimit = require('express-rate-limit');
const config = require('../config');

// 限流总开关：环境变量 RATE_LIMIT_ENABLED=true 开启，默认关闭（暂时停用限流）
// 之后要恢复限流，把 .env 里 RATE_LIMIT_ENABLED 设为 true 即可
const ENABLED = (process.env.RATE_LIMIT_ENABLED || 'false').toLowerCase() === 'true';

// 全局接口限流
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试', data: null },
  skip: () => !ENABLED
});

// 登录/注册接口更严格限流
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 30, // 15 分钟 30 次
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '操作过于频繁，请稍后再试', data: null },
  skip: () => !ENABLED
});

module.exports = { apiLimiter, authLimiter };
