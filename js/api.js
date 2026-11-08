/**
 * ZzidulyaDLC - API Client
 * Supports dual deployment: direct Starlette server or static GitHub Pages with external backend.
 */
const API = (() => {
  // Configurable base URL: if hosted on GitHub Pages or custom domain,
  // it reads window.BACKEND_URL from localStorage or uses current origin
  const getBaseUrl = () => {
    return localStorage.getItem('zzd_backend_url') || window.BACKEND_URL || window.location.origin;
  };

  const getUserToken = () => localStorage.getItem('zzd_user_token') || '';
  const setUserToken = (t) => t ? localStorage.setItem('zzd_user_token', t) : localStorage.removeItem('zzd_user_token');

  const getAdminToken = () => localStorage.getItem('zzd_admin_token') || '';
  const setAdminToken = (t) => t ? localStorage.setItem('zzd_admin_token', t) : localStorage.removeItem('zzd_admin_token');

  async function request(endpoint, options = {}) {
    const url = `${getBaseUrl()}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (options.asAdmin && getAdminToken()) {
      headers['Authorization'] = `Bearer ${getAdminToken()}`;
    } else if (getUserToken()) {
      headers['Authorization'] = `Bearer ${getUserToken()}`;
    }

    try {
      const resp = await fetch(url, { credentials: 'include', ...options, headers });
      const contentType = resp.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        return { ok: resp.ok, status: resp.status, data };
      }
      return { ok: resp.ok, status: resp.status, text: await resp.text() };
    } catch (err) {
      return { ok: false, status: 0, error: err.message || 'Ошибка подключения к серверу' };
    }
  }

  return {
    getBaseUrl,
    setBaseUrl: (url) => localStorage.setItem('zzd_backend_url', url),
    getUserToken,
    setUserToken,
    getAdminToken,
    setAdminToken,

    // Public
    getPublicInfo: () => request('/api/public-info'),

    // User Auth
    register: (username, password) => request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
    login: (username, password) => request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
    logout: () => {
      setUserToken('');
      return request('/api/auth/logout', { method: 'POST' });
    },
    getMe: () => request('/api/auth/me'),
    redeemKey: (key) => request('/api/auth/redeem-key', {
      method: 'POST',
      body: JSON.stringify({ key })
    }),

    // Download URL builder
    getDownloadUrl: () => `${getBaseUrl()}/api/download`,

    // Admin
    adminLogin: (password) => request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    }),
    adminLogout: () => {
      setAdminToken('');
      return request('/api/admin/logout', { method: 'POST', asAdmin: true });
    },
    adminMe: () => request('/api/admin/me', { asAdmin: true }),
    adminStats: () => request('/api/admin/stats', { asAdmin: true }),
    adminUsers: (search = '') => request(`/api/admin/users${search ? '?search=' + encodeURIComponent(search) : ''}`, { asAdmin: true }),
    adminUserAction: (action, user_id, extra = {}) => request('/api/admin/users/action', {
      method: 'POST',
      asAdmin: true,
      body: JSON.stringify({ action, user_id, ...extra })
    }),
    adminGetKeys: () => request('/api/admin/keys', { asAdmin: true }),
    adminGenerateKeys: (count, duration_days) => request('/api/admin/keys', {
      method: 'POST',
      asAdmin: true,
      body: JSON.stringify({ count, duration_days })
    }),
    adminDeleteKey: (keyId) => request(`/api/admin/keys/${keyId}`, {
      method: 'DELETE',
      asAdmin: true
    }),
    adminArchiveStatus: () => request('/api/admin/archive/status', { asAdmin: true }),
    adminRebuildArchive: () => request('/api/admin/archive/rebuild', {
      method: 'POST',
      asAdmin: true
    }),
    adminChangePassword: (current_password, new_password) => request('/api/admin/change-password', {
      method: 'POST',
      asAdmin: true,
      body: JSON.stringify({ current_password, new_password })
    })
  };
})();
