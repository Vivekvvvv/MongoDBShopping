const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  imageUrl: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  category: {
    type: String,
    default: 'General'
  },
  stock: {
    type: Number,
    default: 0
  },
  // 商家信息
  merchant: {
    type: String,
    required: true,
    default: '官方旗舰店'
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 供应商信息
  supplier: {
    type: String,
    required: true,
    default: '官方供应商'
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // 供应商联系方式
  supplierContact: {
    phone: String,
    email: String,
    address: String
  },
  // 发货地址
  shippingAddress: {
    province: { type: String, required: true, default: '广东省' },
    city: { type: String, required: true, default: '深圳市' },
    district: { type: String, required: true, default: '南山区' },
    detail: { type: String, required: true, default: '科技园' }
  },
  // 商品编号
  productCode: {
    type: String,
    required: true,
    unique: true
  },
  // 购买量统计
  salesCount: {
    type: Number,
    default: 0
  },
  // 搜索关键词 - 用于模糊搜索
  searchKeywords: {
    type: String,
    default: ''
  },
  // === 高级模糊搜索字段 ===
  // n-gram 分词（支持部分匹配）
  nameNgrams: {
    type: String,
    default: ''
  },
  // 拼音（支持拼音搜索）
  namePinyin: {
    type: String,
    default: ''
  },
  // 拼音首字母（支持首字母搜索，如 bjdn -> 笔记本电脑）
  namePinyinInitials: {
    type: String,
    default: ''
  },
  // 综合搜索 tokens（包含所有分词）
  searchTokens: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Database Indexes for better query performance
productSchema.index({ name: 'text', description: 'text', searchKeywords: 'text', searchTokens: 'text' }, {
  weights: {
    name: 10,           // 名称权重最高
    searchTokens: 5,    // 分词次之
    searchKeywords: 3,  // 关键词
    description: 1      // 描述权重最低
  },
  name: 'ProductTextIndex'
});
productSchema.index({ category: 1 });
productSchema.index({ merchantId: 1 });
productSchema.index({ price: 1 });
productSchema.index({ salesCount: -1 });
productSchema.index({ stock: 1 });
productSchema.index({ productCode: 1 }, { unique: true });
productSchema.index({ createdAt: -1 });
productSchema.index({ category: 1, salesCount: -1 }); // Compound index for category + sorting
// Fuzzy search indexes
productSchema.index({ nameNgrams: 1 });
productSchema.index({ namePinyin: 1 });
productSchema.index({ namePinyinInitials: 1 });

module.exports = mongoose.model('Product', productSchema);
