// ============================================
// MONITORING SERVICE
// Giám sát health check và gửi cảnh báo khi có sự cố
// ============================================

import { config } from 'dotenv';
import { 
    alertServiceDown, 
    alertServiceRecovered, 
    alertHighMemory,
    getAlertConfig 
} from './alerting.js';

config();

// ============================================
// CONFIGURATION
// ============================================

const MONITORING_CONFIG = {
    enabled: process.env.MONITORING_ENABLED !== 'false', // Default: enabled
    checkInterval: parseInt(process.env.MONITORING_INTERVAL || '60000', 10), // 60 seconds default
    healthCheckUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:4001/api/health',
    timeout: parseInt(process.env.MONITORING_TIMEOUT || '5000', 10), // 5 seconds
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '500', 10), // 500 MB default
    consecutiveFailures: parseInt(process.env.CONSECUTIVE_FAILURES || '3', 10), // Alert after 3 failures
};

// ============================================
// MONITORING STATE
// ============================================

let monitoringInterval = null;
let isMonitoring = false;
let consecutiveFailures = 0;
let lastKnownStatus = 'unknown';
let downtimeStartTime = null;
let lastAlertTime = null;
let alertCooldown = 5 * 60 * 1000; // 5 minutes cooldown between alerts

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Kiểm tra health của service
 * @returns {Promise<{healthy: boolean, data: any, error: string}>}
 */
async function checkHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MONITORING_CONFIG.timeout);

        const response = await fetch(MONITORING_CONFIG.healthCheckUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return {
                healthy: false,
                data: null,
                error: `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const data = await response.json();
        return {
            healthy: data.status === 'ok',
            data,
            error: null,
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            return {
                healthy: false,
                data: null,
                error: 'Request timeout',
            };
        }
        return {
            healthy: false,
            data: null,
            error: error.message || 'Unknown error',
        };
    }
}

// ============================================
// MONITORING LOGIC
// ============================================

/**
 * Thực hiện một lần kiểm tra
 */
async function performCheck() {
    if (!MONITORING_CONFIG.enabled) {
        return;
    }

    const result = await checkHealth();
    const now = Date.now();

    if (result.healthy) {
        // Service is healthy
        if (lastKnownStatus === 'down') {
            // Service just recovered
            const downtimeSeconds = downtimeStartTime 
                ? Math.floor((now - downtimeStartTime) / 1000)
                : 0;
            
            console.log(`[Monitoring] Service recovered after ${downtimeSeconds} seconds`);
            await alertServiceRecovered('Stock API', downtimeSeconds);
            downtimeStartTime = null;
        }

        consecutiveFailures = 0;
        lastKnownStatus = 'up';

        // Check memory usage
        if (result.data && result.data.memory) {
            const memoryMB = parseInt(result.data.memory.rss.replace(' MB', ''));
            if (memoryMB > MONITORING_CONFIG.memoryThreshold) {
                const timeSinceLastAlert = lastAlertTime ? (now - lastAlertTime) : Infinity;
                if (timeSinceLastAlert > alertCooldown) {
                    await alertHighMemory(memoryMB, MONITORING_CONFIG.memoryThreshold);
                    lastAlertTime = now;
                }
            }
        }
    } else {
        // Service is down
        consecutiveFailures++;

        if (lastKnownStatus !== 'down') {
            downtimeStartTime = now;
            lastKnownStatus = 'down';
        }

        // Only alert after consecutive failures
        if (consecutiveFailures >= MONITORING_CONFIG.consecutiveFailures) {
            const timeSinceLastAlert = lastAlertTime ? (now - lastAlertTime) : Infinity;
            
            if (timeSinceLastAlert > alertCooldown) {
                console.error(`[Monitoring] Service down detected (${consecutiveFailures} consecutive failures)`);
                await alertServiceDown('Stock API', result.error || 'Unknown error');
                lastAlertTime = now;
            }
        }
    }
}

// ============================================
// MONITORING CONTROL
// ============================================

/**
 * Bắt đầu monitoring
 */
export function startMonitoring() {
    if (isMonitoring) {
        console.warn('[Monitoring] Already monitoring');
        return;
    }

    if (!MONITORING_CONFIG.enabled) {
        console.log('[Monitoring] Monitoring is disabled');
        return;
    }

    const config = getAlertConfig();
    if (!config.telegram.configured && !config.email.configured) {
        console.warn('[Monitoring] Alerting not configured. Monitoring will run but no alerts will be sent.');
    }

    isMonitoring = true;
    console.log(`[Monitoring] Starting monitoring (interval: ${MONITORING_CONFIG.checkInterval}ms)`);
    console.log(`[Monitoring] Health check URL: ${MONITORING_CONFIG.healthCheckUrl}`);

    // Perform initial check
    performCheck();

    // Schedule periodic checks
    monitoringInterval = setInterval(() => {
        performCheck();
    }, MONITORING_CONFIG.checkInterval);
}

/**
 * Dừng monitoring
 */
export function stopMonitoring() {
    if (!isMonitoring) {
        return;
    }

    isMonitoring = false;
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }

    console.log('[Monitoring] Stopped');
}

/**
 * Lấy trạng thái monitoring
 * @returns {Object}
 */
export function getMonitoringStatus() {
    return {
        enabled: MONITORING_CONFIG.enabled,
        isMonitoring,
        lastKnownStatus,
        consecutiveFailures,
        downtimeStartTime,
        config: {
            checkInterval: MONITORING_CONFIG.checkInterval,
            healthCheckUrl: MONITORING_CONFIG.healthCheckUrl,
            timeout: MONITORING_CONFIG.timeout,
            memoryThreshold: MONITORING_CONFIG.memoryThreshold,
            consecutiveFailures: MONITORING_CONFIG.consecutiveFailures,
        },
    };
}

// ============================================
// EXPORTS
// ============================================

export default {
    startMonitoring,
    stopMonitoring,
    getMonitoringStatus,
    performCheck,
};
