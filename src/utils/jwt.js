const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

// 生成 access token（短期，含 user_id 和 role）
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpires
  });
}

// 生成 refresh token（长期，DB 可吊销）
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpires
  });
}

// 校验 access
function verifyAccess(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

// 校验 refresh
function verifyRefresh(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

// 对 refresh token 做 SHA256 后存库（避免明文落库被泄露）
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccess,
  verifyRefresh,
  hashToken
};
