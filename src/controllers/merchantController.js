const { sendError } = require('../../utils/http');
const merchantService = require('../services/merchantService');

async function listMerchants(req, res) {
  try {
    const merchants = await merchantService.listMerchants();
    return res.json(merchants);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function getMerchant(req, res) {
  try {
    const merchant = await merchantService.getMerchantById(req.params.id);
    if (!merchant) return res.status(404).json({ message: '商家不存在' });
    return res.json(merchant);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

// 注意：该 handler 需要由 asyncHandler 包裹，以保持原有 AppError 行为
async function createMerchant(req, res) {
  const { name, email, password, shopName, shopDescription, contactPhone, rating } = req.body;

  const newMerchant = await merchantService.createMerchant({
    name,
    email,
    password,
    shopName,
    shopDescription,
    contactPhone,
    rating,
  });

  return res.status(201).json({
    message: '商家创建成功',
    merchant: {
      id: newMerchant._id,
      name: newMerchant.name,
      email: newMerchant.email,
      merchantInfo: newMerchant.merchantInfo,
    },
  });
}

async function updateMerchant(req, res) {
  try {
    const updatedMerchant = await merchantService.updateMerchant(req.params.id, req.body);
    if (!updatedMerchant) return res.status(404).json({ message: '商家不存在' });
    return res.json(updatedMerchant);
  } catch (error) {
    return sendError(res, error, 400);
  }
}

async function deleteMerchant(req, res) {
  try {
    const merchant = await merchantService.deleteMerchant(req.params.id);
    if (!merchant) return res.status(404).json({ message: '商家不存在' });
    return res.json({ message: '商家及其商品已删除' });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function listProductsByMerchant(req, res) {
  try {
    const products = await merchantService.listProductsByMerchant(req.params.merchantId);
    return res.json(products);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

// 注意：该 handler 需要由 asyncHandler 包裹，以保持原有 AppError 行为
async function updateProduct(req, res) {
  const updateData = { ...req.body };
  const updatedProduct = await merchantService.updateProduct(req.params.id, updateData);
  return res.json(updatedProduct);
}

async function getMerchantStats(req, res) {
  try {
    const result = await merchantService.getMerchantStats(req.params.merchantId);
    if (result && result.notFound) {
      return res.status(404).json({ message: result.message });
    }
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function listMerchantOrders(req, res) {
  try {
    const { merchantId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await merchantService.listMerchantOrders({ merchantId, status, page, limit });
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function exportMerchantProductsCsv(req, res) {
  try {
    const { merchantId } = req.params;
    const result = await merchantService.exportMerchantProductsCsv(merchantId);

    if (result && result.notFound) {
      return res.status(404).json({ message: result.message });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    return res.send(result.content);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function analyticsOrders(req, res) {
  try {
    const result = await merchantService.analyticsOrders(req.query);
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

module.exports = {
  listMerchants,
  getMerchant,
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
