const { body, param, query, validationResult } = require('express-validator');

/**
 * 验证结果处理中间件
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: '输入验证失败',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * 用户注册验证规则
 */
const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 2, max: 50 }).withMessage('用户名长度应在2-50个字符之间'),
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 6 }).withMessage('密码长度至少6个字符'),
  body('role')
    .optional()
    .isIn(['user', 'merchant']).withMessage('无效的用户角色'),
  validate
];

/**
 * 用户登录验证规则
 */
const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('密码不能为空'),
  validate
];

/**
 * 商品验证规则
 */
const productRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('商品名称不能为空')
    .isLength({ max: 200 }).withMessage('商品名称不能超过200个字符')
    .escape(),
  body('price')
    .notEmpty().withMessage('价格不能为空')
    .isFloat({ min: 0 }).withMessage('价格必须是非负数'),
  body('stock')
    .notEmpty().withMessage('库存不能为空')
    .isInt({ min: 0 }).withMessage('库存必须是非负整数'),
  body('category')
    .optional()
    .trim()
    .escape(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('描述不能超过5000个字符'),
  validate
];

/**
 * 订单验证规则
 */
const orderRules = [
  body('userId')
    .notEmpty().withMessage('用户ID不能为空')
    .isMongoId().withMessage('无效的用户ID'),
  body('items')
    .isArray({ min: 1 }).withMessage('订单必须包含至少一个商品'),
  body('items.*.productId')
    .notEmpty().withMessage('商品ID不能为空')
    .isMongoId().withMessage('无效的商品ID'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('商品数量必须是正整数'),
  body('shippingAddress')
    .notEmpty().withMessage('收货地址不能为空'),
  validate
];

/**
 * 地址验证规则
 */
const addressRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('收货人姓名不能为空')
    .isLength({ max: 50 }).withMessage('姓名不能超过50个字符')
    .escape(),
  body('phone')
    .trim()
    .notEmpty().withMessage('手机号不能为空')
    .matches(/^1[3-9]\d{9}$/).withMessage('请输入有效的手机号'),
  body('province')
    .trim()
    .notEmpty().withMessage('省份不能为空')
    .escape(),
  body('city')
    .trim()
    .notEmpty().withMessage('城市不能为空')
    .escape(),
  body('district')
    .trim()
    .notEmpty().withMessage('区县不能为空')
    .escape(),
  body('detail')
    .trim()
    .notEmpty().withMessage('详细地址不能为空')
    .isLength({ max: 200 }).withMessage('详细地址不能超过200个字符')
    .escape(),
  validate
];

/**
 * 评价验证规则
 */
const reviewRules = [
  body('orderId')
    .notEmpty().withMessage('订单ID不能为空')
    .isMongoId().withMessage('无效的订单ID'),
  body('productId')
    .notEmpty().withMessage('商品ID不能为空')
    .isMongoId().withMessage('无效的商品ID'),
  body('userId')
    .notEmpty().withMessage('用户ID不能为空')
    .isMongoId().withMessage('无效的用户ID'),
  body('rating')
    .notEmpty().withMessage('评分不能为空')
    .isInt({ min: 1, max: 5 }).withMessage('评分必须在1-5之间'),
  body('content')
    .trim()
    .notEmpty().withMessage('评价内容不能为空')
    .isLength({ min: 5, max: 500 }).withMessage('评价内容应在5-500个字符之间'),
  validate
];

/**
 * MongoDB ObjectId 验证
 */
const mongoIdRules = (paramName = 'id') => [
  param(paramName)
    .notEmpty().withMessage('ID不能为空')
    .isMongoId().withMessage('无效的ID格式'),
  validate
];

/**
 * 分页参数验证
 */
const paginationRules = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  validate
];

/**
 * 防止 NoSQL 注入的清理函数
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const key in input) {
      if (!key.startsWith('$')) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
};

/**
 * NoSQL 注入防护中间件
 */
const noSqlInjectionGuard = (req, res, next) => {
  // 如果是 multipart/form-data 请求且 body 尚未解析，跳过 body 清理
  // 否则会导致 multer 无法正确解析数据
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('multipart/form-data') && Object.keys(req.body || {}).length === 0) {
    req.query = sanitizeInput(req.query);
    req.params = sanitizeInput(req.params);
    return next();
  }

  // 修复登录问题：不要对密码字段进行清理
  const { password, ...otherBody } = req.body;
  
  req.body = {
    ...sanitizeInput(otherBody),
    ...(password !== undefined ? { password } : {})
  };
  
  req.query = sanitizeInput(req.query);
  req.params = sanitizeInput(req.params);
  next();
};

module.exports = {
  validate,
  registerRules,
  loginRules,
  productRules,
  orderRules,
  addressRules,
  reviewRules,
  mongoIdRules,
  paginationRules,
  sanitizeInput,
  noSqlInjectionGuard
};
