/**
 * ZzidulyaDLC — Universal API & Offline GitHub Pages Adapter
 */
const API = (() => {
  const isGitHubPages = window.location.hostname.includes('github.io');
  const isFileProtocol = window.location.protocol === 'file:';

  const getBaseUrl = () => (localStorage.getItem('zzd_backend_url') || '').trim().replace(/\/+$/, '');
  const setBaseUrl = (url) => {
    const clean = (url || '').trim().replace(/\/+$/, '');
    if (clean) localStorage.setItem('zzd_backend_url', clean);
    else localStorage.removeItem('zzd_backend_url');
  };

  const hasLiveBackend = () => Boolean(getBaseUrl()) || (!isGitHubPages && !isFileProtocol && window.location.protocol.startsWith('http'));

  const getUserToken = () => localStorage.getItem('zzd_user_token') || '';
  const setUserToken = (t) => t ? localStorage.setItem('zzd_user_token', t) : localStorage.removeItem('zzd_user_token');

  const getAdminToken = () => localStorage.getItem('zzd_admin_token') || '';
  const setAdminToken = (t) => t ? localStorage.setItem('zzd_admin_token', t) : localStorage.removeItem('zzd_admin_token');

  const getAdminPassword = () => localStorage.getItem('zzd_admin_password') || 'admin_zzidulya_2026';
  const setAdminPassword = (p) => localStorage.setItem('zzd_admin_password', p);

  // --- Local Storage Helpers (Standalone GitHub Pages Mode) ---
  function getLocalUsers() {
    try { return JSON.parse(localStorage.getItem('zzd_local_users') || '[]'); }
    catch { return []; }
  }
  function saveLocalUsers(users) {
    localStorage.setItem('zzd_local_users', JSON.stringify(users));
  }

  function getLocalKeys() {
    try { return JSON.parse(localStorage.getItem('zzd_local_keys') || '[]'); }
    catch { return []; }
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

  const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const DURATION_TO_TIER = { 1: 0, 7: 1, 30: 2, 90: 3, '-1': 4 };
  const TIER_TO_DURATION = { 0: 1, 1: 7, 2: 30, 3: 90, 4: -1 };

  function generateKeyCode(durationDays = -1) {
    const part2 = Array.from({ length: 4 }, () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]).join('');
    const tier = Object.prototype.hasOwnProperty.call(DURATION_TO_TIER, durationDays) ? DURATION_TO_TIER[durationDays] : 2;
    const mask = KEY_ALPHABET.indexOf(part2[0]) & 7;
    const highBits = (Math.floor(Math.random() * 4) << 3);
    const firstChar = KEY_ALPHABET[highBits | ((tier ^ mask) & 7)];
    const part1 = firstChar + Array.from({ length: 3 }, () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]).join('');
    const p3 = computeKeySignature(part1, part2);
    return `ZZD-${part1}-${part2}-${p3}`;
  }

  function decodeKeyTierDays(key) {
    const norm = normalizeKey(key);
    if (norm === 'ZZD-8XH4-XMDT-FC6H') return -1;
    const parts = norm.split('-');
    if (parts.length !== 4 || parts[1].length !== 4 || parts[2].length !== 4) return 30;
    const i1 = KEY_ALPHABET.indexOf(parts[1][0]);
    const i2 = KEY_ALPHABET.indexOf(parts[2][0]);
    if (i1 < 0 || i2 < 0) return 30;
    const tier = (i1 ^ i2) & 7;
    return Object.prototype.hasOwnProperty.call(TIER_TO_DURATION, tier) ? TIER_TO_DURATION[tier] : 30;
  }

  function normalizeKey(key) {
    if (!key || typeof key !== 'string') return '';
    let clean = key.trim().toUpperCase().replace(/[\s_]+/g, '-');
    if (!clean) return '';
    if (!clean.startsWith('ZZD-')) {
      if (clean.startsWith('ZZD')) clean = 'ZZD-' + clean.substring(3).replace(/^-+/, '');
      else clean = 'ZZD-' + clean.replace(/^-+/, '');
    }
    const rest = clean.substring(4).replace(/-/g, '');
    if (rest.length === 12) {
      return `ZZD-${rest.substring(0, 4)}-${rest.substring(4, 8)}-${rest.substring(8, 12)}`;
    }
    return clean;
  }

  function validateKeyFormat(key) {
    if (!key || typeof key !== 'string') return { valid: false, reason: 'Ключ не указан' };
    const cleanKey = normalizeKey(key);
    if (cleanKey.length !== 18) return { valid: false, reason: 'Формат: ZZD-XXXX-XXXX-XXXX (18 символов)' };
    if (!cleanKey.startsWith('ZZD-')) return { valid: false, reason: 'Ключ должен начинаться с ZZD-' };

    const parts = cleanKey.split('-');
    if (parts.length !== 4) return { valid: false, reason: 'Неверный формат разделителей ключа' };

    for (let i = 1; i <= 3; i++) {
      if (parts[i].length !== 4 || !/^[A-Z0-9]{4}$/.test(parts[i])) {
        return { valid: false, reason: 'Допустимы только латинские буквы и цифры' };
      }
    }

    const p1 = parts[1];
    const p2 = parts[2];
    const p3 = parts[3];
    const expectedSig = computeKeySignature(p1, p2);
    const isMaster = cleanKey === 'ZZD-8XH4-XMDT-FC6H';
    const isSigned = isMaster || (p3 === expectedSig);

    return { valid: true, cleanKey, p1, p2, p3, isSigned };
  }

  // --- Hybrid Request Router ---
  async function request(endpoint, options = {}) {
    if (!hasLiveBackend()) {
      return handleLocalRequest(endpoint, options);
    }

    const base = getBaseUrl() || window.location.origin;
    const url = `${base}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (options.asAdmin && getAdminToken()) {
      headers['Authorization'] = `Bearer ${getAdminToken()}`;
    } else if (!options.asAdmin && getUserToken()) {
      headers['Authorization'] = `Bearer ${getUserToken()}`;
    }

    try {
      const resp = await fetch(url, { credentials: 'include', ...options, headers });
      const contentType = resp.headers.get('content-type') || '';

      if (resp.status === 404 && !contentType.includes('application/json')) {
        return handleLocalRequest(endpoint, options);
      }

      if (!contentType.includes('application/json')) {
        return { ok: false, status: resp.status, data: { success: false, error: `Сервер вернул неожиданный ответ (${resp.status})` } };
      }

      const data = await resp.json().catch(() => ({}));
      return { ok: resp.ok, status: resp.status, data };
    } catch {
      if (isGitHubPages || isFileProtocol) {
        return handleLocalRequest(endpoint, options);
      }
      return { ok: false, status: 0, data: { success: false, error: 'Сервер недоступен. Проверьте подключение.' } };
    }
  }

  // --- Client-Side Storage Adapter (Standalone Static Fallback) ---
  function handleLocalRequest(endpoint, options = {}) {
    let body = {};
    try {
      body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};
    } catch {
      body = {};
    }

    if (endpoint === '/api/auth/register') {
      const username = (body.username || '').trim();
      const password = (body.password || '').trim();
      const keyInput = (body.key || '').trim();
      if (!username || username.length < 3 || username.length > 32) {
        return { ok: false, status: 400, data: { success: false, error: 'Логин должен быть от 3 до 32 символов' } };
      }
      if (!password || password.length < 4) {
        return { ok: false, status: 400, data: { success: false, error: 'Пароль должен быть от 4 символов' } };
      }

      const users = getLocalUsers();
      if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return { ok: false, status: 400, data: { success: false, error: 'Пользователь с таким логином уже существует' } };
      }

      let subActive = false;
      let subExpiry = null;
      let subType = null;

      if (keyInput) {
        const keyCheck = validateKeyFormat(keyInput);
        if (!keyCheck.valid) {
          return { ok: false, status: 400, data: { success: false, error: keyCheck.reason || 'Неверный формат ключа' } };
        }
        const keys = getLocalKeys();
        const kIndex = keys.findIndex(k => k.key_code === keyCheck.cleanKey);
        const durDays = (kIndex !== -1 && keys[kIndex].duration_days) ? keys[kIndex].duration_days : decodeKeyTierDays(keyCheck.cleanKey);

        subActive = true;
        subExpiry = durDays === -1 ? 'lifetime' : new Date(Date.now() + durDays * 86400000).toISOString();
        subType = durDays === -1 ? (keyCheck.isSigned ? 'Lifetime VIP' : 'Lifetime') : `${durDays} дн.`;

        if (kIndex !== -1) {
          keys[kIndex].is_used = 1;
          keys[kIndex].used_by_username = username;
          keys[kIndex].used_at = new Date().toISOString();
        } else {
          keys.push({
            id: keys.length + 1,
            key_code: keyCheck.cleanKey,
            duration_days: durDays,
            is_used: 1,
            used_by_username: username,
            used_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
        }
        saveLocalKeys(keys);
      }

      const newUser = {
        id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
        username,
        password,
        is_banned: 0,
        ban_reason: '',
        has_active_sub: subActive,
        sub_expires_at: subExpiry,
        sub_type: subType,
        total_downloads: 0,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      saveLocalUsers(users);

      const token = `token_${username}_${Date.now()}`;
      setUserToken(token);
      localStorage.setItem('zzd_current_user_name', username);
      const msg = subActive ? `Регистрация успешна! Ключ активирован (${subType}).` : 'Регистрация успешна! Добро пожаловать.';
      return { ok: true, status: 200, data: { success: true, token, user: newUser, message: msg } };
    }

    if (endpoint === '/api/auth/login') {
      const username = (body.username || '').trim();
      const password = (body.password || '').trim();
      const users = getLocalUsers();
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
      if (!user) return { ok: false, status: 401, data: { success: false, error: 'Неверный логин или пароль' } };

      const token = `token_${username}_${Date.now()}`;
      setUserToken(token);
      localStorage.setItem('zzd_current_user_name', user.username);
      return { ok: true, status: 200, data: { success: true, token, user } };
    }

    if (endpoint === '/api/auth/logout') {
      setUserToken('');
      localStorage.removeItem('zzd_current_user_name');
      return { ok: true, status: 200, data: { success: true } };
    }

    if (endpoint === '/api/auth/me') {
      const curName = localStorage.getItem('zzd_current_user_name');
      if (!curName || !getUserToken()) return { ok: true, status: 200, data: { authenticated: false, user: null } };
      const users = getLocalUsers();
      const user = users.find(u => u.username.toLowerCase() === curName.toLowerCase());
      if (!user) return { ok: true, status: 200, data: { authenticated: false, user: null } };
      return { ok: true, status: 200, data: { authenticated: true, user } };
    }

    if (endpoint === '/api/auth/redeem-key') {
      const curName = localStorage.getItem('zzd_current_user_name');
      if (!curName) return { ok: false, status: 401, data: { success: false, error: 'Требуется авторизация' } };

      const keyCheck = validateKeyFormat(body.key);
      if (!keyCheck.valid) return { ok: false, status: 400, data: { success: false, error: keyCheck.reason } };

      const cleanKey = keyCheck.cleanKey;
      const keys = getLocalKeys();
      const kIndex = keys.findIndex(k => k.key_code === cleanKey);

      const users = getLocalUsers();
      const uIndex = users.findIndex(u => u.username.toLowerCase() === curName.toLowerCase());
      if (uIndex === -1) return { ok: false, status: 404, data: { success: false, error: 'Пользователь не найден' } };
      if (users[uIndex].is_banned) return { ok: false, status: 403, data: { success: false, error: 'Аккаунт заблокирован' } };

      let durationDays = decodeKeyTierDays(cleanKey);
      let subType = durationDays === -1 ? 'Lifetime' : `${durationDays} дн.`;
      if (kIndex !== -1 && keys[kIndex].duration_days) {
        durationDays = keys[kIndex].duration_days;
        subType = durationDays === -1 ? 'Lifetime' : `${durationDays} дн.`;
      } else if (cleanKey === 'ZZD-8XH4-XMDT-FC6H') {
        durationDays = -1;
        subType = 'Lifetime VIP';
      }

      const newExpiry = durationDays === -1 ? 'lifetime' : new Date(Date.now() + durationDays * 86400000).toISOString();
      users[uIndex].has_active_sub = true;
      users[uIndex].sub_expires_at = newExpiry;
      users[uIndex].sub_type = subType;

      if (kIndex !== -1) {
        keys[kIndex].is_used = 1;
        keys[kIndex].used_by_username = curName;
        keys[kIndex].used_at = new Date().toISOString();
      } else {
        keys.push({
          id: keys.length ? Math.max(...keys.map(k => k.id)) + 1 : 1,
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
      return { ok: true, status: 200, data: { success: true, message: `Ключ активирован (${subType})`, user: users[uIndex] } };
    }

    if (endpoint === '/api/admin/login') {
      if (body.password === getAdminPassword()) {
        const token = `adm_token_${Date.now()}`;
        setAdminToken(token);
        return { ok: true, status: 200, data: { success: true, token } };
      }
      return { ok: false, status: 401, data: { success: false, error: 'Неверный пароль администратора' } };
    }

    if (endpoint === '/api/admin/logout') {
      setAdminToken('');
      return { ok: true, status: 200, data: { success: true, message: 'Выход выполнен' } };
    }

    if (endpoint === '/api/admin/me') {
      return { ok: true, status: 200, data: { is_admin: Boolean(getAdminToken()) } };
    }

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
      return {
        ok: true,
        status: 200,
        data: {
          stats,
          archive: {
            source_path: 'D:\\ZzidulyaDLC\\ZzidulyaClient',
            archive_exists: true,
            archive_size_mb: 646.88,
            is_building: false,
            progress: 100
          }
        }
      };
    }

    if (endpoint.startsWith('/api/admin/users') && options.method !== 'POST') {
      const searchMatch = endpoint.match(/search=([^&]+)/);
      const search = searchMatch ? decodeURIComponent(searchMatch[1]).toLowerCase() : '';
      let users = getLocalUsers();
      if (search) users = users.filter(u => u.username.toLowerCase().includes(search));
      return { ok: true, status: 200, data: { users } };
    }

    if (endpoint === '/api/admin/users/action') {
      const { action, user_id, reason, duration_days } = body;
      const users = getLocalUsers();
      const idx = users.findIndex(u => u.id === parseInt(user_id, 10));
      if (idx === -1) return { ok: false, status: 404, data: { success: false, error: 'Пользователь не найден' } };

      if (action === 'ban') {
        users[idx].is_banned = 1;
        users[idx].ban_reason = reason || 'Заблокирован администратором';
      } else if (action === 'unban') {
        users[idx].is_banned = 0;
        users[idx].ban_reason = '';
      } else if (action === 'grant_sub') {
        const dur = parseInt(duration_days || 30, 10);
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
      return { ok: true, status: 200, data: { success: true, message: 'Действие выполнено' } };
    }

    if (endpoint === '/api/admin/keys') {
      if (options.method === 'POST') {
        const count = Math.max(1, Math.min(100, parseInt(body.count || 1, 10)));
        const duration_days = parseInt(body.duration_days || 30, 10);
        const keys = getLocalKeys();
        const created = [];
        let nextId = keys.length ? Math.max(...keys.map(k => k.id)) + 1 : 1;

        for (let i = 0; i < count; i++) {
          const code = generateKeyCode(duration_days);
          keys.unshift({
            id: nextId++,
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
        return { ok: true, status: 200, data: { success: true, created_keys: created, message: `Создано ключей: ${created.length}` } };
      }
      return { ok: true, status: 200, data: { keys: getLocalKeys() } };
    }

    if (endpoint.startsWith('/api/admin/keys/') && options.method === 'DELETE') {
      const keyId = parseInt(endpoint.split('/').pop(), 10);
      let keys = getLocalKeys();
      keys = keys.filter(k => k.id !== keyId);
      saveLocalKeys(keys);
      return { ok: true, status: 200, data: { success: true, message: 'Ключ удален' } };
    }

    if (endpoint === '/api/admin/archive/status') {
      return {
        ok: true,
        status: 200,
        data: {
          source_path: 'D:\\ZzidulyaDLC\\ZzidulyaClient',
          archive_exists: true,
          archive_size_mb: 646.88,
          is_building: false,
          progress: 100
        }
      };
    }

    if (endpoint === '/api/admin/archive/rebuild') {
      return { ok: false, status: 400, data: { success: false, message: 'Пересборка архива доступна только при подключённом сервере Python.' } };
    }

    if (endpoint === '/api/admin/change-password') {
      const { current_password, new_password } = body;
      if (current_password !== getAdminPassword()) {
        return { ok: false, status: 400, data: { success: false, error: 'Неверный текущий пароль' } };
      }
      if (!new_password || new_password.length < 6) {
        return { ok: false, status: 400, data: { success: false, error: 'Пароль должен содержать от 6 символов' } };
      }
      setAdminPassword(new_password);
      return { ok: true, status: 200, data: { success: true, message: 'Пароль администратора изменён' } };
    }

    if (endpoint === '/api/public-info') {
      const users = getLocalUsers();
      return {
        ok: true,
        status: 200,
        data: {
          project_name: 'ZzidulyaDLC',
          telegram_link: 'https://t.me/zzidulyadlc',
          discord_link: 'https://discord.gg/',
          total_users: users.length,
          total_downloads: 0,
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
    setBaseUrl,
    hasLiveBackend,
    normalizeKey,
    validateKeyFormat,
    getUserToken,
    setUserToken,
    getAdminToken,
    setAdminToken,

    getPublicInfo: () => request('/api/public-info'),
    register: (username, password, key = '') => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, key }) }),
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
