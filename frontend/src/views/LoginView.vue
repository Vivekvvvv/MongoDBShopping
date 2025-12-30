<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <div class="brand">
        <div class="brand-logo">惠多多</div>
        <div class="brand-tagline">品质生活，从这里开始</div>
      </div>

      <el-tabs v-model="activeTab" class="tabs" stretch>
        <el-tab-pane label="登录" name="login">
          <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top" @submit.prevent>
            <el-form-item label="邮箱地址" prop="email">
              <el-input v-model.trim="loginForm.email" placeholder="请输入您的邮箱" autocomplete="username" clearable />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input v-model="loginForm.password" type="password" placeholder="请输入您的密码" autocomplete="current-password" show-password />
            </el-form-item>

            <el-alert v-if="loginError" :title="loginError" type="error" show-icon :closable="false" class="alert" />

            <el-button type="primary" :loading="loginLoading" class="submit" @click="onLogin">
              立即登录
            </el-button>

            <div class="footer">
              还没有账户？
              <a href="#" class="link" @click.prevent="activeTab = 'register'">立即注册</a>
            </div>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form ref="registerFormRef" :model="regForm" :rules="registerRules" label-position="top" @submit.prevent>
            <el-divider content-position="left">基本信息</el-divider>

            <el-form-item label="姓名" prop="name">
              <el-input v-model.trim="regForm.name" placeholder="您的真实姓名" clearable />
            </el-form-item>

            <el-form-item label="邮箱地址" prop="email">
              <el-input v-model.trim="regForm.email" placeholder="您的邮箱地址" autocomplete="username" clearable />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input v-model="regForm.password" type="password" placeholder="设置登录密码" autocomplete="new-password" show-password />
            </el-form-item>

            <el-form-item label="账户类型" prop="role">
              <el-radio-group v-model="regForm.role">
                <el-radio-button label="user">买家</el-radio-button>
                <el-radio-button label="merchant">商家</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <template v-if="regForm.role === 'merchant'">
              <el-divider content-position="left">店铺信息</el-divider>

              <el-form-item label="店铺名称（选填）">
                <el-input v-model.trim="regForm.shopName" placeholder="例如：惠多多旗舰店" clearable />
              </el-form-item>

              <el-form-item label="店铺简介（选填）">
                <el-input v-model.trim="regForm.shopDescription" placeholder="一句话介绍您的店铺" clearable />
              </el-form-item>

              <el-form-item label="联系电话（选填）">
                <el-input v-model.trim="regForm.contactPhone" placeholder="您的联系电话" clearable />
              </el-form-item>
            </template>

            <el-empty v-else description="注册成为惠多多会员，开启您的品质购物之旅" />

            <el-alert v-if="registerError" :title="registerError" type="error" show-icon :closable="false" class="alert" />

            <el-button type="primary" :loading="registerLoading" class="submit" @click="onRegister">
              立即注册
            </el-button>

            <div class="footer">
              已有账户？
              <a href="#" class="link" @click.prevent="activeTab = 'login'">立即登录</a>
            </div>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch, setAuthSession } from '../api/http';
import { useCart } from '../stores/cart';

const router = useRouter();
const cart = useCart();

const activeTab = ref('login');

const loginFormRef = ref();
const loginForm = reactive({
  email: '',
  password: ''
});
const loginLoading = ref(false);
const loginError = ref('');

const registerFormRef = ref();
const regForm = reactive({
  name: '',
  email: '',
  password: '',
  role: 'user',
  shopName: '',
  shopDescription: '',
  contactPhone: ''
});
const registerLoading = ref(false);
const registerError = ref('');

const loginRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入合法的邮箱格式', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

const registerRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入合法的邮箱格式', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  role: [{ required: true, message: '请选择账户类型', trigger: 'change' }]
};

watch(activeTab, () => {
  loginError.value = '';
  registerError.value = '';
});

async function onLogin() {
  loginError.value = '';
  const api = loginFormRef.value;
  if (api?.validate) {
    const ok = await api
      .validate()
      .then(() => true)
      .catch(() => false);
    if (!ok) return;
  }
  loginLoading.value = true;
  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginForm.email, password: loginForm.password })
    });

    setAuthSession({ token: data.token, user: data.user });
    // 登录成功：把 guest 购物车合并到用户购物车
    cart.migrateGuestCartToUser(data.user);
    cart.setUser(data.user);

    const redirect = router.currentRoute.value.query.redirect;
    router.push((redirect && redirect.toString()) || '/products');
  } catch (e) {
    loginError.value = e?.message || '登录失败';
  } finally {
    loginLoading.value = false;
  }
}

async function onRegister() {
  registerError.value = '';
  const api = registerFormRef.value;
  if (api?.validate) {
    const ok = await api
      .validate()
      .then(() => true)
      .catch(() => false);
    if (!ok) return;
  }
  registerLoading.value = true;
  try {
    const payload = {
      name: regForm.name,
      email: regForm.email,
      password: regForm.password,
      role: regForm.role,
    };

    if (regForm.role === 'merchant') {
      payload.merchantInfo = {
        shopName: regForm.shopName,
        shopDescription: regForm.shopDescription,
        contactPhone: regForm.contactPhone,
      };
    }

    const data = await apiFetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setAuthSession({ token: data.token, user: data.user });
    cart.migrateGuestCartToUser(data.user);
    cart.setUser(data.user);

    const redirect = router.currentRoute.value.query.redirect;
    const fallback = data.user?.role === 'merchant' ? '/merchant/dashboard' : '/products';
    router.push((redirect && redirect.toString()) || fallback);
  } catch (e) {
    registerError.value = e?.message || '注册失败';
  } finally {
    registerLoading.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  max-width: 520px;
  margin: 24px auto;
  padding: 0 12px;
}

.auth-card {
  border-radius: 14px;
}

.brand {
  text-align: center;
  margin-bottom: 10px;
}

.brand-logo {
  font-size: 22px;
  font-weight: 800;
  color: var(--el-text-color-primary);
  letter-spacing: 1px;
}

.brand-tagline {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.tabs {
  margin-top: 10px;
}

.submit {
  width: 100%;
  margin-top: 4px;
}

.alert {
  margin-bottom: 10px;
}

.footer {
  margin-top: 10px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.link {
  color: var(--el-color-primary);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
</style>
