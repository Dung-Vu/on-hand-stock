// ============================================
// ADMIN DASHBOARD COMPONENT
// ============================================

import { createElement } from '../utils/dom.js';
import { auth } from '../services/apiClient.js';

export default function AdminDashboard({ currentUser, onToast, onClose }) {
  // ── Overlay
  const overlay = createElement('div', {
    class: 'admin-overlay fixed inset-0 z-50 overflow-y-auto flex items-start justify-center p-4',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'adminModalTitle',
  });
  overlay.style.cssText = 'padding-top: max(16px, 3vh); padding-bottom: 16px;';

  // ── Modal
  const modal = createElement('div', { class: 'admin-modal w-full bg-white' });

  // ── Header
  const header = createElement('div', { class: 'admin-modal-header' });

  const headerLeft = createElement('div', {});
  headerLeft.innerHTML = `
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">A</div>
      <div>
        <h2 id="adminModalTitle" class="brand-name">Quản trị tài khoản</h2>
        <p class="brand-sub">Tạo, khóa và phân quyền người dùng</p>
      </div>
    </div>
  `;

  const closeBtn = createElement('button', {
    class: 'admin-close-btn',
    type: 'button',
    'aria-label': 'Đóng quản trị tài khoản',
    title: 'Đóng (ESC)',
  });
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    cleanup();
    onClose?.();
  });

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // ── Scrollable body
  const body = createElement('div', { class: 'admin-body' });

  // ── Stats row
  const statsGrid = createElement('div', { class: 'admin-stats' });

  const statTotalValue = createElement('div', { class: 'admin-stat-value' });
  const statAdminValue = createElement('div', { class: 'admin-stat-value' });
  const statCountValue = createElement('div', { class: 'admin-stat-value' });
  [statTotalValue, statAdminValue, statCountValue].forEach(el => {
    el.textContent = '…';
  });

  function makeStatCard(label, valueEl) {
    const card = createElement('div', { class: 'metric' });
    const labelDiv = createElement('div', { class: 'quantity-label' });
    labelDiv.textContent = label;
    card.append(labelDiv, valueEl);
    return card;
  }

  statsGrid.append(
    makeStatCard('Tổng tài khoản', statTotalValue),
    makeStatCard('Admin', statAdminValue),
    makeStatCard('Counter', statCountValue)
  );

  body.appendChild(statsGrid);

  // ── Create user form
  const createSection = createElement('div', { class: 'admin-section' });

  const createTitle = createElement('div', { class: 'admin-section-title' });
  createTitle.textContent = 'Tạo tài khoản mới';
  createSection.appendChild(createTitle);

  const createGrid = createElement('div', { class: 'admin-create-grid' });

  const colUser = createElement('div', {});
  const colUserLabel = createElement('label', { class: 'form-label', for: 'adminNewUsername' });
  colUserLabel.textContent = 'Username';
  const usernameInput = createElement('input', {
    id: 'adminNewUsername',
    type: 'text',
    placeholder: 'tên đăng nhập',
    class: 'admin-input',
    autocomplete: 'off',
  });
  colUser.appendChild(colUserLabel);
  colUser.appendChild(usernameInput);

  // Password input
  const colPw = createElement('div', {});
  const colPwLabel = createElement('label', { class: 'form-label', for: 'adminNewPassword' });
  colPwLabel.textContent = 'Mật khẩu';
  const passwordInput = createElement('input', {
    id: 'adminNewPassword',
    type: 'password',
    placeholder: '≥ 6 ký tự',
    class: 'admin-input',
    autocomplete: 'new-password',
  });
  colPw.appendChild(colPwLabel);
  colPw.appendChild(passwordInput);

  // Role select
  const colRole = createElement('div', {});
  const colRoleLabel = createElement('label', { class: 'form-label', for: 'adminNewRole' });
  colRoleLabel.textContent = 'Vai trò';
  const roleSelect = createElement('select', { id: 'adminNewRole', class: 'admin-select' });
  const counterOpt = createElement('option', { value: 'counter' });
  counterOpt.textContent = 'Counter';
  const adminOpt = createElement('option', { value: 'admin' });
  adminOpt.textContent = 'Admin';
  roleSelect.appendChild(counterOpt);
  roleSelect.appendChild(adminOpt);
  colRole.appendChild(colRoleLabel);
  colRole.appendChild(roleSelect);

  // Create button
  const createBtn = createElement('button', { type: 'button', class: 'admin-btn-primary' });
  createBtn.textContent = 'Tạo';

  createGrid.appendChild(colUser);
  createGrid.appendChild(colPw);
  createGrid.appendChild(colRole);
  createGrid.appendChild(createBtn);
  createSection.appendChild(createGrid);

  // Inline error for create form
  const createError = createElement('div', {
    class: 'alert alert-error',
    role: 'alert',
    style: 'display:none; margin-top:10px;',
  });
  createSection.appendChild(createError);

  body.appendChild(createSection);

  // ── Users table
  const tableSection = createElement('div', { class: 'admin-table-card' });

  const tableHeader = createElement('div', { class: 'admin-table-bar' });
  const tableTitle = createElement('div', { class: 'admin-table-title' });
  tableTitle.textContent = 'Danh sách tài khoản';

  const refreshBtn = createElement('button', { class: 'text-btn', type: 'button' });
  refreshBtn.textContent = 'Làm mới';
  refreshBtn.addEventListener('click', loadUsers);

  tableHeader.appendChild(tableTitle);
  tableHeader.appendChild(refreshBtn);
  tableSection.appendChild(tableHeader);

  const tableWrap = createElement('div', { class: 'admin-scroll' });

  const table = createElement('table', { class: 'admin-table' });

  const thead = createElement('thead', { class: 'stocktake-head' });
  const theadRow = createElement('tr', {});

  const columns = [
    { text: 'Username', align: 'left', mobile: true },
    { text: 'Vai trò', align: 'left', mobile: true },
    { text: 'Trạng thái', align: 'left', mobile: false },
    { text: 'Lần cuối', align: 'left', mobile: false },
    { text: 'Thao tác', align: 'right', mobile: true },
  ];

  columns.forEach(col => {
    const th = createElement('th', {
      scope: 'col',
      class: `admin-th${col.mobile ? '' : ' hide-mobile'}`,
    });
    th.style.textAlign = col.align;
    th.textContent = col.text;
    theadRow.appendChild(th);
  });
  thead.appendChild(theadRow);
  table.appendChild(thead);

  const tbody = createElement('tbody', {});
  setTableLoading(tbody);
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  tableSection.appendChild(tableWrap);
  body.appendChild(tableSection);

  modal.appendChild(body);
  overlay.appendChild(modal);

  function setTableLoading(tbodyEl) {
    tbodyEl.innerHTML = '';
    const tr = createElement('tr', {});
    const td = createElement('td', {});
    td.colSpan = '5';
    td.className = 'admin-empty';
    td.textContent = 'Đang tải dữ liệu…';
    tr.appendChild(td);
    tbodyEl.appendChild(tr);
  }

  async function loadUsers() {
    setTableLoading(tbody);
    refreshBtn.disabled = true;

    try {
      const result = await auth.listUsers();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Không lấy được danh sách user');
      }

      const users = result.data;

      statTotalValue.textContent = users.length;
      statAdminValue.textContent = users.filter(u => u.role === 'admin').length;
      statCountValue.textContent = users.filter(u => u.role === 'counter').length;

      tbody.innerHTML = '';

      if (users.length === 0) {
        const tr = createElement('tr', {});
        const td = createElement('td', {});
        td.colSpan = '5';
        td.className = 'admin-empty';
        td.textContent = 'Chưa có tài khoản nào';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      users.forEach(user => {
        const isCurrentUser = user.username === currentUser?.username;
        const isMainAdmin = user.username === 'dinhdung533';

        const row = createElement('tr', { class: 'admin-row' });

        // Username
        const tdUser = createElement('td', { class: 'admin-td' });
        const userLine = createElement('div', { class: 'admin-user' });
        const userName = createElement('span');
        userName.textContent = user.username;
        userLine.appendChild(userName);
        if (isCurrentUser) {
          const you = createElement('span', { class: 'admin-you' });
          you.textContent = 'Bạn';
          userLine.appendChild(you);
        }
        tdUser.appendChild(userLine);
        row.appendChild(tdUser);

        // Role
        const tdRole = createElement('td', { class: 'admin-td' });
        const badge = createElement('span', {
          class: `admin-badge ${user.role === 'admin' ? 'badge-role-admin' : 'badge-role-counter'}`,
        });
        badge.textContent = user.role === 'admin' ? 'Admin' : 'Counter';
        tdRole.appendChild(badge);
        row.appendChild(tdRole);

        // Status (hidden on mobile)
        const tdStatus = createElement('td', { class: 'admin-td hide-mobile' });
        const statusBadge = createElement('span', {
          class: `admin-badge ${user.is_active ? 'badge-status-on' : 'badge-status-off'}`,
        });
        statusBadge.textContent = user.is_active ? 'Đang hoạt động' : 'Đã khóa';
        tdStatus.appendChild(statusBadge);
        row.appendChild(tdStatus);

        // Last login (hidden on mobile)
        const tdLogin = createElement('td', { class: 'admin-td hide-mobile admin-muted' });
        tdLogin.textContent = user.last_login_at
          ? new Date(user.last_login_at).toLocaleString('vi-VN', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : '—';
        row.appendChild(tdLogin);

        // Actions
        const tdActions = createElement('td', { class: 'admin-td' });
        tdActions.style.textAlign = 'right';

        if (isMainAdmin) {
          const label = createElement('span', { class: 'admin-note' });
          label.textContent = 'Tài khoản hệ thống';
          tdActions.appendChild(label);
        } else if (isCurrentUser) {
          const label = createElement('span', { class: 'admin-you' });
          label.textContent = 'Đang đăng nhập';
          tdActions.appendChild(label);
        } else {
          const deleteBtn = createElement('button', {
            type: 'button',
            class: 'admin-btn-danger',
            'aria-label': `Xóa tài khoản ${user.username}`,
          });
          deleteBtn.textContent = 'Xóa';
          deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Xóa tài khoản "${user.username}"?\nHành động này không thể hoàn tác.`))
              return;
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
              deleteBtn.textContent = 'Xóa';
            }
          });
          tdActions.appendChild(deleteBtn);
        }

        row.appendChild(tdActions);
        tbody.appendChild(row);
      });
    } catch (error) {
      if (error.status === 401) return;
      console.error('[AdminDashboard] loadUsers error:', error);
      tbody.innerHTML = '';
      const tr = createElement('tr', {});
      const td = createElement('td', {});
      td.colSpan = '5';
      td.className = 'admin-empty is-error';
      td.textContent = `Lỗi: ${error.message}`;
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
    const role = roleSelect.value;

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
        onToast?.(`Tạo tài khoản "${username}" thành công!`, 'success', 2500);
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
      createBtn.textContent = 'Tạo';
    }
  });

  // ── Press Enter in form fields to trigger create
  [usernameInput, passwordInput].forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        createBtn.click();
      }
    });
  });

  // ── ESC to close
  const handleEsc = e => {
    if (e.key === 'Escape') {
      cleanup();
      onClose?.();
    }
  };
  document.addEventListener('keydown', handleEsc);

  // ── Click outside modal to close
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      cleanup();
      onClose?.();
    }
  });

  function cleanup() {
    document.removeEventListener('keydown', handleEsc);
  }

  loadUsers();
  requestAnimationFrame(() => usernameInput.focus());

  return overlay;
}
