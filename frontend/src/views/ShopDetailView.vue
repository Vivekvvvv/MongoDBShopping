<template>
  <section>
    <div style="margin: 20px 0;">
      <RouterLink to="/shops" style="text-decoration:none;">
        <el-button>
          ← 返回店铺列表
        </el-button>
      </RouterLink>
    </div>

    <el-card v-if="loading" shadow="never">
      <el-skeleton :rows="6" animated />
    </el-card>
    <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" />

    <template v-else>
      <el-card v-if="merchant" shadow="never" style="margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap;">
          <div
            style="width: 72px; height: 72px; background: var(--el-fill-color-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.2em; color: var(--el-color-primary);"
          >
            <i class="fas fa-store"></i>
          </div>
          <div style="flex: 1; min-width: 220px;">
            <h1 style="margin: 0 0 8px 0;">{{ shopName }}</h1>
            <p style="margin: 0 0 10px 0; color: var(--el-text-color-secondary);">
              {{ merchant.merchantInfo?.shopDescription || '暂无介绍' }}
            </p>
            <div style="display: flex; gap: 16px; font-size: 0.92em; flex-wrap: wrap;">
              <span style="color: var(--el-color-warning);">
                <i class="fas fa-star"></i> {{ formatRating(merchant?.merchantInfo?.rating) }}
              </span>
              <span style="color: var(--el-color-success);">
                <i class="fas fa-shopping-bag"></i> 销量: {{ merchant?.merchantInfo?.totalSales || 0 }}
              </span>
              <span style="color: var(--el-color-primary);">
                <i class="fas fa-phone"></i> {{ merchant?.merchantInfo?.contactPhone || '—' }}
              </span>
            </div>
          </div>
        </div>
      </el-card>

      <el-divider content-position="left">店铺商品</el-divider>

      <el-card v-if="productsLoading" shadow="never">
        <el-skeleton :rows="8" animated />
      </el-card>
      <el-alert v-else-if="productsError" :title="productsError" type="error" show-icon :closable="false" />

      <div v-else class="product-grid">
        <el-card v-for="p in products" :key="p._id" class="product-card" shadow="hover" style="position: relative;" :body-style="{ padding: '0px' }">
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

      <el-empty v-if="!productsLoading && !productsError && products.length === 0" description="该店铺暂无商品" />
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { apiFetch } from '../api/http';
import { useCart } from '../stores/cart';

const props = defineProps({
  id: { type: String, required: true }
});

const merchant = ref(null);
const loading = ref(false);
const error = ref('');

const products = ref([]);
const productsLoading = ref(false);
const productsError = ref('');

const cart = useCart();

const shopName = computed(() => {
  if (!merchant.value) return '';
  return merchant.value?.merchantInfo?.shopName || merchant.value?.name || merchant.value?.email || '店铺';
});

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
    merchant.value = await apiFetch(`/api/merchants/${encodeURIComponent(props.id)}`);
  } catch (e) {
    error.value = e?.message || '加载失败';
    merchant.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadProducts() {
  productsLoading.value = true;
  productsError.value = '';
  try {
    products.value = await apiFetch(`/api/products/merchant/${encodeURIComponent(props.id)}`);
  } catch (e) {
    productsError.value = e?.message || '加载失败';
    products.value = [];
  } finally {
    productsLoading.value = false;
  }
}

onMounted(() => {
  load();
  loadProducts();
});
</script>
