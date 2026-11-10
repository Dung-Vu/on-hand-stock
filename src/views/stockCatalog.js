import { createElement } from '../utils/dom.js';
import {
  getSortLabel,
  getVisibleWarehouseCount,
  sortProducts,
} from '../store/modules/stockView.js';

const CARD_RENDER_LIMIT = 80;
const HIDE_INCOMING = new Set(['Kho Vải']);
const VIEW_MODE_STORAGE_KEY = 'bonario_catalog_view_mode';

let activeStatusFilter = 'all'; // 'all' | 'in' | 'low' | 'incoming' | 'discontinued'
let lastActiveWarehouseForStatus = null;

function getViewMode() {
  if (typeof localStorage === 'undefined') return 'grid';
  const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return saved === 'table' ? 'table' : 'grid';
}

function setViewMode(mode) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function stockStatus(quantity, availableQuantity) {
  if (quantity === 0 || availableQuantity === 0) return 'out';
  if (quantity <= 10 || availableQuantity < quantity * 0.3) return 'low';
  return 'in';
}

export function collectWarehouseProducts(groupedData, activeWarehouse) {
  const warehouse = activeWarehouse ? groupedData?.[activeWarehouse] : null;
  if (!warehouse) return [];

  const products = [];
  Object.entries(warehouse.categories || {}).forEach(([categoryName, category]) => {
    Object.values(category.products || {}).forEach(product => {
      products.push({
        ...product,
        warehouseName: activeWarehouse,
        categoryName,
      });
    });
  });

  return products;
}

function extractLotNames(lotIds) {
  if (!lotIds?.length) return [];
  return lotIds
    .map(lot => (typeof lot === 'object' ? lot.name : lot))
    .filter(Boolean);
}

function lotLabel(lotIds) {
  const names = extractLotNames(lotIds);
  return names.length ? names.join(', ') : '';
}

function formatCategoryTitle(categoryName = '') {
  const cleaned = String(categoryName || '')
    .replace(/^BON\s*\/\s*/i, '')
    .replace(/^ORD\s*\/\s*/i, '')
    .replace(/\s*\/\s*/g, ' › ')
    .trim();
  return cleaned || categoryName || 'Khác';
}

function shortCategoryLeaf(categoryName = '') {
  const parts = String(categoryName || '')
    .replace(/^BON\s*\/\s*/i, '')
    .replace(/^ORD\s*\/\s*/i, '')
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(' › ') || categoryName;
  return `${parts[0]} › ${parts[parts.length - 1]}`;
}

function statusBadge(status) {
  const text = {
    in: 'Còn hàng',
    low: 'Tồn thấp',
    out: 'Hết hàng',
  }[status];

  return `<span class="stock-status status-${status}">${text}</span>`;
}

function messageState(className, title, message, canRetry = false) {
  const root = createElement('div', { class: `${className} panel` });
  const heading = createElement('h2', {});
  heading.textContent = title;
  const copy = createElement('p', {});
  copy.textContent = message;
  root.append(heading, copy);

  if (canRetry) {
    const retry = createElement(
      'button',
      {
        class: 'action-btn action-btn-primary',
        type: 'button',
      },
      'Thử lại'
    );
    retry.addEventListener('click', () => document.getElementById('loadDataBtn')?.click());
    root.appendChild(retry);
  }

  return root;
}

export function showStockSkeleton(container, count = 6) {
  const wrap = createElement('div', { class: 'catalog' });
  const grid = createElement('div', { class: 'catalog-grid' });
  for (let i = 0; i < count; i++) {
    const card = createElement('div', { class: 'skeleton-card' });
    card.innerHTML = `
      <div class="skeleton-line short"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-metrics">
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
        <div class="skeleton-box"></div>
      </div>
    `;
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  container.appendChild(wrap);
}

export function showStockMessage(container, kind, message) {
  container.replaceChildren();
  container.appendChild(
    messageState(
      kind === 'error' ? 'error-state catalog' : 'empty-state catalog',
      kind === 'error' ? 'Tải dữ liệu thất bại' : 'Không tìm thấy sản phẩm phù hợp',
      message,
      kind === 'error'
    )
  );
}

function formatStockSummaryText(product) {
  const name = product.product_name || `ID ${product.product_id?.[0] ?? ''}`;
  const wh = (product.warehouseName || '').replace('/Stock', '');
  const unit = product.uom_id?.[1] ? ` ${product.uom_id[1]}` : '';
  const lots = lotLabel(product.lot_ids);
  const parts = [
    `[${wh}] ${name}`,
    `Tồn kho: ${(product.quantity || 0).toLocaleString('vi-VN')}${unit}`,
    `Khả dụng: ${(product.available_quantity || 0).toLocaleString('vi-VN')}${unit}`,
  ];
  if (!HIDE_INCOMING.has(product.warehouseName) && Number(product.incoming_qty) > 0) {
    const eta = product.incoming_date
      ? ` (ETA ${new Date(product.incoming_date).toLocaleDateString('vi-VN')})`
      : '';
    parts.push(`Đang về: ${Number(product.incoming_qty).toLocaleString('vi-VN')}${unit}${eta}`);
  }
  if (lots) {
    parts.push(`Số lô: ${lots}`);
  }
  return parts.join(' | ');
}

function openProductInspector(product) {
  if (typeof document === 'undefined') return;
  document.getElementById('productInspectorOverlay')?.remove();

  const productName = product.product_name || `Sản phẩm ID: ${product.product_id?.[0]}`;
  const productId = product.product_id?.[0] ?? '—';
  const status = stockStatus(product.quantity, product.available_quantity);
  const unit = product.uom_id?.[1] || 'Đơn vị';
  const qty = Number(product.quantity) || 0;
  const avail = Number(product.available_quantity) || 0;
  const reserved = Math.max(0, Number((qty - avail).toFixed(2)));
  const incomingQty = Number(product.incoming_qty) || 0;
  const lotNames = extractLotNames(product.lot_ids);
  const hideIncoming = HIDE_INCOMING.has(product.warehouseName);

  const overlay = document.createElement('div');
  overlay.id = 'productInspectorOverlay';
  overlay.className = 'inspector-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Chi tiết sản phẩm ${productName}`);

  overlay.innerHTML = `
    <div class="inspector-drawer">
      <div class="inspector-head">
        <div>
          <div class="inspector-badges">
            <span class="category-badge">${escapeHtml(product.warehouseName?.replace('/Stock', '') || '')}</span>
            <span class="category-badge">${escapeHtml(formatCategoryTitle(product.categoryName))}</span>
            ${statusBadge(status)}
            ${product.isDiscontinued ? '<span class="discontinued-badge">Ngưng sản xuất</span>' : ''}
          </div>
          <h2 class="inspector-title">${escapeHtml(productName)}</h2>
          <p class="inspector-sub">Mã Odoo: <strong>#${escapeHtml(productId)}</strong> · Đơn vị tính: <strong>${escapeHtml(unit)}</strong></p>
        </div>
        <button type="button" class="admin-close-btn" id="closeInspectorBtn" aria-label="Đóng chi tiết">×</button>
      </div>

      <div class="inspector-body">
        <div class="inspector-metrics-grid">
          <div class="inspector-metric-box">
            <span class="quantity-label">Tồn kho thực tế</span>
            <strong class="inspector-metric-val">${qty.toLocaleString('vi-VN')}</strong>
            <span class="metric-unit">${escapeHtml(unit)}</span>
          </div>
          <div class="inspector-metric-box is-avail">
            <span class="quantity-label">Khả dụng giao ngay</span>
            <strong class="inspector-metric-val">${avail.toLocaleString('vi-VN')}</strong>
            <span class="metric-unit">${escapeHtml(unit)}</span>
          </div>
          <div class="inspector-metric-box">
            <span class="quantity-label">Đang giữ đơn</span>
            <strong class="inspector-metric-val">${reserved.toLocaleString('vi-VN')}</strong>
            <span class="metric-unit">${escapeHtml(unit)}</span>
          </div>
          ${
            hideIncoming
              ? ''
              : `<div class="inspector-metric-box is-incoming">
                  <span class="quantity-label">Hàng đang về</span>
                  <strong class="inspector-metric-val">${incomingQty.toLocaleString('vi-VN')}</strong>
                  <span class="metric-unit">${
                    product.incoming_date
                      ? `ETA ${new Date(product.incoming_date).toLocaleDateString('vi-VN')}`
                      : escapeHtml(unit)
                  }</span>
                </div>`
          }
        </div>

        <div class="inspector-section">
          <h3 class="inspector-section-title">Danh sách số lô (Lot / Batch) · ${lotNames.length} lô</h3>
          ${
            lotNames.length > 0
              ? `<div class="lot-chips-wrap">
                  ${lotNames.map(lot => `<span class="lot-chip">${escapeHtml(lot)}</span>`).join('')}
                </div>`
              : `<p class="panel-copy">Sản phẩm này hiện không chia theo số lô.</p>`
          }
        </div>
      </div>

      <div class="inspector-foot">
        <button type="button" class="action-btn action-btn-primary" id="inspectorCopyBtn">
          <span>Sao chép thông tin tồn kho</span>
        </button>
        <button type="button" class="action-btn" id="inspectorDoneBtn">Đóng</button>
      </div>
    </div>
  `;

  function close() {
    overlay.remove();
  }

  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('#closeInspectorBtn')?.addEventListener('click', close);
  overlay.querySelector('#inspectorDoneBtn')?.addEventListener('click', close);
  overlay.querySelector('#inspectorCopyBtn')?.addEventListener('click', () => {
    const text = formatStockSummaryText(product);
    navigator.clipboard?.writeText(text);
    const btn = overlay.querySelector('#inspectorCopyBtn span');
    if (btn) btn.textContent = 'Đã sao chép!';
  });

  document.body.appendChild(overlay);
}

function productCard(product, index) {
  const productName = product.product_name || `Sản phẩm ID: ${product.product_id?.[0]}`;
  const productId = product.product_id?.[0] ?? '';
  const status = stockStatus(product.quantity, product.available_quantity);
  const unit = product.uom_id?.[1] || '';
  const lotNames = extractLotNames(product.lot_ids);
  const hideIncoming = HIDE_INCOMING.has(product.warehouseName);
  const incomingQty = Number(product.incoming_qty) || 0;
  const formattedDate = product.incoming_date
    ? new Date(product.incoming_date).toLocaleDateString('vi-VN')
    : '';

  const visibleLots = lotNames.slice(0, 3);
  const extraLotsCount = Math.max(0, lotNames.length - visibleLots.length);
  const hasFooter = (!hideIncoming && incomingQty > 0 && formattedDate) || visibleLots.length > 0;

  return `
    <article
      class="stock-card status-border-${status}${product.isDiscontinued ? ' is-discontinued' : ''}"
      data-product-id="${escapeHtml(productId)}"
      data-card-index="${index}"
    >
      <div class="stock-card-top">
        <h4 class="product-name">${escapeHtml(productName)}</h4>
        <div class="stock-card-badges">
          ${product.isDiscontinued ? '<span class="discontinued-badge">Ngưng SX</span>' : ''}
          ${statusBadge(status)}
        </div>
      </div>

      <div class="quantity-display${hideIncoming ? ' quantity-display-two' : ''}">
        <div class="quantity-item">
          <div class="quantity-label">Tồn thực tế</div>
          <div class="quantity-value total-quantity">${(product.quantity || 0).toLocaleString('vi-VN')}</div>
          ${unit ? `<div class="metric-unit">${escapeHtml(unit)}</div>` : ''}
        </div>
        <div class="quantity-item is-avail-box">
          <div class="quantity-label">Khả dụng</div>
          <div class="quantity-value available-quantity">${(product.available_quantity || 0).toLocaleString('vi-VN')}</div>
          ${unit ? `<div class="metric-unit">${escapeHtml(unit)}</div>` : ''}
        </div>
        ${
          hideIncoming
            ? ''
            : `<div class="quantity-item ${incomingQty > 0 ? 'is-incoming-box' : ''}">
                <div class="quantity-label">Đang về</div>
                <div class="quantity-value incoming-quantity">${incomingQty.toLocaleString('vi-VN')}</div>
                ${unit ? `<div class="metric-unit">${escapeHtml(unit)}</div>` : ''}
              </div>`
        }
      </div>

      ${
        hasFooter
          ? `<div class="stock-card-meta">
              ${
                !hideIncoming && incomingQty > 0 && formattedDate
                  ? `<div class="eta-badge">Dự kiến về: <strong>${escapeHtml(formattedDate)}</strong></div>`
                  : ''
              }
              ${
                visibleLots.length > 0
                  ? `<div class="lot-chips-row">
                      <span class="lot-row-label">Lô:</span>
                      ${visibleLots.map(lot => `<span class="lot-chip">${escapeHtml(lot)}</span>`).join('')}
                      ${extraLotsCount > 0 ? `<span class="lot-chip lot-chip-more">+${extraLotsCount}</span>` : ''}
                    </div>`
                  : ''
              }
            </div>`
          : ''
      }
    </article>
  `;
}

function renderGroupedCards(visibleProducts) {
  const groups = new Map();
  visibleProducts.forEach((product, idx) => {
    const cat = product.categoryName || 'Khác';
    if (!groups.has(cat)) {
      groups.set(cat, []);
    }
    groups.get(cat).push({ product, idx });
  });

  return Array.from(groups.entries())
    .map(
      ([categoryName, items]) => `
      <section class="category-section">
        <header class="category-section-head">
          <h3 class="category-section-title">${escapeHtml(formatCategoryTitle(categoryName))}</h3>
          <span class="category-section-count">${items.length} sản phẩm</span>
        </header>
        <div class="catalog-grid">
          ${items.map(({ product, idx }) => productCard(product, idx)).join('')}
        </div>
      </section>
    `
    )
    .join('');
}

export function renderProductsTable(products, hideIncoming = false, currentSortKey = '') {
  const rows = products
    .map((product, index) => {
      const productName = product.product_name || `Sản phẩm ID: ${product.product_id?.[0]}`;
      const productId = product.product_id?.[0] ?? '';
      const status = stockStatus(product.quantity, product.available_quantity);
      const unit = product.uom_id?.[1] || '';
      const qty = Number(product.quantity) || 0;
      const avail = Number(product.available_quantity) || 0;
      const incomingQty = Number(product.incoming_qty) || 0;
      const formattedDate = product.incoming_date
        ? new Date(product.incoming_date).toLocaleDateString('vi-VN')
        : '—';
      const lots = lotLabel(product.lot_ids) || '—';

      return `
        <tr
          class="stock-table-row${product.isDiscontinued ? ' is-discontinued' : ''}"
          data-product-id="${escapeHtml(productId)}"
          data-inspect-index="${index}"
        >
          <td data-label="Sản phẩm" class="col-product">
            <div class="table-product-main">
              <span class="table-product-name">${escapeHtml(productName)}</span>
              ${product.isDiscontinued ? '<span class="discontinued-badge">Ngưng SX</span>' : ''}
            </div>
          </td>
          <td data-label="Nhóm hàng" class="col-category">
            <span class="category-badge" title="${escapeHtml(product.categoryName || '')}">
              ${escapeHtml(shortCategoryLeaf(product.categoryName))}
            </span>
          </td>
          <td data-label="Trạng thái" class="col-status">
            ${statusBadge(status)}
          </td>
          <td data-label="Tồn thực tế" class="col-num">
            <strong class="total-quantity">${qty.toLocaleString('vi-VN')}</strong>
            ${unit ? `<small class="table-unit">${escapeHtml(unit)}</small>` : ''}
          </td>
          <td data-label="Khả dụng" class="col-num">
            <strong class="available-quantity text-avail-${status}">${avail.toLocaleString('vi-VN')}</strong>
            ${unit ? `<small class="table-unit">${escapeHtml(unit)}</small>` : ''}
          </td>
          ${
            hideIncoming
              ? ''
              : `<td data-label="Đang về" class="col-num">
                  <strong class="incoming-quantity ${incomingQty > 0 ? 'has-incoming' : 'is-zero'}">${incomingQty.toLocaleString('vi-VN')}</strong>
                  ${incomingQty > 0 && product.incoming_date ? `<div class="table-eta">ETA ${escapeHtml(formattedDate)}</div>` : ''}
                </td>`
          }
          <td data-label="Số lô (Lot)" class="col-lot">
            <span class="table-lot-text" title="${escapeHtml(lots)}">${escapeHtml(lots)}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  const sortIcon = key => {
    if (currentSortKey === key) return ' ↓';
    return '';
  };

  return `
    <div class="stock-table-container panel">
      <table class="stock-data-table">
        <thead>
          <tr>
            <th scope="col" class="sortable-th" data-sort-trigger="name_asc">Mã / Tên sản phẩm${sortIcon('name_asc')}</th>
            <th scope="col">Nhóm sản phẩm</th>
            <th scope="col">Trạng thái</th>
            <th scope="col" class="num sortable-th" data-sort-trigger="${currentSortKey === 'quantity_desc' ? 'quantity_asc' : 'quantity_desc'}">
              Tồn thực tế${currentSortKey === 'quantity_desc' ? ' ↓' : currentSortKey === 'quantity_asc' ? ' ↑' : ''}
            </th>
            <th scope="col" class="num sortable-th" data-sort-trigger="available_asc">
              Khả dụng${sortIcon('available_asc')}
            </th>
            ${
              hideIncoming
                ? ''
                : `<th scope="col" class="num sortable-th" data-sort-trigger="incoming_desc">
                    Đang về${sortIcon('incoming_desc')}
                  </th>`
            }
            <th scope="col">Số lô (Lot)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function filterByStatus(products, statusFilter) {
  if (!statusFilter || statusFilter === 'all') return products;
  return products.filter(p => {
    const st = stockStatus(p.quantity, p.available_quantity);
    if (statusFilter === 'in') return st === 'in';
    if (statusFilter === 'low') return st === 'low' || st === 'out';
    if (statusFilter === 'incoming') return (Number(p.incoming_qty) || 0) > 0;
    if (statusFilter === 'discontinued') return Boolean(p.isDiscontinued);
    return true;
  });
}

export function renderStockCatalog(
  container,
  { groupedData, unfilteredGroupedData, activeWarehouse, sortKey, onShowAll }
) {
  if (!container) return;

  const referenceData = unfilteredGroupedData || groupedData;
  let warehouseName = activeWarehouse;
  if (!warehouseName && referenceData) {
    warehouseName = Object.keys(referenceData).sort()[0] || null;
  }

  if (warehouseName !== lastActiveWarehouseForStatus) {
    activeStatusFilter = 'all';
    lastActiveWarehouseForStatus = warehouseName;
  }

  const baseWarehouseProducts = warehouseName
    ? collectWarehouseProducts(referenceData, warehouseName)
    : [];

  if (
    (!groupedData || Object.keys(groupedData).length === 0) &&
    baseWarehouseProducts.length === 0
  ) {
    showStockMessage(container, 'empty', 'Không tìm thấy dữ liệu phù hợp');
    return;
  }

  if (!warehouseName || (!groupedData?.[warehouseName] && baseWarehouseProducts.length === 0)) {
    showStockMessage(container, 'empty', 'Vui lòng chọn kho');
    return;
  }

  const matchedProducts = collectWarehouseProducts(groupedData, warehouseName);
  const kpiSource = matchedProducts.length > 0 ? matchedProducts : baseWarehouseProducts;
  const hideIncoming = HIDE_INCOMING.has(warehouseName);

  // Compute summary metrics
  let totalQty = 0;
  let totalAvail = 0;
  let inStockCount = 0;
  let lowOrOutCount = 0;
  let incomingSkuCount = 0;
  let discontinuedCount = 0;

  kpiSource.forEach(p => {
    const q = Number(p.quantity) || 0;
    const av = Number(p.available_quantity) || 0;
    const inc = Number(p.incoming_qty) || 0;
    totalQty += q;
    totalAvail += av;
    const st = stockStatus(q, av);
    if (st === 'in') inStockCount += 1;
    else lowOrOutCount += 1;
    if (inc > 0) incomingSkuCount += 1;
    if (p.isDiscontinued) discontinuedCount += 1;
  });

  const statusFilteredProducts = filterByStatus(matchedProducts, activeStatusFilter);
  const sortedProducts = sortProducts(statusFilteredProducts, sortKey);
  const showAll = container.getAttribute('data-show-all-cards') === 'true';
  const visibleProducts = showAll ? sortedProducts : sortedProducts.slice(0, CARD_RENDER_LIMIT);
  const hiddenCardCount = Math.max(sortedProducts.length - visibleProducts.length, 0);

  const viewMode = getViewMode();

  const fourthFilterPill = hideIncoming
    ? `<button type="button" class="status-pill-btn ${activeStatusFilter === 'discontinued' ? 'is-active' : ''}" data-kpi-filter="discontinued">
        <span>Ngưng SX</span>
        <strong>${discontinuedCount}</strong>
      </button>`
    : `<button type="button" class="status-pill-btn ${activeStatusFilter === 'incoming' ? 'is-active' : ''}" data-kpi-filter="incoming">
        <span>Đang về</span>
        <strong>${incomingSkuCount}</strong>
      </button>`;

  container.innerHTML = `
    <div class="catalog">
      <!-- Compact 1-line Summary & View Bar -->
      <div class="catalog-summary-bar">
        <div class="status-pill-group" role="group" aria-label="Lọc nhanh theo trạng thái tồn">
          <button type="button" class="status-pill-btn ${activeStatusFilter === 'all' ? 'is-active' : ''}" data-kpi-filter="all">
            <span>Tất cả</span>
            <strong>${kpiSource.length.toLocaleString('vi-VN')}</strong>
          </button>
          <button type="button" class="status-pill-btn is-ok ${activeStatusFilter === 'in' ? 'is-active' : ''}" data-kpi-filter="in">
            <span class="status-dot dot-in"></span>
            <span>Còn hàng</span>
            <strong>${inStockCount.toLocaleString('vi-VN')}</strong>
          </button>
          <button type="button" class="status-pill-btn is-warn ${activeStatusFilter === 'low' ? 'is-active' : ''}" data-kpi-filter="low">
            <span class="status-dot dot-low"></span>
            <span>Sắp hết / Hết</span>
            <strong>${lowOrOutCount.toLocaleString('vi-VN')}</strong>
          </button>
          ${fourthFilterPill}
        </div>

        <div class="catalog-summary-right">
          <div class="stock-totals-inline">
            <span>Tổng tồn: <strong>${Math.round(totalQty).toLocaleString('vi-VN')}</strong></span>
            <span class="stock-results-divider">·</span>
            <span>Khả dụng: <strong>${Math.round(totalAvail).toLocaleString('vi-VN')}</strong></span>
            <span class="stock-results-divider">·</span>
            <span>${getVisibleWarehouseCount(sortedProducts)} kho (${escapeHtml(getSortLabel(sortKey))})</span>
          </div>

          <div class="view-mode-switch" role="group" aria-label="Chế độ hiển thị">
            <button type="button" class="view-mode-btn ${viewMode === 'grid' ? 'is-active' : ''}" data-view-mode="grid" aria-pressed="${viewMode === 'grid'}">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
              <span>Thẻ</span>
            </button>
            <button type="button" class="view-mode-btn ${viewMode === 'table' ? 'is-active' : ''}" data-view-mode="table" aria-pressed="${viewMode === 'table'}">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M2 10h12M6.5 6.5v7" stroke="currentColor" stroke-width="1.3"/></svg>
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Product Catalog Content -->
      ${
        sortedProducts.length === 0
          ? `<div class="empty-state panel" style="min-height: 200px;">
              <h2>Không có sản phẩm nào khớp điều kiện lọc</h2>
              <p>Hãy chuyển trạng thái về "Tất cả" hoặc xóa bộ lọc hiện tại.</p>
            </div>`
          : viewMode === 'table'
            ? renderProductsTable(visibleProducts, hideIncoming, sortKey)
            : `<div class="category-sections-list" id="productCardsGrid">
                ${renderGroupedCards(visibleProducts)}
              </div>`
      }

      ${
        hiddenCardCount > 0
          ? `<div class="stock-show-more-wrap">
              <button type="button" class="stock-show-more-btn" id="showMoreStockCards">
                Hiển thị thêm ${hiddenCardCount.toLocaleString('vi-VN')} sản phẩm
              </button>
            </div>`
          : ''
      }
    </div>
  `;

  // Wire Status Pill Filters
  container.querySelectorAll('[data-kpi-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetFilter = btn.getAttribute('data-kpi-filter') || 'all';
      activeStatusFilter = activeStatusFilter === targetFilter ? 'all' : targetFilter;
      renderStockCatalog(container, {
        groupedData,
        unfilteredGroupedData,
        activeWarehouse,
        sortKey,
        onShowAll,
      });
    });
  });

  // Wire View Mode Switcher (Grid <-> Table)
  container.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextMode = btn.getAttribute('data-view-mode') || 'grid';
      setViewMode(nextMode);
      renderStockCatalog(container, {
        groupedData,
        unfilteredGroupedData,
        activeWarehouse,
        sortKey,
        onShowAll,
      });
    });
  });

  // Wire Sortable Table Column Headers
  container.querySelectorAll('[data-sort-trigger]').forEach(th => {
    th.addEventListener('click', () => {
      const nextSort = th.getAttribute('data-sort-trigger');
      const sortSelect = document.getElementById('sortFilter');
      if (sortSelect && nextSort) {
        sortSelect.value = nextSort;
        document.dispatchEvent(new CustomEvent('filterChange'));
      }
    });
  });

  // Wire Table Row & Card Click -> Product Inspector
  container.querySelectorAll('[data-inspect-index]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.getAttribute('data-inspect-index'));
      if (visibleProducts[idx]) openProductInspector(visibleProducts[idx]);
    });
  });

  container.querySelectorAll('.stock-card[data-card-index]').forEach(card => {
    card.addEventListener('click', () => {
      const idx = Number(card.getAttribute('data-card-index'));
      if (visibleProducts[idx]) openProductInspector(visibleProducts[idx]);
    });
  });

  container.querySelector('#showMoreStockCards')?.addEventListener('click', () => {
    container.setAttribute('data-show-all-cards', 'true');
    onShowAll?.();
  });
}

function ensureLiveUpdateStyle() {
  if (typeof document === 'undefined' || document.getElementById('ws-update-styles')) return;
  const style = document.createElement('style');
  style.id = 'ws-update-styles';
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: scale(0.8); }
      10% { opacity: 1; transform: scale(1); }
      90% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(0.8); }
    }

    .stock-updated {
      animation: highlightPulse 1s ease-in-out;
    }

    @keyframes highlightPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.015); box-shadow: 0 8px 25px rgba(15, 118, 110, 0.18); }
    }
  `;
  document.head.appendChild(style);
}

export function applyLiveStockUpdate(update) {
  if (typeof document === 'undefined') return;
  const productId = update.product_id || update.productId;
  const quantity = update.quantity ?? update.qty;
  const availableQuantity = update.available_quantity ?? update.availableQty ?? quantity;

  const elements = document.querySelectorAll(`[data-product-id="${productId}"]`);
  if (!elements.length) return;

  ensureLiveUpdateStyle();

  elements.forEach(card => {
    const qtyElement = card.querySelector('.total-quantity');
    const availElement = card.querySelector('.available-quantity');

    if (qtyElement) {
      const oldQty = parseInt(qtyElement.textContent.replace(/,/g, '').replace(/\./g, ''), 10) || 0;
      const newQty = Math.round(quantity);
      qtyElement.textContent = newQty.toLocaleString('vi-VN');

      if (newQty !== oldQty) {
        card.classList.add('stock-updated');
        setTimeout(() => card.classList.remove('stock-updated'), 2000);
      }
    }

    if (availElement && availableQuantity !== undefined) {
      const newAvail = Math.round(availableQuantity);
      availElement.textContent = newAvail.toLocaleString('vi-VN');
    }
  });
}
