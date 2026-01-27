// ============================================
// CIRCUIT BREAKER - Resilient API Error Handling
// ============================================

import { signal } from '@preact/signals-core';

// ============================================
// CIRCUIT BREAKER STATES
// ============================================

const STATE_CLOSED = 'CLOSED'; // Normal operation
const STATE_OPEN = 'OPEN'; // Circuit tripped, reject requests
const STATE_HALF_OPEN = 'HALF_OPEN'; // Testing if service recovered

// ============================================
// CIRCUIT BREAKER CLASS
// ============================================

export class CircuitBreaker {
    constructor(options = {}) {
        // Configuration
        this.threshold = options.threshold || 5; // Failures before opening
        this.timeout = options.timeout || 60000; // Reset timeout (1 minute)
        this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
        this.volumeThreshold = options.volumeThreshold || 10; // Min requests before evaluation

        // State
        this.state = signal(STATE_CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.requestCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;

        // Statistics
        this.stats = signal({
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            totalRejections: 0,
            lastFailure: null,
            lastSuccess: null,
            state: STATE_CLOSED
        });

        // Start monitoring
        this.startMonitoring();
    }

    // ============================================
    // CORE CIRCUIT BREAKER LOGIC
    // ============================================

    async execute(fn, fallback = null) {
        // Check if circuit is open
        if (this.state.value === STATE_OPEN) {
            // Check if timeout elapsed
            if (Date.now() >= this.nextAttemptTime) {
                this.state.value = STATE_HALF_OPEN;
                console.log('[Circuit Breaker] Half-open, testing service...');
            } else {
                this.recordRejection();

                // Execute fallback if provided
                if (fallback) {
                    console.log('[Circuit Breaker] Open, using fallback');
                    return await fallback();
                }

                throw new Error('Circuit breaker is OPEN');
            }
        }

        // Execute request
        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure();

            // In half-open state, reopen on failure
            if (this.state.value === STATE_HALF_OPEN) {
                this.open();
            }

            // Execute fallback if provided
            if (fallback) {
                console.log('[Circuit Breaker] Error, using fallback:', error.message);
                return await fallback();
            }

            throw error;
        }
    }

    // ============================================
    // STATE MANAGEMENT
    // ============================================

    recordSuccess() {
        this.successCount++;
        this.requestCount++;

        // Update stats
        const stats = this.stats.value;
        this.stats.value = {
            ...stats,
            totalRequests: stats.totalRequests + 1,
            totalSuccesses: stats.totalSuccesses + 1,
            lastSuccess: Date.now()
        };

        // If in half-open state, close circuit after success
        if (this.state.value === STATE_HALF_OPEN) {
            this.close();
        }
    }

    recordFailure() {
        this.failureCount++;
        this.requestCount++;
        this.lastFailureTime = Date.now();

        // Update stats
        const stats = this.stats.value;
        this.stats.value = {
            ...stats,
            totalRequests: stats.totalRequests + 1,
            totalFailures: stats.totalFailures + 1,
            lastFailure: Date.now()
        };

        // Check if threshold exceeded
        if (this.shouldOpen()) {
            this.open();
        }
    }

    recordRejection() {
        const stats = this.stats.value;
        this.stats.value = {
            ...stats,
            totalRejections: stats.totalRejections + 1
        };
    }

    shouldOpen() {
        // Need minimum volume
        if (this.requestCount < this.volumeThreshold) {
            return false;
        }

        // Check failure rate
        const failureRate = this.failureCount / this.requestCount;
        return this.failureCount >= this.threshold || failureRate > 0.5;
    }

    open() {
        if (this.state.value === STATE_OPEN) return;

        this.state.value = STATE_OPEN;
        this.nextAttemptTime = Date.now() + this.timeout;

        // Update stats
        const stats = this.stats.value;
        this.stats.value = { ...stats, state: STATE_OPEN };

        console.warn(
            `[Circuit Breaker] OPENED - ${this.failureCount} failures. ` +
            `Will retry at ${new Date(this.nextAttemptTime).toLocaleTimeString()}`
        );
    }

    close() {
        if (this.state.value === STATE_CLOSED) return;

        this.state.value = STATE_CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = null;

        // Update stats
        const stats = this.stats.value;
        this.stats.value = { ...stats, state: STATE_CLOSED };

        console.log('[Circuit Breaker] CLOSED - Service recovered');
    }

    // ============================================
    // MONITORING & RESET
    // ============================================

    startMonitoring() {
        // Reset counters periodically
        setInterval(() => {
            if (this.state.value === STATE_CLOSED) {
                this.requestCount = 0;
                this.failureCount = 0;
                this.successCount = 0;
            }
        }, this.monitoringPeriod);
    }

    reset() {
        this.state.value = STATE_CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.requestCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;

        // Reset stats
        this.stats.value = {
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            totalRejections: 0,
            lastFailure: null,
            lastSuccess: null,
            state: STATE_CLOSED
        };

        console.log('[Circuit Breaker] Manual reset');
    }

    // ============================================
    // GETTERS
    // ============================================

    getState() {
        return this.state.value;
    }

    getStats() {
        return this.stats.value;
    }

    isOpen() {
        return this.state.value === STATE_OPEN;
    }

    isClosed() {
        return this.state.value === STATE_CLOSED;
    }

    isHalfOpen() {
        return this.state.value === STATE_HALF_OPEN;
    }
}

// ============================================
// FACTORY & EXPORTS
// ============================================

// Create default circuit breaker instance
export const defaultCircuitBreaker = new CircuitBreaker({
    threshold: 5, // Open after 5 failures
    timeout: 60000, // 1 minute timeout
    monitoringPeriod: 10000, // 10 second monitoring window
    volumeThreshold: 10 // Minimum 10 requests before evaluation
});

// Helper to wrap API calls
export function withCircuitBreaker(fn, options = {}) {
    const breaker = options.breaker || defaultCircuitBreaker;
    const fallback = options.fallback || null;

    return async (...args) => {
        return breaker.execute(() => fn(...args), fallback);
    };
}

// Export circuit breaker state for monitoring
export const circuitBreakerState = defaultCircuitBreaker.state;
export const circuitBreakerStats = defaultCircuitBreaker.stats;
