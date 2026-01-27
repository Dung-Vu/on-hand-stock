// ============================================
// FILTER MODULE - Search & Filter State Management
// ============================================

import { signal, computed, batch } from '@preact/signals-core';

// ============================================
// FILTER STATE
// ============================================

// Search query
export const searchQuery = signal('');

// Category filter
export const categoryFilter = signal('all');

// Sort configuration
export const sortConfig = signal({
    key: null,
    direction: 'asc'
});

// Show zero stock items
export const showZeroStock = signal(true);

// Show archived products
export const showArchived = signal(false);

// Date range filter (for incoming)
export const dateRange = signal({
    start: null,
    end: null
});

// ============================================
// FILTER ACTIONS
// ============================================

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

export function setShowZeroStock(show) {
    showZeroStock.value = show;
}

export function setShowArchived(show) {
    showArchived.value = show;
}

export function setDateRange(start, end) {
    dateRange.value = { start, end };
}

export function resetFilters() {
    batch(() => {
        searchQuery.value = '';
        categoryFilter.value = 'all';
        sortConfig.value = { key: null, direction: 'asc' };
        showZeroStock.value = true;
        showArchived.value = false;
        dateRange.value = { start: null, end: null };
    });
}

// ============================================
// FILTER UTILITIES
// ============================================

// Apply search filter to data
export function applySearchFilter(data, query) {
    if (!query || query.trim() === '') return data;

    const lowerQuery = query.toLowerCase();

    return data.filter(item => {
        const productName = (item.product_id?.[1] || '').toLowerCase();
        const categoryName = (item.product_categ_id?.[1] || '').toLowerCase();
        const lotName = item.lot_id ? (item.lot_id[1] || '').toLowerCase() : '';

        return productName.includes(lowerQuery) ||
               categoryName.includes(lowerQuery) ||
               lotName.includes(lowerQuery);
    });
}

// Apply category filter to data
export function applyCategoryFilter(data, category) {
    if (category === 'all') return data;

    return data.filter(item => {
        const itemCategory = item.product_categ_id?.[1] || '';
        return itemCategory.includes(category);
    });
}

// Apply stock visibility filter
export function applyStockFilter(data, showZero) {
    if (showZero) return data;

    return data.filter(item => {
        return (item.quantity || 0) > 0 || (item.incoming_qty || 0) > 0;
    });
}

// Apply sorting to data
export function applySorting(data, sortConf) {
    const { key, direction } = sortConf;

    if (!key) return data;

    return [...data].sort((a, b) => {
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

// Apply all filters
export function applyAllFilters(data, filters) {
    const { search, category, sort, showZero } = filters;

    let filtered = data;

    // Apply search
    if (search) {
        filtered = applySearchFilter(filtered, search);
    }

    // Apply category
    if (category && category !== 'all') {
        filtered = applyCategoryFilter(filtered, category);
    }

    // Apply stock visibility
    if (!showZero) {
        filtered = applyStockFilter(filtered, false);
    }

    // Apply sorting
    if (sort && sort.key) {
        filtered = applySorting(filtered, sort);
    }

    return filtered;
}

// ============================================
// COMPUTED FILTER STATE
// ============================================

// Check if any filter is active
export const hasActiveFilters = computed(() => {
    return searchQuery.value !== '' ||
           categoryFilter.value !== 'all' ||
           sortConfig.value.key !== null ||
           !showZeroStock.value ||
           showArchived.value ||
           dateRange.value.start !== null ||
           dateRange.value.end !== null;
});

// Get active filter count
export const activeFilterCount = computed(() => {
    let count = 0;

    if (searchQuery.value !== '') count++;
    if (categoryFilter.value !== 'all') count++;
    if (sortConfig.value.key !== null) count++;
    if (!showZeroStock.value) count++;
    if (showArchived.value) count++;
    if (dateRange.value.start !== null || dateRange.value.end !== null) count++;

    return count;
});

// Get filter summary text
export const filterSummary = computed(() => {
    const filters = [];

    if (searchQuery.value) {
        filters.push(`Search: "${searchQuery.value}"`);
    }

    if (categoryFilter.value !== 'all') {
        filters.push(`Category: ${categoryFilter.value}`);
    }

    if (sortConfig.value.key) {
        const { key, direction } = sortConfig.value;
        filters.push(`Sort: ${key} (${direction})`);
    }

    if (!showZeroStock.value) {
        filters.push('Hide zero stock');
    }

    if (showArchived.value) {
        filters.push('Show archived');
    }

    return filters.join(' | ');
});
