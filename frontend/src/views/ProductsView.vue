<template>
  <section>
    <el-row align="middle" justify="space-between" style="gap: 12px; margin-bottom: 12px;">
      <h2 style="margin: 0;">全部商品</h2>

      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <span style="opacity: 0.8;">排序方式：</span>
        <el-select v-model="sortBy" style="width: 180px;" :disabled="loading" @change="noop">
          <el-option label="最新上架" value="createdAt" />
          <el-option label="销量最高" value="salesCount" />
          <el-option label="价格从低到高" value="priceAsc" />
          <el-option label="价格从高到低" value="priceDesc" />
          <el-option label="库存最多" value="stock" />
        </el-select>

        <el-button type="primary" :loading="loading" @click="load">
          <i class="fas fa-sync-alt" style="margin-right: 8px;"></i>
          刷新商品
        </el-button>
      </div>
    </el-row>

    <el-card v-if="loading" shadow="never">
      <el-skeleton :rows="8" animated />
    </el-card>

    <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" />

    <div v-else class="product-grid">
      <el-card
        v-for="p in sortedProducts"
        :key="p._id"
        class="product-card"
        shadow="hover"
        style="position: relative;"
        :body-style="{ padding: '0px' }"
      >
        <div v-if="isOutOfStock(p)" class="out-of-stock-overlay"><span>缺货</span></div>

        <RouterLink :to="`/products/${p._id}`" style="display:block;">
          <img
            :src="p.imageUrl || 'https://via.placeholder.com/280x200'"
            :alt="p.name"
            class="product-image"
            :style="isOutOfStock(p) ? 'filter: grayscale(50%);' : ''"
          />
        </RouterLink>

        <div class="product-info">
          <RouterLink :to="`/products/${p._id}`" style="text-decoration:none; color:inherit;">
            <h3 class="product-title" :style="isOutOfStock(p) ? 'color: var(--el-text-color-secondary);' : ''">{{ p.name }}</h3>
          </RouterLink>

          <p class="product-description" :style="isOutOfStock(p) ? 'color: var(--el-text-color-placeholder);' : ''">{{ p.description }}</p>

          <div class="merchant-info">
            <div style="display:flex; align-items:center; justify-content: space-between; gap: 10px;">
              <span style="opacity: 0.9; font-size: 0.9em;">
                <i class="fas fa-store"></i>
                <RouterLink
                  v-if="merchantIdOf(p)"
                  :to="`/shops/${merchantIdOf(p)}`"
                  style="text-decoration:none; font-weight: bold; margin-left: 6px;"
                >
                  {{ shopNameOf(p) }}
                </RouterLink>
                <span v-else style="margin-left: 6px; font-weight: bold;">{{ shopNameOf(p) }}</span>
              </span>

              <span style="white-space: nowrap; opacity: 0.9; font-size: 0.9em;">
                <i class="fas fa-star" style="color: var(--el-color-warning);"></i>
                {{ formatRating(ratingOf(p)) }}
              </span>
            </div>
          </div>

          <div class="product-stats">
            <span style="color: var(--el-color-success);">
              <i class="fas fa-shopping-cart"></i> 销量: {{ p.salesCount || 0 }}
            </span>
            <span :class="{ 'low-stock-warning': isLowStock(p) }" :style="stockStyle(p)">
              <i :class="stockIcon(p)"></i> 库存: {{ p.stock || 0 }}
            </span>
          </div>

          <div class="product-code">编号: {{ p.productCode || 'N/A' }}</div>

          <div class="product-footer">
            <span class="product-price" :style="isOutOfStock(p) ? 'color: var(--el-text-color-secondary); text-decoration: line-through;' : ''">¥{{ formatPrice(p.price) }}</span>
            <el-button
              type="primary"
              size="small"
              :disabled="isOutOfStock(p)"
              :title="stockText(p)"
              @click="addToCart(p)"
            >
              {{ isOutOfStock(p) ? '缺货' : (isLowStock(p) ? '抢购' : '加入购物车') }}
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <el-empty v-if="!loading && !error && sortedProducts.length === 0" description="暂无商品" />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { apiFetch } from '../api/http';
import { useCart } from '../stores/cart';

const cart = useCart();

const productsRaw = ref([]);
const loading = ref(false);
const error = ref('');
const sortBy = ref('createdAt');

const route = useRoute();

function noop() {}

function merchantIdOf(product) {
  const m = product?.merchantId;
  if (!m) return '';
  if (typeof m === 'string') return m;
  return m._id || m.id || '';
}

function shopNameOf(product) {
  const m = product?.merchantId;
  if (m && typeof m === 'object') {
    return m?.merchantInfo?.shopName || m?.name || m?.email || product?.merchant || '店铺';
  }
  return product?.merchant || '店铺';
}

function ratingOf(product) {
  const m = product?.merchantId;
  const r = (m && typeof m === 'object') ? m?.merchantInfo?.rating : undefined;
  return Number.isFinite(Number(r)) ? Number(r) : 5;
}

function formatRating(rating) {
  const r = Number(rating);
  if (!Number.isFinite(r)) return '5.0';
  return r.toFixed(1);
}

function formatPrice(price) {
  const p = Number(price);
  if (!Number.isFinite(p)) return '0.00';
  return p.toFixed(2);
}

function isOutOfStock(product) {
  return (Number(product?.stock) || 0) <= 0;
}

function isLowStock(product) {
  const stock = Number(product?.stock) || 0;
  return stock > 0 && stock < 10;
}

function stockText(product) {
  const stock = Number(product?.stock) || 0;
  if (stock <= 0) return '商品缺货';
  if (stock < 10) return `仅剩 ${stock} 件`;
  return '库存充足';
}

function stockIcon(product) {
  const stock = Number(product?.stock) || 0;
  if (stock <= 0) return 'fas fa-times-circle';
  if (stock < 10) return 'fas fa-exclamation-triangle';
  return 'fas fa-check-circle';
}

function stockStyle(product) {
  const stock = Number(product?.stock) || 0;
  if (stock <= 0) return 'color: var(--el-color-danger); font-weight: bold;';
  if (stock < 10) return 'color: var(--el-color-warning); font-weight: bold;';
  return 'color: var(--el-color-success);';
}

async function load() {
  error.value = '';
  loading.value = true;
  try {
    const q = (route.query.q || '').toString().trim();
    const category = (route.query.category || '').toString().trim();

    let list;
    if (q) {
      list = await apiFetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      if (category) {
        list = (Array.isArray(list) ? list : []).filter((p) => (p?.category || '').toString() === category);
      }
    } else if (category) {
      list = await apiFetch(`/api/products/category/${encodeURIComponent(category)}`);
    } else {
      list = await apiFetch('/api/products');
    }

    productsRaw.value = Array.isArray(list) ? list : [];
  } catch (e) {
    error.value = e?.message || '加载失败';
    productsRaw.value = [];
  } finally {
    loading.value = false;
  }
}

function addToCart(product) {
  if (isOutOfStock(product)) return;
  cart.addProduct(product, 1);
  cart.open();
}

const sortedProducts = computed(() => {
  const list = Array.isArray(productsRaw.value) ? [...productsRaw.value] : [];
  const key = sortBy.value;

  if (key === 'salesCount') {
    list.sort((a, b) => (Number(b?.salesCount) || 0) - (Number(a?.salesCount) || 0));
    return list;
  }
  if (key === 'priceAsc') {
    list.sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));
    return list;
  }
  if (key === 'priceDesc') {
    list.sort((a, b) => (Number(b?.price) || 0) - (Number(a?.price) || 0));
    return list;
  }
  if (key === 'stock') {
    list.sort((a, b) => (Number(b?.stock) || 0) - (Number(a?.stock) || 0));
    return list;
  }

  // 默认：最新上架
  list.sort((a, b) => {
    const at = new Date(a?.createdAt || 0).getTime();
    const bt = new Date(b?.createdAt || 0).getTime();
    return bt - at;
  });
  return list;
});

onMounted(() => {
  load();
});

watch(
  () => route.query,
  () => {
    load();
  },
  { deep: true }
);
</script>
