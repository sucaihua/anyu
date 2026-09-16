// 统一响应封装，避免业务层重复样板代码
function success(res, data = null, message = 'ok') {
  return res.json({ code: 0, message, data });
}

function fail(res, code, message, httpStatus = 200) {
  return res.status(httpStatus).json({ code, message, data: null });
}

// 常用业务错误码
const ERR = {
  PARAMS: 1001,       // 参数错误
  UNAUTHORIZED: 1002, // 未登录/Token 失效
  FORBIDDEN: 1003,    // 越权
  NOT_FOUND: 1004,    // 资源不存在
  CONFLICT: 1005,     // 重复操作
  BALANCE_NOT_ENOUGH: 1006, // 余额不足
  STOCK_NOT_ENOUGH: 1007,   // 库存不足
  LOGIN_FAIL: 1008,         // 登录失败
  ACCOUNT_LOCKED: 1009,     // 账号锁定
  ACCOUNT_DISABLED: 1010,   // 账号已被禁用（强制退出）
  SERVER: 5000              // 服务器内部错误
};

module.exports = { success, fail, ERR };
