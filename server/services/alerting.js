// ============================================
// ALERTING SERVICE
// Gửi thông báo cảnh báo khi có sự cố
// ============================================

import { config } from 'dotenv';
config();

// ============================================
// TIMEZONE UTILITIES
// ============================================

/**
 * Lấy thời gian hiện tại theo múi giờ Việt Nam (UTC+7)
 * Tất cả thông báo sẽ sử dụng múi giờ này để đồng bộ
 * @returns {string} Thời gian đã format: HH:mm:ss DD/MM/YYYY
 */
export function getVietnamTime() {
    const now = new Date();
    
    // Sử dụng Intl.DateTimeFormat để chuyển đổi chính xác sang múi giờ Việt Nam
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const timeObj = {};
    parts.forEach(part => {
        timeObj[part.type] = part.value;
    });
    
    // Format: HH:mm:ss DD/MM/YYYY
    const hours = timeObj.hour.padStart(2, '0');
    const minutes = timeObj.minute.padStart(2, '0');
    const seconds = timeObj.second.padStart(2, '0');
    const day = timeObj.day.padStart(2, '0');
    const month = timeObj.month.padStart(2, '0');
    const year = timeObj.year;
    
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

// ============================================
// CONFIGURATION
// ============================================

const ALERT_CONFIG = {
    // Telegram Bot Configuration
    telegram: {
        enabled: process.env.TELEGRAM_ALERT_ENABLED === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        apiUrl: 'https://api.telegram.org/bot',
    },
    // Email Configuration (optional)
    email: {
        enabled: process.env.EMAIL_ALERT_ENABLED === 'true',
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: process.env.SMTP_PORT || 587,
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: process.env.SMTP_PASS || '',
        fromEmail: process.env.ALERT_FROM_EMAIL || '',
        toEmail: process.env.ALERT_TO_EMAIL || '',
    },
};

// ============================================
// TELEGRAM ALERTING
// ============================================

/**
 * Gửi thông báo qua Telegram
 * @param {string} message - Nội dung thông báo
 * @param {string} level - Mức độ: 'info', 'warning', 'error', 'critical'
 * @returns {Promise<boolean>}
 */
export async function sendTelegramAlert(message, level = 'info') {
    if (!ALERT_CONFIG.telegram.enabled || !ALERT_CONFIG.telegram.botToken || !ALERT_CONFIG.telegram.chatId) {
        console.warn('[Alert] Telegram alerting not configured');
        return false;
    }

    try {
        const emoji = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            critical: '🚨',
        };

        const formattedMessage = `${emoji[level] || '📢'} *[${level.toUpperCase()}]*\n\n${message}\n\n_${getVietnamTime()}_`;

        const url = `${ALERT_CONFIG.telegram.apiUrl}${ALERT_CONFIG.telegram.botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: ALERT_CONFIG.telegram.chatId,
                text: formattedMessage,
                parse_mode: 'Markdown',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Alert] Telegram send failed:', error);
            return false;
        }

        console.log('[Alert] Telegram alert sent successfully');
        return true;
    } catch (error) {
        console.error('[Alert] Telegram alert error:', error.message);
        return false;
    }
}

// ============================================
// EMAIL ALERTING (Optional)
// ============================================

/**
 * Gửi thông báo qua Email
 * @param {string} subject - Tiêu đề email
 * @param {string} message - Nội dung email
 * @returns {Promise<boolean>}
 */
export async function sendEmailAlert(subject, message) {
    if (!ALERT_CONFIG.email.enabled) {
        console.warn('[Alert] Email alerting not configured');
        return false;
    }

    // TODO: Implement email sending using nodemailer or similar
    // For now, just log
    console.log('[Alert] Email alert (not implemented):', subject);
    return false;
}

// ============================================
// UNIFIED ALERT FUNCTION
// ============================================

/**
 * Gửi thông báo qua tất cả các kênh đã cấu hình
 * @param {string} message - Nội dung thông báo
 * @param {string} level - Mức độ: 'info', 'warning', 'error', 'critical'
 * @param {Object} options - Tùy chọn bổ sung
 * @returns {Promise<boolean>}
 */
export async function sendAlert(message, level = 'info', options = {}) {
    const results = [];

    // Send via Telegram
    if (ALERT_CONFIG.telegram.enabled) {
        const telegramResult = await sendTelegramAlert(message, level);
        results.push(telegramResult);
    }

    // Send via Email (if configured)
    if (ALERT_CONFIG.email.enabled && (level === 'error' || level === 'critical')) {
        const emailResult = await sendEmailAlert(`[${level.toUpperCase()}] Alert`, message);
        results.push(emailResult);
    }

    return results.some(result => result === true);
}

// ============================================
// SPECIFIC ALERT TYPES
// ============================================

/**
 * Gửi cảnh báo khi service down
 * @param {string} serviceName - Tên service
 * @param {string} error - Lỗi chi tiết
 */
export async function alertServiceDown(serviceName, error) {
    const message = `🚨 *SERVICE DOWN*\n\n` +
        `*Service:* \`${serviceName}\`\n` +
        `*Trạng thái:* ❌ Không phản hồi\n` +
        `*Lỗi:* ${error}\n` +
        `*Mức độ:* 🔴 CRITICAL\n\n` +
        `⚠️ *Hành động:* Vui lòng kiểm tra ngay!`;

    return await sendAlert(message, 'critical');
}

/**
 * Gửi cảnh báo khi service recovery
 * @param {string} serviceName - Tên service
 * @param {number} downtimeSeconds - Thời gian downtime (giây)
 */
export async function alertServiceRecovered(serviceName, downtimeSeconds) {
    const downtimeFormatted = formatDowntime(downtimeSeconds);
    const message = `✅ *SERVICE RECOVERED*\n\n` +
        `*Service:* \`${serviceName}\`\n` +
        `*Trạng thái:* ✅ Đã phục hồi\n` +
        `*Thời gian downtime:* ${downtimeFormatted}\n` +
        `*Mức độ:* ℹ️ INFO`;

    return await sendAlert(message, 'info');
}

/**
 * Gửi cảnh báo khi memory cao
 * @param {number} memoryMB - Memory usage (MB)
 * @param {number} threshold - Ngưỡng cảnh báo (MB)
 */
export async function alertHighMemory(memoryMB, threshold) {
    const percentage = Math.round((memoryMB / threshold) * 100);
    const message = `⚠️ *HIGH MEMORY USAGE*\n\n` +
        `*Memory hiện tại:* \`${memoryMB} MB\`\n` +
        `*Ngưỡng cảnh báo:* ${threshold} MB\n` +
        `*Vượt ngưỡng:* ${percentage}%\n` +
        `*Mức độ:* ⚠️ WARNING\n\n` +
        `💡 *Khuyến nghị:* Kiểm tra memory leaks hoặc restart service`;

    return await sendAlert(message, 'warning');
}

/**
 * Gửi cảnh báo khi có lỗi API
 * @param {string} endpoint - API endpoint
 * @param {string} error - Lỗi chi tiết
 */
export async function alertApiError(endpoint, error) {
    const message = `❌ *API ERROR*\n\n` +
        `*Endpoint:* \`${endpoint}\`\n` +
        `*Trạng thái:* ❌ Lỗi\n` +
        `*Chi tiết lỗi:* ${error}\n` +
        `*Mức độ:* 🔴 ERROR\n\n` +
        `🔧 *Hành động:* Kiểm tra logs và database connection`;

    return await sendAlert(message, 'error');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format downtime duration
 * @param {number} seconds - Số giây
 * @returns {string}
 */
function formatDowntime(seconds) {
    if (seconds < 60) {
        return `${seconds} giây`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes} phút ${seconds % 60} giây`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} giờ ${minutes} phút`;
    }
}

/**
 * Kiểm tra cấu hình alerting
 * @returns {Object}
 */
export function getAlertConfig() {
    return {
        telegram: {
            enabled: ALERT_CONFIG.telegram.enabled,
            configured: !!(ALERT_CONFIG.telegram.botToken && ALERT_CONFIG.telegram.chatId),
        },
        email: {
            enabled: ALERT_CONFIG.email.enabled,
            configured: !!(ALERT_CONFIG.email.smtpHost && ALERT_CONFIG.email.smtpUser),
        },
    };
}

// ============================================
// EXPORTS
// ============================================

export default {
    sendAlert,
    sendTelegramAlert,
    sendEmailAlert,
    alertServiceDown,
    alertServiceRecovered,
    alertHighMemory,
    alertApiError,
    getAlertConfig,
    getVietnamTime, // Export để các module khác có thể sử dụng
};
