// ============================================
// LOGIN COMPONENT - Enhanced UI
// Modern glassmorphism design with animations
// ============================================

import { createElement } from '../utils/dom.js';
import { auth } from '../services/apiClient.js';

export default function Login({ onLoginSuccess, onToast }) {
    const container = createElement('div', {
        class: 'min-h-screen flex items-center justify-center p-4',
    });
    
    // Animated gradient background
    container.style.background = 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)';
    container.style.backgroundSize = '400% 400%';
    container.style.animation = 'gradient 15s ease infinite';
    
    // Add keyframes for gradient animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
        }
    `;
    document.head.appendChild(style);

    // Glassmorphism card
    const loginCard = createElement('div', {
        class: 'w-full max-w-md',
    });
    loginCard.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        padding: 40px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.3);
        animation: float 6s ease-in-out infinite;
    `;

    // Logo/Icon with animation
    const iconContainer = createElement('div', {
        class: 'text-center mb-6',
    });
    iconContainer.style.animation = 'float 3s ease-in-out infinite';
    iconContainer.innerHTML = `
        <div style="
            font-size: 64px; 
            margin-bottom: 8px;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
        ">📦</div>
    `;

    // Title
    const title = createElement('div', {
        class: 'text-center mb-2',
    });
    title.innerHTML = `
        <h1 style="
            font-size: 32px; 
            font-weight: 800; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
        ">Bonario Stock</h1>
        <p style="color: #6b7280; font-size: 14px; font-weight: 500;">
            Hệ Thống Quản Lý Tồn Kho
        </p>
    `;

    // Divider
    const divider = createElement('div', {
        class: 'my-6',
    });
    divider.style.cssText = `
        height: 1px;
        background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
    `;

    // Form
    const form = createElement('form', {
        class: 'space-y-5',
    });

    // Input group helper
    function createInputGroup(id, label, type, placeholder, icon) {
        const group = createElement('div', {});
        
        const labelEl = createElement('label', {
            class: 'block text-sm font-semibold mb-2',
            for: id,
        });
        labelEl.style.color = '#374151';
        labelEl.textContent = label;

        const inputWrapper = createElement('div', {
            style: 'position: relative;'
        });

        // Icon
        const iconEl = createElement('div', {
            style: `
                position: absolute;
                left: 16px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 18px;
                color: #9ca3af;
                pointer-events: none;
                transition: color 0.3s;
            `
        });
        iconEl.textContent = icon;

        const input = createElement('input', {
            type: type,
            id: id,
            name: id,
            required: true,
            placeholder: placeholder,
            class: 'w-full pl-44 py-3 pr-4 rounded-xl border-2 focus:outline-none transition-all duration-300',
        });
        input.style.cssText = `
            border-color: #e5e7eb;
            background-color: #f9fafb;
            padding-left: 48px;
        `;
        
        // Focus effects
        input.addEventListener('focus', () => {
            input.style.borderColor = '#667eea';
            input.style.backgroundColor = '#fff';
            input.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
            iconEl.style.color = '#667eea';
        });
        
        input.addEventListener('blur', () => {
            input.style.borderColor = '#e5e7eb';
            input.style.backgroundColor = '#f9fafb';
            input.style.boxShadow = 'none';
            iconEl.style.color = '#9ca3af';
        });

        inputWrapper.appendChild(iconEl);
        inputWrapper.appendChild(input);
        group.appendChild(labelEl);
        group.appendChild(inputWrapper);
        
        return { group, input };
    }

    // Username field
    const usernameField = createInputGroup('username', 'Tên đăng nhập', 'text', 'Nhập username', '👤');
    form.appendChild(usernameField.group);

    // Password field
    const passwordField = createInputGroup('password', 'Mật khẩu', 'password', 'Nhập mật khẩu', '🔒');
    form.appendChild(passwordField.group);

    // Submit button with shimmer effect
    const submitBtn = createElement('button', {
        type: 'submit',
        class: 'w-full py-3.5 rounded-xl font-bold text-white transition-all duration-300 relative overflow-hidden',
    });
    submitBtn.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        transform: translateY(0);
    `;
    submitBtn.textContent = 'Đăng Nhập';
    submitBtn.disabled = false;

    // Hover effect
    submitBtn.addEventListener('mouseenter', () => {
        submitBtn.style.transform = 'translateY(-2px)';
        submitBtn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
    });
    submitBtn.addEventListener('mouseleave', () => {
        submitBtn.style.transform = 'translateY(0)';
        submitBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });

    // Error message
    const errorDiv = createElement('div', {
        id: 'loginError',
        class: 'hidden text-center text-sm py-3 rounded-xl',
    });
    errorDiv.style.cssText = `
        background: linear-gradient(135deg, #fee 0%, #fcc 100%);
        color: #c00;
        border: 1px solid #fcc;
    `;

    // Success message
    const successDiv = createElement('div', {
        id: 'loginSuccess',
        class: 'hidden text-center text-sm py-3 rounded-xl',
    });
    successDiv.style.cssText = `
        background: linear-gradient(135deg, #efe 0%, #cfc 100%);
        color: #060;
        border: 1px solid #cfc;
    `;

    form.appendChild(errorDiv);
    form.appendChild(successDiv);
    form.appendChild(submitBtn);

    // Footer
    const footer = createElement('div', {
        class: 'mt-6 text-center',
    });
    footer.innerHTML = `
        <p style="font-size: 12px; color: #9ca3af;">
            🔒 Bảo mật bằng JWT Token • 24h session
        </p>
    `;

    loginCard.appendChild(iconContainer);
    loginCard.appendChild(title);
    loginCard.appendChild(divider);
    loginCard.appendChild(form);
    loginCard.appendChild(footer);
    container.appendChild(loginCard);

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameField.input.value.trim();
        const password = passwordField.input.value;
        
        // Reset messages
        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
        
        // Loading state with animation
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 8px;">
                <svg style="animation: spin 1s linear infinite; width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke-width="3" stroke-opacity="0.25"/>
                    <path cx="12" cy="12" r="10" stroke-width="3" stroke-linecap="round"/>
                </svg>
                Đang đăng nhập...
            </span>
        `;
        submitBtn.style.opacity = '0.8';
        submitBtn.style.cursor = 'not-allowed';

        const startTime = Date.now();
        
        try {
            const result = await auth.login(username, password);
            
            // Minimum loading time for better UX
            const elapsed = Date.now() - startTime;
            if (elapsed < 800) {
                await new Promise(resolve => setTimeout(resolve, 800 - elapsed));
            }
            
            if (result.success) {
                successDiv.textContent = `✅ Đăng nhập thành công! Chào mừng ${result.data.username}`;
                successDiv.classList.remove('hidden');
                
                onToast?.(`Chào mừng ${result.data.username}! 🎉`, 'success', 2500);
                
                // Delay before redirect
                await new Promise(resolve => setTimeout(resolve, 800));
                onLoginSuccess?.(result.data);
            } else {
                throw new Error(result.error || 'Đăng nhập thất bại');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = `❌ ${error.message || 'Đăng nhập thất bại. Vui lòng thử lại.'}`;
            errorDiv.classList.remove('hidden');
            onToast?.(error.message, 'error', 3500);
            
            // Shake animation on error
            loginCard.style.animation = 'none';
            setTimeout(() => {
                loginCard.style.animation = 'float 6s ease-in-out infinite';
            }, 10);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
        }
    });

    // Cleanup on unmount (optional)
    container.cleanup = () => {
        const styleEl = document.querySelector('style');
        if (styleEl && styleEl.textContent.includes('@keyframes gradient')) {
            styleEl.remove();
        }
    };

    return container;
}
