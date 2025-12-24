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
  // 默认错误状态码和消息
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';
  let code = err.code || 'INTERNAL_ERROR';

  // Mongoose 验证错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const errors = Object.values(err.errors).map(e => e.message);
    message = errors.join(', ');
  }

  // Mongoose CastError (无效的 ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `无效的 ${err.path}: ${err.value}`;
  }

  // Mongoose 重复键错误
  if (err.code === 11000) {
    statusCode = 400;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue)[0];
    message = `${field} 已存在`;
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = '无效的认证令牌';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = '认证令牌已过期，请重新登录';
  }

  // 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    code = 'FILE_TOO_LARGE';
    message = '文件大小超出限制';
  }

  // 开发环境输出详细错误信息
  const isDev = process.env.NODE_ENV === 'development';

  // 记录错误日志
  console.error(`[${new Date().toISOString()}] ${code}: ${message}`);
  if (isDev) {
    console.error(err.stack);
  }

  // 返回错误响应
  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(isDev && { stack: err.stack })
  });
};

module.exports = {
  AppError,
  asyncHandler,
  notFound,
  errorHandler
};
