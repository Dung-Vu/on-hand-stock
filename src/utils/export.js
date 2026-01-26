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
// Using jsPDF for professional PDF exports
// ============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Export stock data to PDF
 * @param {Object} groupedData - Stock data grouped by warehouse
 * @param {Object} options - Export options
 */
export async function exportToPDF(groupedData, options = {}) {
    const {
        filename = `stock_report_${new Date().toISOString().split('T')[0]}`,
        title = 'BÁO CÁO TỒN KHO - BONARIO',
        warehouseFilter = null,
        includeStats = true,
        includeSummary = true,
        orientation = 'landscape'
    } = options;

    try {
        // Create PDF document
        const doc = new jsPDF({
            orientation,
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;

        // Colors matching Bonario theme
        const primaryColor = [107, 90, 69];    // #6B5A45
        const secondaryColor = [93, 80, 68];   // #5D5044
        const lightBg = [245, 240, 235];       // #F5F0EB
        const dangerColor = [220, 53, 69];     // #dc3545
        const warningColor = [255, 193, 7];    // #ffc107
        const successColor = [40, 167, 69];    // #28a745

        // Title
        doc.setFontSize(18);
        doc.setTextColor(...primaryColor);
        doc.text(title, pageWidth / 2, 15, { align: 'center' });

        // Subtitle with date
        doc.setFontSize(10);
        doc.setTextColor(...secondaryColor);
        const now = new Date();
        doc.text(
            `Xuất ngày: ${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN')}`,
            pageWidth / 2, 22, { align: 'center' }
        );

        let yPosition = 30;

        // Collect warehouses and data
        const warehouses = warehouseFilter 
            ? [warehouseFilter] 
            : Object.keys(groupedData).filter(w => w !== 'Tất cả kho');

        // Calculate totals for summary
        let totalProducts = 0;
        let totalQuantity = 0;
        let totalAvailable = 0;
        let totalIncoming = 0;
        let outOfStockCount = 0;
        let lowStockCount = 0;

        // Process each warehouse
        warehouses.forEach((warehouseName, warehouseIndex) => {
            const warehouseData = groupedData[warehouseName];
            if (!warehouseData) return;

            // Check if we need a new page
            if (warehouseIndex > 0 && yPosition > pageHeight - 60) {
                doc.addPage();
                yPosition = 15;
            }

            // Warehouse header
            doc.setFontSize(14);
            doc.setTextColor(...primaryColor);
            doc.text(`📦 ${warehouseName}`, margin, yPosition);
            yPosition += 8;

            // Prepare table data
            const tableData = [];
            
            // Handle nested structure: warehouseData.categories.categoryName.products
            const categories = warehouseData.categories || warehouseData;
            
            Object.entries(categories).forEach(([category, categoryData]) => {
                // Products can be in categoryData.products (object) or categoryData directly (array)
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

                    tableData.push([
                        category,
                        product.product_name || product.name || 'N/A',
                        product.default_code || '',
                        formatNumber(qty),
                        formatNumber(available),
                        formatNumber(incoming),
                        qty <= 0 ? '⚠️ Hết' : available < qty * 0.2 ? '⚡ Thấp' : '✓ OK'
                    ]);
                });
            });

            // Create table
            autoTable(doc, {
                startY: yPosition,
                head: [[
                    'Danh mục',
                    'Tên sản phẩm',
                    'Mã SP',
                    'Tồn kho',
                    'Có thể bán',
                    'Đang về',
                    'Trạng thái'
                ]],
                body: tableData,
                margin: { left: margin, right: margin },
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    overflow: 'linebreak',
                    lineColor: [232, 221, 212],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: primaryColor,
                    textColor: [255, 255, 255],
                    fontSize: 9,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                alternateRowStyles: {
                    fillColor: lightBg
                },
                columnStyles: {
                    0: { cellWidth: 30 },  // Danh mục
                    1: { cellWidth: 60 },  // Tên SP
                    2: { cellWidth: 25 },  // Mã SP
                    3: { cellWidth: 20, halign: 'right' },  // Tồn kho
                    4: { cellWidth: 20, halign: 'right' },  // Có thể bán
                    5: { cellWidth: 20, halign: 'right' },  // Đang về
                    6: { cellWidth: 20, halign: 'center' }  // Trạng thái
                },
                didParseCell: function(data) {
                    // Color coding for status column
                    if (data.column.index === 6 && data.section === 'body') {
                        const status = data.cell.raw;
                        if (status.includes('Hết')) {
                            data.cell.styles.textColor = dangerColor;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (status.includes('Thấp')) {
                            data.cell.styles.textColor = [133, 100, 4];
                        } else if (status.includes('OK')) {
                            data.cell.styles.textColor = successColor;
                        }
                    }
                    // Color coding for quantity cells
                    if (data.column.index === 3 && data.section === 'body') {
                        const qty = parseInt(data.cell.raw.replace(/[,\.]/g, '')) || 0;
                        if (qty <= 0) {
                            data.cell.styles.textColor = dangerColor;
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });

            yPosition = (doc.lastAutoTable?.finalY || yPosition) + 10;
        });

        // Summary section
        if (includeSummary && !warehouseFilter) {
            // Check if we need a new page for summary
            if (yPosition > pageHeight - 50) {
                doc.addPage();
                yPosition = 15;
            }

            doc.setFontSize(12);
            doc.setTextColor(...primaryColor);
            doc.text('📊 TỔNG KẾT', margin, yPosition);
            yPosition += 8;

            const summaryData = [
                ['Tổng số sản phẩm', formatNumber(totalProducts)],
                ['Tổng tồn kho', formatNumber(totalQuantity)],
                ['Tổng có thể bán', formatNumber(totalAvailable)],
                ['Tổng đang về', formatNumber(totalIncoming)],
                ['Sản phẩm hết hàng', formatNumber(outOfStockCount)],
                ['Sản phẩm tồn thấp', formatNumber(lowStockCount)]
            ];

            autoTable(doc, {
                startY: yPosition,
                body: summaryData,
                margin: { left: margin },
                styles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 50 },
                    1: { halign: 'right', cellWidth: 30 }
                },
                theme: 'plain'
            });
        }

        // Footer on each page
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Trang ${i}/${pageCount} - Bonario Stock Management`,
                pageWidth / 2,
                pageHeight - 5,
                { align: 'center' }
            );
        }

        // Save the PDF
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
 * @param {Object} groupedData
 * @param {string} warehouseName
 */
export async function exportWarehouseToPDF(groupedData, warehouseName) {
    return exportToPDF(groupedData, {
        filename: `stock_${warehouseName.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}`,
        warehouseFilter: warehouseName,
        includeSummary: false,
        title: `BÁO CÁO TỒN KHO - ${warehouseName.toUpperCase()}`
    });
}

/**
 * Quick PDF export - compact version
 * @param {Object} groupedData
 */
export async function quickExportToPDF(groupedData) {
    return exportToPDF(groupedData, {
        includeStats: false,
        includeSummary: false,
        orientation: 'portrait'
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
