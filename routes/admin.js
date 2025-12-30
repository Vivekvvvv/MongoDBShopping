const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, adminOnly } = require('../middleware/auth');
const adminController = require('../src/controllers/adminController');

const router = express.Router();

// --- 管理员路由 ---

// 统一保护所有 /api/admin/* 管理员接口
router.use('/api/admin', authenticate, adminOnly);

// 获取所有订单（管理员）
router.get('/api/admin/orders', asyncHandler(adminController.listOrders));

// 订单统计 - 支持时间范围筛选
router.get('/api/admin/stats', asyncHandler(adminController.stats));

// 获取所有用户（管理员）
router.get('/api/admin/users', asyncHandler(adminController.listUsers));

// 删除用户（管理员）
router.delete('/api/admin/users/:id', asyncHandler(adminController.deleteUser));


module.exports = router;

