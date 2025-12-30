<template>
  <section class="shops-container">
    <el-row class="header-actions" align="middle" justify="space-between">
      <h2 style="margin: 0;"><i class="fas fa-store"></i> 店铺</h2>
      <div style="display:flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <div style="opacity: 0.8;">发现优质商家与精选商品</div>
        <el-button v-if="isAdmin" type="primary" @click="openCreate">
          <i class="fas fa-plus" style="margin-right: 8px;"></i>
          新增店铺
        </el-button>
      </div>
    </el-row>

    <el-card v-if="loading" shadow="never">
      <el-skeleton :rows="8" animated />
    </el-card>

    <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" />

    <div v-else class="shop-grid">
      <el-card v-for="m in merchants" :key="m._id" class="shop-card" shadow="hover">
        <div class="shop-header">
          <div class="shop-icon">
            <i class="fas fa-store"></i>
          </div>
          <div class="shop-info">
            <h3>{{ shopName(m) }}</h3>
            <div class="shop-rating">
              <i class="fas fa-star"></i>
              {{ formatRating(m?.merchantInfo?.rating) }}
              <span style="color:var(--el-text-color-secondary); margin-left: 8px;">
                <i class="fas fa-shopping-bag" style="color:var(--el-color-success);"></i>
                销量: {{ m?.merchantInfo?.totalSales || 0 }}
              </span>
            </div>
          </div>
        </div>

        <div class="shop-desc">{{ m.merchantInfo?.shopDescription || '暂无介绍' }}</div>

        <div class="shop-actions">
          <span style="opacity: 0.85; font-size: 0.9rem; color:var(--el-color-primary);">
            <i class="fas fa-phone"></i>
            {{ m?.merchantInfo?.contactPhone || '—' }}
          </span>

          <div style="display:flex; gap: 8px; align-items: center;">
            <el-button v-if="isAdmin" size="small" @click="openEdit(m)">
              <i class="fas fa-edit" style="margin-right: 8px;"></i>
              编辑
            </el-button>
            <el-button v-if="isAdmin" size="small" type="danger" @click="removeMerchant(m)">
              <i class="fas fa-trash" style="margin-right: 8px;"></i>
              删除
            </el-button>

            <RouterLink :to="`/shops/${m._id}`" style="text-decoration: none;">
              <el-button size="small" type="primary" plain>
                <i class="fas fa-arrow-right" style="margin-right: 8px;"></i>
                进入店铺
              </el-button>
            </RouterLink>
          </div>
        </div>
      </el-card>
    </div>

    <el-empty v-if="!loading && !error && merchants.length === 0" description="暂无店铺" />

    <!-- Admin Shop Modal -->
    <el-dialog
      v-if="isAdmin"
      v-model="modalOpen"
      :title="modalMode === 'create' ? '新增店铺' : '编辑店铺'"
      width="520"
      :close-on-click-modal="false"
    >
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="店铺名称" required>
          <el-input v-model.trim="form.shopName" placeholder="例如：官方旗舰店" />
        </el-form-item>

        <el-form-item label="店主姓名" required>
          <el-input v-model.trim="form.ownerName" placeholder="例如：张三" />
        </el-form-item>

        <el-form-item label="登录邮箱" required>
          <el-input v-model.trim="form.email" :disabled="modalMode === 'edit'" placeholder="owner@example.com" />
        </el-form-item>

        <el-form-item :label="modalMode === 'create' ? '登录密码' : '登录密码（留空不修改）'" :required="modalMode === 'create'">
          <el-input v-model.trim="form.password" type="password" show-password placeholder="******" />
        </el-form-item>

        <el-form-item label="联系电话（选填）">
          <el-input v-model.trim="form.contactPhone" placeholder="例如：400-888-8888" />
        </el-form-item>

        <el-form-item label="店铺简介（选填）">
          <el-input v-model.trim="form.shopDescription" type="textarea" :rows="3" placeholder="简单介绍一下店铺..." />
        </el-form-item>

        <el-form-item label="评分（选填）">
          <el-input-number v-model="form.rating" :min="0" :max="5" :step="0.1" style="width: 180px;" />
        </el-form-item>

        <el-alert v-if="modalError" :title="modalError" type="error" show-icon :closable="false" />
      </el-form>

      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" :loading="modalSaving" @click="save">
          保存
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiFetch, getCurrentUser } from '../api/http';

const merchants = ref([]);
const loading = ref(false);
const error = ref('');

const user = ref(getCurrentUser());
const isAdmin = computed(() => user.value?.role === 'admin');

function refreshUser() {
  user.value = getCurrentUser();
}

const modalOpen = ref(false);
const modalMode = ref('create'); // create | edit
const modalSaving = ref(false);
const modalError = ref('');

const form = ref({
  id: '',
  shopName: '',
  ownerName: '',
  email: '',
  password: '',
  contactPhone: '',
  shopDescription: '',
  rating: 5,
});

function shopName(m) {
  return m?.merchantInfo?.shopName || m?.name || m?.email || '未命名店铺';
}

function normalizeMerchantId(m) {
  if (!m || typeof m !== 'object') return m;
  const normalized = { ...m };
  if (normalized.id && !normalized._id) normalized._id = normalized.id;
  if (normalized._id && !normalized.id) normalized.id = normalized._id;
  return normalized;
}

function formatRating(rating) {
  const r = Number(rating);
  if (!Number.isFinite(r)) return '5.0';
  return r.toFixed(1);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    merchants.value = await apiFetch('/api/merchants');
  } catch (e) {
    error.value = e?.message || '加载失败';
    merchants.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  modalMode.value = 'create';
  modalError.value = '';
  form.value = {
    id: '',
    shopName: '',
    ownerName: '',
    email: '',
    password: '',
    contactPhone: '',
    shopDescription: '',
    rating: 5,
  };
  modalOpen.value = true;
}

function openEdit(m) {
  modalMode.value = 'edit';
  modalError.value = '';
  form.value = {
    id: m?._id || '',
    shopName: m?.merchantInfo?.shopName || '',
    ownerName: m?.name || '',
    email: m?.email || '',
    password: '',
    contactPhone: m?.merchantInfo?.contactPhone || '',
    shopDescription: m?.merchantInfo?.shopDescription || '',
    rating: Number(m?.merchantInfo?.rating) || 5,
  };
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

async function save() {
  modalSaving.value = true;
  modalError.value = '';

  try {
    const shopNameValue = (form.value.shopName || '').trim();
    const ownerNameValue = (form.value.ownerName || '').trim();
    const emailValue = (form.value.email || '').trim();

    if (!shopNameValue) throw new Error('请填写店铺名称');
    if (!ownerNameValue) throw new Error('请填写店主姓名');
    if (!emailValue) throw new Error('请填写登录邮箱');
    if (modalMode.value === 'create' && !(form.value.password || '').trim()) throw new Error('请填写登录密码');

    const payload = {
      name: ownerNameValue,
      email: emailValue,
      shopName: shopNameValue,
      shopDescription: form.value.shopDescription,
      contactPhone: form.value.contactPhone,
      rating: form.value.rating,
    };
    if (form.value.password) payload.password = form.value.password;

    if (modalMode.value === 'create') {
      const created = await apiFetch('/api/merchants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // backend returns { message, merchant }
      const merchant = normalizeMerchantId(created?.merchant || created);
      if (merchant) merchants.value = [merchant, ...merchants.value];
    } else {
      const id = form.value.id;
      if (!id) throw new Error('缺少店铺ID');

      await apiFetch(`/api/merchants/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      await load();
    }

    closeModal();
  } catch (e) {
    modalError.value = e?.message || '保存失败';
  } finally {
    modalSaving.value = false;
  }
}

async function removeMerchant(m) {
  const id = m?._id;
  if (!id) return;
  if (!confirm(`确定删除店铺：${shopName(m)}？这将同时删除该店铺下的所有商品！`)) return;

  try {
    await apiFetch(`/api/merchants/${encodeURIComponent(id)}`, { method: 'DELETE' });
    merchants.value = merchants.value.filter((x) => x?._id !== id);
  } catch (e) {
    alert(e?.message || '删除失败');
  }
}

onMounted(() => {
  window.addEventListener('auth-changed', refreshUser);
  refreshUser();
  load();
});

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
});
</script>

<style scoped>
.shops-container {
  max-width: 1200px;
  margin: 40px auto;
  padding: 20px;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  gap: 16px;
  flex-wrap: wrap;
}

.header-actions h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.shop-card {
  background: var(--el-bg-color);
  border-radius: 10px;
  padding: 0;
  box-shadow: none;
  transition: transform 0.3s;
  position: relative;
}

.shop-card:hover {
  transform: translateY(-5px);
}

.shop-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.shop-icon {
  width: 50px;
  height: 50px;
  background: var(--el-fill-color-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--el-color-primary);
}

.shop-info h3 {
  margin: 0 0 5px 0;
  color: var(--el-text-color-primary);
}

.shop-rating {
  color: var(--el-color-warning);
  font-size: 14px;
}

.shop-desc {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 15px;
  height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shop-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--el-border-color-light);
  padding-top: 15px;
}

.btn-sm {
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-edit {
  background: var(--el-color-primary);
  color: white;
}

.btn-danger {
  background: var(--el-color-danger);
  color: white;
}

.btn-secondary {
  background: var(--el-color-info);
  color: white;
}

.btn-edit:hover {
  filter: brightness(0.95);
}

.btn-danger:hover,
.btn-secondary:hover {
  filter: brightness(0.95);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}

.modal-card {
  width: 520px;
  max-width: 100%;
  background: var(--el-bg-color);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.form-row label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.form-row input,
.form-row textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  font-size: 14px;
}

.form-row textarea {
  min-height: 90px;
  resize: vertical;
}

@media (max-width: 768px) {
  .shops-container {
    margin: 20px auto;
  }
}
</style>
