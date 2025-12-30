const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const orderController = require('../src/controllers/orderController');

const router = express.Router();

// --- 订单路由 ---

// 创建订单（原子性事务处理 - 已降级为普通操作以支持单节点MongoDB）
router.post('/api/orders', asyncHandler(orderController.create));

// 获取用户订单
router.get('/api/orders/user/:userId', asyncHandler(orderController.listByUser));

// 获取单个订单详情
router.get('/api/orders/:id', asyncHandler(orderController.getById));

// 获取订单物流信息
router.get('/api/logistics/:orderId', asyncHandler(orderController.getLogistics));

// 更新订单状态
router.put('/api/orders/:id/status', asyncHandler(orderController.updateStatus));

// 支付订单
router.post('/api/orders/:id/pay', asyncHandler(orderController.pay));

// 取消订单
router.post('/api/orders/:id/cancel', asyncHandler(orderController.cancel));

// 确认收货
router.post('/api/orders/:id/confirm', asyncHandler(orderController.confirm));

// 商家发货
router.post('/api/orders/:id/ship', asyncHandler(orderController.ship));

// 批量发货（商家）
router.post('/api/merchant/:merchantId/orders/batch-ship', asyncHandler(orderController.batchShip));

// 删除订单
router.delete('/api/orders/:id', asyncHandler(orderController.remove));

// 申请退款
router.post('/api/orders/:id/refund', asyncHandler(orderController.refund));


module.exports = router;

