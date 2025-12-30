const orderRepository = require('../repositories/orderRepository');
const userRepository = require('../repositories/userRepository');

async function listOrders({ page = 1, limit = 20, status }) {
  const query = {};
  if (status) query.status = status;

  const numericLimit = limit * 1;
  const numericPage = page * 1;

  const orders = await orderRepository
    .find(query)
    .populate('userId', 'name email')
    .populate('items.productId', 'name')
    .sort({ createdAt: -1 })
    .limit(numericLimit)
    .skip((numericPage - 1) * numericLimit);

  const total = await orderRepository.countDocuments(query);

  return {
    orders,
    totalPages: Math.ceil(total / numericLimit),
    currentPage: page,
    total,
  };
}

async function listUsers() {
  return userRepository.find({}, { select: '-password', sort: { createdAt: -1 } });
}

async function deleteUser(id) {
  return userRepository.findByIdAndDelete(id);
}

async function stats({ days, startDate, endDate }) {
  let dateFilter = {};
  let filterStartDate = null;
  let filterEndDate = new Date();

  if (days && days !== 'all') {
    filterStartDate = new Date();
    filterStartDate.setDate(filterStartDate.getDate() - parseInt(days));
    filterStartDate.setHours(0, 0, 0, 0);
    dateFilter = { createdAt: { $gte: filterStartDate } };
  } else if (startDate && endDate) {
    filterStartDate = new Date(startDate);
    filterStartDate.setHours(0, 0, 0, 0);
    filterEndDate = new Date(endDate);
    filterEndDate.setHours(23, 59, 59, 999);
    dateFilter = { createdAt: { $gte: filterStartDate, $lte: filterEndDate } };
  }

  const totalUsers = await userRepository.countDocuments({ role: 'user' });
  const totalMerchants = await userRepository.countDocuments({ role: 'merchant' });

  const orderQuery = Object.keys(dateFilter).length > 0 ? dateFilter : {};
  const totalOrders = await orderRepository.countDocuments(orderQuery);

  const revenueMatch = {
    status: { $in: ['已支付', '发货中', '已完成'] },
    ...(Object.keys(dateFilter).length > 0 ? dateFilter : {}),
  };
  const revenueStats = await orderRepository.aggregate([
    { $match: revenueMatch },
    { $group: { _id: null, total: { $sum: '$total' } } },
  ]);
  const totalRevenue = revenueStats.length > 0 ? revenueStats[0].total : 0;

  const trendMatch = {
    status: { $in: ['已支付', '发货中', '已完成'] },
    ...(Object.keys(dateFilter).length > 0 ? dateFilter : {}),
  };
  const salesTrend = await orderRepository.aggregate([
    { $match: trendMatch },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+08:00' } },
        amount: { $sum: '$total' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  let filledSalesTrend = salesTrend;
  if (filterStartDate && days && days !== 'all') {
    const dayCount = parseInt(days);
    filledSalesTrend = [];
    const trendMap = new Map(salesTrend.map((item) => [item._id, item]));

    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = trendMap.get(dateStr);
      filledSalesTrend.push({
        _id: dateStr,
        amount: found ? found.amount : 0,
        orderCount: found ? found.orderCount : 0,
      });
    }
  }

  const categoryStats = await orderRepository.aggregate([
    { $match: trendMatch },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.category',
        count: { $sum: '$items.quantity' },
        sales: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  const orderStatusStats = await orderRepository.aggregate([
    { $match: trendMatch },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$total' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return {
    totalUsers,
    totalMerchants,
    totalOrders,
    totalRevenue,
    salesTrend: filledSalesTrend,
    categoryStats,
    orderStatusStats,
    dateRange: {
      start: filterStartDate ? filterStartDate.toISOString() : null,
      end: filterEndDate ? filterEndDate.toISOString() : null,
      days: days || null,
    },
  };
}

module.exports = {
  listOrders,
  listUsers,
  deleteUser,
  stats,
};
