const { getConnection } = require('../config/db');
const userModel = require('../models/userModel');
const balanceModel = require('../models/balanceModel');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefresh,
  hashToken
} = require('../utils/jwt');
const config = require('../config');
const AppError = require('../utils/appError');
const { ERR } = require('../utils/response');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// 注册：用户名/邮箱唯一性预检 + 唯一索引兜底 + 事务初始化余额
async function register({ username, email, password }) {
  // 预检（防止明显重复注册，DB 唯一索引最终兜底）
  if (await userModel.findByUsername(username)) {
    throw new AppError(ERR.CONFLICT, '用户名已被使用');
  }
  if (await userModel.findByEmail(email)) {
    throw new AppError(ERR.CONFLICT, '邮箱已被使用');
  }

  const passwordHash = await hashPassword(password);

  // 事务：写用户 + 初始化余额行
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const [uResult] = await conn.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );
    const userId = uResult.insertId;
    await conn.execute(
      'INSERT INTO balances (user_id, amount, version) VALUES (?, 0, 0)',
      [userId]
    );
    await conn.commit();
    return { id: userId, username, email };
  } catch (err) {
    await conn.rollback();
    // 唯一索引冲突兜底
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(ERR.CONFLICT, '用户名或邮箱已被使用');
    }
    logger.error('[register] db error', { err: err.message });
    throw new AppError(ERR.SERVER, '注册失败');
  } finally {
    conn.release();
  }
}

// 登录：账号锁定（Redis 计数）+ 密码校验
async function login({ username, password, ip }) {
  const lockKey = `login_lock:${username}`;
  const locked = await cache.get(lockKey);
  if (locked) {
    throw new AppError(ERR.ACCOUNT_LOCKED, '账号已被锁定，请稍后再试');
  }

  const user = await userModel.findByUsername(username);
  // 即使账号不存在，也要消耗一定时间，避免用户名枚举
  if (!user) {
    await bogusDelay();
    throw new AppError(ERR.LOGIN_FAIL, '用户名或密码错误');
  }
  if (user.status === 0) {
    throw new AppError(ERR.ACCOUNT_LOCKED, '账号已被禁用');
  }

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) {
    // 累加失败次数
    const failKey = `login_fail:${username}`;
    const count = (await cache.get(failKey)) || 0;
    const newCount = count + 1;
    if (newCount >= config.loginFail.limit) {
      await cache.set(lockKey, 1, Math.floor(config.loginFail.lockMs / 1000));
      // 失败次数清零
      await cache.del(failKey);
      throw new AppError(ERR.ACCOUNT_LOCKED, '失败次数过多，账号已锁定 15 分钟');
    }
    await cache.set(failKey, newCount, Math.floor(config.loginFail.lockMs / 1000));
    throw new AppError(ERR.LOGIN_FAIL, '用户名或密码错误');
  }

  // 登录成功，清失败计数
  await cache.del(`login_fail:${username}`);

  const payload = { id: user.id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // refresh 落库（可吊销）
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpires * 1000);
  await userModel.saveRefreshToken(user.id, hashToken(refreshToken), expiresAt);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, email: user.email, role: user.role }
  };
}

async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefresh(refreshToken);
  } catch (e) {
    throw new AppError(ERR.UNAUTHORIZED, '刷新令牌无效', 401);
  }
  const stored = await userModel.findRefreshToken(hashToken(refreshToken));
  if (!stored || stored.revoked === 1 || new Date(stored.expires_at).getTime() < Date.now()) {
    throw new AppError(ERR.UNAUTHORIZED, '刷新令牌已失效，请重新登录', 401);
  }
  // 账号被禁用时，不允许刷新任何新令牌（配合 authRequired 实时校验实现强制退出）
  const status = await userModel.getStatus(payload.id);
  if (status === 0) {
    await userModel.revokeRefreshToken(stored.id);
    throw new AppError(ERR.ACCOUNT_DISABLED, '账号已被禁用', 401);
  }
  // 旋转 refresh token（旧的吊销）
  await userModel.revokeRefreshToken(stored.id);
  const newPayload = { id: payload.id, role: payload.role };
  const newAccess = signAccessToken(newPayload);
  const newRefresh = signRefreshToken(newPayload);
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpires * 1000);
  await userModel.saveRefreshToken(payload.id, hashToken(newRefresh), expiresAt);
  return { accessToken: newAccess, refreshToken: newRefresh };
}

async function logout({ refreshToken }) {
  if (!refreshToken) return { ok: true };
  try {
    const stored = await userModel.findRefreshToken(hashToken(refreshToken));
    if (stored) await userModel.revokeRefreshToken(stored.id);
  } catch (e) {
    // 忽略，登出不应该失败
  }
  return { ok: true };
}

function bogusDelay() {
  return new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 200)));
}

module.exports = { register, login, refresh, logout };
