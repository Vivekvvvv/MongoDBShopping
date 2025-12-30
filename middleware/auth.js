const jwt = require('jsonwebtoken');

// JWT 密钥（生产环境应从环境变量获取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 生成 JWT Token
 * @param {Object} payload - 用户信息
 * @returns {string} JWT Token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的用户信息
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * 认证中间件 - 验证用户是否登录
 */
const authenticate = (req, res, next) => {
  try {
    // 从请求头获取 token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: '认证令牌无效或已过期',
        code: 'INVALID_TOKEN'
      });
    }

    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '认证失败',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * 可选认证中间件 - 如果有 token 则验证，没有也放行
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

/**
 * 角色验证中间件 - 验证用户角色
 * @param  {...string} roles - 允许的角色列表
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '请先登录',
        code: 'NOT_LOGGED_IN'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '您没有权限执行此操作',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

/**
 * 商家验证中间件
 */
const merchantOnly = authorize('merchant', 'admin');

/**
 * 管理员验证中间件
 */
const adminOnly = authorize('admin');

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  authorize,
  merchantOnly,
  adminOnly
};
