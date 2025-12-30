const mongoose = require('mongoose');

const orderRepository = require('../repositories/orderRepository');
const productRepository = require('../repositories/productRepository');
const reviewRepository = require('../repositories/reviewRepository');

async function createReview({ orderId, productId, userId, rating, content, images, isAnonymous }) {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    return { notFound: true, message: '订单不存在' };
  }

  if (order.status !== '已完成') {
    return { badRequest: true, message: '只有已完成的订单才能评价' };
  }

  if (order.userId.toString() !== userId) {
    return { forbidden: true, message: '您没有权限评价此订单' };
  }

  const existingReview = await reviewRepository.findOne({ orderId, productId, userId });
  if (existingReview) {
    return { badRequest: true, message: '您已经评价过此商品' };
  }

  const product = await productRepository.findById(productId);
  if (!product) {
    return { notFound: true, message: '商品不存在' };
  }

  const review = await reviewRepository.create({
    orderId,
    productId,
    userId,
    merchantId: product.merchantId,
    rating,
    content,
    images: images || [],
    isAnonymous: isAnonymous || false,
  });

  return { reviewId: review._id };
}

function getProductSortOption(sort) {
  let sortOption = { createdAt: -1 };
  if (sort === 'highest') sortOption = { rating: -1, createdAt: -1 };
  if (sort === 'lowest') sortOption = { rating: 1, createdAt: -1 };
  if (sort === 'helpful') sortOption = { likes: -1, createdAt: -1 };
  return sortOption;
}

async function listProductReviews({ productId, page = 1, limit = 10, sort = 'newest', rating }) {
  const query = { productId, status: 'approved' };
  if (rating) query.rating = parseInt(rating, 10);

  const sortOption = getProductSortOption(sort);

  const reviews = await reviewRepository
    .find(query)
    .populate('userId', 'name')
    .sort(sortOption)
    .limit(parseInt(limit, 10))
    .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

  const total = await reviewRepository.countDocuments(query);

  const ratingStats = await reviewRepository.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const avgResult = await reviewRepository.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalCount: { $sum: 1 },
      },
    },
  ]);

  const avgRating = avgResult.length > 0 ? avgResult[0].avgRating.toFixed(1) : '0.0';
  const totalCount = avgResult.length > 0 ? avgResult[0].totalCount : 0;

  const processedReviews = reviews.map((review) => {
    const r = review.toObject();
    if (r.isAnonymous && r.userId) {
      r.userId.name = r.userId.name.charAt(0) + '***';
    }
    return r;
  });

  return {
    reviews: processedReviews,
    pagination: {
      total,
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      currentPage: parseInt(page, 10),
      limit: parseInt(limit, 10),
    },
    stats: {
      avgRating,
      totalCount,
      ratingDistribution: ratingStats,
    },
  };
}

async function listUserReviews({ userId, page = 1, limit = 10 }) {
  const reviews = await reviewRepository
    .find({ userId })
    .populate('productId', 'name imageUrl price')
    .populate('orderId', 'orderNumber')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10))
    .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

  const total = await reviewRepository.countDocuments({ userId });

  return {
    reviews,
    pagination: {
      total,
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      currentPage: parseInt(page, 10),
    },
  };
}

async function checkReviewed({ orderId, productId, userId }) {
  const review = await reviewRepository.findOne({ orderId, productId, userId });
  return {
    reviewed: !!review,
    review: review || null,
  };
}

async function listPendingReviews({ userId }) {
  const completedOrders = await orderRepository.find({ userId, status: '已完成' }).sort({ createdAt: -1 });

  const reviewedItems = await reviewRepository.find({ userId }).select('orderId productId');
  const reviewedSet = new Set(reviewedItems.map((r) => `${r.orderId}-${r.productId}`));

  const pendingReviews = [];
  for (const order of completedOrders) {
    for (const item of order.items) {
      const key = `${order._id}-${item.productId}`;
      if (!reviewedSet.has(key)) {
        pendingReviews.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          productId: item.productId,
          productName: item.name,
          productImage: item.imageUrl,
          price: item.price,
          quantity: item.quantity,
          orderDate: order.createdAt,
        });
      }
    }
  }

  return { pendingReviews };
}

async function toggleLike({ reviewId, userId }) {
  const review = await reviewRepository.findById(reviewId);
  if (!review) return null;

  const hasLiked = review.likedBy.includes(userId);

  if (hasLiked) {
    review.likedBy = review.likedBy.filter((id) => id.toString() !== userId);
    review.likes = Math.max(0, review.likes - 1);
  } else {
    review.likedBy.push(userId);
    review.likes += 1;
  }

  await review.save();

  return {
    message: hasLiked ? '取消点赞成功' : '点赞成功',
    likes: review.likes,
    hasLiked: !hasLiked,
  };
}

async function replyAsMerchant({ reviewId, merchantId, content }) {
  const review = await reviewRepository.findById(reviewId);
  if (!review) return null;

  if (review.merchantId.toString() !== merchantId) {
    return { forbidden: true };
  }

  review.merchantReply = { content, repliedAt: new Date() };
  await review.save();

  return { review };
}

async function listMerchantReviews({ merchantId, page = 1, limit = 10, rating, replied }) {
  const query = { merchantId };
  if (rating) query.rating = parseInt(rating, 10);
  if (replied === 'true') query['merchantReply.content'] = { $exists: true };
  if (replied === 'false') query['merchantReply.content'] = { $exists: false };

  const reviews = await reviewRepository
    .find(query)
    .populate('userId', 'name')
    .populate('productId', 'name imageUrl')
    .populate('orderId', 'orderNumber')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10))
    .skip((parseInt(page, 10) - 1) * parseInt(limit, 10));

  const total = await reviewRepository.countDocuments(query);

  const stats = await reviewRepository.aggregate([
    { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalCount: { $sum: 1 },
        goodCount: { $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] } },
        badCount: { $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] } },
      },
    },
  ]);

  return {
    reviews,
    pagination: {
      total,
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      currentPage: parseInt(page, 10),
    },
    stats: stats[0] || { avgRating: 0, totalCount: 0, goodCount: 0, badCount: 0 },
  };
}

module.exports = {
  createReview,
  listProductReviews,
  listUserReviews,
  checkReviewed,
  listPendingReviews,
  toggleLike,
  replyAsMerchant,
  listMerchantReviews,
};
