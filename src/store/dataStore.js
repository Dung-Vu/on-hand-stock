// Warehouse mapping
const WAREHOUSE_MAP = {
    165: "BONAP/Stock",
    157: "ORDAP/Stock",
    261: "ORDAP/Stock", // Gộp ORDAP location 261 và 157
    20: "ORDHL/Stock",
    269: "ORDHL/Stock", // Gộp ORDHL location 269 và 20
    219: "ORDHY/Stock",
    277: "ORDHY/Stock", // Gộp ORDHY location 277 và 219
    195: "ORDST/Stock",
    285: "ORDST/Stock", // Gộp ORDST location 285 và 195
    217: "Kho Vải", // Kho JAK (217, 324)
    324: "Kho Vải", // Kho JAK
    184: "Kho Vải", // Vải stock BONAP (184, 325)
    325: "Kho Vải", // Vải stock BONAP
    8: "Kho Vải", // Incoming (8, 244)
    244: "Kho Vải", // Incoming
    "Incomming": "Kho Vải", // Gộp MID/Stock/Vải Incoming (legacy key)
};

// Warehouse groups for sorting
const PRODUCT_WAREHOUSES = [
    "BONAP/Stock",
    "ORDAP/Stock",
    "ORDHL/Stock",
    "ORDHY/Stock",
    "ORDST/Stock",
];

const FABRIC_WAREHOUSES = [
    "Kho Vải",
];

// Sort warehouses by groups: products first, then fabrics
function sortWarehouses(warehouses) {
    const productGroup = [];
    const fabricGroup = [];
    const otherGroup = [];

    warehouses.forEach((warehouse) => {
        if (PRODUCT_WAREHOUSES.includes(warehouse)) {
            productGroup.push(warehouse);
        } else if (FABRIC_WAREHOUSES.includes(warehouse)) {
            fabricGroup.push(warehouse);
        } else {
            otherGroup.push(warehouse);
        }
    });

    // Sort within each group
    productGroup.sort();
    fabricGroup.sort();
    otherGroup.sort();

    // Return grouped array with separator markers
    return {
        productGroup,
        fabricGroup,
        otherGroup,
        all: [...productGroup, ...fabricGroup, ...otherGroup],
    };
}

// Sample data
const SAMPLE_DATA = [
    {
        id: 1,
        product_id: [1, "Product A"],
        location_id: [157, "ORDAP/Stock"],
        quantity: 100,
        available_quantity: 95,
        lot_id: [1, "LOT001"],
        package_id: false,
        owner_id: false,
        product_categ_id: [1, "Category 1"],
    },
    {
        id: 2,
        product_id: [2, "Product B"],
        location_id: [157, "ORDAP/Stock"],
        quantity: 50,
        available_quantity: 50,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [1, "Category 1"],
    },
    {
        id: 3,
        product_id: [3, "Product C"],
        location_id: [165, "BONAP/Stock"],
        quantity: 200,
        available_quantity: 180,
        lot_id: [2, "LOT002"],
        package_id: false,
        owner_id: false,
        product_categ_id: [2, "Category 2"],
    },
    {
        id: 4,
        product_id: [4, "Product D"],
        location_id: [165, "BONAP/Stock"],
        quantity: 75,
        available_quantity: 75,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [2, "Category 2"],
    },
    {
        id: 5,
        product_id: [5, "Product E"],
        location_id: [20, "ORDHL/Stock"],
        quantity: 30,
        available_quantity: 30,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [1, "Category 1"],
    },
];

// Global state
let currentGroupedData = null;
let allProcessedData = null;
let isLoading = false;

// Process Odoo data format
function processOdooData(data) {
    return data.map((item) => ({
        id: item.id,
        product_id: Array.isArray(item.product_id)
            ? item.product_id
            : [item.product_id, String(item.product_id ?? "")],
        location_id: Array.isArray(item.location_id)
            ? item.location_id
            : [item.location_id, String(item.location_id ?? "")],
        quantity: item.quantity || 0,
        available_quantity: item.available_quantity || 0,
        incoming_qty: 0,
        lot_id: item.lot_id
            ? Array.isArray(item.lot_id)
                ? item.lot_id
                : [item.lot_id, ""]
            : false,
        package_id: item.package_id || false,
        owner_id: item.owner_id || false,
        product_categ_id: item.product_categ_id
            ? Array.isArray(item.product_categ_id)
                ? item.product_categ_id
                : [item.product_categ_id, ""]
            : [0, "Uncategorized"],
        uom_id: item.product_uom_id
            ? Array.isArray(item.product_uom_id)
                ? item.product_uom_id
                : [item.product_uom_id, ""]
            : false,
    }));
}

function processIncomingData(incomingData, onhandProcessed) {
    // incomingData is grouped by product_id and represents Incoming locations (location_dest_id = 8, 244)
    // We project these incoming quantities onto fabric warehouses (217, 324, 184, 325) by product_id

    const incomingByProduct = new Map();
    (incomingData || []).forEach((item) => {
        const productId = Array.isArray(item.product_id)
            ? item.product_id[0]
            : item.product_id;
        if (productId == null) return;

        const qty = item.incoming_qty || 0;
        const date = item.incoming_date || null;

        const existing = incomingByProduct.get(productId);

        // Logic xử lý incoming: chỉ lấy đợt đến gần nhất (ngày sớm nhất)
        // - Nếu chưa có: lưu lại
        // - Nếu ngày mới sớm hơn: thay thế bằng ngày/số lượng mới
        // - Nếu cùng ngày ETA: cộng dồn số lượng (giữ logic cộng dồn khi cùng ngày)
        // - Nếu ngày muộn hơn: bỏ qua (không dùng để hiển thị)
        if (!existing) {
            incomingByProduct.set(productId, {
                incoming_qty: qty,
                incoming_date: date,
                product_id: item.product_id,
                uom_id: item.product_uom || false,
            });
        } else if (date && existing.incoming_date) {
            // So sánh ngày (chỉ so sánh phần ngày, bỏ qua giờ)
            const existingDateOnly = new Date(existing.incoming_date).setHours(0, 0, 0, 0);
            const itemDateOnly = new Date(date).setHours(0, 0, 0, 0);

            if (itemDateOnly < existingDateOnly) {
                // Đợt mới sớm hơn -> thay thế
                existing.incoming_qty = qty;
                existing.incoming_date = date;
            } else if (itemDateOnly === existingDateOnly) {
                // Cùng ngày -> cộng dồn số lượng
            existing.incoming_qty += qty;
            }
            // Nếu muộn hơn thì bỏ qua (giữ lại đợt sớm nhất)
        } else if (date && !existing.incoming_date) {
            // Trước đó chưa có ngày, giờ có ngày -> dùng bản mới
            existing.incoming_qty = qty;
                existing.incoming_date = date;
        } else if (!date && existing.incoming_date) {
            // Item không có ngày nhưng existing có ngày -> bỏ qua item này
        } else if (!date && !existing.incoming_date) {
            // Cả hai đều không có ngày -> cộng dồn số lượng
            existing.incoming_qty += qty;
        }
    });

    // Build onhand index by product_id for the two fabric warehouses
    const fabricLocationIds = [217, 324, 184, 325];
    const onhandByFabric = new Map();

    (onhandProcessed || []).forEach((item) => {
        const productId = item.product_id?.[0];
        const locationId = item.location_id?.[0];
        if (productId == null || locationId == null) return;
        if (!fabricLocationIds.includes(locationId)) return;

        onhandByFabric.set(`${productId}_${locationId}`, item);
    });

    const merged = [];

    // Track which products have already been added to avoid duplicates
    const addedProducts = new Set();

    // 1) For products already shown in fabric warehouses (onhand > 0), create incoming-only records
    // IMPORTANT: Do NOT clone the onhand record here, otherwise quantity/available_quantity will be double-counted.
    // CHỈ THÊM MỘT RECORD INCOMING CHO MỖI PRODUCT_ID (đợt đến gần nhất đã được xử lý trong incomingByProduct)
    onhandByFabric.forEach((item) => {
        const productId = item.product_id[0];
        const incoming = incomingByProduct.get(productId);
        if (!incoming || addedProducts.has(productId)) return;

        // Đánh dấu đã thêm để tránh duplicate
        addedProducts.add(productId);

        merged.push({
            id: `vai_incoming_attach_${productId}_${item.location_id[0]}`,
            product_id: item.product_id,
            location_id: item.location_id,
            quantity: 0,
            available_quantity: 0,
            incoming_qty: incoming.incoming_qty || 0,
            incoming_date: incoming.incoming_date || null,
            lot_id: false,
            package_id: false,
            owner_id: false,
            product_categ_id: item.product_categ_id || [0, "Uncategorized"],
            uom_id: item.uom_id || false,
        });
    });

    // 2) For products in MID incoming but not present in either fabric warehouse (onhand=0), create "Vải Incoming" records
    const VAI_INCOMING_LOCATION_ID = "Incomming";
    const VAI_INCOMING_LOCATION_NAME = "Kho Vải"; // Gộp vào Kho Vải

    incomingByProduct.forEach((incoming, productId) => {
        const existsInJak = onhandByFabric.has(`${productId}_217`) || onhandByFabric.has(`${productId}_324`);
        const existsInBonapVai = onhandByFabric.has(`${productId}_184`) || onhandByFabric.has(`${productId}_325`);

        if (existsInJak || existsInBonapVai) return;

        // Only include products whose name contains F-SF (backend already filters, but keep safe)
        const productName = Array.isArray(incoming.product_id)
            ? incoming.product_id[1]
            : "";
        if (!productName || !productName.includes("F-SF")) return;

        merged.push({
            id: `vai_incoming_${productId}`,
            product_id: Array.isArray(incoming.product_id)
                ? incoming.product_id
                : [productId, String(productId ?? "")],
            location_id: [VAI_INCOMING_LOCATION_ID, VAI_INCOMING_LOCATION_NAME],
            quantity: 0,
            available_quantity: 0,
            incoming_qty: incoming.incoming_qty || 0,
            incoming_date: incoming.incoming_date || null,
            lot_id: false,
            package_id: false,
            owner_id: false,
            product_categ_id: [0, "Vải Incoming"],
            uom_id: incoming.uom_id || false,
        });
    });

    return merged;
}

// Group data by warehouse, then by category, and merge products by product_id
function groupDataByWarehouseAndCategory(data) {
    const grouped = {};

    data.forEach((item) => {
        const locationId = item.location_id[0];
        const warehouseName = WAREHOUSE_MAP[locationId] || `Kho ${locationId}`;
        const productId = item.product_id[0];
        const productName = item.product_id[1] || `Sản phẩm ID: ${productId}`;
        const categoryId = item.product_categ_id[0];
        const categoryName = item.product_categ_id[1] || "Chưa phân loại";

        // Filter Kho Vải: chỉ hiển thị sản phẩm có chứa F-SF trong tên
        if (warehouseName === "Kho Vải" && !productName.includes("F-SF")) {
            return;
        }

        // Skip categories that start with "all" or "rev" (case-insensitive)
        const categoryLower = categoryName.toLowerCase();
        if (
            categoryLower.startsWith("all") ||
            categoryLower.startsWith("rev")
        ) {
            return;
        }

        if (!grouped[warehouseName]) {
            grouped[warehouseName] = {
                locationId: locationId,
                categories: {},
            };
        }

        // Group by category
        if (!grouped[warehouseName].categories[categoryName]) {
            grouped[warehouseName].categories[categoryName] = {
                categoryId: categoryId,
                products: {},
            };
        }

        // Merge products by product_id - each product appears only once per category
        const productKey = `${productId}`;
        if (
            !grouped[warehouseName].categories[categoryName].products[
                productKey
            ]
        ) {
            grouped[warehouseName].categories[categoryName].products[
                productKey
            ] = {
                product_id: item.product_id,
                product_name: productName,
                category_id: categoryId,
                category_name: categoryName,
                quantity: 0,
                available_quantity: 0,
                incoming_qty: 0,
                incoming_date: null,
                lot_ids: [], // Collect all lot IDs
                uom_id: item.uom_id || false, // Unit of measure
            };
        }

        // Sum up quantities for the same product
        const product =
            grouped[warehouseName].categories[categoryName].products[productKey];
        product.quantity += item.quantity || 0;
        product.available_quantity += item.available_quantity || 0;

        // ĐANG ĐẾN: chỉ lấy số lượng của đợt có ETA gần nhất
        // Logic: cùng ngày thì cộng dồn, khác ngày thì chỉ lấy đợt sớm nhất
        if (item.incoming_qty && item.incoming_qty !== 0) {
            const itemDate = item.incoming_date || null;
            const existingDate = product.incoming_date || null;

            if (!itemDate) {
                // Nếu không có ngày đến thì bỏ qua để không làm sai lệch so với ETA hiển thị
            } else if (!existingDate) {
                // Chưa có ETA nào -> dùng bản hiện tại
                product.incoming_qty = item.incoming_qty;
                product.incoming_date = itemDate;
            } else {
                // So sánh ngày (chỉ so sánh phần ngày, bỏ qua giờ)
                const existingDateOnly = new Date(existingDate).setHours(0, 0, 0, 0);
                const itemDateOnly = new Date(itemDate).setHours(0, 0, 0, 0);

                if (itemDateOnly < existingDateOnly) {
                    // Đợt mới sớm hơn -> thay thế bằng ngày & số lượng mới
                    product.incoming_qty = item.incoming_qty;
                    product.incoming_date = itemDate;
                } else if (itemDateOnly === existingDateOnly) {
                    // Cùng ngày ETA -> cộng dồn số lượng
                    product.incoming_qty += item.incoming_qty;
                }
                // Nếu itemDate > existingDate thì bỏ qua, để giữ lại đợt sớm nhất
            }
        }


        // Collect lot IDs if exists
        if (item.lot_id && item.lot_id[1]) {
            const lotName = item.lot_id[1];
            if (
                !grouped[warehouseName].categories[categoryName].products[
                    productKey
                ].lot_ids.includes(lotName)
            ) {
                grouped[warehouseName].categories[categoryName].products[
                    productKey
                ].lot_ids.push(lotName);
            }
        }
    });

    return grouped;
}

// Filter and search data
function filterAndSearchData(
    groupedData,
    searchTerm,
    warehouseFilter,
    categoryFilter
) {
    if (!groupedData || Object.keys(groupedData).length === 0) {
        return {};
    }

    const filtered = {};
    const searchLower = (searchTerm || "").toLowerCase().trim();

    // Get active warehouse from tab (if available)
    const activeWarehouse =
        typeof window !== "undefined" && window.handleTabChange
            ? (() => {
                  const tabs = document.querySelectorAll("[data-warehouse]");
                  for (let tab of tabs) {
                      if (tab.classList.contains("tab-active")) {
                          return tab.getAttribute("data-warehouse");
                      }
                  }
                  return null;
              })()
            : null;

    // Use active warehouse if no explicit filter
    const effectiveWarehouseFilter = warehouseFilter || activeWarehouse;

    Object.keys(groupedData).forEach((warehouseName) => {
        if (
            effectiveWarehouseFilter &&
            warehouseName !== effectiveWarehouseFilter
        ) {
            return;
        }

        const warehouse = groupedData[warehouseName];
        const filteredCategories = {};

        Object.keys(warehouse.categories || {}).forEach((categoryName) => {
            if (categoryFilter && categoryName !== categoryFilter) {
                return;
            }

            const category = warehouse.categories[categoryName];
            const filteredProducts = {};

            Object.keys(category.products || {}).forEach((productKey) => {
                const product = category.products[productKey];

                // Filter by search term
                if (searchLower) {
                    const productName = (
                        product.product_name || ""
                    ).toLowerCase();
                    const lotIds = product.lot_ids.join(" ").toLowerCase();
                    if (
                        !productName.includes(searchLower) &&
                        !lotIds.includes(searchLower)
                    ) {
                        return;
                    }
                }

                filteredProducts[productKey] = product;
            });

            if (Object.keys(filteredProducts).length > 0) {
                filteredCategories[categoryName] = {
                    categoryId: category.categoryId,
                    products: filteredProducts,
                };
            }
        });

        if (Object.keys(filteredCategories).length > 0) {
            filtered[warehouseName] = {
                locationId: warehouse.locationId,
                categories: filteredCategories,
            };
        }
    });

    return filtered;
}

// Calculate statistics
function calculateStats(groupedData) {
    let totalProducts = 0;
    let totalQuantity = 0;
    let totalWarehouses = Object.keys(groupedData).length;

    Object.values(groupedData).forEach((warehouse) => {
        Object.values(warehouse.categories || {}).forEach((category) => {
            const productsList = Object.values(category.products || {});
            totalProducts += productsList.length;
            productsList.forEach((product) => {
                totalQuantity += product.quantity || 0;
            });
        });
    });

    return { totalProducts, totalQuantity, totalWarehouses };
}

// Call Backend API (which proxies to Odoo securely)
async function callOdooAPI() {
    // Check if using sample data
    const config = typeof window !== "undefined" ? window.ODOO_CONFIG : null;

    // If no config or useSampleData is true, use sample data
    if (
        !config ||
        config.useSampleData === true ||
        config.useSampleData === undefined
    ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return SAMPLE_DATA;
    }

    try {
        // Call backend API - credentials are handled server-side
        const response = await fetch(config.apiEndpoint, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `HTTP error! status: ${response.status} - ${errorText}`
            );
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "API call failed");
        }

        return result.data || [];
    } catch (error) {
        // If it's a network error, provide helpful message
        if (
            error.message.includes("Failed to fetch") ||
            error.message.includes("CORS") ||
            error.message.includes("NetworkError")
        ) {
            throw new Error(
                "Không thể kết nối đến server. Vui lòng kiểm tra backend đã chạy chưa (npm start trong folder server)."
            );
        }
        throw error;
    }
}

// Call Fabric Products API (which proxies to Odoo securely)
async function callFabricProductsAPI() {
    // Check if using sample data
    const config = typeof window !== "undefined" ? window.ODOO_CONFIG : null;

    // If no config or useSampleData is true, return empty array
    if (
        !config ||
        config.useSampleData === true ||
        config.useSampleData === undefined
    ) {
        return [];
    }

    try {
        // Construct fabric products API URL from stock API endpoint
        let fabricProductsUrl;
        if (config.apiEndpoint.includes('/api/stock')) {
            fabricProductsUrl = config.apiEndpoint.replace('/api/stock', '/api/fabric-products');
        } else {
            // Fallback: try to extract base URL
            const baseUrl = config.apiEndpoint.includes('/api/')
                ? config.apiEndpoint.split('/api/')[0]
                : config.apiEndpoint.split('/xmlrpc')[0] || 'http://localhost:4001';
            fabricProductsUrl = `${baseUrl}/api/fabric-products`;
        }

        const response = await fetch(fabricProductsUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `HTTP error! status: ${response.status} - ${errorText}`
            );
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "API call failed");
        }

        const fabricProducts = result.data || [];
        return fabricProducts;
    } catch (error) {
        // If it's a network error, just return empty array (fabric products is optional)
        if (
            error.message.includes("Failed to fetch") ||
            error.message.includes("CORS") ||
            error.message.includes("NetworkError")
        ) {
            console.warn("Could not fetch fabric products data:", error.message);
            return [];
        }
        console.warn("Error fetching fabric products data:", error.message);
        return [];
    }
}

// Call Incoming API (which proxies to Odoo securely)
async function callIncomingAPI() {
    // Check if using sample data
    const config = typeof window !== "undefined" ? window.ODOO_CONFIG : null;

    // If no config or useSampleData is true, return empty array
    if (
        !config ||
        config.useSampleData === true ||
        config.useSampleData === undefined
    ) {
        return [];
    }

    try {
        // Call incoming API endpoint
        const apiUrl = config.apiEndpoint.replace('/api/stock', '/api/incoming');
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `HTTP error! status: ${response.status} - ${errorText}`
            );
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "API call failed");
        }

        const incomingData = result.data || [];
        return incomingData;
    } catch (error) {
        // If it's a network error, just return empty array (incoming is optional)
        if (
            error.message.includes("Failed to fetch") ||
            error.message.includes("CORS") ||
            error.message.includes("NetworkError")
        ) {
            console.warn("Could not fetch incoming data:", error.message);
            return [];
        }
        console.warn("Error fetching incoming data:", error.message);
        return [];
    }
}

// Update filter options and tabs
export function updateFilterOptions(groupedData) {
    // Update tabs first
    if (typeof window !== "undefined" && window.updateTabs) {
        const warehouses = Object.keys(groupedData || {});
        const sortedWarehouses = sortWarehouses(warehouses);
        window.updateTabs(sortedWarehouses);
    }

    const categorySelect = document.getElementById("categoryFilter");

    if (!categorySelect) {
        return;
    }

    categorySelect.innerHTML = '<option value="">Tất cả nhóm sản phẩm</option>';

    if (!groupedData || Object.keys(groupedData).length === 0) {
        return;
    }

    // Determine active warehouse (from tabs)
    let warehousesToUse = [];
    if (typeof document !== "undefined") {
        const activeTab = document.querySelector(".tab-active[data-warehouse]");
        const activeName = activeTab
            ? activeTab.getAttribute("data-warehouse")
            : null;
        if (activeName && groupedData[activeName]) {
            warehousesToUse.push(groupedData[activeName]);
        }
    }
    // Fallback: use all warehouses
    if (warehousesToUse.length === 0) {
        warehousesToUse = Object.values(groupedData);
    }

    // Collect categories only from selected warehouses
    const categoriesSet = new Set();
    warehousesToUse.forEach((warehouse) => {
        Object.keys(warehouse.categories || {}).forEach((categoryName) => {
            categoriesSet.add(categoryName);
        });
    });

    const categories = Array.from(categoriesSet).sort();

    categories.forEach((categoryName) => {
        const option = document.createElement("option");
        option.value = categoryName;
        option.textContent = categoryName;
        categorySelect.appendChild(option);
    });
}

// Helper to refresh category filter based on currentGroupedData and active tab
export function refreshCategoryFilter() {
    if (!currentGroupedData) return;
    updateFilterOptions(currentGroupedData);
}

// Load data
export async function loadData() {
    const config = typeof window !== "undefined" ? window.ODOO_CONFIG : null;
    if (isLoading) return;

    isLoading = true;
    const stockDataContainer = document.getElementById("stockData");
    const loadingIndicator = createLoadingIndicator();

    if (stockDataContainer) {
        stockDataContainer.innerHTML = "";
        stockDataContainer.appendChild(loadingIndicator);
    }

    try {
        // Fetch onhand and incoming data in parallel
        const [onhandData, incomingData] = await Promise.all([
            callOdooAPI(),
            callIncomingAPI()
        ]);

        if (!onhandData || onhandData.length === 0) {
            if (stockDataContainer) {
                stockDataContainer.innerHTML = "";
                stockDataContainer.appendChild(
                    createEmptyState("Không tìm thấy bản ghi tồn kho phù hợp")
                );
            }
            return;
        }

        // Process onhand and incoming data separately
        const processedOnhand = processOdooData(onhandData);
        const processedIncoming = processIncomingData(incomingData, processedOnhand);

        // Combine both datasets
        const combinedData = [...processedOnhand, ...processedIncoming];

        // NOTE: Removed "Add missing fabric products" logic
        // Không hiển thị sản phẩm không có tồn kho và không có incoming

        allProcessedData = combinedData;

        const groupedData = groupDataByWarehouseAndCategory(combinedData);

        currentGroupedData = groupedData;

        updateFilterOptions(groupedData);
        applyFilters();
    } catch (error) {
        if (stockDataContainer) {
            stockDataContainer.innerHTML = "";
            stockDataContainer.appendChild(createErrorState(error.message));
        }
    } finally {
        isLoading = false;
    }
}

// Apply filters
export function applyFilters() {
    if (!currentGroupedData) {
        return;
    }

    const searchInput = document.getElementById("searchInput");
    const warehouseFilter = document.getElementById("warehouseFilter");
    const categoryFilter = document.getElementById("categoryFilter");

    const searchTerm = searchInput?.value || "";
    const warehouseValue = warehouseFilter?.value || "";
    const categoryValue = categoryFilter?.value || "";

    const filteredData = filterAndSearchData(
        currentGroupedData,
        searchTerm,
        warehouseValue,
        categoryValue
    );


    renderStockData(filteredData);
}

// Clear filters
export function clearFilters() {
    const searchInput = document.getElementById("searchInput");
    const warehouseFilter = document.getElementById("warehouseFilter");
    const categoryFilter = document.getElementById("categoryFilter");

    if (searchInput) searchInput.value = "";
    if (warehouseFilter) warehouseFilter.value = "";
    if (categoryFilter) categoryFilter.value = "";

    applyFilters();
}

// Export data
export function exportData() {
    if (!currentGroupedData) {
        alert("Vui lòng tải dữ liệu trước");
        return;
    }

    let csv = "Kho,Nhóm,Sản phẩm,Số lượng tồn,Số lượng khả dụng,Đang đến,Số lô\n";

    Object.keys(currentGroupedData)
        .sort()
        .forEach((warehouseName) => {
            const warehouse = currentGroupedData[warehouseName];

            Object.keys(warehouse.categories || {})
                .sort()
                .forEach((categoryName) => {
                    const category = warehouse.categories[categoryName];
                    const productsList = Object.values(category.products || {});

                    productsList.sort((a, b) => {
                        const nameA = (a.product_name || "").toLowerCase();
                        const nameB = (b.product_name || "").toLowerCase();
                        return nameA.localeCompare(nameB, "vi");
                    });

                    productsList.forEach((product) => {
                        const productName =
                            product.product_name ||
                            `Sản phẩm ID: ${product.product_id[0]}`;
                        const lotIds =
                            product.lot_ids && product.lot_ids.length > 0
                                ? product.lot_ids.join(", ")
                                : "-";

                        csv += `"${warehouseName}","${categoryName}","${productName}",${
                            product.quantity || 0
                        },${product.available_quantity || 0},${product.incoming_qty || 0},"${lotIds}"\n`;
                    });
                });
        });

    const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
        "download",
        `stock_data_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Render statistics
function renderStats(stats) {
    const statsSummary = document.getElementById("statsSummary");
    if (!statsSummary) return;

    statsSummary.innerHTML = `
        <div class="flex items-center gap-1.5">
            <span class="font-bold text-base" style="color: #2a231f;">${
                stats.totalProducts
            }</span>
            <span class="text-xs" style="color: #5d5044;">sản phẩm</span>
        </div>
        <div class="flex items-center gap-1.5">
            <span class="font-bold text-base" style="color: #2a231f;">${stats.totalQuantity.toLocaleString()}</span>
            <span class="text-xs" style="color: #5d5044;">tổng tồn</span>
        </div>
    `;
}

// Create loading indicator
function createLoadingIndicator() {
    const div = document.createElement("div");
    div.className = "flex flex-col items-center justify-center py-20";
    div.innerHTML = `
        <div class="relative">
            <div class="w-12 h-12 rounded-full animate-spin" style="border: 3px solid #d4c4b0; border-top-color: #8b6b4f;"></div>
        </div>
        <p class="mt-4 text-base" style="color: #5d5044;">Đang tải dữ liệu...</p>
    `;
    return div;
}

// Create empty state
function createEmptyState(message) {
    const div = document.createElement("div");
    div.className =
        "flex flex-col items-center justify-center py-20 text-center";
    div.innerHTML = `
        <div class="text-5xl mb-4">📭</div>
        <h2 class="text-xl font-semibold mb-2" style="color: #2a231f;">Không có dữ liệu</h2>
        <p style="color: #5d5044;">${message}</p>
    `;
    return div;
}

// Create error state
function createErrorState(message) {
    const div = document.createElement("div");
    div.className =
        "flex flex-col items-center justify-center py-20 text-center";
    div.innerHTML = `
        <div class="text-5xl mb-4">⚠️</div>
        <h2 class="text-xl font-semibold text-red-700 mb-2">Tải thất bại</h2>
        <p style="color: #5d5044;">${message}</p>
    `;
    return div;
}

// Helper function to determine stock status
function getStockStatus(quantity, availableQuantity) {
    if (quantity === 0) return "out";
    if (quantity <= 10 || availableQuantity < quantity * 0.3) return "low";
    return "in";
}

// Helper function to get stock status badge
function getStockBadge(status) {
    if (status === "out") {
        return '<span class="badge-out-stock">Hết hàng</span>';
    } else if (status === "low") {
        return '<span class="badge-low-stock">Sắp hết</span>';
    } else {
        return '<span class="badge-in-stock">Còn hàng</span>';
    }
}

// Render stock data - Card-based layout for sales team
function renderStockData(groupedData) {
    const container = document.getElementById("stockData");
    if (!container) return;

    if (Object.keys(groupedData).length === 0) {
        container.innerHTML = "";
        container.appendChild(
            createEmptyState("Không tìm thấy dữ liệu phù hợp")
        );
        return;
    }

    // Get active warehouse from tab
    let activeWarehouse = null;
    if (typeof document !== "undefined") {
        const activeTab = document.querySelector(".tab-active[data-warehouse]");
        if (activeTab) {
            activeWarehouse = activeTab.getAttribute("data-warehouse");
        } else {
            // Fallback: use first warehouse
            const sortedWarehouses = Object.keys(groupedData).sort();
            activeWarehouse = sortedWarehouses[0];
        }
    }

    // Only render active warehouse
    if (!activeWarehouse || !groupedData[activeWarehouse]) {
        container.innerHTML = "";
        container.appendChild(createEmptyState("Vui lòng chọn kho"));
        return;
    }

    const warehouse = groupedData[activeWarehouse];
    const hideIncomingWarehouses = new Set([
        "BONAP/Stock",
        "ORDAP/Stock",
        "ORDHL/Stock",
        "ORDHY/Stock",
        "ORDST/Stock",
    ]);
    const hideIncoming = hideIncomingWarehouses.has(activeWarehouse);

    // Collect all products across categories for card display
    const allProducts = [];
    Object.entries(warehouse.categories || {}).forEach(
        ([categoryName, category]) => {
            Object.values(category.products || {}).forEach((product) => {
                allProducts.push({
                    ...product,
                    categoryName: categoryName,
                });
            });
        }
    );

    // Sort products by quantity (descending) so high-stock items appear first
    allProducts.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));

    // Get unique categories for quick filter
    const categories = [
        ...new Set(allProducts.map((p) => p.categoryName)),
    ].sort();

    // Build HTML with card-based layout
    let html = `
        <div class="max-w-7xl mx-auto px-4 py-6">
            <!-- Quick Category Filter - HIDDEN ON MOBILE, use dropdown filter instead -->
            <div class="mb-6 animate-fade-in hidden md:block" id="quickFilterSection">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-semibold" style="color: #3f3630;">🏷️ Lọc nhanh theo nhóm:</span>
                </div>
                <div class="flex flex-wrap gap-2 transition-all duration-300" id="quickCategoryFilter">
                    <button class="category-filter-chip active" data-category="">
                        Tất cả (${allProducts.length})
                    </button>
                    ${categories
                        .map((cat) => {
                            const count = allProducts.filter(
                                (p) => p.categoryName === cat
                            ).length;
                            return `<button class="category-filter-chip" data-category="${cat}">
                            ${cat} (${count})
                        </button>`;
                        })
                        .join("")}
                </div>
            </div>

            <!-- Product cards grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch" id="productCardsGrid">
    `;

    allProducts.forEach((product, index) => {
        const productName =
            product.product_name || `Sản phẩm ID: ${product.product_id[0]}`;
        const lotIds = (product.lot_ids && product.lot_ids.length > 0)
                ? product.lot_ids
                    .map((l) => {
                        if (typeof l === "string") return l;
                        if (l && typeof l === "object") {
                            // Support {name: "LOT123"} shape
                            if (typeof l.name === "string") return l.name;
                            // Support [id, name] tuple shape
                            if (Array.isArray(l) && typeof l[1] === "string") return l[1];
                        }
                        return null;
                    })
                    .filter(Boolean)
                    .join(", ")
                : null;
        const status = getStockStatus(
            product.quantity,
            product.available_quantity
        );
        const badge = getStockBadge(status);
        const unit =
            product.uom_id && product.uom_id[1] ? product.uom_id[1] : "";


        html += `
            <div class="stock-card animate-slide-down flex flex-col" style="animation-delay: ${Math.min(
                index * 0.02,
                0.5
            )}s; height: 100%;">
                <div class="flex items-start justify-between mb-4" style="min-height: 70px;">
                    <div class="flex-1 pr-2">
                        <h3 class="text-sm font-semibold mb-1 line-clamp-2" style="color: #2a231f; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${productName}
                        </h3>
                        <span class="category-badge">${
                            product.categoryName
                        }</span>
                    </div>
                    ${badge}
                </div>

                <div class="grid ${hideIncoming ? "grid-cols-2" : "grid-cols-3"} gap-2 mt-auto pt-4" style="border-top: 1px solid #e8ddd4;">
                    <div class="text-center p-2.5 rounded-lg flex flex-col justify-center" style="background-color: #faf8f5; min-height: 90px;">
                        <p class="quantity-label mb-1.5">Tồn kho</p>
                        <p class="quantity-display mb-1">${(
                            product.quantity || 0
                        ).toLocaleString()}</p>
                        ${
                            unit
                                ? `<p class="text-xs" style="color: #8b7355; margin-top: auto;">${unit}</p>`
                                : `<div style="height: 16px;"></div>`
                        }
                    </div>
                    <div class="text-center p-2.5 rounded-lg flex flex-col justify-center" style="background-color: ${
                        status === "low" ? "#fff8e6" : "#f5f9f5"
                    }; min-height: 90px;">
                        <p class="quantity-label mb-1.5">Khả dụng</p>
                        <p class="quantity-display mb-1" style="color: ${
                            status === "low" ? "#856404" : "#2a231f"
                        };">${(
            product.available_quantity || 0
        ).toLocaleString()}</p>
                        ${
                            unit
                                ? `<p class="text-xs" style="color: #8b7355; margin-top: auto;">${unit}</p>`
                                : `<div style="height: 16px;"></div>`
                        }
                    </div>
                    ${
                        hideIncoming
                            ? ""
                            : `<div class="text-center p-2.5 rounded-lg flex flex-col justify-center" style="background-color: #e8f4f8; min-height: 90px;">
                        <p class="quantity-label mb-1.5">Đang đến</p>
                        <p class="quantity-display mb-1" style="color: #0066cc;">
                            ${(Number.isFinite(product.incoming_qty) ? product.incoming_qty : Number(product.incoming_qty) || 0).toLocaleString()}
                        </p>
                        <div class="flex flex-col" style="margin-top: auto;">
                        ${
                            product.incoming_date
                                ? `<p class="text-[10px] mb-1" style="color: #4b83a6;">ETA: ${new Date(product.incoming_date).toLocaleDateString('vi-VN')}</p>`
                                : `<div style="height: 12px;"></div>`
                        }
                        ${
                            unit
                                ? `<p class="text-xs" style="color: #8b7355;">${unit}</p>`
                                : `<div style="height: 16px;"></div>`
                        }
                        </div>
                    </div>`
                    }
                </div>

                ${
                    lotIds
                        ? `
                <div class="mt-3 pt-3" style="border-top: 1px solid #f5f1ea;">
                    <p class="text-xs" style="color: #7d6d5a;">
                        <strong>Số lô:</strong> ${lotIds}
                    </p>
                </div>
                `
                        : ""
                }
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Add event listeners for quick category filter (desktop only)
    const filterChips = document.querySelectorAll(".category-filter-chip");
    filterChips.forEach((chip) => {
        chip.addEventListener("click", () => {
            const selectedCategory = chip.getAttribute("data-category");

            // Update active state
            filterChips.forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");

            // Filter products
            const productCards = document.querySelectorAll(
                "#productCardsGrid .stock-card"
            );
            productCards.forEach((card) => {
                const categoryBadge = card.querySelector(".category-badge");
                if (
                    !selectedCategory ||
                    categoryBadge.textContent === selectedCategory
                ) {
                    card.style.display = "";
                } else {
                    card.style.display = "none";
                }
            });
        });
    });
}

// Toggle category expand/collapse
function toggleCategory(categoryId) {
    const content = document.getElementById(`${categoryId}-content`);
    const icon = document.getElementById(`${categoryId}-icon`);

    if (!content || !icon) return;

    const isHidden = content.style.display === "none";

    if (isHidden) {
        // Expand
        content.style.display = "";
        icon.style.transform = "rotate(0deg)";
    } else {
        // Collapse
        content.style.display = "none";
        icon.style.transform = "rotate(90deg)";
    }
}

// Initialize categories - all expanded by default
function initializeCategories() {
    const categoryContents = document.querySelectorAll('[id$="-content"]');
    categoryContents.forEach((content) => {
        content.style.display = "";
    });

    const categoryIcons = document.querySelectorAll('[id$="-icon"]');
    categoryIcons.forEach((icon) => {
        icon.style.transform = "rotate(0deg)";
        icon.style.transition = "transform 0.2s ease";
    });
}

// Make toggleCategory available globally
window.toggleCategory = toggleCategory;

// Removed toggleCategory functions as we no longer use collapsible categories

// Listen for filter change events
document.addEventListener("filterChange", applyFilters);
