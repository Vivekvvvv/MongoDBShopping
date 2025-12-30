const userRepository = require('../repositories/userRepository');
const productRepository = require('../repositories/productRepository');

async function recordProductView({ userId, productId }) {
  if (!userId) {
    return { guest: true, message: '游客浏览，不记录个性化偏好' };
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return { notFound: true, message: '用户不存在' };
  }

  const product = await productRepository.findById(productId);
  if (!product) {
    return { notFound: true, message: '商品不存在' };
  }

  // 1. 更新最近浏览 (先进先出，限制10个)
  user.recentViews = (user.recentViews || []).filter((id) => id.toString() !== productId);
  user.recentViews.unshift(productId);
  while (user.recentViews.length > 10) user.recentViews.pop();

  // 2. 更新品类偏好权重
  if (product.category) {
    if (!user.categoryPreferences || typeof user.categoryPreferences.get !== 'function') {
      user.categoryPreferences = new Map(Object.entries(user.categoryPreferences || {}));
    }
    const currentWeight = user.categoryPreferences.get(product.category) || 0;
    user.categoryPreferences.set(product.category, currentWeight + 1);
  }

  await user.save();
  return { message: '浏览记录已更新' };
}

module.exports = {
  recordProductView,
};
