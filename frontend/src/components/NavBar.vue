<template>
  <nav class="navbar">
    <div class="nav-brand huiddo-brand" @click="goHome" style="cursor:pointer;">惠多多</div>

    <div class="search-bar">
      <input v-model.trim="q" placeholder="搜索商品..." @keydown.enter.prevent="onSearch" />
      <button type="button" @click="onSearch">搜索</button>
    </div>

    <div v-if="showCategoryFilter" class="category-filter" style="margin: 0 20px;">
      <div class="modern-select">
        <select v-model="category" @change="onCategoryChange">
          <option value="">所有分类</option>
          <option value="Electronics">电子产品</option>
          <option value="Clothing">服装</option>
          <option value="Books">书籍</option>
          <option value="Home">家居</option>
          <option value="Beauty">美妆</option>
        </select>
      </div>
    </div>

    <div class="nav-actions">
      <RouterLink class="nav-item" to="/recommended">
        <i class="fas fa-star"></i>
        <span>推荐</span>
      </RouterLink>

      <RouterLink class="nav-item" to="/products">
        <i class="fas fa-th"></i>
        <span>全部商品</span>
      </RouterLink>

      <RouterLink class="nav-item" to="/shops">
        <i class="fas fa-store"></i>
        <span>店铺</span>
      </RouterLink>

      <div class="user-menu" v-if="user">
        <div class="user-info" @click.stop="toggleUserMenu">
          <i class="fas fa-user"></i>
          <span class="user-name">{{ user.name || user.email || '用户' }}</span>
          <i class="fas fa-chevron-down"></i>
        </div>

        <div id="userDropdown" class="user-dropdown" v-show="userMenuOpen">
          <RouterLink class="dropdown-item" to="/profile" @click="closeUserMenu">
            <i class="fas fa-user-circle"></i>
            <span>个人中心</span>
          </RouterLink>

          <RouterLink class="dropdown-item" to="/orders" @click="closeUserMenu">
            <i class="fas fa-shopping-bag"></i>
            <span>我的订单</span>
          </RouterLink>

          <RouterLink class="dropdown-item" to="/addresses" @click="closeUserMenu">
            <i class="fas fa-map-marker-alt"></i>
            <span>地址管理</span>
          </RouterLink>

          <RouterLink
            v-if="user.role === 'admin'"
            class="dropdown-item"
            to="/admin"
            @click="closeUserMenu"
          >
            <i class="fas fa-chart-line"></i>
            <span>管理后台</span>
          </RouterLink>

          <RouterLink
            v-if="user.role === 'merchant'"
            class="dropdown-item"
            to="/merchant/dashboard"
            @click="closeUserMenu"
          >
            <i class="fas fa-store-alt"></i>
            <span>商家后台</span>
          </RouterLink>

          <button type="button" class="dropdown-item logout" @click="logout">
            <i class="fas fa-sign-out-alt"></i>
            <span>退出登录</span>
          </button>
        </div>
      </div>

      <RouterLink v-else class="nav-item" to="/login">
        <i class="fas fa-sign-in-alt"></i>
        <span>登录</span>
      </RouterLink>

      <div class="nav-cart" @click="cart.toggle()">
        <i class="fas fa-shopping-cart"></i>
        <span id="cartCount">{{ cart.count.value }}</span>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clearAuthSession, getCurrentUser } from '../api/http';
import { useCart } from '../stores/cart';

const route = useRoute();
const router = useRouter();
const cart = useCart();

const q = ref('');
const category = ref('');
const userMenuOpen = ref(false);
const user = ref(getCurrentUser());

const showCategoryFilter = computed(() => route.name === 'products');

function refreshUser() {
  user.value = getCurrentUser();
}

function goHome() {
  router.push('/');
}

function onSearch() {
  router.push({
    name: 'products',
    query: {
      ...(q.value ? { q: q.value } : {}),
      ...(category.value ? { category: category.value } : {}),
    }
  });
}

function onCategoryChange() {
  router.push({
    name: 'products',
    query: {
      ...(q.value ? { q: q.value } : {}),
      ...(category.value ? { category: category.value } : {}),
    }
  });
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value;
}

function closeUserMenu() {
  userMenuOpen.value = false;
}

function onOutsideClick() {
  if (userMenuOpen.value) userMenuOpen.value = false;
}

function logout() {
  closeUserMenu();
  clearAuthSession();
  // 登录后再决定是否迁移 guest cart
  router.push('/login');
}

onMounted(() => {
  document.addEventListener('click', onOutsideClick);
  window.addEventListener('auth-changed', refreshUser);
  refreshUser();

  q.value = (route.query.q || '').toString();
  category.value = (route.query.category || '').toString();
});

watch(
  () => route.query,
  () => {
    q.value = (route.query.q || '').toString();
    category.value = (route.query.category || '').toString();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  document.removeEventListener('click', onOutsideClick);
  window.removeEventListener('auth-changed', refreshUser);
});
</script>
