export function getAuthToken() {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null;

  const normalized = { ...user };
  if (normalized.id && !normalized._id) normalized._id = normalized.id;
  if (normalized._id && !normalized.id) normalized.id = normalized._id;
  return normalized;
}

export function setAuthSession({ token, user }) {
  localStorage.setItem('token', token || '');
  localStorage.setItem('user', JSON.stringify(normalizeUser(user)));
  try {
    window.dispatchEvent(new Event('auth-changed'));
  } catch {
    // ignore
  }
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  try {
    window.dispatchEvent(new Event('auth-changed'));
  } catch {
    // ignore
  }
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeUser(parsed);
  } catch {
    return null;
  }
}

async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function apiFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const token = getAuthToken();
  const finalHeaders = {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(path, {
    method,
    headers: finalHeaders,
    body
  });

  const data = await parseJsonSafely(res);
  if (!res.ok) {
    const message = (data && data.message) ? data.message : `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
