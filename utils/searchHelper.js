/**
 * 高级搜索工具模块
 * 支持: n-gram 分词、拼音搜索、相关度评分、高亮显示
 */

// =====================
// 拼音映射表 (简化版，生产环境建议使用 pinyin 库)
// =====================
const pinyinMap = {
  '电': 'dian', '脑': 'nao', '手': 'shou', '机': 'ji', '耳': 'er',
  '笔': 'bi', '记': 'ji', '本': 'ben', '键': 'jian', '盘': 'pan',
  '鼠': 'shu', '标': 'biao', '显': 'xian', '示': 'shi', '器': 'qi',
  '音': 'yin', '箱': 'xiang', '响': 'xiang', '衣': 'yi', '服': 'fu',
  '裤': 'ku', '子': 'zi', '鞋': 'xie', '帽': 'mao', '包': 'bao',
  '表': 'biao', '带': 'dai', '链': 'lian', '戒': 'jie', '指': 'zhi',
  '书': 'shu', '籍': 'ji', '小': 'xiao', '说': 'shuo', '漫': 'man',
  '画': 'hua', '数': 'shu', '码': 'ma', '台': 'tai', '灯': 'deng', '沙': 'sha', '发': 'fa',
  '床': 'chuang', '柜': 'gui', '桌': 'zhuo', '椅': 'yi', '抱': 'bao',
  '枕': 'zhen', '头': 'tou', '被': 'bei', '褥': 'ru', '毯': 'tan',
  '香': 'xiang', '薰': 'xun', '蜡': 'la', '烛': 'zhu', '花': 'hua',
  '瓶': 'ping', '加': 'jia', '湿': 'shi', '净': 'jing', '化': 'hua',
  '面': 'mian', '霜': 'shuang', '乳': 'ru', '液': 'ye', '水': 'shui',
  '油': 'you', '膏': 'gao', '粉': 'fen', '底': 'di', '口': 'kou',
  '红': 'hong', '眼': 'yan', '影': 'ying', '眉': 'mei', '笔': 'bi',
  '高': 'gao', '性': 'xing', '能': 'neng', '无': 'wu', '线': 'xian',
  '降': 'jiang', '噪': 'zao', '机': 'ji', '械': 'xie', '纯': 'chun',
  '棉': 'mian', '牛': 'niu', '仔': 'zai', '夹': 'jia', '克': 'ke',
  '科': 'ke', '幻': 'huan', '简': 'jian', '约': 'yue', '舒': 'shu',
  '适': 'shi', '北': 'bei', '欧': 'ou', '风': 'feng', '蓝': 'lan',
  '牙': 'ya', '智': 'zhi', '充': 'chong', '移': 'yi', '动': 'dong',
  '源': 'yuan', '连': 'lian', '帽': 'mao', '卫': 'wei', '多': 'duo',
  '功': 'gong', '收': 'shou', '纳': 'na', '心': 'xin', '率': 'lv',
  '血': 'xue', '氧': 'yang', '监': 'jian', '测': 'ce', '印': 'yin',
  '裙': 'qun', '春': 'chun', '季': 'ji', '进': 'jin', '保': 'bao'
};

/**
 * 获取文本的拼音
 * @param {string} text - 中文文本
 * @returns {string} 拼音字符串
 */
function getPinyin(text) {
  if (!text) return '';
  let pinyin = '';
  for (const char of text) {
    if (pinyinMap[char]) {
      pinyin += pinyinMap[char] + ' ';
    } else if (/[a-zA-Z0-9]/.test(char)) {
      pinyin += char.toLowerCase();
    }
  }
  return pinyin.trim();
}

/**
 * 获取文本的拼音首字母
 * @param {string} text - 中文文本
 * @returns {string} 首字母字符串
 */
function getPinyinInitials(text) {
  if (!text) return '';
  let initials = '';
  for (const char of text) {
    if (pinyinMap[char]) {
      initials += pinyinMap[char][0];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      initials += char.toLowerCase();
    }
  }
  return initials;
}

/**
 * 生成 n-gram 分词
 * @param {string} text - 文本
 * @param {number} n - gram 大小，默认 2
 * @returns {string[]} n-gram 数组
 */
function generateNgrams(text, n = 2) {
  if (!text || text.length < n) return [text];

  const ngrams = new Set();
  const cleanText = text.replace(/\s+/g, '').toLowerCase();

  // 生成 n-gram
  for (let i = 0; i <= cleanText.length - n; i++) {
    ngrams.add(cleanText.substring(i, i + n));
  }

  // 同时保留完整词
  ngrams.add(cleanText);

  return Array.from(ngrams);
}

/**
 * 生成用于搜索的分词字符串
 * @param {string} text - 原始文本
 * @returns {string} 分词字符串（空格分隔）
 */
function generateSearchTokens(text) {
  if (!text) return '';

  const tokens = new Set();

  // 1. 原始文本（小写）
  tokens.add(text.toLowerCase());

  // 2. 2-gram 分词
  generateNgrams(text, 2).forEach(t => tokens.add(t));

  // 3. 3-gram 分词
  generateNgrams(text, 3).forEach(t => tokens.add(t));

  // 4. 拼音
  const pinyin = getPinyin(text);
  if (pinyin) {
    tokens.add(pinyin.replace(/\s+/g, ''));
    pinyin.split(' ').forEach(p => tokens.add(p));
  }

  // 5. 拼音首字母
  const initials = getPinyinInitials(text);
  if (initials) tokens.add(initials);

  return Array.from(tokens).join(' ');
}

/**
 * 为商品生成完整的搜索数据
 * @param {Object} product - 商品对象
 * @returns {Object} 搜索数据对象
 */
function generateProductSearchData(product) {
  const name = product.name || '';
  const description = product.description || '';
  const category = product.category || '';
  const keywords = product.searchKeywords || '';

  // 合并所有需要搜索的文本
  const allText = `${name} ${description} ${category} ${keywords}`;

  return {
    // n-gram 分词数据
    nameNgrams: generateNgrams(name, 2).join(' '),

    // 拼音数据
    namePinyin: getPinyin(name),
    namePinyinInitials: getPinyinInitials(name),

    // 完整分词 tokens
    searchTokens: generateSearchTokens(allText)
  };
}

/**
 * 计算搜索相关度评分
 * @param {Object} product - 商品对象
 * @param {string} query - 搜索关键词
 * @returns {number} 相关度评分 (0-100)
 */
function calculateRelevanceScore(product, query) {
  if (!query) return 0;

  const q = query.toLowerCase();
  let score = 0;

  // 1. 名称完全匹配 (+50)
  if (product.name && product.name.toLowerCase() === q) {
    score += 50;
  }
  // 名称包含关键词 (+30)
  else if (product.name && product.name.toLowerCase().includes(q)) {
    score += 30;
  }

  // 2. 分类匹配 (+15)
  if (product.category && product.category.toLowerCase().includes(q)) {
    score += 15;
  }

  // 3. 描述匹配 (+10)
  if (product.description && product.description.toLowerCase().includes(q)) {
    score += 10;
  }

  // 4. 拼音匹配 (+20)
  if (product.namePinyin && product.namePinyin.includes(q)) {
    score += 20;
  }

  // 5. 拼音首字母匹配 (+15)
  if (product.namePinyinInitials && product.namePinyinInitials.includes(q)) {
    score += 15;
  }

  // 6. n-gram 匹配 (+10)
  if (product.nameNgrams && product.nameNgrams.includes(q)) {
    score += 10;
  }

  // 7. 关键词匹配 (+5)
  if (product.searchKeywords && product.searchKeywords.toLowerCase().includes(q)) {
    score += 5;
  }

  // 8. 销量加成 (最高 +10)
  const salesBonus = Math.min(10, (product.salesCount || 0) / 100);
  score += salesBonus;

  return Math.min(100, score);
}

/**
 * 高亮显示匹配文本
 * @param {string} text - 原始文本
 * @param {string} query - 搜索关键词
 * @returns {string} 带高亮标记的文本
 */
function highlightMatch(text, query) {
  if (!text || !query) return text;

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 构建 MongoDB 模糊搜索查询条件
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Object} MongoDB 查询条件
 */
function buildFuzzySearchQuery(query, options = {}) {
  if (!query || !query.trim()) {
    return {};
  }

  const q = query.trim();
  const qLower = q.toLowerCase();

  // 判断是否是拼音搜索
  const isPinyinSearch = /^[a-zA-Z]+$/.test(q);

  const conditions = [];

  // 1. 基础正则匹配（名称、描述、分类）
  const regexCondition = {
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
      { searchKeywords: { $regex: q, $options: 'i' } }
    ]
  };
  conditions.push(regexCondition);

  // 2. n-gram 匹配
  conditions.push({ nameNgrams: { $regex: qLower, $options: 'i' } });

  // 3. 如果是英文/拼音，添加拼音搜索
  if (isPinyinSearch) {
    conditions.push({ namePinyin: { $regex: qLower, $options: 'i' } });
    conditions.push({ namePinyinInitials: { $regex: qLower, $options: 'i' } });
  }

  // 4. searchTokens 全匹配
  conditions.push({ searchTokens: { $regex: qLower, $options: 'i' } });

  return { $or: conditions };
}

/**
 * 构建 MongoDB 聚合管道搜索（带相关度评分）
 * @param {string} query - 搜索关键词
 * @param {Object} options - 搜索选项
 * @returns {Array} MongoDB 聚合管道
 */
function buildSearchAggregation(query, options = {}) {
  const {
    limit = 20,
    skip = 0,
    category = null,
    minPrice = null,
    maxPrice = null,
    sortBy = 'relevance' // relevance, price, sales
  } = options;

  const q = query.trim().toLowerCase();
  const isPinyinSearch = /^[a-zA-Z]+$/.test(query);

  const pipeline = [];

  // 1. 匹配阶段
  const matchConditions = [];

  // 基础文本匹配
  matchConditions.push({ name: { $regex: query, $options: 'i' } });
  matchConditions.push({ description: { $regex: query, $options: 'i' } });
  matchConditions.push({ category: { $regex: query, $options: 'i' } });
  matchConditions.push({ searchKeywords: { $regex: query, $options: 'i' } });
  matchConditions.push({ nameNgrams: { $regex: q, $options: 'i' } });
  matchConditions.push({ searchTokens: { $regex: q, $options: 'i' } });

  if (isPinyinSearch) {
    matchConditions.push({ namePinyin: { $regex: q, $options: 'i' } });
    matchConditions.push({ namePinyinInitials: { $regex: q, $options: 'i' } });
  }

  const matchStage = { $match: { $or: matchConditions } };

  // 添加分类和价格过滤
  if (category) {
    matchStage.$match.category = category;
  }
  if (minPrice !== null || maxPrice !== null) {
    matchStage.$match.price = {};
    if (minPrice !== null) matchStage.$match.price.$gte = minPrice;
    if (maxPrice !== null) matchStage.$match.price.$lte = maxPrice;
  }

  pipeline.push(matchStage);

  // 2. 添加相关度评分字段
  pipeline.push({
    $addFields: {
      relevanceScore: {
        $add: [
          // 名称完全匹配
          { $cond: [{ $eq: [{ $toLower: '$name' }, q] }, 50, 0] },
          // 名称包含
          { $cond: [{ $regexMatch: { input: { $toLower: '$name' }, regex: q } }, 30, 0] },
          // 分类匹配
          { $cond: [{ $regexMatch: { input: { $toLower: '$category' }, regex: q } }, 15, 0] },
          // 描述匹配
          { $cond: [{ $regexMatch: { input: { $toLower: '$description' }, regex: q } }, 10, 0] },
          // 拼音匹配
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$namePinyin', ''] }, regex: q } }, 20, 0] },
          // 首字母匹配
          { $cond: [{ $regexMatch: { input: { $ifNull: ['$namePinyinInitials', ''] }, regex: q } }, 15, 0] },
          // 销量加成
          { $min: [10, { $divide: [{ $ifNull: ['$salesCount', 0] }, 100] }] }
        ]
      }
    }
  });

  // 3. 排序阶段
  let sortStage = { $sort: { relevanceScore: -1, salesCount: -1 } };
  if (sortBy === 'price') {
    sortStage = { $sort: { price: 1 } };
  } else if (sortBy === 'priceDesc') {
    sortStage = { $sort: { price: -1 } };
  } else if (sortBy === 'sales') {
    sortStage = { $sort: { salesCount: -1 } };
  }
  pipeline.push(sortStage);

  // 4. 分页
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });

  // 5. 关联商家信息
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'merchantId',
      foreignField: '_id',
      as: 'merchantInfo'
    }
  });

  pipeline.push({
    $unwind: {
      path: '$merchantInfo',
      preserveNullAndEmptyArrays: true
    }
  });

  // 6. 投影字段
  pipeline.push({
    $project: {
      name: 1,
      description: 1,
      price: 1,
      imageUrl: 1,
      category: 1,
      stock: 1,
      salesCount: 1,
      productCode: 1,
      relevanceScore: 1,
      'merchantInfo.name': 1,
      'merchantInfo.merchantInfo': 1
    }
  });

  return pipeline;
}

module.exports = {
  getPinyin,
  getPinyinInitials,
  generateNgrams,
  generateSearchTokens,
  generateProductSearchData,
  calculateRelevanceScore,
  highlightMatch,
  buildFuzzySearchQuery,
  buildSearchAggregation
};
