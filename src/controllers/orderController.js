const { sendError } = require('../../utils/http');
const orderService = require('../services/orderService');

async function create(req, res) {
  try {
    console.log('📥 收到订单请求:');
    console.log('  - req.body 类型:', typeof req.body);
    console.log('  - req.body:', JSON.stringify(req.body, null, 2));

    const { userId, items, shippingAddress, remarks } = req.body;

    console.log('📦 解构后的 items:');
    console.log('  - items 类型:', typeof items);
    console.log('  - items 是否为数组:', Array.isArray(items));
    console.log('  - items 值:', items);

    let itemsArray = items;
    if (items && typeof items === 'object' && !Array.isArray(items)) {
      console.log('🔧 检测到 items 是对象，正在转换为数组...');
      itemsArray = Object.values(items);
      console.log('  - 转换后的 itemsArray:', itemsArray);
    }

    if (!itemsArray) {
      console.error('❌ items 为空或未定义');
      return res.status(400).json({
        message: '订单商品列表为空，请添加商品后再下单',
        debug: { receivedKeys: Object.keys(req.body || {}) },
      });
    }

    if (!Array.isArray(itemsArray)) {
      console.error('❌ itemsArray 不是数组，实际类型:', typeof itemsArray, '值:', itemsArray);
      return res.status(400).json({
        message: '订单商品列表格式错误，请刷新页面后重试',
        debug: { itemsType: typeof itemsArray },
      });
    }

    if (itemsArray.length === 0) {
      return res.status(400).json({ message: '购物车为空，无法创建订单' });
    }

    for (let i = 0; i < itemsArray.length; i++) {
      const item = itemsArray[i];
      if (!item || !item.productId) {
        console.error(`❌ 订单项 ${i + 1} 无效:`, item);
        return res.status(400).json({
          message: `订单商品项 ${i + 1} 数据无效（缺少商品ID）`,
        });
      }

      item.quantity = Number(item.quantity) || 1;
      if (item.quantity <= 0) {
        return res.status(400).json({
          message: `订单商品项 ${i + 1} 数量必须大于0`,
        });
      }
    }

    const { order, logistics } = await orderService.createOrder({
      userId,
      itemsArray,
      shippingAddress,
      remarks,
    });

    return res.status(201).json({
      order,
      logistics,
      message: '订单创建成功',
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return sendError(res, error, 400);
  }
}

async function listByUser(req, res) {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await orderService.listUserOrders({
      userId,
      status,
      page,
      limit,
    });

    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function getById(req, res) {
  try {
    const result = await orderService.getOrderDetail(req.params.id);
    if (!result) return res.status(404).json({ message: '订单不存在' });

    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function getLogistics(req, res) {
  try {
    const logistics = await orderService.getLogistics(req.params.orderId);
    if (!logistics) return res.status(404).json({ message: '物流信息不存在' });
    return res.json(logistics);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const order = await orderService.updateOrderStatus(req.params.id, status);
    if (!order) return res.status(404).json({ message: '订单不存在' });
    return res.json(order);
  } catch (error) {
    return sendError(res, error, 400);
  }
}

async function pay(req, res) {
  try {
    const result = await orderService.payOrder(req.params.id);
    if (!result) return res.status(404).json({ message: '订单不存在' });
    if (result.notPayable) {
      return res.status(400).json({ message: '订单状态不正确，无法支付' });
    }
    return res.json({ message: '支付成功', order: result.order });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function cancel(req, res) {
  try {
    const result = await orderService.cancelOrder(req.params.id);
    if (!result) return res.status(404).json({ message: '订单不存在' });
    if (result.notCancelable) {
      return res.status(400).json({ message: '只能取消待支付的订单' });
    }
    return res.json({ message: '订单已取消', order: result.order });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function confirm(req, res) {
  try {
    const result = await orderService.confirmOrder(req.params.id);
    if (!result) return res.status(404).json({ message: '订单不存在' });
    return res.json({ message: '确认收货成功', order: result.order });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function ship(req, res) {
  try {
    const { merchantId, carrier, trackingNumber } = req.body;

    const result = await orderService.shipOrder(req.params.id, { merchantId, carrier, trackingNumber });

    if (!result) {
      return res.status(404).json({ message: '订单不存在' });
    }

    if (result.notShippable) {
      return res.status(400).json({ message: '只有已支付的订单才能发货' });
    }

    if (result.forbidden) {
      return res.status(403).json({ message: '您没有权限操作此订单' });
    }

    return res.json({
      message: '发货成功',
      order: result.order,
      logistics: result.logistics,
    });
  } catch (error) {
    console.error('发货失败:', error);
    return sendError(res, error, 500);
  }
}

async function batchShip(req, res) {
  try {
    const { merchantId } = req.params;
    const { orderIds, carrier } = req.body;

    const results = await orderService.batchShipOrders({ merchantId, orderIds, carrier });

    return res.json({
      message: `成功发货 ${results.success.length} 个订单，失败 ${results.failed.length} 个`,
      results,
    });
  } catch (error) {
    // 旧实现：这里用 sendError 500（而不是 AppError 格式）
    return sendError(res, error, error.statusCode || 500);
  }
}

async function remove(req, res) {
  try {
    const order = await orderService.deleteOrder(req.params.id);
    if (!order) return res.status(404).json({ message: '订单不存在' });
    return res.json({ message: '订单已删除' });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function refund(req, res) {
  try {
    const result = await orderService.refundOrder(req.params.id);
    if (!result) return res.status(404).json({ message: '订单不存在' });
    if (result.invalidStatus) {
      return res.status(400).json({ message: '当前订单状态无法申请退款' });
    }
    return res.json({ message: '退款申请成功，金额已退回', order: result.order });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

module.exports = {
  create,
  listByUser,
  getById,
  getLogistics,
  updateStatus,
  pay,
  cancel,
  confirm,
  ship,
  batchShip,
  remove,
  refund,
};
