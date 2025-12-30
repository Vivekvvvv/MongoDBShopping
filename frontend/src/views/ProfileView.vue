<template>
  <section>
    <el-result
      v-if="!user"
      icon="warning"
      title="你还未登录"
      sub-title="登录后可查看订单与个人信息"
    >
      <template #extra>
        <RouterLink to="/login" style="text-decoration:none;">
          <el-button type="primary">去登录</el-button>
        </RouterLink>
      </template>
    </el-result>

    <template v-else>
      <el-card shadow="never" class="profile-header">
        <div style="display:flex; align-items:center; gap: 14px; flex-wrap: wrap;">
          <el-avatar :size="64" :title="user.name || user.email">{{ avatarText }}</el-avatar>
          <div class="profile-info">
            <div style="display:flex; align-items:center; gap: 10px; flex-wrap: wrap;">
              <h2 style="margin: 0;">{{ user.name || '用户' }}</h2>
              <el-tag size="small">{{ roleText }}</el-tag>
            </div>
            <div style="margin-top: 6px; color: var(--el-text-color-secondary);">{{ user.email }}</div>
          </div>
        </div>
      </el-card>

      <div class="section-header" style="display:flex; justify-content: space-between; align-items: center; margin: 14px 0 10px; gap: 10px; flex-wrap: wrap;">
        <h3 style="margin: 0;"><i class="fas fa-history"></i> 历史订单</h3>
        <RouterLink to="/orders" style="text-decoration:none;">
          <el-button type="primary" plain>查看全部订单</el-button>
        </RouterLink>
      </div>

      <el-card v-if="ordersLoading" shadow="never">
        <el-skeleton :rows="5" animated />
      </el-card>
      <el-alert v-else-if="ordersError" :title="ordersError" type="error" show-icon :closable="false" />

      <div v-else>
        <el-empty v-if="orders.length === 0" description="暂无订单" />

        <el-card
          v-for="order in orders"
          :key="order._id"
          shadow="hover"
          style="margin-bottom: 12px;"
        >
          <div
            class="order-header"
            style="display: flex; justify-content: space-between; margin-bottom: 10px; color: var(--el-text-color-secondary); font-size: 0.9em; gap: 10px;"
          >
            <span><strong>订单号:</strong> {{ order.orderNumber || order._id }}</span>
            <span style="white-space: nowrap;">{{ formatDateTime(order.createdAt) }}</span>
          </div>

          <div style="margin: 10px 0; border-top: 1px solid var(--el-border-color-lighter); border-bottom: 1px solid var(--el-border-color-lighter); padding: 10px 0;">
            <div
              v-for="item in order.items"
              :key="item.productId || item._id || item.id || item.name"
              style="display:flex; justify-content:space-between; margin-bottom: 6px; gap: 10px;"
            >
              <span style="overflow:hidden; text-overflow: ellipsis; white-space: nowrap;">{{ item.name }} x{{ item.quantity }}</span>
              <span style="white-space: nowrap;">¥{{ formatPrice((Number(item.price) || 0) * (Number(item.quantity) || 0)) }}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <el-tag size="small">{{ order.status }}</el-tag>
            <div style="text-align:right; font-weight:bold; color:var(--el-color-danger); white-space: nowrap;">
              总计: ¥{{ formatPrice(order.total) }}
            </div>
          </div>
        </el-card>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiFetch, getCurrentUser } from '../api/http';

const user = ref(getCurrentUser());

const orders = ref([]);
const ordersLoading = ref(false);
const ordersError = ref('');

const avatarText = computed(() => {
  const u = user.value;
  const text = (u?.name || u?.email || 'U').toString().trim();
  return text ? text[0].toUpperCase() : 'U';
});

const roleText = computed(() => {
  const role = user.value?.role;
  if (role === 'admin') return '管理员';
  if (role === 'merchant') return '商家';
  return '普通用户';
});

function refreshUser() {
  user.value = getCurrentUser();
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function formatPrice(price) {
  const p = Number(price);
  if (!Number.isFinite(p)) return '0.00';
  return p.toFixed(2);
}

async function loadOrders() {
  const u = user.value;
  const userId = u?.id || u?._id;
  if (!userId) {
    orders.value = [];
    return;
  }

  ordersLoading.value = true;
  ordersError.value = '';
  try {
    const data = await apiFetch(`/api/orders/user/${encodeURIComponent(userId)}`);
    const list = data?.orders || data || [];
    orders.value = Array.isArray(list) ? list : [];
  } catch (e) {
    ordersError.value = e?.message || '加载订单失败';
    orders.value = [];
  } finally {
    ordersLoading.value = false;
  }
}

onMounted(() => {
  window.addEventListener('auth-changed', refreshUser);
  refreshUser();
  loadOrders();
});

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
});
</script>

<style scoped>
.profile-header {
  margin-bottom: 14px;
}
</style>
