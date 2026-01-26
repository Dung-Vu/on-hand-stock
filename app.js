
let ODOO_CONFIG = {};
try {
    // Nếu config.js tồn tại, sử dụng cấu hình
    if (typeof window !== 'undefined') {
        // Cấu hình sẽ được định nghĩa trong config.js
    }
} catch (e) {
    console.warn('Không tìm thấy file cấu hình, sử dụng cấu hình mặc định');
}

// Mapping kho
const WAREHOUSE_MAP = {
    165: 'BONAP/Stock',
    157: 'ORDAP/Stock',
    20: 'ORDHL/Stock',
    219: 'ORDHY/Stock',
    195: 'ORDST/Stock'
};

// Dữ liệu mẫu (dựa trên cấu trúc JSON được cung cấp)
const SAMPLE_DATA = [
    {
        id: 1,
        product_id: [1, 'Product A'],
        location_id: [157, 'ORDAP/Stock'],
        quantity: 100,
        available_quantity: 95,
        lot_id: [1, 'LOT001'],
        package_id: false,
        owner_id: false,
        product_categ_id: [1, 'Category 1']
    },
    {
        id: 2,
        product_id: [2, 'Product B'],
        location_id: [157, 'ORDAP/Stock'],
        quantity: 50,
        available_quantity: 50,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [1, 'Category 1']
    },
    {
        id: 3,
        product_id: [3, 'Product C'],
        location_id: [165, 'BONAP/Stock'],
        quantity: 200,
        available_quantity: 180,
        lot_id: [2, 'LOT002'],
        package_id: false,
        owner_id: false,
        product_categ_id: [2, 'Category 2']
    },
    {
        id: 4,
        product_id: [4, 'Product D'],
        location_id: [165, 'BONAP/Stock'],
        quantity: 75,
        available_quantity: 75,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [2, 'Category 2']
    },
    {
        id: 5,
        product_id: [5, 'Product E'],
        location_id: [20, 'ORDHL/Stock'],
        quantity: 30,
        available_quantity: 30,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [1, 'Category 1']
    }
];

// Xử lý định dạng dữ liệu Odoo
function processOdooData(data) {
    return data.map(item => ({
        id: item.id,
        product_id: Array.isArray(item.product_id) ? item.product_id : [item.product_id, ''],
        location_id: Array.isArray(item.location_id) ? item.location_id : [item.location_id, ''],
        quantity: item.quantity || 0,
        available_quantity: item.available_quantity || 0,
        lot_id: item.lot_id ? (Array.isArray(item.lot_id) ? item.lot_id : [item.lot_id, '']) : false,
        package_id: item.package_id || false,
        owner_id: item.owner_id || false,
        product_categ_id: item.product_categ_id ? (Array.isArray(item.product_categ_id) ? item.product_categ_id : [item.product_categ_id, '']) : [0, 'Chưa phân loại']
    }));
}

// Nhóm dữ liệu theo kho và danh mục
function groupDataByWarehouseAndCategory(data) {
    const grouped = {};
    
    data.forEach(item => {
        const locationId = item.location_id[0];
        const warehouseName = WAREHOUSE_MAP[locationId] || `Kho ${locationId}`;
        const categoryId = item.product_categ_id[0];
        const categoryName = item.product_categ_id[1] || 'Chưa phân loại';
        
        if (!grouped[warehouseName]) {
            grouped[warehouseName] = {
                locationId: locationId,
                categories: {}
            };
        }
        
        if (!grouped[warehouseName].categories[categoryName]) {
            grouped[warehouseName].categories[categoryName] = {
                categoryId: categoryId,
                products: []
            };
        }
        
        grouped[warehouseName].categories[categoryName].products.push(item);
    });
    
    return grouped;
}

// Tính toán thông tin thống kê
function calculateStats(groupedData) {
    let totalProducts = 0;
    let totalQuantity = 0;
    let totalWarehouses = Object.keys(groupedData).length;
    
    Object.values(groupedData).forEach(warehouse => {
        Object.values(warehouse.categories).forEach(category => {
            totalProducts += category.products.length;
            category.products.forEach(product => {
                totalQuantity += product.quantity;
            });
        });
    });
    
    return { totalProducts, totalQuantity, totalWarehouses };
}

// Render thông tin thống kê
function renderStats(stats) {
    const statsHtml = `
        <div class="stat-item">
            <span class="stat-value">${stats.totalWarehouses}</span>
            <span>Kho</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${stats.totalProducts}</span>
            <span>Sản phẩm</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${stats.totalQuantity.toLocaleString()}</span>
            <span>Tổng số lượng</span>
        </div>
    `;
    document.getElementById('statsSummary').innerHTML = statsHtml;
}

// Lọc và tìm kiếm dữ liệu
function filterAndSearchData(groupedData, searchTerm, warehouseFilter, categoryFilter) {
    if (!groupedData || Object.keys(groupedData).length === 0) {
        return {};
    }
    
    const filtered = {};
    const searchLower = (searchTerm || '').toLowerCase().trim();
    
    Object.keys(groupedData).forEach(warehouseName => {
        // Lọc kho
        if (warehouseFilter && warehouseName !== warehouseFilter) {
            return;
        }
        
        const warehouse = groupedData[warehouseName];
        const filteredCategories = {};
        
        Object.keys(warehouse.categories).forEach(categoryName => {
            // Lọc danh mục
            if (categoryFilter && categoryName !== categoryFilter) {
                return;
            }
            
            const category = warehouse.categories[categoryName];
            const filteredProducts = category.products.filter(product => {
                // Lọc tìm kiếm
                if (searchLower) {
                    const productName = (product.product_id[1] || '').toLowerCase();
                    const lotId = product.lot_id ? product.lot_id[1].toLowerCase() : '';
                    return productName.includes(searchLower) || lotId.includes(searchLower);
                }
                return true;
            });
            
            if (filteredProducts.length > 0) {
                filteredCategories[categoryName] = {
                    categoryId: category.categoryId,
                    products: filteredProducts
                };
            }
        });
        
        if (Object.keys(filteredCategories).length > 0) {
            filtered[warehouseName] = {
                locationId: warehouse.locationId,
                categories: filteredCategories
            };
        }
    });
    
    return filtered;
}

// Cập nhật tùy chọn bộ lọc
function updateFilterOptions(groupedData) {
    const warehouseSelect = document.getElementById('warehouseFilter');
    const categorySelect = document.getElementById('categoryFilter');
    
    // Xóa các tùy chọn hiện có (giữ lại tùy chọn "Tất cả")
    warehouseSelect.innerHTML = '<option value="">Tất cả kho</option>';
    categorySelect.innerHTML = '<option value="">Tất cả danh mục</option>';
    
    if (!groupedData || Object.keys(groupedData).length === 0) {
        return;
    }
    
    // Thêm tùy chọn kho
    const warehouses = Object.keys(groupedData).sort();
    warehouses.forEach(warehouseName => {
        const option = document.createElement('option');
        option.value = warehouseName;
        option.textContent = warehouseName;
        warehouseSelect.appendChild(option);
    });
    
    // Thu thập tất cả danh mục
    const categoriesSet = new Set();
    Object.values(groupedData).forEach(warehouse => {
        Object.keys(warehouse.categories).forEach(categoryName => {
            categoriesSet.add(categoryName);
        });
    });
    
    // Thêm tùy chọn danh mục
    const categories = Array.from(categoriesSet).sort();
    categories.forEach(categoryName => {
        const option = document.createElement('option');
        option.value = categoryName;
        option.textContent = categoryName;
        categorySelect.appendChild(option);
    });
}

// Render dữ liệu tồn kho
function renderStockData(groupedData, showEmptyMessage = true) {
    const container = document.getElementById('stockData');
    
    if (Object.keys(groupedData).length === 0) {
        if (showEmptyMessage) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h2>Chưa có dữ liệu</h2>
                    <p>${showEmptyMessage ? 'Vui lòng nhấn nút "Tải dữ liệu" để tải thông tin tồn kho' : 'Không tìm thấy dữ liệu phù hợp'}</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h2>Không tìm thấy dữ liệu phù hợp</h2>
                    <p>Vui lòng thử điều chỉnh điều kiện tìm kiếm hoặc bộ lọc</p>
                </div>
            `;
        }
        return;
    }
    
    let html = '';
    
    // Sắp xếp theo tên kho
    const sortedWarehouses = Object.keys(groupedData).sort();
    
    sortedWarehouses.forEach(warehouseName => {
        const warehouse = groupedData[warehouseName];
        
        // Tính tổng số lượng kho
        let warehouseTotal = 0;
        Object.values(warehouse.categories).forEach(category => {
            category.products.forEach(product => {
                warehouseTotal += product.quantity;
            });
        });
        
        html += `
            <div class="warehouse-section">
                <div class="warehouse-header">
                    <span>${warehouseName}</span>
                    <span class="warehouse-total">Tổng số lượng: ${warehouseTotal.toLocaleString()}</span>
                </div>
        `;
        
        // Sắp xếp theo tên danh mục
        const sortedCategories = Object.keys(warehouse.categories).sort();
        
        sortedCategories.forEach(categoryName => {
            const category = warehouse.categories[categoryName];
            
            // Tính tổng số lượng danh mục
            let categoryTotal = 0;
            category.products.forEach(product => {
                categoryTotal += product.quantity;
            });
            
            html += `
                <div class="category-section">
                    <div class="category-header">
                        <span>${categoryName}</span>
                        <span class="category-total">Số lượng: ${categoryTotal.toLocaleString()}</span>
                    </div>
                    <table class="products-table">
                        <thead>
                            <tr>
                                <th>Tên sản phẩm</th>
                                <th style="text-align: right;">Số lượng trong kho</th>
                                <th style="text-align: right;">Số lượng khả dụng</th>
                                <th>Số lô</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            // Sắp xếp theo tên sản phẩm
            category.products.sort((a, b) => {
                const nameA = a.product_id[1] || '';
                const nameB = b.product_id[1] || '';
                return nameA.localeCompare(nameB, 'vi-VN');
            });
            
            category.products.forEach(product => {
                const productName = product.product_id[1] || `ID sản phẩm: ${product.product_id[0]}`;
                const lotId = product.lot_id ? product.lot_id[1] : '-';
                
                html += `
                    <tr>
                        <td class="product-name">${productName}</td>
                        <td class="quantity-cell">${product.quantity.toLocaleString()}</td>
                        <td class="available-quantity-cell">${product.available_quantity.toLocaleString()}</td>
                        <td class="lot-id">${lotId}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

// Gọi Odoo API
async function callOdooAPI() {
    // Kiểm tra xem có sử dụng dữ liệu mẫu không (mặc định sử dụng dữ liệu mẫu)
    if (typeof ODOO_CONFIG === 'undefined' || ODOO_CONFIG.useSampleData !== false) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Mô phỏng độ trễ mạng
        return SAMPLE_DATA;
    }
    
    // Xây dựng yêu cầu API
    const requestBody = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                ODOO_CONFIG.database || 'bonario-vietnam',
                ODOO_CONFIG.userId || 208,
                ODOO_CONFIG.apiKey || '',
                ODOO_CONFIG.model || 'stock.quant',
                ODOO_CONFIG.method || 'search_read',
                [ODOO_CONFIG.domain || [
                    ['location_id', 'in', [165, 157, 20, 219, 195]],
                    ['quantity', '>', 0]
                ]],
                {
                    fields: ODOO_CONFIG.fields || [
                        'product_id',
                        'location_id',
                        'quantity',
                        'available_quantity',
                        'lot_id',
                        'package_id',
                        'owner_id',
                        'product_categ_id'
                    ],
                    order: ODOO_CONFIG.order || 'product_id asc',
                    limit: ODOO_CONFIG.limit || 100000
                }
            ]
        },
        id: 1
    };
    
    const response = await fetch(ODOO_CONFIG.apiEndpoint || 'http://your-odoo-server.com/web/dataset/call_kw', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
        throw new Error(result.error.message || 'Lỗi gọi API / API call failed');
    }
    
    return result.result || [];
}

// Lưu trữ dữ liệu hiện tại để xuất và lọc
let currentGroupedData = null;
let allProcessedData = null;

// Xuất dữ liệu thành CSV
function exportToCSV(groupedData) {
    let csv = 'Kho,Danh mục,Tên sản phẩm,Số lượng trong kho,Số lượng khả dụng,Số lô\n';
    
    Object.keys(groupedData).sort().forEach(warehouseName => {
        const warehouse = groupedData[warehouseName];
        
        Object.keys(warehouse.categories).sort().forEach(categoryName => {
            const category = warehouse.categories[categoryName];
            
            category.products.forEach(product => {
                const productName = product.product_id[1] || `ID sản phẩm: ${product.product_id[0]}`;
                const lotId = product.lot_id ? product.lot_id[1] : '-';
                
                csv += `"${warehouseName}","${categoryName}","${productName}",${product.quantity},${product.available_quantity},"${lotId}"\n`;
            });
        });
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Du_lieu_ton_kho_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Tải dữ liệu
async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const stockData = document.getElementById('stockData');
    
    loadingIndicator.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    stockData.innerHTML = '';
    
    try {
        const data = await callOdooAPI();
        
        if (!data || data.length === 0) {
            stockData.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h2>Chưa có dữ liệu</h2>
                    <p>Không tìm thấy bản ghi tồn kho phù hợp điều kiện</p>
                </div>
            `;
            currentGroupedData = null;
            return;
        }
        
        const processedData = processOdooData(data);
        allProcessedData = processedData; // Lưu dữ liệu gốc
        const groupedData = groupDataByWarehouseAndCategory(processedData);
        currentGroupedData = groupedData; // Lưu dữ liệu để xuất
        
        // Cập nhật tùy chọn bộ lọc
        updateFilterOptions(groupedData);
        
        // Áp dụng điều kiện lọc hiện tại
        const searchTerm = document.getElementById('searchInput').value;
        const warehouseFilter = document.getElementById('warehouseFilter').value;
        const categoryFilter = document.getElementById('categoryFilter').value;
        const filteredData = filterAndSearchData(groupedData, searchTerm, warehouseFilter, categoryFilter);
        
        const stats = calculateStats(filteredData);
        renderStats(stats);
        renderStockData(filteredData, false);
        
    } catch (error) {
        errorMessage.textContent = `Lỗi khi tải dữ liệu: ${error.message}`;
        errorMessage.classList.remove('hidden');
        console.error('Lỗi tải dữ liệu:', error);
        currentGroupedData = null;
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

// Áp dụng lọc và tìm kiếm
function applyFilters() {
    if (!currentGroupedData) {
        return;
    }
    
    const searchTerm = document.getElementById('searchInput').value;
    const warehouseFilter = document.getElementById('warehouseFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    const filteredData = filterAndSearchData(currentGroupedData, searchTerm, warehouseFilter, categoryFilter);
    const stats = calculateStats(filteredData);
    
    renderStats(stats);
    renderStockData(filteredData, false);
}

// Lắng nghe sự kiện
document.getElementById('loadDataBtn').addEventListener('click', loadData);
document.getElementById('exportBtn').addEventListener('click', () => {
    if (!currentGroupedData) {
        alert('Vui lòng tải dữ liệu trước');
        return;
    }
    exportToCSV(currentGroupedData);
});

// Xóa bộ lọc
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('warehouseFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    applyFilters();
}

// Lắng nghe sự kiện tìm kiếm và lọc
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('warehouseFilter').addEventListener('change', applyFilters);
document.getElementById('categoryFilter').addEventListener('change', applyFilters);
document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

// Tự động tải dữ liệu khi trang được tải
window.addEventListener('DOMContentLoaded', () => {
    loadData();
});
