const { normalizeError } = require('./errorResponse');

function sendError(res, error, statusCode = 500, extraBody = undefined) {
  const isDev = process.env.NODE_ENV === 'development';
  const normalized = normalizeError(error);
  const body = {
    success: false,
    message: normalized.message,
    code: normalized.code,
    ...(isDev && error instanceof Error ? { stack: error.stack } : {}),
    ...(extraBody || {}),
  };
  return res.status(statusCode).json(body);
}

module.exports = { sendError };
