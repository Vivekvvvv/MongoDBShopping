import { computed, ref } from 'vue';
import { apiFetch, getCurrentUser } from '../api/http';

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getUserId(user) {
  return user?.id || user?._id || '';
}

export function getCartKey(userOverride) {
  const user = userOverride || getCurrentUser();
  const userId = getUserId(user);
  return userId ? `cart_${userId}` : 'cart_guest';
}

function repairCartData(raw) {
  const list = Array.isArray(raw) ? raw : [];

  const filtered = list.filter((item) => item && (item.name || item.productId || item._id || item.id));
  return filtered.map((item) => {
    const id = item.productId || item._id || item.id;
    const quantity = Number(item.quantity) || 1;

    return {
      ...item,
      productId: id,
      _id: id,
      id,
      quantity: quantity > 0 ? quantity : 1,
    };
  });
}

const isOpen = ref(false);
const items = ref([]);
const lastCartKey = ref(getCartKey());

function loadFromStorage(cartKey) {
  try {
    const raw = localStorage.getItem(cartKey);
    const parsed = raw ? safeJsonParse(raw) : [];
    return repairCartData(parsed || []);
  } catch {
    return [];
  }
}

function saveToStorage(cartKey, list) {
  try {
    localStorage.setItem(cartKey, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function setItems(nextItems) {
  items.value = repairCartData(nextItems);
  saveToStorage(lastCartKey.value, items.value);
}

function ensureLoadedFor(userOverride) {
  const key = getCartKey(userOverride);
  if (key === lastCartKey.value && items.value.length) return;

  lastCartKey.value = key;
  items.value = loadFromStorage(key);
}

function mergeCarts(fromKey, toKey) {
  const from = loadFromStorage(fromKey);
  const to = loadFromStorage(toKey);

  const mergedById = new Map();
  for (const item of to) mergedById.set(item.productId, { ...item });
  for (const item of from) {
    const existing = mergedById.get(item.productId);
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + (Number(item.quantity) || 0);
      mergedById.set(item.productId, existing);
    } else {
      mergedById.set(item.productId, { ...item });
    }
  }

  const merged = Array.from(mergedById.values()).filter((x) => (Number(x.quantity) || 0) > 0);
  saveToStorage(toKey, merged);
  saveToStorage(fromKey, []);
  return merged;
}

export function useCart() {
  // 作为单例 store：多处调用返回同一个响应式对象

  function setUser(user) {
    ensureLoadedFor(user);
  }

  function open() {
    ensureLoadedFor();
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    if (isOpen.value) close();
    else open();
  }

  function clear() {
    setItems([]);
  }

  function remove(productId) {
    setItems(items.value.filter((x) => x.productId !== productId));
  }

  function setQuantity(productId, quantity) {
    const q = Math.max(1, Number(quantity) || 1);
    setItems(
      items.value.map((x) => (x.productId === productId ? { ...x, quantity: q } : x))
    );
  }

  function increment(productId) {
    const found = items.value.find((x) => x.productId === productId);
    if (!found) return;
    setQuantity(productId, (Number(found.quantity) || 0) + 1);
  }

  function decrement(productId) {
    const found = items.value.find((x) => x.productId === productId);
    if (!found) return;
    const next = (Number(found.quantity) || 0) - 1;
    if (next <= 0) remove(productId);
    else setQuantity(productId, next);
  }

  function addProduct(product, quantity = 1) {
    ensureLoadedFor();

    const productId = product?.productId || product?._id || product?.id;
    if (!productId) return;

    const q = Math.max(1, Number(quantity) || 1);
    const existing = items.value.find((x) => x.productId === productId);
    if (existing) {
      setQuantity(productId, (Number(existing.quantity) || 0) + q);
      return;
    }

    const next = [
      ...items.value,
      {
        productId,
        name: product?.name || '未命名商品',
        price: Number(product?.price) || 0,
        imageUrl: product?.imageUrl || '',
        quantity: q,
      },
    ];
    setItems(next);
  }

  async function checkout({ shippingAddress, remarks = '' } = {}) {
    const user = getCurrentUser();
    const userId = getUserId(user);
    if (!userId) {
      const err = new Error('请先登录再下单');
      err.code = 'NOT_LOGGED_IN';
      throw err;
    }

    if (!shippingAddress) {
      const err = new Error('请选择收货地址');
      err.code = 'NO_ADDRESS';
      throw err;
    }

    ensureLoadedFor(user);

    if (!items.value.length) {
      const err = new Error('购物车为空');
      err.code = 'EMPTY_CART';
      throw err;
    }

    const payload = {
      userId,
      items: items.value.map((x) => ({ productId: x.productId, quantity: x.quantity })),
      shippingAddress: {
        name: shippingAddress.name,
        phone: shippingAddress.phone,
        province: shippingAddress.province,
        city: shippingAddress.city,
        district: shippingAddress.district,
        detail: shippingAddress.detail,
        postalCode: shippingAddress.postalCode,
      },
      remarks,
    };

    const result = await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    clear();
    return result;
  }

  function migrateGuestCartToUser(user) {
    const userKey = getCartKey(user);
    const guestKey = 'cart_guest';
    if (userKey === guestKey) return;

    const merged = mergeCarts(guestKey, userKey);
    lastCartKey.value = userKey;
    items.value = merged;
  }

  const count = computed(() => items.value.reduce((sum, x) => sum + (Number(x.quantity) || 0), 0));
  const total = computed(() => items.value.reduce((sum, x) => sum + (Number(x.price) || 0) * (Number(x.quantity) || 0), 0));

  // 初次加载
  ensureLoadedFor();

  return {
    isOpen,
    items,
    count,
    total,

    setUser,
    open,
    close,
    toggle,

    addProduct,
    increment,
    decrement,
    setQuantity,
    remove,
    clear,

    checkout,
    migrateGuestCartToUser,
  };
}
