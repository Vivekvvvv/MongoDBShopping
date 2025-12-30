const { AppError } = require('../../middleware/errorHandler');

const { generateLogisticsTraces } = require('../../utils/logisticsTraces');

const userRepository = require('../repositories/userRepository');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const logisticsRepository = require('../repositories/logisticsRepository');

async function createOrder({ userId, itemsArray, shippingAddress, remarks }) {
  // 验证用户
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  // 计算总金额并检查库存
  let total = 0;
  const populatedItems = [];

  for (const item of itemsArray) {
    // eslint-disable-next-line no-await-in-loop
    const product = await productRepository.findById(item.productId);
    if (!product) {
      throw new Error(`商品 ${item.productId} 不存在`);
    }

    if (product.stock < item.quantity) {
      throw new Error(`商品 ${product.name} 库存不足，当前库存: ${product.stock}`);
    }

    populatedItems.push({
      productId: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: item.quantity,
      imageUrl: product.imageUrl,
      merchant: product.merchant,
      merchantId: product.merchantId,
    });

    total += product.price * item.quantity;

    // 扣减库存
    product.stock -= item.quantity;
    product.salesCount += item.quantity;
    // eslint-disable-next-line no-await-in-loop
    await product.save();
  }

  // 检查用户余额
  if (user.balance < total) {
    throw new Error('余额不足，请充值');
  }

  // 扣减用户余额
  user.balance -= total;
  await user.save();

  // 更新商家销售额
  for (const item of populatedItems) {
    if (item.merchantId) {
      // eslint-disable-next-line no-await-in-loop
      await userRepository.findByIdAndUpdate(item.merchantId, { $inc: { 'merchantInfo.totalSales': item.quantity } });
    }
  }

  // 创建订单
  const newOrder = {
    userId,
    items: populatedItems,
    total,
    status: '已支付',
    shippingAddress,
    remarks,
    paymentInfo: {
      method: '余额支付',
      paidAt: new Date(),
      transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`,
    },
  };

  const savedOrder = await orderRepository.create(newOrder);

  // 创建物流信息
  const logistics = await logisticsRepository.create({
    orderId: savedOrder._id,
    carrier: '顺丰速运',
    origin: populatedItems[0]?.merchantId
      ? {
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          detail: '科技园',
        }
      : {
          province: '广东省',
          city: '广州市',
          district: '天河区',
          detail: '电商产业园',
        },
    destination: shippingAddress,
    status: '已揽收',
    traces: generateLogisticsTraces(
      {
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '科技园',
      },
      shippingAddress
    ),
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  });

  return { order: savedOrder, logistics };
}

async function listUserOrders({ userId, status, page = 1, limit = 10 }) {
  const query = { userId };
  if (status) query.status = status;

  const orders = await orderRepository
    .find(query)
    .populate('items.productId', 'name imageUrl')
    .populate('items.merchantId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await orderRepository.countDocuments(query);

  return {
    orders,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total,
  };
}

async function getOrderDetail(orderId) {
  const order = await orderRepository
    .findById(orderId)
    .populate('userId', 'name email')
    .populate('items.productId', 'name imageUrl')
    .populate('items.merchantId', 'name merchantInfo');

  if (!order) return null;

  const logistics = await logisticsRepository.findOne({ orderId: order._id });

  return { order, logistics };
}

async function getLogistics(orderId) {
  const logistics = await logisticsRepository.findOne({ orderId }).populate('orderId', 'orderNumber');
  return logistics;
}

async function updateOrderStatus(orderId, status) {
  const order = await orderRepository.findByIdAndUpdate(orderId, { status }, { new: true });
  if (!order) return null;

  if (status === '发货中') {
    await logisticsRepository.findOneAndUpdate({ orderId: order._id }, { status: '运输中' });
  }

  return order;
}

async function payOrder(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) return null;

  if (order.status !== '待支付') {
    return { notPayable: true };
  }

  order.status = '已支付';
  order.paymentInfo = {
    method: '在线支付',
    paidAt: new Date(),
    transactionId: `PAY${Date.now()}`,
  };

  await order.save();
  return { order };
}

async function cancelOrder(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) return null;

  if (order.status !== '待支付') {
    return { notCancelable: true };
  }

  for (const item of order.items) {
    // eslint-disable-next-line no-await-in-loop
    await productRepository.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity, salesCount: -item.quantity } });
  }

  order.status = '已取消';
  await order.save();

  return { order };
}

async function confirmOrder(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) return null;

  order.status = '已完成';

  await logisticsRepository.findOneAndUpdate({ orderId: order._id }, { status: '已签收', deliveredAt: new Date() });

  await order.save();

  return { order };
}

async function shipOrder(orderId, { merchantId, carrier, trackingNumber }) {
  const order = await orderRepository.findById(orderId);
  if (!order) return null;

  if (order.status !== '已支付') {
    return { notShippable: true };
  }

  const merchantItems = order.items.filter((item) => {
    if (!item.merchantId) return false;
    const itemMerchantId = item.merchantId._id ? item.merchantId._id.toString() : item.merchantId.toString();
    return itemMerchantId === merchantId || itemMerchantId === merchantId.toString();
  });

  if (merchantItems.length === 0) {
    const merchant = await userRepository.findOne({ _id: merchantId, role: 'merchant' });
    if (!merchant) {
      return { forbidden: true };
    }
  }

  order.status = '发货中';
  order.logistics = {
    company: carrier || '顺丰速运',
    trackingNumber: trackingNumber || `SF${Date.now()}`,
    shippedAt: new Date(),
    status: '已发货',
  };
  await order.save();

  const logistics = await logisticsRepository.findOne({ orderId: order._id });
  if (logistics) {
    logistics.carrier = carrier || logistics.carrier;
    if (trackingNumber) {
      logistics.trackingNumber = trackingNumber;
    }
    logistics.status = '运输中';
    logistics.traces.push({
      time: new Date(),
      location: '商家仓库',
      description: '商家已发货，快递员正在揽收',
      status: '已发货',
    });
    await logistics.save();
  }

  return { order, logistics };
}

async function batchShipOrders({ merchantId, orderIds, carrier }) {
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    throw new AppError('请选择要发货的订单', 400, 'INVALID_ORDER_IDS');
  }

  const results = { success: [], failed: [] };

  for (const orderId of orderIds) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const order = await orderRepository.findById(orderId);

      if (!order) {
        results.failed.push({ orderId, reason: '订单不存在' });
        continue;
      }

      if (order.status !== '已支付') {
        results.failed.push({ orderId, reason: '订单状态不正确' });
        continue;
      }

      order.status = '发货中';
      order.logistics = {
        company: carrier || '顺丰速运',
        trackingNumber: `SF${Date.now()}${Math.floor(Math.random() * 1000)}`,
        shippedAt: new Date(),
        status: '已发货',
      };
      // eslint-disable-next-line no-await-in-loop
      await order.save();

      // eslint-disable-next-line no-await-in-loop
      await logisticsRepository.findOneAndUpdate(
        { orderId: order._id },
        {
          status: '运输中',
          carrier: carrier || '顺丰速运',
          $push: {
            traces: {
              time: new Date(),
              location: '商家仓库',
              description: '商家已发货，快递员正在揽收',
              status: '已发货',
            },
          },
        }
      );

      results.success.push(orderId);
    } catch (err) {
      results.failed.push({ orderId, reason: err.message });
    }
  }

  return results;
}

async function deleteOrder(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) return null;

  await orderRepository.findByIdAndDelete(orderId);
  await logisticsRepository.findOneAndDelete({ orderId });

  return order;
}

async function refundOrder(orderId) {
  const order = await orderRepository.findById(orderId);
  if (!order) return null;

  if (!['已支付', '发货中'].includes(order.status)) {
    return { invalidStatus: true };
  }

  order.status = '已退款';

  if (order.paymentInfo && order.paymentInfo.method === '余额支付') {
    const user = await userRepository.findById(order.userId);
    if (user) {
      user.balance += order.total;
      await user.save();
    }
  }

  for (const item of order.items) {
    // eslint-disable-next-line no-await-in-loop
    await productRepository.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity, salesCount: -item.quantity } });
  }

  await order.save();

  return { order };
}

module.exports = {
  createOrder,
  listUserOrders,
  getOrderDetail,
  getLogistics,
  updateOrderStatus,
  payOrder,
  cancelOrder,
  confirmOrder,
  shipOrder,
  batchShipOrders,
  deleteOrder,
  refundOrder,
};
