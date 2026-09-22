// ============================================
// ARTE API SERVICE
// Client for ARTE stock check vertical
// ============================================

function getApiBase() {
    if (typeof window === 'undefined') return 'http://localhost:4001';
    if (window.API_BASE_URL) return window.API_BASE_URL;

    const { hostname, protocol, port } = window.location;
    if (hostname.includes('bonstu.site')) return '';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:4001';
    }
    if (/^517\d$/.test(port)) {
        return `${protocol}//${hostname}:4001`;
    }
    return '';
}

const API_BASE = getApiBase();

const DEFAULT_TIMEOUT_MS = 25000;

const FRIENDLY_CODE_MESSAGES = {
    INVALID_REFERENCE: 'Mã sản phẩm không hợp lệ (tối đa 40 ký tự chữ cái, số, dấu chấm, gạch ngang).',
    INVALID_BATCH: 'Lô hàng đã chọn không hợp lệ cho mã sản phẩm này.',
    INVALID_AMOUNT: 'Số lượng tra cứu phải là số lớn hơn 0 và không vượt quá 100.000.',
    INVALID_INPUT: 'Thông tin nhập vào không hợp lệ. Vui lòng kiểm tra lại.',
    PRODUCT_NOT_FOUND: 'Không tìm thấy sản phẩm hoặc lô hàng trên hệ thống ARTE.',
    AUTHENTICATION_FAILED: 'Không thể xác thực với hệ thống ARTE. Vui lòng liên hệ quản trị viên.',
    SESSION_EXPIRED: 'Phiên kết nối ARTE đã hết hạn. Vui lòng thử lại.',
    UPSTREAM_ENDPOINT_MISSING: 'Hệ thống ARTE tạm thời thay đổi giao diện tra cứu, vui lòng liên hệ kỹ thuật.',
    UPSTREAM_TOKEN_MISSING: 'Không thể lấy token bảo mật từ ARTE. Vui lòng thử lại sau.',
    UPSTREAM_SNAPSHOT_MISSING: 'Không tìm thấy dữ liệu form kiểm tra tồn kho từ ARTE.',
    UPSTREAM_UNCLASSIFIED: 'Không thể xác định trạng thái tồn kho từ ARTE. Vui lòng liên hệ bộ phận hỗ trợ.',
    UPSTREAM_UPDATE_ERROR: 'Hệ thống ARTE tạm thời không phản hồi yêu cầu tra cứu. Vui lòng thử lại sau.',
    INVALID_UPSTREAM_RESPONSE: 'Phản hồi từ ARTE không hợp lệ. Vui lòng thử lại sau.',
    UPSTREAM_LOGIN_UNAVAILABLE: 'Không thể truy cập hệ thống đăng nhập ARTE. Vui lòng thử lại sau.',
    RATE_LIMITED: 'Quá nhiều yêu cầu tra cứu trong thời gian ngắn. Vui lòng đợi 1 phút rồi thử lại.',
    QUEUE_FULL: 'Hệ thống tra cứu ARTE đang bận xử lý nhiều yêu cầu, vui lòng thử lại sau giây lát.',
    QUEUE_TIMEOUT: 'Yêu cầu trong hàng đợi đã quá thời gian phản hồi, vui lòng thử lại sau.',
    CLIENT_ABORTED: 'Yêu cầu tra cứu đã bị hủy.',
    TIMEOUT: 'Yêu cầu tới hệ thống ARTE đã quá thời gian phản hồi (timeout). Vui lòng thử lại sau.',
    UPSTREAM_NETWORK_ERROR: 'Không thể kết nối tới máy chủ ARTE. Vui lòng kiểm tra kết nối mạng.',
    ARTE_CONFIG_MISSING: 'Hệ thống chưa được cấu hình tài khoản tra cứu ARTE.',
    UNKNOWN_ERROR: 'Có lỗi xảy ra khi tra cứu từ ARTE. Vui lòng thử lại sau.',
};

/**
 * Map error code to a friendly Vietnamese message.
 * Never leaks raw upstream or internal messages.
 */
function toFriendlyMessage(code) {
    return FRIENDLY_CODE_MESSAGES[code] || FRIENDLY_CODE_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Fetch list of batches for an ARTE reference code.
 * @param {string} reference
 * @returns {Promise<{reference: string, batches: string[], productName?: string, imageUrl?: string, checkedAt: string}>}
 */
export async function fetchArteBatches(reference) {
    const trimmed = (reference || '').trim();
    if (!trimmed) {
        throw new Error('Vui lòng nhập mã sản phẩm ARTE');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE}/api/arte/batches?reference=${encodeURIComponent(trimmed)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            signal: controller.signal,
        });

        const resData = await response.json().catch(() => null);

        if (!response.ok) {
            const code = resData?.code || 'UNKNOWN_ERROR';
            const friendlyMsg = toFriendlyMessage(code);
            const error = new Error(friendlyMsg);
            error.code = code;
            error.status = response.status;
            throw error;
        }

        return resData.data;
    } catch (err) {
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(FRIENDLY_CODE_MESSAGES.TIMEOUT);
            timeoutErr.code = 'TIMEOUT';
            timeoutErr.status = 504;
            throw timeoutErr;
        }
        if (err.code && FRIENDLY_CODE_MESSAGES[err.code]) {
            throw err;
        }
        const networkErr = new Error(FRIENDLY_CODE_MESSAGES.UPSTREAM_NETWORK_ERROR);
        networkErr.code = 'NETWORK_ERROR';
        throw networkErr;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Check stock availability for an ARTE reference, batch, and quantity.
 * Supports decimal quantities.
 * @param {Object} params
 * @param {string} params.reference
 * @param {string} params.batch
 * @param {number|string} params.amount
 * @returns {Promise<{reference: string, batch: string, amount: number, productName?: string, imageUrl?: string, available: boolean, message: string, checkedAt: string}>}
 */
export async function checkArteStock({ reference, batch, amount }) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        throw new Error('Số lượng tra cứu phải lớn hơn 0');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE}/api/arte/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                reference: (reference || '').trim(),
                batch: (batch || '').trim(),
                amount: numAmount,
            }),
            signal: controller.signal,
        });

        const resData = await response.json().catch(() => null);

        if (!response.ok) {
            const code = resData?.code || 'UNKNOWN_ERROR';
            const friendlyMsg = toFriendlyMessage(code);
            const error = new Error(friendlyMsg);
            error.code = code;
            error.status = response.status;
            throw error;
        }

        return resData.data;
    } catch (err) {
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(FRIENDLY_CODE_MESSAGES.TIMEOUT);
            timeoutErr.code = 'TIMEOUT';
            timeoutErr.status = 504;
            throw timeoutErr;
        }
        if (err.code && FRIENDLY_CODE_MESSAGES[err.code]) {
            throw err;
        }
        const networkErr = new Error(FRIENDLY_CODE_MESSAGES.UPSTREAM_NETWORK_ERROR);
        networkErr.code = 'NETWORK_ERROR';
        throw networkErr;
    } finally {
        clearTimeout(timeoutId);
    }
}
