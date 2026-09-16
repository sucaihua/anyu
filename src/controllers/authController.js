const Joi = require('joi');
const authService = require('../services/authService');
const { success, fail, ERR } = require('../utils/response');

// 注册参数 schema
const registerSchema = {
  body: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    email: Joi.string().email().max(120).required(),
    password: Joi.string()
      // 至少 8 位，含字母与数字
      .pattern(/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,32}$/)
      .required()
      .messages({
        'string.pattern.base': '密码 8-32 位，需同时包含字母与数字'
      })
  })
};

async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    return success(res, user, '注册成功');
  } catch (e) {
    next(e);
  }
}

const loginSchema = {
  body: Joi.object({
    username: Joi.string().min(1).max(50).required(),
    password: Joi.string().min(1).max(64).required()
  })
};

async function login(req, res, next) {
  try {
    const ip = req.ip;
    const data = await authService.login({ ...req.body, ip });
    return success(res, data, '登录成功');
  } catch (e) {
    next(e);
  }
}

const refreshSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required()
  })
};

async function refresh(req, res, next) {
  try {
    const data = await authService.refresh(req.body);
    return success(res, data, '刷新成功');
  } catch (e) {
    next(e);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(req.body);
    return success(res, { ok: true }, '已退出');
  } catch (e) {
    next(e);
  }
}

// 当前用户信息
async function me(req, res, next) {
  try {
    return success(res, req.user, 'ok');
  } catch (e) {
    next(e);
  }
}

module.exports = {
  register,
  registerSchema,
  login,
  loginSchema,
  refresh,
  refreshSchema,
  logout,
  me
};
