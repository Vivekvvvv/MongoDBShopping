const path = require('path');

const { AppError } = require('../../middleware/errorHandler');
const { sendError } = require('../../utils/http');

const userRepository = require('../repositories/userRepository');
const productRepository = require('../repositories/productRepository');

const { processUploadedImage } = require('../../utils/imageProcessor');
const { uploadDir } = require('../../config/upload');

const {
  generateProductSearchData,
  buildFuzzySearchQuery,
  buildSearchAggregation,
  highlightMatch,
} = require('../../utils/searchHelper');

const {
  buildAggregateSearch,
  buildCountPipeline,
  buildSuggestionPipeline,
  highlightMatch: nativeHighlight,
} = require('../../utils/nativeSearch');

async function getRecommendedProducts({ userId }) {
  let products = [];

  if (userId) {
    const user = await userRepository.findById(userId, { populate: 'recentViews' });
    if (user) {
      const prefs = Array.from(user.categoryPreferences.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map((p) => p[0]);

      if (prefs.length > 0) {
        const prefProducts = await productRepository
          .find(
            {
              category: { $in: prefs },
              _id: { $nin: user.recentViews },
            },
            {
              populate: { path: 'merchantId', select: 'name merchantInfo' },
              sort: { salesCount: -1 },
            }
          )
          .limit(4);

        products.push(...prefProducts);
      }

      if (products.length < 8) {
        const otherProducts = await productRepository
          .find(
            {
              category: { $nin: prefs },
              _id: { $nin: user.recentViews },
            },
            {
              populate: { path: 'merchantId', select: 'name merchantInfo' },
              sort: { salesCount: -1 },
            }
          )
          .limit(8 - products.length);

        products.push(...otherProducts);
      }
    }
  }

  if (products.length === 0) {
    const categories = await productRepository.distinct('category');
    for (const cat of categories) {
      // eslint-disable-next-line no-await-in-loop
      const top = await productRepository
        .find(
          { category: cat },
          { populate: { path: 'merchantId', select: 'name merchantInfo' }, sort: { salesCount: -1 } }
        )
        .limit(2);
      products.push(...top);
    }
    products = products.sort(() => Math.random() - 0.5).slice(0, 10);
  }

  return products;
}

function buildSort(sortBy) {
  switch (sortBy) {
    case 'salesCount':
      return { salesCount: -1 };
    case 'priceAsc':
      return { price: 1 };
    case 'priceDesc':
      return { price: -1 };
    case 'stock':
      return { stock: -1 };
    default:
      return { createdAt: -1 };
  }
}

async function listProducts({ category, search, merchant, sortBy = 'createdAt' }) {
  const query = {};
  if (category) query.category = category;
  if (merchant) query.merchant = new RegExp(merchant, 'i');

  if (search) {
    const fuzzyQuery = buildFuzzySearchQuery(search);
    Object.assign(query, fuzzyQuery);
  }

  const sort = buildSort(sortBy);

  const products = await productRepository
    .find(query, { populate: { path: 'merchantId', select: 'name merchantInfo' }, sort })
    .exec();

  return products;
}

async function listProductsByCategory(category) {
  return productRepository
    .find({ category }, { populate: { path: 'merchantId', select: 'name merchantInfo' }, sort: { salesCount: -1 } })
    .exec();
}

async function searchProductsBasic(searchQuery) {
  if (!searchQuery) {
    throw new AppError('搜索关键词不能为空', 400, 'EMPTY_QUERY');
  }

  const query = buildFuzzySearchQuery(searchQuery);

  return productRepository
    .find(query, { populate: { path: 'merchantId', select: 'name merchantInfo' }, sort: { salesCount: -1 } })
    .exec();
}

async function searchProductsAdvanced(params) {
  const {
    q: searchQuery,
    category,
    minPrice,
    maxPrice,
    sortBy = 'relevance',
    page = 1,
    limit = 20,
  } = params;

  if (!searchQuery || !searchQuery.trim()) {
    throw new AppError('搜索关键词不能为空', 400, 'EMPTY_QUERY');
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const pipeline = buildSearchAggregation(searchQuery, {
    limit: parseInt(limit, 10),
    skip,
    category,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    sortBy,
  });

  const products = await productRepository.aggregate(pipeline);

  const countPipeline = [{ $match: buildFuzzySearchQuery(searchQuery) }];
  if (category) countPipeline[0].$match.category = category;

  const countResult = await productRepository.aggregate([...countPipeline, { $count: 'total' }]);
  const total = countResult.length > 0 ? countResult[0].total : 0;

  const highlightedProducts = products.map((p) => ({
    ...p,
    nameHighlighted: highlightMatch(p.name, searchQuery),
    descriptionHighlighted: highlightMatch(p.description, searchQuery),
  }));

  return {
    products: highlightedProducts,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    },
    query: searchQuery,
  };
}

async function searchProductsFulltext({ q: searchQuery, limit = 20 }) {
  if (!searchQuery || !searchQuery.trim()) {
    throw new AppError('搜索关键词不能为空', 400, 'EMPTY_QUERY');
  }

  const Product = require('../../models/Product');
  const products = await Product.find(
    { $text: { $search: searchQuery } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(parseInt(limit, 10))
    .populate('merchantId', 'name merchantInfo');

  return {
    products,
    total: products.length,
    searchMethod: 'MongoDB $text',
    query: searchQuery,
  };
}

async function getSearchSuggestions({ q: searchQuery, limit = 10 }) {
  if (!searchQuery || searchQuery.length < 1) {
    return { suggestions: [], query: searchQuery };
  }

  const q = searchQuery.toLowerCase();

  const suggestions = await productRepository.aggregate([
    {
      $match: {
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { nameNgrams: { $regex: q, $options: 'i' } },
          { namePinyin: { $regex: q, $options: 'i' } },
          { namePinyinInitials: { $regex: q, $options: 'i' } },
        ],
      },
    },
    {
      $group: {
        _id: '$name',
        category: { $first: '$category' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: parseInt(limit, 10) },
    {
      $project: {
        text: '$_id',
        category: 1,
        _id: 0,
      },
    },
  ]);

  return { suggestions, query: searchQuery };
}

async function updateSearchData(productId) {
  const product = await productRepository.findById(productId);
  if (!product) {
    throw new AppError('商品不存在', 404, 'NOT_FOUND');
  }

  const searchData = generateProductSearchData(product);

  await productRepository.findByIdAndUpdate(productId, { $set: searchData });

  return { searchData };
}

async function rebuildSearchIndex() {
  const products = await productRepository.findAll();
  let updated = 0;

  for (const product of products) {
    // eslint-disable-next-line no-await-in-loop
    const searchData = generateProductSearchData(product);
    // eslint-disable-next-line no-await-in-loop
    await productRepository.findByIdAndUpdate(product._id, { $set: searchData });
    updated++;
  }

  return { total: updated };
}

async function searchNative(params) {
  const {
    q: searchQuery,
    category,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20,
    sortBy = 'relevance',
    strategy = 'multi',
  } = params;

  if (!searchQuery || !searchQuery.trim()) {
    throw new AppError('搜索关键词不能为空', 400, 'EMPTY_QUERY');
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const pipeline = buildAggregateSearch(searchQuery, {
    limit: parseInt(limit, 10),
    skip,
    category,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    sortBy,
    matchStrategy: strategy,
  });

  const products = await productRepository.aggregate(pipeline);

  const countPipeline = buildCountPipeline(searchQuery, {
    category,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    matchStrategy: strategy,
  });
  const countResult = await productRepository.aggregate(countPipeline);
  const total = countResult.length > 0 ? countResult[0].total : 0;

  const highlightedProducts = products.map((p) => ({
    ...p,
    nameHighlighted: nativeHighlight(p.name, searchQuery),
    descriptionHighlighted: nativeHighlight(p.description, searchQuery),
  }));

  return {
    success: true,
    products: highlightedProducts,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    },
    meta: {
      query: searchQuery,
      strategy,
      sortBy,
      searchMethod: 'MongoDB Native Aggregate Pipeline',
    },
  };
}

async function searchNativeSuggestions({ q: searchQuery, limit = 10 }) {
  if (!searchQuery || searchQuery.length < 1) {
    return { suggestions: [], query: searchQuery };
  }

  const pipeline = buildSuggestionPipeline(searchQuery, parseInt(limit, 10));
  const suggestions = await productRepository.aggregate(pipeline);

  return {
    success: true,
    suggestions,
    query: searchQuery,
  };
}

async function getProductById(productId) {
  const product = await productRepository.findById(productId, {
    populate: { path: 'merchantId', select: 'name merchantInfo' },
  });
  return product;
}

async function deleteProduct(productId) {
  return productRepository.findByIdAndDelete(productId);
}

async function uploadImage({ file }) {
  if (!file) {
    throw new AppError('请上传图片', 400, 'NO_FILE');
  }

  const filePath = file.path;
  const resolvedUploadDir = uploadDir || path.join(__dirname, '..', '..', 'public', 'uploads');

  try {
    const result = await processUploadedImage(filePath, resolvedUploadDir);
    if (result.success) {
      console.log(`Image compressed: ${result.compressionRatio} reduction`);
    }
  } catch (compressError) {
    console.warn('Image compression failed, using original:', compressError.message);
  }

  return {
    imageUrl: `/uploads/${file.filename}`,
    message: '图片上传成功',
  };
}

async function createProduct({ body, file }) {
  const productData = { ...body };

  if (file) {
    productData.imageUrl = `/uploads/${file.filename}`;
  }

  if (!productData.productCode) {
    productData.productCode = 'P' + Date.now() + Math.floor(Math.random() * 1000);
  }

  if (productData.merchant && !productData.merchantId) {
    productData.merchantId = productData.merchant;
    const User = require('../../models/User');
    const merchantUser = await User.findById(productData.merchantId);
    if (merchantUser) {
      productData.merchant = merchantUser.merchantInfo && merchantUser.merchantInfo.shopName
        ? merchantUser.merchantInfo.shopName
        : merchantUser.name;
    }
  }

  const searchData = generateProductSearchData(productData);
  Object.assign(productData, searchData);

  return productRepository.create(productData);
}

module.exports = {
  getRecommendedProducts,
  listProducts,
  listProductsByCategory,
  searchProductsBasic,
  searchProductsAdvanced,
  searchProductsFulltext,
  getSearchSuggestions,
  updateSearchData,
  rebuildSearchIndex,
  searchNative,
  searchNativeSuggestions,
  getProductById,
  uploadImage,
  deleteProduct,
  createProduct,
};
