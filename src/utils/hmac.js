// ============================================
// HMAC REQUEST SIGNING UTILITY (CLIENT-SIDE)
// Signs API requests using HMAC-SHA256
// ============================================

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get API secret from config
 * In production, this should be securely stored and not exposed in client code
 * For internal apps, can use a shared secret
 */
function getApiSecret() {
    // Try to get from window config first
    if (typeof window !== 'undefined' && window.ODOO_CONFIG?.apiSecret) {
        return window.ODOO_CONFIG.apiSecret;
    }
    // Fallback for development
    return 'dev-secret-change-in-production';
}

// ============================================
// CRYPTO UTILITIES
// ============================================

/**
 * Convert string to ArrayBuffer
 * @param {string} str - Input string
 * @returns {ArrayBuffer}
 */
function stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

/**
 * Convert ArrayBuffer to hex string
 * @param {ArrayBuffer} buffer - Input buffer
 * @returns {string} - Hex string
 */
function arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generate SHA-256 hash of a string
 * @param {string} message - Message to hash
 * @returns {Promise<string>} - Hex-encoded hash
 */
async function sha256(message) {
    const msgBuffer = stringToArrayBuffer(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return arrayBufferToHex(hashBuffer);
}

/**
 * Generate HMAC-SHA256 signature
 * @param {string} message - Message to sign
 * @param {string} secret - Secret key
 * @returns {Promise<string>} - Hex-encoded signature
 */
async function hmacSha256(message, secret) {
    const keyData = stringToArrayBuffer(secret);
    const msgData = stringToArrayBuffer(message);

    // Import the secret as a CryptoKey
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // Sign the message
    const signature = await crypto.subtle.sign('HMAC', key, msgData);
    return arrayBufferToHex(signature);
}

// ============================================
// REQUEST SIGNING
// ============================================

/**
 * Create signing payload from request details
 * @param {Object} params - Request parameters
 * @param {number} params.timestamp - Unix timestamp (ms)
 * @param {string} params.method - HTTP method
 * @param {string} params.path - Request path (including query string)
 * @param {Object|null} params.body - Request body (for POST/PUT)
 * @returns {Promise<string>} - Payload string for signing
 */
async function createSigningPayload({ timestamp, method, path, body }) {
    let bodyPart = '';

    if (body && Object.keys(body).length > 0) {
        const bodyStr = JSON.stringify(body);
        bodyPart = await sha256(bodyStr);
    }

    return `${timestamp}:${method.toUpperCase()}:${path}:${bodyPart}`;
}

/**
 * Sign an API request
 * @param {Object} params - Request parameters
 * @param {string} params.method - HTTP method (GET, POST, etc.)
 * @param {string} params.url - Full request URL
 * @param {Object|null} params.body - Request body (for POST/PUT)
 * @returns {Promise<Object>} - Headers to add to the request
 */
export async function signRequest({ method, url, body = null }) {
    const secret = getApiSecret();
    const timestamp = Date.now();

    // Extract path from URL (remove origin)
    let path;
    try {
        const urlObj = new URL(url);
        path = urlObj.pathname + urlObj.search;
    } catch {
        // If URL parsing fails, use as-is
        path = url;
    }

    // Create payload and sign
    const payload = await createSigningPayload({ timestamp, method, path, body });
    const signature = await hmacSha256(payload, secret);

    return {
        'X-Timestamp': timestamp.toString(),
        'X-Signature': signature
    };
}

/**
 * Create a signed fetch wrapper
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
export async function signedFetch(url, options = {}) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;

    // Generate signature headers
    const signatureHeaders = await signRequest({ method, url, body });

    // Merge with existing headers
    const headers = {
        ...options.headers,
        ...signatureHeaders
    };

    return fetch(url, {
        ...options,
        headers
    });
}

/**
 * Verify if browser supports Web Crypto API
 * @returns {boolean}
 */
export function isHmacSupported() {
    return typeof crypto !== 'undefined' &&
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.subtle.importKey === 'function';
}

export default {
    signRequest,
    signedFetch,
    isHmacSupported
};
