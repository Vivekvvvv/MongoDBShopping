<template>
  <section class="admin-dashboard">
    <el-result
      v-if="!user"
      icon="warning"
      title="你还未登录"
      sub-title="登录后可进入管理员后台"
    >
      <template #extra>
        <RouterLink to="/login" class="link">
          <el-button type="primary">去登录</el-button>
        </RouterLink>
      </template>
    </el-result>

    <el-result v-else-if="user.role !== 'admin'" icon="error" title="无权限" sub-title="仅管理员可访问" />

    <template v-else>
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span><i class="fas fa-chart-line icon-mr"></i> 平台数据分析</span>
          </div>
        </template>

        <el-row :gutter="12" class="filters-row" align="middle">
          <el-col :xs="24" :md="14">
            <el-radio-group v-model="selectedRange" @change="setRange">
              <el-radio-button label="7">近7天</el-radio-button>
              <el-radio-button label="30">近30天</el-radio-button>
              <el-radio-button label="90">近3个月</el-radio-button>
              <el-radio-button label="365">近1年</el-radio-button>
              <el-radio-button label="all">全部</el-radio-button>
            </el-radio-group>
          </el-col>
          <el-col :xs="24" :md="10">
            <div class="custom-range">
              <el-date-picker
                v-model="startDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="开始日期"
                class="w-full"
              />
              <el-date-picker
                v-model="endDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="结束日期"
                class="w-full"
              />
              <el-button type="primary" @click="applyCustomRange">
                <i class="fas fa-search icon-mr"></i>
                查询
              </el-button>
            </div>
          </el-col>
        </el-row>

        <div class="muted range-note">当前显示：{{ currentRangeText }}</div>

        <el-card v-if="statsLoading" shadow="never" class="inner-card">
          <el-skeleton :rows="4" animated />
        </el-card>
        <el-alert v-else-if="statsError" :title="statsError" type="error" show-icon :closable="false" class="section-alert" />

        <template v-else>
          <el-row :gutter="12" class="stats-row">
            <el-col :xs="24" :sm="12" :md="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">总销售额</div>
                <div class="stat-value">¥{{ formatMoney(stats.totalRevenue) }}</div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">总订单数</div>
                <div class="stat-value">{{ stats.totalOrders || 0 }}</div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">总用户 / 商家</div>
                <div class="stat-value">{{ stats.totalUsers || 0 }} / {{ stats.totalMerchants || 0 }}</div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-label">日均销售额</div>
                <div class="stat-value">¥{{ formatMoney(avgDailyRevenue) }}</div>
              </el-card>
            </el-col>
          </el-row>

          <el-divider />

          <el-row :gutter="12">
            <el-col :xs="24" :md="16">
              <el-card shadow="never" class="inner-card">
                <template #header>销售趋势</template>
                <el-empty v-if="(stats.salesTrend || []).length === 0" description="暂无数据" />
                <el-table v-else :data="stats.salesTrend" size="small" class="w-full">
                  <el-table-column prop="_id" label="日期" />
                  <el-table-column label="订单数" width="120" align="right">
                    <template #default="{ row }">{{ row.orderCount || 0 }}</template>
                  </el-table-column>
                  <el-table-column label="销售额" width="180" align="right">
                    <template #default="{ row }">¥{{ formatMoney(row.amount) }}</template>
                  </el-table-column>
                </el-table>
              </el-card>
            </el-col>

            <el-col :xs="24" :md="8">
              <el-card shadow="never" class="inner-card">
                <template #header>品类销售占比</template>
                <el-empty v-if="(stats.categoryStats || []).length === 0" description="暂无数据" />
                <el-table v-else :data="stats.categoryStats" size="small" class="w-full">
                  <el-table-column label="品类">
                    <template #default="{ row }">{{ row._id || '未分类' }}</template>
                  </el-table-column>
                  <el-table-column label="销售额" width="140" align="right">
                    <template #default="{ row }">¥{{ formatMoney(row.revenue) }}</template>
                  </el-table-column>
                </el-table>
              </el-card>
            </el-col>
          </el-row>

          <el-card shadow="never" class="inner-card">
            <template #header>订单状态分布</template>
            <el-empty v-if="(stats.orderStatusStats || []).length === 0" description="暂无订单数据" />
            <el-table v-else :data="stats.orderStatusStats" size="small" class="w-full">
              <el-table-column prop="_id" label="状态" />
              <el-table-column label="数量" width="120" align="right">
                <template #default="{ row }">{{ row.count || 0 }}</template>
              </el-table-column>
              <el-table-column label="金额" width="180" align="right">
                <template #default="{ row }">¥{{ formatMoney(row.revenue) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </template>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span><i class="fas fa-users icon-mr"></i> 用户管理</span>
          </div>
        </template>

        <el-card v-if="usersLoading" shadow="never" class="inner-card">
          <el-skeleton :rows="6" animated />
        </el-card>
        <el-alert v-else-if="usersError" :title="usersError" type="error" show-icon :closable="false" class="section-alert" />
        <el-empty v-else-if="users.length === 0" description="暂无用户" />

        <el-table v-else :data="users" size="small" class="w-full">
          <el-table-column prop="name" label="姓名" min-width="160" />
          <el-table-column prop="email" label="邮箱" min-width="220" />
          <el-table-column prop="role" label="角色" width="140">
            <template #default="{ row }">
              <el-tag size="small" effect="light">{{ row.role }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button type="danger" plain size="small" :disabled="actionLoading" @click="deleteUser(row._id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span><i class="fas fa-list-alt icon-mr"></i> 订单列表</span>
          </div>
        </template>

        <el-card v-if="ordersLoading" shadow="never" class="inner-card">
          <el-skeleton :rows="6" animated />
        </el-card>
        <el-alert v-else-if="ordersError" :title="ordersError" type="error" show-icon :closable="false" class="section-alert" />
        <el-empty v-else-if="orders.length === 0" description="暂无订单" />

        <el-table v-else :data="orders" size="small" class="w-full">
          <el-table-column label="订单号" min-width="220">
            <template #default="{ row }">{{ row.orderNumber || row._id }}</template>
          </el-table-column>
          <el-table-column label="用户" min-width="220">
            <template #default="{ row }">{{ row.userId?.email || row.userId?.name || row.userId || '-' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="140">
            <template #default="{ row }">
              <el-tag size="small" effect="light">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="160" align="right">
            <template #default="{ row }">¥{{ formatMoney(row.total) }}</template>
          </el-table-column>
        </el-table>

        <el-alert v-if="message" :title="message" type="info" show-icon :closable="false" class="section-alert" />
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiFetch, getCurrentUser } from '../api/http';

const user = ref(getCurrentUser());

const stats = ref(null);
const statsLoading = ref(false);
const statsError = ref('');

const users = ref([]);
const usersLoading = ref(false);
const usersError = ref('');

const orders = ref([]);
const ordersLoading = ref(false);
const ordersError = ref('');

const actionLoading = ref(false);
const message = ref('');

const selectedRange = ref('30');
const startDate = ref('');
const endDate = ref('');

function refreshUser() {
  user.value = getCurrentUser();
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const currentRangeText = computed(() => {
  if (selectedRange.value === '7') return '近7天';
  if (selectedRange.value === '30') return '近30天';
  if (selectedRange.value === '90') return '近3个月';
  if (selectedRange.value === '365') return '近1年';
  if (selectedRange.value === 'all') return '全部';
  if (selectedRange.value === 'custom') return '自定义';
  return '近30天';
});

const avgDailyRevenue = computed(() => {
  const total = Number(stats.value?.totalRevenue) || 0;

  const days = Number(selectedRange.value);
  if (Number.isFinite(days) && days > 0) return total / days;

  const startIso = stats.value?.dateRange?.start;
  const endIso = stats.value?.dateRange?.end;
  if (startIso && endIso) {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const diff = e.getTime() - s.getTime();
    const d = Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
    return total / d;
  }

  return 0;
});

async function loadStats() {
  statsLoading.value = true;
  statsError.value = '';
  try {
    let url = '/api/admin/stats';
    if (selectedRange.value === 'custom') {
      if (startDate.value && endDate.value) {
        url += `?startDate=${encodeURIComponent(startDate.value)}&endDate=${encodeURIComponent(endDate.value)}`;
      }
    } else if (selectedRange.value && selectedRange.value !== 'all') {
      url += `?days=${encodeURIComponent(selectedRange.value)}`;
    } else if (selectedRange.value === 'all') {
      url += '?days=all';
    }
    stats.value = await apiFetch(url);
  } catch (e) {
    statsError.value = e?.message || '加载失败';
    stats.value = null;
  } finally {
    statsLoading.value = false;
  }
}

async function loadUsers() {
  usersLoading.value = true;
  usersError.value = '';
  try {
    users.value = await apiFetch('/api/admin/users');
  } catch (e) {
    usersError.value = e?.message || '加载失败';
    users.value = [];
  } finally {
    usersLoading.value = false;
  }
}

async function loadOrders() {
  ordersLoading.value = true;
  ordersError.value = '';
  try {
    const data = await apiFetch('/api/admin/orders');
    orders.value = data.orders || [];
  } catch (e) {
    ordersError.value = e?.message || '加载失败';
    orders.value = [];
  } finally {
    ordersLoading.value = false;
  }
}

function setRange(range) {
  selectedRange.value = range;
  loadStats();
}

function applyCustomRange() {
  selectedRange.value = 'custom';
  loadStats();
}

async function deleteUser(userId) {
  if (!confirm('确认删除该用户？')) return;
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    message.value = '用户已删除';
    await loadUsers();
  } catch (e) {
    message.value = e?.message || '删除失败';
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  window.addEventListener('auth-changed', refreshUser);
  refreshUser();
  loadStats();
  loadUsers();
  loadOrders();
});

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
});
</script>

<style scoped>
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.section-card {
  margin-top: 12px;
}

.inner-card {
  margin-top: 12px;
}

.section-alert {
  margin-top: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.icon-mr {
  margin-right: 8px;
}

.filters-row {
  margin-bottom: 10px;
}

.custom-range {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.w-full {
  width: 100%;
}

.range-note {
  margin-top: 10px;
}

.link {
  text-decoration: none;
}

.muted {
  color: var(--el-text-color-secondary);
}

.stats-row {
  margin-top: 12px;
}

.stat-card {
  border-radius: 12px;
}

.stat-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--el-text-color-primary);
  margin-top: 10px;
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}
</style>
