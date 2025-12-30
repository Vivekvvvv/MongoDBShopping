const mongoose = require('mongoose');

const { AppError } = require('../../middleware/errorHandler');
const { hashPassword } = require('../../utils/password');
const { generateProductSearchData } = require('../../utils/searchHelper');

const userRepository = require('../repositories/userRepository');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');

async function listMerchants() {
  return userRepository
    .find(
      { role: 'merchant' },
      {
        select: 'name email merchantInfo',
        sort: { 'merchantInfo.totalSales': -1 },
      }
    );
}

async function getMerchantById(id) {
  return userRepository
    .findOne({ _id: id, role: 'merchant' })
    .select('name email merchantInfo');
}

async function createMerchant({ name, email, password, shopName, shopDescription, contactPhone, rating }) {
  const existingUser = await userRepository.findOne({ email });
  if (existingUser) {
    throw new AppError('邮箱已被注册', 400, 'EMAIL_EXISTS');
  }

  const hashedPassword = await hashPassword(password);

  const newMerchant = await userRepository.create({
    name,
    email,
    password: hashedPassword,
    role: 'merchant',
    merchantInfo: {
      shopName: shopName || name,
      shopDescription,
      contactPhone,
      rating: rating || 5.0,
    },
  });

  return newMerchant;
}

async function updateMerchant(id, { name, shopName, shopDescription, contactPhone, rating }) {
  const updateData = {
    name,
    'merchantInfo.shopName': shopName,
    'merchantInfo.shopDescription': shopDescription,
    'merchantInfo.contactPhone': contactPhone,
  };

  if (rating !== undefined) {
    updateData['merchantInfo.rating'] = rating;
  }

  return userRepository.findOneAndUpdate(
    { _id: id, role: 'merchant' },
    { $set: updateData },
    { new: true }
  );
}

async function deleteMerchant(id) {
  const merchant = await userRepository.findOneAndDelete({ _id: id, role: 'merchant' });
  if (!merchant) return null;

  await productRepository.deleteMany({ merchantId: id });
  return merchant;
}

async function listProductsByMerchant(merchantId) {
  return productRepository.find(
    { merchantId },
    {
      populate: { path: 'merchantId', select: 'name merchantInfo' },
      sort: { salesCount: -1 },
    }
  );
}

async function updateProduct(productId, updateData) {
  const product = await productRepository.findById(productId);
  if (!product) {
    throw new AppError('商品不存在', 404);
  }

  const mergedData = {
    name: updateData.name || product.name,
    description: updateData.description || product.description,
    category: updateData.category || product.category,
    searchKeywords: updateData.searchKeywords || product.searchKeywords,
  };

  const searchData = generateProductSearchData(mergedData);
  Object.assign(updateData, searchData);

  return productRepository.findByIdAndUpdate(
    productId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
}

async function getMerchantStats(merchantId) {
  const merchant = await userRepository.findById(merchantId);
  if (!merchant || merchant.role !== 'merchant') {
    return { notFound: true, message: '商家不存在' };
  }

  const products = await productRepository.find({ merchantId });

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalSalesCount = products.reduce((sum, p) => sum + p.salesCount, 0);
  const totalRevenue = products.reduce((sum, p) => sum + p.price * p.salesCount, 0);

  const categoryStats = {};
  products.forEach((p) => {
    if (!categoryStats[p.category]) {
      categoryStats[p.category] = { count: 0, sales: 0, revenue: 0 };
    }
    categoryStats[p.category].count++;
    categoryStats[p.category].sales += p.salesCount;
    categoryStats[p.category].revenue += p.price * p.salesCount;
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const mId = merchantId.toString();
  const mObjectId = mongoose.Types.ObjectId.isValid(merchantId) ? new mongoose.Types.ObjectId(merchantId) : null;

  const aggregationResults = await orderRepository.aggregate([
    {
      $match: {
        'items.merchantId': { $in: [mId, mObjectId] },
        status: { $in: ['已支付', '待发货', '发货中', '已完成'] },
      },
    },
    {
      $facet: {
        revenueStats: [
          { $unwind: '$items' },
          { $match: { 'items.merchantId': { $in: [mId, mObjectId] } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
              totalOrders: { $addToSet: '$_id' },
            },
          },
          {
            $project: {
              totalRevenue: 1,
              orderCount: { $size: '$totalOrders' },
            },
          },
        ],
        dailyTrend: [
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          { $unwind: '$items' },
          { $match: { 'items.merchantId': { $in: [mId, mObjectId] } } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: '+08:00',
                },
              },
              revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
              salesCount: { $sum: '$items.quantity' },
            },
          },
          { $sort: { _id: 1 } },
        ],
        hourlyStats: [
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          { $unwind: '$items' },
          { $match: { 'items.merchantId': { $in: [mId, mObjectId] } } },
          {
            $group: {
              _id: { $hour: { date: '$createdAt', timezone: '+08:00' } },
              salesCount: { $sum: '$items.quantity' },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const aggStats = aggregationResults[0] || {};

  const orderRevenue = (aggStats.revenueStats && aggStats.revenueStats[0] && aggStats.revenueStats[0].totalRevenue) || 0;
  const totalOrders = (aggStats.revenueStats && aggStats.revenueStats[0] && aggStats.revenueStats[0].orderCount) || 0;

  const actualSalesCount = ((aggStats.dailyTrend || [])).reduce((sum, item) => sum + item.salesCount, 0);

  const salesTrend = [];
  const dailyTrend = aggStats.dailyTrend || [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = dailyTrend.find((item) => item._id === dateStr);
    salesTrend.push({
      date: dateStr,
      revenue: found ? found.revenue : 0,
      salesCount: found ? found.salesCount : 0,
    });
  }

  const hourlyMap = new Map();
  (aggStats.hourlyStats || []).forEach((item) => hourlyMap.set(item._id, item.salesCount));

  const hourlyStats = [];
  let peakHour = 0;
  let maxHourlySales = 0;

  for (let i = 0; i < 24; i++) {
    const count = hourlyMap.get(i) || 0;
    hourlyStats.push({ hour: i, salesCount: count });
    if (count > maxHourlySales) {
      maxHourlySales = count;
      peakHour = i;
    }
  }

  const topProducts = products
    .slice()
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 5);

  const lowStockProducts = products.filter((p) => p.stock < 10);

  return {
    merchantInfo: merchant.merchantInfo,
    stats: {
      totalProducts,
      totalStock,
      totalSalesCount: actualSalesCount || totalSalesCount,
      totalRevenue: orderRevenue || totalRevenue,
      totalOrders,
      orderRevenue,
      peakHour,
    },
    categoryStats,
    topProducts,
    lowStockProducts,
    salesTrend,
    hourlyStats,
  };
}

async function listMerchantOrders({ merchantId, status, page = 1, limit = 10 }) {
  const query = { 'items.merchantId': merchantId };
  if (status) query.status = status;

  const orders = await orderRepository
    .find(query)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await orderRepository.countDocuments(query);

  const merchantOrders = orders.map((order) => {
    const merchantItems = order.items.filter(
      (item) => item.merchantId && item.merchantId.toString() === merchantId
    );
    const merchantTotal = merchantItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      items: merchantItems,
      merchantTotal,
      status: order.status,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
    };
  });

  return {
    orders: merchantOrders,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total,
  };
}

async function exportMerchantProductsCsv(merchantId) {
  const merchant = await userRepository.findById(merchantId);
  if (!merchant || merchant.role !== 'merchant') {
    return { notFound: true, message: '商家不存在' }; 
  }

  const products = await productRepository.find({ merchantId });

  const csvHeader = '商品编码,商品名称,分类,价格,库存,销量,描述,关键词\n';
  const csvRows = products
    .map((p) => {
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      return [
        escape(p.productCode),
        escape(p.name),
        escape(p.category),
        p.price,
        p.stock,
        p.salesCount,
        escape(p.description),
        escape(p.searchKeywords),
      ].join(',');
    })
    .join('\n');

  const csvContent = '\uFEFF' + csvHeader + csvRows;
  return {
    filename: `products_${merchantId}_${Date.now()}.csv`,
    content: csvContent,
  };
}

async function analyticsOrders({ period = 'month' }) {
  let dateFormat;
  switch (period) {
    case 'day':
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
      break;
    case 'week':
      dateFormat = { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
      break;
    case 'month':
    default:
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  }

  const revenueByPeriod = await orderRepository.aggregate([
    {
      $group: {
        _id: dateFormat,
        revenue: { $sum: '$total' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const statusStats = await orderRepository.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
      },
    },
  ]);

  return { revenueByPeriod, statusStats };
}

module.exports = {
  listMerchants,
  getMerchantById,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  listProductsByMerchant,
  updateProduct,
  getMerchantStats,
  listMerchantOrders,
  exportMerchantProductsCsv,
  analyticsOrders,
};
