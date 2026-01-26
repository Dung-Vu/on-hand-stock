// ============================================
// SENTRY ERROR TRACKING
// Centralized error tracking and monitoring
// ============================================

import * as Sentry from '@sentry/browser';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get Sentry configuration from window or environment
 * @returns {Object} Sentry config
 */
function getSentryConfig() {
    // Try to get from window config first (for runtime configuration)
    if (typeof window !== 'undefined' && window.SENTRY_CONFIG) {
        return window.SENTRY_CONFIG;
    }

    // Default configuration
    return {
        dsn: '', // Set your Sentry DSN here or via window.SENTRY_CONFIG
        environment: import.meta.env.MODE || 'development',
        release: 'onhand-stock@1.0.0',
        enabled: import.meta.env.PROD, // Only enable in production by default
    };
}

// ============================================
// INITIALIZATION
// ============================================

let isInitialized = false;

/**
 * Initialize Sentry error tracking
 * @param {Object} customConfig - Custom configuration to merge
 */
export function initSentry(customConfig = {}) {
    if (isInitialized) {
        console.warn('[Sentry] Already initialized');
        return;
    }

    const config = { ...getSentryConfig(), ...customConfig };

    // Skip if no DSN configured
    if (!config.dsn) {
        console.info('[Sentry] No DSN configured, error tracking disabled');
        return;
    }

    // Skip if explicitly disabled
    if (config.enabled === false) {
        console.info('[Sentry] Error tracking disabled');
        return;
    }

    try {
        Sentry.init({
            dsn: config.dsn,
            environment: config.environment,
            release: config.release,

            // Performance monitoring sample rate (0-1)
            tracesSampleRate: config.tracesSampleRate || 0.1,

            // Session replay sample rate
            replaysSessionSampleRate: config.replaysSessionSampleRate || 0,
            replaysOnErrorSampleRate: config.replaysOnErrorSampleRate || 1.0,

            // Integrations
            integrations: [
                // Browser tracing for performance
                Sentry.browserTracingIntegration(),
                // Replay for error context (if enabled)
                ...(config.enableReplay ? [Sentry.replayIntegration()] : []),
            ],

            // Filter sensitive data
            beforeSend(event, hint) {
                // Filter out specific errors if needed
                const error = hint.originalException;

                // Don't send network errors in development
                if (config.environment === 'development') {
                    if (error?.message?.includes('Failed to fetch')) {
                        return null;
                    }
                }

                // Remove sensitive data
                if (event.request?.headers) {
                    delete event.request.headers['X-Signature'];
                    delete event.request.headers['Authorization'];
                }

                return event;
            },

            // Ignore specific errors
            ignoreErrors: [
                // Browser extensions
                'top.GLOBALS',
                'ResizeObserver loop limit exceeded',
                'ResizeObserver loop completed with undelivered notifications',
                // Network errors that are expected
                'Network Error',
                'Failed to fetch',
                'Load failed',
                // User-caused errors
                'AbortError',
            ],

            // Filter breadcrumbs
            beforeBreadcrumb(breadcrumb) {
                // Filter out noisy console logs
                if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
                    return null;
                }
                return breadcrumb;
            },
        });

        isInitialized = true;
        console.info('[Sentry] Error tracking initialized');
    } catch (error) {
        console.error('[Sentry] Failed to initialize:', error);
    }
}

// ============================================
// ERROR CAPTURING
// ============================================

/**
 * Capture an error manually
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export function captureError(error, context = {}) {
    if (!isInitialized) {
        console.error('[Sentry] Not initialized, error not captured:', error);
        return;
    }

    Sentry.withScope((scope) => {
        // Add extra context
        if (context.tags) {
            Object.entries(context.tags).forEach(([key, value]) => {
                scope.setTag(key, value);
            });
        }

        if (context.extra) {
            Object.entries(context.extra).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
        }

        if (context.user) {
            scope.setUser(context.user);
        }

        if (context.level) {
            scope.setLevel(context.level);
        }

        Sentry.captureException(error);
    });
}

/**
 * Capture a message (non-error event)
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
export function captureMessage(message, level = 'info', context = {}) {
    if (!isInitialized) {
        console.log(`[Sentry] Not initialized, message not captured: ${message}`);
        return;
    }

    Sentry.withScope((scope) => {
        scope.setLevel(level);

        if (context.tags) {
            Object.entries(context.tags).forEach(([key, value]) => {
                scope.setTag(key, value);
            });
        }

        if (context.extra) {
            Object.entries(context.extra).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
        }

        Sentry.captureMessage(message);
    });
}

// ============================================
// CONTEXT & USER
// ============================================

/**
 * Set user context for all subsequent events
 * @param {Object} user - User information
 */
export function setUser(user) {
    if (!isInitialized) return;
    Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser() {
    if (!isInitialized) return;
    Sentry.setUser(null);
}

/**
 * Add custom tags to all subsequent events
 * @param {Object} tags - Key-value pairs
 */
export function setTags(tags) {
    if (!isInitialized) return;
    Object.entries(tags).forEach(([key, value]) => {
        Sentry.setTag(key, value);
    });
}

/**
 * Add extra context to all subsequent events
 * @param {string} key - Context key
 * @param {any} value - Context value
 */
export function setExtra(key, value) {
    if (!isInitialized) return;
    Sentry.setExtra(key, value);
}

// ============================================
// BREADCRUMBS
// ============================================

/**
 * Add a custom breadcrumb
 * @param {Object} breadcrumb - Breadcrumb data
 */
export function addBreadcrumb(breadcrumb) {
    if (!isInitialized) return;
    Sentry.addBreadcrumb({
        timestamp: Date.now() / 1000,
        ...breadcrumb,
    });
}

/**
 * Add navigation breadcrumb
 * @param {string} from - Previous location
 * @param {string} to - New location
 */
export function addNavigationBreadcrumb(from, to) {
    addBreadcrumb({
        category: 'navigation',
        message: `${from} → ${to}`,
        level: 'info',
    });
}

/**
 * Add user action breadcrumb
 * @param {string} action - Action name
 * @param {Object} data - Additional data
 */
export function addUserActionBreadcrumb(action, data = {}) {
    addBreadcrumb({
        category: 'user',
        message: action,
        level: 'info',
        data,
    });
}

/**
 * Add API call breadcrumb
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {number} status - Response status
 */
export function addApiCallBreadcrumb(method, url, status) {
    addBreadcrumb({
        category: 'http',
        message: `${method} ${url}`,
        level: status >= 400 ? 'error' : 'info',
        data: { status },
    });
}

// ============================================
// PERFORMANCE
// ============================================

/**
 * Start a performance transaction
 * @param {string} name - Transaction name
 * @param {string} op - Operation type
 * @returns {Object|null} Transaction object or null
 */
export function startTransaction(name, op = 'custom') {
    if (!isInitialized) return null;
    return Sentry.startInactiveSpan({ name, op });
}

// ============================================
// ERROR BOUNDARY HELPER
// ============================================

/**
 * Create a wrapped function that catches and reports errors
 * @param {Function} fn - Function to wrap
 * @param {Object} context - Error context
 * @returns {Function} Wrapped function
 */
export function withErrorBoundary(fn, context = {}) {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            captureError(error, {
                tags: { wrapped: true, ...context.tags },
                extra: { args, ...context.extra },
            });
            throw error; // Re-throw to maintain original behavior
        }
    };
}

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

/**
 * Setup global error handlers
 * Call this after initSentry() to catch unhandled errors
 */
export function setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        captureError(event.reason || new Error('Unhandled Promise Rejection'), {
            tags: { type: 'unhandledrejection' },
            extra: { promise: String(event.promise) },
        });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
        // Ignore script loading errors from external sources
        if (event.filename && !event.filename.includes(window.location.origin)) {
            return;
        }

        captureError(event.error || new Error(event.message), {
            tags: { type: 'global_error' },
            extra: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            },
        });
    });
}

// ============================================
// EXPORTS
// ============================================

export default {
    initSentry,
    captureError,
    captureMessage,
    setUser,
    clearUser,
    setTags,
    setExtra,
    addBreadcrumb,
    addNavigationBreadcrumb,
    addUserActionBreadcrumb,
    addApiCallBreadcrumb,
    startTransaction,
    withErrorBoundary,
    setupGlobalErrorHandlers,
};
