/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const { normalizeError } = require('../utils/errorResponse');

/**
 * 异步函数包装器 - 自动捕获异步错误
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 错误处理中间件
 */
const notFound = (req, res, next) => {
  const error = new AppError(`找不到路径: ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  const normalized = normalizeError(err);

  console.error(`[${new Date().toISOString()}] ${normalized.code}: ${normalized.message}`);
  if (isDev && err && err.stack) {
    console.error(err.stack);
  }

  res.status(normalized.statusCode).json({
    success: false,
    message: normalized.message,
    code: normalized.code,
    ...(isDev && err instanceof Error ? { stack: err.stack } : {}),
  });
};

module.exports = {
  AppError,
  asyncHandler,
  notFound,
  errorHandler
};
