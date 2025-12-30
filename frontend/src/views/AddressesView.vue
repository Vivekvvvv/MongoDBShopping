<template>
  <section>
    <el-result
      v-if="!user"
      icon="warning"
      title="你还未登录"
      sub-title="登录后可管理收货地址"
    >
      <template #extra>
        <RouterLink to="/login" style="text-decoration:none;">
          <el-button type="primary">去登录</el-button>
        </RouterLink>
      </template>
    </el-result>

    <template v-else>
      <div class="address-management">
        <el-card shadow="never" class="address-header">
          <div style="display:flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div>
              <h2 style="margin: 0;"><i class="fas fa-map-marker-alt"></i> 地址管理</h2>
              <div style="margin-top: 6px; color: var(--el-text-color-secondary); font-size: 14px;">管理你的收货地址，支持默认地址与标签</div>
            </div>
            <el-button type="primary" @click="openCreate">
              <i class="fas fa-plus" style="margin-right: 8px;"></i>
              新增地址
            </el-button>
          </div>
        </el-card>

        <el-card v-if="loading" shadow="never" style="margin-top: 12px;">
          <el-skeleton :rows="7" animated />
        </el-card>
        <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" style="margin-top: 12px;" />

        <div v-else class="address-list">
          <el-card
            v-for="a in addresses"
            :key="a._id"
            class="address-card"
            :class="{ default: !!a.isDefault }"
            shadow="hover"
          >
            <div style="display:flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
              <div>
                <div class="address-name-phone">
                  <span class="address-name">{{ a.name || '收货人' }}</span>
                  <span class="address-phone" v-if="a.phone">{{ a.phone }}</span>
                  <el-tag v-if="a.isDefault" size="small" type="primary">默认地址</el-tag>
                  <el-tag v-if="a.tag" size="small" :type="tagType(a.tag)">{{ a.tag }}</el-tag>
                </div>
                <div class="address-detail">{{ a.province }} {{ a.city }} {{ a.district }} {{ a.detail }}</div>
                <div v-if="a.postalCode" class="address-postal">邮编：{{ a.postalCode }}</div>
              </div>

              <div class="address-actions">
                <el-button
                  v-if="!a.isDefault"
                  type="success"
                  size="small"
                  :disabled="actionLoading"
                  @click="setDefault(a)"
                >
                  <i class="fas fa-check" style="margin-right: 8px;"></i>
                  设为默认
                </el-button>
                <el-button type="warning" size="small" :disabled="actionLoading" @click="openEdit(a)">
                  <i class="fas fa-edit" style="margin-right: 8px;"></i>
                  编辑
                </el-button>
                <el-button type="danger" size="small" :disabled="actionLoading" @click="remove(a._id)">
                  <i class="fas fa-trash" style="margin-right: 8px;"></i>
                  删除
                </el-button>
              </div>
            </div>
          </el-card>

          <el-empty v-if="addresses.length === 0" description="暂无地址" />
        </div>

        <p v-if="message" style="opacity:0.8; margin-top: 12px;">{{ message }}</p>
      </div>

      <!-- Modal -->
      <el-dialog
        v-model="showModal"
        :title="form._id ? '编辑地址' : '新增地址'"
        width="600"
        :close-on-click-modal="false"
      >
        <el-form label-position="top" @submit.prevent>
          <el-row :gutter="12">
            <el-col :xs="24" :sm="12">
              <el-form-item label="收货人" required>
                <el-input v-model.trim="form.name" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="手机" required>
                <el-input v-model.trim="form.phone" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="省" required>
                <el-input v-model.trim="form.province" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="市" required>
                <el-input v-model.trim="form.city" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="8">
              <el-form-item label="区" required>
                <el-input v-model.trim="form.district" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="邮编（选填）">
                <el-input v-model.trim="form.postalCode" placeholder="例如：310000" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="标签">
                <el-select v-model="form.tag" style="width: 100%;">
                  <el-option label="家" value="家" />
                  <el-option label="公司" value="公司" />
                  <el-option label="学校" value="学校" />
                  <el-option label="其他" value="其他" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24">
              <el-form-item label="详细地址" required>
                <el-input v-model.trim="form.detail" />
              </el-form-item>
            </el-col>
            <el-col :xs="24">
              <el-form-item>
                <el-checkbox v-model="form.isDefault">设为默认地址</el-checkbox>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <template #footer>
          <el-button @click="closeModal" :disabled="actionLoading">取消</el-button>
          <el-button type="primary" :loading="actionLoading" @click="save">保存</el-button>
        </template>
      </el-dialog>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { apiFetch, getCurrentUser } from '../api/http';

const userRef = ref(getCurrentUser());
const user = computed(() => userRef.value);

const addresses = ref([]);
const loading = ref(false);
const error = ref('');
const message = ref('');

const actionLoading = ref(false);

const showModal = ref(false);

const form = reactive({
  _id: '',
  userId: '',
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  postalCode: '',
  isDefault: false,
  tag: '其他'
});

function reset() {
  form._id = '';
  form.userId = user.value?._id || '';
  form.name = '';
  form.phone = '';
  form.province = '';
  form.city = '';
  form.district = '';
  form.detail = '';
  form.postalCode = '';
  form.isDefault = false;
  form.tag = '其他';
}

function edit(a) {
  form._id = a._id;
  form.userId = a.userId || user.value?._id || '';
  form.name = a.name || '';
  form.phone = a.phone || '';
  form.province = a.province || '';
  form.city = a.city || '';
  form.district = a.district || '';
  form.detail = a.detail || '';
  form.postalCode = a.postalCode || '';
  form.isDefault = !!a.isDefault;
  form.tag = a.tag || '其他';
}

function openCreate() {
  reset();
  showModal.value = true;
}

function openEdit(a) {
  edit(a);
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

function tagType(tag) {
  if (tag === '家') return 'success';
  if (tag === '公司') return 'warning';
  if (tag === '学校') return 'info';
  return '';
}

function tagClass(tag) {
  if (tag === '家') return 'tag-home';
  if (tag === '公司') return 'tag-work';
  if (tag === '学校') return 'tag-school';
  return 'tag-other';
}

async function load() {
  const u = user.value;
  if (!u || !u._id) return;

  loading.value = true;
  error.value = '';
  try {
    addresses.value = await apiFetch(`/api/addresses/${encodeURIComponent(u._id)}`);
  } catch (e) {
    error.value = e?.message || '加载失败';
    addresses.value = [];
  } finally {
    loading.value = false;
  }
}

async function save() {
  actionLoading.value = true;
  message.value = '';
  try {
    const nameValue = String(form.name || '').trim();
    const phoneValue = String(form.phone || '').trim();
    const provinceValue = String(form.province || '').trim();
    const cityValue = String(form.city || '').trim();
    const districtValue = String(form.district || '').trim();
    const detailValue = String(form.detail || '').trim();

    if (!nameValue) throw new Error('请填写收货人');
    if (!phoneValue) throw new Error('请填写手机');
    if (!provinceValue) throw new Error('请填写省');
    if (!cityValue) throw new Error('请填写市');
    if (!districtValue) throw new Error('请填写区');
    if (!detailValue) throw new Error('请填写详细地址');

    const payload = {
      userId: user.value?._id,
      name: nameValue,
      phone: phoneValue,
      province: provinceValue,
      city: cityValue,
      district: districtValue,
      detail: detailValue,
      postalCode: form.postalCode || '',
      isDefault: !!form.isDefault,
      tag: form.tag || '其他'
    };

    if (form._id) {
      await apiFetch(`/api/addresses/${encodeURIComponent(form._id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      message.value = '地址已更新';
    } else {
      await apiFetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      message.value = '地址已创建';
    }

    reset();
    closeModal();
    await load();
  } catch (e) {
    message.value = e?.message || '保存失败';
  } finally {
    actionLoading.value = false;
  }
}

async function setDefault(a) {
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/addresses/${encodeURIComponent(a._id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.value?._id,
        name: a.name,
        phone: a.phone,
        province: a.province,
        city: a.city,
        district: a.district,
        detail: a.detail,
        postalCode: a.postalCode || '',
        tag: a.tag || '其他',
        isDefault: true
      })
    });
    message.value = '已设为默认地址';
    await load();
  } catch (e) {
    message.value = e?.message || '设置失败';
  } finally {
    actionLoading.value = false;
  }
}

async function remove(id) {
  if (!confirm('确认删除该地址？')) return;
  actionLoading.value = true;
  message.value = '';
  try {
    await apiFetch(`/api/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    message.value = '地址已删除';
    await load();
  } catch (e) {
    message.value = e?.message || '删除失败';
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  reset();
  load();
});

function refreshUser() {
  userRef.value = getCurrentUser();
  reset();
  load();
}

onMounted(() => {
  window.addEventListener('auth-changed', refreshUser);
});

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
});
</script>

<style scoped>
.address-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.address-header {
  margin-bottom: 30px;
}

.address-list {
  display: grid;
  gap: 20px;
  margin-bottom: 20px;
}

.address-card {
  position: relative;
  border: 1px solid transparent;
}

.address-card :deep(.el-card__body) {
  padding: 16px;
}

.address-card.default {
  border-color: var(--el-color-primary);
  background: var(--el-fill-color-lighter);
}

.address-header-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.address-name-phone {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.address-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.address-phone {
  color: var(--el-text-color-secondary);
  font-size: 1rem;
}

.address-detail {
  color: var(--el-text-color-regular);
  line-height: 1.6;
  margin-bottom: 10px;
}

.address-postal {
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}

.address-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  flex-wrap: wrap;
}
</style>
