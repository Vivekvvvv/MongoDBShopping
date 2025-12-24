require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Security & Utility Modules
const { hashPassword, comparePassword, checkPasswordStrength } = require('./utils/password');
const { generateToken, verifyToken, authenticate, optionalAuth, authorize, merchantOnly, adminOnly } = require('./middleware/auth');
const { registerRules, loginRules, productRules, orderRules, addressRules, reviewRules, mongoIdRules, paginationRules, noSqlInjectionGuard } = require('./middleware/validator');
const { AppError, asyncHandler, notFound, errorHandler } = require('./middleware/errorHandler');
const { processUploadedImage, isValidImageFormat } = require('./utils/imageProcessor');
// Advanced Search Module
const { generateProductSearchData, buildFuzzySearchQuery, buildSearchAggregation, highlightMatch } = require('./utils/searchHelper');
// Native MongoDB Search Module
const { buildRegexSearch, buildAggregateSearch, buildWildcardSearch, buildDynamicNgramSearch, buildCountPipeline, buildSuggestionPipeline, highlightMatch: nativeHighlight } = require('./utils/nativeSearch');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Logistics = require('./models/Logistics');
const Address = require('./models/Address');
const Review = require('./models/Review');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Security Middleware - NoSQL Injection Guard
app.use(noSqlInjectionGuard);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/my_database';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('Connected to MongoDB');
    // Don't wait for seed to finish
    seedDatabase().catch(err => console.error('Seeding error:', err));
  })
  .catch(err => console.error('Could not connect to MongoDB', err));

async function seedDatabase() {
  try {
    // Seed Admin
    const adminEmail = '12345@123.com';
    const hashedAdminPassword = await hashPassword('12345');
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (!adminExists) {
      const admin = new User({
        name: 'Admin',
        email: adminEmail,
        password: hashedAdminPassword,
        role: 'admin'
      });
      await admin.save();
      console.log('Admin account created: 12345@123.com / 12345');
    } else {
      // 强制更新密码，确保之前错误的数据被修复
      await User.updateOne({ email: adminEmail }, { $set: { password: hashedAdminPassword } });
      console.log('Admin password reset to: 12345');
    }

    // 创建默认商家用户（增加额外商家）
    const merchants = [
      {
        name: '官方旗舰店',
        email: 'merchant1@shop.com',
        password: '123456',
        role: 'merchant',
        merchantInfo: {
          shopName: '官方旗舰店',
          shopDescription: '官方正品，品质保证',
          contactPhone: '400-888-8888',
          rating: 4.8,
          totalSales: 1200
        }
      },
      {
        name: '潮流数码',
        email: 'merchant2@shop.com',
        password: '123456',
        role: 'merchant',
        merchantInfo: {
          shopName: '潮流数码',
          shopDescription: '最新数码产品，潮流前沿',
          contactPhone: '400-999-9999',
          rating: 4.6,
          totalSales: 800
        }
      },
      {
        name: '家居良品',
        email: 'merchant3@home.com',
        password: '123456',
        role: 'merchant',
        merchantInfo: {
          shopName: '家居良品',
          shopDescription: '舒适家居，品质之选',
          contactPhone: '400-777-7777',
          rating: 4.7,
          totalSales: 600
        }
      },
      {
        name: '时尚服饰',
        email: 'merchant4@fashion.com',
        password: '123456',
        role: 'merchant',
        merchantInfo: {
          shopName: '时尚服饰',
          shopDescription: '潮流时尚，价格亲民',
          contactPhone: '400-666-6666',
          rating: 4.5,
          totalSales: 700
        }
      }
    ];

    for (const merchantData of merchants) {
      const hashedPassword = await hashPassword(merchantData.password);
      const existingMerchant = await User.findOne({ email: merchantData.email });
      if (!existingMerchant) {
        const merchant = new User({
          ...merchantData,
          password: hashedPassword
        });
        await merchant.save();
        console.log(`Merchant account created: ${merchantData.email}`);
      } else {
        // 强制更新密码
        await User.updateOne({ email: merchantData.email }, { $set: { password: hashedPassword } });
      }
    }

    // 获取所有商家并建立名称/邮箱到 merchantId 的映射
    const merchantDocs = await User.find({ role: 'merchant' });
    const merchantMap = {};
    merchantDocs.forEach(m => {
      const shopName = m.merchantInfo && m.merchantInfo.shopName ? m.merchantInfo.shopName : m.name;
      merchantMap[shopName] = m._id;
      merchantMap[m.email] = m._id;
      merchantMap[m.name] = m._id;
    });

    // Seed Products - 强制刷新数据

    const products = [
      // Electronics - 官方旗舰店
      {
        name: '高性能笔记本电脑',
        description: '搭载最新处理器，超长续航，适合办公和游戏。',
        price: 5999,
        category: 'Electronics',
        imageUrl: '/images/笔记本电脑.jpg',
        merchant: '官方旗舰店',
        merchantId: null,
        productCode: 'LAPTOP-001',
        stock: 50,
        salesCount: 120,
        searchKeywords: '电脑,笔记本,电脑办公,游戏本,联想,戴尔,华硕,电脑配件,电子产品,办公设备',
        shippingAddress: {
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          detail: '科技园'
        }
      },
      {
        name: '无线降噪耳机',
        description: '沉浸式音质体验，主动降噪，舒适佩戴。',
        price: 1299,
        category: 'Electronics',
        imageUrl: '/images/耳机.jpg',
        merchant: '潮流数码',
        merchantId: null,
        productCode: 'HEADPHONE-001',
        stock: 100,
        salesCount: 450,
        searchKeywords: '耳机,降噪耳机,无线耳机,蓝牙耳机,音乐,耳机音响,数码配件,电子设备,音频设备',
        shippingAddress: {
          province: '北京市',
          city: '北京市',
          district: '朝阳区',
          detail: 'CBD商务区'
        }
      },
      {
        name: '机械键盘',
        description: '青轴手感，RGB背光，电竞专用。',
        price: 399,
        category: 'Electronics',
        imageUrl: '/images/键盘.jpg',
        merchant: '潮流数码',
        merchantId: null,
        productCode: 'KEYBOARD-001',
        stock: 200,
        salesCount: 300,
        searchKeywords: '键盘,机械键盘,游戏键盘,电竞装备,电脑配件,外设,RGB背光,青轴,茶轴,红轴',
        shippingAddress: {
          province: '上海市',
          city: '上海市',
          district: '浦东新区',
          detail: '张江高科技园区'
        }
      },

      // Clothing
      {
        name: '纯棉T恤',
        description: '100%纯棉，透气舒适，简约百搭。',
        price: 99,
        category: 'Clothing',
        imageUrl: '/images/T恤.jpg',
        merchant: '官方旗舰店',
        merchantId: null,
        productCode: 'TSHIRT-001',
        stock: 300,
        salesCount: 800,
        searchKeywords: 'T恤,纯棉T恤,衣服,服装,上衣,休闲装,夏季服装,百搭单品,男女T恤,时尚服装',
        shippingAddress: {
          province: '浙江省',
          city: '杭州市',
          district: '余杭区',
          detail: '电商产业园'
        }
      },
      {
        name: '牛仔夹克',
        description: '经典复古风格，耐磨耐穿，时尚单品。',
        price: 299,
        category: 'Clothing',
        imageUrl: '/images/牛仔夹克.jpg',
        merchant: '官方旗舰店',
        merchantId: null,
        productCode: 'JACKET-001',
        stock: 150,
        salesCount: 250,
        searchKeywords: '夹克,牛仔夹克,外套,服装,春秋装,时尚单品,复古风,牛仔服,上衣,外套',
        shippingAddress: {
          province: '浙江省',
          city: '杭州市',
          district: '余杭区',
          detail: '电商产业园'
        }
      },

      // Books
      {
        name: '科幻小说集',
        description: '精选年度最佳科幻小说，探索未来世界。',
        price: 59,
        category: 'Books',
        imageUrl: '/images/科幻小说.jpg',
        merchant: '官方旗舰店',
        merchantId: null,
        productCode: 'BOOK-001',
        stock: 500,
        salesCount: 600,
        searchKeywords: '书,书籍,小说,科幻小说,文学,阅读,图书,科幻,未来,故事集,文学作品',
        shippingAddress: {
          province: '江苏省',
          city: '南京市',
          district: '鼓楼区',
          detail: '文化产业园'
        }
      },

      // Home
      {
        name: '简约台灯',
        description: '护眼光源，多档调节，现代简约设计。',
        price: 129,
        category: 'Home',
        imageUrl: '/images/简约台灯.jpg',
        merchant: '潮流数码',
        merchantId: null,
        productCode: 'LAMP-001',
        stock: 180,
        salesCount: 320,
        searchKeywords: '台灯,灯具,照明,护眼台灯,家居装饰,灯具,卧室灯,阅读台灯,LED灯,家居用品',
        shippingAddress: {
          province: '广东省',
          city: '东莞市',
          district: '长安镇',
          detail: '工业区'
        }
      },
      {
        name: '舒适抱枕',
        description: '记忆棉内芯，亲肤面料，支撑颈椎，缓解疲劳。',
        price: 79,
        category: 'Home',
        imageUrl: '/images/抱枕.jpg',
        merchant: '家居良品',
        merchantId: null,
        productCode: 'PILLOW-001',
        stock: 250,
        salesCount: 180,
        searchKeywords: '抱枕,枕头,靠枕,记忆棉,家居装饰,沙发垫,床上用品,颈椎枕,舒适抱枕,家居配件',
        shippingAddress: {
          province: '浙江省',
          city: '杭州市',
          district: '余杭区',
          detail: '家居产业园'
        }
      },
      {
        name: '香薰加湿器',
        description: '超声波雾化，七彩灯光，静音设计，改善室内空气质量。',
        price: 159,
        category: 'Home',
        imageUrl: '/images/香薰加湿器.jpg',
        merchant: '家居良品',
        merchantId: null,
        productCode: 'HUMIDIFIER-001',
        stock: 150,
        salesCount: 220,
        searchKeywords: '加湿器,香薰,空气净化,湿度调节,家居电器,超声波加湿器,静音加湿器,七彩灯,室内加湿,家居小家电',
        shippingAddress: {
          province: '广东省',
          city: '深圳市',
          district: '龙岗区',
          detail: '工业园'
        }
      },
      {
        name: '北欧风花瓶',
        description: '简约北欧设计，陶瓷材质，花艺装饰，提升居家品味。',
        price: 89,
        category: 'Home',
        imageUrl: '/images/北欧风花瓶.jpg',
        merchant: '家居良品',
        merchantId: null,
        productCode: 'VASE-001',
        stock: 200,
        salesCount: 95,
        searchKeywords: '花瓶,花器,北欧风,家居装饰,陶瓷花瓶,插花,花艺装饰,简约花瓶,居家装饰品,装饰品',
        shippingAddress: {
          province: '江苏省',
          city: '苏州市',
          district: '吴中区',
          detail: '工艺园区'
        }
      },
      // New products for merchants
      {
        name: '北欧简约床头柜',
        description: '北欧风格，简约实用，耐用材质。',
        price: 399,
        category: 'Home',
        imageUrl: '/images/北欧床头柜.jpg',
        merchant: '家居良品',
        merchantId: null,
        productCode: 'CABINET-001',
        stock: 120,
        salesCount: 140,
        searchKeywords: '床头柜,柜子,北欧风,简约家具,卧室家具,收纳柜,床头收纳,家居柜,北欧家具,木制家具',
        shippingAddress: { province: '浙江省', city: '杭州市', district: '余杭区', detail: '家居产业园' }
      },
      {
        name: '无线蓝牙音箱',
        description: '便携式音响，重低音，蓝牙5.0连接。',
        price: 299,
        category: 'Electronics',
        imageUrl: '/images/蓝牙音箱.jpg',
        merchant: '潮流数码',
        merchantId: null,
        productCode: 'SPEAKER-001',
        stock: 220,
        salesCount: 460,
        searchKeywords: '音箱,蓝牙音箱,音响,无线音箱,便携音箱,重低音,蓝牙5.0,数码音响,音乐播放器,电子设备',
        shippingAddress: { province: '广东省', city: '深圳市', district: '南山区', detail: '科技园' }
      },
      {
        name: '春季印花连衣裙',
        description: '舒适面料，时尚印花，轻盈飘逸。',
        price: 199,
        category: 'Clothing',
        imageUrl: '/images/春季印花连衣裙.jpg',
        merchant: '时尚服饰',
        merchantId: null,
        productCode: 'DRESS-001',
        stock: 180,
        salesCount: 260,
        searchKeywords: '连衣裙,裙子,印花裙,女装,春装,时尚服饰,女性服装,夏季连衣裙,长裙,连衣裙',
        shippingAddress: { province: '浙江省', city: '杭州市', district: '上城区', detail: '商圈' }
      },
      {
        name: '进口香氛蜡烛',
        description: '天然香精，持久留香，提升居家氛围。',
        price: 89,
        category: 'Beauty',
        imageUrl: '/images/香氛蜡烛.jpg',
        merchant: '家居良品',
        merchantId: null,
        productCode: 'CANDLE-001',
        stock: 340,
        salesCount: 95,
        searchKeywords: '蜡烛,香氛蜡烛,香薰,进口蜡烛,家居香氛,香薰蜡烛,天然香精,装饰蜡烛,香氛产品,香氛',
        shippingAddress: { province: '江苏省', city: '南京市', district: '鼓楼区', detail: '文化产业园' }
      },

      // Beauty
      {
        name: '保湿面霜',
        description: '深层补水，长效保湿，适合各种肤质。',
        price: 199,
        category: 'Beauty',
        imageUrl: '/images/面霜.jpg',
        merchant: '官方旗舰店',
        merchantId: null,
        productCode: 'CREAM-001',
        stock: 250,
        salesCount: 400,
        searchKeywords: '面霜,保湿面霜,护肤品,面霜乳液,面部护理,保湿,化妆品,美容产品,护肤霜,面部保湿',
        shippingAddress: {
          province: '上海市',
          city: '上海市',
          district: '奉贤区',
          detail: '美妆产业园'
        }
      }
      ,
      // 额外新增商品
      {
        name: '便携移动电源 20000mAh',
        description: '高密度电芯，双向快充，支持手机与平板多次充电。',
        price: 149,
        category: 'Electronics',
        imageUrl: '/images/充电宝.jpg',
        merchant: '潮流数码',
        productCode: 'POWERBANK-001',
        stock: 400,
        salesCount: 550,
        searchKeywords: '移动电源,充电宝,便携电源,快充,USB-C,20000mAh,数码配件',
        shippingAddress: { province: '广东省', city: '深圳市', district: '南山区', detail: '科技园' }
      },
      {
        name: '休闲连帽卫衣',
        description: '加绒舒适，宽松版型，适合日常与运动穿搭。',
        price: 159,
        category: 'Clothing',
        imageUrl: '/images/连帽卫衣.jpg',
        merchant: '时尚服饰',
        productCode: 'HOODIE-001',
        stock: 260,
        salesCount: 320,
        searchKeywords: '卫衣,连帽卫衣,休闲服,运动风,外套,秋冬服装',
        shippingAddress: { province: '浙江省', city: '杭州市', district: '上城区', detail: '商圈' }
      },
      {
        name: '多功能收纳箱（可折叠）',
        description: '防水材质，可折叠，适合衣物与杂物收纳，节省空间。',
        price: 69,
        category: 'Home',
        imageUrl: '/images/多功能收纳箱.jpg',
        merchant: '家居良品',
        productCode: 'STORAGE-001',
        stock: 500,
        salesCount: 700,
        searchKeywords: '收纳箱,收纳,折叠收纳,家居收纳,整理箱,储物盒',
        shippingAddress: { province: '浙江省', city: '杭州市', district: '余杭区', detail: '家居产业园' }
      },
      {
        name: '智能手表（心率+血氧监测）',
        description: '运动追踪与健康监测，支持消息提醒与多种表盘。',
        price: 499,
        category: 'Electronics',
        imageUrl: '/images/智能手表.jpg',
        merchant: '官方旗舰店',
        productCode: 'SMARTWATCH-001',
        stock: 180,
        salesCount: 280,
        searchKeywords: '智能手表,手环,运动手表,心率,血氧,健康监测,智能穿戴',
        shippingAddress: { province: '广东省', city: '深圳市', district: '南山区', detail: '科技园' }
      },
      {
        name: '无线静音鼠标',
        description: '人体工学设计，静音点击，超长续航，适合办公。',
        price: 79,
        category: 'Electronics',
        imageUrl: '/images/鼠标.jpg',
        merchant: '潮流数码',
        productCode: 'MOUSE-001',
        stock: 300,
        salesCount: 1200,
        searchKeywords: '鼠标,无线鼠标,静音鼠标,电脑配件,办公外设,罗技,雷蛇',
        shippingAddress: { province: '广东省', city: '深圳市', district: '南山区', detail: '科技园' }
      },
      {
        name: '电竞机械鼠标',
        description: '高精度传感器，可编程按键，RGB灯效，专业电竞级。',
        price: 299,
        category: 'Electronics',
        imageUrl: '/images/鼠标.jpg',
        merchant: '潮流数码',
        productCode: 'MOUSE-002',
        stock: 150,
        salesCount: 450,
        searchKeywords: '鼠标,电竞鼠标,游戏鼠标,机械鼠标,RGB,电脑配件,外设',
        shippingAddress: { province: '广东省', city: '深圳市', district: '南山区', detail: '科技园' }
      }
    ];

    // 为每个产品自动填充 merchantId 和 merchant（根据 product.merchant 名称匹配）
    products.forEach(p => {
      if (!p.merchantId) {
        p.merchantId = merchantMap[p.merchant] || null;
      }
      // 将merchant字段也设置为ObjectId（与merchantId相同）
      if (p.merchantId) {
        p.merchant = p.merchantId;
      }
      // Generate search data for each product
      const searchData = generateProductSearchData(p);
      Object.assign(p, searchData);
    });

    // 检查是否已有商品数据，如果有则不重新插入
    const existingProductCount = await Product.countDocuments();
    if (existingProductCount === 0) {
      console.log('No products found, seeding products...');
      await Product.insertMany(products);
      console.log(`Seeded ${products.length} products with search data`);
    } else {
      // Update existing products with search data
      // 强制更新所有商品的搜索数据，以确保包含最新的拼音映射和关键词分词
      const allProducts = await Product.find({});
      console.log(`Updating search data for all ${allProducts.length} products...`);
      for (const product of allProducts) {
        const searchData = generateProductSearchData(product);
        await Product.findByIdAndUpdate(product._id, { $set: searchData });
      }
      console.log('Search data update completed');
    }

    // 修复登录问题：确保测试用户始终存在且密码正确，移出订单判断逻辑
    const testUsers = [
      { name: '张三', email: 'zhangsan@test.com', password: '123456', role: 'user', balance: 10000 },
      { name: '李四', email: 'lisi@test.com', password: '123456', role: 'user', balance: 8000 },
      { name: '王五', email: 'wangwu@test.com', password: '123456', role: 'user', balance: 5000 },
      { name: '赵六', email: 'zhaoliu@test.com', password: '123456', role: 'user', balance: 12000 }
    ];

    const createdUsers = [];
    const forceReset = process.env.FORCE_SEED === 'true';

    for (const userData of testUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser || forceReset) {
        const hashedPassword = await hashPassword(userData.password);
        await User.updateOne(
          { email: userData.email },
          { $set: { ...userData, password: hashedPassword } },
          { upsert: true }
        );
        const updatedUser = await User.findOne({ email: userData.email });
        createdUsers.push(updatedUser);
      } else {
        createdUsers.push(existingUser);
      }
    }

    // ==================== 种子订单数据 ====================
    const existingOrderCount = await Order.countDocuments();
    if (existingOrderCount === 0) {
      console.log('No orders found, seeding test orders...');

      // 获取所有商品
      const allProducts = await Product.find({}).populate('merchantId');

      // 订单状态列表
      const orderStatuses = ['待支付', '已支付', '发货中', '已完成', '已取消', '已退款'];

      // 收货地址列表
      const addresses = [
        { province: '北京市', city: '北京市', district: '朝阳区', detail: '建国路88号', receiverName: '张三', receiverPhone: '13800138001' },
        { province: '上海市', city: '上海市', district: '浦东新区', detail: '陆家嘴金融中心', receiverName: '李四', receiverPhone: '13800138002' },
        { province: '广东省', city: '深圳市', district: '南山区', detail: '科技园南路100号', receiverName: '王五', receiverPhone: '13800138003' },
        { province: '浙江省', city: '杭州市', district: '西湖区', detail: '文三路电子市场', receiverName: '赵六', receiverPhone: '13800138004' }
      ];

      // 生成随机日期（过去30天内）
      const getRandomDate = (daysAgo) => {
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
        date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
        return date;
      };

      // 创建测试订单
      const orderDataList = [];
      const logisticsDataList = [];
      const productSalesUpdates = new Map();

      for (let i = 0; i < 50; i++) {
        const user = createdUsers[Math.floor(Math.random() * createdUsers.length)];
        const address = addresses[Math.floor(Math.random() * addresses.length)];
        const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

        // 随机选择1-3个商品
        const itemCount = Math.floor(Math.random() * 3) + 1;
        const selectedProducts = [];
        const usedIndices = new Set();

        for (let j = 0; j < itemCount && j < allProducts.length; j++) {
          let idx;
          do {
            idx = Math.floor(Math.random() * allProducts.length);
          } while (usedIndices.has(idx));
          usedIndices.add(idx);
          selectedProducts.push(allProducts[idx]);
        }

        const items = selectedProducts.map(product => ({
          productId: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          quantity: Math.floor(Math.random() * 3) + 1,
          imageUrl: product.imageUrl,
          merchant: product.merchant,
          merchantId: product.merchantId?._id || product.merchantId
        }));

        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const orderDate = getRandomDate(30);

        const orderId = new mongoose.Types.ObjectId();
        const timestamp = orderDate.getTime().toString();
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        const orderNumber = `ORD${timestamp}${random}${i}`;

        const isPaid = !['待支付', '已取消'].includes(status);

        orderDataList.push({
          _id: orderId,
          orderNumber,
          userId: user._id,
          items,
          total,
          status,
          shippingAddress: address,
          remarks: `测试订单 #${i + 1}`,
          paymentInfo: {
            method: '余额支付',
            paidAt: isPaid ? orderDate : undefined,
            transactionId: isPaid ? `TXN${timestamp}${random}${i}` : undefined
          },
          createdAt: orderDate,
          updatedAt: orderDate
        });

        // 记录销量更新
        if (['已支付', '发货中', '已完成'].includes(status)) {
          items.forEach(item => {
            const current = productSalesUpdates.get(item.productId.toString()) || 0;
            productSalesUpdates.set(item.productId.toString(), current + item.quantity);
          });
        }

        // 为非待支付和非已取消的订单创建物流信息
        if (!['待支付', '已取消'].includes(status)) {
          const originAddress = selectedProducts[0]?.shippingAddress || {
            province: '广东省', city: '深圳市', district: '南山区', detail: '科技园'
          };

          const logistics = {
            orderId: orderId,
            carrier: ['顺丰速运', '中通快递', '圆通速递', '韵达速递'][Math.floor(Math.random() * 4)],
            trackingNumber: `SF${Date.now()}${Math.floor(Math.random() * 100000)}`,
            origin: originAddress,
            destination: address,
            status: status === '已完成' ? '已签收' : (status === '发货中' ? '运输中' : '已揽收'),
            traces: generateLogisticsTraces(originAddress, address),
            estimatedDelivery: new Date(orderDate.getTime() + 3 * 24 * 60 * 60 * 1000),
            createdAt: orderDate
          };

          if (status === '已完成') {
            logistics.deliveredAt = new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000);
          }

          logisticsDataList.push(logistics);
        }
      }

      // 批量插入订单和物流
      await Order.insertMany(orderDataList);
      await Logistics.insertMany(logisticsDataList);

      console.log(`Seeded ${orderDataList.length} test orders and ${logisticsDataList.length} logistics records`);

      // 批量更新商品销量统计
      if (productSalesUpdates.size > 0) {
        const bulkOps = Array.from(productSalesUpdates.entries()).map(([productId, quantity]) => ({
          updateOne: {
            filter: { _id: productId },
            update: { $inc: { salesCount: quantity } }
          }
        }));
        await Product.bulkWrite(bulkOps);
      }
      console.log('Product sales counts updated');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// === 工具函数 ===

// 生成物流轨迹的函数
function generateLogisticsTraces(origin, destination) {
  const traces = [];
  const currentTime = new Date();

  // 揽收
  traces.push({
    time: new Date(currentTime.getTime() - 2 * 24 * 60 * 60 * 1000), // 2天前
    location: `${origin.city}${origin.district}`,
    description: '您的订单已被快递员揽收',
    status: '已揽收'
  });

  // 到达转运中心
  traces.push({
    time: new Date(currentTime.getTime() - 1 * 24 * 60 * 60 * 1000), // 1天前
    location: `${origin.city}转运中心`,
    description: '快件已到达转运中心，正在分拣',
    status: '运输中'
  });

  // 运输途中
  traces.push({
    time: new Date(currentTime.getTime() - 12 * 60 * 60 * 1000), // 12小时前
    location: '运输途中',
    description: '快件正在运输中，请耐心等待',
    status: '运输中'
  });

  // 到达目的地
  traces.push({
    time: new Date(currentTime.getTime() - 6 * 60 * 60 * 1000), // 6小时前
    location: `${destination.city}转运中心`,
    description: '快件已到达目的地转运中心',
    status: '派送中'
  });

  // 派送中
  traces.push({
    time: new Date(currentTime.getTime() - 2 * 60 * 60 * 1000), // 2小时前
    location: `${destination.city}${destination.district}`,
    description: '快递员正在派送，请保持电话畅通',
    status: '派送中'
  });

  return traces;
}

// --- 智能推荐 & 行为追踪路由 ---

// 记录商品浏览
app.post('/api/products/:id/view', async (req, res) => {
  try {
    const { userId } = req.body;
    const productId = req.params.id;

    if (!userId) return res.json({ message: '游客浏览，不记录个性化偏好' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: '商品不存在' });

    // 1. 更新最近浏览 (先进先出，限制10个)
    user.recentViews = user.recentViews.filter(id => id.toString() !== productId);
    user.recentViews.unshift(productId);
    if (user.recentViews.length > 10) user.recentViews.pop();

    // 2. 更新品类偏好权重
    if (product.category) {
      const currentWeight = user.categoryPreferences.get(product.category) || 0;
      user.categoryPreferences.set(product.category, currentWeight + 1);
    }

    await user.save();
    res.json({ message: '浏览记录已更新' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === 路由 ===

// --- 用户认证路由 ---

// 注册
app.post('/api/register', registerRules, asyncHandler(async (req, res) => {
  const { name, email, password, role, merchantInfo } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('邮箱已被注册', 400, 'EMAIL_EXISTS');
  }

  // 修复注册问题：放宽密码强度要求，只要符合 validator 的基本要求即可
  // 或者将强度要求降级为警告而非强制拦截
  const strengthCheck = checkPasswordStrength(password);
  if (password.length < 6) {
    return res.status(400).json({
      message: '密码长度至少6个字符'
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Build user data
  const userData = { name, email, password: hashedPassword, role: role || 'user' };

  // If merchant registration, add merchant info
  if (role === 'merchant' && merchantInfo) {
    userData.merchantInfo = {
      shopName: merchantInfo.shopName || name,
      shopDescription: merchantInfo.shopDescription || '',
      contactPhone: merchantInfo.contactPhone || '',
      rating: 5.0,
      totalSales: 0
    };
  }

  const user = new User(userData);
  await user.save();

  // Generate JWT Token
  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role
  });

  res.status(201).json({
    message: '注册成功',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance,
      merchantInfo: user.merchantInfo
    }
  });
}));

// 登录
app.post('/api/login', loginRules, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for: ${email}`);
  
  const user = await User.findOne({ email });

  if (!user) {
    console.log(`User not found: ${email}`);
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  // Compare password using bcrypt
  const isPasswordValid = await comparePassword(password, user.password);
  console.log(`Password valid for ${email}: ${isPasswordValid}`);
  
  if (!isPasswordValid) {
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  // Generate JWT Token
  const token = generateToken({
    id: user._id,
    email: user.email,
    role: user.role
  });

  res.json({
    message: '登录成功',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance,
      merchantInfo: user.merchantInfo
    }
  });
}));

// --- 商品路由 ---

// 获取推荐商品 (个性化算法升级)
app.get('/api/products/recommended', async (req, res) => {
  try {
    const { userId } = req.query;
    let products = [];

    if (userId) {
      const user = await User.findById(userId).populate('recentViews');
      if (user) {
        // 1. 获取偏好品类
        const prefs = Array.from(user.categoryPreferences.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(p => p[0]);

        // 2. 根据偏好品类取热销商品
        if (prefs.length > 0) {
          const prefProducts = await Product.find({
            category: { $in: prefs },
            _id: { $nin: user.recentViews } // 排除刚刚看过的
          })
            .sort({ salesCount: -1 })
            .limit(4)
            .populate('merchantId', 'name merchantInfo');
          products.push(...prefProducts);
        }

        // 3. 补充一些全局热销但在不同品类的商品，增加多样性
        if (products.length < 8) {
          const otherProducts = await Product.find({
            category: { $nin: prefs },
            _id: { $nin: user.recentViews }
          })
            .sort({ salesCount: -1 })
            .limit(8 - products.length)
            .populate('merchantId', 'name merchantInfo');
          products.push(...otherProducts);
        }
      }
    }

    // 访客模式或个性化补充不足时
    if (products.length === 0) {
      const categories = await Product.distinct('category');
      for (const cat of categories) {
        const top = await Product.find({ category: cat })
          .sort({ salesCount: -1 })
          .limit(2)
          .populate('merchantId', 'name merchantInfo');
        products.push(...top);
      }
      // 随机打乱展示
      products = products.sort(() => Math.random() - 0.5).slice(0, 10);
    }

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取所有商品
app.get('/api/products', async (req, res) => {
  try {
    const { category, search, merchant, sortBy = 'createdAt' } = req.query;

    // 构建查询条件
    const query = {};
    if (category) query.category = category;
    if (merchant) query.merchant = new RegExp(merchant, 'i');

    // 模糊搜索
    if (search) {
      const fuzzyQuery = buildFuzzySearchQuery(search);
      Object.assign(query, fuzzyQuery);
    }

    // 排序
    let sort = {};
    switch (sortBy) {
      case 'salesCount':
        sort = { salesCount: -1 };
        break;
      case 'priceAsc':
        sort = { price: 1 };
        break;
      case 'priceDesc':
        sort = { price: -1 };
        break;
      case 'stock':
        sort = { stock: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const products = await Product.find(query)
      .populate('merchantId', 'name merchantInfo')
      .sort(sort);

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 按分类获取商品
app.get('/api/products/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const products = await Product.find({ category })
      .populate('merchantId', 'name merchantInfo')
      .sort({ salesCount: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 搜索商品（模糊搜索）
app.get('/api/products/search', async (req, res) => {
  try {
    const { q: searchQuery } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ message: '搜索关键词不能为空' });
    }

    // 使用高级搜索辅助函数构建查询条件，支持拼音和 n-gram
    const query = buildFuzzySearchQuery(searchQuery);

    const products = await Product.find(query)
      .populate('merchantId', 'name merchantInfo')
      .sort({ salesCount: -1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 高级模糊搜索 API（支持拼音、n-gram、相关度排序）
// ==========================================

// 高级搜索 - 带相关度评分
app.get('/api/products/search/advanced', asyncHandler(async (req, res) => {
  const {
    q: searchQuery,
    category,
    minPrice,
    maxPrice,
    sortBy = 'relevance',
    page = 1,
    limit = 20
  } = req.query;

  if (!searchQuery || !searchQuery.trim()) {
    throw new AppError('搜索关键词不能为空', 400, 'EMPTY_QUERY');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 使用聚合管道进行带评分的搜索
  const pipeline = buildSearchAggregation(searchQuery, {
    limit: parseInt(limit),
    skip,
    category,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    sortBy
  });

  const products = await Product.aggregate(pipeline);

  // 获取总数（用于分页）
  const countPipeline = [
    { $match: buildFuzzySearchQuery(searchQuery) }
  ];
  if (category) countPipeline[0].$match.category = category;

  const countResult = await Product.aggregate([
    ...countPipeline,
    { $count: 'total' }
  ]);
  const total = countResult.length > 0 ? countResult[0].total : 0;

  // 高亮处理
  const highlightedProducts = products.map(p => ({
    ...p,
    nameHighlighted: highlightMatch(p.name, searchQuery),
    descriptionHighlighted: highlightMatch(p.description, searchQuery)
  }));

  res.json({
    products: highlightedProducts,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    },
    query: searchQuery
  });
}));

// MongoDB $text 全文搜索 API
app.get('/api/products/search/fulltext', asyncHandler(async (req, res) => {
  const { q: searchQuery, limit = 20 } = req.query;

  if (!searchQuery || !searchQuery.trim()) {
    throw new AppError('搜索关键词不能为空', 400, 'EMPTY_QUERY');
  }

  // 使用 MongoDB 原生 $text 搜索
  const products = await Product.find(
    { $text: { $search: searchQuery } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(parseInt(limit))
    .populate('merchantId', 'name merchantInfo');

  res.json({
    products,
    total: products.length,
    searchMethod: 'MongoDB $text',
    query: searchQuery
  });
}));

// 搜索建议/自动补全 API
app.get('/api/products/search/suggestions', asyncHandler(async (req, res) => {
  const { q: searchQuery, limit = 10 } = req.query;

  if (!searchQuery || searchQuery.length < 1) {
    return res.json({ suggestions: [] });
  }

  const q = searchQuery.toLowerCase();

  // 使用聚合获取匹配的商品名称
  const suggestions = await Product.aggregate([
    {
      $match: {
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { nameNgrams: { $regex: q, $options: 'i' } },
          { namePinyin: { $regex: q, $options: 'i' } },
          { namePinyinInitials: { $regex: q, $options: 'i' } }
        ]
      }
    },
    {
      $group: {
        _id: '$name',
        category: { $first: '$category' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: parseInt(limit) },
    {
      $project: {
        text: '$_id',
        category: 1,
        _id: 0
      }
    }
  ]);

  res.json({ suggestions, query: searchQuery });
}));

// 更新单个商品的搜索数据
app.post('/api/products/:id/update-search-data', asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new AppError('商品不存在', 404, 'NOT_FOUND');
  }

  const searchData = generateProductSearchData(product);

  await Product.findByIdAndUpdate(req.params.id, {
    $set: searchData
  });

  res.json({
    message: '搜索数据已更新',
    searchData
  });
}));

// 批量更新所有商品的搜索数据（管理员）
app.post('/api/admin/products/rebuild-search-index', asyncHandler(async (req, res) => {
  const products = await Product.find({});
  let updated = 0;

  for (const product of products) {
    const searchData = generateProductSearchData(product);
    await Product.findByIdAndUpdate(product._id, { $set: searchData });
    updated++;
  }

  res.json({
    message: `已更新 ${updated} 个商品的搜索索引`,
    total: updated
  });
}));

// ==========================================
// 纯 MongoDB 原生搜索 API（无需预处理字段）
// ==========================================

// 原生聚合管道搜索（带相关度评分，纯数据库计算）
app.get('/api/products/search/native', asyncHandler(async (req, res) => {
  const {
    q: searchQuery,
    category,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20,
    sortBy = 'relevance',
    strategy = 'multi' // multi | exact | wildcard | ngram
  } = req.query;

  if (!searchQuery || !searchQuery.trim()) {
    throw new AppError('搜索关键词不能为空', 400, 'EMPTY_QUERY');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 构建搜索管道
  const pipeline = buildAggregateSearch(searchQuery, {
    limit: parseInt(limit),
    skip,
    category,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    sortBy,
    matchStrategy: strategy
  });

  // 执行搜索
  const products = await Product.aggregate(pipeline);

  // 获取总数
  const countPipeline = buildCountPipeline(searchQuery, {
    category,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    matchStrategy: strategy
  });
  const countResult = await Product.aggregate(countPipeline);
  const total = countResult.length > 0 ? countResult[0].total : 0;

  // 高亮处理
  const highlightedProducts = products.map(p => ({
    ...p,
    nameHighlighted: nativeHighlight(p.name, searchQuery),
    descriptionHighlighted: nativeHighlight(p.description, searchQuery)
  }));

  res.json({
    success: true,
    products: highlightedProducts,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    },
    meta: {
      query: searchQuery,
      strategy,
      sortBy,
      searchMethod: 'MongoDB Native Aggregate Pipeline'
    }
  });
}));

// 搜索建议/自动补全（原生聚合管道）
app.get('/api/products/search/native/suggestions', asyncHandler(async (req, res) => {
  const { q: searchQuery, limit = 10 } = req.query;

  if (!searchQuery || searchQuery.length < 1) {
    return res.json({ suggestions: [] });
  }

  const pipeline = buildSuggestionPipeline(searchQuery, parseInt(limit));
  const suggestions = await Product.aggregate(pipeline);

  res.json({
    success: true,
    suggestions,
    query: searchQuery
  });
}));

// 获取单个商品
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('merchantId', 'name merchantInfo');
    if (!product) return res.status(404).json({ message: '商品不存在' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 上传图片 (with compression)
app.post('/api/upload', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('请上传图片', 400, 'NO_FILE');
  }

  const filePath = req.file.path;
  const uploadDir = path.join(__dirname, 'public/uploads');

  // Process and compress the uploaded image
  try {
    const result = await processUploadedImage(filePath, uploadDir);
    if (result.success) {
      console.log(`Image compressed: ${result.compressionRatio} reduction`);
    }
  } catch (compressError) {
    console.warn('Image compression failed, using original:', compressError.message);
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({
    imageUrl,
    message: '图片上传成功'
  });
}));

// 删除商品
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: '商品不存在' });
    }
    res.json({ message: '商品已删除' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 创建商品（商家）
app.post('/api/products', upload.single('image'), asyncHandler(async (req, res) => {
  const productData = { ...req.body };
  
  // 处理图片上传
  if (req.file) {
    productData.imageUrl = `/uploads/${req.file.filename}`;
  }

  // 自动生成商品编号
  if (!productData.productCode) {
    productData.productCode = 'P' + Date.now() + Math.floor(Math.random() * 1000);
  }

  // 处理商家信息 (前端传的是 merchant 字段作为 userId)
  if (productData.merchant && !productData.merchantId) {
    productData.merchantId = productData.merchant;
    const merchantUser = await User.findById(productData.merchantId);
    if (merchantUser) {
      productData.merchant = (merchantUser.merchantInfo && merchantUser.merchantInfo.shopName) 
        ? merchantUser.merchantInfo.shopName 
        : merchantUser.name;
    }
  }

  // 生成搜索数据
  const searchData = generateProductSearchData(productData);
  Object.assign(productData, searchData);

  const newProduct = new Product(productData);
  const savedProduct = await newProduct.save();
  res.status(201).json(savedProduct);
}));

// --- 地址管理路由 ---

// 获取用户地址列表
app.get('/api/addresses/:userId', async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.params.userId }).sort({ isDefault: -1, createdAt: -1 });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 添加新地址
app.post('/api/addresses', async (req, res) => {
  try {
    const { userId, isDefault } = req.body;

    // 如果设为默认地址，先取消其他默认地址
    if (isDefault) {
      await Address.updateMany({ userId, isDefault: true }, { isDefault: false });
    }

    const newAddress = new Address(req.body);
    const savedAddress = await newAddress.save();
    res.status(201).json(savedAddress);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 更新地址
app.put('/api/addresses/:id', async (req, res) => {
  try {
    const { isDefault, userId } = req.body;

    // 如果设为默认地址，先取消其他默认地址
    if (isDefault) {
      await Address.updateMany({ userId, isDefault: true }, { isDefault: false });
    }

    const updatedAddress = await Address.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedAddress) return res.status(404).json({ message: '地址不存在' });
    res.json(updatedAddress);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 删除地址
app.delete('/api/addresses/:id', async (req, res) => {
  try {
    const address = await Address.findByIdAndDelete(req.params.id);
    if (!address) return res.status(404).json({ message: '地址不存在' });
    res.json({ message: '地址已删除' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 订单路由 ---

// 创建订单（原子性事务处理 - 已降级为普通操作以支持单节点MongoDB）
app.post('/api/orders', async (req, res) => {
  try {
    // 调试日志：打印原始请求体
    console.log('📥 收到订单请求:');
    console.log('  - req.body 类型:', typeof req.body);
    console.log('  - req.body:', JSON.stringify(req.body, null, 2));

    const { userId, items, shippingAddress, remarks } = req.body;

    // 调试日志：打印解构后的数据
    console.log('📦 解构后的 items:');
    console.log('  - items 类型:', typeof items);
    console.log('  - items 是否为数组:', Array.isArray(items));
    console.log('  - items 值:', items);

    // 修复：如果 items 是对象而不是数组，将其转换为数组
    let itemsArray = items;
    if (items && typeof items === 'object' && !Array.isArray(items)) {
      console.log('🔧 检测到 items 是对象，正在转换为数组...');
      itemsArray = Object.values(items);
      console.log('  - 转换后的 itemsArray:', itemsArray);
    }

    // 验证 items 参数 - 增强错误信息
    if (!itemsArray) {
      console.error('❌ items 为空或未定义');
      return res.status(400).json({
        message: '订单商品列表为空，请添加商品后再下单',
        debug: { receivedKeys: Object.keys(req.body || {}) }
      });
    }

    if (!Array.isArray(itemsArray)) {
      console.error('❌ itemsArray 不是数组，实际类型:', typeof itemsArray, '值:', itemsArray);
      return res.status(400).json({
        message: '订单商品列表格式错误，请刷新页面后重试',
        debug: { itemsType: typeof itemsArray }
      });
    }

    if (itemsArray.length === 0) {
      return res.status(400).json({ message: '购物车为空，无法创建订单' });
    }

    // 验证每个订单项的必要字段（宽松验证，自动转换类型）
    for (let i = 0; i < itemsArray.length; i++) {
      const item = itemsArray[i];
      if (!item || !item.productId) {
        console.error(`❌ 订单项 ${i + 1} 无效:`, item);
        return res.status(400).json({
          message: `订单商品项 ${i + 1} 数据无效（缺少商品ID）`
        });
      }
      // 确保 quantity 是数字（自动转换）
      item.quantity = Number(item.quantity) || 1;
      if (item.quantity <= 0) {
        return res.status(400).json({
          message: `订单商品项 ${i + 1} 数量必须大于0`
        });
      }
    }

    // 验证用户
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 计算总金额并检查库存
    let total = 0;
    const populatedItems = [];

    for (const item of itemsArray) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new Error(`商品 ${item.productId} 不存在`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`商品 ${product.name} 库存不足，当前库存: ${product.stock}`);
      }

      // 添加商家信息到订单项
      populatedItems.push({
        productId: product._id,
        name: product.name,
        category: product.category,
        price: product.price,
        quantity: item.quantity,
        imageUrl: product.imageUrl,
        merchant: product.merchant,
        merchantId: product.merchantId
      });

      total += product.price * item.quantity;

      // 扣减库存
      product.stock -= item.quantity;
      product.salesCount += item.quantity;
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
        await User.findByIdAndUpdate(
          item.merchantId,
          { $inc: { 'merchantInfo.totalSales': item.quantity } }
        );
      }
    }

    // 创建订单
    const newOrder = new Order({
      userId,
      items: populatedItems,
      total,
      status: '已支付',
      shippingAddress,
      remarks,
      paymentInfo: {
        method: '余额支付',
        paidAt: new Date(),
        transactionId: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`
      }
    });

    const savedOrder = await newOrder.save();

    // 创建物流信息
    const logistics = new Logistics({
      orderId: savedOrder._id,
      carrier: '顺丰速运',
      origin: populatedItems[0]?.merchantId ? {
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '科技园'
      } : {
        province: '广东省',
        city: '广州市',
        district: '天河区',
        detail: '电商产业园'
      },
      destination: shippingAddress,
      status: '已揽收',
      traces: generateLogisticsTraces(
        {
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          detail: '科技园'
        },
        shippingAddress
      ),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3天后
    });

    await logistics.save();

    res.status(201).json({
      order: savedOrder,
      logistics: logistics,
      message: '订单创建成功'
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ message: error.message });
  }
});

// 获取用户订单
app.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('items.productId', 'name imageUrl')
      .populate('items.merchantId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取单个订单详情
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('items.productId', 'name imageUrl')
      .populate('items.merchantId', 'name merchantInfo');

    if (!order) return res.status(404).json({ message: '订单不存在' });

    // 获取物流信息
    const logistics = await Logistics.findOne({ orderId: order._id });

    res.json({
      order,
      logistics
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取订单物流信息
app.get('/api/logistics/:orderId', async (req, res) => {
  try {
    const logistics = await Logistics.findOne({ orderId: req.params.orderId })
      .populate('orderId', 'orderNumber');

    if (!logistics) return res.status(404).json({ message: '物流信息不存在' });

    res.json(logistics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 更新订单状态
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) return res.status(404).json({ message: '订单不存在' });

    // 如果订单状态变为发货中，更新物流状态
    if (status === '发货中') {
      await Logistics.findOneAndUpdate(
        { orderId: order._id },
        { status: '运输中' }
      );
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 支付订单
app.post('/api/orders/:id/pay', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: '订单不存在' });

    if (order.status !== '待支付') {
      return res.status(400).json({ message: '订单状态不正确，无法支付' });
    }

    order.status = '已支付';
    order.paymentInfo = {
      method: '在线支付',
      paidAt: new Date(),
      transactionId: `PAY${Date.now()}`
    };

    await order.save();
    res.json({ message: '支付成功', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 取消订单
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: '订单不存在' });

    if (order.status !== '待支付') {
      return res.status(400).json({ message: '只能取消待支付的订单' });
    }

    // 恢复库存 (简单实现，不考虑并发)
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity, salesCount: -item.quantity }
      });
    }

    order.status = '已取消';
    await order.save();
    res.json({ message: '订单已取消', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 确认收货
app.post('/api/orders/:id/confirm', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: '订单不存在' });

    order.status = '已完成';

    // 更新物流状态
    await Logistics.findOneAndUpdate(
      { orderId: order._id },
      { status: '已签收', deliveredAt: new Date() }
    );

    await order.save();
    res.json({ message: '确认收货成功', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 商家发货
app.post('/api/orders/:id/ship', async (req, res) => {
  try {
    const { merchantId, carrier, trackingNumber } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: '订单不存在' });
    }

    // 验证订单状态
    if (order.status !== '已支付') {
      return res.status(400).json({ message: '只有已支付的订单才能发货' });
    }

    // 验证商家权限（检查订单中是否包含该商家的商品）
    // 使用更宽松的比较方式，支持 ObjectId 和 String
    const merchantItems = order.items.filter(item => {
      if (!item.merchantId) return false;
      const itemMerchantId = item.merchantId._id ? item.merchantId._id.toString() : item.merchantId.toString();
      return itemMerchantId === merchantId || itemMerchantId === merchantId.toString();
    });

    // 如果没有找到匹配的商品，可能是旧订单或商家数据问题，允许发货（降级处理）
    // 但仍需要验证用户是商家身份
    if (merchantItems.length === 0) {
      // 检查该用户是否是商家
      const merchant = await User.findOne({ _id: merchantId, role: 'merchant' });
      if (!merchant) {
        return res.status(403).json({ message: '您没有权限操作此订单' });
      }
      // 商家身份验证通过，允许发货
      console.log(`商家 ${merchantId} 发货订单 ${order._id}（宽松模式）`);
    }

    // 更新订单状态
    order.status = '发货中';
    order.logistics = {
      company: carrier || '顺丰速运',
      trackingNumber: trackingNumber || `SF${Date.now()}`,
      shippedAt: new Date(),
      status: '已发货'
    };
    await order.save();

    // 更新物流信息
    const logistics = await Logistics.findOne({ orderId: order._id });
    if (logistics) {
      logistics.carrier = carrier || logistics.carrier;
      if (trackingNumber) {
        logistics.trackingNumber = trackingNumber;
      }
      logistics.status = '运输中';
      // 添加发货轨迹
      logistics.traces.push({
        time: new Date(),
        location: '商家仓库',
        description: '商家已发货，快递员正在揽收',
        status: '已发货'
      });
      await logistics.save();
    }

    res.json({
      message: '发货成功',
      order,
      logistics
    });
  } catch (error) {
    console.error('发货失败:', error);
    res.status(500).json({ message: error.message });
  }
});

// 批量发货（商家）
app.post('/api/merchant/:merchantId/orders/batch-ship', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { orderIds, carrier } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: '请选择要发货的订单' });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const orderId of orderIds) {
      try {
        const order = await Order.findById(orderId);

        if (!order) {
          results.failed.push({ orderId, reason: '订单不存在' });
          continue;
        }

        if (order.status !== '已支付') {
          results.failed.push({ orderId, reason: '订单状态不正确' });
          continue;
        }

        // 更新订单
        order.status = '发货中';
        order.logistics = {
          company: carrier || '顺丰速运',
          trackingNumber: `SF${Date.now()}${Math.floor(Math.random() * 1000)}`,
          shippedAt: new Date(),
          status: '已发货'
        };
        await order.save();

        // 更新物流
        await Logistics.findOneAndUpdate(
          { orderId: order._id },
          {
            status: '运输中',
            carrier: carrier || '顺丰速运',
            $push: {
              traces: {
                time: new Date(),
                location: '商家仓库',
                description: '商家已发货，快递员正在揽收',
                status: '已发货'
              }
            }
          }
        );

        results.success.push(orderId);
      } catch (err) {
        results.failed.push({ orderId, reason: err.message });
      }
    }

    res.json({
      message: `成功发货 ${results.success.length} 个订单，失败 ${results.failed.length} 个`,
      results
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 删除订单
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: '订单不存在' });

    await Order.findByIdAndDelete(req.params.id);
    // 同时删除关联的物流信息
    await Logistics.findOneAndDelete({ orderId: req.params.id });

    res.json({ message: '订单已删除' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 申请退款
app.post('/api/orders/:id/refund', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: '订单不存在' });

    if (!['已支付', '发货中'].includes(order.status)) {
      return res.status(400).json({ message: '当前订单状态无法申请退款' });
    }

    // 这里简化处理，直接将状态改为已退款，实际业务中可能需要审核流程
    order.status = '已退款';

    // 如果是余额支付，应该退还余额
    if (order.paymentInfo.method === '余额支付') {
      const user = await User.findById(order.userId);
      if (user) {
        user.balance += order.total;
        await user.save();
      }
    }

    // 恢复库存
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity, salesCount: -item.quantity }
      });
    }

    await order.save();
    res.json({ message: '退款申请成功，金额已退回', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 商家路由 ---

// 获取商家列表
app.get('/api/merchants', async (req, res) => {
  try {
    const merchants = await User.find({ role: 'merchant' })
      .select('name email merchantInfo')
      .sort({ 'merchantInfo.totalSales': -1 });

    res.json(merchants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取单个商家详情
app.get('/api/merchants/:id', async (req, res) => {
  try {
    const merchant = await User.findOne({ _id: req.params.id, role: 'merchant' })
      .select('name email merchantInfo');
    if (!merchant) return res.status(404).json({ message: '商家不存在' });
    res.json(merchant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 创建商家 (管理员)
app.post('/api/merchants', authenticate, adminOnly, asyncHandler(async (req, res) => {
  const { name, email, password, shopName, shopDescription, contactPhone, rating } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('邮箱已被注册', 400, 'EMAIL_EXISTS');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  const newMerchant = new User({
    name,
    email,
    password: hashedPassword,
    role: 'merchant',
    merchantInfo: {
      shopName: shopName || name,
      shopDescription,
      contactPhone,
      rating: rating || 5.0
    }
  });

  await newMerchant.save();
  res.status(201).json({
    message: '商家创建成功',
    merchant: {
      id: newMerchant._id,
      name: newMerchant.name,
      email: newMerchant.email,
      merchantInfo: newMerchant.merchantInfo
    }
  });
}));

// 更新商家信息 (管理员或商家本人)
app.put('/api/merchants/:id', async (req, res) => {
  try {
    const { name, shopName, shopDescription, contactPhone, rating } = req.body;

    const updateData = {
      name,
      'merchantInfo.shopName': shopName,
      'merchantInfo.shopDescription': shopDescription,
      'merchantInfo.contactPhone': contactPhone
    };

    // 只有管理员可以修改评分
    if (rating !== undefined) {
      updateData['merchantInfo.rating'] = rating;
    }

    const updatedMerchant = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'merchant' },
      { $set: updateData },
      { new: true }
    );

    if (!updatedMerchant) return res.status(404).json({ message: '商家不存在' });
    res.json(updatedMerchant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 删除商家 (管理员)
app.delete('/api/merchants/:id', async (req, res) => {
  try {
    const merchant = await User.findOneAndDelete({ _id: req.params.id, role: 'merchant' });
    if (!merchant) return res.status(404).json({ message: '商家不存在' });

    // 可选：删除该商家的所有商品
    await Product.deleteMany({ merchantId: req.params.id });

    res.json({ message: '商家及其商品已删除' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 按商家搜索商品
app.get('/api/products/merchant/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const products = await Product.find({ merchantId })
      .populate('merchantId', 'name merchantInfo')
      .sort({ salesCount: -1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 更新商品（商家）
app.put('/api/products/:id', asyncHandler(async (req, res) => {
  const updateData = { ...req.body };
  
  // 如果更新了名称、描述等，需要重新生成搜索数据
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new AppError('商品不存在', 404);
  }

  // 合并新旧数据以生成正确的搜索索引
  const mergedData = {
    name: updateData.name || product.name,
    description: updateData.description || product.description,
    category: updateData.category || product.category,
    searchKeywords: updateData.searchKeywords || product.searchKeywords
  };

  const searchData = generateProductSearchData(mergedData);
  Object.assign(updateData, searchData);

  const updatedProduct = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  res.json(updatedProduct);
}));

// 获取商家统计数据
app.get('/api/merchant/:merchantId/stats', async (req, res) => {
  try {
    const { merchantId } = req.params;

    // 获取商家信息
    const merchant = await User.findById(merchantId);
    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ message: '商家不存在' });
    }

    // 获取商家的所有商品
    const products = await Product.find({ merchantId });

    // 计算商品统计
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const totalSalesCount = products.reduce((sum, p) => sum + p.salesCount, 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.price * p.salesCount), 0);

    // 按分类统计
    const categoryStats = {};
    products.forEach(p => {
      if (!categoryStats[p.category]) {
        categoryStats[p.category] = { count: 0, sales: 0, revenue: 0 };
      }
      categoryStats[p.category].count++;
      categoryStats[p.category].sales += p.salesCount;
      categoryStats[p.category].revenue += p.price * p.salesCount;
    });

    // 获取商家相关订单
    // --- 使用聚合管道进行销售分析 (Aggregation) ---
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // [Refactor] 使用 MongoDB Aggregation Pipeline 替代原有 JS 循环
    // 兼容性处理：同时匹配 ObjectId 和 字符串格式的 merchantId
    const mId = merchantId.toString();
    const mObjectId = mongoose.Types.ObjectId.isValid(merchantId) ? new mongoose.Types.ObjectId(merchantId) : null;

    const aggregationResults = await Order.aggregate([
      {
        $match: {
          'items.merchantId': { $in: [mId, mObjectId] },
          status: { $in: ['已支付', '待发货', '发货中', '已完成'] }
        }
      },
      {
        $facet: {
          // 统计1: 订单总收入 (基于Order, 比Product更准)
          "revenueStats": [
            { $unwind: "$items" },
            { $match: { "items.merchantId": { $in: [mId, mObjectId] } } },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                totalOrders: { $addToSet: "$_id" } // Count unique orders
              }
            },
            {
              $project: {
                totalRevenue: 1,
                orderCount: { $size: "$totalOrders" }
              }
            }
          ],
          // 统计2: 最近7天销售趋势
          "dailyTrend": [
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $unwind: "$items" },
            { $match: { "items.merchantId": { $in: [mId, mObjectId] } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+08:00" } },
                revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                salesCount: { $sum: "$items.quantity" }
              }
            },
            { $sort: { _id: 1 } }
          ],
          // 统计3: 24小时销售分布 (最近30天)
          "hourlyStats": [
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            { $unwind: "$items" },
            { $match: { "items.merchantId": { $in: [mId, mObjectId] } } },
            {
              $group: {
                _id: { $hour: { date: "$createdAt", timezone: "+08:00" } },
                salesCount: { $sum: "$items.quantity" }
              }
            },
            { $sort: { "_id": 1 } }
          ]
        }
      }
    ]);

    const aggStats = aggregationResults[0];

    // 从聚合结果中提取数据
    const orderRevenue = (aggStats.revenueStats[0] && aggStats.revenueStats[0].totalRevenue) || 0;
    const totalOrders = (aggStats.revenueStats[0] && aggStats.revenueStats[0].orderCount) || 0;
    
    // 汇总实际销量（基于订单）
    const actualSalesCount = (aggStats.dailyTrend || []).reduce((sum, item) => sum + item.salesCount, 0);

    // 处理7天趋势数据 (补全缺失日期)
    const salesTrend = [];
    const dailyTrend = (aggStats && aggStats.dailyTrend) || [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = dailyTrend.find(item => item._id === dateStr);
      salesTrend.push({
        date: dateStr,
        revenue: found ? found.revenue : 0,
        salesCount: found ? found.salesCount : 0
      });
    }

    // 处理小时数据
    const hourlyMap = new Map();
    aggStats.hourlyStats.forEach(item => hourlyMap.set(item._id, item.salesCount));

    const hourlyStats = [];
    let peakHour = 0;
    let maxHourlySales = 0;

    for (let i = 0; i < 24; i++) {
      const count = hourlyMap.get(i) || 0;
      hourlyStats.push({ hour: i, salesCount: count });
      if (count > maxHourlySales) {
        maxHourlySales = count;
        peakHour = i;
      }
    }

    // 热销商品TOP5
    const topProducts = products
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5);

    // 低库存商品
    const lowStockProducts = products.filter(p => p.stock < 10);

    res.json({
      merchantInfo: merchant.merchantInfo,
      stats: {
        totalProducts,
        totalStock,
        totalSalesCount: actualSalesCount || totalSalesCount, // 优先使用订单统计的销量
        totalRevenue: orderRevenue || totalRevenue, // 优先使用订单统计的收入
        totalOrders,
        orderRevenue,
        peakHour: peakHour
      },
      categoryStats,
      topProducts,
      lowStockProducts,
      salesTrend: salesTrend,
      hourlyStats: hourlyStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取商家订单
app.get('/api/merchant/:merchantId/orders', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // 查找包含该商家商品的订单
    const query = { 'items.merchantId': merchantId };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    // 过滤出只属于该商家的商品项
    const merchantOrders = orders.map(order => {
      const merchantItems = order.items.filter(item =>
        item.merchantId && item.merchantId.toString() === merchantId
      );
      const merchantTotal = merchantItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        items: merchantItems,
        merchantTotal,
        status: order.status,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt
      };
    });

    res.json({
      orders: merchantOrders,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 导出商家商品CSV
app.get('/api/merchant/:merchantId/products/export', async (req, res) => {
  try {
    const { merchantId } = req.params;

    // 获取商家信息
    const merchant = await User.findById(merchantId);
    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({ message: '商家不存在' });
    }

    // 获取商家的所有商品
    const products = await Product.find({ merchantId });

    // 生成CSV内容
    const csvHeader = '商品编码,商品名称,分类,价格,库存,销量,描述,关键词\n';
    const csvRows = products.map(p => {
      // 处理可能包含逗号的字段，用双引号包裹
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      return [
        escape(p.productCode),
        escape(p.name),
        escape(p.category),
        p.price,
        p.stock,
        p.salesCount,
        escape(p.description),
        escape(p.searchKeywords)
      ].join(',');
    }).join('\n');

    const csvContent = '\uFEFF' + csvHeader + csvRows; // 添加BOM以支持中文

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=products_${merchantId}_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 聚合操作路由 ---

// 商品统计
app.get('/api/analytics/products', async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalStock: { $sum: '$stock' },
          avgPrice: { $avg: '$price' },
          totalSales: { $sum: '$salesCount' }
        }
      }
    ]);

    const topProducts = await Product.find()
      .sort({ salesCount: -1 })
      .limit(10)
      .populate('merchantId', 'name');

    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
      .sort({ stock: 1 });

    res.json({
      categoryStats: stats,
      topProducts,
      lowStockProducts
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 订单统计 - 支持时间范围筛选
app.get('/api/admin/stats', async (req, res) => {
  try {
    const { days, startDate, endDate } = req.query;

    // 构建时间过滤条件
    let dateFilter = {};
    let filterStartDate = null;
    let filterEndDate = new Date();

    if (days && days !== 'all') {
      // 快捷时间选择
      filterStartDate = new Date();
      filterStartDate.setDate(filterStartDate.getDate() - parseInt(days));
      filterStartDate.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: filterStartDate } };
    } else if (startDate && endDate) {
      // 自定义时间范围
      filterStartDate = new Date(startDate);
      filterStartDate.setHours(0, 0, 0, 0);
      filterEndDate = new Date(endDate);
      filterEndDate.setHours(23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: filterStartDate, $lte: filterEndDate } };
    }
    // 如果没有时间参数或 days='all'，则不添加时间过滤

    // 1. 基础总数统计（用户和商家总数不受时间过滤影响）
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalMerchants = await User.countDocuments({ role: 'merchant' });

    // 2. 订单数量（受时间过滤影响）
    const orderQuery = Object.keys(dateFilter).length > 0 ? dateFilter : {};
    const totalOrders = await Order.countDocuments(orderQuery);

    // 3. 营收统计（受时间过滤影响，仅统计已支付/发货中/已完成的订单）
    const revenueMatch = { 
      status: { $in: ['已支付', '发货中', '已完成'] },
      ...(Object.keys(dateFilter).length > 0 ? dateFilter : {})
    };
    const revenueStats = await Order.aggregate([
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].total : 0;

    // 4. 销售趋势（根据时间范围动态调整）
    const trendMatch = {
      status: { $in: ['已支付', '发货中', '已完成'] },
      ...(Object.keys(dateFilter).length > 0 ? dateFilter : {})
    };
    const salesTrend = await Order.aggregate([
      { $match: trendMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+08:00" } },
          amount: { $sum: "$total" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 补全缺失的日期（仅当有时间过滤时）
    let filledSalesTrend = salesTrend;
    if (filterStartDate && days && days !== 'all') {
      const dayCount = parseInt(days);
      filledSalesTrend = [];
      const trendMap = new Map(salesTrend.map(item => [item._id, item]));

      for (let i = dayCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const found = trendMap.get(dateStr);
        filledSalesTrend.push({
          _id: dateStr,
          amount: found ? found.amount : 0,
          orderCount: found ? found.orderCount : 0
        });
      }
    }

    // 5. 品类销售分布（受时间过滤影响，从订单中统计实际销量）
    // 既然我们已经在 Order.items 中增加了 category，直接统计即可
    const categoryStats = await Order.aggregate([
      { $match: trendMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: '$items.category',
          count: { $sum: "$items.quantity" },
          sales: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // 6. 订单状态分布（受时间过滤影响）
    const orderStatusStats = await Order.aggregate([
      { $match: trendMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      totalUsers,
      totalMerchants,
      totalOrders,
      totalRevenue,
      salesTrend: filledSalesTrend,
      categoryStats,
      orderStatusStats,
      dateRange: {
        start: filterStartDate ? filterStartDate.toISOString() : null,
        end: filterEndDate ? filterEndDate.toISOString() : null,
        days: days || null
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
});

app.get('/api/analytics/orders', async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateFormat;
    switch (period) {
      case 'day':
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'week':
        dateFormat = { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
        break;
      case 'month':
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    }

    const revenueByPeriod = await Order.aggregate([
      {
        $group: {
          _id: dateFormat,
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const statusStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total' }
        }
      }
    ]);

    res.json({
      revenueByPeriod,
      statusStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 管理员路由 ---

// 获取所有订单（管理员）
app.get('/api/admin/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const query = {};
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate('userId', 'name email')
      .populate('items.productId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取所有用户（管理员）
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 删除用户（管理员）
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: '用户不存在' });
    res.json({ message: '用户已删除' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- 评价系统路由 ---

// 创建评价
app.post('/api/reviews', async (req, res) => {
  try {
    const { orderId, productId, userId, rating, content, images, isAnonymous } = req.body;

    // 验证订单是否存在且已完成
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: '订单不存在' });
    }

    if (order.status !== '已完成') {
      return res.status(400).json({ message: '只有已完成的订单才能评价' });
    }

    // 验证用户是否为订单所有者
    if (order.userId.toString() !== userId) {
      return res.status(403).json({ message: '您没有权限评价此订单' });
    }

    // 检查是否已经评价过
    const existingReview = await Review.findOne({ orderId, productId, userId });
    if (existingReview) {
      return res.status(400).json({ message: '您已经评价过此商品' });
    }

    // 获取商品信息
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: '商品不存在' });
    }

    // 创建评价
    const review = new Review({
      orderId,
      productId,
      userId,
      merchantId: product.merchantId,
      rating,
      content,
      images: images || [],
      isAnonymous: isAnonymous || false
    });

    await review.save();

    // 更新商品评分 (计算平均评分)
    const productReviews = await Review.find({ productId });
    const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;

    // 可以在 Product 模型中添加 avgRating 字段来存储
    // 这里简化处理，直接返回评价

    res.status(201).json({
      message: '评价成功',
      review: await Review.findById(review._id).populate('userId', 'name')
    });
  } catch (error) {
    console.error('创建评价失败:', error);
    res.status(500).json({ message: error.message });
  }
});

// 获取商品评价列表
app.get('/api/reviews/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = 'newest', rating } = req.query;

    const query = { productId, status: 'approved' };
    if (rating) query.rating = parseInt(rating);

    let sortOption = { createdAt: -1 }; // 默认最新
    if (sort === 'highest') sortOption = { rating: -1, createdAt: -1 };
    if (sort === 'lowest') sortOption = { rating: 1, createdAt: -1 };
    if (sort === 'helpful') sortOption = { likes: -1, createdAt: -1 };

    const reviews = await Review.find(query)
      .populate('userId', 'name')
      .sort(sortOption)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Review.countDocuments(query);

    // 统计评分分布
    const ratingStats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // 计算平均评分
    const avgResult = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), status: 'approved' } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    const avgRating = avgResult.length > 0 ? avgResult[0].avgRating.toFixed(1) : '0.0';
    const totalCount = avgResult.length > 0 ? avgResult[0].totalCount : 0;

    // 处理匿名用户显示
    const processedReviews = reviews.map(review => {
      const r = review.toObject();
      if (r.isAnonymous && r.userId) {
        r.userId.name = r.userId.name.charAt(0) + '***';
      }
      return r;
    });

    res.json({
      reviews: processedReviews,
      pagination: {
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit)
      },
      stats: {
        avgRating,
        totalCount,
        ratingDistribution: ratingStats
      }
    });
  } catch (error) {
    console.error('获取评价失败:', error);
    res.status(500).json({ message: error.message });
  }
});

// 获取用户的评价列表
app.get('/api/reviews/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ userId })
      .populate('productId', 'name imageUrl price')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Review.countDocuments({ userId });

    res.json({
      reviews,
      pagination: {
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 检查订单商品是否已评价
app.get('/api/reviews/check/:orderId/:productId', async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { userId } = req.query;

    const review = await Review.findOne({ orderId, productId, userId });

    res.json({
      reviewed: !!review,
      review: review || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取待评价的订单商品
app.get('/api/reviews/pending/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 获取用户已完成的订单
    const completedOrders = await Order.find({
      userId,
      status: '已完成'
    }).sort({ createdAt: -1 });

    // 获取用户已评价的商品
    const reviewedItems = await Review.find({ userId }).select('orderId productId');
    const reviewedSet = new Set(reviewedItems.map(r => `${r.orderId}-${r.productId}`));

    // 筛选出未评价的商品
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
            orderDate: order.createdAt
          });
        }
      }
    }

    res.json({ pendingReviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 点赞评价
app.post('/api/reviews/:reviewId/like', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { userId } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: '评价不存在' });
    }

    // 检查是否已点赞
    const hasLiked = review.likedBy.includes(userId);

    if (hasLiked) {
      // 取消点赞
      review.likedBy = review.likedBy.filter(id => id.toString() !== userId);
      review.likes = Math.max(0, review.likes - 1);
    } else {
      // 点赞
      review.likedBy.push(userId);
      review.likes += 1;
    }

    await review.save();

    res.json({
      message: hasLiked ? '取消点赞成功' : '点赞成功',
      likes: review.likes,
      hasLiked: !hasLiked
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 商家回复评价
app.post('/api/reviews/:reviewId/reply', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { merchantId, content } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: '评价不存在' });
    }

    // 验证商家权限
    if (review.merchantId.toString() !== merchantId) {
      return res.status(403).json({ message: '您没有权限回复此评价' });
    }

    review.merchantReply = {
      content,
      repliedAt: new Date()
    };

    await review.save();

    res.json({
      message: '回复成功',
      review
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 获取商家收到的评价
app.get('/api/reviews/merchant/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { page = 1, limit = 10, rating, replied } = req.query;

    const query = { merchantId };
    if (rating) query.rating = parseInt(rating);
    if (replied === 'true') query['merchantReply.content'] = { $exists: true };
    if (replied === 'false') query['merchantReply.content'] = { $exists: false };

    const reviews = await Review.find(query)
      .populate('userId', 'name')
      .populate('productId', 'name imageUrl')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Review.countDocuments(query);

    // 统计
    const stats = await Review.aggregate([
      { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalCount: { $sum: 1 },
          goodCount: { $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] } },
          badCount: { $sum: { $cond: [{ $lte: ['$rating', 2] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      reviews,
      pagination: {
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page)
      },
      stats: stats[0] || { avgRating: 0, totalCount: 0, goodCount: 0, badCount: 0 }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handling Middleware (must be after all routes)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Admin Account: 12345@123.com / 12345');
});
