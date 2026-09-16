const { fail, ERR } = require('../utils/response');
const logger = require('../utils/logger');
const AppError = require('../utils/appError');

// 统一错误处理：兜底所有 throw 与 next(err)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return fail(res, err.code, err.message, err.httpStatus || 200);
  }

  // Joi 校验在中间件里已处理，但若直接 throw 也兜底
  if (err && err.isJoi) {
    return fail(res, ERR.PARAMS, err.details?.[0]?.message || '参数错误');
  }

  // 其它未捕获错误：记日志，向前端返回通用错误，绝不暴露堆栈/SQL
  logger.error('[uncaught]', {
    url: req.originalUrl,
    method: req.method,
    err: err.message,
    stack: err.stack
  });
  return fail(res, ERR.SERVER, '服务器内部错误', 500);
}

// 404 兜底
function notFound(req, res) {
  return fail(res, ERR.NOT_FOUND, '接口不存在', 404);
}

module.exports = { errorHandler, notFound };
