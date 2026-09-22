import { createElement } from '../utils/dom.js';
import { fetchArteBatches, checkArteStock } from '../services/arteApi.js';

/**
 * ARTE Stock Check View Component
 * Vertical flow: Reference -> Batch -> Amount -> Availability Result
 * Safe DOM rendering: All dynamic values are rendered via textContent (no innerHTML interpolation).
 */
export default function ArteStock({ onToast }) {
    const container = createElement('div', {
        id: 'arteStockView',
        class: 'hidden max-w-3xl mx-auto py-4 px-2 sm:px-4',
    });

    // Component State
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

    // Render helper
    function render() {
        container.innerHTML = '';

        // Card Container
        const card = createElement('div', {});
        card.style.cssText = `
            background: #ffffff;
            border: 1.5px solid #e8ddd4;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(42,35,31,0.06);
            padding: 20px 24px;
            box-sizing: border-box;
            font-family: inherit;
        `;

        // Header Title (static trusted markup)
        const header = createElement('div', {
            style: 'margin-bottom: 20px; border-bottom: 1px solid #f0ebe4; padding-bottom: 14px;',
        });
        const headerTitleRow = createElement('div', { style: 'display:flex; align-items:center; gap:8px;' });
        const headerIcon = createElement('span', { style: 'font-size:20px;' });
        headerIcon.textContent = '🏛️';
        const headerTitle = createElement('h2', {
            style: 'margin:0; font-size:18px; font-weight:700; color:#2a231f;',
        });
        headerTitle.textContent = 'Tra cứu tồn kho quốc tế ARTE';
        headerTitleRow.appendChild(headerIcon);
        headerTitleRow.appendChild(headerTitle);

        const headerSubtitle = createElement('p', {
            style: 'margin:4px 0 0 28px; font-size:13px; color:#6b5a45;',
        });
        headerSubtitle.textContent = 'Tra cứu trực tiếp trạng thái khả dụng theo Mã sản phẩm, Lô hàng và Số lượng từ hệ thống ARTE International.';
        header.appendChild(headerTitleRow);
        header.appendChild(headerSubtitle);
        card.appendChild(header);

        // Live status region for screen readers
        const liveRegion = createElement('div', {
            'aria-live': 'polite',
            class: 'sr-only',
        });
        liveRegion.style.cssText = 'position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0;';
        if (isLoadingBatches) liveRegion.textContent = 'Đang tìm kiếm lô hàng từ ARTE...';
        else if (isCheckingStock) liveRegion.textContent = 'Đang kiểm tra tồn kho từ ARTE...';
        else if (checkResult) liveRegion.textContent = `Kết quả: ${checkResult.available ? 'Còn hàng' : 'Không đủ số lượng'}. ${checkResult.message}`;
        card.appendChild(liveRegion);

        // Step 1: Reference Input Section
        const refSection = createElement('div', { style: 'margin-bottom: 18px;' });

        const refLabel = createElement('label', {
            for: 'arteRefInput',
            style: 'display:block; font-size:13px; font-weight:700; color:#2a231f; margin-bottom:6px;',
        });
        refLabel.textContent = '1. Mã sản phẩm (Reference)';

        const refInputGroup = createElement('div', { style: 'display:flex; gap:8px;' });

        const refInput = createElement('input', {
            id: 'arteRefInput',
            type: 'text',
            placeholder: 'Ví dụ: 60741',
            value: currentReference,
            autocomplete: 'off',
            'aria-label': 'Mã sản phẩm ARTE',
        });
        refInput.disabled = isLoadingBatches || isCheckingStock;
        refInput.style.cssText = `
            flex: 1;
            height: 40px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1.5px solid #d4c4b0;
            background: #ffffff;
            font-size: 14px;
            color: #2a231f;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            font-family: inherit;
        `;
        refInput.addEventListener('focus', () => {
            refInput.style.borderColor = '#8b6b4f';
            refInput.style.boxShadow = '0 0 0 3px rgba(139,107,79,0.12)';
        });
        refInput.addEventListener('blur', () => {
            refInput.style.borderColor = '#d4c4b0';
            refInput.style.boxShadow = 'none';
        });

        const searchBtn = createElement('button', {
            type: 'button',
            'aria-label': 'Tìm lô hàng',
        });
        searchBtn.disabled = isLoadingBatches || isCheckingStock;
        searchBtn.style.cssText = `
            height: 40px;
            padding: 0 16px;
            border-radius: 8px;
            border: none;
            background: #6b5a45;
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            cursor: ${isLoadingBatches || isCheckingStock ? 'not-allowed' : 'pointer'};
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: background-color 0.15s;
            font-family: inherit;
            white-space: nowrap;
        `;

        const searchIcon = createElement('span');
        if (isLoadingBatches) {
            searchIcon.className = 'inline-block animate-spin';
            searchIcon.textContent = '⏳';
        } else {
            searchIcon.textContent = '🔍';
        }
        const searchText = createElement('span');
        searchText.textContent = isLoadingBatches ? 'Đang tìm...' : 'Tìm lô';
        searchBtn.appendChild(searchIcon);
        searchBtn.appendChild(searchText);

        // Event: Reference Search
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
                if (batchesList.length > 0) {
                    selectedBatch = batchesList[0];
                }
                isLoadingBatches = false;
                render();
            } catch (err) {
                isLoadingBatches = false;
                errorMessage = err.message || 'Không thể tra cứu lô hàng từ ARTE';
                render();
            }
        };

        searchBtn.addEventListener('click', handleSearchBatches);
        refInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchBatches();
            }
        });

        refInputGroup.appendChild(refInput);
        refInputGroup.appendChild(searchBtn);
        refSection.appendChild(refLabel);
        refSection.appendChild(refInputGroup);
        card.appendChild(refSection);

        // Error message banner
        if (errorMessage) {
            const errBanner = createElement('div', {
                role: 'alert',
                style: `
                    background: #fef2f2;
                    border: 1px solid #fee2e2;
                    border-left: 4px solid #ef4444;
                    padding: 10px 14px;
                    border-radius: 6px;
                    margin-bottom: 18px;
                    font-size: 13px;
                    color: #b91c1c;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `,
            });
            const errIcon = createElement('span');
            errIcon.textContent = '❌';
            const errText = createElement('span');
            errText.textContent = errorMessage;
            errBanner.appendChild(errIcon);
            errBanner.appendChild(errText);
            card.appendChild(errBanner);
        }

        // Step 2 & 3: Batch Selector and Amount (shown when batches are available)
        if (batchesList.length > 0) {
            const formGrid = createElement('div', {
                style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;',
            });

            // Batch dropdown
            const batchGroup = createElement('div');
            const batchLabel = createElement('label', {
                for: 'arteBatchSelect',
                style: 'display:block; font-size:13px; font-weight:700; color:#2a231f; margin-bottom:6px;',
            });
            batchLabel.textContent = '2. Chọn số lô (Batch)';

            const batchSelect = createElement('select', {
                id: 'arteBatchSelect',
                'aria-label': 'Chọn số lô ARTE',
            });
            batchSelect.disabled = isCheckingStock;
            batchSelect.style.cssText = `
                width: 100%;
                height: 40px;
                padding: 0 10px;
                border-radius: 8px;
                border: 1.5px solid #d4c4b0;
                background: #ffffff;
                font-size: 14px;
                color: #2a231f;
                outline: none;
                font-family: inherit;
                cursor: pointer;
            `;
            batchesList.forEach((b) => {
                const opt = createElement('option', { value: b });
                opt.textContent = `Lô ${b}`;
                if (b === selectedBatch) opt.selected = true;
                batchSelect.appendChild(opt);
            });
            batchSelect.addEventListener('change', (e) => {
                selectedBatch = e.target.value;
                checkResult = null;
                render();
            });

            batchGroup.appendChild(batchLabel);
            batchGroup.appendChild(batchSelect);
            formGrid.appendChild(batchGroup);

            // Amount input: supports positive decimals
            const amountGroup = createElement('div');
            const amountLabel = createElement('label', {
                for: 'arteAmountInput',
                style: 'display:block; font-size:13px; font-weight:700; color:#2a231f; margin-bottom:6px;',
            });
            amountLabel.textContent = '3. Số lượng cần tra cứu';

            const amountInput = createElement('input', {
                id: 'arteAmountInput',
                type: 'number',
                min: '0.01',
                max: '100000',
                step: 'any',
                value: String(currentAmount),
                'aria-label': 'Số lượng kiểm tra',
            });
            amountInput.disabled = isCheckingStock;
            amountInput.style.cssText = `
                width: 100%;
                height: 40px;
                padding: 0 12px;
                border-radius: 8px;
                border: 1.5px solid #d4c4b0;
                background: #ffffff;
                font-size: 14px;
                color: #2a231f;
                outline: none;
                box-sizing: border-box;
                font-family: inherit;
            `;
            amountInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                    currentAmount = val;
                }
            });

            amountGroup.appendChild(amountLabel);
            amountGroup.appendChild(amountInput);
            formGrid.appendChild(amountGroup);
            card.appendChild(formGrid);

            // Submit Button: Check Stock
            const submitBtn = createElement('button', {
                type: 'button',
                'aria-label': 'Kiểm tra tồn kho',
            });
            submitBtn.disabled = isCheckingStock || !selectedBatch || currentAmount <= 0;
            submitBtn.style.cssText = `
                width: 100%;
                height: 44px;
                border-radius: 8px;
                border: none;
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                color: #ffffff;
                font-size: 14px;
                font-weight: 700;
                cursor: ${isCheckingStock ? 'not-allowed' : 'pointer'};
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                box-shadow: 0 2px 8px rgba(37,99,235,0.25);
                font-family: inherit;
                transition: transform 0.15s, opacity 0.15s;
                margin-bottom: 18px;
            `;

            const submitIcon = createElement('span');
            if (isCheckingStock) {
                submitIcon.className = 'inline-block animate-spin';
                submitIcon.textContent = '⏳';
            } else {
                submitIcon.textContent = '✨';
            }
            const submitText = createElement('span');
            submitText.textContent = isCheckingStock ? 'Đang kiểm tra tồn kho từ ARTE...' : 'Kiểm tra tồn kho';
            submitBtn.appendChild(submitIcon);
            submitBtn.appendChild(submitText);

            const handleCheckStock = async () => {
                const amountFromInput = Number(amountInput.value);
                if (!selectedBatch || !Number.isFinite(amountFromInput) || amountFromInput <= 0 || amountFromInput > 100000) {
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
            amountInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCheckStock();
                }
            });

            card.appendChild(submitBtn);

            // ARTE only returns the product image after the final amount check.
            // Show a large, image-only preview directly below the check button.
            if (currentImageUrl) {
                const imageWrap = createElement('div', {
                    style: 'display:flex; justify-content:center; margin:0 0 18px;',
                });
                const productImage = createElement('img', {
                    src: currentImageUrl,
                    alt: 'Hình ảnh sản phẩm ARTE',
                });
                productImage.style.cssText = `
                    display: block;
                    width: min(100%, 360px);
                    aspect-ratio: 1 / 1;
                    object-fit: cover;
                    border-radius: 12px;
                    border: 1px solid #e2d6ca;
                    box-shadow: 0 6px 18px rgba(42,35,31,0.12);
                    background: #f8f5f1;
                `;
                imageWrap.appendChild(productImage);
                card.appendChild(imageWrap);
            }
        }

        // 4. Result View State (Available / Unavailable)
        if (checkResult) {
            const resultBox = createElement('div', {
                role: 'region',
                'aria-label': 'Kết quả kiểm tra tồn kho ARTE',
            });

            const isAvailable = checkResult.available;
            resultBox.style.cssText = `
                padding: 18px;
                border-radius: 10px;
                border: 1.5px solid ${isAvailable ? '#86efac' : '#fca5a5'};
                background: ${isAvailable ? '#f0fdf4' : '#fef2f2'};
                box-shadow: 0 4px 12px ${isAvailable ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'};
            `;

            const badgeColor = isAvailable ? '#15803d' : '#b91c1c';
            const badgeBg = isAvailable ? '#dcfce7' : '#fee2e2';
            const statusIcon = isAvailable ? '✅' : '❌';
            const statusTitle = isAvailable ? 'ĐỦ SỐ LƯỢNG (AVAILABLE)' : 'KHÔNG ĐỦ SỐ LƯỢNG (NOT AVAILABLE)';

            // Top status header row
            const topRow = createElement('div', {
                style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;',
            });
            const badgeWrapper = createElement('div', {
                style: 'display:flex; align-items:center; gap:8px;',
            });
            const iconSpan = createElement('span', { style: 'font-size:22px;' });
            iconSpan.textContent = statusIcon;

            const badgeSpan = createElement('span', {
                style: `display:inline-block; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:800; background:${badgeBg}; color:${badgeColor}; letter-spacing:0.5px;`,
            });
            badgeSpan.textContent = statusTitle;
            badgeWrapper.appendChild(iconSpan);
            badgeWrapper.appendChild(badgeSpan);

            const timeSpan = createElement('span', { style: 'font-size:11px; color:#6b7280;' });
            timeSpan.textContent = new Date(checkResult.checkedAt).toLocaleTimeString('vi-VN');
            topRow.appendChild(badgeWrapper);
            topRow.appendChild(timeSpan);
            resultBox.appendChild(topRow);

            // Message text
            const msgEl = createElement('div', {
                style: 'font-size:15px; font-weight:600; color:#1f2937; margin-bottom:12px;',
            });
            msgEl.textContent = `"${checkResult.message}"`;
            resultBox.appendChild(msgEl);

            // Details grid
            const detailsGrid = createElement('div', {
                style: 'display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px; font-size:12px; background:rgba(255,255,255,0.7); padding:10px; border-radius:6px; border:1px solid rgba(0,0,0,0.05);',
            });

            // Batch column
            const batchCol = createElement('div');
            const batchLbl = createElement('span', { style: 'color:#6b7280;' });
            batchLbl.textContent = 'Lô hàng: ';
            const batchVal = createElement('strong', { style: 'color:#111827;' });
            batchVal.textContent = checkResult.batch;
            batchCol.appendChild(batchLbl);
            batchCol.appendChild(batchVal);
            detailsGrid.appendChild(batchCol);

            // Amount column
            const amountCol = createElement('div');
            const amountLbl = createElement('span', { style: 'color:#6b7280;' });
            amountLbl.textContent = 'Số lượng yêu cầu: ';
            const amountVal = createElement('strong', { style: 'color:#111827;' });
            amountVal.textContent = String(checkResult.amount);
            amountCol.appendChild(amountLbl);
            amountCol.appendChild(amountVal);
            detailsGrid.appendChild(amountCol);

            resultBox.appendChild(detailsGrid);
            card.appendChild(resultBox);
        }

        container.appendChild(card);
    }

    render();

    return container;
}
