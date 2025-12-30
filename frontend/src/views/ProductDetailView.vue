<template>
  <section>
    <p>
      <RouterLink to="/products" style="text-decoration:none;">
        <el-button>
          <i class="fas fa-arrow-left" style="margin-right: 8px;"></i>
          返回商品列表
        </el-button>
      </RouterLink>
    </p>

    <el-card v-if="loading" class="product-detail-container" shadow="never">
      <el-skeleton :rows="10" animated />
    </el-card>

    <el-card v-else-if="error" class="product-detail-container" shadow="never">
      <el-result icon="error" title="加载商品详情失败" :sub-title="error">
        <template #extra>
          <el-button type="primary" @click="load">重试</el-button>
        </template>
      </el-result>
    </el-card>

    <div v-else-if="product" class="product-detail-container">
      <div class="product-detail-grid">
        <div class="detail-image-container">
          <img
            :src="product.imageUrl || 'https://via.placeholder.com/600x450'"
            :alt="product.name"
            class="detail-image"
            :style="isOutOfStock(product) ? 'filter: grayscale(50%);' : ''"
          />
        </div>

        <div class="detail-info">
          <h1>{{ product.name }}</h1>
          <div class="product-code" style="margin-bottom: 15px;">编号: {{ product.productCode || 'N/A' }}</div>

          <div class="detail-meta">
            <div class="meta-item">
              <i class="fas fa-shopping-bag"></i>
              <span>销量: <strong>{{ product.salesCount || 0 }}</strong></span>
            </div>
            <div class="meta-item">
              <i class="fas fa-box"></i>
              <span :style="`color: ${stockColor(product)}`">{{ stockText(product) }}</span>
            </div>
            <div class="meta-item">
              <i class="fas fa-tag"></i>
              <span>{{ product.category || '—' }}</span>
            </div>
          </div>

          <div class="detail-price">¥{{ formatMoney(product.price) }}</div>

          <div class="detail-description">
            <h3>商品详情</h3>
            <p>{{ product.description || '暂无描述' }}</p>
          </div>

          <el-card class="merchant-card" shadow="never">
            <div style="display:flex; align-items:center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div style="display:flex; align-items:center; gap: 10px;">
                <i class="fas fa-store" style="color: var(--el-color-primary);"></i>
                <strong>商家信息</strong>
              </div>
              <RouterLink v-if="merchantId" :to="`/shops/${merchantId}`" style="text-decoration:none;">
                <el-button size="small">进店逛逛</el-button>
              </RouterLink>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-top: 10px;">
              <div>
                <div style="font-weight: bold; font-size: 1.1em;">{{ displayMerchant.shopName }}</div>
                <div style="color: var(--el-text-color-secondary); font-size: 0.9em; margin-top: 5px;">{{ displayMerchant.shopDescription || '暂无简介' }}</div>
              </div>
            </div>
          </el-card>

          <div class="detail-actions">
            <el-input-number
              v-model="quantity"
              :min="1"
              :max="Math.max(1, Number(product?.stock) || 1)"
              :disabled="isOutOfStock(product)"
            />

            <el-button
              type="primary"
              size="large"
              :disabled="isOutOfStock(product)"
              @click="addToCart"
            >
              <i class="fas fa-shopping-cart" style="margin-right: 8px;"></i>
              {{ isOutOfStock(product) ? '暂时缺货' : '加入购物车' }}
            </el-button>
          </div>
        </div>
      </div>

      <div class="product-reviews-section" id="reviewsSection">
        <el-card shadow="never">
          <div class="reviews-header">
            <div style="display:flex; align-items:center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <h2 style="margin: 0;"><i class="fas fa-star"></i> 商品评价</h2>
              <div v-if="reviewsLoading" style="display:flex; align-items:center; gap: 8px; opacity: 0.85;">
                <i class="fas fa-spinner fa-spin"></i>
                加载中...
              </div>
            </div>

            <div v-if="!reviewsLoading" class="rating-overview">
              <div class="rating-score">
                <span class="score-value">{{ reviewStats.avgRating }}</span>
                <div class="score-stars" v-html="starsHtml(Number(reviewStats.avgRating))"></div>
                <span class="total-reviews">{{ reviewStats.totalCount }} 条评价</span>
              </div>
              <div class="rating-distribution">
                <div
                  v-for="r in [5,4,3,2,1]"
                  :key="r"
                  class="rating-bar-row"
                  @click="setRatingFilter(String(r))"
                >
                  <span class="rating-label">{{ r }}星</span>
                  <div class="rating-bar">
                    <div class="rating-bar-fill" :style="`width: ${ratingPercent(r)}%`"></div>
                  </div>
                  <span class="rating-count">{{ ratingCount(r) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="reviews-filter" style="margin-top: 12px;">
            <div style="display:flex; align-items:center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <el-tabs v-model="ratingTab" @tab-change="noop">
                <el-tab-pane label="全部" name="all" />
                <el-tab-pane label="好评" name="5" />
                <el-tab-pane label="中评" name="3" />
                <el-tab-pane label="差评" name="1" />
              </el-tabs>

              <div style="display:flex; align-items:center; gap: 10px;">
                <span style="opacity: 0.8;">排序：</span>
                <el-select v-model="reviewsSort" style="width: 160px;" @change="onSortChange">
                  <el-option label="最新" value="newest" />
                  <el-option label="评分最高" value="highest" />
                  <el-option label="评分最低" value="lowest" />
                  <el-option label="最有帮助" value="helpful" />
                </el-select>
              </div>
            </div>
          </div>

          <div class="reviews-list" id="reviewsList">
            <el-alert v-if="reviewsError" :title="reviewsError" type="error" show-icon :closable="false" />

            <el-empty
              v-else-if="!reviewsLoading && reviews.length === 0"
              :description="`暂无评价${ratingFilter ? '（符合筛选条件）' : ''}`"
            />

            <div v-else>
              <el-card v-for="r in reviews" :key="r._id" class="review-card" shadow="hover" style="margin-bottom: 12px;">
                <div class="review-header">
                  <div class="reviewer-info">
                    <div class="reviewer-avatar"><i class="fas fa-user"></i></div>
                    <div class="reviewer-details">
                      <span class="reviewer-name">{{ r.userId?.name || '匿名用户' }}</span>
                      <span class="review-date">{{ formatDate(r.createdAt) }}</span>
                    </div>
                  </div>
                  <div class="review-rating">
                    <span v-html="starsHtml(r.rating)"></span>
                    <span class="rating-tag" :class="tagClass(r.tag)">{{ r.tag }}</span>
                  </div>
                </div>

                <div class="review-content">{{ r.content }}</div>

                <div v-if="r.images && r.images.length" class="review-images">
                  <img v-for="img in r.images" :key="img" :src="img" alt="评价图片" @click="viewImage(img)" />
                </div>

                <div v-if="r.merchantReply && r.merchantReply.content" class="merchant-reply">
                  <div class="reply-header"><i class="fas fa-store"></i> 商家回复</div>
                  <div class="reply-content">{{ r.merchantReply.content }}</div>
                </div>

                <div class="review-footer">
                  <el-button size="small" @click="likeReview(r)">
                    <i class="fas fa-thumbs-up" style="margin-right: 8px;"></i>
                    有帮助 ({{ r.likes || 0 }})
                  </el-button>
                </div>
              </el-card>
            </div>
          </div>

          <div class="reviews-pagination" id="reviewsPagination" style="display:flex; justify-content: flex-end;">
            <el-pagination
              v-if="totalReviewPages.length"
              :current-page="reviewPage"
              :page-size="reviewLimit"
              :total="Number(reviewPagination?.total) || 0"
              layout="prev, pager, next"
              @current-change="goToReviewPage"
            />
          </div>
        </el-card>
      </div>

      <div style="margin-top: 16px;">
        <label style="display:flex; gap: 8px; align-items:center;">
          <input type="checkbox" v-model="debug" />
          显示原始 JSON（调试）
        </label>
      </div>
      <pre v-if="debug" style="white-space: pre-wrap; background: #fafafa; padding: 12px; border-radius: 8px;">{{ product }}</pre>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { apiFetch, getCurrentUser } from '../api/http';
import { useCart } from '../stores/cart';

const props = defineProps({
  id: { type: String, required: true }
});

const product = ref(null);
const loading = ref(false);
const error = ref('');
const debug = ref(false);

const quantity = ref(1);

const cart = useCart();

const reviews = ref([]);
const reviewsLoading = ref(false);
const reviewsError = ref('');
const reviewStats = ref({ avgRating: '0.0', totalCount: 0, ratingDistribution: [] });

const reviewPage = ref(1);
const reviewLimit = ref(5);
const reviewsSort = ref('newest');
const ratingFilter = ref('');
const reviewPagination = ref({ total: 0, totalPages: 0, currentPage: 1, limit: 5 });

const ratingTab = computed({
  get() {
    return ratingFilter.value ? String(ratingFilter.value) : 'all';
  },
  set(v) {
    const next = v === 'all' ? '' : String(v);
    if (next === ratingFilter.value) return;
    setRatingFilter(next);
  },
});

function noop() {}

const totalReviewPages = computed(() => {
  const n = Number(reviewPagination.value?.totalPages) || 0;
  return n > 1 ? Array.from({ length: n }, (_, i) => i + 1) : [];
});

const merchantId = computed(() => {
  const m = product.value?.merchantId;
  if (!m) return '';
  if (typeof m === 'string') return m;
  return m._id || m.id || '';
});

const displayMerchant = computed(() => {
  const p = product.value || {};
  const merchantInfo = p?.merchantId && typeof p.merchantId === 'object' ? p.merchantId.merchantInfo : null;
  const supplierInfo = p?.supplierId && typeof p.supplierId === 'object' ? p.supplierId.merchantInfo : null;
  const display = supplierInfo || merchantInfo || { shopName: p.merchant || '官方自营' };
  return {
    shopName: display.shopName || p.merchant || '官方自营',
    shopDescription: display.shopDescription || '',
  };
});

async function load() {
  error.value = '';
  loading.value = true;
  try {
    product.value = await apiFetch(`/api/products/${encodeURIComponent(props.id)}`);
    // 记录浏览行为（忽略失败）
    apiFetch(`/api/products/${encodeURIComponent(props.id)}/view`, { method: 'POST' }).catch(() => {});
    quantity.value = 1;
  } catch (e) {
    error.value = e?.message || '加载失败';
    product.value = null;
  } finally {
    loading.value = false;
  }
}

function isOutOfStock(p) {
  return (Number(p?.stock) || 0) <= 0;
}

function stockText(p) {
  const stock = Number(p?.stock) || 0;
  if (stock <= 0) return '缺货';
  if (stock < 10) return `仅剩 ${stock} 件`;
  return '库存充足';
}

function stockColor(p) {
  const stock = Number(p?.stock) || 0;
  if (stock <= 0) return 'var(--el-color-danger)';
  if (stock < 10) return 'var(--el-color-warning)';
  return 'var(--el-color-success)';
}

function adjustQuantity(delta) {
  const stock = Number(product.value?.stock) || 0;
  let next = Number(quantity.value) + delta;
  if (!Number.isFinite(next)) next = 1;
  if (next < 1) next = 1;
  if (stock > 0 && next > stock) {
    window.alert('已达到最大库存限制');
    next = stock;
  }
  quantity.value = next;
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function addToCart() {
  if (!product.value) return;
  if (isOutOfStock(product.value)) return;
  cart.addProduct(product.value, Number(quantity.value) || 1);
  cart.open();
}

async function loadReviews() {
  reviewsLoading.value = true;
  reviewsError.value = '';
  try {
    const params = new URLSearchParams({
      page: String(reviewPage.value),
      limit: String(reviewLimit.value),
      sort: reviewsSort.value,
    });
    if (ratingFilter.value) params.append('rating', ratingFilter.value);

    const data = await apiFetch(`/api/reviews/product/${encodeURIComponent(props.id)}?${params}`);
    reviews.value = data.reviews || [];
    reviewStats.value = data.stats || { avgRating: '0.0', totalCount: 0, ratingDistribution: [] };
    reviewPagination.value = data.pagination || { total: 0, totalPages: 0, currentPage: 1, limit: reviewLimit.value };
  } catch (e) {
    reviewsError.value = e?.message || '加载失败';
    reviews.value = [];
    reviewStats.value = { avgRating: '0.0', totalCount: 0, ratingDistribution: [] };
    reviewPagination.value = { total: 0, totalPages: 0, currentPage: 1, limit: reviewLimit.value };
  } finally {
    reviewsLoading.value = false;
  }
}

function ratingCount(rating) {
  const dist = Array.isArray(reviewStats.value?.ratingDistribution) ? reviewStats.value.ratingDistribution : [];
  const hit = dist.find((d) => Number(d?._id) === Number(rating));
  return hit ? Number(hit.count) || 0 : 0;
}

function ratingPercent(rating) {
  const total = Number(reviewStats.value?.totalCount) || 0;
  if (total <= 0) return 0;
  return Math.round((ratingCount(rating) / total) * 100);
}

function starsHtml(rating) {
  const r = Number(rating);
  const v = Number.isFinite(r) ? r : 0;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(v)) {
      html += '<i class="fas fa-star" style="color: var(--el-color-warning);"></i>';
    } else if (i - 0.5 <= v) {
      html += '<i class="fas fa-star-half-alt" style="color: var(--el-color-warning);"></i>';
    } else {
      html += '<i class="far fa-star" style="color: var(--el-border-color-lighter);"></i>';
    }
  }
  return html;
}

function setRatingFilter(value) {
  ratingFilter.value = value;
  reviewPage.value = 1;
  loadReviews();
}

function onSortChange() {
  reviewPage.value = 1;
  loadReviews();
}

function goToReviewPage(p) {
  reviewPage.value = p;
  loadReviews();
}

function tagClass(tag) {
  if (tag === '好评') return 'tag-good';
  if (tag === '中评') return 'tag-medium';
  return 'tag-bad';
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('zh-CN');
  } catch {
    return '';
  }
}

function viewImage(src) {
  if (!src) return;
  window.open(src, '_blank');
}

async function likeReview(review) {
  const currentUser = getCurrentUser() || {};
  const userId = currentUser.id || currentUser._id;
  if (!userId) {
    window.alert('请先登录后再点赞');
    return;
  }

  try {
    await apiFetch(`/api/reviews/${encodeURIComponent(review._id)}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    loadReviews();
  } catch (e) {
    window.alert(e?.message || '操作失败');
  }
}

onMounted(() => {
  load();
  loadReviews();
});

watch(
  () => props.id,
  () => {
    load();
    loadReviews();
  }
);
</script>
