// ============================================
// WAREHOUSE MODULE - Warehouse Configuration & Mapping
// ============================================

export const WAREHOUSE_MAP = {
  165: 'BONAP/Stock',
  328: 'O-BAP/Stock',
  173: 'ACENB/Stock', // Kho ACENB (Bonario)
  157: 'ORDAP/Stock',
  261: 'ORDAP/Stock', // Gộp ORDAP location 261 và 157
  20: 'ORDHL/Stock',
  269: 'ORDHL/Stock', // Gộp ORDHL location 269 và 20
  219: 'ORDHY/Stock',
  277: 'ORDHY/Stock', // Gộp ORDHY location 277 và 219
  195: 'ORDST/Stock',
  285: 'ORDST/Stock', // Gộp ORDST location 285 và 195
  217: 'Kho Vải', // Kho JAK (217, 324)
  324: 'Kho Vải', // Kho JAK
  184: 'Kho Vải', // Vải stock BONAP (184, 325)
  325: 'Kho Vải', // Vải stock BONAP
  8: 'Kho Vải', // Incoming (8, 244)
  244: 'Kho Vải', // Incoming
  Incomming: 'Kho Vải', // Gộp MID/Stock/Vải Incoming (legacy key)
};

export const PRODUCT_WAREHOUSES = [
  'BONAP/Stock',
  'O-BAP/Stock',
  'ACENB/Stock',
  'ORDAP/Stock',
  'ORDHL/Stock',
  'ORDHY/Stock',
  'ORDST/Stock',
];

export const FABRIC_WAREHOUSES = ['Kho Vải'];

export function sortWarehouses(warehouses) {
  const productGroup = [];
  const fabricGroup = [];
  const otherGroup = [];

  warehouses.forEach(warehouse => {
    if (PRODUCT_WAREHOUSES.includes(warehouse)) {
      productGroup.push(warehouse);
    } else if (FABRIC_WAREHOUSES.includes(warehouse)) {
      fabricGroup.push(warehouse);
    } else {
      otherGroup.push(warehouse);
    }
  });

  productGroup.sort();
  fabricGroup.sort();
  otherGroup.sort();

  return {
    productGroup,
    fabricGroup,
    otherGroup,
    all: [...productGroup, ...fabricGroup, ...otherGroup],
  };
}

/**
 * Synchronize Kho ARTE and Kho Gimmersta across warehouse groups and available list.
 * Adds 'Kho ARTE' and 'Kho Gimmersta' to both display group (otherGroup) and available set (all) for 'Bonario'.
 * Keeps supplier warehouses absent from all groups for 'Ordinaire' or other companies.
 * Guarantees no duplicates.
 */
export function syncArteWarehouse(warehouses, selectedCompany = 'Bonario') {
  const isBonario = selectedCompany === 'Bonario';

  if (Array.isArray(warehouses)) {
    const list = warehouses.filter(w => w !== 'Kho ARTE' && w !== 'Kho Gimmersta');
    if (isBonario) {
      list.push('Kho ARTE', 'Kho Gimmersta');
    }
    return list;
  }

  if (warehouses && typeof warehouses === 'object') {
    const isPhysicalWarehouse = w => w !== 'Kho ARTE' && w !== 'Kho Gimmersta';
    const productGroup = (warehouses.productGroup || []).filter(isPhysicalWarehouse);
    const fabricGroup = (warehouses.fabricGroup || []).filter(isPhysicalWarehouse);
    const otherGroup = (warehouses.otherGroup || []).filter(isPhysicalWarehouse);
    const all = Array.isArray(warehouses.all)
      ? warehouses.all.filter(isPhysicalWarehouse)
      : [...productGroup, ...fabricGroup, ...otherGroup];

    if (isBonario) {
      if (!otherGroup.includes('Kho ARTE')) {
        otherGroup.push('Kho ARTE');
      }
      if (!all.includes('Kho ARTE')) {
        all.push('Kho ARTE');
      }
      if (!otherGroup.includes('Kho Gimmersta')) {
        otherGroup.push('Kho Gimmersta');
      }
      if (!all.includes('Kho Gimmersta')) {
        all.push('Kho Gimmersta');
      }
    }

    return {
      ...warehouses,
      productGroup,
      fabricGroup,
      otherGroup,
      all,
    };
  }

  return warehouses;
}

export function getWarehouseName(locationId) {
  return WAREHOUSE_MAP[locationId] || `Location ${locationId}`;
}

export function isProductWarehouse(warehouse) {
  return PRODUCT_WAREHOUSES.includes(warehouse);
}

export function isFabricWarehouse(warehouse) {
  return FABRIC_WAREHOUSES.includes(warehouse);
}

export function getWarehouseType(warehouse) {
  if (isProductWarehouse(warehouse)) return 'product';
  if (isFabricWarehouse(warehouse)) return 'fabric';
  return 'other';
}
