<template>
  <div class="cart-sidebar" :class="{ open: cart.isOpen.value }">
    <div class="cart-header">
      <h3 style="margin:0;">购物车</h3>
      <button type="button" class="close-cart" @click="cart.close()">×</button>
    </div>

    <div class="cart-items">
      <div v-if="cart.items.value.length === 0" class="empty-cart">购物车为空</div>

      <div v-for="item in cart.items.value" :key="item.productId" class="cart-item">
        <div class="cart-item-info">
          <h4>{{ item.name }}</h4>
          <div style="opacity:0.85; font-size: 0.9rem;">¥ {{ formatMoney(item.price) }}</div>
        </div>

        <div class="cart-item-controls">
          <button type="button" @click="cart.decrement(item.productId)">-</button>
          <span>{{ item.quantity }}</span>
          <button type="button" @click="cart.increment(item.productId)">+</button>
        </div>
      </div>
    </div>

    <div class="cart-footer">
      <div style="display:flex; justify-content: space-between; align-items:center;">
        <div style="font-weight:700;">合计</div>
        <div style="font-weight:700; color:#e74c3c;">¥ {{ formatMoney(cart.total.value) }}</div>
      </div>

      <div class="cart-actions">
        <button type="button" class="clear-cart-btn" @click="onClear" :disabled="busy || cart.items.value.length === 0">
          清空
        </button>
        <button type="button" class="checkout-btn" @click="openCheckout" :disabled="busy || cart.items.value.length === 0">
          去结算
        </button>
      </div>

      <p v-if="error" style="margin: 10px 0 0; color:#b00020;">{{ error }}</p>
    </div>

    <div v-if="checkoutOpen" class="modal" @click.self="closeCheckout">
      <div class="modal-content">
        <div class="modal-header">
          <h3 style="margin:0;">确认下单</h3>
        </div>

        <div class="modal-body">
          <p v-if="!user" style="opacity:0.8;">你还未登录，请先登录。</p>

          <template v-else>
            <div class="form-group">
              <label>选择收货地址</label>
              <select v-model="selectedAddressId">
                <option value="">请选择</option>
                <option v-for="a in addresses" :key="a._id" :value="a._id">
                  {{ a.name }} {{ a.phone }} - {{ a.province }}{{ a.city }}{{ a.district }}{{ a.detail }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>备注</label>
              <textarea v-model.trim="remarks" placeholder="选填"></textarea>
            </div>

            <p v-if="addrLoading" style="opacity:0.8;">地址加载中...</p>
            <p v-if="addrError" style="color:#b00020;">{{ addrError }}</p>
          </template>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeCheckout">取消</button>
          <button type="button" class="btn btn-primary" @click="confirmCheckout" :disabled="busy || !canSubmit">
            {{ busy ? '提交中...' : '提交订单' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch, getCurrentUser } from '../api/http';
import { useCart } from '../stores/cart';

const cart = useCart();
const router = useRouter();

const error = ref('');
const busy = ref(false);

const checkoutOpen = ref(false);
const addresses = ref([]);
const addrLoading = ref(false);
const addrError = ref('');
const selectedAddressId = ref('');
const remarks = ref('');

const userRef = ref(getCurrentUser());
const user = computed(() => userRef.value);

function refreshUser() {
  userRef.value = getCurrentUser();
}

const canSubmit = computed(() => {
  if (!user.value) return false;
  if (!selectedAddressId.value) return false;
  return cart.items.value.length > 0;
});

function formatMoney(v) {
  const n = Number(v) || 0;
  return n.toFixed(2);
}

function onClear() {
  if (!confirm('确认清空购物车？')) return;
  cart.clear();
}

async function loadAddresses() {
  const u = user.value;
  if (!u?._id) {
    addresses.value = [];
    selectedAddressId.value = '';
    return;
  }

  addrLoading.value = true;
  addrError.value = '';
  try {
    const list = await apiFetch(`/api/addresses/${encodeURIComponent(u._id)}`);
    addresses.value = Array.isArray(list) ? list : [];
    // 尝试默认选第一个
    if (!selectedAddressId.value && addresses.value.length) {
      selectedAddressId.value = addresses.value.find((x) => x.isDefault)?._id || addresses.value[0]._id;
    }
  } catch (e) {
    addrError.value = e?.message || '地址加载失败';
    addresses.value = [];
  } finally {
    addrLoading.value = false;
  }
}

function openCheckout() {
  error.value = '';

  if (!user.value) {
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
    return;
  }

  checkoutOpen.value = true;
  loadAddresses();
}

function closeCheckout() {
  checkoutOpen.value = false;
}

async function confirmCheckout() {
  error.value = '';
  busy.value = true;
  try {
    const address = addresses.value.find((x) => x._id === selectedAddressId.value);
    const result = await cart.checkout({ shippingAddress: address, remarks: remarks.value });
    closeCheckout();
    cart.close();
    remarks.value = '';

    // 下单成功后跳到订单页
    router.push('/orders');
    return result;
  } catch (e) {
    error.value = e?.message || '下单失败';
  } finally {
    busy.value = false;
  }
}

watch(
  () => cart.isOpen.value,
  (open) => {
    if (!open) {
      checkoutOpen.value = false;
    }
  }
);

onMounted(() => {
  window.addEventListener('auth-changed', refreshUser);
  refreshUser();
});

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', refreshUser);
});
</script>
