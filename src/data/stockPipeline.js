import { WAREHOUSE_MAP } from '../store/modules/warehouse.js';

const HIDDEN_CATEGORIES = new Set(['BON', 'REM', 'PHUKIEN']);
const BONAP_VISIBLE_CATEGORY_ALLOWLIST = new Set([
  'BON / GDT / JP',
  'BON / GDT / LM',
  'BON / GDT / ROLL',
  'BON / GDT / MURALS - CLOTH',
  'BON / NVL / VAISOFA',
  'BON / REM / TPREM',
]);
const FABRIC_VISIBLE_CATEGORY_ALLOWLIST = new Set(['BON / NVL / VAISOFA']);

export const COMPANY_FILTERS = [
  {
    key: 'Bonario',
    label: 'Bonario',
    aliases: ['bonario'],
    categoryPrefixes: ['BON'],
    productPrefixes: ['BON-', '[BON-'],
    productTokens: ['BONARIO'],
  },
  {
    key: 'Ordinaire',
    label: 'Ordinaire',
    aliases: ['ordinaire'],
    categoryPrefixes: ['ORD'],
    productPrefixes: ['ORD-', '[ORD-'],
    productTokens: ['ORDINAIRE'],
  },
];
export const DEFAULT_COMPANY_FILTER = COMPANY_FILTERS[0].key;
const KNOWN_COMPANY_CATEGORY_PREFIXES = new Set(
  COMPANY_FILTERS.flatMap(company => company.categoryPrefixes || [])
);

export function normalizeCompanyName(companyName = '') {
  return String(companyName || '').trim();
}

export function getProductCompanyName(product = {}) {
  return normalizeCompanyName(
    product.product_company_name ||
      product.company_name ||
      (Array.isArray(product.company_id) ? product.company_id[1] : '')
  );
}

function getProductCategoryName(product = {}) {
  if (product.category_name) return product.category_name;
  if (Array.isArray(product.product_categ_id)) return product.product_categ_id[1] || '';
  return product.product_categ_id || '';
}

function getProductNameForCompanyMatch(product = {}) {
  if (product.product_name) return product.product_name;
  if (Array.isArray(product.product_id)) return product.product_id[1] || '';
  return product.product_id || '';
}

export function isAllowedCompanyKey(companyKey) {
  return COMPANY_FILTERS.some(company => company.key === companyKey);
}

export function productMatchesCompany(product, companyKey) {
  const company = COMPANY_FILTERS.find(item => item.key === companyKey);
  if (!company) return false;

  const categoryPrefix = normalizeCategoryName(getProductCategoryName(product)).split(' / ')[0];
  if (KNOWN_COMPANY_CATEGORY_PREFIXES.has(categoryPrefix)) {
    return (company.categoryPrefixes || []).includes(categoryPrefix);
  }

  const productName = String(getProductNameForCompanyMatch(product)).trim().toUpperCase();
  const productHasCompanyPrefix = (company.productPrefixes || []).some(prefix =>
    productName.startsWith(prefix)
  );
  const productHasCompanyToken = (company.productTokens || []).some(token =>
    productName.includes(token)
  );
  if (productHasCompanyPrefix || productHasCompanyToken) return true;

  const matchesOtherCompanyByProduct = COMPANY_FILTERS.filter(
    item => item.key !== company.key
  ).some(
    item =>
      (item.productPrefixes || []).some(prefix => productName.startsWith(prefix)) ||
      (item.productTokens || []).some(token => productName.includes(token))
  );
  if (matchesOtherCompanyByProduct) return false;

  const productCompanyName = getProductCompanyName(product).toLowerCase();
  if (!productCompanyName) return false;

  return company.aliases.some(alias => productCompanyName.includes(alias));
}

function normalizeCategoryName(categoryName = '') {
  return categoryName
    .split('/')
    .map(segment => segment.trim().toUpperCase())
    .join(' / ');
}

export function shouldHideCategory(categoryName = '', warehouseName = '') {
  const normalizedCategoryName = normalizeCategoryName(categoryName);

  // ACENB: không ẩn category (chỉ ẩn F-DACINCO ở bước group).
  // Toàn bộ tồn ACENB đang nằm ở BON / NVL / VAIREM — nếu áp HIDDEN_CATEGORIES
  // thì kho biến mất dù vẫn còn vải non-F-DACINCO.
  if (warehouseName === 'ACENB/Stock') {
    return false;
  }

  if (
    warehouseName === 'BONAP/Stock' &&
    BONAP_VISIBLE_CATEGORY_ALLOWLIST.has(normalizedCategoryName)
  ) {
    return false;
  }

  if (
    warehouseName === 'Kho Vải' &&
    FABRIC_VISIBLE_CATEGORY_ALLOWLIST.has(normalizedCategoryName)
  ) {
    return false;
  }

  return normalizedCategoryName.split(' / ').some(segment => HIDDEN_CATEGORIES.has(segment));
}

export function processOdooData(data) {
  return data.map(item => ({
    id: item.id,
    product_id: Array.isArray(item.product_id)
      ? item.product_id
      : [item.product_id, String(item.product_id ?? '')],
    location_id: Array.isArray(item.location_id)
      ? item.location_id
      : [item.location_id, String(item.location_id ?? '')],
    quantity: item.quantity || 0,
    available_quantity: item.available_quantity || 0,
    incoming_qty: 0,
    lot_id: item.lot_id ? (Array.isArray(item.lot_id) ? item.lot_id : [item.lot_id, '']) : false,
    package_id: item.package_id || false,
    owner_id: item.owner_id || false,
    product_categ_id: item.product_categ_id
      ? Array.isArray(item.product_categ_id)
        ? item.product_categ_id
        : [item.product_categ_id, '']
      : [0, 'Uncategorized'],
    uom_id: item.product_uom_id
      ? Array.isArray(item.product_uom_id)
        ? item.product_uom_id
        : [item.product_uom_id, '']
      : false,
    product_company_id: item.product_company_id || null,
    product_company_name: normalizeCompanyName(item.product_company_name),
  }));
}

export function processIncomingData(incomingData, onhandProcessed) {
  // incomingData is grouped by product_id and represents Incoming locations (location_dest_id = 8, 244)
  // We project these incoming quantities onto fabric warehouses (217, 324, 184, 325) by product_id

  const incomingByProduct = new Map();
  (incomingData || []).forEach(item => {
    const productId = Array.isArray(item.product_id) ? item.product_id[0] : item.product_id;
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
        product_company_id: item.product_company_id || null,
        product_company_name: normalizeCompanyName(item.product_company_name),
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

  (onhandProcessed || []).forEach(item => {
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
  onhandByFabric.forEach(item => {
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
      product_categ_id: item.product_categ_id || [0, 'Uncategorized'],
      uom_id: item.uom_id || false,
      product_company_id: item.product_company_id || null,
      product_company_name: getProductCompanyName(item),
    });
  });

  // 2) For products in MID incoming but not present in either fabric warehouse (onhand=0), create "Vải Incoming" records
  const VAI_INCOMING_LOCATION_ID = 'Incomming';
  const VAI_INCOMING_LOCATION_NAME = 'Kho Vải'; // Gộp vào Kho Vải

  incomingByProduct.forEach((incoming, productId) => {
    const existsInJak =
      onhandByFabric.has(`${productId}_217`) || onhandByFabric.has(`${productId}_324`);
    const existsInBonapVai =
      onhandByFabric.has(`${productId}_184`) || onhandByFabric.has(`${productId}_325`);

    if (existsInJak || existsInBonapVai) return;

    // Only include products whose name contains F-SF or F-ORD (backend already filters, but keep safe)
    const productName = Array.isArray(incoming.product_id) ? incoming.product_id[1] : '';
    if (!productName || (!productName.includes('F-SF') && !productName.includes('F-ORD'))) return;

    merged.push({
      id: `vai_incoming_${productId}`,
      product_id: Array.isArray(incoming.product_id)
        ? incoming.product_id
        : [productId, String(productId ?? '')],
      location_id: [VAI_INCOMING_LOCATION_ID, VAI_INCOMING_LOCATION_NAME],
      quantity: 0,
      available_quantity: 0,
      incoming_qty: incoming.incoming_qty || 0,
      incoming_date: incoming.incoming_date || null,
      lot_id: false,
      package_id: false,
      owner_id: false,
      product_categ_id: [0, 'Vải Incoming'],
      uom_id: incoming.uom_id || false,
      product_company_id: incoming.product_company_id || null,
      product_company_name: getProductCompanyName(incoming),
    });
  });

  return merged;
}

// Group data by warehouse, then by category, and merge products by product_id
export function groupDataByWarehouseAndCategory(data, discontinuedIds = new Set()) {
  const grouped = {};

  data.forEach(item => {
    const locationId = item.location_id[0];
    const warehouseName = WAREHOUSE_MAP[locationId] || `Kho ${locationId}`;
    const productId = item.product_id[0];
    const productName = item.product_id[1] || `Sản phẩm ID: ${productId}`;
    const categoryId = item.product_categ_id[0];
    const categoryName = item.product_categ_id[1] || 'Chưa phân loại';

    // Filter out "F-Khăn tay (Mẫu)" as requested by user
    if (productName.includes('F-Khăn tay (Mẫu)')) {
      return;
    }

    // ACENB: ẩn sản phẩm mã bắt đầu bằng F-DACINCO
    if (warehouseName === 'ACENB/Stock') {
      const nameUpper = productName.toUpperCase().trim();
      if (nameUpper.startsWith('F-DACINCO') || nameUpper.startsWith('[F-DACINCO')) {
        return;
      }
    }

    // Filter Kho Vải: chỉ hiển thị sản phẩm có chứa F-SF hoặc F-ORD trong tên
    if (
      warehouseName === 'Kho Vải' &&
      !productName.includes('F-SF') &&
      !productName.includes('F-ORD')
    ) {
      return;
    }

    if (shouldHideCategory(categoryName, warehouseName)) {
      return;
    }

    // Skip categories that start with "all" or "rev" (case-insensitive)
    const categoryLower = categoryName.toLowerCase();
    if (categoryLower.startsWith('all') || categoryLower.startsWith('rev')) {
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
    if (!grouped[warehouseName].categories[categoryName].products[productKey]) {
      grouped[warehouseName].categories[categoryName].products[productKey] = {
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
        product_company_id: item.product_company_id || null,
        product_company_name: getProductCompanyName(item),
        isDiscontinued: discontinuedIds.has(productId), // Sản phẩm ngưng sản xuất
      };
    }

    // Sum up quantities for the same product
    const product = grouped[warehouseName].categories[categoryName].products[productKey];
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
        !grouped[warehouseName].categories[categoryName].products[productKey].lot_ids.includes(
          lotName
        )
      ) {
        grouped[warehouseName].categories[categoryName].products[productKey].lot_ids.push(lotName);
      }
    }
  });

  return grouped;
}

// Filter and search data
export function filterAndSearchData(
  groupedData,
  searchTerm,
  warehouseFilter,
  categoryFilter,
  { discontinuedOnly = false, activeWarehouse = null } = {}
) {
  if (!groupedData || Object.keys(groupedData).length === 0) {
    return {};
  }

  const filtered = {};
  const searchLower = (searchTerm || '').toLowerCase().trim();

  // Always respect the active warehouse tab - search only within selected warehouse
  const effectiveWarehouseFilter = warehouseFilter || activeWarehouse;

  Object.keys(groupedData).forEach(warehouseName => {
    if (effectiveWarehouseFilter && warehouseName !== effectiveWarehouseFilter) {
      return;
    }

    const warehouse = groupedData[warehouseName];
    const filteredCategories = {};

    Object.keys(warehouse.categories || {}).forEach(categoryName => {
      if (categoryFilter && categoryName !== categoryFilter) {
        return;
      }

      const category = warehouse.categories[categoryName];
      const filteredProducts = {};

      Object.keys(category.products || {}).forEach(productKey => {
        const product = category.products[productKey];

        // Filter by search term
        if (searchLower) {
          const productName = (product.product_name || '').toLowerCase();
          const lotIds = product.lot_ids.join(' ').toLowerCase();
          if (!productName.includes(searchLower) && !lotIds.includes(searchLower)) {
            return;
          }
        }

        // Filter by discontinued status
        if (discontinuedOnly && !product.isDiscontinued) {
          return;
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

export function filterGroupedDataByCompany(groupedData, companyName) {
  const selectedCompany = normalizeCompanyName(companyName);
  const effectiveCompany = isAllowedCompanyKey(selectedCompany)
    ? selectedCompany
    : DEFAULT_COMPANY_FILTER;

  const filtered = {};

  Object.entries(groupedData || {}).forEach(([warehouseName, warehouse]) => {
    const filteredCategories = {};

    Object.entries(warehouse.categories || {}).forEach(([categoryName, category]) => {
      const filteredProducts = {};

      Object.entries(category.products || {}).forEach(([productKey, product]) => {
        if (productMatchesCompany(product, effectiveCompany)) {
          filteredProducts[productKey] = product;
        }
      });

      if (Object.keys(filteredProducts).length > 0) {
        filteredCategories[categoryName] = {
          ...category,
          products: filteredProducts,
        };
      }
    });

    if (Object.keys(filteredCategories).length > 0) {
      filtered[warehouseName] = {
        ...warehouse,
        categories: filteredCategories,
      };
    }
  });

  return filtered;
}

export function collectStocktakeProducts(groupedData, warehouseName) {
  if (!groupedData || !warehouseName || !groupedData[warehouseName]) return [];
  const warehouse = groupedData[warehouseName];
  const products = [];

  Object.entries(warehouse.categories || {}).forEach(([categoryName, category]) => {
    if (shouldHideCategory(categoryName, warehouseName)) {
      return;
    }
    Object.values(category.products || {}).forEach(product => {
      products.push({
        productId: product.product_id?.[0],
        name:
          product.product_name ||
          product.product_id?.[1] ||
          String(product.product_id?.[0] ?? ''),
        systemQty: Number(product.quantity || 0),
        availableQty: Number(product.available_quantity || 0),
        categoryName,
      });
    });
  });

  products.sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
  return products.filter(product => product.productId != null);
}

