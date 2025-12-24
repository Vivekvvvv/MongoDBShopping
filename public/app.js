// Enhanced E-commerce App with Advanced Features
const productList = document.getElementById('productList');
const recommendedList = document.getElementById('recommendedList');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalElement = document.getElementById('cartTotal');
const cartCountElement = document.getElementById('cartCount');
const searchInput = document.getElementById('searchInput');

let cart = []; // 将在页面加载时通过 validateAndRepairCart 初始化
let allProducts = [];
let recommendedProducts = [];
let currentUser = null;

// API Base URL
const API_BASE = '/api';

// Global utility for escaping HTML
window.escapeHtml = function (unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Check login status on load
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('login.html')) return;

    // 修复购物车数据
    cart = repairCartData();

    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = '/login.html';
        return;
    }
    currentUser = JSON.parse(userStr);

    updateUIForUser();

    // Load recommended products first
    if (document.getElementById('recommendedList')) {
        loadRecommendedProducts();
    }

    // Load all products
    if (document.getElementById('productList') && !window.location.pathname.includes('merchant.html')) {
        loadProducts();
    }

    // Load merchant page
    if (window.location.pathname.includes('merchant.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const merchantId = urlParams.get('id');
        if (merchantId) {
            loadMerchantPage(merchantId);
        } else {
            alert('商家ID不存在');
            window.location.href = '/';
        }
    }

    updateCartUI();
});

// Search functionality
if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchProducts();
        } else {
            // 实时搜索建议
            realTimeSearch();
        }
    });
}

// Load recommended products
async function loadRecommendedProducts() {
    try {
        let url = `${API_BASE}/products/recommended`;
        if (currentUser) {
            url += `?userId=${currentUser.id}`;
        }
        const response = await fetch(url);
        const products = await response.json();
        recommendedProducts = products;
        displayRecommendedProducts(products);
    } catch (error) {
        console.error('加载推荐商品失败:', error);
        document.getElementById('recommendedList').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2em; color: #e74c3c;"></i>
                <p style="margin-top: 15px; color: #7f8c8d;">加载推荐商品失败，请刷新页面重试</p>
            </div>
        `;
    }
}

function getCartKey() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return 'cart_guest';
    try {
        const user = JSON.parse(userStr);
        return `cart_${user.id || user._id || 'guest'}`;
    } catch (e) {
        return 'cart_guest';
    }
}

// 修复现有购物车数据的函数
function repairCartData() {
    let cart = JSON.parse(localStorage.getItem(getCartKey()) || '[]');
    let repaired = false;

    // 过滤掉无效的商品项
    const originalCount = cart.length;
    cart = cart.filter(item => item && (item.name || item.productId));
    if (cart.length !== originalCount) repaired = true;

    cart = cart.map(item => {
        // 尝试找到任何可用的ID
        const id = item.productId || item._id || item.id;

        if (id) {
            // 统一所有ID字段
            if (item.productId !== id) { item.productId = id; repaired = true; }
            if (item._id !== id) { item._id = id; repaired = true; }
            if (item.id !== id) { item.id = id; repaired = true; }
        } else {
            // 如果完全没有ID，生成一个临时的，以便可以删除
            // 这种情况通常发生在旧数据迁移或数据损坏时
            const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            item.productId = tempId;
            item._id = tempId;
            item.id = tempId;
            repaired = true;
            console.warn('⚠️ 为无ID商品生成临时ID:', item.name, tempId);
        }
        return item;
    });

    if (repaired) {
        localStorage.setItem(getCartKey(), JSON.stringify(cart));
        console.log('🔧 购物车数据已修复');
    }

    return cart;
}

// Load all products with sorting
async function loadProducts(sortBy = 'createdAt') {
    // 添加刷新按钮加载状态
    const refreshBtn = document.querySelector('.btn-refresh');
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> 加载中...';
    }

    try {
        console.log(`🔄 加载商品，排序方式: ${sortBy}`);
        const category = document.getElementById('categoryFilter') ? document.getElementById('categoryFilter').value : '';
        let url = `${API_BASE}/products?sortBy=${sortBy}`;
        if (category) url += `&category=${category}`;

        console.log(`📡 请求URL: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const products = await response.json();
        console.log(`✅ 成功加载 ${products.length} 个商品`);

        // 验证商品数据
        const validProducts = products.filter(p => p && p._id && p.name);
        if (validProducts.length !== products.length) {
            console.warn(`⚠️ 发现 ${products.length - validProducts.length} 个无效商品数据`);
        }

        allProducts = validProducts;

        // 商品加载完成后，验证和修复购物车数据
        cart = validateAndRepairCart();
        updateCartUI();

        // 显示排序信息
        if (sortBy !== 'createdAt') {
            console.log(`📊 商品排序示例 (前3个):`);
            validProducts.slice(0, 3).forEach((p, i) => {
                console.log(`  ${i + 1}. ${p.name}: ¥${p.price}, 库存: ${p.stock || 0}, 销量: ${p.salesCount || 0}`);
            });
        }

        displayProducts(validProducts);
    } catch (error) {
        console.error('❌ 加载商品失败:', error);
        document.getElementById('productList').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2em; color: #e74c3c;"></i>
                <h3 style="color: #e74c3c; margin: 10px 0;">加载商品失败</h3>
                <p style="margin-top: 10px; color: #7f8c8d;">错误信息: ${error.message}</p>
                <button onclick="loadProducts('${sortBy}')" style="margin-top: 15px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    <i class="fas fa-redo"></i> 重试
                </button>
            </div>
        `;
    } finally {
        // 恢复刷新按钮状态
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新商品';
        }
    }
}

// Display recommended products
function displayRecommendedProducts(products) {
    if (!recommendedList) return;

    if (products.length === 0) {
        recommendedList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-box-open" style="font-size: 2em; color: #95a5a6;"></i>
                <p style="margin-top: 15px; color: #7f8c8d;">暂无推荐商品</p>
            </div>
        `;
        return;
    }

    recommendedList.innerHTML = products.map(product => createProductCard(product, true)).join('');
}

// Display products with enhanced info
function displayProducts(products, searchQuery = '') {
    if (!productList) return;

    if (products.length === 0) {
        productList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-search" style="font-size: 2em; color: #95a5a6;"></i>
                <p style="margin-top: 15px; color: #7f8c8d;">未找到匹配的商品</p>
            </div>
        `;
        return;
    }

    productList.innerHTML = products.map(product => createProductCard(product, false, searchQuery)).join('');
}

// Enhanced product card creation
function createProductCard(product, isRecommended = false, searchQuery = '') {
    const merchantInfo = product.merchantId ? product.merchantId.merchantInfo : null;

    // 高亮搜索关键词
    const highlightText = (text, query) => {
        if (!query || !text) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark style="background: linear-gradient(135deg, #fff3cd, #ffeaa7); color: #2c3e50; padding: 2px 4px; border-radius: 3px;">$1</mark>');
    };
    const supplierInfo = product.supplierId ? product.supplierId.merchantInfo : null;
    const rating = supplierInfo ? supplierInfo.rating || 5 : (merchantInfo ? merchantInfo.rating || 5 : 5);

    // 安全获取库存值
    const stock = product.stock || 0;
    const salesCount = product.salesCount || 0;

    // 库存状态判断
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock < 10;

    // 库存颜色
    const stockColor = isOutOfStock ? '#dc3545' : (isLowStock ? '#ffc107' : '#28a745');
    const stockIcon = isOutOfStock ? 'fas fa-times-circle' : (isLowStock ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle');
    const stockText = isOutOfStock ? '缺货' : (isLowStock ? `仅剩 ${stock} 件` : '库存充足');

    // Check if current user is owner or admin
    let canDelete = false;
    if (currentUser) {
        if (currentUser.role === 'admin') {
            canDelete = true;
        } else if (currentUser.role === 'merchant' && product.merchantId) {
            const pMerchantId = product.merchantId._id || product.merchantId;
            if (pMerchantId === currentUser.id) {
                canDelete = true;
            }
        }
    }

    return `
        <div class="product-card ${isRecommended ? 'recommended' : ''}" style="position: relative;">
            ${canDelete ? `
            <button onclick="deleteProduct('${product._id}', event)" style="position: absolute; top: 10px; right: 10px; background: rgba(231, 76, 60, 0.9); color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; z-index: 100; display: flex; align-items: center; justify-content: center;" title="删除商品">
                <i class="fas fa-trash"></i>
            </button>
            ` : ''}
            ${isRecommended ? '<div class="recommended-badge"><i class="fas fa-star"></i> 推荐</div>' : ''}
            ${isOutOfStock ? '<div class="out-of-stock-overlay"><span>缺货</span></div>' : ''}
            <div style="display: block;">
                <img src="${product.imageUrl}" alt="${product.name}" class="product-image" style="${isOutOfStock ? 'filter: grayscale(50%);' : ''}">
            </div>
            <div class="product-info" onclick="trackProductView('${product._id}')">
                <div style="text-decoration: none; color: inherit;">
                    <h3 class="product-title" style="${isOutOfStock ? 'color: #6c757d;' : ''}">${highlightText(product.name, searchQuery)}</h3>
                </div>
                <p class="product-description" style="${isOutOfStock ? 'color: #adb5bd;' : ''}">${highlightText(product.description, searchQuery)}</p>

                <!-- 供应商信息 -->
                <div class="supplier-info" style="margin: 8px 0; padding: 8px; background: #f0f8ff; border-radius: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: #6c757d; font-size: 0.9em;">
                            <i class="fas fa-store"></i> 
                            <a href="merchant.html?id=${product.merchantId ? (product.merchantId._id || product.merchantId) : ''}" 
                               style="color: #3498db; text-decoration: none; font-weight: bold;"
                               onclick="event.stopPropagation();">
                                ${supplierInfo ? supplierInfo.shopName : (merchantInfo ? merchantInfo.shopName : (product.merchant || '官方供应商'))}
                            </a>
                        </span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="color: #ffc107;">${'★'.repeat(Math.floor(rating))}</span>
                            <span style="color: #6c757d; font-size: 0.8em;">(${rating})</span>
                        </div>
                    </div>
                </div>

                <!-- 商品统计 -->
                <div class="product-stats" style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 0.85em;">
                    <span style="color: #28a745;">
                        <i class="fas fa-shopping-cart"></i> 销量: ${salesCount}
                    </span>
                    <span style="color: ${stockColor}; font-weight: ${isLowStock || isOutOfStock ? 'bold' : 'normal'};">
                        <i class="${stockIcon}"></i> 库存: ${stock}
                    </span>
                </div>

                <!-- 商品编号 -->
                <div class="product-code" style="color: #6c757d; font-size: 0.8em; margin: 4px 0;">
                    编号: ${product.productCode || 'N/A'}
                </div>

                <div class="product-footer">
                    <span class="product-price" style="${isOutOfStock ? 'color: #6c757d; text-decoration: line-through;' : ''}">¥${product.price}</span>
                    <button class="add-to-cart-btn"
                            onclick="addToCart('${product._id}')"
                            ${isOutOfStock ? 'disabled style="background: #6c757d; cursor: not-allowed;"' : ''}
                            title="${isOutOfStock ? '商品缺货' : stockText}">
                        ${isOutOfStock ? '缺货' : (isLowStock ? '抢购' : '加入购物车')}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Enhanced search with real-time suggestions
async function realTimeSearch() {
    if (!searchInput) return;
    const query = searchInput.value.trim();

    if (query.length < 2) {
        // 显示推荐商品
        if (recommendedList) {
            displayRecommendedProducts(recommendedProducts);
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/products/search?q=${encodeURIComponent(query)}`);
        const products = await response.json();

        // 显示搜索结果在推荐区域
        if (recommendedList) {
            if (products.length > 0) {
                recommendedList.innerHTML = `
                    <div style="grid-column: 1/-1; margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px; text-align: center;">
                        <h3 style="margin: 0 0 8px 0; color: #1976d2;">
                            <i class="fas fa-search"></i> 搜索结果: "${query}"
                        </h3>
                        <p style="margin: 0; color: #666;">找到 ${products.length} 个相关商品</p>
                    </div>
                ` + products.map(product => createProductCard(product, false)).join('');
            } else {
                recommendedList.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <i class="fas fa-search" style="font-size: 2em; color: #95a5a6;"></i>
                        <p style="margin-top: 15px; color: #7f8c8d;">未找到与 "${query}" 相关的商品</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('搜索失败:', error);
    }
}

// Enhanced search function
async function searchProducts() {
    if (!searchInput) return;
    const query = searchInput.value.trim();

    if (!query) {
        loadProducts();
        return;
    }

    // 显示搜索加载状态
    if (productList) {
        productList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-search fa-spin" style="font-size: 2em; color: #3498db;"></i>
                <p style="margin-top: 15px; color: #7f8c8d;">正在搜索 "${query}" 相关商品...</p>
            </div>
        `;
    }

    try {
        const category = document.getElementById('categoryFilter') ? document.getElementById('categoryFilter').value : '';
        let url = `${API_BASE}/products?search=${encodeURIComponent(query)}`;
        if (category) url += `&category=${category}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const products = await response.json();

        // 显示搜索结果
        displayProducts(products, query);

        // 显示搜索统计
        if (productList && products.length > 0) {
            const searchStats = document.createElement('div');
            searchStats.className = 'search-stats';
            searchStats.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);';
            searchStats.innerHTML = `
                <h3 style="margin: 0 0 8px 0; color: white;">
                    <i class="fas fa-search"></i> 搜索结果
                </h3>
                <p style="margin: 0; color: rgba(255,255,255,0.9);">找到 <strong>${products.length}</strong> 个与 <strong>"${query}"</strong> 相关的商品</p>
                <button onclick="clearSearch()" style="margin-top: 10px; padding: 6px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; color: white; cursor: pointer; font-size: 12px; transition: all 0.3s ease;">
                    <i class="fas fa-times"></i> 清除搜索
                </button>
            `;
            productList.insertBefore(searchStats, productList.firstChild);
        } else if (products.length === 0) {
            // 无搜索结果
            if (productList) {
                productList.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                        <i class="fas fa-search" style="font-size: 3em; color: #bdc3c7; margin-bottom: 20px;"></i>
                        <h3 style="color: #7f8c8d; margin-bottom: 15px;">未找到相关商品</h3>
                        <p style="color: #95a5a6; margin-bottom: 20px;">试试搜索其他关键词，如"书"、"台灯"、"耳机"等</p>
                        <div style="max-width: 400px; margin: 0 auto;">
                            <h4 style="color: #7f8c8d; margin-bottom: 10px;">热门搜索：</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
                                ${['书', '台灯', '耳机', '键盘', 'T恤', '夹克', '抱枕', '音箱', '面霜', '蜡烛'].map(keyword =>
                    `<button onclick="quickSearch('${keyword}')" style="padding: 4px 12px; background: #ecf0f1; border: none; border-radius: 15px; color: #2c3e50; cursor: pointer; font-size: 12px; transition: all 0.3s ease;">${keyword}</button>`
                ).join('')}
                            </div>
                        </div>
                        <button onclick="clearSearch()" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 25px; cursor: pointer;">
                            <i class="fas fa-arrow-left"></i> 返回全部商品
                        </button>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('搜索失败:', error);
        if (productList) {
            productList.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2em; color: #e74c3c;"></i>
                    <h3 style="color: #e74c3c; margin: 10px 0;">搜索失败</h3>
                    <p style="margin-top: 10px; color: #7f8c8d;">错误信息: ${error.message}</p>
                    <button onclick="searchProducts('${query}')" style="margin-top: 15px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                </div>
            `;
        }
    }
}

// 快速搜索
function quickSearch(keyword) {
    if (searchInput) {
        searchInput.value = keyword;
        searchProducts();
    }
}

// 清除搜索
function clearSearch() {
    if (searchInput) {
        searchInput.value = '';
    }
    loadProducts();
}

// Sort products
function sortProducts() {
    const sortBy = document.getElementById('sortBy').value;
    console.log(`🔀 用户选择排序: ${sortBy}`);

    // 显示加载状态
    const productList = document.getElementById('productList');
    if (productList) {
        productList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2em; color: #3498db;"></i>
                <p style="margin-top: 15px; color: #7f8c8d;">正在排序商品...</p>
            </div>
        `;
    }

    // 延迟执行以显示加载状态
    setTimeout(() => {
        loadProducts(sortBy);
    }, 300);
}

// 追踪商品浏览
async function trackProductView(productId) {
    if (!currentUser) return;

    try {
        await fetch(`${API_BASE}/products/${productId}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        console.log(`👁️ 记录浏览: ${productId}`);
    } catch (error) {
        console.error('记录浏览失败:', error);
    }
}

// Filter by category
function filterByCategory() {
    const category = document.getElementById('categoryFilter').value;
    const sortByElement = document.getElementById('sortBy');
    const sortBy = sortByElement ? sortByElement.value : 'createdAt'; // 默认排序

    loadProducts(sortBy);
}

// Enhanced add to cart
function addToCart(productId, quantity = 1) {
    if (!currentUser) {
        alert('请先登录');
        return;
    }

    const product = allProducts.find(p => p._id === productId) || recommendedProducts.find(p => p._id === productId);
    if (!product) return;

    if (product.stock <= 0) {
        alert('商品库存不足');
        return;
    }

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        if (existingItem.quantity >= product.stock) {
            alert('已达到库存上限');
            return;
        }
        existingItem.quantity += quantity;
    } else {
        cart.push({
            productId: productId,
            _id: product._id, // 确保包含原始ID
            id: product._id,  // 备用ID字段
            name: product.name,
            price: product.price,
            quantity: quantity,
            merchant: product.merchant,
            stock: product.stock
        });
    }

    saveCart();
    updateCartUI();

    // 显示添加成功提示
    showNotification(`✅ ${product.name} 已加入购物车`);
}

// Enhanced checkout with address selection
async function checkout() {
    if (!currentUser) {
        alert('请先登录');
        return;
    }

    // 确保 cart 是有效数组
    if (!Array.isArray(cart)) {
        console.error('❌ 购物车数据损坏，正在修复...');
        cart = validateAndRepairCart();
        updateCartUI();
    }

    if (!cart || cart.length === 0) {
        alert('购物车是空的');
        return;
    }

    // 检查库存
    for (const item of cart) {
        if (item.quantity > item.stock) {
            showStockInsufficientModal(item.name, item.stock);
            return;
        }
    }

    try {
        // 获取用户地址
        const addresses = await getUserAddresses();
        let selectedAddress = null;

        if (addresses && addresses.length > 0) {
            // 检查是否有默认地址
            const defaultAddress = addresses.find(addr => addr.isDefault);

            if (defaultAddress) {
                // 如果有默认地址，直接使用
                selectedAddress = defaultAddress;
            } else {
                // 显示地址选择对话框
                selectedAddress = await showAddressSelectionDialog(addresses);
            }
        } else {
            // 提示用户添加地址
            if (confirm('您还没有添加收货地址，是否现在添加？')) {
                selectedAddress = await showAddAddressDialog();
            }
        }

        if (!selectedAddress) {
            return; // 用户取消了操作
        }

        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // 调试日志：打印原始购物车数据
        console.log('🛒 原始购物车数据:');
        console.log('  - cart 类型:', typeof cart);
        console.log('  - cart 是否为数组:', Array.isArray(cart));
        console.log('  - cart 长度:', cart ? cart.length : 'N/A');
        console.log('  - cart 内容:', JSON.stringify(cart, null, 2));

        // 构建订单商品列表，过滤无效项并确保数据完整性
        const orderItems = cart
            .filter(item => {
                const isValid = item && (item._id || item.productId) && item.quantity > 0;
                if (!isValid) {
                    console.warn('⚠️ 过滤掉无效商品项:', item);
                }
                return isValid;
            })
            .map(item => ({
                productId: item._id || item.productId,
                name: item.name || '未知商品',
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || 1
            }));

        // 调试日志：打印处理后的订单商品列表
        console.log('📦 处理后的 orderItems:');
        console.log('  - orderItems 类型:', typeof orderItems);
        console.log('  - orderItems 是否为数组:', Array.isArray(orderItems));
        console.log('  - orderItems 长度:', orderItems ? orderItems.length : 'N/A');
        console.log('  - orderItems 内容:', JSON.stringify(orderItems, null, 2));

        // 验证订单商品列表
        if (!orderItems || orderItems.length === 0) {
            alert('购物车中没有有效商品，请刷新页面后重试');
            return;
        }

        // 直接提交订单，跳过支付确认
        // 确保 items 是真正的数组（防止被序列化为对象）
        const orderData = {
            userId: currentUser.id,
            items: Array.from(orderItems), // 使用 Array.from 确保是真正的数组
            shippingAddress: selectedAddress,
            paymentMethod: '免支付', // 跳过支付
            remarks: document.getElementById('orderRemarks') ? document.getElementById('orderRemarks').value : ''
        };

        console.log('📤 最终提交的 orderData:');
        console.log('  - orderData.items 是否为数组:', Array.isArray(orderData.items));
        console.log('  - 完整数据:', JSON.stringify(orderData, null, 2));

        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            const result = await response.json();

            // 显示订单成功信息和详情
            showOrderSuccessModal(result);

            cart = [];
            saveCart();
            updateCartUI();
            toggleCart();
        } else {
            const error = await response.json();
            alert('下单失败: ' + error.message);
        }
    } catch (error) {
        console.error('下单失败:', error);
        alert('下单失败，请重试');
    }
}

// 显示库存不足提示
function showStockInsufficientModal(productName, availableStock) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%;
        text-align: center;
    `;

    content.innerHTML = `
        <div style="color: #dc3545; font-size: 3em; margin-bottom: 20px;">
            <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h2 style="color: #dc3545; margin: 0 0 20px 0;">库存不足</h2>
        <p style="color: #6c757d; margin: 0 0 30px 0;">
            商品 <strong>${productName}</strong> 库存不足<br>
            当前库存：<span style="color: #dc3545; font-weight: bold;">${availableStock}</span> 件
        </p>

        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #721c24;">
                <i class="fas fa-info-circle"></i>
                请减少购买数量或选择其他商品
            </p>
        </div>

        <button onclick="this.closest('.modal').remove()" style="
            background: #dc3545; color: white; border: none; padding: 12px 30px;
            border-radius: 5px; cursor: pointer; font-weight: bold;
        ">
            <i class="fas fa-shopping-cart"></i> 返回购物车
        </button>
    `;

    modal.className = 'modal';
    modal.appendChild(content);
    document.body.appendChild(modal);

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 显示订单成功信息
function showOrderSuccessModal(result) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;
        max-height: 80vh; overflow-y: auto; text-align: center;
    `;

    const order = result.order;
    const logistics = result.logistics;

    content.innerHTML = `
        <div style="color: #28a745; font-size: 3em; margin-bottom: 20px;">
            <i class="fas fa-check-circle"></i>
        </div>
        <h2 style="color: #2c3e50; margin: 0 0 20px 0;">订单提交成功！</h2>
        <p style="color: #6c757d; margin: 0 0 30px 0;">感谢您的购买，订单正在处理中</p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: left; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin: 0 0 15px 0; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                <i class="fas fa-receipt"></i> 订单信息
            </h3>
            <div style="margin-bottom: 10px;"><strong>订单号：</strong>${order.orderNumber}</div>
            <div style="margin-bottom: 10px;"><strong>下单时间：</strong>${new Date(order.createdAt).toLocaleString()}</div>
            <div style="margin-bottom: 10px;"><strong>订单状态：</strong><span style="color: #28a745; font-weight: bold;">待发货</span></div>
            <div style="margin-bottom: 10px;"><strong>支付方式：</strong>免支付</div>
            <div style="margin-bottom: 10px;"><strong>订单总额：</strong><span style="color: #e74c3c; font-weight: bold; font-size: 1.1em;">¥${order.total}</span></div>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: left; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin: 0 0 15px 0; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                <i class="fas fa-truck"></i> 物流信息
            </h3>
            <div style="margin-bottom: 10px;"><strong>物流单号：</strong>${logistics.trackingNumber}</div>
            <div style="margin-bottom: 10px;"><strong>物流公司：</strong>${logistics.company}</div>
            <div style="margin-bottom: 10px;"><strong>发货地址：</strong>${logistics.origin.province} ${logistics.origin.city} ${logistics.origin.district}</div>
            <div style="margin-bottom: 10px;"><strong>收货地址：</strong>${logistics.destination.province} ${logistics.destination.city} ${logistics.destination.district} ${logistics.destination.detail}</div>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
                <i class="fas fa-info-circle"></i>
                您的订单已成功提交，我们将尽快为您安排发货。如有疑问请联系客服。
            </p>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 30px;">
            <button onclick="this.closest('.modal').remove(); window.location.href='orders.html'" style="
                background: #3498db; color: white; border: none; padding: 12px 24px;
                border-radius: 5px; cursor: pointer; font-weight: bold;
            ">
                <i class="fas fa-list"></i> 查看我的订单
            </button>
            <button onclick="this.closest('.modal').remove()" style="
                background: #6c757d; color: white; border: none; padding: 12px 24px;
                border-radius: 5px; cursor: pointer;
            ">
                <i class="fas fa-shopping-bag"></i> 继续购物
            </button>
        </div>
    `;

    modal.className = 'modal';
    modal.appendChild(content);
    document.body.appendChild(modal);

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // 30秒后自动跳转到订单页面
    let countdown = 30;
    const countdownElement = document.createElement('div');
    countdownElement.style.cssText = 'position: absolute; top: 20px; right: 20px; background: #f8f9fa; padding: 10px 15px; border-radius: 5px; font-size: 14px; color: #6c757d;';
    content.appendChild(countdownElement);

    const countdownInterval = setInterval(() => {
        countdown--;
        countdownElement.innerHTML = `<i class="fas fa-clock"></i> ${countdown}秒后自动跳转到订单页面`;

        if (countdown <= 0) {
            clearInterval(countdownInterval);
            window.location.href = 'orders.html';
        }
    }, 1000);
}

// Get user addresses
async function getUserAddresses() {
    try {
        const response = await fetch(`${API_BASE}/addresses/${currentUser.id}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('获取地址失败:', error);
    }
    return [];
}

// Show address selection dialog
function showAddressSelectionDialog(addresses) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;
            max-height: 80vh; overflow-y: auto;
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #2c3e50;">
                <i class="fas fa-map-marker-alt"></i> 选择收货地址
            </h3>
            <div class="address-list">
                ${addresses.map((addr, index) => `
                    <div class="address-option" onclick="selectAddress(${index})" style="
                        border: 2px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; cursor: pointer;
                        ${addr.isDefault ? 'border-color: #3498db; background: #e3f2fd;' : ''}
                    ">
                        ${addr.isDefault ? '<span style="color: #3498db; font-weight: bold;">[默认]</span>' : ''}
                        <div style="font-weight: bold; margin-bottom: 5px;">${addr.name} ${addr.phone}</div>
                        <div style="color: #666;">${addr.province} ${addr.city} ${addr.district} ${addr.detail}</div>
                        <div style="color: #999; font-size: 0.9em; margin-top: 5px;">标签: ${addr.tag || '其他'}</div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="cancelAddressSelection()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 5px; cursor: pointer;">
                    取消
                </button>
                <button onclick="addNewAddress()" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    添加新地址
                </button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        window.selectAddress = (index) => {
            resolve(addresses[index]);
            document.body.removeChild(modal);
            delete window.selectAddress;
            delete window.cancelAddressSelection;
            delete window.addNewAddress;
        };

        window.cancelAddressSelection = () => {
            resolve(null);
            document.body.removeChild(modal);
            delete window.selectAddress;
            delete window.cancelAddressSelection;
            delete window.addNewAddress;
        };

        window.addNewAddress = () => {
            showAddAddressDialog().then(address => {
                if (address) {
                    resolve(address);
                } else {
                    // 重新显示选择对话框
                    document.body.removeChild(modal);
                    showAddressSelectionDialog(addresses).then(resolve);
                }
            });
        };
    });
}

// Show add address dialog
function showAddAddressDialog() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #2c3e50;">
                <i class="fas fa-plus"></i> 添加收货地址
            </h3>
            <form id="addressForm">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">收货人 *</label>
                    <input type="text" name="name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">手机号 *</label>
                    <input type="tel" name="phone" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">省份 *</label>
                    <input type="text" name="province" required placeholder="如：广东省" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">城市 *</label>
                    <input type="text" name="city" required placeholder="如：深圳市" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">区县 *</label>
                    <input type="text" name="district" required placeholder="如：南山区" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">详细地址 *</label>
                    <textarea name="detail" required placeholder="如：科技园南区A座1201室" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; height: 60px;"></textarea>
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">标签</label>
                    <select name="tag" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="家">家</option>
                        <option value="公司">公司</option>
                        <option value="学校">学校</option>
                        <option value="其他">其他</option>
                    </select>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" name="isDefault" style="margin-right: 8px;">
                        设为默认地址
                    </label>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="cancelAddAddress()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 5px; cursor: pointer;">
                        取消
                    </button>
                    <button type="submit" style="padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        保存地址
                    </button>
                </div>
            </form>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        const form = document.getElementById('addressForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const addressData = {
                userId: currentUser.id,
                name: formData.get('name'),
                phone: formData.get('phone'),
                province: formData.get('province'),
                city: formData.get('city'),
                district: formData.get('district'),
                detail: formData.get('detail'),
                tag: formData.get('tag'),
                isDefault: formData.get('isDefault') === 'on'
            };

            try {
                const response = await fetch(`${API_BASE}/addresses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(addressData)
                });

                if (response.ok) {
                    const savedAddress = await response.json();
                    resolve(savedAddress);
                    document.body.removeChild(modal);
                } else {
                    alert('保存地址失败');
                }
            } catch (error) {
                console.error('保存地址失败:', error);
                alert('保存地址失败，请重试');
            }
        });

        window.cancelAddAddress = () => {
            resolve(null);
            document.body.removeChild(modal);
            delete window.cancelAddAddress;
        };
    });
}

// Show order details
async function showOrderDetails(order) {
    try {
        const response = await fetch(`${API_BASE}/orders/${order._id}`);
        const data = await response.json();

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%;
            max-height: 80vh; overflow-y: auto;
        `;

        const logistics = data.logistics;

        content.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #2c3e50;">
                <i class="fas fa-file-invoice"></i> 订单详情
            </h3>

            <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50;">订单信息</h4>
                <p style="margin: 5px 0;"><strong>订单号:</strong> ${order.orderNumber}</p>
                <p style="margin: 5px 0;"><strong>状态:</strong> <span style="color: #28a745;">${order.status}</span></p>
                <p style="margin: 5px 0;"><strong>总金额:</strong> ¥${order.total}</p>
                <p style="margin: 5px 0;"><strong>下单时间:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
            </div>

            ${logistics ? `
                <div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #1976d2;">
                        <i class="fas fa-truck"></i> 物流信息
                    </h4>
                    <p style="margin: 5px 0;"><strong>快递公司:</strong> ${logistics.carrier}</p>
                    <p style="margin: 5px 0;"><strong>物流单号:</strong> ${logistics.trackingNumber}</p>
                    <p style="margin: 5px 0;"><strong>当前状态:</strong> <span style="color: #28a745;">${logistics.status}</span></p>
                    <p style="margin: 5px 0;"><strong>预计送达:</strong> ${new Date(logistics.estimatedDelivery).toLocaleDateString()}</p>
                </div>
            ` : ''}

            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #2c3e50;">商品列表</h4>
                ${order.items.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                        <div>
                            <div style="font-weight: bold;">${item.name}</div>
                            <div style="color: #666; font-size: 0.9em;">${item.merchant || '官方'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div>¥${item.price} × ${item.quantity}</div>
                            <div style="font-weight: bold;">¥${item.price * item.quantity}</div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="text-align: center;">
                <button onclick="closeOrderDetails()" style="padding: 10px 30px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    确定
                </button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        window.closeOrderDetails = () => {
            document.body.removeChild(modal);
            delete window.closeOrderDetails;
        };
    } catch (error) {
        console.error('获取订单详情失败:', error);
        alert('获取订单详情失败');
    }
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: #28a745; color: white; padding: 15px 20px;
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// User menu functions
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

// Close user menu when clicking outside
document.addEventListener('click', (e) => {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');

    if (userMenu && !userMenu.contains(e.target) && dropdown) {
        dropdown.style.display = 'none';
    }
});

// Existing functions (kept for compatibility)
function updateUIForUser() {
    if (!currentUser) return;

    // Update user name in navigation
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.textContent = currentUser.name;
    }

    // Update user info in UI
    const userElements = document.querySelectorAll('.user-info');
    userElements.forEach(el => {
        if (el.classList.contains('user-info') && !el.querySelector('.user-name')) {
            el.textContent = currentUser.name;
        }
    });

    // Rebuild User Dropdown Menu
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) {
        // Clear existing content
        userDropdown.innerHTML = '';

        // 1. Profile (Common)
        const profileLink = document.createElement('a');
        profileLink.href = 'profile.html';
        profileLink.className = 'dropdown-item';
        profileLink.innerHTML = '<i class="fas fa-user-circle"></i>个人中心';
        userDropdown.appendChild(profileLink);

        // 2. My Orders (Common)
        const ordersLink = document.createElement('a');
        ordersLink.href = 'orders.html';
        ordersLink.className = 'dropdown-item';
        ordersLink.innerHTML = '<i class="fas fa-shopping-bag"></i>我的订单';
        userDropdown.appendChild(ordersLink);

        // 3. Address Management (Common)
        const addressLink = document.createElement('a');
        addressLink.href = 'address.html';
        addressLink.className = 'dropdown-item';
        addressLink.innerHTML = '<i class="fas fa-map-marker-alt"></i>地址管理';
        userDropdown.appendChild(addressLink);

        // 4. Shop Management (Admin Only)
        if (currentUser.role === 'admin') {
            const shopLink = document.createElement('a');
            shopLink.href = 'shops.html';
            shopLink.className = 'dropdown-item';
            shopLink.innerHTML = '<i class="fas fa-store"></i>店铺管理';
            userDropdown.appendChild(shopLink);
        }

        // 5. Publish Product (Admin & Merchant)
        if (currentUser.role === 'admin' || currentUser.role === 'merchant') {
            const addProductLink = document.createElement('a');
            addProductLink.href = 'add-product.html';
            addProductLink.className = 'dropdown-item';
            addProductLink.innerHTML = '<i class="fas fa-plus-circle"></i>发布商品';
            userDropdown.appendChild(addProductLink);
        }

        // 5.5 Data Analysis (Admin & Merchant)
        if (currentUser.role === 'admin') {
            const statsLink = document.createElement('a');
            statsLink.href = 'admin.html#statsSection';
            statsLink.className = 'dropdown-item';
            statsLink.innerHTML = '<i class="fas fa-chart-line"></i>数据分析';
            userDropdown.appendChild(statsLink);
        } else if (currentUser.role === 'merchant') {
            const statsLink = document.createElement('a');
            statsLink.href = 'merchant-dashboard.html#analytics-tab';
            statsLink.className = 'dropdown-item';
            statsLink.innerHTML = '<i class="fas fa-chart-line"></i>数据分析';
            userDropdown.appendChild(statsLink);
        }

        // 6. Logout (Common)
        const logoutLink = document.createElement('a');
        logoutLink.href = '#';
        logoutLink.onclick = function (e) { e.preventDefault(); logout(); };
        logoutLink.className = 'dropdown-item logout';
        logoutLink.innerHTML = '<i class="fas fa-sign-out-alt"></i>退出登录';
        userDropdown.appendChild(logoutLink);
    }

    // Show balance if available
    const balanceElement = document.getElementById('userBalance');
    if (balanceElement && currentUser.balance !== undefined) {
        balanceElement.textContent = `¥${currentUser.balance}`;
    }
}

// Logout function
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    currentUser = null;
    window.location.href = '/login.html';
}

// Show my orders
function showMyOrders() {
    window.location.href = '/orders.html';
}

// Show address management
function showAddressManagement() {
    window.location.href = '/address.html';
}

function updateCartUI() {
    updateCartDisplay();
    updateCartCount();
}

function updateCartDisplay() {
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">购物车是空的</p>';
        if (cartTotalElement) cartTotalElement.textContent = '¥0';
        return;
    }

    let html = '';
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        // 确保使用有效的ID
        const itemId = item.productId || item._id || item.id;

        html += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p style="color: #666; font-size: 0.9em;">${item.merchant || '官方'}</p>
                    <p>¥${item.price} × ${item.quantity}</p>
                </div>
                <div class="cart-item-controls">
                    <button onclick="updateQuantity('${itemId}', ${item.quantity - 1})">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity('${itemId}', ${item.quantity + 1})">+</button>
                    <button onclick="removeFromCart('${itemId}')" style="color: red;">删除</button>
                </div>
            </div>
        `;
    });

    cartItemsContainer.innerHTML = html;
    if (cartTotalElement) cartTotalElement.textContent = `¥${total}`;
}

function updateCartCount() {
    if (!cartCountElement) return;

    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountElement.textContent = count;
    cartCountElement.style.display = count > 0 ? 'block' : 'none';
}

function updateQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    const item = cart.find(item =>
        item.productId === productId ||
        item._id === productId ||
        item.id === productId
    );
    if (item && newQuantity <= item.stock) {
        item.quantity = newQuantity;
        saveCart();
        updateCartUI();
    } else if (item && newQuantity > item.stock) {
        alert('已达到库存上限');
    }
}

function removeFromCart(productId) {
    console.log('尝试删除商品 ID:', productId);
    console.log('删除前购物车:', cart);

    // 更强大的删除逻辑，处理多种可能的ID情况
    const originalLength = cart.length;
    cart = cart.filter(item => {
        // 检查所有可能的ID字段
        return item.productId !== productId &&
            item._id !== productId &&
            item.id !== productId;
    });

    console.log('删除后购物车:', cart);
    console.log('删除了', originalLength - cart.length, '个商品');

    saveCart();
    updateCartUI();

    // 显示删除成功提示
    if (originalLength > cart.length) {
        showNotification('🗑️ 商品已从购物车移除');
    } else {
        showNotification('❌ 未能从购物车中删除商品');
    }
}

// 清空购物车功能
function clearCart() {
    if (cart.length === 0) {
        showNotification('🛒 购物车已经是空的');
        return;
    }

    // 确认对话框
    const isConfirmed = confirm('确定要清空购物车中的所有商品吗？此操作不可撤销。');

    if (isConfirmed) {
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        cart = [];
        saveCart();
        updateCartUI();
        showNotification(`✅ 已清空购物车，移除了 ${itemCount} 件商品`);
    }
}

// 增强的购物车数据修复和验证功能
function validateAndRepairCart() {
    let cart = JSON.parse(localStorage.getItem(getCartKey()) || '[]');
    let repaired = false;
    let removedItems = [];

    // 第一步：基础数据修复
    const originalCount = cart.length;
    cart = cart.filter(item => item && (item.name || item.productId));
    if (cart.length !== originalCount) {
        repaired = true;
        removedItems.push(originalCount - cart.length + '个无效商品项');
    }

    // 第二步：ID字段统一和验证
    cart = cart.map(item => {
        const id = item.productId || item._id || item.id;

        if (id) {
            // 统一所有ID字段
            if (item.productId !== id) { item.productId = id; repaired = true; }
            if (item._id !== id) { item._id = id; repaired = true; }
            if (item.id !== id) { item.id = id; repaired = true; }
        } else {
            // 如果完全没有ID，生成一个临时的
            const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            item.productId = tempId;
            item._id = tempId;
            item.id = tempId;
            repaired = true;
            console.warn('⚠️ 为无ID商品生成临时ID:', item.name, tempId);
        }
        return item;
    });

    // 第三步：验证商品是否在当前商品列表中存在
    if (allProducts && allProducts.length > 0) {
        const validProductIds = new Set(allProducts.map(p => p._id));
        const validCart = cart.filter(item => {
            const itemId = item.productId || item._id || item.id;
            const isValid = validProductIds.has(itemId);

            if (!isValid && item.name) {
                console.warn('⚠️ 购物车中的商品不存在于商品列表中:', item.name, itemId);
                removedItems.push(item.name);
            }

            return isValid;
        });

        if (validCart.length !== cart.length) {
            repaired = true;
            cart = validCart;
        }
    }

    // 第四步：验证库存
    cart = cart.map(item => {
        if (item.stock && item.quantity > item.stock) {
            console.warn('⚠️ 购物车商品数量超过库存:', item.name, '库存:', item.stock, '数量:', item.quantity);
            item.quantity = item.stock; // 调整为最大库存
            repaired = true;
        }
        return item;
    });

    if (repaired) {
        localStorage.setItem(getCartKey(), JSON.stringify(cart));
        console.log('🔧 购物车数据已修复和验证');
        if (removedItems.length > 0) {
            showNotification(`⚠️ 购物车已清理，移除了无效商品: ${removedItems.join(', ')}`);
        }
    }

    return cart;
}

function saveCart() {
    localStorage.setItem(getCartKey(), JSON.stringify(cart));
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}


// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .product-card.recommended {
        border: 2px solid #ff6b6b;
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.2);
    }

    .recommended-badge {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #ff6b6b;
        color: white;
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 0.8em;
        font-weight: bold;
        z-index: 10;
    }

    .address-option:hover {
        border-color: #3498db !important;
        background: #f8f9fa !important;
    }

    .merchant-info {
        transition: all 0.3s ease;
    }

    .product-stats {
        font-family: Arial, sans-serif;
    }

    .product-code {
        font-family: monospace;
        background: #f1f3f4;
        padding: 2px 6px;
        border-radius: 3px;
        display: inline-block;
    }

    .product-detail-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 20px;
    }

    .detail-image-container {
        text-align: center;
    }

    .detail-image {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .detail-info {
        padding: 15px;
        background: #f9f9f9;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 15px;
    }

    .meta-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.9em;
        color: #555;
    }

    .detail-price {
        font-size: 1.5em;
        font-weight: bold;
        color: #e74c3c;
        margin-bottom: 15px;
    }

    .detail-description {
        margin-bottom: 15px;
    }

    .merchant-card {
        padding: 15px;
        background: #e3f2fd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .merchant-card h4 {
        margin: 0 0 10px 0;
        color: #2c3e50;
    }

    .merchant-card a {
        display: inline-block;
        margin-top: 10px;
        padding: 8px 15px;
        background: #3498db;
        color: white;
        border-radius: 5px;
        text-decoration: none;
        font-size: 0.9em;
        transition: background 0.3s ease;
    }

    .merchant-card a:hover {
        background: #2980b9;
    }

    .detail-actions {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .quantity-selector {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .quantity-btn {
        background: #3498db;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.9em;
        transition: background 0.3s ease;
    }

    .quantity-btn:hover {
        background: #2980b9;
    }

    .quantity-input {
        width: 60px;
        text-align: center;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 0.9em;
    }

    .btn-primary {
        background: #3498db;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 1em;
        transition: background 0.3s ease;
    }

    .btn-primary:hover {
        background: #2980b9;
    }

    .btn-secondary {
        background: #f0f8ff;
        color: #3498db;
        border: 1px solid #3498db;
        padding: 8px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 0.9em;
        transition: all 0.3s ease;
    }

    .btn-secondary:hover {
        background: #3498db;
        color: white;
    }
`;
document.head.appendChild(style);

// Load merchant page details
async function loadMerchantPage(merchantId) {
    try {
        // Load merchant info
        const merchantRes = await fetch(`${API_BASE}/merchants/${merchantId}`);
        if (!merchantRes.ok) throw new Error('获取商家信息失败');
        const merchant = await merchantRes.json();

        const info = merchant.merchantInfo || {};
        document.getElementById('shopName').textContent = info.shopName || merchant.name;
        document.getElementById('shopDesc').textContent = info.shopDescription || '暂无介绍';
        document.getElementById('shopRating').textContent = info.rating || '5.0';
        document.getElementById('shopSales').textContent = info.totalSales || '0';
        document.getElementById('shopPhone').textContent = info.contactPhone || '暂无联系方式';

        // Load merchant products
        const productsRes = await fetch(`${API_BASE}/products/merchant/${merchantId}`);
        const products = await productsRes.json();

        allProducts = products; // Store for cart functionality
        displayProducts(products);

    } catch (error) {
        console.error('加载店铺失败:', error);
        document.querySelector('.container').innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <i class="fas fa-exclamation-circle" style="font-size: 3em; color: #e74c3c;"></i>
                <h3>加载店铺失败</h3>
                <p>${error.message}</p>
                <button onclick="window.location.href='/'" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">返回首页</button>
            </div>
        `;
    }
}

// Load product detail page
async function loadProductDetail(productId) {
    const container = document.getElementById('productDetailContainer');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/products/${productId}`);
        if (!response.ok) throw new Error('获取商品详情失败');

        const product = await response.json();
        allProducts = [product]; // Ensure addToCart works

        const merchantInfo = product.merchantId ? product.merchantId.merchantInfo : null;
        const supplierInfo = product.supplierId ? product.supplierId.merchantInfo : null;
        const displayMerchant = supplierInfo || merchantInfo || { shopName: product.merchant || '官方自营' };

        // Stock status logic
        const stock = product.stock || 0;
        const isOutOfStock = stock <= 0;
        const isLowStock = stock > 0 && stock < 10;
        const stockColor = isOutOfStock ? '#dc3545' : (isLowStock ? '#ffc107' : '#28a745');
        const stockText = isOutOfStock ? '缺货' : (isLowStock ? `仅剩 ${stock} 件` : '库存充足');

        container.innerHTML = `
            <div class="product-detail-grid">
                <div class="detail-image-container">
                    <img src="${product.imageUrl}" alt="${product.name}" class="detail-image" style="${isOutOfStock ? 'filter: grayscale(50%);' : ''}">
                </div>
                <div class="detail-info">
                    <h1>${product.name}</h1>
                    <div class="product-code" style="margin-bottom: 15px;">编号: ${product.productCode || 'N/A'}</div>

                    <div class="detail-meta">
                        <div class="meta-item">
                            <i class="fas fa-shopping-bag"></i>
                            <span>销量: <strong>${product.salesCount || 0}</strong></span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-box"></i>
                            <span style="color: ${stockColor}">${stockText}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-tag"></i>
                            <span>${product.category}</span>
                        </div>
                    </div>

                    <div class="detail-price">¥${product.price}</div>

                    <div class="detail-description">
                        <h3>商品详情</h3>
                        <p>${product.description}</p>
                    </div>

                    <div class="merchant-card">
                        <h4 style="margin: 0 0 10px 0; color: #2c3e50;">
                            <i class="fas fa-store" style="color: #3498db;"></i> 商家信息
                        </h4>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1em;">${displayMerchant.shopName}</div>
                                <div style="color: #7f8c8d; font-size: 0.9em; margin-top: 5px;">${displayMerchant.shopDescription || '暂无简介'}</div>
                            </div>
                            <a href="merchant.html?id=${product.merchantId ? (product.merchantId._id || product.merchantId) : ''}"
                               class="btn btn-secondary" style="padding: 8px 15px; font-size: 0.9em;">
                                进店逛逛
                            </a>
                        </div>
                    </div>

                    <div class="detail-actions">
                        <div class="quantity-selector">
                            <button class="quantity-btn" onclick="adjustDetailQuantity(-1)">-</button>
                            <input type="text" id="detailQuantity" class="quantity-input" value="1" readonly>
                            <button class="quantity-btn" onclick="adjustDetailQuantity(1, ${stock})">+</button>
                        </div>
                        <button class="btn btn-primary btn-lg"
                                onclick="addToCart('${product._id}', parseInt(document.getElementById('detailQuantity').value))"
                                ${isOutOfStock ? 'disabled style="background: #95a5a6; cursor: not-allowed;"' : ''}>
                            <i class="fas fa-shopping-cart"></i> ${isOutOfStock ? '暂时缺货' : '加入购物车'}
                        </button>
                    </div>
                </div>
            </div>

            <!-- 商品评价区域 -->
            <div class="product-reviews-section" id="reviewsSection">
                <div class="reviews-header">
                    <h2><i class="fas fa-star"></i> 商品评价</h2>
                    <div class="reviews-summary" id="reviewsSummary">
                        <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>
                    </div>
                </div>
                <div class="reviews-filter" id="reviewsFilter"></div>
                <div class="reviews-list" id="reviewsList">
                    <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 正在加载评价...</div>
                </div>
                <div class="reviews-pagination" id="reviewsPagination"></div>
            </div>
        `;

        // 加载商品评价
        loadProductReviews(productId);

    } catch (error) {
        console.error('加载详情失败:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3em; color: #e74c3c;"></i>
                <h3>加载商品详情失败</h3>
                <p>${error.message}</p>
                <button onclick="window.location.reload()" class="btn btn-primary" style="margin-top: 20px;">重试</button>
            </div>
        `;
    }
}

// 加载商品评价
async function loadProductReviews(productId, page = 1, sort = 'newest', rating = '') {
    const reviewsList = document.getElementById('reviewsList');
    const reviewsSummary = document.getElementById('reviewsSummary');
    const reviewsFilter = document.getElementById('reviewsFilter');
    const reviewsPagination = document.getElementById('reviewsPagination');

    try {
        const queryParams = new URLSearchParams({
            page,
            limit: 5,
            sort
        });
        if (rating) queryParams.append('rating', rating);

        const response = await fetch(`${API_BASE}/reviews/product/${productId}?${queryParams}`);
        const data = await response.json();

        // 渲染评分统计
        const { stats } = data;
        const ratingBars = [5, 4, 3, 2, 1].map(r => {
            const dist = stats.ratingDistribution.find(d => d._id === r) || { count: 0 };
            const percentage = stats.totalCount > 0 ? (dist.count / stats.totalCount * 100).toFixed(0) : 0;
            return `
                <div class="rating-bar-row" onclick="filterByRating('${productId}', ${r})">
                    <span class="rating-label">${r}星</span>
                    <div class="rating-bar">
                        <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="rating-count">${dist.count}</span>
                </div>
            `;
        }).join('');

        reviewsSummary.innerHTML = `
            <div class="rating-overview">
                <div class="rating-score">
                    <span class="score-value">${stats.avgRating}</span>
                    <div class="score-stars">
                        ${generateStars(parseFloat(stats.avgRating))}
                    </div>
                    <span class="total-reviews">${stats.totalCount} 条评价</span>
                </div>
                <div class="rating-distribution">
                    ${ratingBars}
                </div>
            </div>
        `;

        // 渲染筛选器
        reviewsFilter.innerHTML = `
            <div class="filter-tabs">
                <button class="filter-tab ${!rating ? 'active' : ''}" onclick="filterByRating('${productId}', '')">全部</button>
                <button class="filter-tab ${rating === '5' ? 'active' : ''}" onclick="filterByRating('${productId}', 5)">好评</button>
                <button class="filter-tab ${rating === '3' ? 'active' : ''}" onclick="filterByRating('${productId}', 3)">中评</button>
                <button class="filter-tab ${rating === '1' ? 'active' : ''}" onclick="filterByRating('${productId}', 1)">差评</button>
            </div>
            <div class="sort-tabs">
                <select onchange="sortReviews('${productId}', this.value)">
                    <option value="newest" ${sort === 'newest' ? 'selected' : ''}>最新</option>
                    <option value="highest" ${sort === 'highest' ? 'selected' : ''}>评分最高</option>
                    <option value="lowest" ${sort === 'lowest' ? 'selected' : ''}>评分最低</option>
                    <option value="helpful" ${sort === 'helpful' ? 'selected' : ''}>最有帮助</option>
                </select>
            </div>
        `;

        // 渲染评价列表
        if (data.reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="no-reviews">
                    <i class="fas fa-comment-slash"></i>
                    <p>暂无评价${rating ? '符合筛选条件' : ''}</p>
                </div>
            `;
        } else {
            reviewsList.innerHTML = data.reviews.map(review => `
                <div class="review-card">
                    <div class="review-header">
                        <div class="reviewer-info">
                            <div class="reviewer-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="reviewer-details">
                                <span class="reviewer-name">${review.userId?.name || '匿名用户'}</span>
                                <span class="review-date">${new Date(review.createdAt).toLocaleDateString('zh-CN')}</span>
                            </div>
                        </div>
                        <div class="review-rating">
                            ${generateStars(review.rating)}
                            <span class="rating-tag ${review.tag === '好评' ? 'tag-good' : review.tag === '中评' ? 'tag-medium' : 'tag-bad'}">${review.tag}</span>
                        </div>
                    </div>
                    <div class="review-content">
                        ${escapeHtml(review.content)}
                    </div>
                    ${review.images && review.images.length > 0 ? `
                        <div class="review-images">
                            ${review.images.map(img => `<img src="${img}" alt="评价图片" onclick="viewImage(this.src)">`).join('')}
                        </div>
                    ` : ''}
                    ${review.merchantReply ? `
                        <div class="merchant-reply">
                            <div class="reply-header"><i class="fas fa-store"></i> 商家回复</div>
                            <div class="reply-content">${escapeHtml(review.merchantReply.content)}</div>
                        </div>
                    ` : ''}
                    <div class="review-footer">
                        <button class="like-btn" onclick="likeReview('${review._id}')">
                            <i class="fas fa-thumbs-up"></i> 有帮助 (${review.likes || 0})
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // 渲染分页
        const { pagination } = data;
        if (pagination.totalPages > 1) {
            let paginationHtml = '';
            for (let i = 1; i <= pagination.totalPages; i++) {
                paginationHtml += `
                    <button class="page-btn ${i === pagination.currentPage ? 'active' : ''}"
                            onclick="loadProductReviews('${productId}', ${i}, '${sort}', '${rating}')">
                        ${i}
                    </button>
                `;
            }
            reviewsPagination.innerHTML = paginationHtml;
        } else {
            reviewsPagination.innerHTML = '';
        }

    } catch (error) {
        console.error('加载评价失败:', error);
        reviewsList.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>加载评价失败，请稍后重试</p>
            </div>
        `;
    }
}

// 生成星星HTML
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) {
            stars += '<i class="fas fa-star" style="color: #ffc107;"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="fas fa-star-half-alt" style="color: #ffc107;"></i>';
        } else {
            stars += '<i class="far fa-star" style="color: #dee2e6;"></i>';
        }
    }
    return stars;
}

// 筛选评价
window.filterByRating = function(productId, rating) {
    const sortSelect = document.querySelector('.sort-tabs select');
    const sort = sortSelect ? sortSelect.value : 'newest';
    loadProductReviews(productId, 1, sort, rating);
};

// 排序评价
window.sortReviews = function(productId, sort) {
    const activeTab = document.querySelector('.filter-tab.active');
    const rating = activeTab ? activeTab.getAttribute('data-rating') || '' : '';
    loadProductReviews(productId, 1, sort, rating);
};

// 点赞评价
window.likeReview = async function(reviewId) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!currentUser.id) {
        alert('请先登录后再点赞');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/reviews/${reviewId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });

        const result = await response.json();
        if (response.ok) {
            // 刷新当前页面的评价
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id');
            if (productId) {
                loadProductReviews(productId);
            }
        } else {
            alert(result.message || '操作失败');
        }
    } catch (error) {
        console.error('点赞失败:', error);
    }
};

// Helper for quantity adjustment in detail page
window.adjustDetailQuantity = function (delta, maxStock) {
    const input = document.getElementById('detailQuantity');
    let newValue = parseInt(input.value) + delta;
    if (newValue < 1) newValue = 1;
    if (maxStock && newValue > maxStock) {
        alert('已达到最大库存限制');
        newValue = maxStock;
    }
    input.value = newValue;
};

// Delete product
async function deleteProduct(productId, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!confirm('确定要删除这个商品吗？此操作不可恢复。')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('商品已删除');
            // Refresh page
            window.location.reload();
        } else {
            let errorMessage;
            try {
                const data = await response.json();
                errorMessage = data.message;
            } catch (e) {
                console.error('Failed to parse error response:', e);
                errorMessage = `请求失败 (${response.status} ${response.statusText})`;
            }
            alert('删除失败: ' + (errorMessage || '未知错误'));
        }
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败: ' + error.message);
    }
}
