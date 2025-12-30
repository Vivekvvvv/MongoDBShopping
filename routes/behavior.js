const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const behaviorController = require('../src/controllers/behaviorController');

const router = express.Router();

// --- 智能推荐 & 行为追踪路由 ---

// 记录商品浏览
router.post('/api/products/:id/view', asyncHandler(behaviorController.recordProductView));

module.exports = router;

