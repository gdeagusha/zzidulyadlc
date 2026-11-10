/**
 * ZzidulyaDLC - Core Application Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let isAdminAuthenticated = false;

  // DOM Elements
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const btnHeroDownload = document.getElementById('btn-hero-download');
  const btnHeroCabinet = document.getElementById('btn-hero-cabinet');
  const btnHeroBuy = document.getElementById('btn-hero-buy');
  const adminSecretTrigger = document.getElementById('admin-secret-trigger');

  // Modals
  const modalAuth = document.getElementById('modal-auth');
  const modalCabinet = document.getElementById('modal-cabinet');
  const modalAdmin = document.getElementById('modal-admin');

  // Close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal-overlay').classList.remove('open');
    });
  });

  // Close on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });

  // Open specific modal helper
  function openModal(modal) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    if (modal) modal.classList.add('open');
  }

  // --- Public Stats ---
  async function loadPublicInfo() {
    const res = await API.getPublicInfo();
    if (res.ok && res.data) {
      const d = res.data;
      const elUsers = document.getElementById('stat-total-users');
      const elDownloads = document.getElementById('stat-total-downloads');
      if (elUsers) elUsers.textContent = (d.total_users || 0) + 142; // base offset for showcase
      if (elDownloads) elDownloads.textContent = (d.total_downloads || 0) + 389;
    }
  }

  // --- Auth State Check ---
  async function checkAuthState() {
    const res = await API.getMe();
    if (res.ok && res.data && res.data.authenticated) {
      currentUser = res.data.user;
      renderUserLoggedIn();
    } else {
      currentUser = null;
      renderUserLoggedOut();
    }
  }

  function renderUserLoggedIn() {
    if (btnOpenAuth) {
      btnOpenAuth.textContent = `Кабинет (${currentUser.username})`;
      btnOpenAuth.onclick = () => openCabinetModal();
    }
  }

  function renderUserLoggedOut() {
    if (btnOpenAuth) {
      btnOpenAuth.textContent = 'Войти / Регистрация';
      btnOpenAuth.onclick = () => openModal(modalAuth);
    }
  }

  // --- Auth Forms ---
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (tabLogin && tabRegister) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      formLogin.style.display = 'block';
      formRegister.style.display = 'none';
    });
    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      formLogin.style.display = 'none';
      formRegister.style.display = 'block';
    });
  }

  // Login Submit
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value;
      if (!u || !p) return Toast.error('Заполните все поля');

      const res = await API.login(u, p);
      if (res.ok && res.data.success) {
        if (res.data.token) API.setUserToken(res.data.token);
        currentUser = res.data.user;
        Toast.success(`Добро пожаловать, ${currentUser.username}!`);
        modalAuth.classList.remove('open');
        renderUserLoggedIn();
      } else {
        Toast.error(res.data?.error || 'Неверный логин или пароль');
      }
    });
  }

  // Register Submit
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('reg-username').value.trim();
      const p = document.getElementById('reg-password').value;
      if (!u || !p) return Toast.error('Заполните все поля');

      const res = await API.register(u, p);
      if (res.ok && res.data.success) {
        if (res.data.token) API.setUserToken(res.data.token);
        currentUser = res.data.user;
        Toast.success('Регистрация успешна! Добро пожаловать.');
        modalAuth.classList.remove('open');
        renderUserLoggedIn();
      } else {
        Toast.error(res.data?.error || 'Ошибка регистрации');
      }
    });
  }

  // --- Cabinet Modal ---
  function openCabinetModal() {
    if (!currentUser) {
      openModal(modalAuth);
      return;
    }
    document.getElementById('cab-username').textContent = currentUser.username;
    
    // Sub status
    const statusEl = document.getElementById('cab-sub-status');
    const expiryEl = document.getElementById('cab-sub-expiry');
    
    if (currentUser.is_banned) {
      statusEl.className = 'badge badge-red';
      statusEl.textContent = 'ЗАБЛОКИРОВАН';
      expiryEl.textContent = `Причина: ${currentUser.ban_reason || 'Нарушение правил'}`;
    } else if (currentUser.has_active_sub) {
      statusEl.className = 'badge badge-green';
      statusEl.textContent = 'АКТИВНА';
      expiryEl.textContent = currentUser.sub_expires_at === 'lifetime' 
        ? 'Срок: Навсегда (Lifetime)' 
        : `До: ${new Date(currentUser.sub_expires_at).toLocaleDateString()}`;
    } else {
      statusEl.className = 'badge badge-red';
      statusEl.textContent = 'НЕТ ПОДПИСКИ';
      expiryEl.textContent = 'Активируйте ключ доступа ниже';
    }

    openModal(modalCabinet);
  }

  // Key Redeem
  const formRedeemKey = document.getElementById('form-redeem-key');
  if (formRedeemKey) {
    formRedeemKey.addEventListener('submit', async (e) => {
      e.preventDefault();
      const keyInput = document.getElementById('redeem-key-input');
      const code = keyInput.value.trim();
      if (!code) return Toast.error('Введите ключ доступа');

      const res = await API.redeemKey(code);
      if (res.ok && res.data.success) {
        Toast.success(res.data.message);
        currentUser = res.data.user;
        openCabinetModal();
        keyInput.value = '';
      } else {
        Toast.error(res.data?.error || 'Неверный или использованный ключ');
      }
    });
  }

  // Cabinet Logout
  const btnLogout = document.getElementById('btn-cab-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await API.logout();
      currentUser = null;
      renderUserLoggedOut();
      modalCabinet.classList.remove('open');
      Toast.info('Вы вышли из аккаунта');
    });
  }

  const GITHUB_RELEASE_DOWNLOAD_URL = 'https://github.com/gdeagusha/zzidulyadlc/releases/download/v1.0.0/ZzidulyaLoader.exe';

  // --- Download Trigger ---
  function handleDownloadClick() {
    if (!currentUser) {
      Toast.warn('Для скачивания необходимо войти в аккаунт');
      openModal(modalAuth);
      return;
    }

    if (currentUser.is_banned) {
      Toast.error(`Ваш аккаунт заблокирован: ${currentUser.ban_reason || 'Блокировка'}`);
      return;
    }

    if (!currentUser.has_active_sub) {
      Toast.error('Доступ запрещён! Для скачивания требуется активная подписка. Активируйте ключ в кабинете!');
      openCabinetModal();
      return;
    }

    // Только для пользователей с подтверждённой активной подпиской
    Toast.success('Подписка подтверждена! Загрузка ZzidulyaLoader.exe...');
    window.location.href = GITHUB_RELEASE_DOWNLOAD_URL;
  }

  if (btnHeroDownload) btnHeroDownload.addEventListener('click', handleDownloadClick);
  const btnCabDownload = document.getElementById('btn-cab-download');
  if (btnCabDownload) btnCabDownload.addEventListener('click', handleDownloadClick);

  if (btnHeroCabinet) {
    btnHeroCabinet.addEventListener('click', () => {
      if (currentUser) openCabinetModal();
      else openModal(modalAuth);
    });
  }

  // --- Admin Panel Logic ---
  const adminAuthCard = document.getElementById('admin-auth-card');
  const adminDashboard = document.getElementById('admin-dashboard');
  const formAdminLogin = document.getElementById('form-admin-login');

  async function checkAdminState() {
    const res = await API.adminMe();
    if (res.ok && res.data.is_admin) {
      showAdminDashboard();
    } else {
      showAdminLogin();
    }
  }

  function showAdminLogin() {
    if (adminAuthCard) adminAuthCard.style.display = 'block';
    if (adminDashboard) adminDashboard.style.display = 'none';
  }

  function showAdminDashboard() {
    if (adminAuthCard) adminAuthCard.style.display = 'none';
    if (adminDashboard) adminDashboard.style.display = 'block';
    loadAdminStats();
    loadAdminUsers();
    loadAdminKeys();
  }

  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('admin-password-input').value;
      const res = await API.adminLogin(pwd);
      if (res.ok && res.data.success) {
        if (res.data.token) API.setAdminToken(res.data.token);
        Toast.success('Доступ администратора подтверждён');
        showAdminDashboard();
      } else {
        Toast.error(res.data?.error || 'Неверный пароль администратора');
      }
    });
  }

  // Admin Tab Navigation
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.style.display = 'block';
    });
  });

  // Load Admin Stats
  async function loadAdminStats() {
    const res = await API.adminStats();
    if (res.ok && res.data) {
      const s = res.data.stats;
      document.getElementById('adm-stat-users').textContent = s.total_users;
      document.getElementById('adm-stat-active-subs').textContent = s.active_sub_users;
      document.getElementById('adm-stat-banned').textContent = s.banned_users;
      document.getElementById('adm-stat-keys').textContent = `${s.unused_keys} / ${s.total_keys}`;
      document.getElementById('adm-stat-downloads').textContent = s.total_downloads;

      const arch = res.data.archive;
      document.getElementById('adm-archive-size').textContent = arch.archive_exists ? `${arch.archive_size_mb} MB` : 'Не создан';
    }
  }

  // Load Admin Users
  async function loadAdminUsers(search = '') {
    const res = await API.adminUsers(search);
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (res.ok && res.data && res.data.users) {
      res.data.users.forEach(u => {
        const tr = document.createElement('tr');
        const statusBadge = u.is_banned 
          ? `<span class="badge badge-red">БАН</span>` 
          : (u.has_active_sub ? `<span class="badge badge-green">АКТИВНА</span>` : `<span class="badge badge-purple">НЕТ</span>`);

        tr.innerHTML = `
          <td>#${u.id}</td>
          <td><strong>${u.username}</strong></td>
          <td>${statusBadge}</td>
          <td>${u.sub_type || '—'}</td>
          <td>${u.total_downloads}</td>
          <td>
            <button class="btn btn-sm btn-outline btn-grant-sub" data-id="${u.id}">+ Саб</button>
            ${u.is_banned 
              ? `<button class="btn btn-sm btn-outline btn-unban" data-id="${u.id}" style="border-color: var(--neon-green)">Разбан</button>`
              : `<button class="btn btn-sm btn-outline btn-ban" data-id="${u.id}" style="border-color: var(--neon-red)">Бан</button>`
            }
            <button class="btn btn-sm btn-outline btn-del-user" data-id="${u.id}">✕</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind User Actions
      tbody.querySelectorAll('.btn-grant-sub').forEach(btn => {
        btn.onclick = async () => {
          const days = prompt('На сколько дней выдать подписку? (например: 30 или -1 для навсегда):', '30');
          if (days !== null) {
            const r = await API.adminUserAction('grant_sub', btn.dataset.id, { duration_days: parseInt(days) });
            Toast.info(r.data?.message || 'Готово');
            loadAdminUsers();
            loadAdminStats();
          }
        };
      });

      tbody.querySelectorAll('.btn-ban').forEach(btn => {
        btn.onclick = async () => {
          const reason = prompt('Причина блокировки:', 'Нарушение правил');
          if (reason !== null) {
            const r = await API.adminUserAction('ban', btn.dataset.id, { reason });
            Toast.warn(r.data?.message || 'Пользователь забанен');
            loadAdminUsers();
            loadAdminStats();
          }
        };
      });

      tbody.querySelectorAll('.btn-unban').forEach(btn => {
        btn.onclick = async () => {
          const r = await API.adminUserAction('unban', btn.dataset.id);
          Toast.success(r.data?.message || 'Пользователь разблокирован');
          loadAdminUsers();
          loadAdminStats();
        };
      });

      tbody.querySelectorAll('.btn-del-user').forEach(btn => {
        btn.onclick = async () => {
          if (confirm('Удалить пользователя навсегда?')) {
            const r = await API.adminUserAction('delete', btn.dataset.id);
            Toast.info(r.data?.message || 'Удалено');
            loadAdminUsers();
            loadAdminStats();
          }
        };
      });
    }
  }

  // Admin User Search
  const userSearchInput = document.getElementById('admin-user-search');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => {
      loadAdminUsers(e.target.value.trim());
    });
  }

  // Load Admin Keys
  async function loadAdminKeys() {
    const res = await API.adminGetKeys();
    const tbody = document.getElementById('admin-keys-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (res.ok && res.data && res.data.keys) {
      res.data.keys.forEach(k => {
        const tr = document.createElement('tr');
        const isUsed = k.is_used === 1;
        const dur = k.duration_days === -1 ? 'Lifetime' : `${k.duration_days} дн.`;
        tr.innerHTML = `
          <td><code>${k.key_code}</code></td>
          <td>${dur}</td>
          <td>${isUsed ? `<span class="badge badge-red">Использован (${k.used_by_username})</span>` : `<span class="badge badge-green">Свободен</span>`}</td>
          <td>${k.used_at ? new Date(k.used_at).toLocaleDateString() : '—'}</td>
          <td>
            ${!isUsed ? `<button class="btn btn-sm btn-outline btn-del-key" data-id="${k.id}">Удалить</button>` : '—'}
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('.btn-del-key').forEach(btn => {
        btn.onclick = async () => {
          const r = await API.adminDeleteKey(btn.dataset.id);
          Toast.info(r.data?.message || 'Ключ удален');
          loadAdminKeys();
          loadAdminStats();
        };
      });
    }
  }

  // Admin Generate Keys Form
  const formGenKeys = document.getElementById('form-generate-keys');
  if (formGenKeys) {
    formGenKeys.addEventListener('submit', async (e) => {
      e.preventDefault();
      const count = parseInt(document.getElementById('gen-key-count').value);
      const days = parseInt(document.getElementById('gen-key-days').value);
      const res = await API.adminGenerateKeys(count, days);
      if (res.ok && res.data.success) {
        Toast.success(res.data.message);
        loadAdminKeys();
        loadAdminStats();

        // Output bulk keys to textarea for 1-click copying
        const outBox = document.getElementById('gen-keys-output');
        if (outBox && res.data.created_keys) {
          outBox.value = res.data.created_keys.join('\n');
          outBox.style.display = 'block';
        }
      }
    });
  }

  // Admin Rebuild Archive
  const btnRebuildArchive = document.getElementById('btn-rebuild-archive');
  if (btnRebuildArchive) {
    btnRebuildArchive.addEventListener('click', async () => {
      const res = await API.adminRebuildArchive();
      Toast.info(res.data?.message || 'Сборка архива запущена в фоновом режиме');
      setTimeout(loadAdminStats, 3000);
    });
  }

  // Admin Password Change
  const formChangeAdminPwd = document.getElementById('form-change-admin-pwd');
  if (formChangeAdminPwd) {
    formChangeAdminPwd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = document.getElementById('adm-curr-pwd').value;
      const nw = document.getElementById('adm-new-pwd').value;
      const res = await API.adminChangePassword(cur, nw);
      if (res.ok && res.data.success) {
        Toast.success(res.data.message);
        formChangeAdminPwd.reset();
      } else {
        Toast.error(res.data?.error || 'Ошибка смены пароля');
      }
    });
  }

  // Admin Secret Trigger (Footer Lock Icon or /admin route)
  if (adminSecretTrigger) {
    adminSecretTrigger.addEventListener('click', () => {
      openModal(modalAdmin);
      checkAdminState();
    });
  }

  // Check URL route on load
  if (window.location.pathname.includes('/admin') || window.location.hash === '#admin') {
    openModal(modalAdmin);
    checkAdminState();
  }

  // FAQ Accordion click
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-question');
    if (q) {
      q.addEventListener('click', () => {
        item.classList.toggle('active');
      });
    }
  });

  // Init
  loadPublicInfo();
  checkAuthState();
});
