// 业务错误：携带 code，由 errorHandler 统一捕获后转成响应
class AppError extends Error {
  constructor(code, message, httpStatus = 200) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.isAppError = true;
  }
}

module.exports = AppError;
