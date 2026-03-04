// ============================================
// AUTHENTICATION MIDDLEWARE
// JWT token verification and user context
// ============================================

import { verifyToken } from '../services/auth.js';
import { getUserById } from '../services/auth.js';

/**
 * Extract token from request
 * @param {Request} req - Express request
 * @returns {string|null}
 */
function extractToken(req) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    // Also check query param (for WebSocket connections)
    if (req.query.token) {
        return req.query.token;
    }
    
    return null;
}

/**
 * Middleware to authenticate requests
 * Attaches user object to req.user if valid token
 */
export async function authenticate(req, res, next) {
    const token = extractToken(req);
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'MISSING_TOKEN',
        });
    }
    
    try {
        const payload = verifyToken(token);
        
        // Verify user still exists and is active
        const user = await getUserById(payload.userId);
        
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'User not found or inactive',
                code: 'INVALID_USER',
            });
        }
        
        // Attach user to request
        req.user = {
            id: user.id,
            username: user.username,
            role: user.role,
        };
        
        // Attach token payload for additional info
        req.tokenPayload = payload;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'INVALID_TOKEN',
            });
        }
        
        console.error('[Auth Middleware] Error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
            code: 'AUTH_ERROR',
        });
    }
}

/**
 * Middleware to require admin role
 * Must be used after authenticate()
 */
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'MISSING_TOKEN',
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required',
            code: 'FORBIDDEN',
        });
    }
    
    next();
}

/**
 * Optional authentication - attaches user if token is valid, but doesn't require it
 */
export async function optionalAuthenticate(req, res, next) {
    const token = extractToken(req);
    
    if (!token) {
        return next();
    }
    
    try {
        const payload = verifyToken(token);
        const user = await getUserById(payload.userId);
        
        if (user && user.is_active) {
            req.user = {
                id: user.id,
                username: user.username,
                role: user.role,
            };
            req.tokenPayload = payload;
        }
    } catch (error) {
        // Ignore errors for optional auth
    }
    
    next();
}

export default {
    authenticate,
    requireAdmin,
    optionalAuthenticate,
    extractToken,
};
