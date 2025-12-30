const { sendError } = require('../../utils/http');
const reviewService = require('../services/reviewService');
const reviewRepository = require('../repositories/reviewRepository');

async function create(req, res) {
  try {
    const { orderId, productId, userId, rating, content, images, isAnonymous } = req.body;

    const result = await reviewService.createReview({
      orderId,
      productId,
      userId,
      rating,
      content,
      images,
      isAnonymous,
    });

    if (result.notFound) {
      return res.status(404).json({ message: result.message });
    }
    if (result.badRequest) {
      return res.status(400).json({ message: result.message });
    }
    if (result.forbidden) {
      return res.status(403).json({ message: result.message });
    }

    return res.status(201).json({
      message: '评价成功',
      review: await reviewRepository.findById(result.reviewId).populate('userId', 'name'),
    });
  } catch (error) {
    console.error('创建评价失败:', error);
    return sendError(res, error, 500);
  }
}

async function listByProduct(req, res) {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'newest', rating } = req.query;

    const result = await reviewService.listProductReviews({
      productId,
      page,
      limit,
      sort,
      rating,
    });

    return res.json(result);
  } catch (error) {
    console.error('获取评价失败:', error);
    return sendError(res, error, 500);
  }
}

async function listByUser(req, res) {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await reviewService.listUserReviews({ userId, page, limit });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function check(req, res) {
  try {
    const { orderId, productId } = req.params;
    const { userId } = req.query;

    const result = await reviewService.checkReviewed({ orderId, productId, userId });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function pending(req, res) {
  try {
    const { userId } = req.params;
    const result = await reviewService.listPendingReviews({ userId });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function like(req, res) {
  try {
    const { reviewId } = req.params;
    const { userId } = req.body;

    const result = await reviewService.toggleLike({ reviewId, userId });
    if (!result) {
      return res.status(404).json({ message: '评价不存在' });
    }

    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function reply(req, res) {
  try {
    const { reviewId } = req.params;
    const { merchantId, content } = req.body;

    const result = await reviewService.replyAsMerchant({ reviewId, merchantId, content });
    if (!result) {
      return res.status(404).json({ message: '评价不存在' });
    }

    if (result.forbidden) {
      return res.status(403).json({ message: '您没有权限回复此评价' });
    }

    return res.json({ message: '回复成功', review: result.review });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function listByMerchant(req, res) {
  try {
    const { merchantId } = req.params;
    const { page = 1, limit = 10, rating, replied } = req.query;

    const result = await reviewService.listMerchantReviews({
      merchantId,
      page,
      limit,
      rating,
      replied,
    });

    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

module.exports = {
  create,
  listByProduct,
  listByUser,
  check,
  pending,
  like,
  reply,
  listByMerchant,
};
