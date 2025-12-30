<template>
  <section class="merchant-dashboard">
    <el-result
      v-if="!user"
      icon="warning"
      title="你还未登录"
      sub-title="登录后可进入商家后台"
    >
      <template #extra>
        <RouterLink to="/login" class="link">
          <el-button type="primary">去登录</el-button>
        </RouterLink>
      </template>
    </el-result>

    <el-result
      v-else-if="user.role !== 'merchant'"
      icon="error"
      title="无权限"
      sub-title="仅商家可访问"
    />

    <template v-else>
      <el-card shadow="never" class="dashboard-header-card">
        <div class="header-row">
          <div class="shop-info">
            <h2 class="shop-title">{{ shopName }}</h2>
            <div class="shop-desc">{{ shopDescription }}</div>
            <div class="shop-meta">
              <el-tag size="small" effect="light">
                <i class="fas fa-star icon-mr"></i>
                {{ formatRating(user?.merchantInfo?.rating) }}
              </el-tag>
              <el-tag size="small" type="info" effect="light">
                <i class="fas fa-phone icon-mr"></i>
                {{ user?.merchantInfo?.contactPhone || '-' }}
              </el-tag>
            </div>
          </div>

          <div class="header-actions">
            <el-button type="primary" :disabled="actionLoading" @click="openProductModalForCreate">
              <i class="fas fa-plus icon-mr"></i>
              发布商品
            </el-button>
            <a :href="exportCsvUrl" target="_blank" rel="noreferrer" class="link">
              <el-button type="primary" plain :disabled="!merchantId">
                <i class="fas fa-download icon-mr"></i>
                导出CSV
              </el-button>
            </a>
          </div>
        </div>
      </el-card>

      <el-card v-if="statsLoading" shadow="never" class="section-card">
        <el-skeleton :rows="3" animated />
      </el-card>
      <el-alert v-else-if="statsError" :title="statsError" type="error" show-icon :closable="false" class="section-alert" />

      <template v-else>
        <el-row :gutter="12" class="stats-row">
          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-head">
                <el-tag size="small" effect="light"><i class="fas fa-box icon-mr"></i>商品</el-tag>
              </div>
              <div class="stat-value">{{ merchantStats.totalProducts || 0 }}</div>
              <div class="stat-label">商品总数</div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-head">
                <el-tag size="small" type="success" effect="light"><i class="fas fa-warehouse icon-mr"></i>库存</el-tag>
              </div>
              <div class="stat-value">{{ merchantStats.totalStock || 0 }}</div>
              <div class="stat-label">库存总量</div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-head">
                <el-tag size="small" type="warning" effect="light"><i class="fas fa-shopping-bag icon-mr"></i>销量</el-tag>
              </div>
              <div class="stat-value">{{ merchantStats.totalSalesCount || 0 }}</div>
              <div class="stat-label">累计销量</div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-head">
                <el-tag size="small" type="danger" effect="light"><i class="fas fa-yen-sign icon-mr"></i>收入</el-tag>
              </div>
              <div class="stat-value">¥{{ formatMoney(merchantStats.totalRevenue) }}</div>
              <div class="stat-label">累计收入</div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-head">
                <el-tag size="small" type="info" effect="light"><i class="fas fa-receipt icon-mr"></i>订单</el-tag>
              </div>
              <div class="stat-value">{{ merchantStats.totalOrders || 0 }}</div>
              <div class="stat-label">订单数量</div>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :md="8" :lg="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-head">
                <el-tag size="small" effect="light"><i class="fas fa-clock icon-mr"></i>高峰</el-tag>
              </div>
              <div class="stat-value stat-value-sm">{{ peakHourText }}</div>
              <div class="stat-label">高峰销售时段</div>
            </el-card>
          </el-col>
        </el-row>

        <el-alert
          v-if="lowStockProducts.length"
          type="warning"
          show-icon
          :closable="false"
          class="section-alert"
          title="库存预警"
        >
          <div class="low-stock-list">
            <div v-for="p in lowStockProducts" :key="p._id" class="low-stock-row">
              <span class="ellipsis">{{ p.name }}</span>
              <span class="nowrap">库存 {{ p.stock }}</span>
            </div>
          </div>
        </el-alert>
      </template>

      <el-tabs v-model="activeTab" class="section-tabs">
        <el-tab-pane label="商品管理" name="products">
          <el-card shadow="never" class="section-card">
            <el-row :gutter="12">
              <el-col :xs="24" :sm="14" :md="12">
                <el-input v-model.trim="productSearch" placeholder="搜索商品名称..." clearable />
              </el-col>
              <el-col :xs="24" :sm="10" :md="8">
                <el-select v-model="categoryFilter" placeholder="全部分类" clearable class="w-full">
                  <el-option label="电子产品" value="Electronics" />
                  <el-option label="服装" value="Clothing" />
                  <el-option label="家居" value="Home" />
                  <el-option label="图书" value="Books" />
                  <el-option label="美妆" value="Beauty" />
                </el-select>
              </el-col>
            </el-row>
          </el-card>

          <el-card v-if="productsLoading" shadow="never" class="section-card">
            <el-skeleton :rows="8" animated />
          </el-card>
          <el-alert v-else-if="productsError" :title="productsError" type="error" show-icon :closable="false" class="section-alert" />

          <el-empty v-else-if="filteredProducts.length === 0" description="暂无商品" />

          <el-table v-else :data="filteredProducts" stripe class="section-card w-full">
            <el-table-column label="图片" width="84">
              <template #default="{ row }">
                <el-image
                  :src="row.imageUrl || 'https://via.placeholder.com/150'"
                  fit="cover"
                  class="thumb"
                />
              </template>
            </el-table-column>
            <el-table-column label="商品名称" min-width="240">
              <template #default="{ row }">
                <div class="p-name">{{ row.name }}</div>
                <div class="p-code">编号: {{ row.productCode || 'N/A' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="分类" width="120">
              <template #default="{ row }">
                <el-tag size="small" effect="light">{{ row.category || 'General' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="价格" width="120" align="right">
              <template #default="{ row }">¥{{ formatMoney(row.price) }}</template>
            </el-table-column>
            <el-table-column label="库存" width="120" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="stockTagType(row)" effect="light">{{ row.stock || 0 }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="销量" width="120" align="center">
              <template #default="{ row }">{{ row.salesCount || 0 }}</template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" type="primary" plain :disabled="actionLoading" @click="openProductModalForEdit(row)">编辑</el-button>
                  <el-button size="small" type="danger" plain :disabled="actionLoading" @click="deleteProduct(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="订单管理" name="orders">
          <el-card v-if="ordersLoading" shadow="never" class="section-card">
            <el-skeleton :rows="8" animated />
          </el-card>
          <el-alert v-else-if="ordersError" :title="ordersError" type="error" show-icon :closable="false" class="section-alert" />

          <el-empty v-else-if="orders.length === 0" description="暂无订单" />

          <div v-else class="orders-list">
            <el-card v-for="o in orders" :key="o._id" shadow="hover" class="order-card">
              <div class="order-top">
                <div>
                  <div class="order-no">订单号：{{ o.orderNumber || o._id }}</div>
                  <div class="order-meta">用户：{{ o.userId?.name || o.userId?.email || o.userId || '-' }}</div>
                  <div class="order-meta">状态：<el-tag size="small">{{ o.status }}</el-tag></div>
                  <div class="order-meta">下单时间：{{ formatDateTime(o.createdAt) }}</div>
                </div>
                <div class="order-right">
                  <div class="order-amount">¥{{ formatMoney(o.merchantTotal || o.total) }}</div>
                  <el-button
                    v-if="o.status === '已支付' || o.status === '待发货'"
                    type="success"
                    size="small"
                    :loading="actionLoading"
                    @click="openShipModal(o)"
                  >
                    发货
                  </el-button>
                </div>
              </div>

              <el-divider />

              <div class="order-items">
                <div v-for="it in o.items" :key="it._id || it.productId || it.name" class="order-item">
                  <span class="ellipsis">{{ it.name }} x{{ it.quantity }}</span>
                  <span class="nowrap">¥{{ formatMoney((Number(it.price) || 0) * (Number(it.quantity) || 0)) }}</span>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>

        <el-tab-pane label="数据分析" name="analytics">
          <el-row :gutter="12" class="analytics-row">
            <el-col :xs="24" :md="12">
              <el-card shadow="never" class="section-card">
                <template #header>🏆 热销商品TOP5</template>
                <el-empty v-if="topProducts.length === 0" description="暂无数据" />
                <div v-else class="kv-list">
                  <div v-for="p in topProducts" :key="p._id" class="kv-row">
                    <span class="ellipsis">{{ p.name }}</span>
                    <span class="nowrap">销量 {{ p.salesCount || 0 }}</span>
                  </div>
                </div>
              </el-card>
            </el-col>

            <el-col :xs="24" :md="12">
              <el-card shadow="never" class="section-card">
                <template #header>📊 分类销售统计</template>
                <el-empty v-if="categoryRows.length === 0" description="暂无数据" />
                <div v-else class="kv-list">
                  <div v-for="row in categoryRows" :key="row.category" class="kv-row">
                    <span>{{ row.category }}</span>
                    <span class="nowrap">销量 {{ row.sales }} / ¥{{ formatMoney(row.revenue) }}</span>
                  </div>
                </div>
              </el-card>
            </el-col>

            <el-col :xs="24">
              <el-card shadow="never" class="section-card">
                <template #header>📈 销售趋势 (最近7天)</template>
                <el-empty v-if="salesTrend.length === 0" description="暂无数据" />
                <el-table v-else :data="salesTrend" size="small" class="w-full">
                  <el-table-column prop="date" label="日期" />
                  <el-table-column prop="salesCount" label="销量" align="right" width="120">
                    <template #default="{ row }">{{ row.salesCount || 0 }}</template>
                  </el-table-column>
                  <el-table-column prop="revenue" label="销售额" align="right" width="160">
                    <template #default="{ row }">¥{{ formatMoney(row.revenue) }}</template>
                  </el-table-column>
                </el-table>
              </el-card>
            </el-col>
          </el-row>
        </el-tab-pane>
      </el-tabs>

      <el-dialog
        v-model="productModalOpen"
        :title="productModalTitle"
        width="640"
        :close-on-click-modal="false"
        @close="closeProductModal"
      >
        <el-form ref="productFormRef" :model="productForm" :rules="productRules" label-width="90px">
          <el-form-item label="商品名称" prop="name">
            <el-input v-model.trim="productForm.name" placeholder="请输入商品名称" />
          </el-form-item>

          <el-form-item label="商品描述">
            <el-input v-model.trim="productForm.description" type="textarea" :rows="4" placeholder="可选" />
          </el-form-item>

          <el-row :gutter="12">
            <el-col :xs="24" :sm="12">
              <el-form-item label="价格" prop="price">
                <el-input-number v-model="productForm.price" :min="0" :precision="2" class="w-full" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="库存" prop="stock">
                <el-input-number v-model="productForm.stock" :min="0" :precision="0" class="w-full" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="分类" prop="category">
            <el-select v-model="productForm.category" placeholder="选择分类" class="w-full">
              <el-option label="电子产品" value="Electronics" />
              <el-option label="服装" value="Clothing" />
              <el-option label="家居" value="Home" />
              <el-option label="图书" value="Books" />
              <el-option label="美妆" value="Beauty" />
            </el-select>
          </el-form-item>

          <el-form-item label="商品图片">
            <input type="file" accept="image/*" @change="onProductImage" />
            <div v-if="productImagePreview" class="image-preview-wrap">
              <el-image :src="productImagePreview" fit="contain" class="image-preview" />
            </div>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button :disabled="actionLoading" @click="closeProductModal">取消</el-button>
          <el-button type="primary" :loading="actionLoading" @click="onSaveProduct">保存</el-button>
        </template>
      </el-dialog>

      <el-dialog
        v-model="shipModalOpen"
        title="订单发货"
        width="520"
        :close-on-click-modal="false"
        @close="closeShipModal"
      >
        <el-form ref="shipFormRef" :model="shipForm" label-width="90px">
          <el-form-item label="快递公司">
            <el-input v-model.trim="shipForm.carrier" placeholder="默认快递" />
          </el-form-item>
          <el-form-item label="运单号">
            <el-input v-model.trim="shipForm.trackingNumber" placeholder="请输入运单号" />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button :disabled="actionLoading" @click="closeShipModal">取消</el-button>
          <el-button type="success" :loading="actionLoading" :disabled="!shipForm.orderId" @click="confirmShip">确认发货</el-button>
        </template>
      </el-dialog>

      <el-alert v-if="message" :title="message" type="info" show-icon :closable="false" class="section-alert" />
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiFetch, getAuthToken, getCurrentUser } from '../api/http';

const user = ref(getCurrentUser());

const activeTab = ref('products');

const stats = ref(null);
const statsLoading = ref(false);
const statsError = ref('');

const products = ref([]);
const productsLoading = ref(false);
const productsError = ref('');

const orders = ref([]);
const ordersLoading = ref(false);
const ordersError = ref('');

const actionLoading = ref(false);
const message = ref('');

const productSearch = ref('');
const categoryFilter = ref('');

const productModalOpen = ref(false);
const productModalMode = ref('create');
const productFormRef = ref();
const productForm = ref({
  id: '',
  name: '',
  description: '',
  price: 0,
  stock: 0,
  category: '',
  imageUrl: ''
});
const productImageFile = ref(null);
const productImagePreview = ref('');

const shipModalOpen = ref(false);
const shipFormRef = ref();
const shipForm = ref({ orderId: '', carrier: '默认快递', trackingNumber: '' });

const productRules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'change' }],
  stock: [{ required: true, message: '请输入库存', trigger: 'change' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }]
};

function refreshUser() {
  user.value = getCurrentUser();
}

const merchantId = computed(() => user.value?.id || user.value?._id || '');

const exportCsvUrl = computed(() => {
  const id = merchantId.value;
  return id ? `/api/merchant/${encodeURIComponent(id)}/products/export` : '#';
});

const shopName = computed(() => {
  const u = user.value;
  if (!u) return '';
  return u?.merchantInfo?.shopName || (u.name ? `${u.name}的店铺` : '我的店铺');
});

const shopDescription = computed(() => {
  const u = user.value;
  if (!u) return '';
  return u?.merchantInfo?.shopDescription || '暂无简介';
});

const merchantStats = computed(() => stats.value?.stats || {});
const lowStockProducts = computed(() => stats.value?.lowStockProducts || []);
const topProducts = computed(() => stats.value?.topProducts || []);
const salesTrend = computed(() => stats.value?.salesTrend || []);

const categoryRows = computed(() => {
  const raw = stats.value?.categoryStats || {};
  return Object.keys(raw).map((k) => ({ category: k, ...raw[k] }));
});

const peakHourText = computed(() => {
  const h = merchantStats.value?.peakHour;
  if (h === undefined || h === null || Number.isNaN(Number(h))) return '-';
  const hour = Number(h);
  const next = (hour + 1) % 24;
  return `${hour}:00 - ${next}:00`;
});

const filteredProducts = computed(() => {
  const q = (productSearch.value || '').toLowerCase();
  const cat = categoryFilter.value || '';
  return (products.value || []).filter((p) => {
    const nameOk = !q || (p?.name || '').toLowerCase().includes(q);
    const catOk = !cat || (p?.category || '') === cat;
    return nameOk && catOk;
  });
});

function formatRating(rating) {
  const r = Number(rating);
  if (!Number.isFinite(r)) return '5.0';
  return r.toFixed(1);
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function stockCellStyle(product) {
  const stock = Number(product?.stock) || 0;
  if (stock <= 0) return 'color:#dc3545; font-weight: 700;';
  if (stock < 10) return 'color:#ffc107; font-weight: 700;';
  return 'color:#28a745; font-weight: 600;';
}

function stockTagType(product) {
  const stock = Number(product?.stock) || 0;
  if (stock <= 0) return 'danger';
  if (stock < 10) return 'warning';
  return 'success';
}

function onSaveProduct() {
  productFormRef.value?.validate?.((valid) => {
    if (!valid) return;
    saveProduct();
  });
}

async function loadStats() {
  const id = merchantId.value;
  if (!id) return;
  statsLoading.value = true;
  statsError.value = '';
  try {
    stats.value = await apiFetch(`/api/merchant/${encodeURIComponent(id)}/stats`);
  } catch (e) {
    statsError.value = e?.message || '加载失败';
    stats.value = null;
  } finally {
    statsLoading.value = false;
  }
}

async function loadProducts() {
  const id = merchantId.value;
  if (!id) return;
  productsLoading.value = true;
  productsError.value = '';
  try {
    products.value = await apiFetch(`/api/products/merchant/${encodeURIComponent(id)}`);
  } catch (e) {
    productsError.value = e?.message || '加载失败';
    products.value = [];
  } finally {
    productsLoading.value = false;
  }
}

async function loadOrders() {
  const id = merchantId.value;
  if (!id) return;
  ordersLoading.value = true;
  ordersError.value = '';
  try {
    const data = await apiFetch(`/api/merchant/${encodeURIComponent(id)}/orders`);
    orders.value = data?.orders || [];
  } catch (e) {
    ordersError.value = e?.message || '加载失败';
    orders.value = [];
  } finally {
    ordersLoading.value = false;
  }
}

async function reloadAll() {
  await Promise.all([loadStats(), loadProducts(), loadOrders()]);
}

function openProductModalForCreate() {
  productModalMode.value = 'create';
  productForm.value = { id: '', name: '', description: '', price: 0, stock: 0, category: '', imageUrl: '' };
  productImageFile.value = null;
  productImagePreview.value = '';
  productModalOpen.value = true;
}

function openProductModalForEdit(product) {
  productModalMode.value = 'edit';
  productForm.value = {
    id: product?._id || '',
    name: product?.name || '',
    description: product?.description || '',
    price: Number(product?.price) || 0,
    stock: Number(product?.stock) || 0,
    category: product?.category || 'General',
    imageUrl: product?.imageUrl || ''
  };
  productImageFile.value = null;
  productImagePreview.value = product?.imageUrl || '';
  productModalOpen.value = true;
}

const productModalTitle = computed(() => (productModalMode.value === 'edit' ? '编辑商品' : '发布商品'));

function closeProductModal() {
  productModalOpen.value = false;
}

function onProductImage(e) {
  const f = e?.target?.files?.[0];
  productImageFile.value = f || null;
  if (!f) {
    productImagePreview.value = productForm.value.imageUrl || '';
    return;
  }
  try {
    productImagePreview.value = URL.createObjectURL(f);
  } catch {
    productImagePreview.value = '';
  }
}

async function uploadImageIfNeeded() {
  const f = productImageFile.value;
  if (!f) return '';

  const token = getAuthToken();
  const form = new FormData();
  form.append('image', f);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: form
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data?.imageUrl || '';
}

async function saveProduct() {
  const u = user.value;
  const id = merchantId.value;
  if (!u || !id) return;

  actionLoading.value = true;
  message.value = '';

  try {
    let uploadedImageUrl = '';
    if (productImageFile.value) {
      uploadedImageUrl = await uploadImageIfNeeded();
    }

    if (productModalMode.value === 'create') {
      const form = new FormData();
      form.append('name', productForm.value.name);
      form.append('description', productForm.value.description || '');
      form.append('price', String(productForm.value.price));
      form.append('stock', String(productForm.value.stock));
      form.append('category', productForm.value.category || 'General');
      form.append('merchant', id);
      if (productImageFile.value) {
        form.append('image', productImageFile.value);
      } else if (uploadedImageUrl) {
        form.append('imageUrl', uploadedImageUrl);
      }

      await apiFetch('/api/products', { method: 'POST', body: form });
      message.value = '商品创建成功';
    } else {
      const productId = productForm.value.id;
      if (!productId) throw new Error('缺少商品ID');

      const payload = {
        name: productForm.value.name,
        description: productForm.value.description,
        price: Number(productForm.value.price) || 0,
        stock: Number(productForm.value.stock) || 0,
        category: productForm.value.category || 'General'
      };
      if (uploadedImageUrl) payload.imageUrl = uploadedImageUrl;
      else if (productForm.value.imageUrl) payload.imageUrl = productForm.value.imageUrl;

      await apiFetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      message.value = '商品已更新';
    }

    closeProductModal();
    await reloadAll();
  } catch (e) {
    message.value = e?.message || '保存失败';
  } finally {
    actionLoading.value = false;
  }
}

async function deleteProduct(product) {
  const id = product?._id;
  if (!id) return;
  if (!confirm(`确认删除商品：${product?.name || ''}？`)) return;

  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    message.value = '商品已删除';
    await reloadAll();
  } catch (e) {
    message.value = e?.message || '删除失败';
  } finally {
    actionLoading.value = false;
  }
}

function openShipModal(order) {
  shipForm.value = {
    orderId: order?._id || '',
    carrier: '默认快递',
    trackingNumber: ''
  };
  shipModalOpen.value = true;
}

function closeShipModal() {
  shipModalOpen.value = false;
}

async function confirmShip() {
  const u = user.value;
  const mId = merchantId.value;
  const orderId = shipForm.value.orderId;
  if (!u || !mId || !orderId) return;

  const carrier = shipForm.value.carrier || '默认快递';
  const trackingNumber = shipForm.value.trackingNumber || `T${Date.now()}`;

  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: mId, carrier, trackingNumber })
    });

    message.value = '发货成功';
    closeShipModal();
    await reloadAll();
  } catch (e) {
    message.value = e?.message || '发货失败';
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  window.addEventListener('auth-changed', refreshUser);
  refreshUser();
  reloadAll();
});

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
});
</script>

<style scoped>
.merchant-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.dashboard-header-card {
  margin-bottom: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.shop-title {
  margin: 0;
}

.shop-desc {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}

.shop-meta {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.icon-mr {
  margin-right: 8px;
}

.w-full {
  width: 100%;
}

.link {
  text-decoration: none;
}

.section-card {
  margin-top: 12px;
}

.section-alert {
  margin-top: 12px;
}

.stats-row {
  margin-top: 12px;
}

.stat-card {
  border-radius: 12px;
}

.stat-head {
  margin-bottom: 10px;
}

.stat-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--el-text-color-primary);
}

.stat-value-sm {
  font-size: 18px;
}

.stat-label {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}

.low-stock-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.low-stock-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.section-tabs {
  margin-top: 12px;
}

.thumb {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  overflow: hidden;
}

.p-name {
  font-weight: 700;
}

.p-code {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.table-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.orders-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.order-no {
  font-weight: 800;
}

.order-meta {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
}

.order-right {
  text-align: right;
}

.order-amount {
  font-weight: 800;
  color: var(--el-color-danger);
  margin-bottom: 8px;
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nowrap {
  white-space: nowrap;
}

.image-preview-wrap {
  margin-top: 10px;
}

.image-preview {
  width: 100%;
  max-height: 240px;
}
</style>
