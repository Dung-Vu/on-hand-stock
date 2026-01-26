// ============================================
// EXCEL EXPORT UTILITY
// Using ExcelJS for professional Excel exports
// ============================================

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ============================================
// STYLE CONFIGURATION
// ============================================

const STYLES = {
    // Header style
    header: {
        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B5A45' } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FF5D5044' } },
            bottom: { style: 'thin', color: { argb: 'FF5D5044' } },
            left: { style: 'thin', color: { argb: 'FF5D5044' } },
            right: { style: 'thin', color: { argb: 'FF5D5044' } }
        }
    },
    // Title style
    title: {
        font: { bold: true, size: 16, color: { argb: 'FF2A231F' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    },
    // Subtitle style
    subtitle: {
        font: { size: 11, color: { argb: 'FF5D5044' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    },
    // Data cell style
    dataCell: {
        alignment: { vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FFE8DDD4' } },
            bottom: { style: 'thin', color: { argb: 'FFE8DDD4' } },
            left: { style: 'thin', color: { argb: 'FFE8DDD4' } },
            right: { style: 'thin', color: { argb: 'FFE8DDD4' } }
        }
    },
    // Number cell style
    numberCell: {
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0'
    },
    // Low stock highlight
    lowStock: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3CD' } },
        font: { color: { argb: 'FF856404' } }
    },
    // Out of stock highlight
    outOfStock: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } },
        font: { color: { argb: 'FF721C24' } }
    },
    // Good stock highlight
    goodStock: {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } },
        font: { color: { argb: 'FF155724' } }
    },
    // Category row style
    categoryRow: {
        font: { bold: true, size: 11, color: { argb: 'FF3F3630' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0EB' } }
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Apply style to a cell
 * @param {ExcelJS.Cell} cell
 * @param {Object} style
 */
function applyStyle(cell, style) {
    if (style.font) cell.font = style.font;
    if (style.fill) cell.fill = style.fill;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
    if (style.numFmt) cell.numFmt = style.numFmt;
}

/**
 * Get stock status
 * @param {number} quantity
 * @param {number} availableQty
 * @returns {string}
 */
function getStockStatus(quantity, availableQty) {
    if (quantity <= 0) return 'outOfStock';
    if (availableQty < quantity * 0.2) return 'lowStock';
    return 'goodStock';
}

/**
 * Format date to Vietnamese format
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export data to Excel file with multiple sheets
 * @param {Object} groupedData - Data grouped by warehouse
 * @param {Object} options - Export options
 * @returns {Promise<void>}
 */
export async function exportToExcel(groupedData, options = {}) {
    const {
        filename = `stock_data_${new Date().toISOString().split('T')[0]}`,
        includeStats = true,
        includeSummary = true,
        warehouseFilter = null // null = all, or specific warehouse name
    } = options;

    if (!groupedData || Object.keys(groupedData).length === 0) {
        throw new Error('Không có dữ liệu để xuất');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bonario Stock System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Filter warehouses if needed
    const warehouses = warehouseFilter
        ? { [warehouseFilter]: groupedData[warehouseFilter] }
        : groupedData;

    // Create summary sheet first (if enabled)
    if (includeSummary) {
        createSummarySheet(workbook, groupedData);
    }

    // Create a sheet for each warehouse
    for (const [warehouseName, warehouseData] of Object.entries(warehouses)) {
        if (!warehouseData) continue;
        createWarehouseSheet(workbook, warehouseName, warehouseData, includeStats);
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, `${filename}.xlsx`);
}

/**
 * Create summary sheet with all warehouses overview
 * @param {ExcelJS.Workbook} workbook
 * @param {Object} groupedData
 */
function createSummarySheet(workbook, groupedData) {
    const sheet = workbook.addWorksheet('Tổng quan', {
        properties: { tabColor: { argb: 'FF6B5A45' } }
    });

    // Set column widths
    sheet.columns = [
        { width: 5 },   // #
        { width: 25 },  // Warehouse
        { width: 15 },  // Products
        { width: 15 },  // Total Qty
        { width: 15 },  // Available
        { width: 15 },  // Incoming
        { width: 15 }   // Categories
    ];

    // Title
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = '📦 BÁO CÁO TỒN KHO TỔNG HỢP';
    applyStyle(titleCell, STYLES.title);
    sheet.getRow(1).height = 30;

    // Subtitle with date
    sheet.mergeCells('A2:G2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Ngày xuất: ${formatDate(new Date())}`;
    applyStyle(subtitleCell, STYLES.subtitle);
    sheet.getRow(2).height = 20;

    // Empty row
    sheet.getRow(3).height = 10;

    // Headers
    const headers = ['#', 'Kho', 'Số SP', 'Tổng tồn', 'Khả dụng', 'Đang đến', 'Nhóm SP'];
    const headerRow = sheet.getRow(4);
    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        applyStyle(cell, STYLES.header);
    });
    headerRow.height = 25;

    // Data rows
    let rowIndex = 5;
    let totalProducts = 0;
    let totalQuantity = 0;
    let totalAvailable = 0;
    let totalIncoming = 0;

    Object.entries(groupedData).forEach(([warehouseName, warehouseData], idx) => {
        const categories = warehouseData.categories || {};
        let warehouseProducts = 0;
        let warehouseQty = 0;
        let warehouseAvailable = 0;
        let warehouseIncoming = 0;

        Object.values(categories).forEach(category => {
            const products = Object.values(category.products || {});
            warehouseProducts += products.length;
            products.forEach(product => {
                warehouseQty += product.quantity || 0;
                warehouseAvailable += product.available_quantity || 0;
                warehouseIncoming += product.incoming_qty || 0;
            });
        });

        const row = sheet.getRow(rowIndex);
        row.values = [
            idx + 1,
            warehouseName,
            warehouseProducts,
            warehouseQty,
            warehouseAvailable,
            warehouseIncoming,
            Object.keys(categories).length
        ];

        // Apply styles to data cells
        for (let i = 1; i <= 7; i++) {
            applyStyle(row.getCell(i), STYLES.dataCell);
            if (i >= 3) applyStyle(row.getCell(i), STYLES.numberCell);
        }

        totalProducts += warehouseProducts;
        totalQuantity += warehouseQty;
        totalAvailable += warehouseAvailable;
        totalIncoming += warehouseIncoming;
        rowIndex++;
    });

    // Total row
    const totalRow = sheet.getRow(rowIndex);
    totalRow.values = ['', 'TỔNG CỘNG', totalProducts, totalQuantity, totalAvailable, totalIncoming, ''];
    totalRow.font = { bold: true };
    for (let i = 1; i <= 7; i++) {
        applyStyle(totalRow.getCell(i), STYLES.header);
        if (i >= 3 && i <= 6) applyStyle(totalRow.getCell(i), STYLES.numberCell);
    }
}

/**
 * Create warehouse sheet with detailed product data
 * @param {ExcelJS.Workbook} workbook
 * @param {string} warehouseName
 * @param {Object} warehouseData
 * @param {boolean} includeStats
 */
function createWarehouseSheet(workbook, warehouseName, warehouseData, includeStats) {
    // Sanitize sheet name (max 31 chars, no special chars)
    const sheetName = warehouseName
        .replace(/[\/\\?*\[\]]/g, '-')
        .substring(0, 31);

    const sheet = workbook.addWorksheet(sheetName, {
        properties: { tabColor: { argb: 'FF8B7355' } }
    });

    // Set column widths
    sheet.columns = [
        { width: 5 },   // #
        { width: 40 },  // Product name
        { width: 20 },  // Category
        { width: 12 },  // Quantity
        { width: 12 },  // Available
        { width: 12 },  // Incoming
        { width: 15 },  // Incoming Date
        { width: 25 },  // Lot IDs
        { width: 10 }   // Unit
    ];

    // Title
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `📦 ${warehouseName}`;
    applyStyle(titleCell, STYLES.title);
    sheet.getRow(1).height = 30;

    // Subtitle
    sheet.mergeCells('A2:I2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Ngày xuất: ${formatDate(new Date())}`;
    applyStyle(subtitleCell, STYLES.subtitle);

    // Empty row
    sheet.getRow(3).height = 10;

    // Headers
    const headers = ['#', 'Sản phẩm', 'Nhóm', 'Tồn kho', 'Khả dụng', 'Đang đến', 'Ngày đến', 'Số lô', 'ĐVT'];
    const headerRow = sheet.getRow(4);
    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        applyStyle(cell, STYLES.header);
    });
    headerRow.height = 25;

    // Freeze header
    sheet.views = [{ state: 'frozen', ySplit: 4 }];

    // Collect all products
    const allProducts = [];
    const categories = warehouseData.categories || {};

    Object.entries(categories).forEach(([categoryName, categoryData]) => {
        const products = Object.values(categoryData.products || {});
        products.forEach(product => {
            allProducts.push({
                ...product,
                categoryName
            });
        });
    });

    // Sort by category then by name
    allProducts.sort((a, b) => {
        const catCompare = a.categoryName.localeCompare(b.categoryName, 'vi');
        if (catCompare !== 0) return catCompare;
        return (a.product_name || '').localeCompare(b.product_name || '', 'vi');
    });

    // Data rows
    let rowIndex = 5;
    let currentCategory = '';

    allProducts.forEach((product, idx) => {
        // Add category separator row
        if (product.categoryName !== currentCategory) {
            currentCategory = product.categoryName;
            const categoryRow = sheet.getRow(rowIndex);
            sheet.mergeCells(`A${rowIndex}:I${rowIndex}`);
            categoryRow.getCell(1).value = `📁 ${currentCategory}`;
            applyStyle(categoryRow.getCell(1), STYLES.categoryRow);
            categoryRow.height = 22;
            rowIndex++;
        }

        const row = sheet.getRow(rowIndex);
        const lotIds = product.lot_ids && product.lot_ids.length > 0
            ? product.lot_ids.join(', ')
            : '-';
        const incomingDate = product.incoming_date
            ? new Date(product.incoming_date).toLocaleDateString('vi-VN')
            : '-';
        const unit = product.uom_id && product.uom_id[1] ? product.uom_id[1] : '';

        row.values = [
            idx + 1,
            product.product_name || `SP ID: ${product.product_id[0]}`,
            product.categoryName,
            product.quantity || 0,
            product.available_quantity || 0,
            product.incoming_qty || 0,
            incomingDate,
            lotIds,
            unit
        ];

        // Apply base styles
        for (let i = 1; i <= 9; i++) {
            applyStyle(row.getCell(i), STYLES.dataCell);
        }
        // Number formatting
        applyStyle(row.getCell(4), STYLES.numberCell);
        applyStyle(row.getCell(5), STYLES.numberCell);
        applyStyle(row.getCell(6), STYLES.numberCell);

        // Stock status highlighting
        const status = getStockStatus(product.quantity, product.available_quantity);
        if (status === 'lowStock') {
            for (let i = 4; i <= 6; i++) {
                applyStyle(row.getCell(i), STYLES.lowStock);
            }
        } else if (status === 'outOfStock') {
            for (let i = 4; i <= 6; i++) {
                applyStyle(row.getCell(i), STYLES.outOfStock);
            }
        }

        rowIndex++;
    });

    // Stats at the bottom if enabled
    if (includeStats) {
        rowIndex++; // Empty row
        const statsRow = sheet.getRow(rowIndex);
        statsRow.values = ['', '', 'TỔNG:',
            allProducts.reduce((sum, p) => sum + (p.quantity || 0), 0),
            allProducts.reduce((sum, p) => sum + (p.available_quantity || 0), 0),
            allProducts.reduce((sum, p) => sum + (p.incoming_qty || 0), 0),
            '', '', ''
        ];
        statsRow.font = { bold: true };
        for (let i = 3; i <= 6; i++) {
            applyStyle(statsRow.getCell(i), STYLES.header);
        }
        applyStyle(statsRow.getCell(4), STYLES.numberCell);
        applyStyle(statsRow.getCell(5), STYLES.numberCell);
        applyStyle(statsRow.getCell(6), STYLES.numberCell);
    }

    // Auto-filter
    sheet.autoFilter = {
        from: 'A4',
        to: `I${rowIndex - 1}`
    };
}

/**
 * Export current warehouse only
 * @param {Object} groupedData
 * @param {string} warehouseName
 */
export async function exportWarehouseToExcel(groupedData, warehouseName) {
    return exportToExcel(groupedData, {
        filename: `stock_${warehouseName.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}`,
        warehouseFilter: warehouseName,
        includeSummary: false
    });
}

/**
 * Quick export - just the essentials
 * @param {Object} groupedData
 */
export async function quickExportToExcel(groupedData) {
    return exportToExcel(groupedData, {
        includeStats: false,
        includeSummary: false
    });
}

// ============================================
// PDF EXPORT UTILITIES
// Using html2canvas + jsPDF for Vietnamese support
// ============================================

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Export stock data to PDF with full Vietnamese support
 * @param {Object} groupedData - Stock data grouped by warehouse
 * @param {Object} options - Export options
 */
export async function exportToPDF(groupedData, options = {}) {
    const {
        filename = `stock_report_${new Date().toISOString().split('T')[0]}`,
        warehouseFilter = null,
        includeSummary = true
    } = options;

    try {
        // Collect warehouses and data
        const warehouses = warehouseFilter
            ? [warehouseFilter]
            : Object.keys(groupedData).filter(w => w !== 'Tất cả kho');

        // Calculate totals
        let totalProducts = 0;
        let totalQuantity = 0;
        let totalAvailable = 0;
        let totalIncoming = 0;
        let outOfStockCount = 0;
        let lowStockCount = 0;

        // Create hidden container for HTML rendering
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            left: -9999px;
            top: 0;
            width: 1100px;
            background: white;
            font-family: 'Inter', Arial, sans-serif;
            padding: 20px;
        `;
        document.body.appendChild(container);

        // Build HTML content
        let htmlContent = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #6b5a45; font-size: 24px; margin: 0;">BÁO CÁO TỒN KHO - BONARIO</h1>
                <p style="color: #5d5044; font-size: 12px; margin: 5px 0;">
                    Xuất ngày: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}
                </p>
            </div>
        `;

        // Process each warehouse
        warehouses.forEach(warehouseName => {
            const warehouseData = groupedData[warehouseName];
            if (!warehouseData) return;

            htmlContent += `
                <div style="margin-bottom: 20px;">
                    <h2 style="color: #6b5a45; font-size: 16px; margin: 10px 0; padding: 8px; background: #f5f0eb; border-radius: 4px;">
                        📦 ${warehouseName}
                    </h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #6b5a45; color: white;">
                                <th style="padding: 8px; text-align: left; border: 1px solid #5d5044;">Danh mục</th>
                                <th style="padding: 8px; text-align: left; border: 1px solid #5d5044;">Tên sản phẩm</th>
                                <th style="padding: 8px; text-align: left; border: 1px solid #5d5044;">Mã SP</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #5d5044;">Tồn kho</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #5d5044;">Có thể bán</th>
                                <th style="padding: 8px; text-align: right; border: 1px solid #5d5044;">Đang về</th>
                                <th style="padding: 8px; text-align: center; border: 1px solid #5d5044;">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            const categories = warehouseData.categories || warehouseData;
            let rowIndex = 0;

            Object.entries(categories).forEach(([category, categoryData]) => {
                const products = categoryData.products || categoryData;
                const productList = Array.isArray(products) ? products : Object.values(products);

                productList.forEach(product => {
                    const qty = product.quantity || 0;
                    const available = product.available_quantity || 0;
                    const incoming = product.incoming_qty || 0;

                    totalProducts++;
                    totalQuantity += qty;
                    totalAvailable += available;
                    totalIncoming += incoming;

                    if (qty <= 0) outOfStockCount++;
                    else if (available < qty * 0.2) lowStockCount++;

                    // Status
                    let status = '✓ OK';
                    let statusColor = '#28a745';
                    if (qty <= 0) {
                        status = '⚠ Hết';
                        statusColor = '#dc3545';
                    } else if (available < qty * 0.2) {
                        status = '⚡ Thấp';
                        statusColor = '#856404';
                    }

                    const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f5f0eb';
                    const qtyColor = qty <= 0 ? '#dc3545' : '#2a231f';

                    htmlContent += `
                        <tr style="background: ${bgColor};">
                            <td style="padding: 6px 8px; border: 1px solid #e8ddd4;">${category}</td>
                            <td style="padding: 6px 8px; border: 1px solid #e8ddd4;">${product.product_name || product.name || 'N/A'}</td>
                            <td style="padding: 6px 8px; border: 1px solid #e8ddd4;">${product.default_code || ''}</td>
                            <td style="padding: 6px 8px; border: 1px solid #e8ddd4; text-align: right; color: ${qtyColor}; font-weight: ${qty <= 0 ? 'bold' : 'normal'};">${formatNumber(qty)}</td>
                            <td style="padding: 6px 8px; border: 1px solid #e8ddd4; text-align: right;">${formatNumber(available)}</td>
                            <td style="padding: 6px 8px; border: 1px solid #e8ddd4; text-align: right;">${formatNumber(incoming)}</td>
                            <td style="padding: 6px 8px; border: 1px solid #e8ddd4; text-align: center; color: ${statusColor}; font-weight: bold;">${status}</td>
                        </tr>
                    `;
                    rowIndex++;
                });
            });

            htmlContent += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        // Summary section
        if (includeSummary && !warehouseFilter) {
            htmlContent += `
                <div style="margin-top: 20px; padding: 15px; background: #f5f0eb; border-radius: 8px;">
                    <h3 style="color: #6b5a45; margin: 0 0 10px 0;">📊 TỔNG KẾT</h3>
                    <table style="font-size: 12px;">
                        <tr><td style="padding: 4px 20px 4px 0; font-weight: bold;">Tổng số sản phẩm:</td><td>${formatNumber(totalProducts)}</td></tr>
                        <tr><td style="padding: 4px 20px 4px 0; font-weight: bold;">Tổng tồn kho:</td><td>${formatNumber(totalQuantity)}</td></tr>
                        <tr><td style="padding: 4px 20px 4px 0; font-weight: bold;">Tổng có thể bán:</td><td>${formatNumber(totalAvailable)}</td></tr>
                        <tr><td style="padding: 4px 20px 4px 0; font-weight: bold;">Tổng đang về:</td><td>${formatNumber(totalIncoming)}</td></tr>
                        <tr><td style="padding: 4px 20px 4px 0; font-weight: bold; color: #dc3545;">Sản phẩm hết hàng:</td><td style="color: #dc3545;">${formatNumber(outOfStockCount)}</td></tr>
                        <tr><td style="padding: 4px 20px 4px 0; font-weight: bold; color: #856404;">Sản phẩm tồn thấp:</td><td style="color: #856404;">${formatNumber(lowStockCount)}</td></tr>
                    </table>
                </div>
            `;
        }

        // Footer
        htmlContent += `
            <div style="text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e8ddd4; color: #999; font-size: 10px;">
                Bonario Stock Management System
            </div>
        `;

        container.innerHTML = htmlContent;

        // Convert to canvas
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        // Remove temp container
        document.body.removeChild(container);

        // Create PDF
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        // Calculate PDF dimensions (A4 landscape)
        const pdfWidth = 297; // A4 landscape width in mm
        const pdfHeight = 210; // A4 landscape height in mm
        const margin = 10;
        const contentWidth = pdfWidth - (margin * 2);

        // Scale factor
        const scale = contentWidth / (imgWidth / 2); // /2 because we used scale: 2
        const scaledHeight = (imgHeight / 2) * scale;

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Calculate pages needed
        const pageContentHeight = pdfHeight - (margin * 2);
        const totalPages = Math.ceil(scaledHeight / pageContentHeight);

        for (let page = 0; page < totalPages; page++) {
            if (page > 0) {
                doc.addPage();
            }

            // Calculate source coordinates
            const sourceY = (page * pageContentHeight / scale) * 2; // *2 because of scale
            const sourceHeight = Math.min((pageContentHeight / scale) * 2, imgHeight - sourceY);

            // Create temporary canvas for this page
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = imgWidth;
            pageCanvas.height = sourceHeight;
            const ctx = pageCanvas.getContext('2d');

            ctx.drawImage(
                canvas,
                0, sourceY, imgWidth, sourceHeight,
                0, 0, imgWidth, sourceHeight
            );

            const pageImgData = pageCanvas.toDataURL('image/png');
            const pageScaledHeight = (sourceHeight / 2) * scale;

            doc.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageScaledHeight);

            // Page number
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Trang ${page + 1}/${totalPages}`,
                pdfWidth / 2,
                pdfHeight - 5,
                { align: 'center' }
            );
        }

        // Save PDF
        doc.save(`${filename}.pdf`);

        return { success: true, filename: `${filename}.pdf` };
    } catch (error) {
        console.error('PDF export error:', error);
        throw error;
    }
}

/**
 * Format number with Vietnamese locale
 */
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toLocaleString('vi-VN');
}

/**
 * Export current warehouse only to PDF
 */
export async function exportWarehouseToPDF(groupedData, warehouseName) {
    return exportToPDF(groupedData, {
        filename: `stock_${warehouseName.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}`,
        warehouseFilter: warehouseName,
        includeSummary: false
    });
}

/**
 * Quick PDF export - compact version
 */
export async function quickExportToPDF(groupedData) {
    return exportToPDF(groupedData, {
        includeSummary: false
    });
}

export default {
    exportToExcel,
    exportWarehouseToExcel,
    quickExportToExcel,
    exportToPDF,
    exportWarehouseToPDF,
    quickExportToPDF
};
