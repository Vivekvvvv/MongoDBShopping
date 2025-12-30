function normalizeError(err) {
  let statusCode = (err && err.statusCode) || 500;
  let message = (err && err.message) || '服务器内部错误';
  let code = (err && err.code) || 'INTERNAL_ERROR';

  // Handle non-Error throwables
  if (!(err instanceof Error)) {
    message = String(err);
    code = 'ERROR';
  }

  // Mongoose 验证错误
  if (err && err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors.join(', ');
  }

  // Mongoose CastError (无效的 ObjectId)
  if (err && err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `无效的 ${err.path}: ${err.value}`;
  }

  // Mongoose 重复键错误
  if (err && err.code === 11000) {
    statusCode = 400;
    code = 'DUPLICATE_KEY';
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    message = `${field} 已存在`;
  }

  // JWT 错误
  if (err && err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = '无效的认证令牌';
  }

  if (err && err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = '认证令牌已过期，请重新登录';
  }

  // 文件上传错误
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    code = 'FILE_TOO_LARGE';
    message = '文件大小超出限制';
  }

  return { statusCode, message, code };
}

module.exports = {
  normalizeError,
};
