/**
 * ZzidulyaDLC — Main Frontend Application Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let allAdminKeys = [];
  let currentKeyFilter = 'all';
  let archivePollTimer = null;

  // --- Utilities ---
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function copyToClipboard(text, okMsg = 'Скопировано в буфер обмена') {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success(okMsg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      Toast.success(okMsg);
    }
  }

  // --- DOM References ---
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const navUserDot = document.getElementById('nav-user-dot');
  const navUserLabel = document.getElementById('nav-user-label');
  const navBurger = document.getElementById('nav-burger');
  const mobileDrawer = document.getElementById('mobile-drawer');

  const btnHeroDownload = document.getElementById('btn-hero-download');
  const btnHeroCabinet = document.getElementById('btn-hero-cabinet');
  const btnHeroActivate = document.getElementById('btn-hero-activate');
  const btnPricingActivate = document.getElementById('btn-pricing-activate');
  const adminSecretTrigger = document.getElementById('admin-secret-trigger');

  const modalAuth = document.getElementById('modal-auth');
  const modalCabinet = document.getElementById('modal-cabinet');
  const modalAdmin = document.getElementById('modal-admin');
  const modalAdminAction = document.getElementById('modal-admin-action');

  // --- Mobile Navigation ---
  if (navBurger && mobileDrawer) {
    navBurger.addEventListener('click', () => {
      mobileDrawer.classList.toggle('open');
    });
    mobileDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileDrawer.classList.remove('open'));
    });
  }

  // --- Modal System ---
  function openModal(modal, keepParent = false) {
    if (!keepParent) {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    }
    if (modal) modal.classList.add('open');
  }

  function closeModal(modal) {
    if (modal) modal.classList.remove('open');
    if (modal === modalAdmin && archivePollTimer) {
      clearInterval(archivePollTimer);
      archivePollTimer = null;
    }
  }

  document.querySelectorAll('.modal-close, .modal-cancel-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      closeModal(e.target.closest('.modal-overlay'));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openAction = modalAdminAction && modalAdminAction.classList.contains('open');
    if (openAction) {
      closeModal(modalAdminAction);
      return;
    }
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m));
  });

  // --- Password Toggle ---
  document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.togglePass);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // --- Hero Interactive Showcase ---
  const showcaseTabs = document.querySelectorAll('#showcase-tabs .showcase-tab');
  showcaseTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      showcaseTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.showcase-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = document.getElementById(tab.dataset.pane);
      if (pane) pane.classList.add('active');
    });
  });

  const previewCombatMods = [
    { name: 'KillAura', bind: 'R', active: true },
    { name: 'AutoTotem', bind: 'G', active: true },
    { name: 'CrystalAura', bind: 'C', active: false },
    { name: 'TriggerBot', bind: 'V', active: false }
  ];

  const previewMoveMods = [
    { name: 'WindHop', bind: 'X', active: true },
    { name: 'TargetPearl', bind: 'Z', active: true },
    { name: 'TargetESP', bind: '—', active: true },
    { name: 'Velocity', bind: '—', active: false }
  ];

  function renderClickGuiPreview() {
    const combatHost = document.getElementById('clickgui-combat-list');
    const moveHost = document.getElementById('clickgui-movement-list');
    const arrayHost = document.getElementById('hud-arraylist');
    const hpLabel = document.getElementById('hud-target-hp');
    const hpFill = document.getElementById('hud-target-fill');
    const windStatus = document.getElementById('hud-windhop-status');
    if (!combatHost || !moveHost || !arrayHost) return;

    const buildList = (items, host) => {
      host.innerHTML = '';
      items.forEach(mod => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `gui-mod-btn${mod.active ? ' enabled' : ''}`;
        btn.innerHTML = `<span>${escapeHtml(mod.name)}</span><span class="gui-mod-bind">${escapeHtml(mod.bind)}</span>`;
        btn.addEventListener('click', () => {
          mod.active = !mod.active;
          renderClickGuiPreview();
        });
        host.appendChild(btn);
      });
    };

    buildList(previewCombatMods, combatHost);
    buildList(previewMoveMods, moveHost);

    const enabled = [...previewCombatMods, ...previewMoveMods].filter(m => m.active);
    arrayHost.innerHTML = '';
    if (enabled.length === 0) {
      const empty = document.createElement('span');
      empty.style.cssText = 'font-size:12px;color:var(--text-muted);';
      empty.textContent = 'Нет активных модулей';
      arrayHost.appendChild(empty);
    } else {
      enabled.forEach(m => {
        const pill = document.createElement('span');
        pill.className = 'arraylist-pill';
        pill.textContent = m.name;
        arrayHost.appendChild(pill);
      });
    }

    const auraOn = previewCombatMods.find(m => m.name === 'KillAura')?.active;
    const windOn = previewMoveMods.find(m => m.name === 'WindHop')?.active;
    if (hpLabel && hpFill) {
      const hp = auraOn ? '12.4 HP' : '18.5 HP';
      hpLabel.textContent = hp;
      hpFill.style.width = auraOn ? '62%' : '92%';
    }
    if (windStatus) {
      windStatus.textContent = windOn ? 'WindHop: +9.9m' : 'WindHop: OFF';
      windStatus.style.color = windOn ? 'var(--cyan)' : 'var(--text-muted)';
    }
  }
  renderClickGuiPreview();

  // Interactive Loader Simulator
  let simRam = 4;
  let simRunning = false;
  const simRamBtns = document.querySelectorAll('#sim-ram-row .sim-ram-btn');
  const simStatusText = document.getElementById('sim-status-text');
  const simProgressFill = document.getElementById('sim-progress-fill');
  const simLaunchBtn = document.getElementById('sim-launch-btn');

  simRamBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (simRunning) return;
      simRamBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      simRam = parseInt(btn.dataset.ram, 10) || 4;
      if (simStatusText) simStatusText.textContent = `Готов к запуску · RAM: ${simRam} GB`;
    });
  });

  if (simLaunchBtn) {
    simLaunchBtn.addEventListener('click', () => {
      if (simRunning) return;
      const keyVal = document.getElementById('sim-key')?.value || '';
      const nickVal = (document.getElementById('sim-nick')?.value || 'Zzidulya').trim() || 'Zzidulya';
      const check = API.validateKeyFormat(keyVal);
      if (!check.valid) {
        if (simStatusText) {
          simStatusText.style.color = 'var(--rose)';
          simStatusText.textContent = check.reason;
        }
        return;
      }

      simRunning = true;
      simLaunchBtn.disabled = true;
      const stages = [
        { pct: 24, msg: 'Проверка лицензии ZZD...' },
        { pct: 58, msg: 'Проверка автономной JRE 21...' },
        { pct: 86, msg: `Инициализация ${nickVal} (${simRam} GB)...` },
        { pct: 100, msg: `Клиент MC 1.21.11 запущен (${simRam} GB)` }
      ];

      let step = 0;
      const tick = () => {
        const s = stages[step];
        if (simProgressFill) simProgressFill.style.width = `${s.pct}%`;
        if (simStatusText) {
          simStatusText.style.color = s.pct === 100 ? 'var(--emerald)' : 'var(--cyan)';
          simStatusText.textContent = s.msg;
        }
        step++;
        if (step < stages.length) {
          setTimeout(tick, 420);
        } else {
          setTimeout(() => {
            simRunning = false;
            simLaunchBtn.disabled = false;
          }, 900);
        }
      };
      tick();
    });
  }

  // --- Module Explorer ---
  const MODULES_CATALOG = [
    { name: 'WindHop', cat: 'Movement', desc: 'Гарантированный максимальный прыжок на заряде ветра при броске под себя в любой тайминг.', tags: ['1.21.11', 'Sync +1t'] },
    { name: 'TargetPearl', cat: 'Movement', desc: 'Предикт траектории эндер-жемчуга цели и автоматический ответный бросок на перехват.', tags: ['Predict', 'AutoSwitch'] },
    { name: 'KillAura', cat: 'Combat', desc: 'Плавные ротации, умный спринт-ресет, криты в прыжке и обход проверок серверов.', tags: ['Matrix', 'FunTime'] },
    { name: 'AutoTotem', cat: 'Combat', desc: 'Моментальный перенос тотема в оффхэнд при критическом HP или угрозе взрыва.', tags: ['Packet', 'ZeroDelay'] },
    { name: 'CrystalAura', cat: 'Combat', desc: 'Автоматическая установка и подрыв эндер-кристаллов с расчётом собственного урона.', tags: ['1.21.11', 'PvP'] },
    { name: 'TriggerBot', cat: 'Combat', desc: 'Точечный удар по хитбоксу цели при наведении с задержкой под крит.', tags: ['Legit', 'Criticals'] },
    { name: 'Velocity', cat: 'Combat', desc: 'Адаптивное снижение или перенаправление отбрасывания без флагов античита.', tags: ['Grim', 'FunTime'] },
    { name: 'NoSlow', cat: 'Movement', desc: 'Сохранение скорости бега при использовании еды, зелий, щита или лука.', tags: ['FunTime', 'Packet'] },
    { name: 'ElytraTarget', cat: 'Movement', desc: 'Автоматическое сопровождение и атака цели в полёте на элитрах с фейерверками.', tags: ['Elytra', 'Chase'] },
    { name: 'TargetESP', cat: 'Visuals', desc: 'Чёткая подсветка выбранной цели с кольцом позиционирования и статусом брони.', tags: ['Render', '3D'] },
    { name: 'NameTags', cat: 'Visuals', desc: 'Информативные неймтеги над игроками: здоровье, зачарования, количество тотемов.', tags: ['HUD', 'Clean'] },
    { name: 'Trajectories', cat: 'Visuals', desc: 'Отображение точной траектории полёта перла, заряда ветра, стрел и зелий.', tags: ['3D Arc', 'Pearl'] },
    { name: 'ChestStealer', cat: 'Player', desc: 'Быстрый забор лута из сундуков с рандомизированной задержкой под античиты.', tags: ['Anarchy', 'Fast'] },
    { name: 'AutoArmor', cat: 'Player', desc: 'Автоматическое надевание лучшего комплекта брони из инвентаря.', tags: ['Utility', 'PvP'] },
    { name: 'FreeCam', cat: 'Player', desc: 'Свободный обзор камерой сквозь блоки для разведки баз и позиций врага.', tags: ['Scout', 'Safe'] }
  ];

  let activeModuleCat = 'all';
  let moduleQuery = '';

  function renderModulesGrid() {
    const grid = document.getElementById('modules-grid');
    if (!grid) return;

    const filtered = MODULES_CATALOG.filter(m => {
      const matchCat = activeModuleCat === 'all' || m.cat === activeModuleCat;
      const q = moduleQuery.toLowerCase();
      const matchSearch = !q || m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q) || m.tags.some(t => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });

    grid.innerHTML = '';
    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-muted);border:1px dashed var(--border-subtle);border-radius:14px;">По запросу «${escapeHtml(moduleQuery)}» модули не найдены.</div>`;
      return;
    }

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = 'module-card';
      card.innerHTML = `
        <div class="module-card-head">
          <span class="module-name">${escapeHtml(m.name)}</span>
          <span class="module-cat">${escapeHtml(m.cat)}</span>
        </div>
        <p class="module-desc">${escapeHtml(m.desc)}</p>
        <div class="module-tags">${m.tags.map(t => `<span class="module-tag">${escapeHtml(t)}</span>`).join('')}</div>
      `;
      grid.appendChild(card);
    });
  }

  document.querySelectorAll('#module-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#module-filters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeModuleCat = btn.dataset.cat;
      renderModulesGrid();
    });
  });

  const moduleSearchInput = document.getElementById('module-search');
  if (moduleSearchInput) {
    moduleSearchInput.addEventListener('input', (e) => {
      moduleQuery = e.target.value.trim();
      renderModulesGrid();
    });
  }
  renderModulesGrid();

  // --- FAQ Accordion ---
  document.querySelectorAll('.faq-item').forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    if (trigger) {
      trigger.addEventListener('click', () => {
        const wasActive = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(other => other.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
      });
    }
  });

  // --- Public Stats & Links ---
  async function loadPublicInfo() {
    const res = await API.getPublicInfo();
    if (!res.ok || !res.data) return;
    const d = res.data;

    const elUsers = document.getElementById('stat-total-users');
    const elDownloads = document.getElementById('stat-total-downloads');
    if (elUsers) elUsers.textContent = String(d.total_users ?? 0);
    if (elDownloads) elDownloads.textContent = String(d.total_downloads ?? 0);

    if (d.telegram_link) {
      const tgFooter = document.getElementById('footer-telegram-link');
      if (tgFooter) tgFooter.href = d.telegram_link;
      document.querySelectorAll('.buy-plan-btn').forEach(a => { a.href = d.telegram_link; });
    }

    const dsFooter = document.getElementById('footer-discord-link');
    if (dsFooter) {
      const dl = (d.discord_link || '').trim();
      if (dl && dl !== 'https://discord.gg/' && dl !== 'https://discord.gg') {
        dsFooter.href = dl;
        dsFooter.style.display = 'inline-flex';
      } else {
        dsFooter.style.display = 'none';
      }
    }
  }

  // --- Auth State & User Header ---
  function renderAuthHeader() {
    if (!btnOpenAuth || !navUserDot || !navUserLabel) return;
    if (!currentUser) {
      navUserDot.className = 'user-status-dot';
      navUserLabel.textContent = 'Войти / Кабинет';
      btnOpenAuth.onclick = () => openModal(modalAuth);
      return;
    }

    if (currentUser.is_banned) navUserDot.className = 'user-status-dot banned';
    else if (currentUser.has_active_sub) navUserDot.className = 'user-status-dot active';
    else navUserDot.className = 'user-status-dot';

    navUserLabel.textContent = currentUser.username;
    btnOpenAuth.onclick = () => openCabinetModal();
  }

  async function checkAuthState() {
    const res = await API.getMe();
    if (res.ok && res.data && res.data.authenticated && res.data.user) {
      currentUser = res.data.user;
    } else {
      currentUser = null;
    }
    renderAuthHeader();
  }

  // --- Auth Tabs & Forms ---
  const tabLogin = document.getElementById('tab-btn-login');
  const tabRegister = document.getElementById('tab-btn-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  function switchAuthTab(mode) {
    if (!tabLogin || !tabRegister || !formLogin || !formRegister) return;
    const isReg = mode === 'register';
    tabLogin.classList.toggle('active', !isReg);
    tabRegister.classList.toggle('active', isReg);
    formLogin.style.display = isReg ? 'none' : 'block';
    formRegister.style.display = isReg ? 'block' : 'none';
  }

  if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));

  // Key Formatter + Live Validation Hint
  function bindKeyFormatter(input, hintEl = null) {
    if (!input) return;
    input.addEventListener('input', () => {
      const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      input.value = cleaned;

      if (!hintEl) return;
      if (!cleaned.trim()) {
        hintEl.className = 'key-hint';
        hintEl.textContent = 'Можно активировать позже в кабинете';
        return;
      }
      const check = API.validateKeyFormat(cleaned);
      if (check.valid) {
        hintEl.className = 'key-hint ok';
        hintEl.textContent = `Формат верный (${check.cleanKey})`;
      } else {
        hintEl.className = 'key-hint err';
        hintEl.textContent = check.reason;
      }
    });
  }

  bindKeyFormatter(document.getElementById('reg-key'), document.getElementById('reg-key-hint'));
  bindKeyFormatter(document.getElementById('redeem-key-input'));

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value.trim();
      const p = document.getElementById('login-password').value;
      if (!u || !p) return Toast.error('Заполните логин и пароль');

      const res = await API.login(u, p);
      if (res.ok && res.data && res.data.success) {
        if (res.data.token) API.setUserToken(res.data.token);
        currentUser = res.data.user;
        Toast.success(`С возвращением, ${currentUser.username}`);
        closeModal(modalAuth);
        renderAuthHeader();
        loadPublicInfo();
      } else {
        Toast.error(res.data?.error || 'Неверный логин или пароль');
      }
    });
  }

  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('reg-username').value.trim();
      const p = document.getElementById('reg-password').value;
      const k = (document.getElementById('reg-key')?.value || '').trim();
      if (!u || !p) return Toast.error('Заполните логин и пароль');

      const res = await API.register(u, p, k);
      if (res.ok && res.data && res.data.success) {
        if (res.data.token) API.setUserToken(res.data.token);
        currentUser = res.data.user;
        Toast.success(res.data.message || 'Аккаунт создан');
        closeModal(modalAuth);
        renderAuthHeader();
        loadPublicInfo();
      } else {
        Toast.error(res.data?.error || 'Ошибка регистрации');
      }
    });
  }

  // --- User Cabinet ---
  function openCabinetModal() {
    if (!currentUser) {
      switchAuthTab('login');
      openModal(modalAuth);
      return;
    }

    const avatarEl = document.getElementById('cab-avatar');
    const nameEl = document.getElementById('cab-username');
    const statusEl = document.getElementById('cab-sub-status');
    const expiryEl = document.getElementById('cab-sub-expiry');
    const zipBtn = document.getElementById('btn-cab-download-zip');
    const backendInput = document.getElementById('backend-url-input');

    if (avatarEl) avatarEl.textContent = (currentUser.username || 'Z')[0].toUpperCase();
    if (nameEl) nameEl.textContent = currentUser.username;

    if (currentUser.is_banned) {
      statusEl.className = 'badge badge-red';
      statusEl.textContent = 'ЗАБЛОКИРОВАН';
      expiryEl.textContent = currentUser.ban_reason || 'Нарушение правил';
    } else if (currentUser.has_active_sub) {
      statusEl.className = 'badge badge-green';
      statusEl.textContent = currentUser.sub_type ? `АКТИВНА · ${currentUser.sub_type}` : 'АКТИВНА';
      expiryEl.textContent = currentUser.sub_expires_at === 'lifetime'
        ? 'Бессрочно (Lifetime)'
        : new Date(currentUser.sub_expires_at).toLocaleDateString('ru-RU');
    } else {
      statusEl.className = 'badge badge-amber';
      statusEl.textContent = 'НЕТ ПОДПИСКИ';
      expiryEl.textContent = 'Активируйте ключ ниже';
    }

    if (zipBtn) {
      zipBtn.style.display = (API.hasLiveBackend() && currentUser.has_active_sub && !currentUser.is_banned) ? 'inline-flex' : 'none';
    }
    if (backendInput) {
      backendInput.value = API.getBaseUrl();
    }

    openModal(modalCabinet);
  }

  const formRedeemKey = document.getElementById('form-redeem-key');
  if (formRedeemKey) {
    formRedeemKey.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('redeem-key-input');
      const code = input.value.trim();
      if (!code) return Toast.error('Введите ключ доступа');

      const res = await API.redeemKey(code);
      if (res.ok && res.data && res.data.success) {
        Toast.success(res.data.message || 'Ключ активирован');
        currentUser = res.data.user;
        input.value = '';
        renderAuthHeader();
        openCabinetModal();
      } else {
        Toast.error(res.data?.error || 'Недействительный или использованный ключ');
      }
    });
  }

  const btnCabLogout = document.getElementById('btn-cab-logout');
  if (btnCabLogout) {
    btnCabLogout.addEventListener('click', async () => {
      await API.logout();
      currentUser = null;
      renderAuthHeader();
      closeModal(modalCabinet);
      Toast.info('Вы вышли из аккаунта');
    });
  }

  // Cabinet Backend URL config (for GH Pages + Tunnel)
  const backendToggle = document.getElementById('cab-backend-toggle');
  const backendBox = document.getElementById('cab-backend-box');
  if (backendToggle && backendBox) {
    backendToggle.addEventListener('click', () => {
      backendBox.style.display = backendBox.style.display === 'none' ? 'block' : 'none';
    });
  }

  const formBackendUrl = document.getElementById('form-backend-url');
  if (formBackendUrl) {
    formBackendUrl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = document.getElementById('backend-url-input').value.trim();
      API.setBaseUrl(val);
      Toast.info(val ? 'Адрес сервера сохранён, обновляем данные...' : 'Режим локального хранилища включён');
      await checkAuthState();
      await loadPublicInfo();
    });
  }

  const btnBackendReset = document.getElementById('btn-backend-reset');
  if (btnBackendReset) {
    btnBackendReset.addEventListener('click', async () => {
      API.setBaseUrl('');
      const inp = document.getElementById('backend-url-input');
      if (inp) inp.value = '';
      Toast.info('Адрес сервера сброшен');
      await checkAuthState();
      await loadPublicInfo();
    });
  }

  // --- Downloads ---
  const PAGES_LOADER_DOWNLOAD_URL = 'https://gdeagusha.github.io/zzidulyadlc/ZzidulyaLoader.exe?v=20261115e';

  function resolveLoaderUrl() {
    if (API.getBaseUrl()) return `${API.getBaseUrl()}/ZzidulyaLoader.exe?v=20261115e`;
    if (window.location.protocol.startsWith('http')) {
      return './ZzidulyaLoader.exe?v=20261115e';
    }
    return PAGES_LOADER_DOWNLOAD_URL;
  }

  function handleDownloadClick(asArchive = false) {
    if (!currentUser) {
      Toast.warn('Сначала войдите в аккаунт или зарегистрируйтесь');
      switchAuthTab('login');
      openModal(modalAuth);
      return;
    }
    if (currentUser.is_banned) {
      Toast.error(`Аккаунт заблокирован: ${currentUser.ban_reason || 'Нарушение правил'}`);
      return;
    }
    if (!currentUser.has_active_sub) {
      Toast.warn('Активируйте ключ доступа для скачивания');
      openCabinetModal();
      return;
    }

    if (asArchive) {
      Toast.success('Запускается загрузка архива ZzidulyaDLC-Client.zip...');
      window.location.href = API.getDownloadUrl();
    } else {
      Toast.success('Подписка активна! Скачивание ZzidulyaLoader.exe...');
      const a = document.createElement('a');
      a.href = resolveLoaderUrl();
      a.download = 'ZzidulyaLoader.exe';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  if (btnHeroDownload) btnHeroDownload.addEventListener('click', () => handleDownloadClick(false));
  const btnCabDownload = document.getElementById('btn-cab-download');
  if (btnCabDownload) btnCabDownload.addEventListener('click', () => handleDownloadClick(false));
  const btnCabDownloadZip = document.getElementById('btn-cab-download-zip');
  if (btnCabDownloadZip) btnCabDownloadZip.addEventListener('click', () => handleDownloadClick(true));

  if (btnHeroCabinet) btnHeroCabinet.addEventListener('click', () => openCabinetModal());
  const openActivateFlow = () => {
    if (currentUser) {
      openCabinetModal();
      setTimeout(() => document.getElementById('redeem-key-input')?.focus(), 100);
    } else {
      switchAuthTab('register');
      openModal(modalAuth);
      setTimeout(() => document.getElementById('reg-key')?.focus(), 100);
    }
  };
  if (btnHeroActivate) btnHeroActivate.addEventListener('click', openActivateFlow);
  if (btnPricingActivate) btnPricingActivate.addEventListener('click', openActivateFlow);

  // =========================================================
  // Admin Workspace & Inline Action Dialogs
  // =========================================================
  const adminAuthCard = document.getElementById('admin-auth-card');
  const adminDashboard = document.getElementById('admin-dashboard');
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  const formAdminLogin = document.getElementById('form-admin-login');

  async function checkAdminState() {
    const res = await API.adminMe();
    if (res.ok && res.data && res.data.is_admin) {
      showAdminDashboard();
    } else {
      showAdminLogin();
    }
  }

  function showAdminLogin() {
    if (adminAuthCard) adminAuthCard.style.display = 'block';
    if (adminDashboard) adminDashboard.style.display = 'none';
    if (btnAdminLogout) btnAdminLogout.style.display = 'none';
  }

  function showAdminDashboard() {
    if (adminAuthCard) adminAuthCard.style.display = 'none';
    if (adminDashboard) adminDashboard.style.display = 'block';
    if (btnAdminLogout) btnAdminLogout.style.display = 'inline-flex';
    loadAdminStats();
    loadAdminUsers();
    loadAdminKeys();
  }

  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwdInput = document.getElementById('admin-password-input');
      const res = await API.adminLogin(pwdInput.value);
      if (res.ok && res.data && res.data.success) {
        if (res.data.token) API.setAdminToken(res.data.token);
        pwdInput.value = '';
        Toast.success('Доступ администратора подтверждён');
        showAdminDashboard();
      } else {
        Toast.error(res.data?.error || 'Неверный пароль администратора');
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', async () => {
      await API.adminLogout();
      Toast.info('Выход из панели администратора');
      showAdminLogin();
    });
  }

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => { c.style.display = 'none'; });
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.style.display = 'block';
      if (btn.dataset.target === 'tab-admin-archive') loadArchiveStatus();
    });
  });

  function renderArchiveDetails(arch) {
    if (!arch) return;
    const srcEl = document.getElementById('adm-archive-source');
    const stEl = document.getElementById('adm-archive-status');
    const sizeEl = document.getElementById('adm-archive-size');
    const progWrap = document.getElementById('adm-archive-progress-wrap');
    const progBar = document.getElementById('adm-archive-progress-bar');
    const progLbl = document.getElementById('adm-archive-progress-label');

    if (srcEl && arch.source_path) srcEl.textContent = arch.source_path;
    if (stEl) {
      stEl.textContent = arch.is_building ? 'Сборка...' : (arch.archive_exists ? 'Готов к выдаче' : 'Не собран');
      stEl.style.color = arch.is_building ? 'var(--cyan)' : (arch.archive_exists ? '#34d399' : '#fbbf24');
    }
    if (sizeEl) {
      sizeEl.textContent = arch.archive_exists ? `${arch.archive_size_mb} MB` : 'Нет файла';
    }
    if (progWrap && progBar && progLbl) {
      if (arch.is_building) {
        progWrap.style.display = 'block';
        const pct = arch.progress ?? 0;
        progBar.style.width = `${pct}%`;
        progLbl.textContent = `${pct}%`;
      } else {
        progWrap.style.display = 'none';
      }
    }
  }

  async function loadArchiveStatus() {
    const res = await API.adminArchiveStatus();
    if (!res.ok || !res.data) return;
    renderArchiveDetails(res.data);

    if (res.data.is_building && !archivePollTimer) {
      archivePollTimer = setInterval(async () => {
        const poll = await API.adminArchiveStatus();
        if (poll.ok && poll.data) {
          renderArchiveDetails(poll.data);
          if (!poll.data.is_building) {
            clearInterval(archivePollTimer);
            archivePollTimer = null;
            Toast.success('ZIP-архив клиента успешно пересобран');
            loadAdminStats();
          }
        }
      }, 1500);
    }
  }

  async function loadAdminStats() {
    const res = await API.adminStats();
    if (!res.ok || !res.data) return;
    const s = res.data.stats || {};

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val ?? 0);
    };

    setTxt('adm-stat-users', s.total_users ?? 0);
    setTxt('adm-stat-active-subs', s.active_sub_users ?? 0);
    setTxt('adm-stat-banned', s.banned_users ?? 0);
    setTxt('adm-stat-keys', `${s.unused_keys ?? 0} / ${s.total_keys ?? 0}`);
    setTxt('adm-stat-downloads', s.total_downloads ?? 0);

    if (res.data.archive) renderArchiveDetails(res.data.archive);
  }

  // Inline Admin Action Dialog (no browser prompt/confirm)
  let pendingAdminAction = null;

  function openAdminActionDialog({ title, subtitle, bodyHtml, confirmLabel = 'Подтвердить', confirmClass = 'btn-primary', onBind, onSubmit }) {
    const titleEl = document.getElementById('admin-action-title');
    const subEl = document.getElementById('admin-action-subtitle');
    const bodyEl = document.getElementById('admin-action-body');
    const btnConfirm = document.getElementById('btn-admin-action-confirm');

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (btnConfirm) {
      btnConfirm.textContent = confirmLabel;
      btnConfirm.className = `btn ${confirmClass} btn-sm`;
    }

    pendingAdminAction = onSubmit;
    if (onBind) onBind(bodyEl);
    openModal(modalAdminAction, true);
  }

  const formAdminAction = document.getElementById('form-admin-action');
  if (formAdminAction) {
    formAdminAction.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (typeof pendingAdminAction === 'function') {
        await pendingAdminAction();
      }
      closeModal(modalAdminAction);
      pendingAdminAction = null;
    });
  }

  // Users Table
  async function loadAdminUsers(search = '') {
    const res = await API.adminUsers(search);
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const users = res.ok && res.data && Array.isArray(res.data.users) ? res.data.users : [];
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Пользователи не найдены</td></tr>';
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      const statusBadge = u.is_banned
        ? '<span class="badge badge-red">БАН</span>'
        : (u.has_active_sub ? '<span class="badge badge-green">АКТИВНА</span>' : '<span class="badge badge-purple">НЕТ</span>');

      tr.innerHTML = `
        <td style="font-family:var(--font-mono);color:var(--text-muted);">#${escapeHtml(u.id)}</td>
        <td><strong>${escapeHtml(u.username)}</strong></td>
        <td>${statusBadge}</td>
        <td>${escapeHtml(u.sub_type || '—')}</td>
        <td style="font-family:var(--font-mono);">${escapeHtml(u.total_downloads ?? 0)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-xs btn-secondary btn-grant-sub" data-id="${u.id}" data-name="${escapeHtml(u.username)}" type="button">+ Саб</button>
            ${u.has_active_sub ? `<button class="btn btn-xs btn-ghost btn-revoke-sub" data-id="${u.id}" data-name="${escapeHtml(u.username)}" type="button">Снять</button>` : ''}
            ${u.is_banned
              ? `<button class="btn btn-xs btn-emerald btn-unban" data-id="${u.id}" type="button">Разбан</button>`
              : `<button class="btn btn-xs btn-danger btn-ban" data-id="${u.id}" data-name="${escapeHtml(u.username)}" type="button">Бан</button>`
            }
            <button class="btn btn-xs btn-ghost btn-del-user" data-id="${u.id}" data-name="${escapeHtml(u.username)}" type="button" title="Удалить">✕</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    const refreshAll = () => {
      const q = document.getElementById('admin-user-search')?.value.trim() || '';
      loadAdminUsers(q);
      loadAdminStats();
    };

    tbody.querySelectorAll('.btn-grant-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.id;
        const uname = btn.dataset.name;
        openAdminActionDialog({
          title: `Выдать подписку: ${uname}`,
          subtitle: 'Выберите срок или введите количество дней (-1 для Lifetime).',
          bodyHtml: `
            <div class="preset-grid">
              <button type="button" class="preset-btn" data-days="1">1 дн.</button>
              <button type="button" class="preset-btn" data-days="7">7 дн.</button>
              <button type="button" class="preset-btn active" data-days="30">30 дн.</button>
              <button type="button" class="preset-btn" data-days="90">90 дн.</button>
              <button type="button" class="preset-btn" data-days="-1">Lifetime</button>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="grant-days-input">Дней (или -1)</label>
              <input id="grant-days-input" type="number" class="form-input" value="30" required>
            </div>
          `,
          confirmLabel: 'Выдать подписку',
          onBind: (root) => {
            const input = root.querySelector('#grant-days-input');
            root.querySelectorAll('.preset-btn').forEach(pBtn => {
              pBtn.addEventListener('click', () => {
                root.querySelectorAll('.preset-btn').forEach(x => x.classList.remove('active'));
                pBtn.classList.add('active');
                input.value = pBtn.dataset.days;
              });
            });
          },
          onSubmit: async () => {
            const days = parseInt(document.getElementById('grant-days-input').value, 10);
            if (Number.isNaN(days)) return Toast.error('Укажите корректное число дней');
            const r = await API.adminUserAction('grant_sub', uid, { duration_days: days });
            if (r.ok) Toast.success(r.data?.message || 'Подписка выдана');
            else Toast.error(r.data?.error || 'Ошибка выдачи');
            refreshAll();
          }
        });
      });
    });

    tbody.querySelectorAll('.btn-revoke-sub').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.id;
        const uname = btn.dataset.name;
        openAdminActionDialog({
          title: 'Аннулировать подписку',
          subtitle: `Подписка пользователя ${uname} будет немедленно снята.`,
          bodyHtml: '',
          confirmLabel: 'Снять подписку',
          confirmClass: 'btn-danger',
          onSubmit: async () => {
            const r = await API.adminUserAction('revoke_sub', uid);
            if (r.ok) Toast.info(r.data?.message || 'Подписка снята');
            else Toast.error(r.data?.error || 'Ошибка');
            refreshAll();
          }
        });
      });
    });

    tbody.querySelectorAll('.btn-ban').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.id;
        const uname = btn.dataset.name;
        openAdminActionDialog({
          title: `Блокировка: ${uname}`,
          subtitle: 'Пользователь потеряет доступ к загрузке и активации ключей.',
          bodyHtml: `
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" for="ban-reason-input">Причина блокировки</label>
              <input id="ban-reason-input" type="text" class="form-input" value="Нарушение правил" required>
            </div>
          `,
          confirmLabel: 'Заблокировать',
          confirmClass: 'btn-danger',
          onSubmit: async () => {
            const reason = document.getElementById('ban-reason-input').value.trim() || 'Нарушение правил';
            const r = await API.adminUserAction('ban', uid, { reason });
            if (r.ok) Toast.warn(r.data?.message || 'Пользователь заблокирован');
            else Toast.error(r.data?.error || 'Ошибка');
            refreshAll();
          }
        });
      });
    });

    tbody.querySelectorAll('.btn-unban').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await API.adminUserAction('unban', btn.dataset.id);
        if (r.ok) Toast.success(r.data?.message || 'Пользователь разблокирован');
        else Toast.error(r.data?.error || 'Ошибка');
        refreshAll();
      });
    });

    tbody.querySelectorAll('.btn-del-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.id;
        const uname = btn.dataset.name;
        openAdminActionDialog({
          title: 'Удаление аккаунта',
          subtitle: `Аккаунт ${uname} (#${uid}) будет удалён безвозвратно.`,
          bodyHtml: '',
          confirmLabel: 'Удалить навсегда',
          confirmClass: 'btn-danger',
          onSubmit: async () => {
            const r = await API.adminUserAction('delete', uid);
            if (r.ok) Toast.info(r.data?.message || 'Пользователь удалён');
            else Toast.error(r.data?.error || 'Ошибка');
            refreshAll();
          }
        });
      });
    });
  }

  const userSearchInput = document.getElementById('admin-user-search');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => loadAdminUsers(e.target.value.trim()));
  }
  const btnRefreshUsers = document.getElementById('btn-refresh-users');
  if (btnRefreshUsers) {
    btnRefreshUsers.addEventListener('click', () => {
      loadAdminUsers(userSearchInput?.value.trim() || '');
      loadAdminStats();
    });
  }

  // Keys Management
  function renderAdminKeysTable() {
    const tbody = document.getElementById('admin-keys-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = allAdminKeys.filter(k => {
      if (currentKeyFilter === 'free') return k.is_used !== 1;
      if (currentKeyFilter === 'used') return k.is_used === 1;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Ключи не найдены</td></tr>';
      return;
    }

    filtered.forEach(k => {
      const tr = document.createElement('tr');
      const isUsed = k.is_used === 1;
      const dur = k.duration_days === -1 ? 'Lifetime' : `${k.duration_days} дн.`;
      tr.innerHTML = `
        <td><code style="font-family:var(--font-mono);color:#fff;">${escapeHtml(k.key_code)}</code></td>
        <td>${escapeHtml(dur)}</td>
        <td>${isUsed ? `<span class="badge badge-red">Использован (${escapeHtml(k.used_by_username || '—')})</span>` : '<span class="badge badge-green">Свободен</span>'}</td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">${k.used_at ? escapeHtml(new Date(k.used_at).toLocaleDateString('ru-RU')) : '—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-xs btn-secondary btn-copy-key" data-key="${escapeHtml(k.key_code)}" type="button">Копировать</button>
            ${!isUsed ? `<button class="btn btn-xs btn-danger btn-del-key" data-id="${k.id}" type="button">Удалить</button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-copy-key').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.key, `Ключ ${btn.dataset.key} скопирован`));
    });

    tbody.querySelectorAll('.btn-del-key').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await API.adminDeleteKey(btn.dataset.id);
        if (r.ok) Toast.info(r.data?.message || 'Ключ удалён');
        else Toast.error(r.data?.error || 'Не удалось удалить ключ');
        loadAdminKeys();
        loadAdminStats();
      });
    });
  }

  async function loadAdminKeys() {
    const res = await API.adminGetKeys();
    allAdminKeys = (res.ok && res.data && Array.isArray(res.data.keys)) ? res.data.keys : [];
    renderAdminKeysTable();
  }

  document.querySelectorAll('#key-filter-pills .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#key-filter-pills .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentKeyFilter = btn.dataset.kfilter;
      renderAdminKeysTable();
    });
  });

  const formGenKeys = document.getElementById('form-generate-keys');
  if (formGenKeys) {
    formGenKeys.addEventListener('submit', async (e) => {
      e.preventDefault();
      const count = parseInt(document.getElementById('gen-key-count').value, 10);
      const days = parseInt(document.getElementById('gen-key-days').value, 10);
      const res = await API.adminGenerateKeys(count, days);
      if (res.ok && res.data && res.data.success) {
        Toast.success(res.data.message || 'Ключи сгенерированы');
        loadAdminKeys();
        loadAdminStats();

        const box = document.getElementById('generated-keys-box');
        const out = document.getElementById('gen-keys-output');
        if (box && out && Array.isArray(res.data.created_keys)) {
          out.value = res.data.created_keys.join('\n');
          box.style.display = 'block';
        }
      } else {
        Toast.error(res.data?.error || 'Ошибка генерации ключей');
      }
    });
  }

  const btnCopyAllKeys = document.getElementById('btn-copy-all-keys');
  if (btnCopyAllKeys) {
    btnCopyAllKeys.addEventListener('click', () => {
      const val = document.getElementById('gen-keys-output')?.value || '';
      if (val) copyToClipboard(val, 'Все созданные ключи скопированы');
    });
  }

  // Archive Rebuild
  const btnRebuildArchive = document.getElementById('btn-rebuild-archive');
  if (btnRebuildArchive) {
    btnRebuildArchive.addEventListener('click', async () => {
      const res = await API.adminRebuildArchive();
      if (res.ok && res.data?.success) {
        Toast.info(res.data.message || 'Сборка архива запущена');
        loadArchiveStatus();
      } else {
        Toast.warn(res.data?.message || res.data?.error || 'Не удалось запустить сборку');
      }
    });
  }

  // Change Admin Password
  const formChangeAdminPwd = document.getElementById('form-change-admin-pwd');
  if (formChangeAdminPwd) {
    formChangeAdminPwd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = document.getElementById('adm-curr-pwd').value;
      const nw = document.getElementById('adm-new-pwd').value;
      const res = await API.adminChangePassword(cur, nw);
      if (res.ok && res.data?.success) {
        Toast.success(res.data.message || 'Пароль обновлён');
        formChangeAdminPwd.reset();
      } else {
        Toast.error(res.data?.error || 'Ошибка смены пароля');
      }
    });
  }

  // Admin Open Triggers
  if (adminSecretTrigger) {
    adminSecretTrigger.addEventListener('click', () => {
      openModal(modalAdmin);
      checkAdminState();
    });
  }

  if (window.location.pathname.includes('/admin') || window.location.hash === '#admin') {
    openModal(modalAdmin);
    checkAdminState();
  }

  // Init
  loadPublicInfo();
  checkAuthState();
});
