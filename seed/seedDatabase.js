const mongoose = require('mongoose');
const { hashPassword } = require('../utils/password');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Logistics = require('../models/Logistics');
const Address = require('../models/Address');
const Review = require('../models/Review');
const { generateProductSearchData } = require('../utils/searchHelper');
const { generateLogisticsTraces } = require('../utils/logisticsTraces');

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
module.exports = { seedDatabase };

