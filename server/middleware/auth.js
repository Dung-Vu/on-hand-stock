// ============================================
// HMAC REQUEST SIGNING MIDDLEWARE
// Verifies API requests using HMAC-SHA256 signatures
// ============================================

import crypto from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

// Get API secret from environment (should be a strong random string)
const API_SECRET = process.env.API_SECRET || 'dev-secret-change-in-production';

// Signature expiration time (5 minutes)
const SIGNATURE_EXPIRY_MS = 5 * 60 * 1000;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate HMAC-SHA256 signature
 * @param {string} payload - The string to sign
 * @param {string} secret - The secret key
 * @returns {string} - Hex-encoded signature
 */
export function generateSignature(payload, secret = API_SECRET) {
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison
 * @param {string} payload - The original payload
 * @param {string} signature - The signature to verify
 * @param {string} secret - The secret key
 * @returns {boolean} - True if signature is valid
 */
export function verifySignature(payload, signature, secret = API_SECRET) {
    const expectedSignature = generateSignature(payload, secret);

    // Use timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    } catch {
        // If buffers have different lengths, comparison fails
        return false;
    }
}

/**
 * Create signing payload from request
 * @param {Object} req - Express request object
 * @returns {string} - Payload string for signing
 */
function createSigningPayload(req) {
    const timestamp = req.headers['x-timestamp'];
    const method = req.method.toUpperCase();
    const path = req.originalUrl || req.url;

    // For GET requests, include query string
    // For POST/PUT, include body hash
    let bodyPart = '';
    if (req.body && Object.keys(req.body).length > 0) {
        const bodyStr = JSON.stringify(req.body);
        bodyPart = crypto.createHash('sha256').update(bodyStr).digest('hex');
    }

    return `${timestamp}:${method}:${path}:${bodyPart}`;
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * HMAC signature verification middleware
 * Requires headers:
 *   - X-Timestamp: Unix timestamp (ms) when request was signed
 *   - X-Signature: HMAC-SHA256 signature of the request
 *
 * @param {Object} options - Middleware options
 * @param {boolean} options.required - Whether signature is required (default: true in production)
 * @param {Array<string>} options.excludePaths - Paths to exclude from verification
 * @returns {Function} Express middleware
 */
export function verifyHmacSignature(options = {}) {
    const {
        required = process.env.NODE_ENV === 'production',
        excludePaths = ['/health', '/api/health']
    } = options;

    return (req, res, next) => {
        // Skip excluded paths
        const path = req.originalUrl || req.url;
        if (excludePaths.some(p => path.startsWith(p))) {
            return next();
        }

        const timestamp = req.headers['x-timestamp'];
        const signature = req.headers['x-signature'];

        // Check if headers are present
        if (!timestamp || !signature) {
            if (required) {
                return res.status(401).json({
                    success: false,
                    error: 'Missing authentication headers (X-Timestamp, X-Signature)',
                    code: 'AUTH_MISSING_HEADERS'
                });
            }
            // If not required, continue without verification
            return next();
        }

        // Verify timestamp is not too old (prevent replay attacks)
        const requestTime = parseInt(timestamp, 10);
        const now = Date.now();

        if (isNaN(requestTime)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid timestamp format',
                code: 'AUTH_INVALID_TIMESTAMP'
            });
        }

        if (Math.abs(now - requestTime) > SIGNATURE_EXPIRY_MS) {
            return res.status(401).json({
                success: false,
                error: 'Request timestamp expired. Please sync your system clock.',
                code: 'AUTH_TIMESTAMP_EXPIRED',
                serverTime: now,
                requestTime: requestTime,
                maxAge: SIGNATURE_EXPIRY_MS
            });
        }

        // Create signing payload and verify signature
        const payload = createSigningPayload(req);
        const isValid = verifySignature(payload, signature);

        if (!isValid) {
            console.warn(`[Auth] Invalid signature for ${req.method} ${path}`);
            return res.status(401).json({
                success: false,
                error: 'Invalid request signature',
                code: 'AUTH_INVALID_SIGNATURE'
            });
        }

        // Mark request as authenticated
        req.authenticated = true;
        next();
    };
}

/**
 * Optional HMAC verification (logs but doesn't block)
 * Useful for gradual rollout
 */
export function optionalHmacVerification() {
    return (req, res, next) => {
        const timestamp = req.headers['x-timestamp'];
        const signature = req.headers['x-signature'];

        if (timestamp && signature) {
            const payload = createSigningPayload(req);
            const isValid = verifySignature(payload, signature);

            req.signatureValid = isValid;
            if (!isValid) {
                console.warn(`[Auth] Invalid signature (non-blocking) for ${req.method} ${req.url}`);
            }
        } else {
            req.signatureValid = null; // No signature provided
        }

        next();
    };
}

// ============================================
// HELPER FOR GENERATING CLIENT SECRET
// ============================================

/**
 * Generate a cryptographically secure API secret
 * Run with: node -e "import('./middleware/auth.js').then(m => console.log(m.generateApiSecret()))"
 * @returns {string} - 64-character hex string
 */
export function generateApiSecret() {
    return crypto.randomBytes(32).toString('hex');
}

export default {
    generateSignature,
    verifySignature,
    verifyHmacSignature,
    optionalHmacVerification,
    generateApiSecret
};
