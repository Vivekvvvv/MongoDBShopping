const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, adminOnly } = require('../middleware/auth');
const merchantController = require('../src/controllers/merchantController');

const router = express.Router();

// --- 商家路由 ---

// 获取商家列表
router.get('/api/merchants', asyncHandler(merchantController.listMerchants));

// 获取单个商家详情
router.get('/api/merchants/:id', asyncHandler(merchantController.getMerchant));

// 创建商家 (管理员)
router.post(
  '/api/merchants',
  authenticate,
  adminOnly,
  asyncHandler(merchantController.createMerchant)
);

// 更新商家信息 (管理员或商家本人)
router.put('/api/merchants/:id', authenticate, adminOnly, asyncHandler(merchantController.updateMerchant));

// 删除商家 (管理员)
router.delete('/api/merchants/:id', authenticate, adminOnly, asyncHandler(merchantController.deleteMerchant));

// 按商家搜索商品
router.get('/api/products/merchant/:merchantId', asyncHandler(merchantController.listProductsByMerchant));

// 更新商品（商家）
router.put('/api/products/:id', asyncHandler(merchantController.updateProduct));

// 获取商家统计数据
router.get('/api/merchant/:merchantId/stats', asyncHandler(merchantController.getMerchantStats));

// 获取商家订单
router.get('/api/merchant/:merchantId/orders', asyncHandler(merchantController.listMerchantOrders));

// 导出商家商品CSV
router.get('/api/merchant/:merchantId/products/export', asyncHandler(merchantController.exportMerchantProductsCsv));

// --- 聚合操作路由 ---



module.exports = router;

