// ============================================
// REDIS CACHE SERVICE
// Redis + in-memory fallback (TTL + stale window)
// ============================================

import { createClient } from 'redis';

// ============================================
// CONFIGURATION
// ============================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 5 * 60; // 5 minutes in seconds
const STALE_TTL = parseInt(process.env.CACHE_STALE_TTL) || 30 * 60; // serve stale up to 30 min on errors
const CACHE_PREFIX = process.env.CACHE_PREFIX || 'onhand:';

// ============================================
// STATE
// ============================================

let redisClient = null;
let isConnected = false;
let isEnabled = process.env.ENABLE_REDIS !== 'false'; // Default enabled

/** @type {Map<string, { value: any, expiresAt: number, staleUntil: number }>} */
const memoryStore = new Map();

const DEFAULT_MAX_MEMORY_KEYS = 500;
let maxMemoryKeys = parseInt(process.env.CACHE_MEMORY_MAX_KEYS) || DEFAULT_MAX_MEMORY_KEYS;

/**
 * Test-safe helper to set memory store hard cap.
 * @param {number} limit
 * @returns {number} previous limit
 */
function _setMaxMemoryKeysForTest(limit) {
    const prev = maxMemoryKeys;
    maxMemoryKeys = limit;
    pruneMemoryIfNeeded();
    return prev;
}

/**
 * Test-safe helper to inspect in-memory store size.
 * @returns {number}
 */
function _getMemorySize() {
    return memoryStore.size;
}

function fullKey(key) {
    return CACHE_PREFIX + key;
}

function pruneMemoryIfNeeded() {
    const now = Date.now();
    // 1. Remove expired entries beyond stale window
    for (const [k, entry] of memoryStore.entries()) {
        if (entry.staleUntil <= now) {
            memoryStore.delete(k);
        }
    }

    // 2. Real hard cap: Evict least-recently-used (oldest in Map) until size <= maxMemoryKeys
    while (memoryStore.size > maxMemoryKeys) {
        const oldestKey = memoryStore.keys().next().value;
        if (oldestKey === undefined) break;
        memoryStore.delete(oldestKey);
    }
}

function setMemory(key, value, ttlSeconds = CACHE_TTL) {
    const ttlMs = Math.max(1, ttlSeconds) * 1000;
    const staleMs = Math.max(ttlMs, STALE_TTL * 1000);
    const now = Date.now();
    const fKey = fullKey(key);

    // Refresh position to most recent on overwrite
    if (memoryStore.has(fKey)) {
        memoryStore.delete(fKey);
    }

    memoryStore.set(fKey, {
        value,
        expiresAt: now + ttlMs,
        staleUntil: now + staleMs,
    });
    pruneMemoryIfNeeded();
}

function getMemory(key, { allowStale = false } = {}) {
    const fKey = fullKey(key);
    const entry = memoryStore.get(fKey);
    if (!entry) return null;

    const now = Date.now();
    if (now <= entry.expiresAt) {
        // Refresh recency in LRU
        memoryStore.delete(fKey);
        memoryStore.set(fKey, entry);
        return entry.value;
    }
    if (allowStale && now <= entry.staleUntil) {
        // Refresh recency in LRU
        memoryStore.delete(fKey);
        memoryStore.set(fKey, entry);
        return entry.value;
    }
    if (now > entry.staleUntil) {
        memoryStore.delete(fKey);
    }
    return null;
}

// ============================================
// REDIS CLIENT
// ============================================

/**
 * Initialize Redis client
 */
async function initRedis() {
    if (!isEnabled) {
        console.log('[Redis] Redis caching is disabled — using in-memory cache only');
        return null;
    }

    try {
        redisClient = createClient({
            url: REDIS_URL,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('[Redis] Max reconnection attempts reached — falling back to memory cache');
                        return false; // stop reconnecting
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            // Avoid log spam: only first-line errors
            if (isConnected) {
                console.error('[Redis] Error:', err.message);
            }
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

        await redisClient.connect();
        return redisClient;
    } catch (error) {
        console.error('[Redis] Failed to initialize:', error.message);
        console.warn('[Redis] Continuing with in-memory cache fallback');
        // Keep isEnabled true so memory fallback still used via get/set paths;
        // redis itself stays disconnected.
        isConnected = false;
        redisClient = null;
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
        memoryKeys: memoryStore.size,
        client: redisClient ? 'initialized' : 'null'
    };
}

// ============================================
// CACHE OPERATIONS
// ============================================

/**
 * Get value from cache (fresh only)
 * @param {string} key - Cache key
 * @returns {Promise<any|null>}
 */
async function get(key) {
    // Prefer Redis when available
    if (isEnabled && isConnected && redisClient) {
        try {
            const value = await redisClient.get(fullKey(key));
            if (value) {
                console.log(`[Redis] Cache HIT: ${key}`);
                const parsed = JSON.parse(value);
                // Mirror into memory for stale fallback if Redis later dies
                setMemory(key, parsed, CACHE_TTL);
                return parsed;
            }
            console.log(`[Redis] Cache MISS: ${key}`);
        } catch (error) {
            console.error(`[Redis] Get error for key "${key}":`, error.message);
        }
    }

    const mem = getMemory(key, { allowStale: false });
    if (mem) {
        console.log(`[Memory] Cache HIT: ${key}`);
        return mem;
    }

    console.log(`[Memory] Cache MISS: ${key}`);
    return null;
}

/**
 * Get stale value if fresh TTL expired but still within stale window
 * Used when Odoo is rate-limited / down
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function getStale(key) {
    // Fresh first
    const fresh = await get(key);
    if (fresh) return fresh;

    const stale = getMemory(key, { allowStale: true });
    if (stale) {
        console.log(`[Memory] Cache STALE HIT: ${key}`);
        return stale;
    }
    return null;
}

/**
 * Set value in cache with TTL
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - seconds
 * @returns {Promise<boolean>}
 */
async function set(key, value, ttl = CACHE_TTL) {
    // Always write memory fallback
    setMemory(key, value, ttl);

    if (!isEnabled || !isConnected || !redisClient) {
        console.log(`[Memory] Cache SET: ${key} (TTL: ${ttl}s)`);
        return true;
    }

    try {
        const serialized = JSON.stringify(value);
        await redisClient.setEx(fullKey(key), ttl, serialized);
        console.log(`[Redis] Cache SET: ${key} (TTL: ${ttl}s)`);
        return true;
    } catch (error) {
        console.error(`[Redis] Set error for key "${key}":`, error.message);
        return true; // memory write already succeeded
    }
}

/**
 * Delete value from cache
 */
async function del(key) {
    memoryStore.delete(fullKey(key));

    if (!isEnabled || !isConnected || !redisClient) {
        return true;
    }

    try {
        const result = await redisClient.del(fullKey(key));
        console.log(`[Redis] Cache DEL: ${key}`);
        return result > 0;
    } catch (error) {
        console.error(`[Redis] Delete error for key "${key}":`, error.message);
        return false;
    }
}

/**
 * Delete all keys matching pattern
 */
async function delPattern(pattern) {
    let deleted = 0;

    // Memory: simple prefix match (pattern ends with * usually)
    const memPattern = fullKey(pattern).replace(/\*/g, '');
    for (const k of [...memoryStore.keys()]) {
        if (k.startsWith(memPattern) || (pattern === '*' && k.startsWith(CACHE_PREFIX))) {
            memoryStore.delete(k);
            deleted += 1;
        }
    }

    if (!isEnabled || !isConnected || !redisClient) {
        return deleted;
    }

    try {
        const keys = await redisClient.keys(fullKey(pattern));
        if (keys.length === 0) return deleted;
        const result = await redisClient.del(keys);
        console.log(`[Redis] Cache DEL pattern "${pattern}": ${result} keys deleted`);
        return deleted + result;
    } catch (error) {
        console.error(`[Redis] Delete pattern error for "${pattern}":`, error.message);
        return deleted;
    }
}

async function exists(key) {
    if (getMemory(key, { allowStale: false })) return true;

    if (!isEnabled || !isConnected || !redisClient) {
        return false;
    }

    try {
        const result = await redisClient.exists(fullKey(key));
        return result === 1;
    } catch (error) {
        console.error(`[Redis] Exists error for key "${key}":`, error.message);
        return false;
    }
}

async function ttl(key) {
    const entry = memoryStore.get(fullKey(key));
    if (entry) {
        const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
        return remaining > 0 ? remaining : -1;
    }

    if (!isEnabled || !isConnected || !redisClient) {
        return -2;
    }

    try {
        return await redisClient.ttl(fullKey(key));
    } catch (error) {
        console.error(`[Redis] TTL error for key "${key}":`, error.message);
        return -2;
    }
}

async function flushAll() {
    const memCount = memoryStore.size;
    memoryStore.clear();

    if (!isEnabled || !isConnected || !redisClient) {
        console.log(`[Memory] Flushed ${memCount} keys`);
        return memCount;
    }

    try {
        const keys = await redisClient.keys(CACHE_PREFIX + '*');
        if (keys.length === 0) {
            console.log(`[Cache] Flushed ${memCount} memory keys (no redis keys)`);
            return memCount;
        }
        const result = await redisClient.del(keys);
        console.log(`[Redis] Flushed ${result} redis + ${memCount} memory keys`);
        return result + memCount;
    } catch (error) {
        console.error('[Redis] Flush error:', error.message);
        return memCount;
    }
}

async function getStats() {
    const memoryKeys = memoryStore.size;

    if (!isEnabled || !isConnected || !redisClient) {
        return {
            enabled: true, // memory always available
            connected: false,
            backend: 'memory',
            keys: memoryKeys,
            memory: memoryKeys,
            prefix: CACHE_PREFIX,
            ttl: CACHE_TTL,
            staleTtl: STALE_TTL
        };
    }

    try {
        const keys = await redisClient.keys(CACHE_PREFIX + '*');
        const info = await redisClient.info('memory');
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        const memory = memoryMatch ? memoryMatch[1].trim() : 'N/A';

        return {
            enabled: true,
            connected: true,
            backend: 'redis+memory',
            keys: keys.length,
            memoryKeys,
            memory,
            prefix: CACHE_PREFIX,
            ttl: CACHE_TTL,
            staleTtl: STALE_TTL
        };
    } catch (error) {
        console.error('[Redis] Stats error:', error.message);
        return {
            enabled: true,
            connected: false,
            backend: 'memory',
            keys: memoryKeys,
            memory: 'N/A'
        };
    }
}

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
    getStale,
    set,
    del,
    delPattern,
    exists,
    ttl,
    flushAll,
    getStats,
    close,
    _setMaxMemoryKeysForTest,
    _getMemorySize
};

export default {
    init: initRedis,
    getStatus,
    get,
    getStale,
    set,
    del,
    delPattern,
    exists,
    ttl,
    flushAll,
    getStats,
    close
};
