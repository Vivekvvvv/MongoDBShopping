const base = process.env.BASE_URL || 'http://127.0.0.1:3001';

function nowId() {
  return String(Date.now());
}

function toYmd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function readBody(res) {
  const text = await res.text();
  try {
    return { ok: true, json: JSON.parse(text), text };
  } catch {
    return { ok: false, text };
  }
}

async function expectOk(res, label) {
  if (res.ok) return;
  const body = await readBody(res);
  const detail = body.ok ? body.json : body.text;
  throw new Error(`[${label}] HTTP ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

async function getJson(path, { token } = {}) {
  const res = await fetch(base + path, {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  await expectOk(res, `GET ${path}`);
  const body = await res.json();
  return body;
}

async function postJson(path, payload, { token } = {}) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  await expectOk(res, `POST ${path}`);
  return res.json();
}

async function putJson(path, payload, { token } = {}) {
  const res = await fetch(base + path, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  await expectOk(res, `PUT ${path}`);
  return res.json();
}

async function delJson(path, { token } = {}) {
  const res = await fetch(base + path, {
    method: 'DELETE',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  await expectOk(res, `DELETE ${path}`);
  return res.json();
}

async function login(email, password) {
  const data = await postJson('/api/login', { email, password });
  const token = data.token;
  const user = data.user;
  const userId = (user && (user._id || user.id)) || null;
  if (!token || !userId) {
    throw new Error(`[login] missing token/userId for ${email}: ${JSON.stringify(data)}`);
  }
  return { token, user, userId };
}

async function createProductAsMerchant({ token, merchantId }) {
  const fd = new FormData();
  fd.set('name', `SMOKE 商品 ${nowId()}`);
  fd.set('price', '88');
  fd.set('category', 'Electronics');
  fd.set('description', 'smoke create product');
  fd.set('stock', '5');
  fd.set('merchant', merchantId);
  fd.set('imageUrl', '/images/耳机.jpg');

  const res = await fetch(base + '/api/products', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  });
  await expectOk(res, 'POST /api/products (multipart)');
  return res.json();
}

async function main() {
  const startedAt = Date.now();

  // 0) Health
  const health = await getJson('/healthz');
  if (!health || health.status !== 'ok') {
    throw new Error(`[healthz] unexpected: ${JSON.stringify(health)}`);
  }

  // 1) Login flows
  const admin = await login('12345@123.com', '12345');
  const merchant = await login('merchant1@shop.com', '123456');
  const user = await login('zhangsan@test.com', '123456');

  // 2) User: 商品列表 -> 商品详情（含评价区）
  const products = await getJson('/api/products');
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('[products] empty list');
  }

  // Prefer a product belonging to merchant1 so we can ship later
  const productForOrder = products.find((p) => {
    const mid = p.merchantId && (p.merchantId._id || p.merchantId);
    return String(mid) === String(merchant.userId);
  }) || products[0];

  const productId = productForOrder._id;
  if (!productId) throw new Error('[products] missing product _id');

  const productDetail = await getJson(`/api/products/${productId}`);
  if (!productDetail || !productDetail._id) {
    throw new Error(`[product detail] unexpected: ${JSON.stringify(productDetail)}`);
  }

  const productReviews = await getJson(`/api/reviews/product/${productId}`);
  // 允许空评价，但至少应返回结构
  if (!productReviews || typeof productReviews !== 'object') {
    throw new Error(`[product reviews] unexpected: ${JSON.stringify(productReviews)}`);
  }

  // 3) User: 下单 -> 订单列表 -> 订单详情
  const shippingAddress = {
    province: '广东省',
    city: '深圳市',
    district: '南山区',
    detail: `smoke 收货地址 ${nowId()}`,
  };

  const createOrderRes = await postJson('/api/orders', {
    userId: user.userId,
    items: [{ productId, quantity: 1 }],
    shippingAddress,
    remarks: 'smoke order',
  });

  const orderId = createOrderRes && createOrderRes.order && createOrderRes.order._id;
  if (!orderId) {
    throw new Error(`[create order] missing orderId: ${JSON.stringify(createOrderRes)}`);
  }

  const userOrders = await getJson(`/api/orders/user/${user.userId}`);
  if (!userOrders || !Array.isArray(userOrders.orders)) {
    throw new Error(`[user orders] unexpected: ${JSON.stringify(userOrders)}`);
  }

  const orderDetail = await getJson(`/api/orders/${orderId}`);
  if (!orderDetail || !orderDetail.order || !orderDetail.order._id) {
    throw new Error(`[order detail] unexpected: ${JSON.stringify(orderDetail)}`);
  }

  // 4) Merchant: 订单管理 -> 发货弹窗提交
  const shipRes = await postJson(`/api/orders/${orderId}/ship`, {
    merchantId: merchant.userId,
    carrier: '顺丰速运',
    trackingNumber: `SMOKE${nowId()}`,
  });
  if (!shipRes || !shipRes.order || shipRes.order.status !== '发货中') {
    throw new Error(`[ship] unexpected: ${JSON.stringify(shipRes)}`);
  }

  const merchantOrders = await getJson(`/api/merchant/${merchant.userId}/orders`);
  if (!merchantOrders || !Array.isArray(merchantOrders.orders)) {
    throw new Error(`[merchant orders] unexpected: ${JSON.stringify(merchantOrders)}`);
  }

  // 5) User: 评价弹窗 -> 提交评价
  const reviewRes = await postJson('/api/reviews', {
    orderId,
    productId,
    userId: user.userId,
    rating: 5,
    content: 'smoke 评价内容',
    images: [],
    isAnonymous: false,
  });

  if (!reviewRes || !reviewRes.review || !reviewRes.review._id) {
    throw new Error(`[create review] unexpected: ${JSON.stringify(reviewRes)}`);
  }

  const reviewedCheck = await getJson(`/api/reviews/check/${orderId}/${productId}?userId=${encodeURIComponent(user.userId)}`);
  if (!reviewedCheck || typeof reviewedCheck.reviewed !== 'boolean') {
    throw new Error(`[review check] unexpected: ${JSON.stringify(reviewedCheck)}`);
  }

  // 6) Merchant: 商品管理（新增/编辑/删除）
  const newProduct = await createProductAsMerchant({ token: merchant.token, merchantId: merchant.userId });
  const newProductId = newProduct && newProduct._id;
  if (!newProductId) {
    throw new Error(`[merchant create product] unexpected: ${JSON.stringify(newProduct)}`);
  }

  const updated = await putJson(`/api/products/${newProductId}`, {
    price: 99,
    stock: 9,
  });
  if (!updated || String(updated._id) !== String(newProductId)) {
    throw new Error(`[merchant update product] unexpected: ${JSON.stringify(updated)}`);
  }

  const delRes = await delJson(`/api/products/${newProductId}`);
  if (!delRes || !delRes.message) {
    throw new Error(`[merchant delete product] unexpected: ${JSON.stringify(delRes)}`);
  }

  // 7) Admin: 近7/30/全部 + 自定义日期
  const stats7 = await getJson('/api/admin/stats?days=7', { token: admin.token });
  const stats30 = await getJson('/api/admin/stats?days=30', { token: admin.token });
  const statsAll = await getJson('/api/admin/stats?days=all', { token: admin.token });

  if (typeof stats7.totalRevenue !== 'number' || typeof stats30.totalOrders !== 'number' || typeof statsAll.totalUsers !== 'number') {
    throw new Error('[admin stats] missing key fields');
  }

  const today = new Date();
  const startDate = toYmd(new Date(today.getFullYear(), today.getMonth(), 1));
  const endDate = toYmd(today);
  const statsCustom = await getJson(`/api/admin/stats?startDate=${startDate}&endDate=${endDate}`, { token: admin.token });
  if (!statsCustom || !statsCustom.dateRange) {
    throw new Error(`[admin stats custom] unexpected: ${JSON.stringify(statsCustom)}`);
  }

  // 8) Admin: 用户列表删除（确认/错误提示）
  const tmpEmail = `smoke_user_${nowId()}@test.com`;
  const tmpReg = await postJson('/api/register', {
    name: 'SMOKE 用户',
    email: tmpEmail,
    password: '123456',
    role: 'user',
  });
  const tmpUserId = tmpReg && tmpReg.user && (tmpReg.user._id || tmpReg.user.id);
  if (!tmpUserId) {
    throw new Error(`[tmp register] unexpected: ${JSON.stringify(tmpReg)}`);
  }

  const usersBefore = await getJson('/api/admin/users', { token: admin.token });
  if (!Array.isArray(usersBefore)) {
    throw new Error(`[admin users] unexpected: ${JSON.stringify(usersBefore)}`);
  }

  const delUserOk = await delJson(`/api/admin/users/${tmpUserId}`, { token: admin.token });
  if (!delUserOk || delUserOk.message !== '用户已删除') {
    throw new Error(`[admin delete user] unexpected: ${JSON.stringify(delUserOk)}`);
  }

  // Delete again -> should 404
  const res2 = await fetch(base + `/api/admin/users/${tmpUserId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${admin.token}` },
  });
  if (res2.status !== 404) {
    const body2 = await readBody(res2);
    throw new Error(`[admin delete user again] expected 404, got ${res2.status}: ${body2.ok ? JSON.stringify(body2.json) : body2.text}`);
  }

  // 9) Admin: 订单列表（状态/金额字段）
  const adminOrders = await getJson('/api/admin/orders', { token: admin.token });
  if (!adminOrders || !Array.isArray(adminOrders.orders)) {
    throw new Error(`[admin orders] unexpected: ${JSON.stringify(adminOrders)}`);
  }

  const elapsedMs = Date.now() - startedAt;
  console.log('\nSMOKE FLOWS OK');
  console.log(`- base: ${base}`);
  console.log(`- product for order: ${productId}`);
  console.log(`- order: ${orderId}`);
  console.log(`- shipped status: ${shipRes.order.status}`);
  console.log(`- review created: ${reviewRes.review._id}`);
  console.log(`- admin stats (7/30/all/custom): ok`);
  console.log(`- admin delete user error state: ok`);
  console.log(`- elapsed: ${elapsedMs}ms`);
}

main().catch((e) => {
  console.error('\nSMOKE FLOWS FAILED');
  console.error(e);
  process.exitCode = 1;
});
