import { createElement } from '../utils/dom.js';

function shortName(warehouseName) {
  if (warehouseName === 'Kho Gimmersta') return 'SANDBERG - REBEL WALLS';
  if (warehouseName === 'Kho ARTE') return 'ARTE International';
  return warehouseName.replace('/Stock', '');
}

function warehouseIconSvg(warehouseName) {
  if (warehouseName === 'Kho ARTE' || warehouseName === 'Kho Gimmersta') {
    return `<svg class="wh-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.4"/><path d="M2 8h12M8 1.75c1.9 1.7 2.8 3.8 2.8 6.25S9.9 12.55 8 14.25c-1.9-1.7-2.8-3.8-2.8-6.25S6.1 3.45 8 1.75Z" stroke="currentColor" stroke-width="1.3"/></svg>`;
  }
  if (warehouseName === 'Kho Vải') {
    return `<svg class="wh-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 11.5v-7Z" stroke="currentColor" stroke-width="1.4"/><path d="M3 7.5h10M7.5 3v10" stroke="currentColor" stroke-width="1.3"/></svg>`;
  }
  return `<svg class="wh-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.25 6.2 8 2.5l5.75 3.7v6.55a1 1 0 0 1-1 1H3.25a1 1 0 0 1-1-1V6.2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 13.75V9.5h4v4.25" stroke="currentColor" stroke-width="1.3"/></svg>`;
}

export default function Tabs({
  warehouses,
  activeWarehouse,
  warehouseCounts = {},
  onTabChange,
}) {
  const rail = createElement('div', { class: 'warehouse-rail-inner' });

  const groups = Array.isArray(warehouses) ? { all: warehouses } : warehouses;
  const productList = groups.productGroup || [];
  const fabricList = groups.fabricGroup || [];
  const supplierList = groups.otherGroup || [];
  const allList = groups.all || [];
  const hasGroups =
    productList.length > 0 || fabricList.length > 0 || supplierList.length > 0;

  const list = createElement('div', {
    class: 'warehouse-groups',
    role: 'group',
    'aria-label': 'Chọn kho tồn kho',
  });

  function paint(button, active) {
    const warehouseName = button.getAttribute('data-warehouse');
    const isSupplier = warehouseName === 'Kho ARTE' || warehouseName === 'Kho Gimmersta';
    const count = warehouseCounts[warehouseName];

    button.classList.toggle('tab-active', active);
    button.classList.toggle('tab-pill-active', active);
    button.classList.toggle('is-supplier', isSupplier);
    button.setAttribute('aria-pressed', String(active));

    const badgeText = isSupplier
      ? 'TRA CỨU'
      : typeof count === 'number'
        ? String(count)
        : '';

    button.innerHTML = `
      ${warehouseIconSvg(warehouseName)}
      <span class="wh-tab-name">${shortName(warehouseName)}</span>
      ${badgeText ? `<span class="wh-tab-count${isSupplier ? ' is-api' : ''}">${badgeText}</span>` : ''}
    `;
  }

  function createTab(warehouseName) {
    const tab = createElement('button', {
      class: 'wh-tab',
      type: 'button',
      'data-warehouse': warehouseName,
      'aria-label': `Chọn kho ${shortName(warehouseName)}`,
    });
    paint(tab, warehouseName === activeWarehouse);
    tab.addEventListener('click', () => {
      list.querySelectorAll('button[data-warehouse]').forEach(button => paint(button, false));
      paint(tab, true);
      onTabChange(warehouseName);
    });
    return tab;
  }

  function addGroup(groupTitle, names) {
    if (!names.length) return;
    const groupWrap = createElement('div', { class: 'warehouse-group-cluster' });
    if (groupTitle) {
      const groupHeading = createElement('span', { class: 'warehouse-label' });
      groupHeading.textContent = groupTitle;
      groupWrap.appendChild(groupHeading);
    }
    const row = createElement('div', { class: 'warehouse-row' });
    names.forEach(name => row.appendChild(createTab(name)));
    groupWrap.appendChild(row);
    list.appendChild(groupWrap);
  }

  if (hasGroups) {
    addGroup('Kho thành phẩm', productList);
    addGroup('Kho nguyên liệu', fabricList);
    addGroup('Nhà cung cấp quốc tế', supplierList);
  } else {
    addGroup('Danh sách kho', allList);
  }

  rail.appendChild(list);
  return rail;
}
