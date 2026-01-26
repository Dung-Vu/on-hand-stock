// ============================================
// API SERVICE LAYER
// Centralized API calls with caching, retry, and error handling
// ============================================

import { retryWithBackoff, isRetryableError } from '../utils/retry.js';
import { signRequest, isHmacSupported } from '../utils/hmac.js';
import { captureError, addApiCallBreadcrumb } from '../utils/sentry.js';
import { trackApiResponse } from '../utils/analytics.js';

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {any} data - Cached data
 * @property {number} timestamp - Cache timestamp
 * @property {string} key - Cache key
 */

/**
 * Get cached data if still valid
 * @param {string} key - Cache key
 * @returns {any|null} - Cached data or null
 */
function getFromCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

/**
 * Set data in cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
function setCache(key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        key
    });
}

/**
 * Clear cache for a specific key or all
 * @param {string|null} key - Cache key or null to clear all
 */
export function clearCache(key = null) {
    if (key) {
        cache.delete(key);
    } else {
        cache.clear();
    }
}

/**
 * Get cache stats
 * @returns {Object} - Cache statistics
 */
export function getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    cache.forEach((entry) => {
        if (now - entry.timestamp <= CACHE_TTL) {
            validEntries++;
        } else {
            expiredEntries++;
        }
    });

    return {
        totalEntries: cache.size,
        validEntries,
        expiredEntries,
        cacheTTL: CACHE_TTL
    };
}

// ============================================
// API CONFIGURATION
// ============================================

/**
 * Get API configuration from window
 * @returns {Object|null}
 */
function getConfig() {
    return typeof window !== "undefined" ? window.ODOO_CONFIG : null;
}

/**
 * Check if using sample data
 * @returns {boolean}
 */
function isUsingSampleData() {
    const config = getConfig();
    return !config || config.useSampleData === true || config.useSampleData === undefined;
}

/**
 * Get base API URL from config
 * @returns {string}
 */
function getBaseUrl() {
    const config = getConfig();
    if (!config || !config.apiEndpoint) {
        return 'http://localhost:4001';
    }

    // Extract base URL from apiEndpoint
    if (config.apiEndpoint.includes('/api/')) {
        return config.apiEndpoint.split('/api/')[0];
    }
    return config.apiEndpoint.split('/xmlrpc')[0] || 'http://localhost:4001';
}

// ============================================
// RETRY CONFIGURATION
// ============================================

const RETRY_OPTIONS = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: isRetryableError,
    onRetry: (attempt, error, delay) => {
        console.warn(`[API] Retry attempt ${attempt} after ${Math.round(delay)}ms:`, error.message);
    }
};

// ============================================
// SIGNED FETCH HELPER
// ============================================

/**
 * Perform a signed fetch request with HMAC authentication
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function signedFetch(url, options = {}) {
    const method = options.method || 'GET';
    const startTime = performance.now();
    let body = null;
    
    // Parse body if present
    if (options.body) {
        try {
            body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
        } catch {
            body = null;
        }
    }
    
    // Get signature headers if HMAC is supported
    let signatureHeaders = {};
    if (isHmacSupported()) {
        try {
            signatureHeaders = await signRequest({ method, url, body });
        } catch (err) {
            console.warn('[API] Failed to sign request:', err.message);
        }
    }
    
    // Merge headers
    const headers = {
        ...options.headers,
        ...signatureHeaders
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    const endTime = performance.now();
    
    // Add breadcrumb for Sentry tracking
    addApiCallBreadcrumb(method, url, response.status);
    
    // Track API response time
    trackApiResponse(url, method, startTime, endTime, response.status);
    
    return response;
}

// ============================================
// API METHODS
// ============================================

/**
 * Fetch stock data from API
 * @param {Object} options - Options
 * @param {boolean} options.useCache - Whether to use cache (default: true)
 * @param {boolean} options.forceRefresh - Force refresh cache (default: false)
 * @returns {Promise<Array>} - Stock data
 */
export async function fetchStock({ useCache = true, forceRefresh = false } = {}) {
    const cacheKey = 'stock_data';

    // Check cache first
    if (useCache && !forceRefresh) {
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log('[API] Using cached stock data');
            return cached;
        }
    }

    // If using sample data, return sample
    if (isUsingSampleData()) {
        const { SAMPLE_DATA } = await import('../store/sampleData.js').catch(() => ({ SAMPLE_DATA: [] }));
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
        return SAMPLE_DATA || [];
    }

    const config = getConfig();
    const url = config.apiEndpoint;

    try {
        const data = await retryWithBackoff(async () => {
            const response = await signedFetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "API call failed");
            }

            return result.data || [];
        }, RETRY_OPTIONS);

        // Cache the data
        if (useCache) {
            setCache(cacheKey, data);
        }

        return data;
    } catch (error) {
        // Try to return stale cache data on error (graceful degradation)
        const staleEntry = cache.get(cacheKey);
        if (staleEntry) {
            console.warn('[API] Returning stale cache data due to error:', error.message);
            return staleEntry.data;
        }

        // Track error in Sentry
        captureError(error, {
            tags: { api: 'stock', endpoint: url },
            extra: { cacheKey, useCache, forceRefresh }
        });

        // Provide helpful error message for network errors
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

/**
 * Fetch incoming stock data from API
 * @param {Object} options - Options
 * @param {boolean} options.useCache - Whether to use cache (default: true)
 * @param {boolean} options.forceRefresh - Force refresh cache (default: false)
 * @returns {Promise<Array>} - Incoming data
 */
export async function fetchIncoming({ useCache = true, forceRefresh = false } = {}) {
    const cacheKey = 'incoming_data';

    // Check cache first
    if (useCache && !forceRefresh) {
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log('[API] Using cached incoming data');
            return cached;
        }
    }

    // If using sample data, return empty
    if (isUsingSampleData()) {
        return [];
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/incoming`;

    try {
        const data = await retryWithBackoff(async () => {
            const response = await signedFetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "API call failed");
            }

            return result.data || [];
        }, RETRY_OPTIONS);

        // Cache the data
        if (useCache) {
            setCache(cacheKey, data);
        }

        return data;
    } catch (error) {
        // Try to return stale cache data on error (graceful degradation)
        const staleEntry = cache.get(cacheKey);
        if (staleEntry) {
            console.warn('[API] Returning stale incoming cache data due to error:', error.message);
            return staleEntry.data;
        }

        // Return empty array for incoming (optional endpoint)
        console.warn('[API] Could not fetch incoming data:', error.message);
        return [];
    }
}

/**
 * Fetch fabric products from API
 * @param {Object} options - Options
 * @param {boolean} options.useCache - Whether to use cache (default: true)
 * @param {boolean} options.forceRefresh - Force refresh cache (default: false)
 * @returns {Promise<Array>} - Fabric products
 */
export async function fetchFabricProducts({ useCache = true, forceRefresh = false } = {}) {
    const cacheKey = 'fabric_products';

    // Check cache first
    if (useCache && !forceRefresh) {
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log('[API] Using cached fabric products');
            return cached;
        }
    }

    // If using sample data, return empty
    if (isUsingSampleData()) {
        return [];
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/fabric-products`;

    try {
        const data = await retryWithBackoff(async () => {
            const response = await signedFetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "API call failed");
            }

            return result.data || [];
        }, RETRY_OPTIONS);

        // Cache the data
        if (useCache) {
            setCache(cacheKey, data);
        }

        return data;
    } catch (error) {
        // Try to return stale cache data on error (graceful degradation)
        const staleEntry = cache.get(cacheKey);
        if (staleEntry) {
            console.warn('[API] Returning stale fabric products cache due to error:', error.message);
            return staleEntry.data;
        }

        // Return empty array for fabric products (optional endpoint)
        console.warn('[API] Could not fetch fabric products:', error.message);
        return [];
    }
}

/**
 * Fetch all data in parallel (stock, incoming, fabric products)
 * @param {Object} options - Options
 * @param {boolean} options.useCache - Whether to use cache (default: true)
 * @param {boolean} options.forceRefresh - Force refresh cache (default: false)
 * @returns {Promise<{stock: Array, incoming: Array, fabricProducts: Array}>}
 */
export async function fetchAllData({ useCache = true, forceRefresh = false } = {}) {
    const [stock, incoming, fabricProducts] = await Promise.all([
        fetchStock({ useCache, forceRefresh }),
        fetchIncoming({ useCache, forceRefresh }),
        fetchFabricProducts({ useCache, forceRefresh })
    ]);

    return { stock, incoming, fabricProducts };
}

// ============================================
// WAREHOUSE-SPECIFIC FETCH (LAZY LOAD)
// ============================================

// Track which warehouses have been loaded
const loadedWarehouses = new Set();

/**
 * Check if warehouse data is loaded
 * @param {string} warehouseName - Warehouse name
 * @returns {boolean}
 */
export function isWarehouseLoaded(warehouseName) {
    return loadedWarehouses.has(warehouseName);
}

/**
 * Mark warehouse as loaded
 * @param {string} warehouseName - Warehouse name
 */
export function markWarehouseLoaded(warehouseName) {
    loadedWarehouses.add(warehouseName);
}

/**
 * Clear loaded warehouses tracking
 */
export function clearLoadedWarehouses() {
    loadedWarehouses.clear();
}

/**
 * Get all loaded warehouses
 * @returns {Set<string>}
 */
export function getLoadedWarehouses() {
    return new Set(loadedWarehouses);
}

// ============================================
// EXPORTS
// ============================================

export default {
    fetchStock,
    fetchIncoming,
    fetchFabricProducts,
    fetchAllData,
    clearCache,
    getCacheStats,
    isWarehouseLoaded,
    markWarehouseLoaded,
    clearLoadedWarehouses,
    getLoadedWarehouses
};
