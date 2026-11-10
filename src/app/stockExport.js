import { shouldHideCategory } from '../data/stockPipeline.js';
import { showToast } from '../views/toast.js';

export function buildFallbackStockCsv(exportGroupedData) {
  let csv = 'Kho,Nhóm,Sản phẩm,Số lượng tồn,Số lượng khả dụng,Đang đến,Số lô\n';

  Object.keys(exportGroupedData || {})
    .sort()
    .forEach(warehouseName => {
      const warehouse = exportGroupedData[warehouseName];

      Object.keys(warehouse.categories || {})
        .sort()
        .forEach(categoryName => {
          if (shouldHideCategory(categoryName, warehouseName)) {
            return;
          }
          const category = warehouse.categories[categoryName];
          const productsList = Object.values(category.products || {});

          productsList.sort((a, b) => {
            const nameA = (a.product_name || '').toLowerCase();
            const nameB = (b.product_name || '').toLowerCase();
            return nameA.localeCompare(nameB, 'vi');
          });

          productsList.forEach(product => {
            const productName = product.product_name || `Sản phẩm ID: ${product.product_id?.[0]}`;
            const lotIds =
              product.lot_ids && product.lot_ids.length > 0 ? product.lot_ids.join(', ') : '-';

            csv += `"${warehouseName}","${categoryName}","${productName}",${
              product.quantity || 0
            },${product.available_quantity || 0},${product.incoming_qty || 0},"${lotIds}"\n`;
          });
        });
    });

  return csv;
}

function downloadFallbackCsv(exportGroupedData) {
  if (!exportGroupedData || typeof document === 'undefined') return;
  const csv = buildFallbackStockCsv(exportGroupedData);
  const blob = new Blob(['\ufeff' + csv], {
    type: 'text/csv;charset=utf-8;',
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `stock_data_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Đã xuất file CSV (fallback)', 'info');
}

export function exportStockExcel(exportGroupedData) {
  if (!exportGroupedData || Object.keys(exportGroupedData).length === 0) {
    showToast('Vui lòng tải dữ liệu trước', 'warning');
    return;
  }

  showToast('Đang chuẩn bị file Excel...', 'info');

  import('../utils/export.js')
    .then(({ exportToExcel }) =>
      exportToExcel(exportGroupedData, {
        filename: `stock_data_${new Date().toISOString().split('T')[0]}`,
        includeStats: true,
        includeSummary: true,
      })
    )
    .then(() => {
      showToast('Đã xuất file Excel thành công!', 'success');
    })
    .catch(error => {
      console.error('Export error:', error);
      showToast('Lỗi khi xuất file: ' + error.message, 'error');
      downloadFallbackCsv(exportGroupedData);
    });
}

export function exportStockPDF(exportGroupedData) {
  if (!exportGroupedData || Object.keys(exportGroupedData).length === 0) {
    showToast('Vui lòng tải dữ liệu trước', 'warning');
    return;
  }

  showToast('Đang tạo PDF...', 'info');

  import('../utils/export.js')
    .then(({ exportToPDF }) =>
      exportToPDF(exportGroupedData, {
        filename: `stock_report_${new Date().toISOString().split('T')[0]}`,
        includeStats: true,
        includeSummary: true,
      })
    )
    .then(() => {
      showToast('Đã xuất file PDF thành công!', 'success');
    })
    .catch(error => {
      console.error('PDF export error:', error);
      showToast('Lỗi khi xuất PDF: ' + error.message, 'error');
    });
}
