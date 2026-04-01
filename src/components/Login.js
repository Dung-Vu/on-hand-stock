// ============================================
// LOGIN COMPONENT - Redesigned & Bug Fixed
// ============================================

import { createElement } from '../utils/dom.js';
import { auth } from '../services/apiClient.js';

// Inject animation styles only once
let _stylesInjected = false;
function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement('style');
    style.id = 'login-styles';
    style.textContent = `
        @keyframes loginCardAppear {
            from { opacity: 0; transform: translateY(20px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes loginShake {
            0%, 100% { transform: translateX(0); }
            20%       { transform: translateX(-6px); }
            40%       { transform: translateX(6px); }
            60%       { transform: translateX(-4px); }
            80%       { transform: translateX(4px); }
        }
        .login-card { animation: loginCardAppear 0.3s cubic-bezier(0.16,1,0.3,1) forwards; }
        .login-card.shake { animation: loginShake 0.4s ease-out; }
        .login-input {
            width: 100%;
            height: 46px;
            padding: 0 44px 0 14px;
            border-radius: 10px;
            border: 1.5px solid #d4c4b0;
            background: #faf8f5;
            font-size: 14px;
            color: #2a231f;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
            box-sizing: border-box;
            font-family: inherit;
        }
        .login-input::placeholder { color: #b89d7a; }
        .login-input:focus {
            border-color: #8b6b4f;
            background: #ffffff;
            box-shadow: 0 0 0 3px rgba(139,107,79,0.15);
        }
        .login-input.error {
            border-color: #dc2626;
            background: #fff5f5;
            box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
        }
        .login-btn {
            width: 100%;
            height: 46px;
            border-radius: 10px;
            border: none;
            background: linear-gradient(135deg, #6b5a45 0%, #8b7355 100%);
            color: #ffffff;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
            font-family: inherit;
            letter-spacing: 0.01em;
        }
        .login-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(107,90,69,0.35);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .login-close-btn {
            position: absolute;
            top: 12px; right: 12px;
            width: 32px; height: 32px;
            border-radius: 50%;
            border: none;
            background: #f5f1ea;
            color: #7d6d5a;
            font-size: 18px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s, color 0.15s;
            line-height: 1;
        }
        .login-close-btn:hover { background: #e8ddd4; color: #3f3630; }
        .login-toggle-pw {
            position: absolute;
            right: 12px; top: 50%;
            transform: translateY(-50%);
            background: none; border: none;
            cursor: pointer; padding: 4px;
            color: #9d8875; font-size: 16px;
            line-height: 1;
            transition: color 0.15s;
        }
        .login-toggle-pw:hover { color: #6b5a45; }
        .login-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #6b5a45;
            margin-bottom: 6px;
            letter-spacing: 0.03em;
            text-transform: uppercase;
        }
        .login-error-msg {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-radius: 10px;
            background: #fff5f5;
            border: 1.5px solid #fecaca;
            color: #dc2626;
            font-size: 13px;
            font-weight: 500;
            margin-top: 4px;
        }
        .login-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 20px 0;
        }
        .login-divider-line {
            flex: 1;
            height: 1px;
            background: #e8ddd4;
        }
        .login-divider-text {
            font-size: 11px;
            color: #b89d7a;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }
    `;
    document.head.appendChild(style);
}

export default function Login({ onLoginSuccess, onToast, onClose }) {
    injectStyles();

    // ── Outer wrapper (takes full space of parent overlay)
    const container = createElement('div', {
        class: 'w-full flex items-center justify-center p-4',
    });
    container.style.minHeight = '100%';

    // ── Card
    const card = createElement('div', { class: 'login-card' });
    card.style.cssText = `
        position: relative;
        width: 100%;
        max-width: 380px;
        background: #ffffff;
        border-radius: 20px;
        padding: 36px 32px 32px;
        box-shadow: 0 20px 60px rgba(42,35,31,0.18), 0 4px 16px rgba(42,35,31,0.08);
        border: 1.5px solid #e8ddd4;
    `;

    // ── Close button
    const closeBtn = createElement('button', { class: 'login-close-btn', title: 'Đóng (ESC)' });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); cleanup(); onClose?.(); });
    card.appendChild(closeBtn);

    // ── Logo / Icon area
    const logoArea = createElement('div', {});
    logoArea.style.cssText = 'text-align: center; margin-bottom: 24px;';
    logoArea.innerHTML = `
        <div style="
            width: 60px; height: 60px;
            border-radius: 16px;
            background: linear-gradient(135deg, #f5f1ea 0%, #e8ddd4 100%);
            border: 2px solid #d4c4b0;
            display: inline-flex; align-items: center; justify-content: center;
            font-size: 28px;
            margin-bottom: 14px;
            box-shadow: 0 4px 12px rgba(107,90,69,0.15);
        ">📦</div>
        <h1 style="font-size: 22px; font-weight: 800; color: #2a231f; margin: 0 0 4px 0; letter-spacing: -0.3px;">Bonario Stock</h1>
        <p style="font-size: 13px; color: #9d8875; margin: 0;">Đăng nhập để quản lý kho hàng</p>
    `;
    card.appendChild(logoArea);

    // ── Form
    const form = createElement('form', {});
    form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    // Username field
    const usernameGroup = createElement('div', {});
    const usernameLabel = createElement('label', { for: 'login-username', class: 'login-label' });
    usernameLabel.textContent = 'Tên đăng nhập';
    const usernameWrap = createElement('div', {});
    usernameWrap.style.position = 'relative';
    const usernameIconSpan = createElement('span', {});
    usernameIconSpan.style.cssText = `
        position: absolute; left: 12px; top: 50%;
        transform: translateY(-50%);
        font-size: 16px; pointer-events: none; line-height: 1;
    `;
    usernameIconSpan.textContent = '👤';
    const usernameInput = createElement('input', {
        type: 'text',
        id: 'login-username',
        name: 'username',
        required: 'true',
        placeholder: 'Nhập tên đăng nhập',
        autocomplete: 'username',
        class: 'login-input',
    });
    usernameInput.style.paddingLeft = '42px';
    usernameWrap.appendChild(usernameIconSpan);
    usernameWrap.appendChild(usernameInput);
    usernameGroup.appendChild(usernameLabel);
    usernameGroup.appendChild(usernameWrap);
    form.appendChild(usernameGroup);

    // Password field
    const passwordGroup = createElement('div', {});
    const passwordLabel = createElement('label', { for: 'login-password', class: 'login-label' });
    passwordLabel.textContent = 'Mật khẩu';
    const passwordWrap = createElement('div', {});
    passwordWrap.style.position = 'relative';
    const passwordIconSpan = createElement('span', {});
    passwordIconSpan.style.cssText = `
        position: absolute; left: 12px; top: 50%;
        transform: translateY(-50%);
        font-size: 16px; pointer-events: none; line-height: 1;
    `;
    passwordIconSpan.textContent = '🔒';
    const passwordInput = createElement('input', {
        type: 'password',
        id: 'login-password',
        name: 'password',
        required: 'true',
        placeholder: '••••••••',
        autocomplete: 'current-password',
        class: 'login-input',
    });
    passwordInput.style.paddingLeft = '42px';

    // Toggle show/hide password
    const togglePwBtn = createElement('button', { type: 'button', class: 'login-toggle-pw', title: 'Hiện/Ẩn mật khẩu' });
    togglePwBtn.textContent = '👁';
    let pwVisible = false;
    togglePwBtn.addEventListener('click', () => {
        pwVisible = !pwVisible;
        passwordInput.type = pwVisible ? 'text' : 'password';
        togglePwBtn.textContent = pwVisible ? '🙈' : '👁';
    });

    passwordWrap.appendChild(passwordIconSpan);
    passwordWrap.appendChild(passwordInput);
    passwordWrap.appendChild(togglePwBtn);
    passwordGroup.appendChild(passwordLabel);
    passwordGroup.appendChild(passwordWrap);
    form.appendChild(passwordGroup);

    // Error message (hidden by default)
    const errorDiv = createElement('div', { class: 'login-error-msg' });
    errorDiv.style.display = 'none';
    errorDiv.innerHTML = '<span>⚠️</span><span class="login-error-text"></span>';
    form.appendChild(errorDiv);

    // Submit button
    const submitBtn = createElement('button', { type: 'submit', class: 'login-btn' });
    submitBtn.style.marginTop = '4px';
    submitBtn.textContent = 'Đăng Nhập';
    form.appendChild(submitBtn);

    card.appendChild(form);

    // ── Footer hint
    const footer = createElement('div', {});
    footer.style.cssText = 'text-align: center; margin-top: 20px;';
    footer.innerHTML = `<p style="font-size: 11px; color: #b89d7a; margin: 0;">Nhấn <kbd style="background:#f5f1ea;border:1px solid #d4c4b0;border-radius:4px;padding:1px 5px;font-size:10px;">ESC</kbd> để đóng</p>`;
    card.appendChild(footer);

    container.appendChild(card);

    // ── Helper: show error
    function showError(msg) {
        const textEl = errorDiv.querySelector('.login-error-text');
        if (textEl) textEl.textContent = msg;
        errorDiv.style.display = 'flex';
        usernameInput.classList.add('error');
        passwordInput.classList.add('error');
        // Shake animation
        card.classList.remove('shake');
        void card.offsetWidth; // reflow
        card.classList.add('shake');
        card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
    }

    function hideError() {
        errorDiv.style.display = 'none';
        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');
    }

    // Clear error on typing
    usernameInput.addEventListener('input', hideError);
    passwordInput.addEventListener('input', hideError);

    // ── Form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
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
            if (result.success) {
                cleanup();
                onToast?.(`Chào mừng ${result.data.username}! 👋`, 'success', 2500);
                onLoginSuccess?.(result.data);
            } else {
                throw new Error(result.error || 'Đăng nhập thất bại');
            }
        } catch (error) {
            const msg = error.message || 'Sai tên đăng nhập hoặc mật khẩu';
            showError(msg);
            onToast?.(msg, 'error', 3000);
            passwordInput.value = '';
            passwordInput.focus();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng Nhập';
        }
    });

    // ── ESC key handler
    function handleEsc(e) {
        if (e.key === 'Escape') { cleanup(); onClose?.(); }
    }
    document.addEventListener('keydown', handleEsc);

    // ── Click outside card to close
    container.addEventListener('click', (e) => {
        if (e.target === container) { cleanup(); onClose?.(); }
    });

    // ── Cleanup: remove listeners
    function cleanup() {
        document.removeEventListener('keydown', handleEsc);
    }

    // ── Auto-focus username on next tick
    requestAnimationFrame(() => usernameInput.focus());

    return container;
}
