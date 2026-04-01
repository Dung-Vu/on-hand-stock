// ============================================
// ADMIN DASHBOARD COMPONENT - Redesigned & Bug Fixed
// ============================================

import { createElement } from '../utils/dom.js';
import { auth } from '../services/apiClient.js';

// Inject styles once
let _adminStylesInjected = false;
function injectAdminStyles() {
    if (_adminStylesInjected) return;
    _adminStylesInjected = true;
    const style = document.createElement('style');
    style.id = 'admin-dashboard-styles';
    style.textContent = `
        @keyframes adminFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes adminSlideUp {
            from { opacity: 0; transform: translateY(24px) scale(0.98); }
            to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .admin-overlay { animation: adminFadeIn 0.2s ease-out forwards; }
        .admin-modal   { animation: adminSlideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards; }

        .admin-input {
            width: 100%;
            height: 42px;
            padding: 0 12px;
            border-radius: 9px;
            border: 1.5px solid #d4c4b0;
            background: #ffffff;
            font-size: 14px;
            color: #2a231f;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
            font-family: inherit;
        }
        .admin-input::placeholder { color: #b89d7a; }
        .admin-input:focus {
            border-color: #8b6b4f;
            box-shadow: 0 0 0 3px rgba(139,107,79,0.15);
        }
        .admin-select {
            width: 100%;
            height: 42px;
            padding: 0 12px;
            border-radius: 9px;
            border: 1.5px solid #d4c4b0;
            background: #ffffff;
            font-size: 14px;
            color: #2a231f;
            outline: none;
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b6b4f' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 32px;
            transition: border-color 0.2s, box-shadow 0.2s;
            font-family: inherit;
        }
        .admin-select:focus {
            border-color: #8b6b4f;
            box-shadow: 0 0 0 3px rgba(139,107,79,0.15);
        }
        .admin-btn-primary {
            height: 42px;
            padding: 0 20px;
            border-radius: 9px;
            border: none;
            background: linear-gradient(135deg, #6b5a45 0%, #8b7355 100%);
            color: #ffffff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
            font-family: inherit;
        }
        .admin-btn-primary:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 14px rgba(107,90,69,0.35);
        }
        .admin-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .admin-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .admin-btn-danger {
            height: 32px;
            padding: 0 14px;
            border-radius: 7px;
            border: 1.5px solid #fecaca;
            background: #fff5f5;
            color: #dc2626;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s, transform 0.1s;
            font-family: inherit;
            white-space: nowrap;
        }
        .admin-btn-danger:hover {
            background: #fee2e2;
            border-color: #fca5a5;
            transform: translateY(-1px);
        }
        .admin-btn-danger:active { transform: translateY(0); }

        .admin-close-btn {
            width: 34px; height: 34px;
            border-radius: 50%;
            border: 1.5px solid #e8ddd4;
            background: #f5f1ea;
            color: #7d6d5a;
            font-size: 20px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s, color 0.15s, border-color 0.15s;
            line-height: 1;
            flex-shrink: 0;
        }
        .admin-close-btn:hover { background: #e8ddd4; color: #3f3630; border-color: #d4c4b0; }

        .admin-stat-card {
            border-radius: 14px;
            padding: 16px 12px;
            text-align: center;
            border: 1.5px solid rgba(0,0,0,0.06);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .admin-stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(42,35,31,0.1);
        }

        .admin-th {
            padding: 11px 16px;
            font-size: 11px;
            font-weight: 700;
            color: #7d6d5a;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            white-space: nowrap;
        }
        .admin-td {
            padding: 13px 16px;
            font-size: 14px;
            color: #2a231f;
            border-top: 1px solid #f5f1ea;
        }
        .admin-row:hover > .admin-td { background: #faf8f5; }
        .admin-row:first-child > .admin-td { border-top: none; }

        .admin-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.02em;
        }

        /* Responsive: stack form on mobile */
        @media (max-width: 640px) {
            .admin-create-grid {
                grid-template-columns: 1fr !important;
            }
            .admin-create-grid .admin-btn-primary {
                width: 100%;
            }
            .admin-th.hide-mobile,
            .admin-td.hide-mobile { display: none; }
        }
    `;
    document.head.appendChild(style);
}

export default function AdminDashboard({ currentUser, onToast, onClose }) {
    injectAdminStyles();

    // ── Overlay
    const overlay = createElement('div', { class: 'admin-overlay fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4' });
    overlay.style.cssText = 'background: rgba(42,35,31,0.45); backdrop-filter: blur(2px); padding-top: max(16px, 3vh); padding-bottom: 16px;';

    // ── Modal
    const modal = createElement('div', { class: 'admin-modal w-full bg-white' });
    modal.style.cssText = `
        max-width: 820px;
        width: 100%;
        border-radius: 20px;
        box-shadow: 0 24px 80px rgba(42,35,31,0.22), 0 4px 16px rgba(42,35,31,0.08);
        border: 1.5px solid #e8ddd4;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 40px);
    `;

    // ── Header
    const header = createElement('div', {});
    header.style.cssText = `
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1.5px solid #f0ebe4;
        background: linear-gradient(to bottom, #ffffff, #faf8f5);
        flex-shrink: 0;
        gap: 12px;
    `;

    const headerLeft = createElement('div', {});
    headerLeft.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="
                width:40px; height:40px;
                border-radius:12px;
                background: linear-gradient(135deg, #f5f1ea 0%, #e8ddd4 100%);
                border: 1.5px solid #d4c4b0;
                display:flex; align-items:center; justify-content:center;
                font-size:20px; flex-shrink:0;
            ">👑</div>
            <div>
                <h2 style="font-size:17px; font-weight:800; color:#2a231f; margin:0; letter-spacing:-0.2px;">Admin Dashboard</h2>
                <p style="font-size:12px; color:#9d8875; margin:3px 0 0 0;">Quản lý người dùng hệ thống</p>
            </div>
        </div>
    `;

    const closeBtn = createElement('button', { class: 'admin-close-btn', title: 'Đóng (ESC)' });
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => { cleanup(); onClose?.(); });

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // ── Scrollable body
    const body = createElement('div', {});
    body.style.cssText = 'padding: 20px 24px; overflow-y: auto; flex: 1;';

    // ── Stats row
    const statsGrid = createElement('div', {});
    statsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;';

    const statTotalValue  = createElement('div', {});
    const statAdminValue  = createElement('div', {});
    const statCountValue  = createElement('div', {});

    [statTotalValue, statAdminValue, statCountValue].forEach(el => {
        el.style.cssText = 'font-size: 28px; font-weight: 800; color: #2a231f; line-height: 1;';
        el.textContent = '…';
    });

    function makeStatCard(icon, label, valueEl, gradient, dotColor) {
        const card = createElement('div', { class: 'admin-stat-card' });
        card.style.background = gradient;
        const iconDiv = createElement('div', {});
        iconDiv.style.cssText = 'font-size: 24px; margin-bottom: 8px; line-height: 1;';
        iconDiv.textContent = icon;
        const labelDiv = createElement('div', {});
        labelDiv.style.cssText = `font-size: 11px; font-weight: 600; color: ${dotColor}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;`;
        labelDiv.textContent = label;
        card.appendChild(iconDiv);
        card.appendChild(labelDiv);
        card.appendChild(valueEl);
        return card;
    }

    statsGrid.appendChild(makeStatCard('👥', 'Tổng users', statTotalValue,
        'linear-gradient(135deg, #f5f1ea 0%, #e8ddd4 100%)', '#6b5a45'));
    statsGrid.appendChild(makeStatCard('👑', 'Admin', statAdminValue,
        'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', '#92400e'));
    statsGrid.appendChild(makeStatCard('🔍', 'Counter', statCountValue,
        'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', '#065f46'));

    body.appendChild(statsGrid);

    // ── Create user form
    const createSection = createElement('div', {});
    createSection.style.cssText = `
        background: #faf8f5;
        border: 1.5px solid #e8ddd4;
        border-radius: 14px;
        padding: 16px 18px;
        margin-bottom: 20px;
    `;

    const createTitle = createElement('div', {});
    createTitle.style.cssText = 'font-size: 13px; font-weight: 700; color: #6b5a45; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;';
    createTitle.innerHTML = '<span>➕</span> Tạo tài khoản mới';
    createSection.appendChild(createTitle);

    const createGrid = createElement('div', { class: 'admin-create-grid' });
    createGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 140px auto; gap: 10px; align-items: end;';

    // Username input
    const colUser = createElement('div', {});
    const colUserLabel = createElement('label', {});
    colUserLabel.style.cssText = 'display:block; font-size:11px; font-weight:600; color:#7d6d5a; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em;';
    colUserLabel.textContent = 'Username';
    const usernameInput = createElement('input', {
        type: 'text', placeholder: 'tên đăng nhập', class: 'admin-input',
        autocomplete: 'off',
    });
    colUser.appendChild(colUserLabel);
    colUser.appendChild(usernameInput);

    // Password input
    const colPw = createElement('div', {});
    const colPwLabel = createElement('label', {});
    colPwLabel.style.cssText = 'display:block; font-size:11px; font-weight:600; color:#7d6d5a; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em;';
    colPwLabel.textContent = 'Mật khẩu';
    const passwordInput = createElement('input', {
        type: 'password', placeholder: '≥ 6 ký tự', class: 'admin-input',
        autocomplete: 'new-password',
    });
    colPw.appendChild(colPwLabel);
    colPw.appendChild(passwordInput);

    // Role select
    const colRole = createElement('div', {});
    const colRoleLabel = createElement('label', {});
    colRoleLabel.style.cssText = 'display:block; font-size:11px; font-weight:600; color:#7d6d5a; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em;';
    colRoleLabel.textContent = 'Vai trò';
    const roleSelect = createElement('select', { class: 'admin-select' });
    const counterOpt = createElement('option', { value: 'counter' });
    counterOpt.textContent = '🔍 Counter';
    const adminOpt = createElement('option', { value: 'admin' });
    adminOpt.textContent = '👑 Admin';
    roleSelect.appendChild(counterOpt);
    roleSelect.appendChild(adminOpt);
    colRole.appendChild(colRoleLabel);
    colRole.appendChild(roleSelect);

    // Create button
    const createBtn = createElement('button', { type: 'button', class: 'admin-btn-primary' });
    createBtn.style.cssText += '; width: 100%;';
    createBtn.textContent = '+ Tạo';

    createGrid.appendChild(colUser);
    createGrid.appendChild(colPw);
    createGrid.appendChild(colRole);
    createGrid.appendChild(createBtn);
    createSection.appendChild(createGrid);

    // Inline error for create form
    const createError = createElement('div', {});
    createError.style.cssText = 'display:none; margin-top:10px; padding:8px 12px; border-radius:8px; background:#fff5f5; border:1.5px solid #fecaca; color:#dc2626; font-size:12px; font-weight:500;';
    createSection.appendChild(createError);

    body.appendChild(createSection);

    // ── Users table
    const tableSection = createElement('div', {});
    tableSection.style.cssText = 'border: 1.5px solid #e8ddd4; border-radius: 14px; overflow: hidden;';

    const tableHeader = createElement('div', {});
    tableHeader.style.cssText = `
        padding: 12px 16px;
        background: #faf8f5;
        border-bottom: 1.5px solid #e8ddd4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    `;
    const tableTitle = createElement('div', {});
    tableTitle.style.cssText = 'font-size: 13px; font-weight: 700; color: #6b5a45; text-transform: uppercase; letter-spacing: 0.05em;';
    tableTitle.innerHTML = '📋 Danh sách tài khoản';

    const refreshBtn = createElement('button', {});
    refreshBtn.style.cssText = `
        height: 30px; padding: 0 12px;
        border-radius: 8px;
        border: 1.5px solid #d4c4b0;
        background: #ffffff;
        color: #6b5a45;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex; align-items: center; gap: 5px;
        transition: background 0.15s, border-color 0.15s;
        font-family: inherit;
    `;
    refreshBtn.innerHTML = '<span>🔄</span> Làm mới';
    refreshBtn.addEventListener('mouseenter', () => { refreshBtn.style.background = '#f5f1ea'; refreshBtn.style.borderColor = '#c9b99e'; });
    refreshBtn.addEventListener('mouseleave', () => { refreshBtn.style.background = '#ffffff'; refreshBtn.style.borderColor = '#d4c4b0'; });
    refreshBtn.addEventListener('click', loadUsers);

    tableHeader.appendChild(tableTitle);
    tableHeader.appendChild(refreshBtn);
    tableSection.appendChild(tableHeader);

    const tableWrap = createElement('div', {});
    tableWrap.style.cssText = 'overflow-x: auto; -webkit-overflow-scrolling: touch;';

    const table = createElement('table', {});
    table.style.cssText = 'width: 100%; border-collapse: collapse; min-width: 500px;';

    const thead = createElement('thead', {});
    thead.style.cssText = 'background: #faf8f5;';
    const theadRow = createElement('tr', {});

    const columns = [
        { text: 'Username',   align: 'left',  mobile: true  },
        { text: 'Vai trò',    align: 'left',  mobile: true  },
        { text: 'Trạng thái', align: 'left',  mobile: false },
        { text: 'Lần cuối',   align: 'left',  mobile: false },
        { text: '',           align: 'right', mobile: true  }, // Actions
    ];

    columns.forEach(col => {
        const th = createElement('th', { class: `admin-th${col.mobile ? '' : ' hide-mobile'}` });
        th.style.textAlign = col.align;
        th.textContent = col.text;
        theadRow.appendChild(th);
    });
    thead.appendChild(theadRow);
    table.appendChild(thead);

    const tbody = createElement('tbody', {});
    // Loading state
    setTableLoading(tbody);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    tableSection.appendChild(tableWrap);
    body.appendChild(tableSection);

    modal.appendChild(body);
    overlay.appendChild(modal);

    // ── Helper: set table to loading
    function setTableLoading(tbodyEl) {
        tbodyEl.innerHTML = '';
        const tr = createElement('tr', {});
        const td = createElement('td', {});
        td.colSpan = '5';
        td.style.cssText = 'padding: 32px; text-align: center; color: #9d8875; font-size: 14px;';
        td.innerHTML = '<span style="animation: spin 1s linear infinite; display:inline-block;">⏳</span> Đang tải dữ liệu…';
        tr.appendChild(td);
        tbodyEl.appendChild(tr);
    }

    // ── Load users using apiClient.auth
    async function loadUsers() {
        setTableLoading(tbody);
        refreshBtn.disabled = true;

        try {
            const result = await auth.listUsers();

            if (!result.success || !result.data) {
                throw new Error(result.error || 'Không lấy được danh sách user');
            }

            const users = result.data;

            // Update stats
            statTotalValue.textContent = users.length;
            statAdminValue.textContent = users.filter(u => u.role === 'admin').length;
            statCountValue.textContent = users.filter(u => u.role === 'counter').length;

            tbody.innerHTML = '';

            if (users.length === 0) {
                const tr = createElement('tr', {});
                const td = createElement('td', {});
                td.colSpan = '5';
                td.style.cssText = 'padding: 32px; text-align: center; color: #9d8875; font-size: 14px;';
                td.textContent = 'Chưa có tài khoản nào';
                tr.appendChild(td);
                tbody.appendChild(tr);
                return;
            }

            users.forEach(user => {
                const isCurrentUser = user.username === currentUser?.username;
                const isMainAdmin   = user.username === 'dinhdung533';

                const row = createElement('tr', { class: 'admin-row' });

                // Username
                const tdUser = createElement('td', { class: 'admin-td' });
                tdUser.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="
                            width:30px; height:30px;
                            border-radius:8px;
                            background:${user.role === 'admin' ? 'linear-gradient(135deg,#fef3c7,#fde68a)' : 'linear-gradient(135deg,#d1fae5,#a7f3d0)'};
                            display:flex; align-items:center; justify-content:center;
                            font-size:14px; flex-shrink:0;
                        ">${user.role === 'admin' ? '👑' : '🔍'}</div>
                        <div>
                            <div style="font-weight:600; color:#2a231f; font-size:14px;">${user.username}</div>
                            ${isCurrentUser ? '<div style="font-size:10px; color:#8b6b4f; font-weight:500;">● Bạn</div>' : ''}
                        </div>
                    </div>
                `;
                row.appendChild(tdUser);

                // Role
                const tdRole = createElement('td', { class: 'admin-td' });
                const badge = createElement('span', { class: 'admin-badge' });
                if (user.role === 'admin') {
                    badge.style.cssText = 'background:#fef3c7; color:#92400e; border:1px solid #fde68a;';
                    badge.textContent = '👑 Admin';
                } else {
                    badge.style.cssText = 'background:#d1fae5; color:#065f46; border:1px solid #a7f3d0;';
                    badge.textContent = '🔍 Counter';
                }
                tdRole.appendChild(badge);
                row.appendChild(tdRole);

                // Status (hidden on mobile)
                const tdStatus = createElement('td', { class: 'admin-td hide-mobile' });
                const statusBadge = createElement('span', { class: 'admin-badge' });
                if (user.is_active) {
                    statusBadge.style.cssText = 'background:#dcfce7; color:#166534; border:1px solid #86efac;';
                    statusBadge.textContent = '● Active';
                } else {
                    statusBadge.style.cssText = 'background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;';
                    statusBadge.textContent = '○ Inactive';
                }
                tdStatus.appendChild(statusBadge);
                row.appendChild(tdStatus);

                // Last login (hidden on mobile)
                const tdLogin = createElement('td', { class: 'admin-td hide-mobile' });
                tdLogin.style.cssText += 'color:#9d8875; font-size:13px;';
                tdLogin.textContent = user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                    : '—';
                row.appendChild(tdLogin);

                // Actions
                const tdActions = createElement('td', { class: 'admin-td' });
                tdActions.style.textAlign = 'right';

                if (isMainAdmin) {
                    const label = createElement('span', {});
                    label.style.cssText = 'font-size:11px; color:#b89d7a; font-weight:500; white-space:nowrap;';
                    label.textContent = '⚙️ System';
                    tdActions.appendChild(label);
                } else if (isCurrentUser) {
                    const label = createElement('span', {});
                    label.style.cssText = 'font-size:11px; color:#8b6b4f; font-weight:500; white-space:nowrap;';
                    label.textContent = '● Bạn';
                    tdActions.appendChild(label);
                } else {
                    const deleteBtn = createElement('button', { class: 'admin-btn-danger' });
                    deleteBtn.textContent = '🗑 Xóa';
                    deleteBtn.addEventListener('click', async () => {
                        if (!confirm(`Xóa tài khoản "${user.username}"?\nHành động này không thể hoàn tác.`)) return;
                        deleteBtn.disabled = true;
                        deleteBtn.textContent = 'Đang xóa…';
                        try {
                            const res = await auth.deleteUser(user.id);
                            if (res.success) {
                                onToast?.(`Đã xóa tài khoản "${user.username}"`, 'success', 2500);
                                loadUsers();
                            } else {
                                throw new Error(res.error || 'Xóa thất bại');
                            }
                        } catch (err) {
                            onToast?.(err.message, 'error', 3000);
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = '🗑 Xóa';
                        }
                    });
                    tdActions.appendChild(deleteBtn);
                }

                row.appendChild(tdActions);
                tbody.appendChild(row);
            });

        } catch (error) {
            console.error('[AdminDashboard] loadUsers error:', error);
            tbody.innerHTML = '';
            const tr = createElement('tr', {});
            const td = createElement('td', {});
            td.colSpan = '5';
            td.style.cssText = 'padding: 32px; text-align: center; color: #dc2626; font-size: 14px;';
            td.textContent = `❌ Lỗi: ${error.message}`;
            tr.appendChild(td);
            tbody.appendChild(tr);
            onToast?.(`Lỗi tải users: ${error.message}`, 'error', 3500);
        } finally {
            refreshBtn.disabled = false;
        }
    }

    // ── Create user handler
    createBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const role     = roleSelect.value;

        createError.style.display = 'none';

        if (!username) {
            createError.textContent = 'Vui lòng nhập tên đăng nhập';
            createError.style.display = 'block';
            usernameInput.focus();
            return;
        }
        if (username.length < 3) {
            createError.textContent = 'Username phải có ít nhất 3 ký tự';
            createError.style.display = 'block';
            usernameInput.focus();
            return;
        }
        if (!password) {
            createError.textContent = 'Vui lòng nhập mật khẩu';
            createError.style.display = 'block';
            passwordInput.focus();
            return;
        }
        if (password.length < 6) {
            createError.textContent = 'Mật khẩu phải có ít nhất 6 ký tự';
            createError.style.display = 'block';
            passwordInput.focus();
            return;
        }

        createBtn.disabled = true;
        createBtn.textContent = 'Đang tạo…';

        try {
            const res = await auth.createUser(username, password, role);
            if (res.success) {
                onToast?.(`✅ Tạo tài khoản "${username}" thành công!`, 'success', 2500);
                usernameInput.value = '';
                passwordInput.value = '';
                roleSelect.value = 'counter';
                loadUsers();
            } else {
                throw new Error(res.error || 'Tạo user thất bại');
            }
        } catch (err) {
            createError.textContent = err.message;
            createError.style.display = 'block';
            onToast?.(err.message, 'error', 3000);
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = '+ Tạo';
        }
    });

    // ── Press Enter in form fields to trigger create
    [usernameInput, passwordInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); createBtn.click(); }
        });
    });

    // ── ESC to close
    const handleEsc = (e) => {
        if (e.key === 'Escape') { cleanup(); onClose?.(); }
    };
    document.addEventListener('keydown', handleEsc);

    // ── Click outside modal to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { cleanup(); onClose?.(); }
    });

    function cleanup() {
        document.removeEventListener('keydown', handleEsc);
    }

    // ── Initial load
    loadUsers();

    return overlay;
}
