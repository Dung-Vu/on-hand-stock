// ============================================
// AUTH SERVICE
// User authentication and JWT token management
// ============================================

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_in_production';
const JWT_EXPIRES_IN = '24h';

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Password hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @returns {string}
 */
export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 */
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

/**
 * Authenticate user
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {Promise<Object|null>} User object with token or null
 */
export async function authenticate(username, password) {
    try {
        const result = await query(
            `SELECT id, username, password_hash, role, is_active, last_login_at 
             FROM users 
             WHERE username = $1 AND is_active = true`,
            [username]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];
        const isValid = await comparePassword(password, user.password_hash);

        if (!isValid) {
            return null;
        }

        // Update last login
        await query(
            `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
            [user.id]
        );

        // Generate token
        const token = generateToken({
            userId: user.id,
            username: user.username,
            role: user.role,
        });

        return {
            id: user.id,
            username: user.username,
            role: user.role,
            token,
        };
    } catch (error) {
        console.error('[Auth] Authentication error:', error.message);
        throw error;
    }
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @param {string} userData.username - Username
 * @param {string} userData.password - Plain text password
 * @param {string} userData.role - Role (admin | counter)
 * @param {number} createdBy - ID of user creating this account
 * @returns {Promise<Object>} Created user
 */
export async function createUser({ username, password, role = 'counter' }, createdBy) {
    try {
        // Check if user exists
        const existing = await query(
            `SELECT id FROM users WHERE username = $1`,
            [username]
        );

        if (existing.rows.length > 0) {
            const error = new Error('Username already exists');
            error.code = 'USER_EXISTS';
            throw error;
        }

        const passwordHash = await hashPassword(password);

        const result = await query(
            `INSERT INTO users (username, password_hash, role, created_by) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, username, role, is_active, created_at`,
            [username, passwordHash, role, createdBy]
        );

        return result.rows[0];
    } catch (error) {
        if (error.code !== 'USER_EXISTS') {
            console.error('[Auth] Create user error:', error.message);
        }
        throw error;
    }
}

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>}
 */
export async function getUserById(userId) {
    const result = await query(
        `SELECT id, username, role, is_active, created_at, last_login_at 
         FROM users 
         WHERE id = $1`,
        [userId]
    );

    return result.rows[0] || null;
}

/**
 * Get user by username
 * @param {string} username - Username
 * @returns {Promise<Object|null>}
 */
export async function getUserByUsername(username) {
    const result = await query(
        `SELECT id, username, role, is_active, created_at, last_login_at 
         FROM users 
         WHERE username = $1`,
        [username]
    );

    return result.rows[0] || null;
}

/**
 * List all users (admin only)
 * @returns {Promise<Array>}
 */
export async function listUsers() {
    const result = await query(
        `SELECT id, username, role, is_active, created_at, last_login_at, created_by
         FROM users 
         ORDER BY created_at DESC`,
        []
    );

    return result.rows;
}

/**
 * Update user
 * @param {number} userId - User ID to update
 * @param {Object} updates - Fields to update
 * @param {string} [updates.password] - New password
 * @param {string} [updates.role] - New role
 * @param {boolean} [updates.is_active] - Active status
 * @returns {Promise<Object>} Updated user
 */
export async function updateUser(userId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.password !== undefined) {
        const passwordHash = await hashPassword(updates.password);
        fields.push(`password_hash = $${paramIndex++}`);
        values.push(passwordHash);
    }

    if (updates.role !== undefined) {
        fields.push(`role = $${paramIndex++}`);
        values.push(updates.role);
    }

    if (updates.is_active !== undefined) {
        fields.push(`is_active = $${paramIndex++}`);
        values.push(updates.is_active);
    }

    if (fields.length === 0) {
        return getUserById(userId);
    }

    values.push(userId);
    
    const result = await query(
        `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() 
         WHERE id = $${paramIndex} 
         RETURNING id, username, role, is_active, created_at, last_login_at`,
        values
    );

    return result.rows[0];
}

/**
 * Delete user (soft delete - deactivate)
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function deleteUser(userId) {
    const result = await query(
        `UPDATE users SET is_active = false, updated_at = NOW() 
         WHERE id = $1 
         RETURNING id`,
        [userId]
    );

    return result.rows.length > 0;
}

/**
 * Log audit action
 * @param {Object} data - Audit data
 * @returns {Promise<void>}
 */
export async function logAudit({ userId, action, entityType, entityId, details, ipAddress, userAgent }) {
    try {
        await query(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
            [userId, action, entityType, entityId, JSON.stringify(details), ipAddress, userAgent]
        );
    } catch (error) {
        console.error('[Auth] Audit log error:', error.message);
    }
}

export default {
    hashPassword,
    comparePassword,
    generateToken,
    verifyToken,
    authenticate,
    createUser,
    getUserById,
    getUserByUsername,
    listUsers,
    updateUser,
    deleteUser,
    logAudit,
};
