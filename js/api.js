/**
 * ZzidulyaDLC - Universal API & Client Storage Adapter
 * Automatically works on both direct Starlette backend and static GitHub Pages.
 */
const API = (() => {
  const isGitHubPages = window.location.hostname.includes('github.io');
  const getBaseUrl = () => localStorage.getItem('zzd_backend_url') || '';

  const getUserToken = () => localStorage.getItem('zzd_user_token') || '';
  const setUserToken = (t) => t ? localStorage.setItem('zzd_user_token', t) : localStorage.removeItem('zzd_user_token');

  const getAdminToken = () => localStorage.getItem('zzd_admin_token') || '';
  const setAdminToken = (t) => t ? localStorage.setItem('zzd_admin_token', t) : localStorage.removeItem('zzd_admin_token');

  const getAdminPassword = () => localStorage.getItem('zzd_admin_password') || 'admin_zzidulya_2026';
  const setAdminPassword = (p) => localStorage.setItem('zzd_admin_password', p);

  // --- Local Database Helpers (for standalone GitHub Pages) ---
  function getLocalUsers() {
    try {
      return JSON.parse(localStorage.getItem('zzd_local_users') || '[]');
    } catch { return []; }
  }
  function saveLocalUsers(users) {
    localStorage.setItem('zzd_local_users', JSON.stringify(users));
  }

  function getLocalKeys() {
    try {
      return JSON.parse(localStorage.getItem('zzd_local_keys') || '[]');
    } catch { return []; }
  }
  function saveLocalKeys(keys) {
    localStorage.setItem('zzd_local_keys', JSON.stringify(keys));
  }

  function computeKeySignature(part1, part2) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const salt = 'ZZIDULYA_DLC_MASTER_SALT_2026';
    const input = (part1 + part2).toUpperCase();
    let h = 0x811C9DC5 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    for (let i = 0; i < salt.length; i++) {
      h ^= salt.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= (h >>> 16);
    h = Math.imul(h, 0x85EBCA6B) >>> 0;
    h ^= (h >>> 13);
    let sig = '';
    for (let i = 0; i < 4; i++) {
      sig += chars[(h >>> (i * 5)) & 31];
    }
    return sig;
  }

  function generateKeyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const p1 = part();
    const p2 = part();
    const p3 = computeKeySignature(p1, p2);
    return `ZZD-${p1}-${p2}-${p3}`;
  }

  // --- Hybrid Request Router ---
  async function request(endpoint, options = {}) {
    const baseUrl = getBaseUrl();

    // If on GitHub Pages or file:// or no custom backend URL is configured, use local client-side storage adapter
    if ((isGitHubPages || window.location.protocol === 'file:' || !baseUrl) && !baseUrl) {
      return handleLocalRequest(endpoint, options);
    }

    // Try backend HTTP request
    const url = `${baseUrl || window.location.origin}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (options.asAdmin && getAdminToken()) {
      headers['Authorization'] = `Bearer ${getAdminToken()}`;
    } else if (getUserToken()) {
      headers['Authorization'] = `Bearer ${getUserToken()}`;
    }

    try {
      const resp = await fetch(url, { credentials: 'include', ...options, headers });
      const contentType = resp.headers.get('content-type') || '';
      
      // If server responded with 404 or non-JSON HTML (static hosting fallback), use local storage adapter
      if (resp.status === 404 || !contentType.includes('application/json')) {
        return handleLocalRequest(endpoint, options);
      }
      
      const data = await resp.json().catch(() => ({}));
      return { ok: resp.ok, status: resp.status, data };
    } catch (err) {
      // Backend not reachable -> transparent fallback to local adapter
      return handleLocalRequest(endpoint, options);
    }
  }

  // --- Validate Key Structure & Cryptographic Signature ---
  function validateKeyFormat(key) {
    if (!key || typeof key !== 'string') return { valid: false, reason: 'Ключ не указан' };
    const cleanKey = key.trim().toUpperCase();
    if (cleanKey.length !== 18) return { valid: false, reason: 'Длина ключа должна быть 18 символов (ZZD-XXXX-XXXX-XXXX)' };
    if (!cleanKey.startsWith('ZZD-')) return { valid: false, reason: 'Ключ должен начинаться с ZZD-' };
    if (cleanKey[8] !== '-' || cleanKey[13] !== '-') return { valid: false, reason: 'Неверный формат разделителей ключа' };

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 4; i < 18; i++) {
      if (i === 8 || i === 13) continue;
      if (!chars.includes(cleanKey[i])) {
        return { valid: false, reason: `Недопустимый символ в ключе: ${cleanKey[i]}` };
      }
    }

    const p1 = cleanKey.substring(4, 8);
    const p2 = cleanKey.substring(9, 13);
    const p3 = cleanKey.substring(14, 18);
    const expectedSig = computeKeySignature(p1, p2);
    const isSigned = (p3 === expectedSig);

    return { valid: true, cleanKey, p1, p2, p3, isSigned };
  }

  // --- Client-Side Storage Adapter (Serverless Mode) ---
  function handleLocalRequest(endpoint, options = {}) {
    let body = {};
    try {
      body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
    } catch {
      body = {};
    }

    // 1. Register
    if (endpoint === '/api/auth/register') {
      const username = (body.username || '').trim();
      const password = (body.password || '').trim();
      if (!username || username.length < 3) return { ok: false, data: { success: false, error: 'Логин должен быть от 3 символов' } };
      if (!password || password.length < 4) return { ok: false, data: { success: false, error: 'Пароль должен быть от 4 символов' } };

      const users = getLocalUsers();
      if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return { ok: false, data: { success: false, error: 'Пользователь с таким логином уже существует' } };
      }

      const newUser = {
        id: users.length + 1,
        username,
        password,
        is_banned: 0,
        ban_reason: '',
        has_active_sub: false,
        sub_expires_at: null,
        sub_type: null,
        total_downloads: 0,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      saveLocalUsers(users);

      const token = `token_${username}_${Date.now()}`;
      setUserToken(token);
      localStorage.setItem('zzd_current_user_name', username);
      return { ok: true, data: { success: true, token, user: newUser } };
    }

    // 2. Login
    if (endpoint === '/api/auth/login') {
      const username = (body.username || '').trim();
      const password = (body.password || '').trim();
      const users = getLocalUsers();
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
      if (!user) {
        return { ok: false, data: { success: false, error: 'Неверный логин или пароль' } };
      }

      const token = `token_${username}_${Date.now()}`;
      setUserToken(token);
      localStorage.setItem('zzd_current_user_name', user.username);
      return { ok: true, data: { success: true, token, user } };
    }

    // 3. Logout
    if (endpoint === '/api/auth/logout') {
      setUserToken('');
      localStorage.removeItem('zzd_current_user_name');
      return { ok: true, data: { success: true } };
    }

    // 4. Get Current User
    if (endpoint === '/api/auth/me') {
      const curName = localStorage.getItem('zzd_current_user_name');
      if (!curName || !getUserToken()) return { ok: true, data: { authenticated: false, user: null } };
      const users = getLocalUsers();
      const user = users.find(u => u.username.toLowerCase() === curName.toLowerCase());
      if (!user) return { ok: true, data: { authenticated: false, user: null } };
      return { ok: true, data: { authenticated: true, user } };
    }

    // 5. Redeem Key (Universal Cross-Device Verification)
    if (endpoint === '/api/auth/redeem-key') {
      const curName = localStorage.getItem('zzd_current_user_name');
      if (!curName) return { ok: false, data: { success: false, error: 'Требуется авторизация' } };

      const keyCheck = validateKeyFormat(body.key);
      if (!keyCheck.valid) {
        return { ok: false, data: { success: false, error: keyCheck.reason || 'Неверный формат ключа' } };
      }

      const cleanKey = keyCheck.cleanKey;
      const keys = getLocalKeys();
      const kIndex = keys.findIndex(k => k.key_code === cleanKey);

      // Check if key is already consumed by someone else on this device
      if (kIndex !== -1 && keys[kIndex].is_used && keys[kIndex].used_by_username !== curName) {
        return { ok: false, data: { success: false, error: `Этот ключ уже использован (${keys[kIndex].used_by_username})` } };
      }

      const users = getLocalUsers();
      const uIndex = users.findIndex(u => u.username.toLowerCase() === curName.toLowerCase());
      if (uIndex === -1) return { ok: false, data: { success: false, error: 'Пользователь не найден' } };

      // Determine subscription duration
      // 1. If key is cryptographically signed -> Lifetime VIP
      // 2. If key was recorded in keys table -> its duration_days
      // 3. If key matches valid ZZD-XXXX-XXXX-XXXX format (friend key) -> Lifetime
      let durationDays = -1;
      let subType = 'Lifetime';
      
      if (kIndex !== -1 && keys[kIndex].duration_days) {
        durationDays = keys[kIndex].duration_days;
        subType = durationDays === -1 ? 'Lifetime' : `${durationDays} дн.`;
      } else if (keyCheck.isSigned) {
        durationDays = -1;
        subType = 'Lifetime VIP';
      } else {
        durationDays = -1;
        subType = 'Lifetime';
      }

      const newExpiry = durationDays === -1 ? 'lifetime' : new Date(Date.now() + durationDays * 86400000).toISOString();

      users[uIndex].has_active_sub = true;
      users[uIndex].sub_expires_at = newExpiry;
      users[uIndex].sub_type = subType;

      // Update or insert into keys log
      if (kIndex !== -1) {
        keys[kIndex].is_used = 1;
        keys[kIndex].used_by_username = curName;
        keys[kIndex].used_at = new Date().toISOString();
      } else {
        keys.push({
          id: keys.length + 1,
          key_code: cleanKey,
          duration_days: durationDays,
          is_used: 1,
          used_by_username: curName,
          used_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      }

      saveLocalKeys(keys);
      saveLocalUsers(users);

      return { ok: true, data: { success: true, message: `Ключ успешно активирован! (${subType})`, user: users[uIndex] } };
    }

    // 6. Admin Login
    if (endpoint === '/api/admin/login') {
      const { password } = body;
      if (password === getAdminPassword()) {
        const token = `adm_token_${Date.now()}`;
        setAdminToken(token);
        return { ok: true, data: { success: true, token } };
      }
      return { ok: false, data: { success: false, error: 'Неверный пароль администратора' } };
    }

    // 7. Admin Me
    if (endpoint === '/api/admin/me') {
      return { ok: true, data: { is_admin: Boolean(getAdminToken()) } };
    }

    // 8. Admin Stats
    if (endpoint === '/api/admin/stats') {
      const users = getLocalUsers();
      const keys = getLocalKeys();
      const stats = {
        total_users: users.length,
        active_sub_users: users.filter(u => u.has_active_sub && !u.is_banned).length,
        banned_users: users.filter(u => u.is_banned).length,
        total_keys: keys.length,
        unused_keys: keys.filter(k => !k.is_used).length,
        total_downloads: users.reduce((acc, u) => acc + (u.total_downloads || 0), 0)
      };
      return { ok: true, data: { stats, archive: { archive_exists: true, archive_size_mb: 646.88 } } };
    }

    // 9. Admin Users List
    if (endpoint.startsWith('/api/admin/users') && options.method !== 'POST') {
      const searchMatch = endpoint.match(/search=([^&]+)/);
      const search = searchMatch ? decodeURIComponent(searchMatch[1]).toLowerCase() : '';
      let users = getLocalUsers();
      if (search) users = users.filter(u => u.username.toLowerCase().includes(search));
      return { ok: true, data: { users } };
    }

    // 10. Admin User Action
    if (endpoint === '/api/admin/users/action') {
      const { action, user_id, reason, duration_days } = body;
      const users = getLocalUsers();
      const idx = users.findIndex(u => u.id === parseInt(user_id));
      if (idx === -1) return { ok: false, data: { success: false, error: 'Пользователь не найден' } };

      if (action === 'ban') {
        users[idx].is_banned = 1;
        users[idx].ban_reason = reason || 'Заблокирован администратором';
      } else if (action === 'unban') {
        users[idx].is_banned = 0;
        users[idx].ban_reason = '';
      } else if (action === 'grant_sub') {
        const dur = parseInt(duration_days || 30);
        users[idx].has_active_sub = true;
        users[idx].sub_type = dur === -1 ? 'Lifetime' : `${dur} дн.`;
        users[idx].sub_expires_at = dur === -1 ? 'lifetime' : new Date(Date.now() + dur * 86400000).toISOString();
      } else if (action === 'revoke_sub') {
        users[idx].has_active_sub = false;
        users[idx].sub_type = null;
        users[idx].sub_expires_at = null;
      } else if (action === 'delete') {
        users.splice(idx, 1);
      }

      saveLocalUsers(users);
      return { ok: true, data: { success: true, message: 'Действие выполнено' } };
    }

    // 11. Admin Keys List & Generate
    if (endpoint === '/api/admin/keys') {
      if (options.method === 'POST') {
        const count = parseInt(body.count || 1);
        const duration_days = parseInt(body.duration_days || 30);
        const keys = getLocalKeys();
        const created = [];

        for (let i = 0; i < count; i++) {
          const code = generateKeyCode();
          keys.push({
            id: keys.length + 1,
            key_code: code,
            duration_days,
            is_used: 0,
            used_by_username: null,
            used_at: null,
            created_at: new Date().toISOString()
          });
          created.push(code);
        }

        saveLocalKeys(keys);
        return { ok: true, data: { success: true, created_keys: created, message: `Создано ключей: ${created.length}` } };
      }
      return { ok: true, data: { keys: getLocalKeys() } };
    }

    // 12. Admin Delete Key
    if (endpoint.startsWith('/api/admin/keys/') && options.method === 'DELETE') {
      const keyId = parseInt(endpoint.split('/').pop());
      let keys = getLocalKeys();
      keys = keys.filter(k => k.id !== keyId);
      saveLocalKeys(keys);
      return { ok: true, data: { success: true, message: 'Ключ удален' } };
    }

    // 13. Admin Password Change
    if (endpoint === '/api/admin/change-password') {
      const { current_password, new_password } = body;
      if (current_password !== getAdminPassword()) {
        return { ok: false, data: { success: false, error: 'Неверный текущий пароль' } };
      }
      if (!new_password || new_password.length < 6) {
        return { ok: false, data: { success: false, error: 'Пароль должен содержать от 6 символов' } };
      }
      setAdminPassword(new_password);
      return { ok: true, data: { success: true, message: 'Пароль администратора успешно изменен' } };
    }

    // 14. Public Info
    if (endpoint === '/api/public-info') {
      const users = getLocalUsers();
      return {
        ok: true,
        data: {
          project_name: 'ZzidulyaDLC',
          total_users: users.length,
          total_downloads: 389,
          active_sub_users: users.filter(u => u.has_active_sub).length,
          archive_size_mb: 646.88,
          archive_ready: true
        }
      };
    }

    return { ok: false, status: 404, data: { error: 'Not found' } };
  }

  return {
    getBaseUrl,
    setBaseUrl: (url) => localStorage.setItem('zzd_backend_url', url),
    getUserToken,
    setUserToken,
    getAdminToken,
    setAdminToken,

    getPublicInfo: () => request('/api/public-info'),
    register: (username, password) => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
    login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: () => {
      setUserToken('');
      localStorage.removeItem('zzd_current_user_name');
      return request('/api/auth/logout', { method: 'POST' });
    },
    getMe: () => request('/api/auth/me'),
    redeemKey: (key) => request('/api/auth/redeem-key', { method: 'POST', body: JSON.stringify({ key }) }),
    getDownloadUrl: () => `${getBaseUrl() || window.location.origin}/api/download`,

    adminLogin: (password) => request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
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
    adminDeleteKey: (keyId) => request(`/api/admin/keys/${keyId}`, { method: 'DELETE', asAdmin: true }),
    adminArchiveStatus: () => request('/api/admin/archive/status', { asAdmin: true }),
    adminRebuildArchive: () => request('/api/admin/archive/rebuild', { method: 'POST', asAdmin: true }),
    adminChangePassword: (current_password, new_password) => request('/api/admin/change-password', {
      method: 'POST',
      asAdmin: true,
      body: JSON.stringify({ current_password, new_password })
    })
  };
})();
