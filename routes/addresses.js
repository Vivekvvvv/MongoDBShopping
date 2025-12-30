const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const addressController = require('../src/controllers/addressController');

const router = express.Router();

// --- 地址管理路由 ---

// 获取用户地址列表
router.get('/api/addresses/:userId', asyncHandler(addressController.listByUser));

// 添加新地址
router.post('/api/addresses', asyncHandler(addressController.create));

// 更新地址
router.put('/api/addresses/:id', asyncHandler(addressController.update));

// 删除地址
router.delete('/api/addresses/:id', asyncHandler(addressController.remove));


module.exports = router;

