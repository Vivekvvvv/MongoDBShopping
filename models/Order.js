const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  orderNumber: {
    type: String,
    required: false,
    unique: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: String,
    category: String,
    price: Number,
    quantity: Number,
    imageUrl: String,
    merchant: String,
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    default: '待支付',
    enum: ['待支付', '待发货', '已支付', '发货中', '已完成', '已取消', '已退款']
  },
  // 收货地址
  shippingAddress: {
    name: String,
    phone: String,
    province: String,
    city: String,
    district: String,
    detail: String,
    postalCode: String
  },
  // 支付信息
  paymentInfo: {
    method: {
      type: String,
      enum: ['余额支付', '支付宝', '微信支付', '货到付款', '免支付'],
      default: '余额支付'
    },
    paidAt: Date,
    transactionId: String
  },
  // 物流信息
  logistics: {
    company: String,
    trackingNumber: String,
    shippedAt: Date,
    deliveredAt: Date,
    status: {
      type: String,
      enum: ['未发货', '已发货', '运输中', '已签收'],
      default: '未发货'
    }
  },
  // 订单备注
  remarks: {
    type: String,
    default: ''
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

// 生成订单号的中间件
orderSchema.pre('save', function(next) {
  if (this.isNew) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD${timestamp}${random}`;
  }
  this.updatedAt = Date.now();
  next();
});

// 索引
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', orderSchema);
