import { createRouter, createWebHistory } from 'vue-router';

import HomeView from './views/HomeView.vue';
import LoginView from './views/LoginView.vue';
import ProductsView from './views/ProductsView.vue';
import ProductDetailView from './views/ProductDetailView.vue';
import ProfileView from './views/ProfileView.vue';
import RecommendedView from './views/RecommendedView.vue';
import ShopsView from './views/ShopsView.vue';
import ShopDetailView from './views/ShopDetailView.vue';
import OrdersView from './views/OrdersView.vue';
import AddressesView from './views/AddressesView.vue';
import MerchantDashboardView from './views/MerchantDashboardView.vue';
import AddProductView from './views/AddProductView.vue';
import AdminView from './views/AdminView.vue';

import { getCurrentUser } from './api/http';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/products', name: 'products', component: ProductsView },
    { path: '/products/:id', name: 'product-detail', component: ProductDetailView, props: true },
    { path: '/recommended', name: 'recommended', component: RecommendedView },
    { path: '/shops', name: 'shops', component: ShopsView },
    { path: '/shops/:id', name: 'shop-detail', component: ShopDetailView, props: true },

    { path: '/orders', name: 'orders', component: OrdersView, meta: { requiresAuth: true } },
    { path: '/addresses', name: 'addresses', component: AddressesView, meta: { requiresAuth: true } },
    { path: '/profile', name: 'profile', component: ProfileView, meta: { requiresAuth: true } },

    { path: '/merchant/dashboard', name: 'merchant-dashboard', component: MerchantDashboardView, meta: { requiresAuth: true, role: 'merchant' } },
    { path: '/merchant/products/new', name: 'add-product', component: AddProductView, meta: { requiresAuth: true, role: 'merchant' } },

    { path: '/admin', name: 'admin', component: AdminView, meta: { requiresAuth: true, role: 'admin' } }
  ]
});

router.beforeEach((to) => {
  const user = getCurrentUser();

  if (to.meta && to.meta.requiresAuth && !user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta && to.meta.role) {
    if (!user) return { name: 'login', query: { redirect: to.fullPath } };
    if (user.role !== to.meta.role) return { name: 'home' };
  }

  return true;
});

export default router;
