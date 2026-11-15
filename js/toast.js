/**
 * ZzidulyaDLC — XSS-Safe Toast Notifications
 */
const Toast = (() => {
  let container = null;

  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }

  function show(message, type = 'info', duration = 3600) {
    ensureContainer();
    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '▲' : 'i';

    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = String(message || '');

    const progress = document.createElement('div');
    progress.className = 'toast-progress';
    progress.style.animationDuration = `${duration}ms`;

    item.appendChild(icon);
    item.appendChild(body);
    item.appendChild(progress);
    container.appendChild(item);

    const dismiss = () => {
      if (item.classList.contains('toast-leave')) return;
      item.classList.add('toast-leave');
      setTimeout(() => item.remove(), 240);
    };

    item.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'error', dur),
    info: (msg, dur) => show(msg, 'info', dur),
    warn: (msg, dur) => show(msg, 'warning', dur)
  };
})();
