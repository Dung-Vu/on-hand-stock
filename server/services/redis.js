// ============================================
// REDIS CACHE SERVICE
// Centralized Redis caching with TTL and error handling
// ============================================

import { createClient } from 'redis';

// ============================================
// CONFIGURATION
// ============================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 5 * 60; // 5 minutes in seconds
const CACHE_PREFIX = process.env.CACHE_PREFIX || 'onhand:';

// ============================================
// REDIS CLIENT
// ============================================

let redisClient = null;
let isConnected = false;
let isEnabled = process.env.ENABLE_REDIS !== 'false'; // Default enabled

/**
 * Initialize Redis client
 */
async function initRedis() {
    if (!isEnabled) {
        console.log('[Redis] Redis caching is disabled');
        return null;
    }

    try {
        redisClient = createClient({
            url: REDIS_URL,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('[Redis] Max reconnection attempts reached');
                        return new Error('Max reconnection attempts reached');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        // Event handlers
        redisClient.on('error', (err) => {
            console.error('[Redis] Error:', err.message);
            isConnected = false;
        });

        redisClient.on('connect', () => {
            console.log('[Redis] Connecting...');
        });

        redisClient.on('ready', () => {
            console.log('[Redis] Connected and ready');
            isConnected = true;
        });

        redisClient.on('reconnecting', () => {
            console.log('[Redis] Reconnecting...');
            isConnected = false;
        });

        redisClient.on('end', () => {
            console.log('[Redis] Connection closed');
            isConnected = false;
        });

        // Connect to Redis
        await redisClient.connect();

        return redisClient;
    } catch (error) {
        console.error('[Redis] Failed to initialize:', error.message);
        console.warn('[Redis] Continuing without cache');
        isEnabled = false;
        return null;
    }
}

/**
 * Get Redis client status
 */
function getStatus() {
    return {
        enabled: isEnabled,
        connected: isConnected,
        client: redisClient ? 'initialized' : 'null'
    };
}

// ============================================
// CACHE OPERATIONS
// ============================================

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null
 */
async function get(key) {
    if (!isEnabled || !isConnected || !redisClient) {
        return null;
    }

    try {
        const fullKey = CACHE_PREFIX + key;
        const value = await redisClient.get(fullKey);
        
        if (value) {
            console.log(`[Redis] Cache HIT: ${key}`);
            return JSON.parse(value);
        }
        
        console.log(`[Redis] Cache MISS: ${key}`);
        return null;
    } catch (error) {
        console.error(`[Redis] Get error for key "${key}":`, error.message);
        return null;
    }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional, defaults to CACHE_TTL)
 * @returns {Promise<boolean>} - Success status
 */
async function set(key, value, ttl = CACHE_TTL) {
    if (!isEnabled || !isConnected || !redisClient) {
        return false;
    }

    try {
        const fullKey = CACHE_PREFIX + key;
        const serialized = JSON.stringify(value);
        
        await redisClient.setEx(fullKey, ttl, serialized);
        console.log(`[Redis] Cache SET: ${key} (TTL: ${ttl}s)`);
        return true;
    } catch (error) {
        console.error(`[Redis] Set error for key "${key}":`, error.message);
        return false;
    }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
async function del(key) {
    if (!isEnabled || !isConnected || !redisClient) {
        return false;
    }

    try {
        const fullKey = CACHE_PREFIX + key;
        const result = await redisClient.del(fullKey);
        console.log(`[Redis] Cache DEL: ${key}`);
        return result > 0;
    } catch (error) {
        console.error(`[Redis] Delete error for key "${key}":`, error.message);
        return false;
    }
}

/**
 * Delete all keys matching pattern
 * @param {string} pattern - Key pattern (e.g., "stock:*")
 * @returns {Promise<number>} - Number of deleted keys
 */
async function delPattern(pattern) {
    if (!isEnabled || !isConnected || !redisClient) {
        return 0;
    }

    try {
        const fullPattern = CACHE_PREFIX + pattern;
        const keys = await redisClient.keys(fullPattern);
        
        if (keys.length === 0) {
            return 0;
        }
        
        const result = await redisClient.del(keys);
        console.log(`[Redis] Cache DEL pattern "${pattern}": ${result} keys deleted`);
        return result;
    } catch (error) {
        console.error(`[Redis] Delete pattern error for "${pattern}":`, error.message);
        return 0;
    }
}

/**
 * Check if key exists
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Existence status
 */
async function exists(key) {
    if (!isEnabled || !isConnected || !redisClient) {
        return false;
    }

    try {
        const fullKey = CACHE_PREFIX + key;
        const result = await redisClient.exists(fullKey);
        return result === 1;
    } catch (error) {
        console.error(`[Redis] Exists error for key "${key}":`, error.message);
        return false;
    }
}

/**
 * Get remaining TTL for key
 * @param {string} key - Cache key
 * @returns {Promise<number>} - TTL in seconds, -1 if no TTL, -2 if key doesn't exist
 */
async function ttl(key) {
    if (!isEnabled || !isConnected || !redisClient) {
        return -2;
    }

    try {
        const fullKey = CACHE_PREFIX + key;
        return await redisClient.ttl(fullKey);
    } catch (error) {
        console.error(`[Redis] TTL error for key "${key}":`, error.message);
        return -2;
    }
}

/**
 * Clear all cache with prefix
 * @returns {Promise<number>} - Number of deleted keys
 */
async function flushAll() {
    if (!isEnabled || !isConnected || !redisClient) {
        return 0;
    }

    try {
        const pattern = CACHE_PREFIX + '*';
        const keys = await redisClient.keys(pattern);
        
        if (keys.length === 0) {
            console.log('[Redis] No keys to flush');
            return 0;
        }
        
        const result = await redisClient.del(keys);
        console.log(`[Redis] Flushed ${result} keys`);
        return result;
    } catch (error) {
        console.error('[Redis] Flush error:', error.message);
        return 0;
    }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} - Cache stats
 */
async function getStats() {
    if (!isEnabled || !isConnected || !redisClient) {
        return {
            enabled: isEnabled,
            connected: isConnected,
            keys: 0,
            memory: 0
        };
    }

    try {
        const pattern = CACHE_PREFIX + '*';
        const keys = await redisClient.keys(pattern);
        const info = await redisClient.info('memory');
        
        // Parse memory usage
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        const memory = memoryMatch ? memoryMatch[1].trim() : 'N/A';
        
        return {
            enabled: isEnabled,
            connected: isConnected,
            keys: keys.length,
            memory,
            prefix: CACHE_PREFIX,
            ttl: CACHE_TTL
        };
    } catch (error) {
        console.error('[Redis] Stats error:', error.message);
        return {
            enabled: isEnabled,
            connected: isConnected,
            keys: 0,
            memory: 'N/A'
        };
    }
}

/**
 * Close Redis connection
 */
async function close() {
    if (redisClient) {
        try {
            await redisClient.quit();
            console.log('[Redis] Connection closed gracefully');
        } catch (error) {
            console.error('[Redis] Error closing connection:', error.message);
        }
    }
}

// ============================================
// EXPORTS
// ============================================

export {
    initRedis,
    getStatus,
    get,
    set,
    del,
    delPattern,
    exists,
    ttl,
    flushAll,
    getStats,
    close
};

export default {
    init: initRedis,
    getStatus,
    get,
    set,
    del,
    delPattern,
    exists,
    ttl,
    flushAll,
    getStats,
    close
};
