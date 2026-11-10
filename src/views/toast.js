function getToastContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-stack';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 3000) {
  if (typeof document === 'undefined') return;
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type || 'info'}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = String(message ?? '');
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('is-in'));

  setTimeout(() => {
    toast.classList.remove('is-in');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
