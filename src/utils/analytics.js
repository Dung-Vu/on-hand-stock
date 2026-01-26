// ============================================
// PERFORMANCE MONITORING
// Track page load time, API response time, and Core Web Vitals
// ============================================

// ============================================
// CONFIGURATION
// ============================================

const DEBUG = false; // Set to true for console logging

/**
 * Get analytics configuration
 * @returns {Object}
 */
function getConfig() {
    if (typeof window !== 'undefined' && window.ANALYTICS_CONFIG) {
        return window.ANALYTICS_CONFIG;
    }
    return {
        enabled: true,
        endpoint: null, // Set to send metrics to a backend
        sampleRate: 1.0, // 100% sampling by default
    };
}

// ============================================
// METRICS STORAGE
// ============================================

const metrics = {
    navigation: {},
    resources: [],
    api: [],
    webVitals: {},
    custom: {},
};

// ============================================
// CORE WEB VITALS
// ============================================

/**
 * Track Largest Contentful Paint (LCP)
 */
function trackLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            metrics.webVitals.lcp = {
                value: lastEntry.startTime,
                element: lastEntry.element?.tagName || 'unknown',
                timestamp: Date.now(),
            };

            if (DEBUG) {
                console.log('[Analytics] LCP:', metrics.webVitals.lcp.value.toFixed(2), 'ms');
            }
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
        // LCP not supported
    }
}

/**
 * Track First Input Delay (FID)
 */
function trackFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const firstEntry = entries[0];
            
            metrics.webVitals.fid = {
                value: firstEntry.processingStart - firstEntry.startTime,
                eventType: firstEntry.name,
                timestamp: Date.now(),
            };

            if (DEBUG) {
                console.log('[Analytics] FID:', metrics.webVitals.fid.value.toFixed(2), 'ms');
            }
        });

        observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
        // FID not supported
    }
}

/**
 * Track Cumulative Layout Shift (CLS)
 */
function trackCLS() {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;
    let clsEntries = [];

    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                    clsEntries.push(entry);
                }
            }

            metrics.webVitals.cls = {
                value: clsValue,
                entries: clsEntries.length,
                timestamp: Date.now(),
            };

            if (DEBUG) {
                console.log('[Analytics] CLS:', clsValue.toFixed(4));
            }
        });

        observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
        // CLS not supported
    }
}

/**
 * Track Time to First Byte (TTFB)
 */
function trackTTFB() {
    if (!('PerformanceObserver' in window)) return;

    try {
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const navigationEntry = entries[0];
            
            metrics.webVitals.ttfb = {
                value: navigationEntry.responseStart - navigationEntry.requestStart,
                timestamp: Date.now(),
            };

            if (DEBUG) {
                console.log('[Analytics] TTFB:', metrics.webVitals.ttfb.value.toFixed(2), 'ms');
            }
        });

        observer.observe({ type: 'navigation', buffered: true });
    } catch (e) {
        // TTFB not supported
    }
}

// ============================================
// PAGE LOAD METRICS
// ============================================

/**
 * Track navigation timing metrics
 */
function trackNavigationTiming() {
    if (!window.performance || !window.performance.timing) return;

    // Wait for load event
    window.addEventListener('load', () => {
        // Use setTimeout to ensure all metrics are available
        setTimeout(() => {
            const timing = window.performance.timing;
            const navigationStart = timing.navigationStart;

            metrics.navigation = {
                // DNS lookup
                dns: timing.domainLookupEnd - timing.domainLookupStart,
                // TCP connection
                tcp: timing.connectEnd - timing.connectStart,
                // Time to first byte
                ttfb: timing.responseStart - navigationStart,
                // Response download
                download: timing.responseEnd - timing.responseStart,
                // DOM parsing
                domParsing: timing.domInteractive - timing.responseEnd,
                // DOM content loaded
                domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
                // Page load complete
                loadComplete: timing.loadEventEnd - navigationStart,
                // First paint (if available)
                firstPaint: getFirstPaint(),
                // First contentful paint
                firstContentfulPaint: getFirstContentfulPaint(),
                timestamp: Date.now(),
            };

            if (DEBUG) {
                console.log('[Analytics] Navigation Timing:', metrics.navigation);
            }
        }, 0);
    });
}

/**
 * Get First Paint timing
 * @returns {number|null}
 */
function getFirstPaint() {
    const entries = performance.getEntriesByType('paint');
    const fp = entries.find(e => e.name === 'first-paint');
    return fp ? fp.startTime : null;
}

/**
 * Get First Contentful Paint timing
 * @returns {number|null}
 */
function getFirstContentfulPaint() {
    const entries = performance.getEntriesByType('paint');
    const fcp = entries.find(e => e.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : null;
}

// ============================================
// API RESPONSE TIME TRACKING
// ============================================

/**
 * Track API response time
 * @param {string} url - API URL
 * @param {string} method - HTTP method
 * @param {number} startTime - Request start time
 * @param {number} endTime - Request end time
 * @param {number} status - HTTP status code
 * @param {boolean} cached - Whether response was from cache
 */
export function trackApiResponse(url, method, startTime, endTime, status, cached = false) {
    const duration = endTime - startTime;
    
    const entry = {
        url: sanitizeUrl(url),
        method,
        duration,
        status,
        cached,
        timestamp: Date.now(),
    };

    metrics.api.push(entry);

    // Keep only last 100 API calls
    if (metrics.api.length > 100) {
        metrics.api.shift();
    }

    if (DEBUG) {
        console.log(`[Analytics] API ${method} ${entry.url}: ${duration.toFixed(0)}ms (${status})`);
    }

    return entry;
}

/**
 * Create a tracked fetch wrapper
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function trackedFetch(url, options = {}) {
    const startTime = performance.now();
    const method = options.method || 'GET';

    try {
        const response = await fetch(url, options);
        const endTime = performance.now();
        
        trackApiResponse(url, method, startTime, endTime, response.status);
        
        return response;
    } catch (error) {
        const endTime = performance.now();
        trackApiResponse(url, method, startTime, endTime, 0); // 0 = network error
        throw error;
    }
}

/**
 * Sanitize URL for logging (remove sensitive query params)
 * @param {string} url - URL to sanitize
 * @returns {string}
 */
function sanitizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // Remove sensitive params
        urlObj.searchParams.delete('api_key');
        urlObj.searchParams.delete('token');
        urlObj.searchParams.delete('password');
        return urlObj.pathname + urlObj.search;
    } catch {
        return url;
    }
}

// ============================================
// CUSTOM METRICS
// ============================================

/**
 * Track a custom metric
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @param {Object} tags - Additional tags
 */
export function trackMetric(name, value, tags = {}) {
    if (!metrics.custom[name]) {
        metrics.custom[name] = [];
    }

    const entry = {
        value,
        tags,
        timestamp: Date.now(),
    };

    metrics.custom[name].push(entry);

    // Keep only last 50 entries per metric
    if (metrics.custom[name].length > 50) {
        metrics.custom[name].shift();
    }

    if (DEBUG) {
        console.log(`[Analytics] Custom metric "${name}":`, value, tags);
    }

    return entry;
}

/**
 * Track render time for a component
 * @param {string} componentName - Component name
 * @param {Function} renderFn - Render function to measure
 * @returns {any} Result of render function
 */
export function trackRenderTime(componentName, renderFn) {
    const startTime = performance.now();
    const result = renderFn();
    const endTime = performance.now();

    trackMetric(`render_${componentName}`, endTime - startTime, {
        component: componentName,
    });

    return result;
}

/**
 * Create a performance mark
 * @param {string} name - Mark name
 */
export function mark(name) {
    if (window.performance && window.performance.mark) {
        performance.mark(name);
    }
}

/**
 * Measure between two marks
 * @param {string} name - Measure name
 * @param {string} startMark - Start mark name
 * @param {string} endMark - End mark name (optional, uses current time if not provided)
 * @returns {number|null} Duration in milliseconds
 */
export function measure(name, startMark, endMark = null) {
    if (!window.performance || !window.performance.measure) return null;

    try {
        if (endMark) {
            performance.measure(name, startMark, endMark);
        } else {
            performance.measure(name, startMark);
        }

        const entries = performance.getEntriesByName(name, 'measure');
        const entry = entries[entries.length - 1];
        
        if (entry) {
            trackMetric(name, entry.duration);
            return entry.duration;
        }
    } catch (e) {
        // Mark not found
    }

    return null;
}

// ============================================
// METRICS RETRIEVAL
// ============================================

/**
 * Get all collected metrics
 * @returns {Object}
 */
export function getMetrics() {
    return { ...metrics };
}

/**
 * Get Web Vitals summary
 * @returns {Object}
 */
export function getWebVitals() {
    return { ...metrics.webVitals };
}

/**
 * Get API metrics summary
 * @returns {Object}
 */
export function getApiMetrics() {
    const apiCalls = metrics.api;
    
    if (apiCalls.length === 0) {
        return { count: 0 };
    }

    const durations = apiCalls.map(c => c.duration);
    const successful = apiCalls.filter(c => c.status >= 200 && c.status < 300);
    const failed = apiCalls.filter(c => c.status === 0 || c.status >= 400);

    return {
        count: apiCalls.length,
        successRate: (successful.length / apiCalls.length) * 100,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        p95Duration: percentile(durations, 95),
        failedCount: failed.length,
    };
}

/**
 * Calculate percentile
 * @param {number[]} arr - Array of numbers
 * @param {number} p - Percentile (0-100)
 * @returns {number}
 */
function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

/**
 * Get navigation timing summary
 * @returns {Object}
 */
export function getNavigationMetrics() {
    return { ...metrics.navigation };
}

// ============================================
// REPORTING
// ============================================

/**
 * Send metrics to backend (if configured)
 * @returns {Promise<boolean>}
 */
export async function sendMetrics() {
    const config = getConfig();
    
    if (!config.endpoint) {
        if (DEBUG) {
            console.log('[Analytics] No endpoint configured, metrics not sent');
        }
        return false;
    }

    // Sample rate check
    if (Math.random() > config.sampleRate) {
        return false;
    }

    try {
        const payload = {
            navigation: metrics.navigation,
            webVitals: metrics.webVitals,
            apiSummary: getApiMetrics(),
            custom: metrics.custom,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
        };

        await fetch(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true, // Ensure request completes even if page unloads
        });

        if (DEBUG) {
            console.log('[Analytics] Metrics sent successfully');
        }

        return true;
    } catch (error) {
        console.error('[Analytics] Failed to send metrics:', error);
        return false;
    }
}

// ============================================
// INITIALIZATION
// ============================================

let isInitialized = false;

/**
 * Initialize performance monitoring
 * @param {Object} options - Configuration options
 */
export function initAnalytics(options = {}) {
    if (isInitialized) {
        console.warn('[Analytics] Already initialized');
        return;
    }

    const config = getConfig();
    
    if (!config.enabled) {
        console.info('[Analytics] Performance monitoring disabled');
        return;
    }

    // Track Core Web Vitals
    trackLCP();
    trackFID();
    trackCLS();
    trackTTFB();

    // Track navigation timing
    trackNavigationTiming();

    // Send metrics before page unload
    if (options.sendOnUnload !== false) {
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                sendMetrics();
            }
        });
    }

    isInitialized = true;
    console.info('[Analytics] Performance monitoring initialized');
}

// ============================================
// EXPORTS
// ============================================

export default {
    initAnalytics,
    trackApiResponse,
    trackedFetch,
    trackMetric,
    trackRenderTime,
    mark,
    measure,
    getMetrics,
    getWebVitals,
    getApiMetrics,
    getNavigationMetrics,
    sendMetrics,
};
