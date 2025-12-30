<template>
  <section class="add-product-page">
    <el-result v-if="!user" icon="warning" title="你还未登录" sub-title="登录后才能发布商品">
      <template #extra>
        <RouterLink to="/login" class="link">
          <el-button type="primary">去登录</el-button>
        </RouterLink>
      </template>
    </el-result>

    <el-result v-else-if="user.role !== 'merchant'" icon="error" title="仅商家可访问" sub-title="请使用商家账号登录">
      <template #extra>
        <RouterLink to="/products" class="link">
          <el-button>返回商品列表</el-button>
        </RouterLink>
      </template>
    </el-result>

    <template v-else>
      <el-card class="form-card" shadow="never">
        <template #header>
          <div class="card-header">
            <div class="title">
              <i class="fas fa-plus-circle icon"></i>
              <span>发布新商品</span>
            </div>
            <RouterLink to="/merchant/dashboard" class="link">
              <el-button text>返回商家后台</el-button>
            </RouterLink>
          </div>
        </template>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
          <el-form-item label="商品名称" prop="name">
            <el-input v-model.trim="form.name" placeholder="请输入商品名称" clearable />
          </el-form-item>

          <el-row :gutter="12">
            <el-col :xs="24" :sm="12">
              <el-form-item label="价格 (¥)" prop="price">
                <el-input-number v-model="form.price" :min="0" :precision="2" :step="0.01" class="w-full" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="库存数量" prop="stock">
                <el-input-number v-model="form.stock" :min="0" :precision="0" :step="1" class="w-full" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="商品分类" prop="category">
            <el-select v-model="form.category" placeholder="请选择分类" class="w-full">
              <el-option label="电子数码" value="Electronics" />
              <el-option label="服饰鞋包" value="Clothing" />
              <el-option label="家居生活" value="Home" />
              <el-option label="图书文具" value="Books" />
              <el-option label="美妆护肤" value="Beauty" />
              <el-option label="食品生鲜" value="Food" />
              <el-option label="运动户外" value="Sports" />
              <el-option label="其他" value="Other" />
              <el-option label="通用" value="General" />
            </el-select>
          </el-form-item>

          <el-form-item label="商品描述" prop="description">
            <el-input v-model.trim="form.description" type="textarea" :rows="5" placeholder="请输入商品详细描述..." />
          </el-form-item>

          <el-form-item label="店铺名称">
            <el-input :model-value="shopName" disabled />
          </el-form-item>

          <el-divider content-position="left">商品图片</el-divider>

          <el-form-item label="图片来源">
            <el-radio-group v-model="imageType">
              <el-radio-button label="url">网络链接</el-radio-button>
              <el-radio-button label="file">本地上传</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="imageType === 'url'" label="图片链接" prop="imageUrl">
            <el-input v-model.trim="form.imageUrl" placeholder="https://example.com/image.jpg" clearable />
          </el-form-item>

          <el-form-item v-else label="上传图片">
            <el-upload
              :auto-upload="false"
              :limit="1"
              accept="image/*"
              :on-change="onUploadChange"
              :on-remove="onUploadRemove"
            >
              <el-button>选择图片</el-button>
              <template #tip>
                <div class="hint">建议使用正方形图片，支持 jpg/png</div>
              </template>
            </el-upload>
          </el-form-item>

          <el-form-item v-if="previewUrl" label="预览">
            <el-image class="preview-img" :src="previewUrl" fit="contain" />
          </el-form-item>

          <el-form-item label="商品编码（选填）">
            <el-input v-model.trim="form.productCode" placeholder="例如: PROD-001（不填将自动生成）" clearable />
          </el-form-item>

          <el-form-item label="搜索关键词（选填，用逗号分隔）">
            <el-input v-model.trim="form.searchKeywords" placeholder="例如: 手机,智能,5G" clearable />
          </el-form-item>

          <el-alert v-if="message" :title="message" type="success" show-icon :closable="false" class="alert" />
          <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="alert" />

          <div class="actions">
            <el-button type="primary" :loading="loading" @click="submit">立即发布</el-button>
          </div>
        </el-form>
      </el-card>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getAuthToken, getCurrentUser } from '../api/http';

const router = useRouter();
const userRef = ref(getCurrentUser());
const user = computed(() => userRef.value);

function refreshUser() {
  userRef.value = getCurrentUser();
}

const formRef = ref();
const form = reactive({
  name: '',
  description: '',
  price: 0,
  category: 'General',
  stock: 0,
  imageUrl: '',
  productCode: '',
  searchKeywords: ''
});

const rules = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入商品描述', trigger: 'blur' }],
  price: [{ required: true, message: '请输入价格', trigger: 'change' }],
  stock: [{ required: true, message: '请输入库存数量', trigger: 'change' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  imageUrl: [
    {
      validator: (_rule, value, callback) => {
        if (imageType.value !== 'url') return callback();
        if (!value) return callback();
        try {
          // eslint-disable-next-line no-new
          new URL(value);
          callback();
        } catch {
          callback(new Error('请输入合法的图片链接'));
        }
      },
      trigger: 'blur'
    }
  ]
};

const file = ref(null);

const imageType = ref('url');
const previewUrl = ref('');

const loading = ref(false);
const message = ref('');
const error = ref('');

function onUploadChange(uploadFile) {
  file.value = uploadFile?.raw || null;
}

function onUploadRemove() {
  file.value = null;
}

watch(file, (f) => {
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = f ? URL.createObjectURL(f) : '';
});

watch(
  () => form.imageUrl,
  (u) => {
    if (imageType.value !== 'url') return;
    previewUrl.value = u || '';
  }
);

watch(imageType, (t) => {
  if (t === 'url') {
    file.value = null;
    previewUrl.value = form.imageUrl || '';
  } else {
    form.imageUrl = '';
    previewUrl.value = file.value ? URL.createObjectURL(file.value) : '';
  }
});

const shopName = computed(() => {
  const u = user.value;
  return u?.merchantInfo?.shopName || u?.name || '我的店铺';
});

async function submit() {
  error.value = '';
  message.value = '';
  const formApi = formRef.value;
  if (formApi?.validate) {
    const ok = await formApi
      .validate()
      .then(() => true)
      .catch(() => false);
    if (!ok) return;
  }
  loading.value = true;

  try {
    const u = user.value;
    const token = getAuthToken();

    const payload = new FormData();
    payload.append('name', form.name);
    payload.append('description', form.description);
    payload.append('price', String(form.price));
    payload.append('category', form.category || 'General');
    payload.append('stock', String(form.stock || 0));

    // Use legacy behavior: sending merchant as userId lets backend map merchantId
    payload.append('merchant', u._id);

    if (form.productCode) payload.append('productCode', form.productCode);
    if (form.searchKeywords) payload.append('searchKeywords', form.searchKeywords);

    if (imageType.value === 'url' && form.imageUrl) {
      payload.append('imageUrl', form.imageUrl);
    }

    if (imageType.value === 'file' && file.value) {
      payload.append('image', file.value);
    }

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: payload
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    message.value = '商品创建成功';
    router.push('/merchant/dashboard');
  } catch (e) {
    error.value = e?.message || '提交失败';
  } finally {
    loading.value = false;
  }
}

window.addEventListener('auth-changed', refreshUser);
onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value);
  }
});
</script>

<style scoped>
.add-product-page {
  max-width: 960px;
  margin: 18px auto;
  padding: 0 12px;
}

.form-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}

.icon {
  color: var(--el-color-primary);
}

.link {
  text-decoration: none;
}

.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.w-full {
  width: 100%;
}

.preview-img {
  width: 100%;
  max-height: 260px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.alert {
  margin: 10px 0;
}
</style>
