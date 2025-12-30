<template>
  <section class="orders-management">
    <el-row class="orders-header orders-header-row" align="middle" justify="space-between">
      <h2 class="page-title">我的订单</h2>
    </el-row>

    <el-result
      v-if="!user"
      icon="warning"
      title="你还未登录"
      sub-title="登录后可查看和管理订单"
    >
      <template #extra>
        <RouterLink to="/login" style="text-decoration:none;">
          <el-button type="primary">去登录</el-button>
        </RouterLink>
      </template>
    </el-result>

    <template v-else>
      <el-tabs v-model="currentFilter" @tab-change="setFilter">
        <el-tab-pane v-for="t in statusTabs" :key="t.key" :label="t.label" :name="t.key" />
      </el-tabs>

      <el-card v-if="loading" shadow="never">
        <el-skeleton :rows="10" animated />
      </el-card>

      <el-card v-else-if="error" shadow="never">
        <el-result icon="error" title="加载失败" :sub-title="error">
          <template #extra>
            <el-button type="primary" :loading="loading" @click="loadOrders()">
              <i class="fas fa-redo icon-mr"></i>
              重试
            </el-button>
          </template>
        </el-result>
      </el-card>

      <div v-else>
        <div v-if="orders.length === 0">
          <el-empty :description="currentFilter === 'all' ? '您还没有任何订单' : `暂无${currentFilter}的订单`">
            <RouterLink to="/" style="text-decoration:none;">
              <el-button type="primary">
                <i class="fas fa-shopping-cart icon-mr"></i>
                去购物
              </el-button>
            </RouterLink>
          </el-empty>
        </div>

        <div v-else>
          <el-card v-for="o in orders" :key="o._id" class="order-card" shadow="hover">
            <div class="order-header">
              <div>
                <div class="order-number">订单号: {{ o.orderNumber || o._id }}</div>
                <div class="order-date">{{ formatDateTime(o.createdAt) }}</div>
              </div>
              <div class="order-status" :class="getStatusClass(o.status)">{{ o.status }}</div>
            </div>

            <div class="order-content">
              <div class="order-items">
                <div v-for="(it, idx) in (o.items || [])" :key="it._id || it.productId?._id || idx" class="order-item">
                  <img :src="it.imageUrl || it.productId?.imageUrl || fallbackImg" :alt="it.name || it.productId?.name || '商品'" class="item-image">
                  <div class="item-info">
                    <div class="item-name">{{ it.name || it.productId?.name || '未命名商品' }}</div>
                    <div class="item-merchant">{{ it.merchant || it.merchantId?.name || '官方' }}</div>
                    <div class="item-price-quantity">
                      <span class="item-price">¥{{ Number(it.price || 0).toFixed(2) }}</span>
                      <span class="item-quantity">x {{ it.quantity }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="o.shippingAddress" class="order-shipping">
                <div class="shipping-title">
                  <i class="fas fa-map-marker-alt"></i> 收货地址
                </div>
                <div class="shipping-info">
                  {{ o.shippingAddress.name }} {{ o.shippingAddress.phone }}<br>
                  {{ o.shippingAddress.province }} {{ o.shippingAddress.city }} {{ o.shippingAddress.district }} {{ o.shippingAddress.detail }}
                </div>
              </div>

              <div class="order-summary">
                <div class="order-total">
                  共 {{ getOrderItemCount(o) }} 件商品
                  <span class="total-amount">合计: ¥{{ Number(o.total || 0).toFixed(2) }}</span>
                </div>
                <div class="order-actions">
                  <el-button plain type="primary" size="small" @click="openDetail(o._id)" :disabled="actionLoading">
                    <i class="fas fa-eye icon-mr"></i>
                    查看详情
                  </el-button>
                  <template v-for="a in getActions(o)" :key="a.key">
                    <el-button
                      :type="actionType(a)"
                      :plain="actionPlain(a)"
                      size="small"
                      :disabled="actionLoading"
                      @click="a.onClick(o)"
                    >
                        <i :class="a.icon" class="icon-mr"></i>
                      {{ a.label }}
                    </el-button>
                  </template>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>

        <el-alert v-if="message" :title="message" type="info" show-icon :closable="false" class="message-alert" />

      <el-dialog
        v-model="detailOpen"
        title="订单详情"
        width="900"
        :close-on-click-modal="false"
        @close="closeDetail"
      >
        <div class="order-detail-body">
          <el-skeleton v-if="detailLoading" :rows="10" animated />
          <el-result v-else-if="detailError" icon="error" title="加载失败" :sub-title="detailError">
            <template #extra>
              <el-button type="primary" :loading="detailLoading" @click="reloadDetail">
                <i class="fas fa-redo icon-mr"></i>
                重试
              </el-button>
            </template>
          </el-result>
          <div v-else-if="detailOrder">
              <div class="detail-section">
                <div class="detail-title"><i class="fas fa-info-circle"></i> 订单信息</div>
                <div class="detail-content">
                  <div class="detail-grid">
                    <div><strong>订单编号:</strong> {{ detailOrder.orderNumber || detailOrder._id }}</div>
                    <div><strong>下单时间:</strong> {{ formatDateTime(detailOrder.createdAt) }}</div>
                    <div>
                      <strong>订单状态:</strong>
                      <span class="order-status" :class="getStatusClass(detailOrder.status)">{{ detailOrder.status }}</span>
                    </div>
                    <div><strong>支付方式:</strong> {{ detailOrder.paymentInfo?.method || '未选择' }}</div>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <div class="detail-title"><i class="fas fa-box"></i> 商品信息</div>
                <div class="detail-content">
                  <div
                    v-for="(it, idx) in (detailOrder.items || [])"
                    :key="it._id || it.productId?._id || idx"
                    class="detail-item-row"
                    :style="{ borderBottom: idx < (detailOrder.items || []).length - 1 ? '1px solid var(--el-border-color-lighter)' : 'none' }"
                  >
                    <img :src="it.imageUrl || it.productId?.imageUrl || fallbackImg" :alt="it.name || it.productId?.name || '商品'" class="detail-item-image">
                    <div style="flex: 1;">
                      <div class="detail-item-name">{{ it.name || it.productId?.name || '未命名商品' }}</div>
                      <div class="detail-item-merchant">{{ it.merchant || it.merchantId?.name || '官方' }}</div>
                      <div class="detail-item-price">¥{{ Number(it.price || 0).toFixed(2) }} x {{ it.quantity }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="detailOrder.shippingAddress" class="detail-section">
                <div class="detail-title"><i class="fas fa-map-marker-alt"></i> 收货信息</div>
                <div class="detail-content">
                  <div><strong>收货人:</strong> {{ detailOrder.shippingAddress.name }} {{ detailOrder.shippingAddress.phone }}</div>
                  <div>
                    <strong>收货地址:</strong>
                    {{ detailOrder.shippingAddress.province }} {{ detailOrder.shippingAddress.city }} {{ detailOrder.shippingAddress.district }} {{ detailOrder.shippingAddress.detail }}
                  </div>
                </div>
              </div>

              <div v-if="detailLogistics" class="detail-section">
                <div class="detail-title"><i class="fas fa-truck"></i> 物流信息</div>
                <div class="detail-content">
                  <div class="logistics-meta">
                    <div><strong>承运公司:</strong> {{ detailLogistics.carrier || '未知' }}</div>
                    <div><strong>当前状态:</strong> {{ detailLogistics.status || '未知' }}</div>
                    <div v-if="detailLogistics.trackingNumber"><strong>运单号:</strong> {{ detailLogistics.trackingNumber }}</div>
                    <div v-if="detailLogistics.estimatedDelivery"><strong>预计送达:</strong> {{ formatDateTime(detailLogistics.estimatedDelivery) }}</div>
                  </div>

                  <div v-if="Array.isArray(detailLogistics.traces) && detailLogistics.traces.length" class="logistics-traces">
                    <div v-for="(tr, idx) in detailLogistics.traces" :key="idx" class="trace-row">
                      <div class="trace-time">{{ formatDateTime(tr.time) }}</div>
                      <div class="trace-desc">{{ tr.desc || tr.description || '' }}</div>
                    </div>
                  </div>
                  <div v-else class="muted">暂无物流轨迹</div>
                </div>
              </div>

              <div v-if="detailOrder.remarks" class="detail-section">
                <div class="detail-title"><i class="fas fa-comment"></i> 订单备注</div>
                <div class="detail-content">{{ detailOrder.remarks }}</div>
              </div>

              <div class="detail-section">
                <div class="detail-title"><i class="fas fa-calculator"></i> 费用明细</div>
                <div class="detail-content">
                  <div class="detail-fee">
                    <div class="fee-row"><span>商品总价:</span><span>¥{{ Number(detailOrder.total || 0).toFixed(2) }}</span></div>
                    <div class="fee-row"><span>运费:</span><span>¥0.00</span></div>
                    <div class="fee-row fee-total"><span>实付金额:</span><span class="fee-total-amount">¥{{ Number(detailOrder.total || 0).toFixed(2) }}</span></div>
                  </div>
                </div>
              </div>

              <div class="detail-actions">
                <el-button plain type="primary" size="small" @click="reloadDetail" :disabled="actionLoading">
                  <i class="fas fa-redo icon-mr"></i>
                  刷新
                </el-button>
                <template v-for="a in getActions(detailOrder)" :key="a.key">
                  <el-button
                    :type="actionType(a)"
                    :plain="actionPlain(a)"
                    size="small"
                    :disabled="actionLoading"
                    @click="a.onClick(detailOrder)"
                  >
                    <i :class="a.icon" class="icon-mr"></i>
                    {{ a.label }}
                  </el-button>
                </template>
              </div>
          </div>
        </div>
      </el-dialog>
    </template>
  </section>

  <el-dialog
    v-model="reviewOpen"
    title="商品评价"
    width="900"
    :close-on-click-modal="false"
    @close="closeReviewModal"
  >
    <div class="review-modal-body">
        <div v-if="reviewLoading" class="review-loading-state">
          <i class="fas fa-spinner fa-spin"></i> 正在检查评价状态...
        </div>

        <div v-if="reviewError" class="error-message review-error-pad">
          <i class="fas fa-exclamation-triangle"></i>
          {{ reviewError }}
        </div>

        <div id="reviewItemsList">
          <div
            v-for="(it, idx) in reviewItems"
            :key="getReviewItemKey(it, idx)"
            class="review-item"
          >
            <div class="review-item-header">
              <img :src="it.imageUrl || it.productId?.imageUrl || fallbackImg" :alt="it.name || it.productId?.name || '商品'">
              <div class="review-item-info">
                <div class="item-name">{{ it.name || it.productId?.name || '未命名商品' }}</div>
                <div class="item-price">¥{{ Number(it.price || 0).toFixed(2) }} x {{ it.quantity }}</div>
              </div>
              <div class="reviewed-badge" v-if="reviewedMap[getItemProductId(it)]">
                <i class="fas fa-check-circle"></i> 已评价
              </div>
            </div>

            <div class="review-form" v-if="!reviewedMap[getItemProductId(it)]">
              <div class="rating-select">
                <span class="rating-label">评分：</span>
                <div class="stars">
                  <i
                    v-for="star in 5"
                    :key="star"
                    class="fas fa-star star-icon"
                    :class="{ active: (ratings[getItemProductId(it)] || 0) >= star }"
                    role="button"
                    tabindex="0"
                    @click="setRating(it, star)"
                    @keydown.enter.prevent="setRating(it, star)"
                  ></i>
                </div>
                <span class="rating-text">{{ getRatingText(ratings[getItemProductId(it)] || 0) }}</span>
              </div>

              <el-input
                type="textarea"
                :rows="4"
                :model-value="contents[getItemProductId(it)] || ''"
                placeholder="分享您对这个商品的使用体验吧~（至少5个字）"
                maxlength="500"
                show-word-limit
                @update:model-value="(v) => onContentInput(it, { target: { value: v } })"
              />

              <div class="review-options">
                <el-checkbox
                  :model-value="anonymous[getItemProductId(it)] || false"
                  @update:model-value="(v) => onAnonymousChange(it, { target: { checked: v } })"
                >
                  匿名评价
                </el-checkbox>
                <span class="char-count">{{ (contents[getItemProductId(it)] || '').length }}/500</span>
              </div>

              <el-button
                type="primary"
                class="w-full"
                :loading="submitLoading"
                @click="submitReview(it)"
              >
                <i class="fas fa-paper-plane icon-mr"></i>
                提交评价
              </el-button>
            </div>
          </div>
        </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch, getCurrentUser } from '../api/http';
import { useCart } from '../stores/cart';

const router = useRouter();
const cart = useCart();

const userRef = ref(getCurrentUser());
const user = computed(() => userRef.value);

const orders = ref([]);
const loading = ref(false);
const error = ref('');
const message = ref('');

const actionLoading = ref(false);

const fallbackImg = 'https://via.placeholder.com/60';

const statusTabs = [
  { key: 'all', label: '全部' },
  { key: '待支付', label: '待支付' },
  { key: '已支付', label: '已支付' },
  { key: '发货中', label: '发货中' },
  { key: '已完成', label: '已完成' },
  { key: '已取消', label: '已取消' },
  { key: '已退款', label: '已退款' },
];

const currentFilter = ref('all');

const detailOpen = ref(false);
const detailOrderId = ref('');
const detailLoading = ref(false);
const detailError = ref('');
const detailOrder = ref(null);
const detailLogistics = ref(null);

const reviewOpen = ref(false);
const reviewLoading = ref(false);
const reviewError = ref('');
const submitLoading = ref(false);
const reviewOrderId = ref('');
const reviewItems = ref([]);
const reviewedMap = ref({});
const ratings = ref({});
const contents = ref({});
const anonymous = ref({});

function actionType(action) {
  const c = String(action?.className || '');
  if (c.includes('btn-danger')) return 'danger';
  if (c.includes('btn-warning')) return 'warning';
  if (c.includes('btn-success')) return 'success';
  if (c.includes('btn-primary')) return 'primary';
  if (c.includes('btn-secondary')) return 'info';
  return '';
}

function actionPlain(action) {
  const c = String(action?.className || '');
  return c.includes('btn-outline');
}

function formatDateTime(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClass(status) {
  const s = String(status || '');
  if (!s) return '';
  return `status-${s
    .replace('待', 'pending')
    .replace('已支付', 'paid')
    .replace('发货中', 'shipping')
    .replace('已完成', 'completed')
    .replace('已取消', 'cancelled')
    .replace('已退款', 'refunded')}`;
}

function getOrderItemCount(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
}

function getItemProductId(item) {
  return item?.productId?._id || item?.productId?.id || item?.productId || item?._id || item?.id || '';
}

function getReviewItemKey(item, idx) {
  return `${reviewOrderId.value || ''}-${getItemProductId(item) || idx}`;
}

function getRatingText(rating) {
  const r = Number(rating) || 0;
  if (!r) return '点击评分';
  const texts = ['很差', '较差', '一般', '满意', '非常满意'];
  return texts[r - 1] || '点击评分';
}

async function loadOrders(statusOverride) {
  const u = user.value;
  if (!u || !u._id) return;

  loading.value = true;
  error.value = '';
  try {
    const status = typeof statusOverride === 'string' ? statusOverride : currentFilter.value;
    const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    const data = await apiFetch(`/api/orders/user/${encodeURIComponent(u._id)}${qs}`);
    orders.value = data.orders || [];
  } catch (e) {
    error.value = e?.message || '加载失败';
    orders.value = [];
  } finally {
    loading.value = false;
  }
}

function setFilter(next) {
  const key = typeof next === 'string' ? next : String(next?.props?.name || next || 'all');
  currentFilter.value = key;
  loadOrders(key);
}

async function loadDetail(orderId) {
  detailLoading.value = true;
  detailError.value = '';
  try {
    const data = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}`);
    detailOrder.value = data?.order || null;
    detailLogistics.value = data?.logistics || null;
  } catch (e) {
    detailOrder.value = null;
    detailLogistics.value = null;
    detailError.value = e?.message || '加载失败';
  } finally {
    detailLoading.value = false;
  }
}

async function openDetail(orderId) {
  detailOrderId.value = orderId;
  detailOpen.value = true;
  await loadDetail(orderId);
}

function closeDetail() {
  detailOpen.value = false;
  detailOrderId.value = '';
  detailError.value = '';
  detailOrder.value = null;
  detailLogistics.value = null;
}

function onOverlayClick(e) {
  if (e?.target?.id === 'orderDetailModal') closeDetail();
}

function reloadDetail() {
  if (!detailOrderId.value) return;
  loadDetail(detailOrderId.value);
}

async function openReviewModal(order) {
  const u = user.value;
  if (!u || !u._id) {
    message.value = '请先登录再评价';
    return;
  }

  const orderId = order?._id;
  if (!orderId) return;

  reviewError.value = '';
  reviewLoading.value = true;
  submitLoading.value = false;
  reviewOrderId.value = orderId;
  reviewItems.value = Array.isArray(order?.items) ? order.items : [];
  reviewOpen.value = true;

  reviewedMap.value = {};
  ratings.value = {};
  contents.value = {};
  anonymous.value = {};

  try {
    const userId = u._id;
    const checks = await Promise.all(
      reviewItems.value.map(async (it) => {
        const productId = getItemProductId(it);
        if (!productId) return { productId, reviewed: false };
        const data = await apiFetch(
          `/api/reviews/check/${encodeURIComponent(orderId)}/${encodeURIComponent(productId)}?userId=${encodeURIComponent(userId)}`
        );
        return { productId, reviewed: !!data?.reviewed };
      })
    );

    const nextReviewed = {};
    for (const r of checks) {
      if (!r?.productId) continue;
      nextReviewed[r.productId] = !!r.reviewed;
    }
    reviewedMap.value = nextReviewed;
  } catch (e) {
    reviewError.value = e?.message || '检查评价状态失败';
  } finally {
    reviewLoading.value = false;
  }
}

function closeReviewModal() {
  reviewOpen.value = false;
  reviewLoading.value = false;
  reviewError.value = '';
  submitLoading.value = false;
  reviewOrderId.value = '';
  reviewItems.value = [];
  reviewedMap.value = {};
  ratings.value = {};
  contents.value = {};
  anonymous.value = {};
}

function onReviewOverlayClick() {
  closeReviewModal();
}

function setRating(item, rating) {
  const pid = getItemProductId(item);
  if (!pid) return;
  ratings.value = { ...ratings.value, [pid]: rating };
}

function onContentInput(item, evt) {
  const pid = getItemProductId(item);
  if (!pid) return;
  const next = evt?.target?.value ?? '';
  contents.value = { ...contents.value, [pid]: next };
}

function onAnonymousChange(item, evt) {
  const pid = getItemProductId(item);
  if (!pid) return;
  const checked = !!evt?.target?.checked;
  anonymous.value = { ...anonymous.value, [pid]: checked };
}

async function submitReview(item) {
  const u = user.value;
  if (!u || !u._id) {
    message.value = '请先登录再评价';
    return;
  }

  const orderId = reviewOrderId.value;
  const productId = getItemProductId(item);
  if (!orderId || !productId) return;

  const rating = Number(ratings.value[productId] || 0);
  const content = String(contents.value[productId] || '').trim();
  const isAnonymous = !!anonymous.value[productId];

  if (!rating) {
    message.value = '请选择评分';
    return;
  }
  if (content.length < 5) {
    message.value = '评价内容至少需要5个字';
    return;
  }

  submitLoading.value = true;
  message.value = '';
  try {
    await apiFetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        productId,
        userId: u._id,
        rating,
        content,
        isAnonymous,
      }),
    });

    reviewedMap.value = { ...reviewedMap.value, [productId]: true };
    message.value = '评价成功！感谢您的反馈';
  } catch (e) {
    message.value = e?.message || '评价失败';
  } finally {
    submitLoading.value = false;
  }
}

async function afterMutation(orderId) {
  await loadOrders();
  if (detailOpen.value && detailOrderId.value && detailOrderId.value === orderId) {
    await loadDetail(orderId);
  }
}

async function pay(orderId) {
  if (!window.confirm('确认要支付这个订单吗？')) return;
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/pay`, { method: 'POST' });
    message.value = '支付成功';
    await afterMutation(orderId);
  } catch (e) {
    message.value = e?.message || '支付失败';
  } finally {
    actionLoading.value = false;
  }
}

async function cancel(orderId) {
  if (!window.confirm('确定要取消这个订单吗？')) return;
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
    message.value = '订单已取消';
    await afterMutation(orderId);
  } catch (e) {
    message.value = e?.message || '取消失败';
  } finally {
    actionLoading.value = false;
  }
}

async function confirm(orderId) {
  if (!window.confirm('确认已收到商品吗？')) return;
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/confirm`, { method: 'POST' });
    message.value = '确认收货成功';
    await afterMutation(orderId);
  } catch (e) {
    message.value = e?.message || '操作失败';
  } finally {
    actionLoading.value = false;
  }
}

async function refund(orderId) {
  if (!window.confirm('确定要申请退款吗？')) return;
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/refund`, { method: 'POST' });
    message.value = '退款申请成功';
    await afterMutation(orderId);
  } catch (e) {
    message.value = e?.message || '申请退款失败';
  } finally {
    actionLoading.value = false;
  }
}

async function remove(orderId) {
  if (!window.confirm('确定要删除这个订单吗？删除后无法恢复。')) return;
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    message.value = '订单已删除';
    if (detailOpen.value && detailOrderId.value === orderId) closeDetail();
    await loadOrders();
  } catch (e) {
    message.value = e?.message || '删除订单失败';
  } finally {
    actionLoading.value = false;
  }
}

function reorderItems(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return;

  items.forEach((it) => {
    const pid = it?.productId?._id || it?.productId?.id || it?.productId || it?.productId?._id;
    if (!pid) return;
    cart.addProduct(
      {
        _id: pid,
        id: pid,
        name: it?.name || it?.productId?.name || '未命名商品',
        price: it?.price,
        imageUrl: it?.imageUrl || it?.productId?.imageUrl,
      },
      it?.quantity || 1
    );
  });

  message.value = '商品已添加到购物车';
  cart.open();
  router.push('/');
}

function trackOrder(order) {
  openDetail(order._id);
}

function getActions(order) {
  const status = order?.status;
  const actions = [];

  if (status === '待支付') {
    actions.push({
      key: 'pay',
      label: '立即支付',
      icon: 'fas fa-credit-card',
      className: 'btn-primary',
      onClick: (o) => pay(o._id),
    });
    actions.push({
      key: 'cancel',
      label: '取消订单',
      icon: 'fas fa-times',
      className: 'btn-danger',
      onClick: (o) => cancel(o._id),
    });
    actions.push({
      key: 'delete',
      label: '删除订单',
      icon: 'fas fa-trash',
      className: 'btn-danger',
      onClick: (o) => remove(o._id),
    });
  } else if (status === '已支付') {
    actions.push({
      key: 'track',
      label: '查看物流',
      icon: 'fas fa-truck',
      className: 'btn-warning',
      onClick: (o) => trackOrder(o),
    });
    actions.push({
      key: 'confirm',
      label: '确认收货',
      icon: 'fas fa-check',
      className: 'btn-success',
      onClick: (o) => confirm(o._id),
    });
    actions.push({
      key: 'refund',
      label: '申请退款',
      icon: 'fas fa-undo',
      className: 'btn-danger',
      onClick: (o) => refund(o._id),
    });
    actions.push({
      key: 'delete',
      label: '删除订单',
      icon: 'fas fa-trash',
      className: 'btn-danger',
      onClick: (o) => remove(o._id),
    });
  } else if (status === '发货中') {
    actions.push({
      key: 'track',
      label: '查看物流',
      icon: 'fas fa-truck',
      className: 'btn-warning',
      onClick: (o) => trackOrder(o),
    });
    actions.push({
      key: 'confirm',
      label: '确认收货',
      icon: 'fas fa-check',
      className: 'btn-success',
      onClick: (o) => confirm(o._id),
    });
    actions.push({
      key: 'refund',
      label: '申请退款',
      icon: 'fas fa-undo',
      className: 'btn-danger',
      onClick: (o) => refund(o._id),
    });
    actions.push({
      key: 'delete',
      label: '删除订单',
      icon: 'fas fa-trash',
      className: 'btn-danger',
      onClick: (o) => remove(o._id),
    });
  } else if (status === '已完成') {
    actions.push({
      key: 'review',
      label: '评价',
      icon: 'fas fa-star',
      className: 'btn-warning',
      onClick: (o) => openReviewModal(o),
    });
    actions.push({
      key: 'reorder',
      label: '再次购买',
      icon: 'fas fa-redo',
      className: 'btn-secondary',
      onClick: (o) => reorderItems(o),
    });
    actions.push({
      key: 'delete',
      label: '删除订单',
      icon: 'fas fa-trash',
      className: 'btn-danger',
      onClick: (o) => remove(o._id),
    });
  } else if (status === '已取消' || status === '已退款') {
    actions.push({
      key: 'reorder',
      label: '再次购买',
      icon: 'fas fa-redo',
      className: 'btn-secondary',
      onClick: (o) => reorderItems(o),
    });
    actions.push({
      key: 'delete',
      label: '删除订单',
      icon: 'fas fa-trash',
      className: 'btn-danger',
      onClick: (o) => remove(o._id),
    });
  }

  return actions;
}

function refreshUser() {
  userRef.value = getCurrentUser();
  loadOrders();
}

onMounted(() => {
  window.addEventListener('auth-changed', refreshUser);
  refreshUser();
});

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
});
</script>

<style scoped>
.orders-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.orders-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.orders-header-row {
  gap: 12px;
}

.page-title {
  margin: 0;
}

.icon-mr {
  margin-right: 8px;
}

.message-alert {
  margin-top: 12px;
}

.w-full {
  width: 100%;
}

.muted {
  opacity: 0.85;
}

.order-card {
  background: var(--el-bg-color);
  border: none;
  border-radius: 12px;
  margin-bottom: 15px;
  overflow: hidden;
}

.order-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.order-number {
  font-weight: 600;
}

.order-date {
  opacity: 0.8;
  margin-top: 4px;
  font-size: 0.9rem;
}

.order-status {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.9rem;
  align-self: flex-start;
}

.order-content {
  padding: 16px 18px;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-item {
  display: flex;
  gap: 12px;
  align-items: center;
}

.item-image {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-name {
  font-weight: 500;
}

.item-merchant {
  opacity: 0.75;
  font-size: 0.9rem;
}

.item-price-quantity {
  display: flex;
  gap: 10px;
  align-items: center;
}

.item-price {
  color: var(--el-color-danger);
  font-weight: 600;
}

.item-quantity {
  opacity: 0.8;
}

.order-shipping {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 12px;
}

.shipping-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.shipping-info {
  opacity: 0.9;
  line-height: 1.6;
}

.order-summary {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.total-amount {
  margin-left: 10px;
  font-weight: 700;
  color: var(--el-color-danger);
}

.order-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.order-detail-body {
  padding: 18px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-title {
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.detail-content {
  background: var(--el-fill-color-lighter);
  border-radius: 12px;
  padding: 12px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.detail-item-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
}

.detail-item-name {
  font-weight: 500;
  margin-bottom: 5px;
}

.detail-item-merchant {
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
  margin-bottom: 5px;
}

.detail-item-price {
  color: var(--el-color-danger);
  font-weight: 600;
}

.detail-item-image {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  margin-right: 15px;
  background: var(--el-fill-color-light);
}

.logistics-traces {
  display: grid;
  gap: 10px;
}

.logistics-meta {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
}

.trace-row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
}

.trace-time {
  opacity: 0.8;
  font-size: 0.9rem;
}

.trace-desc {
  line-height: 1.5;
}

.detail-fee {
  display: grid;
  gap: 10px;
}

.fee-row {
  display: flex;
  justify-content: space-between;
}

.fee-total {
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-weight: 700;
  font-size: 1.05rem;
}

.fee-total-amount {
  color: var(--el-color-danger);
}

.detail-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 10px;
}

/* 状态色：沿用旧项目常用色系 */
.status-pending {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.status-paid {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.status-shipping {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.status-completed {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.status-cancelled {
  background: var(--el-color-info-light-9);
  color: var(--el-text-color-secondary);
}

.status-refunded {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .trace-row {
    grid-template-columns: 1fr;
  }
}

/* 评价弹窗 */
.review-modal-body {
  padding: 18px;
}

.review-loading-state {
  text-align: center;
  padding: 20px;
  opacity: 0.85;
}

.review-error-pad {
  padding: 16px;
}

.review-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}

.review-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.review-item-header img {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--el-fill-color-light);
}

.review-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.review-item-info .item-name {
  font-weight: 600;
}

.review-item-info .item-price {
  opacity: 0.85;
}

.reviewed-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
}

.review-form {
  margin-top: 12px;
}

.rating-select {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.rating-label {
  font-weight: 600;
}

.stars {
  display: flex;
  gap: 6px;
}

.star-icon {
  cursor: pointer;
  color: var(--el-border-color);
  font-size: 1.1rem;
}

.star-icon.active {
  color: var(--el-color-warning);
}

.rating-text {
  opacity: 0.85;
}
.review-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.char-count {
  opacity: 0.8;
  font-size: 0.9rem;
}

</style>
