import Tabs from '../components/Tabs.js';
import { syncArteWarehouse } from '../store/modules/warehouse.js';
import { applyFilters, refreshCategoryFilter } from '../store/dataStore.js';
import { getActiveWarehouse, getScreen, showWarehouse } from './screen.js';

const COMPANY_FILTER_STORAGE_KEY = 'selectedCompany';

function syncWarehouseUrl(warehouseName) {
  const url = new URL(window.location.href);
  url.searchParams.set('warehouse', warehouseName);
  window.history.replaceState(window.history.state, '', url);
}

function updateActiveWarehouseBreadcrumb(warehouseName) {
  if (typeof document === 'undefined') return;
  const badge = document.getElementById('activeWarehouseTitle');
  if (!badge) return;
  if (!warehouseName) {
    badge.textContent = 'Tất cả kho';
    return;
  }
  badge.textContent =
    warehouseName === 'Kho Gimmersta'
      ? 'SANDBERG - REBEL WALLS'
      : warehouseName.replace('/Stock', '');
}

export function handleTabChange(warehouseName) {
  localStorage.setItem('lastActiveWarehouse', warehouseName);
  syncWarehouseUrl(warehouseName);
  showWarehouse(warehouseName);
  updateActiveWarehouseBreadcrumb(warehouseName);

  if (getScreen() === 'stock') {
    refreshCategoryFilter();
    applyFilters();
  }
}

export function switchToWarehouse(warehouseName) {
  const tabButton = document.querySelector(`[data-warehouse="${warehouseName}"]`);
  tabButton?.click();
}

function listedWarehouses(warehouseList) {
  if (Array.isArray(warehouseList)) return warehouseList;
  if (warehouseList?.all) return warehouseList.all;
  return [
    ...(warehouseList?.productGroup || []),
    ...(warehouseList?.fabricGroup || []),
    ...(warehouseList?.otherGroup || []),
  ];
}

function firstWarehouseOf(warehouseList) {
  if (Array.isArray(warehouseList)) return warehouseList[0] || null;
  return (
    warehouseList?.productGroup?.[0] ||
    warehouseList?.fabricGroup?.[0] ||
    warehouseList?.otherGroup?.[0] ||
    warehouseList?.all?.[0] ||
    null
  );
}

function computeWarehouseCounts(groupedData) {
  const counts = {};
  Object.entries(groupedData || {}).forEach(([warehouseName, warehouse]) => {
    let total = 0;
    Object.values(warehouse.categories || {}).forEach(category => {
      total += Object.keys(category.products || {}).length;
    });
    counts[warehouseName] = total;
  });
  return counts;
}

export function updateTabs(warehouses, groupedData = null) {
  const container = document.getElementById('warehouseTabsPlaceholder');
  const selectedCompany = localStorage.getItem(COMPANY_FILTER_STORAGE_KEY) || 'Bonario';
  const warehouseList = syncArteWarehouse(warehouses, selectedCompany);
  const firstWarehouse = firstWarehouseOf(warehouseList);

  if (!container || !firstWarehouse) {
    if (container) container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  const availableWarehouses = listedWarehouses(warehouseList);
  let activeWarehouse = getActiveWarehouse();

  if (
    selectedCompany !== 'Bonario' &&
    ['Kho ARTE', 'Kho Gimmersta'].includes(activeWarehouse)
  ) {
    activeWarehouse = firstWarehouse;
    localStorage.setItem('lastActiveWarehouse', firstWarehouse);
  }

  const urlWarehouse = new URLSearchParams(window.location.search).get('warehouse');
  const savedWarehouse = localStorage.getItem('lastActiveWarehouse');
  const preferredWarehouse = urlWarehouse || savedWarehouse;
  const nextWarehouse =
    preferredWarehouse && availableWarehouses.includes(preferredWarehouse)
      ? preferredWarehouse
      : activeWarehouse && availableWarehouses.includes(activeWarehouse)
        ? activeWarehouse
        : firstWarehouse;

  const warehouseCounts = computeWarehouseCounts(groupedData);

  container.appendChild(
    Tabs({
      warehouses: warehouseList,
      activeWarehouse: nextWarehouse,
      warehouseCounts,
      onTabChange: handleTabChange,
    })
  );

  localStorage.setItem('lastActiveWarehouse', nextWarehouse);
  if (urlWarehouse && urlWarehouse !== nextWarehouse) syncWarehouseUrl(nextWarehouse);
  showWarehouse(nextWarehouse);
  updateActiveWarehouseBreadcrumb(nextWarehouse);
}
