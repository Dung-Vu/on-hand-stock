import { createElement } from '../utils/dom.js';
import { auth } from '../services/apiClient.js';

export default function Login({ onLoginSuccess, onToast, onClose }) {
  const container = createElement('div', { class: 'login-screen' });
  const card = createElement('div', { class: 'login-card panel' });

  const closeBtn = createElement('button', {
    class: 'login-close',
    type: 'button',
    'aria-label': 'Đóng',
    title: 'Đóng (ESC)',
  });
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', event => {
    event.stopPropagation();
    cleanup();
    onClose?.();
  });

  const logoArea = createElement('div', { class: 'brand', style: 'margin-bottom: 22px;' });
  const mark = createElement('div', { class: 'brand-mark', 'aria-hidden': 'true' });
  mark.textContent = 'B';
  const titles = createElement('div', {});
  const heading = createElement('h1', { class: 'brand-name' });
  heading.textContent = 'Đăng nhập';
  const sub = createElement('p', { class: 'brand-sub' });
  sub.textContent = 'Dùng cho kiểm kho và quản trị tài khoản';
  titles.append(heading, sub);
  logoArea.append(mark, titles);

  const form = createElement('form', { class: 'form-stack' });

  const usernameGroup = createElement('div', {});
  const usernameLabel = createElement('label', { for: 'login-username', class: 'form-label' });
  usernameLabel.textContent = 'Tên đăng nhập';
  const usernameInput = createElement('input', {
    type: 'text',
    id: 'login-username',
    name: 'username',
    required: 'true',
    placeholder: 'Tên đăng nhập',
    autocomplete: 'username',
    class: 'control-block',
  });
  usernameGroup.append(usernameLabel, usernameInput);

  const passwordGroup = createElement('div', {});
  const passwordLabel = createElement('label', { for: 'login-password', class: 'form-label' });
  passwordLabel.textContent = 'Mật khẩu';
  const passwordWrap = createElement('div', { style: 'position: relative;' });
  const passwordInput = createElement('input', {
    type: 'password',
    id: 'login-password',
    name: 'password',
    required: 'true',
    placeholder: 'Mật khẩu',
    autocomplete: 'current-password',
    class: 'control-block',
  });
  passwordInput.style.paddingRight = '64px';
  const togglePwBtn = createElement('button', {
    type: 'button',
    class: 'password-toggle',
    'aria-label': 'Hiện hoặc ẩn mật khẩu',
  });
  togglePwBtn.textContent = 'Hiện';
  let pwVisible = false;
  togglePwBtn.addEventListener('click', () => {
    pwVisible = !pwVisible;
    passwordInput.type = pwVisible ? 'text' : 'password';
    togglePwBtn.textContent = pwVisible ? 'Ẩn' : 'Hiện';
  });
  passwordWrap.append(passwordInput, togglePwBtn);
  passwordGroup.append(passwordLabel, passwordWrap);

  const errorDiv = createElement('div', { class: 'alert alert-error', role: 'alert' });
  errorDiv.style.display = 'none';

  const submitBtn = createElement('button', { type: 'submit', class: 'action-btn action-btn-primary' });
  submitBtn.textContent = 'Đăng nhập';

  const footer = createElement('p', { class: 'login-foot' });
  footer.textContent = 'ESC để đóng';

  form.append(usernameGroup, passwordGroup, errorDiv, submitBtn);
  card.append(closeBtn, logoArea, form, footer);
  container.appendChild(card);

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    usernameInput.classList.add('error');
    passwordInput.classList.add('error');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
  }

  function hideError() {
    errorDiv.style.display = 'none';
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');
  }

  usernameInput.addEventListener('input', hideError);
  passwordInput.addEventListener('input', hideError);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username) {
      showError('Vui lòng nhập tên đăng nhập');
      usernameInput.focus();
      return;
    }
    if (!password) {
      showError('Vui lòng nhập mật khẩu');
      passwordInput.focus();
      return;
    }

    hideError();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý…';

    try {
      const result = await auth.login(username, password);
      if (!result.success) throw new Error(result.error || 'Đăng nhập thất bại');
      cleanup();
      onToast?.(`Chào mừng ${result.data.username}`, 'success', 2500);
      onLoginSuccess?.(result.data);
    } catch (error) {
      const message = error.message || 'Sai tên đăng nhập hoặc mật khẩu';
      showError(message);
      onToast?.(message, 'error', 3000);
      passwordInput.value = '';
      passwordInput.focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng nhập';
    }
  });

  function handleEsc(event) {
    if (event.key !== 'Escape') return;
    cleanup();
    onClose?.();
  }

  document.addEventListener('keydown', handleEsc);
  container.addEventListener('click', event => {
    if (event.target !== container) return;
    cleanup();
    onClose?.();
  });

  function cleanup() {
    document.removeEventListener('keydown', handleEsc);
  }

  requestAnimationFrame(() => usernameInput.focus());
  return container;
}
