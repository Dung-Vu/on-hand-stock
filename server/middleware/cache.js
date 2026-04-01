// ============================================
// CACHE MIDDLEWARE
// Express middleware for Redis caching
// ============================================

import * as redis from '../services/redis.js';

// ============================================
// CACHE MIDDLEWARE
// ============================================

/**
 * Cache middleware for GET requests
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Function} - Express middleware
 */
export function cacheMiddleware(ttl) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Allow bypassing cache with ?noCache=true query param
        if (req.query.noCache === 'true') {
            return next();
        }

        // Generate cache key from URL
        const cacheKey = `api:${req.originalUrl || req.url}`;

        try {
            // Try to get from cache
            const cachedData = await redis.get(cacheKey);

            if (cachedData) {
                // Add cache header
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Key', cacheKey);

                // Return cached data
                return res.json(cachedData);
            }

            // Cache miss - store original json method
            const originalJson = res.json.bind(res);

            // Override json method to cache response
            res.json = function (data) {
                // Add cache header
                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Cache-Key', cacheKey);

                // Only cache successful responses
                if (res.statusCode === 200 && data && data.success) {
                    redis.set(cacheKey, data, ttl).catch(err => {
                        console.error('[Cache] Failed to cache response:', err.message);
                    });
                }

                // Call original json method
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
    invalidateCache,
    clearAllCache,
    invalidateCacheOnMutation,
    setCacheControl
};
