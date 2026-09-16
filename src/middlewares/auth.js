const { verifyAccess } = require('../utils/jwt');
const { fail, ERR } = require('../utils/response');
const userModel = require('../models/userModel');

// 解析 Authorization: Bearer <token>
function extractToken(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// 必须登录
async function authRequired(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return fail(res, ERR.UNAUTHORIZED, '未登录', 401);
    let payload;
    try {
      payload = verifyAccess(token);
    } catch (e) {
      return fail(res, ERR.UNAUTHORIZED, '登录已失效，请重新登录', 401);
    }
    // 实时校验账号状态：JWT 无法主动吊销，被禁用后必须在下一次请求时拦截，
    // 并吊销其所有 refresh token，实现「强制退出」
    const status = await userModel.getStatus(payload.id);
    if (status === 0) {
      await userModel.revokeAllByUser(payload.id);
      return fail(res, ERR.ACCOUNT_DISABLED, '账号已被禁用，系统已强制退出', 401);
    }
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (e) {
    next(e);
  }
}

// 可选登录（不报错，能解就解）
function authOptional(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = verifyAccess(token);
      req.user = { id: payload.id, role: payload.role };
    } catch (e) {
      // 忽略，按未登录处理
    }
  }
  next();
}

// 必须是管理员（前置 authRequired）
function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 1) {
    return fail(res, ERR.FORBIDDEN, '无管理员权限', 403);
  }
  next();
}

module.exports = { authRequired, authOptional, adminRequired };
