<template>
  <section>
    <el-card shadow="never" style="margin: 18px 0;">
      <div style="text-align:center;">
        <h2 style="margin: 0 0 8px 0;">智能推荐商品</h2>
        <p style="margin: 0; color: var(--el-text-color-secondary);">基于您的浏览偏好为您定制的专属推荐</p>
      </div>
    </el-card>

    <el-card v-if="loading" shadow="never">
      <el-skeleton :rows="8" animated />
    </el-card>

    <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" />

    <div v-else class="product-grid">
      <el-card
        v-for="p in products"
        :key="p._id"
        class="product-card recommended"
        shadow="hover"
        style="position: relative;"
        :body-style="{ padding: '0px' }"
      >
        <div class="recommended-badge"><i class="fas fa-star"></i> 推荐</div>
        <div v-if="isOutOfStock(p)" class="out-of-stock-overlay"><span>缺货</span></div>

        <RouterLink :to="`/products/${p._id}`" style="display:block;">
          <img
            :src="p.imageUrl || 'https://via.placeholder.com/150'"
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

    <el-empty v-if="!loading && !error && products.length === 0" description="暂无推荐" />
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiFetch } from '../api/http';
import { useCart } from '../stores/cart';

const cart = useCart();

const products = ref([]);
const loading = ref(false);
const error = ref('');

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

function addToCart(product) {
  if (isOutOfStock(product)) return;
  cart.addProduct(product, 1);
  cart.open();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    products.value = await apiFetch('/api/products/recommended');
  } catch (e) {
    error.value = e?.message || '加载失败';
    products.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
