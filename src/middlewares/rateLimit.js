const rateLimit = require('express-rate-limit');
const config = require('../config');

// 全局接口限流
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试', data: null }
});

// 登录/注册接口更严格限流
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 30, // 15 分钟 30 次
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '操作过于频繁，请稍后再试', data: null }
});

module.exports = { apiLimiter, authLimiter };
