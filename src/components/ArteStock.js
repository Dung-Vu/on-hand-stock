import { createElement } from '../utils/dom.js';
import { fetchArteBatches, checkArteStock } from '../services/arteApi.js';

export default function ArteStock() {
  const container = createElement('div', {
    id: 'arteStockView',
    class: 'supplier-view hidden',
  });

  let currentReference = '';
  let currentProductName = '';
  let currentImageUrl = '';
  let batchesList = [];
  let selectedBatch = '';
  let currentAmount = 1;
  let isLoadingBatches = false;
  let isCheckingStock = false;
  let checkResult = null;
  let errorMessage = '';

  function label(text, htmlFor) {
    const node = createElement('label', { class: 'form-label', for: htmlFor });
    node.textContent = text;
    return node;
  }

  function render() {
    container.replaceChildren();

    const studio = createElement('div', { class: 'supplier-studio' });

    // ── LEFT PANEL: Lookup Controls
    const leftCard = createElement('div', { class: 'panel supplier-form-panel' });
    const badgeRow = createElement('div', { class: 'supplier-badge-row' });
    badgeRow.innerHTML = `
      <span class="kpi-pill is-info">ARTE International</span>
      <span class="supplier-origin">Belgium · Realtime Stock Portal</span>
    `;
    const heading = createElement('h2', { class: 'panel-title' });
    heading.textContent = 'Tra cứu tồn kho ARTE';
    const subtitle = createElement('p', { class: 'panel-copy' });
    subtitle.textContent =
      'Kiểm tra tồn kho trực tiếp từ hệ thống ARTE International theo mã thiết kế, số lô (batch) và số lượng đặt hàng.';
    leftCard.append(badgeRow, heading, subtitle);

    const liveRegion = createElement('div', { 'aria-live': 'polite', class: 'sr-only' });
    if (isLoadingBatches) liveRegion.textContent = 'Đang tìm kiếm lô hàng từ ARTE...';
    else if (isCheckingStock) liveRegion.textContent = 'Đang kiểm tra tồn kho từ ARTE...';
    else if (checkResult) {
      liveRegion.textContent = `Kết quả: ${checkResult.available ? 'Còn hàng' : 'Không đủ số lượng'}. ${checkResult.message}`;
    }
    leftCard.appendChild(liveRegion);

    const refSection = createElement('div', { style: 'margin-top: 18px;' });
    const refRow = createElement('div', { class: 'field-row' });
    const refInput = createElement('input', {
      id: 'arteRefInput',
      class: 'control-block',
      type: 'text',
      placeholder: 'Nhập mã sản phẩm (VD: 60741)...',
      value: currentReference,
      autocomplete: 'off',
      'aria-label': 'Mã sản phẩm ARTE',
    });
    refInput.disabled = isLoadingBatches || isCheckingStock;

    const searchBtn = createElement('button', {
      type: 'button',
      class: 'action-btn action-btn-primary',
      'aria-label': 'Tìm lô hàng',
    });
    searchBtn.disabled = isLoadingBatches || isCheckingStock;
    searchBtn.textContent = isLoadingBatches ? 'Đang tìm...' : 'Tìm lô hàng';

    const handleSearchBatches = async () => {
      const refVal = refInput.value.trim();
      if (!refVal) {
        errorMessage = 'Vui lòng nhập mã sản phẩm ARTE';
        render();
        return;
      }
      currentReference = refVal;
      isLoadingBatches = true;
      errorMessage = '';
      checkResult = null;
      batchesList = [];
      selectedBatch = '';
      currentProductName = '';
      currentImageUrl = '';
      render();
      try {
        const data = await fetchArteBatches(refVal);
        batchesList = data.batches || [];
        currentProductName = data.productName || '';
        currentImageUrl = data.imageUrl || '';
        isLoadingBatches = false;
        render();
      } catch (err) {
        isLoadingBatches = false;
        errorMessage = err.message || 'Không thể tra cứu lô hàng từ ARTE';
        render();
      }
    };

    searchBtn.addEventListener('click', handleSearchBatches);
    refInput.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      handleSearchBatches();
    });
    refRow.append(refInput, searchBtn);
    refSection.append(label('Bước 1 · Mã sản phẩm (Reference)', 'arteRefInput'), refRow);
    leftCard.appendChild(refSection);

    if (errorMessage) {
      const errBanner = createElement('div', {
        role: 'alert',
        class: 'alert alert-error',
        style: 'margin-top: 14px;',
      });
      errBanner.textContent = errorMessage;
      leftCard.appendChild(errBanner);
    }

    if (batchesList.length > 0) {
      const formGrid = createElement('div', { class: 'form-grid' });
      const batchSelect = createElement('select', {
        id: 'arteBatchSelect',
        class: 'control-block',
        'aria-label': 'Chọn số lô ARTE',
      });
      batchSelect.disabled = isCheckingStock;
      const defaultOption = createElement('option', { value: '' });
      defaultOption.textContent = 'Không chọn lô — kiểm tra toàn bộ';
      batchSelect.appendChild(defaultOption);
      batchesList.forEach(batch => {
        const option = createElement('option', { value: batch });
        option.textContent = `Lô ${batch}`;
        if (batch === selectedBatch) option.selected = true;
        batchSelect.appendChild(option);
      });
      batchSelect.addEventListener('change', event => {
        selectedBatch = event.target.value;
        checkResult = null;
        render();
      });

      const amountInput = createElement('input', {
        id: 'arteAmountInput',
        class: 'control-block',
        type: 'number',
        min: '0.01',
        max: '100000',
        step: 'any',
        value: String(currentAmount),
        'aria-label': 'Số lượng kiểm tra',
      });
      amountInput.disabled = isCheckingStock;
      amountInput.addEventListener('input', event => {
        const val = parseFloat(event.target.value);
        if (Number.isFinite(val) && val > 0) currentAmount = val;
      });

      const batchGroup = createElement('div');
      batchGroup.append(label('Bước 2 · Chọn số lô', 'arteBatchSelect'), batchSelect);
      const amountGroup = createElement('div');
      amountGroup.append(label('Bước 3 · Số lượng cần đặt', 'arteAmountInput'), amountInput);
      formGrid.append(batchGroup, amountGroup);
      leftCard.appendChild(formGrid);

      const submitBtn = createElement('button', {
        type: 'button',
        class: 'action-btn action-btn-primary',
        'aria-label': 'Kiểm tra tồn kho',
        style: 'width: 100%; height: 42px;',
      });
      submitBtn.disabled = isCheckingStock || currentAmount <= 0;
      submitBtn.textContent = isCheckingStock
        ? 'Đang kiểm tra tồn kho từ ARTE...'
        : 'Kiểm tra khả dụng ngay';

      const handleCheckStock = async () => {
        const amountFromInput = Number(amountInput.value);
        if (!Number.isFinite(amountFromInput) || amountFromInput <= 0 || amountFromInput > 100000) {
          errorMessage = 'Vui lòng nhập số lượng lớn hơn 0 và không vượt quá 100.000';
          render();
          return;
        }
        currentAmount = amountFromInput;
        isCheckingStock = true;
        errorMessage = '';
        checkResult = null;
        render();
        try {
          const res = await checkArteStock({
            reference: currentReference,
            batch: selectedBatch,
            amount: currentAmount,
          });
          checkResult = res;
          currentProductName = res.productName || currentProductName;
          currentImageUrl = res.imageUrl || currentImageUrl;
          isCheckingStock = false;
          render();
        } catch (err) {
          isCheckingStock = false;
          errorMessage = err.message || 'Không thể kiểm tra tồn kho';
          render();
        }
      };

      submitBtn.addEventListener('click', handleCheckStock);
      amountInput.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        handleCheckStock();
      });
      leftCard.appendChild(submitBtn);
    }

    // ── RIGHT PANEL: Live Preview & Results
    const rightCard = createElement('div', { class: 'panel supplier-preview-panel' });

    if (!currentProductName && !checkResult && batchesList.length === 0) {
      const emptyPreview = createElement('div', { class: 'empty-state', style: 'min-height: 240px;' });
      emptyPreview.innerHTML = `
        <div class="state-icon-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </div>
        <h2>Sẵn sàng tra cứu ARTE</h2>
        <p>Nhập mã sản phẩm ở cột bên trái để xem hình mẫu, danh sách lô hàng hiện có và kiểm tra số lượng khả dụng.</p>
      `;
      rightCard.appendChild(emptyPreview);
    } else {
      if (currentProductName || currentReference) {
        const prodHead = createElement('div', { style: 'margin-bottom: 14px;' });
        prodHead.innerHTML = `
          <span class="kpi-label">Sản phẩm đang chọn</span>
          <h3 class="panel-title" style="margin-top: 4px;">${currentProductName || `Mã ${currentReference}`}</h3>
        `;
        rightCard.appendChild(prodHead);
      }

      if (currentImageUrl) {
        const productImage = createElement('img', {
          class: 'product-shot',
          src: currentImageUrl,
          alt: currentProductName ? `Hình ảnh ${currentProductName}` : 'Hình ảnh sản phẩm ARTE',
          style: 'aspect-ratio: 1 / 1; object-fit: cover;',
        });
        rightCard.appendChild(productImage);
      }

      if (batchesList.length > 0) {
        const batchesBox = createElement('div', { style: 'margin-bottom: 16px;' });
        const bLabel = createElement('div', { class: 'form-label' });
        bLabel.textContent = `Các lô hiện có tại ARTE (${batchesList.length} lô)`;
        const chipsWrap = createElement('div', { class: 'lot-chips-wrap' });
        batchesList.forEach(b => {
          const chip = createElement('span', { class: 'lot-chip' });
          chip.textContent = `Lô ${b}`;
          chipsWrap.appendChild(chip);
        });
        batchesBox.append(bLabel, chipsWrap);
        rightCard.appendChild(batchesBox);
      }

      if (checkResult) {
        const isAvailable = checkResult.available;
        const resultBox = createElement('div', {
          role: 'region',
          class: `result-card ${isAvailable ? 'is-ok' : 'is-bad'}`,
          'aria-label': 'Kết quả kiểm tra tồn kho ARTE',
        });
        const topRow = createElement('div', {
          class: 'stock-results-summary',
        });
        const badge = createElement('strong');
        badge.textContent = isAvailable ? 'Đủ số lượng đáp ứng' : 'Không đủ số lượng';
        const time = createElement('span');
        time.textContent = new Date(checkResult.checkedAt).toLocaleTimeString('vi-VN');
        topRow.append(badge, time);
        const message = createElement('p', { class: 'panel-copy', style: 'color: inherit;' });
        message.textContent = checkResult.message;
        const details = createElement('div', { class: 'result-meta' });
        const batchCol = createElement('div');
        batchCol.textContent = `Lô hàng: ${checkResult.batch || 'Toàn bộ'}`;
        const amountCol = createElement('div');
        amountCol.textContent = `Số lượng yêu cầu: ${checkResult.amount}`;
        details.append(batchCol, amountCol);
        resultBox.append(topRow, message, details);
        rightCard.appendChild(resultBox);
      }
    }

    studio.append(leftCard, rightCard);
    container.appendChild(studio);
  }

  render();
  return container;
}
