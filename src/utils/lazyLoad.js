// ============================================
// LAZY LOADING - Per-warehouse data fetching
// ============================================

import { fetchStock, fetchIncoming } from '../services/api.js';
import { showToast } from '../store/dataStore.js';

// ============================================
// LAZY LOADING STATE
// ============================================

// Track which warehouses have been loaded
const loadedWarehouses = new Set();

// Cache for each warehouse's data
const warehouseDataCache = new Map();

// Loading state per warehouse
const loadingStates = new Map();

/**
 * Check if warehouse has been loaded
 * @param {string} warehouse - Warehouse name
 * @returns {boolean}
 */
export function isWarehouseLoaded(warehouse) {
    return loadedWarehouses.has(warehouse);
}

/**
 * Check if warehouse is currently loading
 * @param {string} warehouse - Warehouse name
 * @returns {boolean}
 */
export function isWarehouseLoading(warehouse) {
    return loadingStates.get(warehouse) === true;
}

/**
 * Get cached data for warehouse
 * @param {string} warehouse - Warehouse name
 * @returns {Object|null}
 */
export function getWarehouseCache(warehouse) {
    const cached = warehouseDataCache.get(warehouse);
    if (!cached) return null;

    // Check if cache is still fresh (5 minutes)
    const now = Date.now();
    if (now - cached.timestamp > 5 * 60 * 1000) {
        // Cache expired
        warehouseDataCache.delete(warehouse);
        return null;
    }

    return cached.data;
}

/**
 * Set cache for warehouse
 * @param {string} warehouse - Warehouse name
 * @param {Object} data - Data to cache
 */
export function setWarehouseCache(warehouse, data) {
    warehouseDataCache.set(warehouse, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Lazy load data for specific warehouse
 * @param {string} warehouse - Warehouse name ('all' for all data)
 * @param {Object} locationMap - Map of warehouse names to location IDs
 * @returns {Promise<Object>}
 */
export async function lazyLoadWarehouse(warehouse, locationMap) {
    // Check if already loading
    if (isWarehouseLoading(warehouse)) {
        console.log(`[LazyLoad] ${warehouse} is already loading, skipping...`);
        return getWarehouseCache(warehouse);
    }

    // Check cache first
    const cached = getWarehouseCache(warehouse);
    if (cached) {
        console.log(`[LazyLoad] Using cached data for ${warehouse}`);
        return cached;
    }

    // Mark as loading
    loadingStates.set(warehouse, true);

    try {
        console.log(`[LazyLoad] Loading data for ${warehouse}...`);

        let stockData, incomingData;

        if (warehouse === 'all') {
            // Load all data
            [stockData, incomingData] = await Promise.all([
                fetchStock({ useCache: true }),
                fetchIncoming({ useCache: true })
            ]);
        } else {
            // Find location IDs for this warehouse
            const locationIds = [];
            Object.entries(locationMap).forEach(([locId, warehouseName]) => {
                if (warehouseName === warehouse) {
                    locationIds.push(parseInt(locId));
                }
            });

            if (locationIds.length === 0) {
                throw new Error(`No location IDs found for warehouse: ${warehouse}`);
            }

            // Fetch data for specific warehouse
            const locationIdsParam = locationIds.join(',');

            [stockData, incomingData] = await Promise.all([
                fetchStock({ useCache: true, locationIds: locationIdsParam }),
                fetchIncoming({ useCache: true, locationIds: locationIdsParam })
            ]);
        }

        const data = {
            stock: stockData || [],
            incoming: incomingData || []
        };

        // Cache the data
        setWarehouseCache(warehouse, data);

        // Mark as loaded
        loadedWarehouses.add(warehouse);

        console.log(`[LazyLoad] Loaded ${warehouse}: ${data.stock.length} stock items, ${data.incoming.length} incoming items`);

        return data;
    } catch (error) {
        console.error(`[LazyLoad] Error loading ${warehouse}:`, error);
        showToast(`❌ Không thể tải dữ liệu ${warehouse}`, 'error');
        throw error;
    } finally {
        // Clear loading state
        loadingStates.set(warehouse, false);
    }
}

/**
 * Preload multiple warehouses in background
 * @param {Array<string>} warehouses - Array of warehouse names
 * @param {Object} locationMap - Map of warehouse names to location IDs
 */
export async function preloadWarehouses(warehouses, locationMap) {
    console.log(`[LazyLoad] Preloading ${warehouses.length} warehouses in background...`);

    // Load warehouses one by one to avoid overwhelming the server
    for (const warehouse of warehouses) {
        if (!isWarehouseLoaded(warehouse) && !isWarehouseLoading(warehouse)) {
            try {
                await lazyLoadWarehouse(warehouse, locationMap);
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`[LazyLoad] Failed to preload ${warehouse}:`, error.message);
            }
        }
    }

    console.log('[LazyLoad] Preload complete');
}

/**
 * Clear all warehouse caches
 */
export function clearWarehouseCaches() {
    warehouseDataCache.clear();
    loadedWarehouses.clear();
    loadingStates.clear();
    console.log('[LazyLoad] All warehouse caches cleared');
}

/**
 * Clear cache for specific warehouse
 * @param {string} warehouse - Warehouse name
 */
export function clearWarehouseCache(warehouse) {
    warehouseDataCache.delete(warehouse);
    loadedWarehouses.delete(warehouse);
    loadingStates.delete(warehouse);
    console.log(`[LazyLoad] Cache cleared for ${warehouse}`);
}

/**
 * Get loading statistics
 * @returns {Object}
 */
export function getLoadingStats() {
    return {
        loadedCount: loadedWarehouses.size,
        loadedWarehouses: Array.from(loadedWarehouses),
        cachedCount: warehouseDataCache.size,
        loadingCount: Array.from(loadingStates.values()).filter(v => v === true).length
    };
}

/**
 * Invalidate cache for warehouse (mark for reload)
 * @param {string} warehouse - Warehouse name
 */
export function invalidateWarehouse(warehouse) {
    if (warehouse === 'all') {
        clearWarehouseCaches();
    } else {
        clearWarehouseCache(warehouse);
    }
    console.log(`[LazyLoad] Invalidated cache for ${warehouse}`);
}

// Export for debugging
if (import.meta.env.DEV) {
    window._lazyLoadDebug = {
        getStats: getLoadingStats,
        getCache: (warehouse) => getWarehouseCache(warehouse),
        clearCache: clearWarehouseCaches,
        loadedWarehouses: () => Array.from(loadedWarehouses),
        warehouseDataCache: () => Array.from(warehouseDataCache.keys())
    };
}
