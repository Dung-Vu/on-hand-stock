// ============================================
// ADMIN DASHBOARD COMPONENT
// User management for admin role
// ============================================

import { createElement } from '../utils/dom.js';
import { auth } from '../services/apiClient.js';

export default function AdminDashboard({ currentUser, onToast, onClose }) {
    const container = createElement('div', {
        class: 'fixed inset-0 z-50 overflow-y-auto',
    });
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

    const modal = createElement('div', {
        class: 'min-h-screen flex items-center justify-center p-4',
    });

    const modalContent = createElement('div', {
        class: 'w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden',
    });

    // Header
    const header = createElement('div', {
        class: 'px-6 py-4 flex items-center justify-between border-b',
    });
    header.style.borderColor = '#e8ddd4';
    header.innerHTML = `
        <div>
            <h2 class="text-xl font-bold" style="color: #2a231f">👑 Admin Dashboard</h2>
            <p class="text-xs mt-1" style="color: #7d6d5a">Quản lý người dùng</p>
        </div>
        <button id="closeAdminBtn" class="text-2xl hover:opacity-70 transition-opacity" style="color: #7d6d5a">&times;</button>
    `;

    // Body
    const body = createElement('div', {
        class: 'p-6',
    });

    // Stats row
    const statsRow = createElement('div', {
        class: 'grid grid-cols-3 gap-4 mb-6',
    });

    const statCard = (icon, label, value, color) => {
        const card = createElement('div', {
            class: 'p-4 rounded-xl text-center',
        });
        card.style.background = color;
        card.innerHTML = `
            <div class="text-2xl mb-1">${icon}</div>
            <div class="text-xs" style="color: #7d6d5a">${label}</div>
            <div class="text-2xl font-bold mt-1" style="color: #2a231f">${value}</div>
        `;
        return card;
    };

    statsRow.appendChild(statCard('👥', 'Tổng Users', '...', 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)'));
    statsRow.appendChild(statCard('👑', 'Admin', '...', 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'));
    statsRow.appendChild(statCard('🔍', 'Counter', '...', 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'));

    // Create user form
    const createForm = createElement('div', {
        class: 'mb-6 p-4 rounded-xl',
    });
    createForm.style.background = '#faf8f5';
    createForm.style.border = '1.5px solid #d4c4b0';

    createForm.innerHTML = `
        <h3 class="font-bold mb-3" style="color: #2a231f">➕ Tạo User Mới</h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input type="text" id="newUsername" placeholder="Username" 
                class="px-3 py-2 rounded-lg border-2" style="border-color: #d4c4b0; background: white">
            <input type="password" id="newPassword" placeholder="Mật khẩu" 
                class="px-3 py-2 rounded-lg border-2" style="border-color: #d4c4b0; background: white">
            <select id="newRole" class="px-3 py-2 rounded-lg border-2" style="border-color: #d4c4b0; background: white">
                <option value="counter">Counter</option>
                <option value="admin">Admin</option>
            </select>
            <button id="createUserBtn" class="px-4 py-2 rounded-lg font-bold text-white"
                style="background: linear-gradient(135deg, #10b981 0%, #059669 100%)">
                Tạo User
            </button>
        </div>
    `;

    // Users table
    const tableWrap = createElement('div', {
        class: 'overflow-x-auto',
    });
    tableWrap.style.border = '1.5px solid #e8ddd4';
    tableWrap.style.borderRadius = '12px';
    tableWrap.style.minWidth = '0';

    const table = createElement('table', {
        class: 'w-full text-sm',
    });
    table.innerHTML = `
        <thead>
            <tr style="background: #faf8f5; border-bottom: 1px solid #e8ddd4">
                <th class="px-4 py-3 text-left font-semibold" style="color: #2a231f">ID</th>
                <th class="px-4 py-3 text-left font-semibold" style="color: #2a231f">Username</th>
                <th class="px-4 py-3 text-left font-semibold" style="color: #2a231f">Role</th>
                <th class="px-4 py-3 text-left font-semibold" style="color: #2a231f">Status</th>
                <th class="px-4 py-3 text-left font-semibold" style="color: #2a231f">Last Login</th>
                <th class="px-4 py-3 text-right font-semibold" style="color: #2a231f">Actions</th>
            </tr>
        </thead>
        <tbody id="usersTableBody"></tbody>
    `;

    tableWrap.appendChild(table);

    body.appendChild(statsRow);
    body.appendChild(createForm);
    body.appendChild(tableWrap);

    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);
    container.appendChild(modal);

    // State
    let users = [];

    // Load users
    async function loadUsers() {
        try {
            const result = await auth.listUsers();
            if (result.success) {
                users = result.data;
                renderUsers();
                updateStats();
            }
        } catch (error) {
            console.error('Load users error:', error);
            onToast?.('Không thể tải danh sách users', 'error', 3000);
        }
    }

    // Update stats
    function updateStats() {
        const total = users.length;
        const admins = users.filter(u => u.role === 'admin').length;
        const counters = users.filter(u => u.role === 'counter').length;

        statsRow.children[0].querySelector('div:last-child').textContent = total;
        statsRow.children[1].querySelector('div:last-child').textContent = admins;
        statsRow.children[2].querySelector('div:last-child').textContent = counters;
    }

    // Render users table
    function renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        users.forEach(user => {
            const row = createElement('tr', {
                class: 'border-b hover:bg-gray-50 transition-colors',
            });
            row.style.borderColor = '#f5f1ea';

            const isAdmin = user.role === 'admin';
            const isSelf = user.id === currentUser.id;

            row.innerHTML = `
                <td class="px-4 py-3" style="color: #7d6d5a">${user.id}</td>
                <td class="px-4 py-3 font-semibold" style="color: #2a231f">${user.username}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded text-xs font-bold" 
                        style="background: ${isAdmin ? '#fef3c7' : '#d1fae5'}; color: ${isAdmin ? '#92400e' : '#065f46'}">
                        ${isAdmin ? '👑 Admin' : '🔍 Counter'}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 rounded text-xs font-bold" 
                        style="background: ${user.is_active ? '#d1fae5' : '#fee'}; color: ${user.is_active ? '#065f46' : '#991b1b'}">
                        ${user.is_active ? '✓ Active' : '✗ Inactive'}
                    </span>
                </td>
                <td class="px-4 py-3" style="color: #7d6d5a">
                    ${user.last_login_at ? new Date(user.last_login_at).toLocaleString('vi-VN') : 'Never'}
                </td>
                <td class="px-4 py-3 text-right">
                    ${!isSelf ? `
                        <button class="toggle-status-btn px-3 py-1 rounded text-xs font-semibold mr-1" data-id="${user.id}" data-active="${user.is_active}"
                            style="background: ${user.is_active ? '#fee' : '#d1fae5'}; color: ${user.is_active ? '#991b1b' : '#065f46'}">
                            ${user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="delete-user-btn px-3 py-1 rounded text-xs font-semibold" data-id="${user.id}"
                            style="background: #fee; color: #991b1b">
                            Delete
                        </button>
                    ` : '<span class="text-xs" style="color: #7d6d5a">— You —</span>'}
                </td>
            `;

            tbody.appendChild(row);
        });

        // Attach event listeners
        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = parseInt(e.target.dataset.id);
                const isActive = e.target.dataset.active === 'true';
                await toggleUserStatus(userId, !isActive);
            });
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = parseInt(e.target.dataset.id);
                if (confirm(`Xóa user ID ${userId}? Hành động này không thể hoàn tác.`)) {
                    await deleteUser(userId);
                }
            });
        });
    }

    // Toggle user status
    async function toggleUserStatus(userId, isActive) {
        try {
            const result = await auth.updateUser(userId, { is_active: isActive });
            if (result.success) {
                onToast?.(`User ${isActive ? 'activated' : 'deactivated'}`, 'success', 2000);
                await loadUsers();
            }
        } catch (error) {
            console.error('Toggle user error:', error);
            onToast?.(error.message, 'error', 3000);
        }
    }

    // Delete user
    async function deleteUser(userId) {
        try {
            const result = await auth.deleteUser(userId);
            if (result.success) {
                onToast?.('User deleted', 'success', 2000);
                await loadUsers();
            }
        } catch (error) {
            console.error('Delete user error:', error);
            onToast?.(error.message, 'error', 3000);
        }
    }

    // Create user
    document.getElementById('createUserBtn').addEventListener('click', async () => {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newRole').value;

        if (!username || !password) {
            onToast?.('Username và password không được để trống', 'warning', 3000);
            return;
        }

        try {
            const result = await auth.createUser(username, password, role);
            if (result.success) {
                onToast?.(`User ${username} created`, 'success', 2000);
                document.getElementById('newUsername').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('newRole').value = 'counter';
                await loadUsers();
            }
        } catch (error) {
            console.error('Create user error:', error);
            onToast?.(error.message || 'Tạo user thất bại', 'error', 3000);
        }
    });

    // Close button
    document.getElementById('closeAdminBtn').addEventListener('click', () => {
        onClose?.();
    });

    // Close on backdrop click
    container.addEventListener('click', (e) => {
        if (e.target === container) {
            onClose?.();
        }
    });

    // Initial load
    loadUsers();

    return container;
}
