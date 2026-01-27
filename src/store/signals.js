// ============================================
// SIGNALS - Reactive State Management
// ============================================

import { signal, computed, effect, batch } from '@preact/signals-core';

// ============================================
// CORE STATE SIGNALS
// ============================================

// Loading state
export const isLoading = signal(false);

// Grouped data by warehouse
export const groupedData = signal(null);

// All processed data (flat array)
export const allProcessedData = signal(null);

// Active warehouse tab
export const activeWarehouse = signal(() => {
    return localStorage.getItem('lastActiveTab') || 'all';
});

// Search query
export const searchQuery = signal('');

// Category filter
export const categoryFilter = signal('all');

// Sort configuration
export const sortConfig = signal({
    key: null,
    direction: 'asc'
});

// WebSocket connection status
export const wsConnected = signal(false);

// Cache statistics
export const cacheStats = signal({
    size: 0,
    hits: 0,
    misses: 0
});

// ============================================
// COMPUTED SIGNALS (Derived State)
// ============================================

// Available warehouses (from grouped data)
export const availableWarehouses = computed(() => {
    const data = groupedData.value;
    if (!data) return [];
    return Object.keys(data).sort();
});

// Current warehouse data (based on active tab)
export const currentWarehouseData = computed(() => {
    const data = groupedData.value;
    const warehouse = activeWarehouse.value;

    if (!data) return [];
    if (warehouse === 'all') return allProcessedData.value || [];

    return data[warehouse] || [];
});

// Filtered and searched data
export const filteredData = computed(() => {
    let data = currentWarehouseData.value;

    if (!data || data.length === 0) return [];

    // Apply search filter
    const query = searchQuery.value.toLowerCase();
    if (query) {
        data = data.filter(item => {
            const productName = (item.product_id?.[1] || '').toLowerCase();
            const categoryName = (item.product_categ_id?.[1] || '').toLowerCase();
            return productName.includes(query) || categoryName.includes(query);
        });
    }

    // Apply category filter
    const category = categoryFilter.value;
    if (category !== 'all') {
        data = data.filter(item => {
            const itemCategory = item.product_categ_id?.[1] || '';
            return itemCategory.includes(category);
        });
    }

    // Apply sorting
    const { key, direction } = sortConfig.value;
    if (key) {
        data = [...data].sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];

            // Handle array values (like product_id)
            if (Array.isArray(aVal)) aVal = aVal[1] || aVal[0];
            if (Array.isArray(bVal)) bVal = bVal[1] || bVal[0];

            // Handle numeric values
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Handle string values
            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();

            if (aStr < bStr) return direction === 'asc' ? -1 : 1;
            if (aStr > bStr) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return data;
});

// Data statistics
export const dataStats = computed(() => {
    const data = filteredData.value;

    if (!data || data.length === 0) {
        return {
            totalItems: 0,
            totalQuantity: 0,
            totalAvailable: 0,
            totalIncoming: 0
        };
    }

    return {
        totalItems: data.length,
        totalQuantity: data.reduce((sum, item) => sum + (item.quantity || 0), 0),
        totalAvailable: data.reduce((sum, item) => sum + (item.available_quantity || 0), 0),
        totalIncoming: data.reduce((sum, item) => sum + (item.incoming_qty || 0), 0)
    };
});

// Available categories (from current data)
export const availableCategories = computed(() => {
    const data = currentWarehouseData.value;
    if (!data || data.length === 0) return [];

    const categories = new Set();
    data.forEach(item => {
        const category = item.product_categ_id?.[1] || 'Uncategorized';
        categories.add(category);
    });

    return Array.from(categories).sort();
});

// ============================================
// SIGNAL ACTIONS (State Mutations)
// ============================================

export function setLoading(value) {
    isLoading.value = value;
}

export function setGroupedData(data) {
    groupedData.value = data;
}

export function setAllProcessedData(data) {
    allProcessedData.value = data;
}

export function setActiveWarehouse(warehouse) {
    activeWarehouse.value = warehouse;
    localStorage.setItem('lastActiveTab', warehouse);
}

export function setSearchQuery(query) {
    searchQuery.value = query;
}

export function setCategoryFilter(category) {
    categoryFilter.value = category;
}

export function setSortConfig(key) {
    const current = sortConfig.value;

    if (current.key === key) {
        // Toggle direction
        sortConfig.value = {
            key,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
    } else {
        // New sort key
        sortConfig.value = {
            key,
            direction: 'asc'
        };
    }
}

export function setWsConnected(connected) {
    wsConnected.value = connected;
}

export function setCacheStats(stats) {
    cacheStats.value = stats;
}

export function resetFilters() {
    batch(() => {
        searchQuery.value = '';
        categoryFilter.value = 'all';
        sortConfig.value = { key: null, direction: 'asc' };
    });
}

export function updateStockItem(updatedItem) {
    // Update item in both grouped and all data
    const all = allProcessedData.value;
    const grouped = groupedData.value;

    if (!all || !grouped) return;

    batch(() => {
        // Update in all data
        const allIndex = all.findIndex(item => item.id === updatedItem.id);
        if (allIndex !== -1) {
            const newAll = [...all];
            newAll[allIndex] = { ...newAll[allIndex], ...updatedItem };
            allProcessedData.value = newAll;
        }

        // Update in grouped data
        const newGrouped = { ...grouped };
        Object.keys(newGrouped).forEach(warehouse => {
            const index = newGrouped[warehouse].findIndex(item => item.id === updatedItem.id);
            if (index !== -1) {
                newGrouped[warehouse] = [...newGrouped[warehouse]];
                newGrouped[warehouse][index] = { ...newGrouped[warehouse][index], ...updatedItem };
            }
        });
        groupedData.value = newGrouped;
    });
}

// ============================================
// SIGNAL EFFECTS (Side Effects)
// ============================================

// Persist active warehouse to localStorage
effect(() => {
    const warehouse = activeWarehouse.value;
    localStorage.setItem('lastActiveTab', warehouse);
});

// Log data changes in development
if (import.meta.env.DEV) {
    effect(() => {
        const data = filteredData.value;
        console.log('[Signals] Filtered data updated:', data?.length || 0, 'items');
    });

    effect(() => {
        const stats = dataStats.value;
        console.log('[Signals] Stats updated:', stats);
    });
}
