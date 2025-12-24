const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // 订单关联
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  // 商品关联
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  // 用户关联
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 商家关联
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // 评分 (1-5星)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  // 评价内容
  content: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 500
  },
  // 评价图片
  images: [{
    type: String
  }],
  // 标签 (好评/中评/差评)
  tag: {
    type: String,
    enum: ['好评', '中评', '差评'],
    default: '好评'
  },
  // 是否匿名
  isAnonymous: {
    type: Boolean,
    default: false
  },
  // 商家回复
  merchantReply: {
    content: {
      type: String,
      maxlength: 300
    },
    repliedAt: {
      type: Date
    }
  },
  // 点赞数
  likes: {
    type: Number,
    default: 0
  },
  // 点赞用户列表
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // 是否置顶 (优质评价)
  isPinned: {
    type: Boolean,
    default: false
  },
  // 审核状态
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved' // 默认自动审核通过
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 根据评分自动设置标签
reviewSchema.pre('save', function(next) {
  if (this.isModified('rating')) {
    if (this.rating >= 4) {
      this.tag = '好评';
    } else if (this.rating >= 3) {
      this.tag = '中评';
    } else {
      this.tag = '差评';
    }
  }
  this.updatedAt = Date.now();
  next();
});

// 索引
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ orderId: 1 });
reviewSchema.index({ merchantId: 1 });
reviewSchema.index({ rating: 1 });

module.exports = mongoose.model('Review', reviewSchema);
