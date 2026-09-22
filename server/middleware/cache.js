// ============================================
// CACHE MIDDLEWARE
// Express middleware for Redis caching
// ============================================

import * as redis from '../services/redis.js';

// Coalesce concurrent misses for the same key (1 Odoo trip, N waiters)
const inflight = new Map();

export const IS_STALE_RESPONSE = Symbol('is_stale_response');

const CACHE_BUSTER_PARAMS = new Set([
    '_',
    '_t',
    't',
    'timestamp',
    'cb',
    'bust',
    'buster',
    'v',
    'random',
]);

/**
 * Generate normalized cache key from request, stripping irrelevant cache-busting params.
 * @param {import('express').Request} req
 * @returns {string}
 */
export function getCacheKey(req) {
    const rawUrl = req.originalUrl || req.url || '';
    try {
        const parsed = new URL(rawUrl, 'http://localhost');
        const normalizedParams = new URLSearchParams();

        // Sort keys deterministically
        const sortedKeys = Array.from(new Set(parsed.searchParams.keys())).sort();
        for (const key of sortedKeys) {
            if (CACHE_BUSTER_PARAMS.has(key.toLowerCase())) {
                continue;
            }
            const values = parsed.searchParams.getAll(key);
            for (const val of values) {
                normalizedParams.append(key, val);
            }
        }

        const queryString = normalizedParams.toString();
        const cleanPath = parsed.pathname;
        const normalizedUrl = queryString ? `${cleanPath}?${queryString}` : cleanPath;
        return `api:${normalizedUrl}`;
    } catch {
        return `api:${rawUrl}`;
    }
}

/**
 * Helper for tests to inspect inflight coalescing map.
 */
export function _getInflightSize() {
    return inflight.size;
}

// ============================================
// CACHE MIDDLEWARE
// ============================================

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in seconds (optional)
 * @param {Object} [options] - Optional settings
 * @param {number} [options.timeoutMs] - Maximum ms to wait before aborting inflight coalescing
 * @returns {Function} - Express middleware
 */
export function cacheMiddleware(ttl, options = {}) {
    const inflightTimeoutMs = options.timeoutMs || parseInt(process.env.CACHE_INFLIGHT_TIMEOUT_MS) || 15000;

    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Allow bypassing cache with ?noCache=true query param
        if (req.query.noCache === 'true') {
            return next();
        }

        // Generate cache key from URL (normalized)
        const cacheKey = getCacheKey(req);

        // Coalesce concurrent cache misses before hitting Redis
        if (inflight.has(cacheKey)) {
            try {
                const shared = await inflight.get(cacheKey);
                if (shared && shared.isStale) {
                    res.setHeader('X-Cache', 'STALE');
                } else {
                    res.setHeader('X-Cache', 'COALESCE');
                }
                res.setHeader('X-Cache-Key', cacheKey);
                return res.json(shared && shared.data !== undefined ? shared.data : shared);
            } catch (err) {
                // Leader failed — check stale cache first, then return controlled failure
                try {
                    const stale = await redis.getStale(cacheKey);
                    if (stale) {
                        res.setHeader('X-Cache', 'STALE');
                        res.setHeader('X-Cache-Key', cacheKey);
                        return res.json(stale);
                    }
                } catch {
                    // ignore stale lookup error
                }

                res.setHeader('X-Cache', 'FAILURE');
                res.setHeader('X-Cache-Key', cacheKey);
                const statusCode = (typeof err?.status === 'number' && err.status >= 400 && err.status < 600)
                    ? err.status
                    : 503;
                return res.status(statusCode).json({
                    success: false,
                    error: err?.message || 'Upstream request failed',
                    code: err?.code || 'LEADER_FAILED',
                });
            }
        }

        try {
            // Try to get from cache (memory fallback when Redis is down)
            const cachedData = await redis.get(cacheKey);

            if (cachedData) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Key', cacheKey);
                return res.json(cachedData);
            }

            let resolveInflight;
            let rejectInflight;
            const pending = new Promise((resolve, reject) => {
                resolveInflight = resolve;
                rejectInflight = reject;
            });
            // Prevent unhandled rejection if no waiter awaits
            pending.catch(() => {});
            inflight.set(cacheKey, pending);

            const originalJson = res.json.bind(res);
            let settled = false;

            let timeoutId = setTimeout(() => {
                settleFail(new Error('Inflight request timed out'));
            }, inflightTimeoutMs);

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                inflight.delete(cacheKey);
                if (req.removeListener) {
                    req.removeListener('aborted', onAbort);
                }
                if (res.removeListener) {
                    res.removeListener('close', onClose);
                    res.removeListener('finish', onFinish);
                    res.removeListener('error', onError);
                }
            };

            const settleOk = (payload) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolveInflight(payload);
            };

            const settleFail = (err) => {
                if (settled) return;
                settled = true;
                cleanup();
                rejectInflight(err || new Error('cache miss request failed'));
            };

            const onClose = () => {
                if (!settled && !res.writableEnded) {
                    settleFail(new Error('client connection closed before response finished'));
                }
            };

            const onAbort = () => {
                if (!settled) {
                    settleFail(new Error('client request aborted before response finished'));
                }
            };

            const onFinish = () => {
                if (!settled) {
                    settleFail(new Error('response finished without success'));
                }
            };

            const onError = (err) => {
                if (!settled) {
                    settleFail(err || new Error('response error'));
                }
            };

            // IncomingMessage "close" also fires after a normally completed request on modern Node.
            // Use "aborted" for premature request termination and response "close" for socket loss.
            if (req.on) req.on('aborted', onAbort);
            if (res.on) {
                res.on('close', onClose);
                res.on('finish', onFinish);
                res.on('error', onError);
            }

            res.json = function (data) {
                const isStale = Boolean(res[IS_STALE_RESPONSE] || (res.getHeader && res.getHeader('X-Cache') === 'STALE'));

                if (isStale) {
                    // Stale responses must preserve X-Cache: STALE and must never enter normal success cache write
                    res.setHeader('X-Cache', 'STALE');
                    res.setHeader('X-Cache-Key', cacheKey);
                    settleOk({ isStale: true, data });
                    return originalJson(data);
                }

                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Cache-Key', cacheKey);

                if (res.statusCode === 200 && data && data.success) {
                    redis.set(cacheKey, data, ttl).catch(err => {
                        console.error('[Cache] Failed to cache response:', err.message);
                    });
                    settleOk({ isStale: false, data });
                } else {
                    const err = new Error(data?.error || `status ${res.statusCode}`);
                    if (res.statusCode >= 400 && res.statusCode < 600) {
                        err.status = res.statusCode;
                    }
                    if (data?.code) {
                        err.code = data.code;
                    }
                    settleFail(err);
                }

                return originalJson(data);
            };

            next();
        } catch (error) {
            console.error('[Cache] Middleware error:', error.message);
            next();
        }
    };
}

/**
 * Try to return a stale cached payload when upstream (Odoo) fails.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<boolean>} true if stale data was sent
 */
export async function trySendStaleCache(req, res) {
    try {
        const cacheKey = getCacheKey(req);
        const stale = await redis.getStale(cacheKey);
        if (!stale) return false;

        res[IS_STALE_RESPONSE] = true;
        res.setHeader('X-Cache', 'STALE');
        res.setHeader('X-Cache-Key', cacheKey);
        res.status(200).json(stale);
        return true;
    } catch (error) {
        console.error('[Cache] Stale serve error:', error.message);
        return false;
    }
}

/**
 * Invalidate cache for specific pattern
 * @param {string} pattern - Cache key pattern
 */
export async function invalidateCache(pattern) {
    try {
        const deleted = await redis.delPattern(`api:${pattern}`);
        console.log(`[Cache] Invalidated ${deleted} keys matching "${pattern}"`);
        return deleted;
    } catch (error) {
        console.error('[Cache] Invalidation error:', error.message);
        return 0;
    }
}

/**
 * Clear all API cache
 */
export async function clearAllCache() {
    try {
        const deleted = await redis.delPattern('api:*');
        console.log(`[Cache] Cleared ${deleted} API cache keys`);
        return deleted;
    } catch (error) {
        console.error('[Cache] Clear all error:', error.message);
        return 0;
    }
}

/**
 * Middleware to invalidate cache on POST/PUT/DELETE
 */
export function invalidateCacheOnMutation(pattern = '*') {
    return async (req, res, next) => {
        // Only invalidate on mutation methods
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            try {
                await invalidateCache(pattern);
            } catch (error) {
                console.error('[Cache] Auto-invalidation error:', error.message);
            }
        }
        next();
    };
}

// ============================================
// CACHE CONTROL HEADERS
// ============================================

/**
 * Set cache control headers for responses
 * @param {number} maxAge - Max age in seconds
 * @param {Object} options - Cache control options
 */
export function setCacheControl(maxAge = 300, options = {}) {
    return (req, res, next) => {
        const {
            public: isPublic = true,
            private: isPrivate = false,
            noCache = false,
            noStore = false,
            mustRevalidate = false
        } = options;

        const directives = [];

        if (noStore) {
            directives.push('no-store');
        } else {
            if (noCache) {
                directives.push('no-cache');
            }
            if (isPublic) {
                directives.push('public');
            }
            if (isPrivate) {
                directives.push('private');
            }
            if (maxAge !== undefined) {
                directives.push(`max-age=${maxAge}`);
            }
            if (mustRevalidate) {
                directives.push('must-revalidate');
            }
        }

        res.setHeader('Cache-Control', directives.join(', '));
        next();
    };
}

// ============================================
// EXPORTS
// ============================================

export default {
    cacheMiddleware,
    trySendStaleCache,
    invalidateCache,
    clearAllCache,
    invalidateCacheOnMutation,
    setCacheControl
};
