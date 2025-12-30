const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { registerRules, loginRules } = require('../middleware/validator');
const authController = require('../src/controllers/authController');

const router = express.Router();

// --- 用户认证路由 ---

// 注册
router.post('/api/register', registerRules, asyncHandler(authController.register));

// 登录
router.post('/api/login', loginRules, asyncHandler(authController.login));


module.exports = router;

