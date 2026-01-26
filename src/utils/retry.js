// ============================================
// RETRY UTILITY - Exponential Backoff
// ============================================

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.onRetry - Callback when retrying (attempt, error, delay)
 * @param {Function} options.shouldRetry - Function to determine if should retry (error) => boolean
 * @returns {Promise} - Result of the function
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        onRetry = null,
        shouldRetry = () => true
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we should retry
            if (attempt >= maxRetries || !shouldRetry(error)) {
                throw error;
            }

            // Calculate delay with exponential backoff + jitter
            const exponentialDelay = baseDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
            const delay = Math.min(exponentialDelay + jitter, maxDelay);

            // Call onRetry callback if provided
            if (onRetry) {
                onRetry(attempt + 1, error, delay);
            }

            // Wait before next attempt
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network errors, 5xx errors)
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
export function isRetryableError(error) {
    // Network errors
    if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ECONNRESET")
    ) {
        return true;
    }

    // HTTP 5xx errors (server errors)
    if (error.message.includes("status: 5")) {
        return true;
    }

    // HTTP 429 (rate limited)
    if (error.message.includes("status: 429")) {
        return true;
    }

    // Don't retry 4xx errors (client errors)
    if (error.message.includes("status: 4")) {
        return false;
    }

    return true;
}

/**
 * Create a retryable fetch wrapper
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {Object} retryOptions - Retry options
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
    return retryWithBackoff(
        async () => {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            return response;
        },
        {
            shouldRetry: isRetryableError,
            ...retryOptions
        }
    );
}
