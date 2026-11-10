import { createElement } from '../utils/dom.js';

const ICONS = {
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7.2" cy="7.2" r="5" stroke="currentColor" stroke-width="1.5"/><path d="m11 11 3.2 3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  refresh: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.66M13.5 2.5v2.6h-2.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  stocktake: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="2.5" width="10" height="11.5" rx="1.8" stroke="currentColor" stroke-width="1.4"/><path d="M6 2.5h4M5.6 8.3l1.7 1.7 3.2-3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  excel: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2.8A1.3 1.3 0 0 1 4.3 1.5h5.4L13 4.8v8.4a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 13.2V2.8Z" stroke="currentColor" stroke-width="1.4"/><path d="m6.2 6.8 3.6 4.4m0-4.4-3.6 4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  pdf: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 2.8A1.3 1.3 0 0 1 4.3 1.5h5.4L13 4.8v8.4a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 13.2V2.8Z" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 8.5h5M5.5 11h3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  admin: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2 3 4.2v3.6c0 3.2 2.1 5.6 5 6.4 2.9-.8 5-3.2 5-6.4V4.2L8 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  logout: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.5 2.5H4A1.5 1.5 0 0 0 2.5 4v8A1.5 1.5 0 0 0 4 13.5h2.5M10.5 11l3-3-3-3M6.5 8h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  menu: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
};

export default function Header({
  onLoad,
  onExport,
  onExportPDF,
  onToggleStocktake,
  currentUser,
  onLogout,
  onOpenAdmin,
}) {
  const header = createElement('header', { class: 'app-header' });

  // ── 1. TOPBAR
  const topBar = createElement('div', { class: 'app-bar' });

  const brand = createElement('div', { class: 'brand' });
  const mark = createElement('div', { class: 'brand-mark', 'aria-hidden': 'true' });
  mark.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 6.2 10 2.5l6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M3.8 6.4 10 10l6.2-3.6M10 10v7.2" stroke="currentColor" stroke-width="1.5"/></svg>`;

  const titleWrap = createElement('div', { class: 'brand-copy' });
  titleWrap.innerHTML = `
    <div class="brand-title-line">
      <span class="brand-name">Bonario Stock</span>
    </div>
    <div class="brand-sub">Quản lý tồn kho & kiểm kê</div>
  `;
  brand.appendChild(mark);
  brand.appendChild(titleWrap);

  if (currentUser) {
    const chip = createElement('div', {
      class: `user-chip${currentUser.role === 'admin' ? ' user-chip-admin' : ''}`,
    });
    const displayName =
      currentUser.username.length > 14
        ? `${currentUser.username.slice(0, 14)}…`
        : currentUser.username;
    chip.textContent = currentUser.role === 'admin' ? `Admin · ${displayName}` : displayName;
    brand.appendChild(chip);
  }

  // Center: Clean Search Field (no Ctrl+K badge)
  const searchSection = createElement('div', {
    id: 'headerSearchSection',
    class: 'search-row',
  });
  const searchWrap = createElement('div', { class: 'search-field' });
  const searchIcon = createElement('span', { class: 'search-icon', 'aria-hidden': 'true' });
  searchIcon.innerHTML = ICONS.search;

  const searchInput = createElement('input', {
    id: 'searchInput',
    type: 'text',
    'aria-label': 'Tìm kiếm sản phẩm',
    autocomplete: 'off',
    placeholder: 'Tìm mã SKU, tên sản phẩm, số lô...',
  });

  const searchClearBtn = createElement('button', {
    type: 'button',
    class: 'search-clear-btn hidden',
    'aria-label': 'Xóa từ khóa tìm kiếm',
    title: 'Xóa tìm kiếm',
  });
  searchClearBtn.textContent = '×';

  searchWrap.append(searchIcon, searchInput, searchClearBtn);
  searchSection.appendChild(searchWrap);

  // Right: Action Toolbar
  const actions = createElement('div', { class: 'app-actions' });
  const desktop = createElement('div', { class: 'desktop-header-btns app-actions' });

  function makeBtn(label, iconSvg, className, onClick, id) {
    const btn = createElement('button', {
      class: className,
      type: 'button',
      id,
      'aria-label': label,
    });
    btn.innerHTML = `${iconSvg || ''}<span>${label}</span>`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  if (currentUser?.role === 'admin') {
    desktop.appendChild(makeBtn('Admin', ICONS.admin, 'action-btn', () => onOpenAdmin?.()));
  }
  desktop.appendChild(
    makeBtn('Kiểm kho', ICONS.stocktake, 'action-btn', () => onToggleStocktake?.())
  );
  desktop.appendChild(
    makeBtn(
      'Tải lại',
      ICONS.refresh,
      'action-btn action-btn-primary',
      () => onLoad?.(),
      'loadDataBtn'
    )
  );
  desktop.appendChild(makeBtn('Excel', ICONS.excel, 'action-btn', () => onExport?.()));
  desktop.appendChild(
    makeBtn('PDF', ICONS.pdf, 'action-btn action-btn-quiet', () => onExportPDF?.())
  );
  if (currentUser) {
    desktop.appendChild(
      makeBtn('Đăng xuất', ICONS.logout, 'action-btn action-btn-quiet', () => onLogout?.())
    );
  }

  // Mobile Menu Dropdown
  const mobileWrap = createElement('div', { class: 'mobile-menu-btn' });
  const mobileMenuBtn = createElement('button', {
    class: 'menu-btn',
    type: 'button',
    'aria-label': 'Mở menu thao tác',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
  });
  mobileMenuBtn.innerHTML = `${ICONS.menu}<span>Menu</span>`;

  const dropdownPortal = createElement('div', {
    class: 'hdr-dropdown-portal',
    role: 'menu',
    'aria-label': 'Menu thao tác',
  });
  let dropdownOpen = false;
  let backdropEl = null;

  function positionPortal() {
    const rect = mobileMenuBtn.getBoundingClientRect();
    const panelWidth = 248;
    let left = rect.right - panelWidth;
    if (left < 8) left = 8;
    dropdownPortal.style.top = `${rect.bottom + 8}px`;
    dropdownPortal.style.left = `${left}px`;
  }

  function closeDropdown() {
    if (!dropdownOpen) return;
    dropdownOpen = false;
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    mobileMenuBtn.innerHTML = `${ICONS.menu}<span>Menu</span>`;
    dropdownPortal.classList.remove('open');
    backdropEl?.remove();
    backdropEl = null;
    setTimeout(() => {
      if (!dropdownOpen && dropdownPortal.parentNode === document.body) dropdownPortal.remove();
    }, 180);
  }

  function openDropdown() {
    if (dropdownOpen) {
      closeDropdown();
      return;
    }
    dropdownOpen = true;
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    mobileMenuBtn.innerHTML = `<span>Đóng</span>`;
    document.body.appendChild(dropdownPortal);
    positionPortal();
    backdropEl = createElement('div', { class: 'hdr-dropdown-backdrop', 'aria-hidden': 'true' });
    backdropEl.addEventListener('click', closeDropdown);
    document.body.appendChild(backdropEl);
    requestAnimationFrame(() => dropdownPortal.classList.add('open'));
  }

  mobileMenuBtn.addEventListener('click', event => {
    event.stopPropagation();
    openDropdown();
  });
  window.addEventListener('resize', () => {
    if (dropdownOpen) positionPortal();
  });

  function dropdownItem(label, sub, onClick, danger = false) {
    const btn = createElement('button', {
      class: `hdr-dropdown-item${danger ? ' is-danger' : ''}`,
      type: 'button',
      role: 'menuitem',
    });
    btn.innerHTML = `
      <span>
        <div class="hdr-dropdown-item-label"></div>
        <div class="hdr-dropdown-item-sub"></div>
      </span>
    `;
    btn.querySelector('.hdr-dropdown-item-label').textContent = label;
    btn.querySelector('.hdr-dropdown-item-sub').textContent = sub;
    btn.addEventListener('click', event => {
      event.stopPropagation();
      closeDropdown();
      setTimeout(onClick, 80);
    });
    return btn;
  }

  function dropdownDivider() {
    return createElement('div', { class: 'hdr-dropdown-divider' });
  }

  if (currentUser?.role === 'admin') {
    dropdownPortal.appendChild(dropdownItem('Admin', 'Quản lý tài khoản', () => onOpenAdmin?.()));
    dropdownPortal.appendChild(dropdownDivider());
  }
  dropdownPortal.appendChild(
    dropdownItem('Kiểm kho', 'Kiểm kê theo tháng và kho', () => onToggleStocktake?.())
  );
  dropdownPortal.appendChild(dropdownItem('Tải lại', 'Lấy tồn kho mới nhất', () => onLoad?.()));
  dropdownPortal.appendChild(dropdownDivider());
  dropdownPortal.appendChild(dropdownItem('Xuất Excel', 'Tải file .xlsx', () => onExport?.()));
  dropdownPortal.appendChild(dropdownItem('Xuất PDF', 'Tải file .pdf', () => onExportPDF?.()));
  if (currentUser) {
    dropdownPortal.appendChild(dropdownDivider());
    dropdownPortal.appendChild(
      dropdownItem('Đăng xuất', currentUser.username, () => onLogout?.(), true)
    );
  }

  mobileWrap.appendChild(mobileMenuBtn);
  actions.appendChild(desktop);
  actions.appendChild(mobileWrap);
  topBar.append(brand, searchSection, actions);

  // ── 2. WAREHOUSE NAVIGATION RAIL
  const warehouseTabsSection = createElement('div', {
    id: 'warehouseTabsPlaceholder',
    class: 'warehouse-rail',
  });

  // ── 3. FILTER & COMPANY SWITCHER BAR
  const filtersSection = createElement('div', {
    id: 'headerFiltersSection',
    class: 'filters-bar-wrap',
  });
  const filtersContent = createElement('div', { class: 'filter-row' });

  const companySegmented = createElement('div', {
    class: 'company-segmented',
    role: 'group',
    'aria-label': 'Chuyển đổi công ty',
  });

  const companyFilter = createElement('select', {
    id: 'companyFilter',
    class: 'control control-company sr-only',
    title: 'Công ty',
    'aria-label': 'Lọc theo công ty',
  });

  const companySegButtons = new Map();
  [
    ['Bonario', 'Bonario'],
    ['Ordinaire', 'Ordinaire'],
  ].forEach(([value, label]) => {
    const option = createElement('option', { value });
    option.textContent = label;
    companyFilter.appendChild(option);

    const segBtn = createElement('button', {
      type: 'button',
      class: 'company-seg-btn',
      'data-company-seg': value,
    });
    segBtn.innerHTML = `<span class="company-seg-dot" aria-hidden="true"></span><span>${label}</span>`;
    segBtn.addEventListener('click', () => {
      if (companyFilter.value === value) return;
      companyFilter.value = value;
      syncSegmentedActiveState(value);
      localStorage.setItem('selectedCompany', value);
      document.dispatchEvent(new CustomEvent('companyContextChange'));
    });
    companySegButtons.set(value, segBtn);
    companySegmented.appendChild(segBtn);
  });

  function syncSegmentedActiveState(activeVal) {
    const current =
      activeVal || companyFilter.value || localStorage.getItem('selectedCompany') || 'Bonario';
    companySegButtons.forEach((btn, key) => {
      const isActive = key === current;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  const categoryFilter = createElement('select', {
    id: 'categoryFilter',
    class: 'control control-grow',
    'aria-label': 'Lọc theo nhóm sản phẩm',
  });
  const defaultOpt = createElement('option', { value: '' });
  defaultOpt.textContent = 'Tất cả nhóm sản phẩm';
  categoryFilter.appendChild(defaultOpt);

  const sortFilter = createElement('select', {
    id: 'sortFilter',
    class: 'control',
    'aria-label': 'Sắp xếp sản phẩm',
  });
  [
    ['quantity_desc', 'Sắp xếp: Tồn nhiều → ít'],
    ['quantity_asc', 'Sắp xếp: Tồn ít → nhiều'],
    ['available_asc', 'Sắp xếp: Khả dụng thấp'],
    ['incoming_desc', 'Sắp xếp: Đang về nhiều'],
    ['name_asc', 'Sắp xếp: Tên A → Z'],
  ].forEach(([value, label]) => {
    const option = createElement('option', { value });
    option.textContent = label;
    sortFilter.appendChild(option);
  });

  const discontinuedToggle = createElement('label', { class: 'discontinued-filter-toggle' });
  discontinuedToggle.title = 'Chỉ hiển thị các mã sản phẩm đã ngưng sản xuất';
  const discontinuedCheckbox = createElement('input', {
    id: 'discontinuedFilter',
    type: 'checkbox',
    'aria-label': 'Chỉ hiển thị sản phẩm ngưng sản xuất',
  });
  const discontinuedLabel = createElement('span', {});
  discontinuedLabel.textContent = 'Ngưng sản xuất';
  discontinuedToggle.appendChild(discontinuedCheckbox);
  discontinuedToggle.appendChild(discontinuedLabel);

  const clearBtn = createElement('button', {
    id: 'clearFiltersBtn',
    class: 'text-btn',
    type: 'button',
    'aria-label': 'Xóa bộ lọc',
  });
  clearBtn.textContent = 'Đặt lại bộ lọc';

  filtersContent.append(
    companySegmented,
    companyFilter,
    categoryFilter,
    sortFilter,
    discontinuedToggle,
    clearBtn
  );
  filtersSection.appendChild(filtersContent);

  header.append(topBar, warehouseTabsSection, filtersSection);

  let searchTimeout = null;
  function triggerFilterChange() {
    document.dispatchEvent(new CustomEvent('filterChange'));
  }
  function updateDiscontinuedToggleState() {
    discontinuedToggle.classList.toggle('is-on', discontinuedCheckbox.checked);
  }
  function updateSearchClearVisibility() {
    searchClearBtn.classList.toggle('hidden', !searchInput.value);
  }

  function hydrateInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    const searchValue = params.get('q');
    const companyValue = params.get('company');
    const categoryValue = params.get('category');
    const sortValue = params.get('sort');

    if (searchValue !== null) {
      searchInput.value = searchValue;
      updateSearchClearVisibility();
    }
    if (
      companyValue &&
      Array.from(companyFilter.options).some(option => option.value === companyValue)
    ) {
      companyFilter.value = companyValue;
      localStorage.setItem('selectedCompany', companyValue);
    } else {
      const savedCompany = localStorage.getItem('selectedCompany');
      if (savedCompany) companyFilter.value = savedCompany;
    }
    syncSegmentedActiveState(companyFilter.value);

    if (categoryValue !== null) categoryFilter.setAttribute('data-pending-category', categoryValue);
    if (sortValue && Array.from(sortFilter.options).some(option => option.value === sortValue)) {
      sortFilter.value = sortValue;
    }
    if (params.get('discontinued') === '1') {
      discontinuedCheckbox.checked = true;
      updateDiscontinuedToggleState();
    }
  }

  hydrateInitialFilters();

  searchInput.addEventListener('input', () => {
    updateSearchClearVisibility();
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(triggerFilterChange, 220);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    updateSearchClearVisibility();
    searchInput.focus();
    triggerFilterChange();
  });

  companyFilter.addEventListener('change', () => {
    const val = companyFilter.value || 'Bonario';
    localStorage.setItem('selectedCompany', val);
    syncSegmentedActiveState(val);
    document.dispatchEvent(new CustomEvent('companyContextChange'));
  });

  document.addEventListener('companyContextChange', () => {
    syncSegmentedActiveState(localStorage.getItem('selectedCompany') || companyFilter.value);
  });

  categoryFilter.addEventListener('change', triggerFilterChange);
  sortFilter.addEventListener('change', triggerFilterChange);
  discontinuedCheckbox.addEventListener('change', () => {
    updateDiscontinuedToggleState();
    triggerFilterChange();
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    updateSearchClearVisibility();
    categoryFilter.value = '';
    sortFilter.value = 'quantity_desc';
    discontinuedCheckbox.checked = false;
    updateDiscontinuedToggleState();
    triggerFilterChange();
  });

  return header;
}
