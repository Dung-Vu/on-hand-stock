// ============================================
// WAREHOUSE MODULE - Warehouse Configuration & Mapping
// ============================================

import { signal, computed } from '@preact/signals-core';

// ============================================
// WAREHOUSE CONFIGURATION
// ============================================

// Warehouse mapping
export const WAREHOUSE_MAP = {
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
export const PRODUCT_WAREHOUSES = [
    "BONAP/Stock",
    "ORDAP/Stock",
    "ORDHL/Stock",
    "ORDHY/Stock",
    "ORDST/Stock",
];

export const FABRIC_WAREHOUSES = [
    "Kho Vải",
];

// ============================================
// WAREHOUSE STATE
// ============================================

// Loaded warehouses tracking (for lazy loading)
export const loadedWarehouses = signal(new Set());

// Active warehouse
export const activeWarehouse = signal(() => {
    return localStorage.getItem('lastActiveTab') || 'all';
});

// ============================================
// WAREHOUSE HELPERS
// ============================================

// Sort warehouses by groups: products first, then fabrics
export function sortWarehouses(warehouses) {
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

// Mark warehouse as loaded
export function markWarehouseLoaded(warehouse) {
    const current = loadedWarehouses.value;
    const newSet = new Set(current);
    newSet.add(warehouse);
    loadedWarehouses.value = newSet;
}

// Check if warehouse is loaded
export function isWarehouseLoaded(warehouse) {
    return loadedWarehouses.value.has(warehouse);
}

// Clear loaded warehouses
export function clearLoadedWarehouses() {
    loadedWarehouses.value = new Set();
}

// Set active warehouse
export function setActiveWarehouse(warehouse) {
    activeWarehouse.value = warehouse;
    localStorage.setItem('lastActiveTab', warehouse);
}

// ============================================
// COMPUTED WAREHOUSE DATA
// ============================================

// Get warehouse display name
export function getWarehouseName(locationId) {
    return WAREHOUSE_MAP[locationId] || `Location ${locationId}`;
}

// Check if location is a product warehouse
export function isProductWarehouse(warehouse) {
    return PRODUCT_WAREHOUSES.includes(warehouse);
}

// Check if location is a fabric warehouse
export function isFabricWarehouse(warehouse) {
    return FABRIC_WAREHOUSES.includes(warehouse);
}

// Get warehouse type
export function getWarehouseType(warehouse) {
    if (isProductWarehouse(warehouse)) return 'product';
    if (isFabricWarehouse(warehouse)) return 'fabric';
    return 'other';
}
