/**
 * ZzidulyaDLC - Neon Toast Notifications
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

  function show(message, type = 'info', duration = 3500) {
    ensureContainer();
    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
    
    item.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-body">${message}</div>
      <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
    `;

    container.appendChild(item);

    setTimeout(() => {
      item.classList.add('toast-leave');
      setTimeout(() => item.remove(), 300);
    }, duration);
  }

  return {
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'error', dur),
    info: (msg, dur) => show(msg, 'info', dur),
    warn: (msg, dur) => show(msg, 'warning', dur)
  };
})();
