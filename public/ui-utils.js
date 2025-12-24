/**
 * UI Utils - Toast notifications, Skeleton screens, Search enhancements
 * Using SweetAlert2 for beautiful notifications
 */

// =====================
// Toast Notifications
// =====================

const Toast = {
  // Default toast configuration
  default: Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  }),

  // Success toast
  success(message, title = '') {
    this.default.fire({
      icon: 'success',
      title: title || message,
      text: title ? message : undefined
    });
  },

  // Error toast
  error(message, title = '操作失败') {
    this.default.fire({
      icon: 'error',
      title: title,
      text: message
    });
  },

  // Warning toast
  warning(message, title = '警告') {
    this.default.fire({
      icon: 'warning',
      title: title,
      text: message
    });
  },

  // Info toast
  info(message, title = '提示') {
    this.default.fire({
      icon: 'info',
      title: title,
      text: message
    });
  },

  // Loading toast (with spinner)
  loading(message = '加载中...') {
    return Swal.fire({
      title: message,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  },

  // Close loading toast
  closeLoading() {
    Swal.close();
  }
};

// =====================
// Confirmation Dialogs
// =====================

const Confirm = {
  // Basic confirmation
  async show(title, text, options = {}) {
    const result = await Swal.fire({
      title: title,
      text: text,
      icon: options.icon || 'question',
      showCancelButton: true,
      confirmButtonColor: options.confirmColor || '#3085d6',
      cancelButtonColor: options.cancelColor || '#d33',
      confirmButtonText: options.confirmText || '确认',
      cancelButtonText: options.cancelText || '取消',
      reverseButtons: true
    });
    return result.isConfirmed;
  },

  // Danger confirmation (for delete, etc.)
  async danger(title, text) {
    return this.show(title, text, {
      icon: 'warning',
      confirmColor: '#d33',
      confirmText: '确认删除'
    });
  },

  // Success confirmation
  async success(title, text) {
    return this.show(title, text, {
      icon: 'success',
      confirmText: '好的'
    });
  }
};

// =====================
// Skeleton Screen
// =====================

const Skeleton = {
  // Generate skeleton card HTML
  card(count = 1) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-card">
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text short"></div>
            <div class="skeleton skeleton-price"></div>
          </div>
        </div>
      `;
    }
    return html;
  },

  // Generate skeleton list item HTML
  listItem(count = 1) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += `
        <div class="skeleton-list-item">
          <div class="skeleton skeleton-avatar"></div>
          <div class="skeleton-info">
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
          </div>
        </div>
      `;
    }
    return html;
  },

  // Generate skeleton table row HTML
  tableRow(columns = 5, count = 5) {
    let html = '';
    for (let i = 0; i < count; i++) {
      html += '<tr class="skeleton-row">';
      for (let j = 0; j < columns; j++) {
        html += '<td><div class="skeleton skeleton-cell"></div></td>';
      }
      html += '</tr>';
    }
    return html;
  },

  // Show skeleton in container
  show(container, type = 'card', count = 4) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    el.classList.add('skeleton-loading');

    switch (type) {
      case 'card':
        el.innerHTML = `<div class="skeleton-grid">${this.card(count)}</div>`;
        break;
      case 'list':
        el.innerHTML = this.listItem(count);
        break;
      case 'table':
        el.innerHTML = this.tableRow(5, count);
        break;
      default:
        el.innerHTML = this.card(count);
    }
  },

  // Hide skeleton
  hide(container) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (el) {
      el.classList.remove('skeleton-loading');
    }
  }
};

// =====================
// Search Enhancement
// =====================

const SearchEnhancer = {
  debounceTimer: null,
  searchHistory: [],
  maxHistory: 10,

  // Initialize search enhancement
  init(inputSelector, options = {}) {
    const input = document.querySelector(inputSelector);
    if (!input) return;

    this.loadHistory();

    // Create autocomplete dropdown
    const wrapper = document.createElement('div');
    wrapper.className = 'search-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.id = 'searchDropdown';
    wrapper.appendChild(dropdown);

    // Input event listener with debounce
    input.addEventListener('input', (e) => {
      this.debounce(() => {
        if (options.onSearch) {
          options.onSearch(e.target.value);
        }
        this.showSuggestions(e.target.value, dropdown, options);
      }, options.debounceMs || 300);
    });

    // Focus event - show history
    input.addEventListener('focus', () => {
      if (!input.value.trim()) {
        this.showHistory(dropdown, input, options);
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Enter key to search
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        this.addToHistory(input.value.trim());
        dropdown.style.display = 'none';
        if (options.onSubmit) {
          options.onSubmit(input.value.trim());
        }
      }
    });
  },

  // Debounce function
  debounce(func, wait) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(func, wait);
  },

  // Show search suggestions
  async showSuggestions(query, dropdown, options) {
    if (!query.trim()) {
      this.showHistory(dropdown, null, options);
      return;
    }

    // Fetch suggestions if callback provided
    let suggestions = [];
    if (options.fetchSuggestions) {
      try {
        suggestions = await options.fetchSuggestions(query);
      } catch (e) {
        console.error('Failed to fetch suggestions:', e);
      }
    }

    if (suggestions.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = suggestions.map(item => `
      <div class="search-suggestion-item" data-value="${item.text || item}">
        <i class="fas fa-search"></i>
        <span>${this.highlightMatch(item.text || item, query)}</span>
      </div>
    `).join('');

    // Click handler for suggestions
    dropdown.querySelectorAll('.search-suggestion-item').forEach(el => {
      el.addEventListener('click', () => {
        const value = el.dataset.value;
        const input = document.querySelector(options.inputSelector || 'input[type="search"]');
        if (input) input.value = value;
        this.addToHistory(value);
        dropdown.style.display = 'none';
        if (options.onSubmit) {
          options.onSubmit(value);
        }
      });
    });

    dropdown.style.display = 'block';
  },

  // Show search history
  showHistory(dropdown, input, options) {
    if (this.searchHistory.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = `
      <div class="search-history-header">
        <span>搜索历史</span>
        <button onclick="SearchEnhancer.clearHistory()" class="clear-history-btn">清空</button>
      </div>
      ${this.searchHistory.map(item => `
        <div class="search-history-item" data-value="${item}">
          <i class="fas fa-history"></i>
          <span>${item}</span>
          <button class="remove-history-btn" data-item="${item}" onclick="event.stopPropagation(); SearchEnhancer.removeFromHistory('${item}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('')}
    `;

    // Click handler for history items
    dropdown.querySelectorAll('.search-history-item').forEach(el => {
      el.addEventListener('click', () => {
        const value = el.dataset.value;
        if (input) input.value = value;
        dropdown.style.display = 'none';
        if (options && options.onSubmit) {
          options.onSubmit(value);
        }
      });
    });

    dropdown.style.display = 'block';
  },

  // Highlight matching text
  highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  },

  // Add to search history
  addToHistory(query) {
    if (!query.trim()) return;
    // Remove if already exists
    this.searchHistory = this.searchHistory.filter(h => h !== query);
    // Add to beginning
    this.searchHistory.unshift(query);
    // Limit history size
    if (this.searchHistory.length > this.maxHistory) {
      this.searchHistory.pop();
    }
    this.saveHistory();
  },

  // Remove from history
  removeFromHistory(item) {
    this.searchHistory = this.searchHistory.filter(h => h !== item);
    this.saveHistory();
    // Refresh dropdown
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown && dropdown.style.display !== 'none') {
      this.showHistory(dropdown, null, {});
    }
  },

  // Clear all history
  clearHistory() {
    this.searchHistory = [];
    this.saveHistory();
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    Toast.success('搜索历史已清空');
  },

  // Save history to localStorage
  saveHistory() {
    localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
  },

  // Load history from localStorage
  loadHistory() {
    try {
      const saved = localStorage.getItem('searchHistory');
      if (saved) {
        this.searchHistory = JSON.parse(saved);
      }
    } catch (e) {
      this.searchHistory = [];
    }
  }
};

// =====================
// Loading Overlay
// =====================

const LoadingOverlay = {
  show(message = '加载中...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p class="loading-text">${message}</p>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.loading-text').textContent = message;
    }
    overlay.classList.add('active');
  },

  hide() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  },

  // Update loading text
  updateText(message) {
    const textEl = document.querySelector('#loadingOverlay .loading-text');
    if (textEl) {
      textEl.textContent = message;
    }
  }
};

// =====================
// Form Validation Helper
// =====================

const FormValidator = {
  // Validate email
  isEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  // Validate phone (China)
  isPhone(phone) {
    const regex = /^1[3-9]\d{9}$/;
    return regex.test(phone);
  },

  // Check password strength
  checkPassword(password) {
    const result = {
      score: 0,
      suggestions: [],
      isStrong: false
    };

    if (password.length >= 8) {
      result.score += 1;
    } else {
      result.suggestions.push('密码长度至少8个字符');
    }

    if (/[a-z]/.test(password)) {
      result.score += 1;
    } else {
      result.suggestions.push('包含小写字母');
    }

    if (/[A-Z]/.test(password)) {
      result.score += 1;
    } else {
      result.suggestions.push('包含大写字母');
    }

    if (/[0-9]/.test(password)) {
      result.score += 1;
    } else {
      result.suggestions.push('包含数字');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      result.score += 1;
    } else {
      result.suggestions.push('包含特殊字符');
    }

    result.isStrong = result.score >= 4;
    return result;
  },

  // Show inline error
  showError(input, message) {
    const wrapper = input.closest('.form-group') || input.parentElement;
    let errorEl = wrapper.querySelector('.field-error');

    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      wrapper.appendChild(errorEl);
    }

    errorEl.textContent = message;
    input.classList.add('input-error');
  },

  // Clear inline error
  clearError(input) {
    const wrapper = input.closest('.form-group') || input.parentElement;
    const errorEl = wrapper.querySelector('.field-error');

    if (errorEl) {
      errorEl.remove();
    }
    input.classList.remove('input-error');
  }
};

// =====================
// API Helper with Toast integration
// =====================

const ApiHelper = {
  // Base fetch with error handling and toast
  async fetch(url, options = {}) {
    const showLoading = options.showLoading !== false;
    const loadingMessage = options.loadingMessage || '加载中...';

    if (showLoading) {
      LoadingOverlay.show(loadingMessage);
    }

    try {
      // Add auth token if exists
      const token = localStorage.getItem('authToken');
      if (token) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        };
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '请求失败');
      }

      if (showLoading) {
        LoadingOverlay.hide();
      }

      return data;
    } catch (error) {
      if (showLoading) {
        LoadingOverlay.hide();
      }

      if (options.showError !== false) {
        Toast.error(error.message);
      }

      throw error;
    }
  },

  // GET request
  get(url, options = {}) {
    return this.fetch(url, { ...options, method: 'GET' });
  },

  // POST request
  post(url, data, options = {}) {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // PUT request
  put(url, data, options = {}) {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // DELETE request
  delete(url, options = {}) {
    return this.fetch(url, { ...options, method: 'DELETE' });
  }
};

// Export for use in other scripts
window.Toast = Toast;
window.Confirm = Confirm;
window.Skeleton = Skeleton;
window.SearchEnhancer = SearchEnhancer;
window.LoadingOverlay = LoadingOverlay;
window.FormValidator = FormValidator;
window.ApiHelper = ApiHelper;

console.log('UI Utils loaded successfully');
