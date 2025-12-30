const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const reviewController = require('../src/controllers/reviewController');

const router = express.Router();

// --- 评价系统路由 ---

// 创建评价
router.post('/api/reviews', asyncHandler(reviewController.create));

// 获取商品评价列表
router.get('/api/reviews/product/:productId', asyncHandler(reviewController.listByProduct));

// 获取用户的评价列表
router.get('/api/reviews/user/:userId', asyncHandler(reviewController.listByUser));

// 检查订单商品是否已评价
router.get('/api/reviews/check/:orderId/:productId', asyncHandler(reviewController.check));

// 获取待评价的订单商品
router.get('/api/reviews/pending/:userId', asyncHandler(reviewController.pending));

// 点赞评价
router.post('/api/reviews/:reviewId/like', asyncHandler(reviewController.like));

// 商家回复评价
router.post('/api/reviews/:reviewId/reply', asyncHandler(reviewController.reply));

// 获取商家收到的评价
router.get('/api/reviews/merchant/:merchantId', asyncHandler(reviewController.listByMerchant));


module.exports = router;

