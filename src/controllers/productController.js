const { sendError } = require('../../utils/http');
const { AppError } = require('../../middleware/errorHandler');
const productService = require('../services/productService');

// --------------------
// try/catch + sendError 风格（保持原行为：500 时返回 {message}）
// --------------------

async function getRecommended(req, res) {
  try {
    const userId = (req.user && (req.user.id || req.user._id)) ? (req.user.id || req.user._id) : undefined;
    const products = await productService.getRecommendedProducts({ userId });
    return res.json(products);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function list(req, res) {
  try {
    const { category, search, merchant, sortBy = 'createdAt' } = req.query;
    const products = await productService.listProducts({ category, search, merchant, sortBy });
    return res.json(products);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function listByCategory(req, res) {
  try {
    const { category } = req.params;
    const products = await productService.listProductsByCategory(category);
    return res.json(products);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function search(req, res) {
  try {
    const { q: searchQuery } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ message: '搜索关键词不能为空' });
    }

    const products = await productService.searchProductsBasic(searchQuery);
    return res.json(products);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function getById(req, res) {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ message: '商品不存在' });
    return res.json(product);
  } catch (error) {
    return sendError(res, error, 500);
  }
}

async function remove(req, res) {
  try {
    const product = await productService.deleteProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ message: '商品不存在' });
    }
    return res.json({ message: '商品已删除' });
  } catch (error) {
    return sendError(res, error, 500);
  }
}

// --------------------
// asyncHandler 风格（保持原行为：用 AppError / errorHandler 输出）
// --------------------

async function upload(req, res) {
  const result = await productService.uploadImage({ file: req.file });
  return res.json(result);
}

async function create(req, res) {
  const savedProduct = await productService.createProduct({ body: req.body, file: req.file });
  return res.status(201).json(savedProduct);
}

async function searchAdvanced(req, res) {
  const result = await productService.searchProductsAdvanced(req.query);
  return res.json(result);
}

async function searchFulltext(req, res) {
  const result = await productService.searchProductsFulltext(req.query);
  return res.json(result);
}

async function suggestions(req, res) {
  const { q: searchQuery } = req.query;
  if (!searchQuery || searchQuery.length < 1) {
    return res.json({ suggestions: [] });
  }
  const result = await productService.getSearchSuggestions(req.query);
  return res.json(result);
}

async function updateSearchData(req, res) {
  const { searchData } = await productService.updateSearchData(req.params.id);
  return res.json({ message: '搜索数据已更新', searchData });
}

async function rebuildSearchIndex(req, res) {
  const { total } = await productService.rebuildSearchIndex();
  return res.json({ message: `已更新 ${total} 个商品的搜索索引`, total });
}

async function searchNative(req, res) {
  const result = await productService.searchNative(req.query);
  return res.json(result);
}

async function searchNativeSuggestions(req, res) {
  const { q: searchQuery } = req.query;
  if (!searchQuery || searchQuery.length < 1) {
    return res.json({ suggestions: [] });
  }
  const result = await productService.searchNativeSuggestions(req.query);
  return res.json(result);
}

module.exports = {
  getRecommended,
  list,
  listByCategory,
  search,
  searchAdvanced,
  searchFulltext,
  suggestions,
  updateSearchData,
  rebuildSearchIndex,
  searchNative,
  searchNativeSuggestions,
  getById,
  upload,
  remove,
  create,
};
