// ============================================
// DATA STORE - State Coordinator & Real-Time Updates
// ============================================

import { clearCache, clearLoadedWarehouses } from '../services/api.js';
import { loadGroupedStock } from '../data/loadStock.js';
import { initWebSocket } from '../services/websocket.js';
import { sortWarehouses as sortWarehousesFromModule } from './modules/warehouse.js';
import {
  collectStocktakeProducts,
  filterAndSearchData,
  filterGroupedDataByCompany,
} from '../data/stockPipeline.js';
import {
  getSelectedCompanyName,
  readCatalogControls,
  resetCatalogControls,
  syncCatalogQuery,
  syncCategoryFilterOptions,
  syncCompanyFilterOptions,
} from '../app/catalogQuery.js';
import { exportStockExcel, exportStockPDF } from '../app/stockExport.js';
import { getActiveWarehouse } from '../app/screen.js';
import { updateTabs } from '../app/warehouseTabs.js';
import {
  applyLiveStockUpdate,
  renderStockCatalog,
  showStockMessage,
  showStockSkeleton,
} from '../views/stockCatalog.js';
import { showToast } from '../views/toast.js';

export { showToast };

let currentGroupedData = null;
let isLoading = false;
let wsClient = null;

function readActiveWarehouse() {
  return (
    getActiveWarehouse() ||
    (typeof document !== 'undefined'
      ? document.querySelector('.tab-active[data-warehouse]')?.getAttribute('data-warehouse')
      : null) ||
    null
  );
}

function getCompanyScopedGroupedData() {
  return filterGroupedDataByCompany(currentGroupedData, getSelectedCompanyName());
}

export function getCurrentGroupedData() {
  return currentGroupedData;
}

export function getWarehouseNames() {
  const scopedData = getCompanyScopedGroupedData();
  return scopedData ? Object.keys(scopedData) : [];
}

export function getProductsForWarehouse(warehouseName) {
  return collectStocktakeProducts(getCompanyScopedGroupedData(), warehouseName);
}

export function updateFilterOptions(groupedData) {
  if (groupedData === currentGroupedData) {
    syncCompanyFilterOptions();
  }

  const effectiveGroupedData =
    groupedData === currentGroupedData ? getCompanyScopedGroupedData() : groupedData || {};

  if (typeof document !== 'undefined') {
    const warehouses = Object.keys(effectiveGroupedData || {});
    updateTabs(sortWarehousesFromModule(warehouses), effectiveGroupedData);
  }

  syncCategoryFilterOptions(effectiveGroupedData, readActiveWarehouse());
}

export function refreshCategoryFilter() {
  if (!currentGroupedData) return;
  syncCategoryFilterOptions(getCompanyScopedGroupedData(), readActiveWarehouse());
}

export async function loadData(options = {}) {
  const { forceRefresh = false } = options;
  if (isLoading) return;

  isLoading = true;
  const stockDataContainer = document.getElementById('stockData');
  const loadBtn = document.getElementById('loadDataBtn');

  if (loadBtn) {
    loadBtn.disabled = true;
    const span = loadBtn.querySelector('span') || loadBtn;
    span.textContent = 'Đang tải...';
  }

  if (stockDataContainer) {
    stockDataContainer.replaceChildren();
    showStockSkeleton(stockDataContainer, 6);
  }

  try {
    const loaded = await loadGroupedStock({ forceRefresh });

    if (loaded.empty) {
      if (stockDataContainer) {
        stockDataContainer.replaceChildren();
        showStockMessage(stockDataContainer, 'empty', 'Không tìm thấy bản ghi tồn kho phù hợp');
      }
      showToast('Không tìm thấy dữ liệu', 'warning');
      return;
    }

    currentGroupedData = loaded.groupedData;

    syncCompanyFilterOptions();
    updateFilterOptions(getCompanyScopedGroupedData());
    applyFilters();

    const cacheIndicator = loaded.fromCache ? ' (từ cache)' : '';
    showToast(
      `Đã tải ${loaded.totalProducts.toLocaleString()} sản phẩm${cacheIndicator}`,
      'success'
    );
  } catch (error) {
    if (stockDataContainer) {
      stockDataContainer.replaceChildren();
      showStockMessage(stockDataContainer, 'error', error.message);
    }
    showToast('Lỗi khi tải dữ liệu: ' + error.message, 'error');
  } finally {
    isLoading = false;

    const resetBtn = document.getElementById('loadDataBtn');
    if (resetBtn) {
      resetBtn.disabled = false;
      const span = resetBtn.querySelector('span') || resetBtn;
      span.textContent = 'Tải lại';
    }
  }
}

export async function forceRefreshData() {
  clearCache();
  clearLoadedWarehouses();
  await loadData({ forceRefresh: true });
}

function renderStockData(groupedData, companyScopedData) {
  renderStockCatalog(document.getElementById('stockData'), {
    groupedData,
    unfilteredGroupedData: companyScopedData || getCompanyScopedGroupedData(),
    activeWarehouse: readActiveWarehouse(),
    sortKey: readCatalogControls().sortKey,
    onShowAll: () => renderStockData(groupedData, companyScopedData),
  });
}

export function applyFilters() {
  if (!currentGroupedData) return;

  const controls = readCatalogControls();
  const activeWarehouse = readActiveWarehouse();
  const companyScopedData = getCompanyScopedGroupedData();
  document.getElementById('stockData')?.setAttribute('data-show-all-cards', 'false');

  const filteredData = filterAndSearchData(
    companyScopedData,
    controls.searchTerm,
    controls.warehouseValue,
    controls.categoryValue,
    {
      discontinuedOnly: controls.discontinuedOnly,
      activeWarehouse,
    }
  );

  renderStockData(filteredData, companyScopedData);
  syncCatalogQuery(activeWarehouse || '');
}

export function clearFilters() {
  resetCatalogControls();
  applyFilters();
}

export function exportData() {
  if (!currentGroupedData) {
    showToast('Vui lòng tải dữ liệu trước', 'warning');
    return;
  }
  exportStockExcel(getCompanyScopedGroupedData());
}

export function exportDataPDF() {
  if (!currentGroupedData) {
    showToast('Vui lòng tải dữ liệu trước', 'warning');
    return;
  }
  exportStockPDF(getCompanyScopedGroupedData());
}

if (typeof document !== 'undefined') {
  document.addEventListener('filterChange', applyFilters);
  document.addEventListener('companyContextChange', () => {
    if (!currentGroupedData) return;
    updateFilterOptions(getCompanyScopedGroupedData());
    applyFilters();
  });
}

export function initializeWebSocket() {
  try {
    wsClient = initWebSocket();

    wsClient.on('open', () => {
      showToast('Kết nối real-time thành công', 'success', 2000);
    });

    wsClient.on('reconnect', () => {
      showToast('Đang kết nối lại...', 'info', 2000);
    });

    wsClient.on('stock_update', message => {
      handleStockUpdate(message.data);
    });

    wsClient.on('stock_updates', message => {
      handleBatchStockUpdates(message.data);
    });
  } catch (error) {
    console.error('[Store] Failed to initialize WebSocket:', error);
  }
}

function handleStockUpdate(update) {
  if (!update?.product_id && !update?.productId) return;
  applyLiveStockUpdate(update);

  if (update.product_name) {
    showToast(`${update.product_name}: ${update.quantity} cập nhật`, 'info', 3000);
  }
}

function handleBatchStockUpdates(updates) {
  updates.forEach(update => {
    handleStockUpdate(update);
  });

  showToast(`Đã cập nhật ${updates.length} sản phẩm`, 'success', 3000);
}

export function subscribeToWarehouse(warehouseName) {
  if (wsClient && wsClient.isConnected()) {
    wsClient.subscribe([warehouseName]);
  }
}

export { clearCache, getCacheStats } from '../services/api.js';
