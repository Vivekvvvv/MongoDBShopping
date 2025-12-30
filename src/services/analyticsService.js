const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');

async function productsAnalytics() {
  const categoryStats = await productRepository.aggregate([
    {
      $group: {
        _id: '$category',
        totalProducts: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        avgPrice: { $avg: '$price' },
        totalSales: { $sum: '$salesCount' },
      },
    },
  ]);

  const topProducts = await productRepository
    .find(
      {},
      {
        sort: { salesCount: -1 },
        populate: { path: 'merchantId', select: 'name' },
      }
    )
    .limit(10);

  const lowStockProducts = await productRepository
    .find({ stock: { $lt: 10 } }, { sort: { stock: 1 } });

  return {
    categoryStats,
    topProducts,
    lowStockProducts,
  };
}

async function ordersAnalytics({ period = 'month' }) {
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

  return {
    revenueByPeriod,
    statusStats,
  };
}

module.exports = {
  productsAnalytics,
  ordersAnalytics,
};
