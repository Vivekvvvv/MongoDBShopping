const mongoose = require('mongoose');

const logisticsSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  trackingNumber: {
    type: String,
    required: false,
    unique: true
  },
  carrier: {
    type: String,
    required: true,
    enum: ['顺丰速运', '圆通速递', '中通快递', '申通快递', '韵达速递', '邮政EMS', '德邦快递']
  },
  status: {
    type: String,
    required: true,
    enum: ['已揽收', '运输中', '派送中', '已签收', '异常'],
    default: '已揽收'
  },
  origin: {
    province: String,
    city: String,
    district: String,
    detail: String
  },
  destination: {
    province: String,
    city: String,
    district: String,
    detail: String
  },
  // 物流轨迹
  traces: [{
    time: {
      type: Date,
      required: true
    },
    location: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      required: true
    }
  }],
  estimatedDelivery: {
    type: Date
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

// 生成物流单号的中间件
logisticsSchema.pre('save', function(next) {
  if (this.isNew && !this.trackingNumber) {
    // 生成物流单号：快递公司代码 + 随机数字
    const carrierCodes = {
      '顺丰速运': 'SF',
      '圆通速递': 'YTO',
      '中通快递': 'ZTO',
      '申通快递': 'STO',
      '韵达速递': 'YD',
      '邮政EMS': 'EMS',
      '德邦快递': 'DBL'
    };

    const code = carrierCodes[this.carrier] || 'DEFAULT';
    const randomNum = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    this.trackingNumber = `${code}${randomNum}`;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Logistics', logisticsSchema);