/**
 * MongoDB 原生聚合管道搜索模块
 * 纯数据库操作，不依赖预处理字段
 */

/**
 * 转义正则表达式特殊字符
 * @param {string} string - 输入字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 构建基础正则搜索条件
 * @param {string} query - 搜索关键词
 * @param {string[]} fields - 要搜索的字段
 * @returns {Object} MongoDB 查询条件
 */
function buildRegexSearch(query, fields = ['name', 'description', 'category', 'searchKeywords']) {
  const escapedQuery = escapeRegExp(query);
  const conditions = fields.map(field => ({
    [field]: { $regex: escapedQuery, $options: 'i' }
  }));
  return { $or: conditions };
}

/**
 * 构建通配符搜索条件
 * 将搜索词拆分，允许中间有其他字符
 * 例如: "手机" -> "手.*机" 可以匹配 "手提电话机"
 * @param {string} query - 搜索关键词
 * @returns {Object} MongoDB 查询条件
 */
function buildWildcardSearch(query) {
  const chars = query.split('');
  const escapedChars = chars.map(c => escapeRegExp(c));
  const wildcardPattern = escapedChars.join('.*');

  return {
    $or: [
      { name: { $regex: wildcardPattern, $options: 'i' } },
      { description: { $regex: wildcardPattern, $options: 'i' } }
    ]
  };
}

/**
 * 构建动态 n-gram 搜索条件
 * 将搜索词拆分成 n-gram，要求所有片段都匹配
 * @param {string} query - 搜索关键词
 * @param {number} n - gram 大小
 * @returns {Object} MongoDB 查询条件
 */
function buildDynamicNgramSearch(query, n = 2) {
  if (query.length < n) {
    return { name: { $regex: escapeRegExp(query), $options: 'i' } };
  }

  const ngrams = [];
  for (let i = 0; i <= query.length - n; i++) {
    ngrams.push(escapeRegExp(query.substring(i, i + n)));
  }

  // 所有 n-gram 都必须在名称中出现
  return {
    $and: ngrams.map(gram => ({
      name: { $regex: gram, $options: 'i' }
    }))
  };
}

/**
 * 构建多策略模糊匹配条件
 * 组合多种匹配策略，提高召回率
 * @param {string} query - 搜索关键词
 * @returns {Object} MongoDB 查询条件
 */
function buildMultiStrategyMatch(query) {
  const escaped = escapeRegExp(query);
  const chars = query.split('');
  const escapedChars = chars.map(c => escapeRegExp(c));

  const conditions = [
    // 1. 精确包含
    { name: { $regex: escaped, $options: 'i' } },
    { description: { $regex: escaped, $options: 'i' } },
    { category: { $regex: escaped, $options: 'i' } },

    // 2. 通配符匹配 (字符间允许其他字符)
    { name: { $regex: escapedChars.join('.*'), $options: 'i' } },

    // 3. 首尾匹配
    { name: { $regex: `^${escaped}`, $options: 'i' } },  // 以关键词开头
    { name: { $regex: `${escaped}$`, $options: 'i' } }   // 以关键词结尾
  ];

  // 4. 如果是多字查询，添加分词匹配
  if (query.length >= 2) {
    // 拆分成 2-gram
    for (let i = 0; i < query.length - 1; i++) {
      const gram = escapeRegExp(query.substring(i, i + 2));
      conditions.push({ name: { $regex: gram, $options: 'i' } });
    }
  }

  return { $or: conditions };
}

/**
 * 构建完整的聚合管道搜索
 * 在数据库端计算相关度评分，支持分页和排序
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Array} MongoDB 聚合管道
 */
function buildAggregateSearch(query, options = {}) {
  const {
    limit = 20,
    skip = 0,
    category = null,
    minPrice = null,
    maxPrice = null,
    sortBy = 'relevance', // relevance | price | priceDesc | sales | newest
    matchStrategy = 'multi' // multi | exact | wildcard | ngram
  } = options;

  const escaped = escapeRegExp(query);
  const queryLower = query.toLowerCase();

  // 根据策略选择匹配条件
  let matchCondition;
  switch (matchStrategy) {
    case 'exact':
      matchCondition = buildRegexSearch(query);
      break;
    case 'wildcard':
      matchCondition = buildWildcardSearch(query);
      break;
    case 'ngram':
      matchCondition = buildDynamicNgramSearch(query, 2);
      break;
    case 'multi':
    default:
      matchCondition = buildMultiStrategyMatch(query);
  }

  const pipeline = [];

  // ========== 1. 匹配阶段 ==========
  const matchStage = { $match: { ...matchCondition } };

  // 添加分类过滤
  if (category) {
    matchStage.$match.category = category;
  }

  // 添加价格过滤
  if (minPrice !== null || maxPrice !== null) {
    matchStage.$match.price = {};
    if (minPrice !== null) matchStage.$match.price.$gte = parseFloat(minPrice);
    if (maxPrice !== null) matchStage.$match.price.$lte = parseFloat(maxPrice);
  }

  pipeline.push(matchStage);

  // ========== 2. 计算相关度评分 ==========
  pipeline.push({
    $addFields: {
      // 名称相关度评分
      nameScore: {
        $switch: {
          branches: [
            // 完全匹配 (100分)
            {
              case: { $eq: [{ $toLower: '$name' }, queryLower] },
              then: 100
            },
            // 以关键词开头 (80分)
            {
              case: { $regexMatch: { input: '$name', regex: `^${escaped}`, options: 'i' } },
              then: 80
            },
            // 以关键词结尾 (70分)
            {
              case: { $regexMatch: { input: '$name', regex: `${escaped}$`, options: 'i' } },
              then: 70
            },
            // 包含关键词 (60分)
            {
              case: { $regexMatch: { input: '$name', regex: escaped, options: 'i' } },
              then: 60
            }
          ],
          default: 0
        }
      },
      // 分类匹配评分
      categoryScore: {
        $cond: [
          { $regexMatch: { input: { $ifNull: ['$category', ''] }, regex: escaped, options: 'i' } },
          20,
          0
        ]
      },
      // 描述匹配评分
      descriptionScore: {
        $cond: [
          { $regexMatch: { input: { $ifNull: ['$description', ''] }, regex: escaped, options: 'i' } },
          10,
          0
        ]
      },
      // 关键词匹配评分
      keywordScore: {
        $cond: [
          { $regexMatch: { input: { $ifNull: ['$searchKeywords', ''] }, regex: escaped, options: 'i' } },
          15,
          0
        ]
      },
      // 销量加成 (最高 20 分)
      salesBonus: {
        $min: [20, { $multiply: [{ $ifNull: ['$salesCount', 0] }, 0.01] }]
      },
      // 库存惩罚 (无库存减 30 分)
      stockPenalty: {
        $cond: [{ $lte: [{ $ifNull: ['$stock', 0] }, 0] }, -30, 0]
      }
    }
  });

  // 计算总分
  pipeline.push({
    $addFields: {
      relevanceScore: {
        $add: [
          '$nameScore',
          '$categoryScore',
          '$descriptionScore',
          '$keywordScore',
          '$salesBonus',
          '$stockPenalty'
        ]
      }
    }
  });

  // ========== 3. 排序阶段 ==========
  let sortStage;
  switch (sortBy) {
    case 'price':
      sortStage = { $sort: { price: 1, relevanceScore: -1 } };
      break;
    case 'priceDesc':
      sortStage = { $sort: { price: -1, relevanceScore: -1 } };
      break;
    case 'sales':
      sortStage = { $sort: { salesCount: -1, relevanceScore: -1 } };
      break;
    case 'newest':
      sortStage = { $sort: { createdAt: -1, relevanceScore: -1 } };
      break;
    case 'relevance':
    default:
      sortStage = { $sort: { relevanceScore: -1, salesCount: -1 } };
  }
  pipeline.push(sortStage);

  // ========== 4. 分页 ==========
  if (skip > 0) {
    pipeline.push({ $skip: skip });
  }
  pipeline.push({ $limit: limit });

  // ========== 5. 关联商家信息 ==========
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'merchantId',
      foreignField: '_id',
      as: 'merchantData'
    }
  });

  pipeline.push({
    $addFields: {
      merchantInfo: {
        $cond: [
          { $gt: [{ $size: '$merchantData' }, 0] },
          { $arrayElemAt: ['$merchantData', 0] },
          null
        ]
      }
    }
  });

  // ========== 6. 投影输出字段 ==========
  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      description: 1,
      price: 1,
      imageUrl: 1,
      category: 1,
      stock: 1,
      salesCount: 1,
      productCode: 1,
      merchant: 1,
      createdAt: 1,
      relevanceScore: 1,
      'merchantInfo._id': 1,
      'merchantInfo.name': 1,
      'merchantInfo.merchantInfo': 1
    }
  });

  return pipeline;
}

/**
 * 构建搜索计数管道（用于分页）
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Array} MongoDB 聚合管道
 */
function buildCountPipeline(query, options = {}) {
  const { category = null, minPrice = null, maxPrice = null, matchStrategy = 'multi' } = options;

  let matchCondition;
  switch (matchStrategy) {
    case 'exact':
      matchCondition = buildRegexSearch(query);
      break;
    case 'wildcard':
      matchCondition = buildWildcardSearch(query);
      break;
    case 'ngram':
      matchCondition = buildDynamicNgramSearch(query, 2);
      break;
    case 'multi':
    default:
      matchCondition = buildMultiStrategyMatch(query);
  }

  const matchStage = { $match: { ...matchCondition } };

  if (category) matchStage.$match.category = category;
  if (minPrice !== null || maxPrice !== null) {
    matchStage.$match.price = {};
    if (minPrice !== null) matchStage.$match.price.$gte = parseFloat(minPrice);
    if (maxPrice !== null) matchStage.$match.price.$lte = parseFloat(maxPrice);
  }

  return [matchStage, { $count: 'total' }];
}

/**
 * 构建搜索建议管道
 * @param {string} query - 搜索关键词
 * @param {number} limit - 返回数量
 * @returns {Array} MongoDB 聚合管道
 */
function buildSuggestionPipeline(query, limit = 10) {
  const escaped = escapeRegExp(query);

  return [
    {
      $match: {
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { category: { $regex: escaped, $options: 'i' } }
        ]
      }
    },
    {
      $group: {
        _id: '$name',
        category: { $first: '$category' },
        price: { $first: '$price' },
        count: { $sum: 1 }
      }
    },
    {
      $addFields: {
        // 计算匹配位置，越靠前越好
        matchPosition: {
          $indexOfCP: [{ $toLower: '$_id' }, query.toLowerCase()]
        }
      }
    },
    {
      $sort: {
        matchPosition: 1,  // 匹配位置越靠前越好
        count: -1
      }
    },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        text: '$_id',
        category: 1,
        price: 1
      }
    }
  ];
}

/**
 * 高亮匹配文本
 * @param {string} text - 原始文本
 * @param {string} query - 搜索关键词
 * @returns {string} 带高亮标记的文本
 */
function highlightMatch(text, query) {
  if (!text || !query) return text;
  const escaped = escapeRegExp(query);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

module.exports = {
  escapeRegExp,
  buildRegexSearch,
  buildWildcardSearch,
  buildDynamicNgramSearch,
  buildMultiStrategyMatch,
  buildAggregateSearch,
  buildCountPipeline,
  buildSuggestionPipeline,
  highlightMatch
};
