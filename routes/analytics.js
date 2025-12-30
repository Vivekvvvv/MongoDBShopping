const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const analyticsController = require('../src/controllers/analyticsController');

const router = express.Router();

// --- 聚合操作路由 ---

// 商品统计
router.get('/api/analytics/products', asyncHandler(analyticsController.products));

// 订单统计
router.get('/api/analytics/orders', asyncHandler(analyticsController.orders));

module.exports = router;
