const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate, adminOnly } = require('../middleware/auth');
const { upload } = require('../config/upload');
const productController = require('../src/controllers/productController');

const router = express.Router();

// --- 商品路由 ---

// 获取推荐商品 (个性化算法升级)
router.get('/api/products/recommended', authenticate, asyncHandler(productController.getRecommended));

// 获取所有商品
router.get('/api/products', asyncHandler(productController.list));

// 按分类获取商品
router.get('/api/products/category/:category', asyncHandler(productController.listByCategory));

// 搜索商品（模糊搜索）
router.get('/api/products/search', asyncHandler(productController.search));

// ==========================================
// 高级模糊搜索 API（支持拼音、n-gram、相关度排序）
// ==========================================

// 高级搜索 - 带相关度评分
router.get('/api/products/search/advanced', asyncHandler(productController.searchAdvanced));

// MongoDB $text 全文搜索 API
router.get('/api/products/search/fulltext', asyncHandler(productController.searchFulltext));

// 搜索建议/自动补全 API
router.get('/api/products/search/suggestions', asyncHandler(productController.suggestions));

// 更新单个商品的搜索数据
router.post('/api/products/:id/update-search-data', asyncHandler(productController.updateSearchData));

// 批量更新所有商品的搜索数据（管理员）
router.post(
  '/api/admin/products/rebuild-search-index',
  authenticate,
  adminOnly,
  asyncHandler(productController.rebuildSearchIndex)
);

// ==========================================
// 纯 MongoDB 原生搜索 API（无需预处理字段）
// ==========================================

// 原生聚合管道搜索（带相关度评分，纯数据库计算）
router.get('/api/products/search/native', asyncHandler(productController.searchNative));

// 搜索建议/自动补全（原生聚合管道）
router.get('/api/products/search/native/suggestions', asyncHandler(productController.searchNativeSuggestions));

// 获取单个商品
router.get('/api/products/:id', asyncHandler(productController.getById));

// 上传图片 (with compression)
router.post('/api/upload', upload.single('image'), asyncHandler(productController.upload));

// 删除商品
router.delete('/api/products/:id', asyncHandler(productController.remove));

// 创建商品（商家）
router.post('/api/products', upload.single('image'), asyncHandler(productController.create));


module.exports = router;

