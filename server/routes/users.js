// ============================================
// USERS ROUTES
// User management for admin dashboard
// ============================================

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import * as authService from '../services/auth.js';
import { query } from '../db/index.js';

const router = Router();

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, username, role, is_active, created_at, updated_at, last_login_at, created_by
             FROM users
             ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('[Users API] Get all error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username và mật khẩu là bắt buộc',
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Username phải có ít nhất 3 ký tự',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Mật khẩu phải có ít nhất 6 ký tự',
            });
        }

        if (!['admin', 'counter'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Role phải là admin hoặc counter',
            });
        }

        // Check if username exists
        const existing = await query(
            `SELECT id FROM users WHERE username = $1`,
            [username]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Username đã tồn tại',
            });
        }

        // Hash password
        const passwordHash = await authService.hashPassword(password);

        // Create user
        const result = await query(
            `INSERT INTO users (username, password_hash, role, is_active, created_by)
             VALUES ($1, $2, $3, true, $4)
             RETURNING id, username, role, is_active, created_at`,
            [username, passwordHash, role, req.user.id]
        );

        // Log audit
        await authService.logAudit({
            userId: req.user.id,
            action: 'CREATE_USER',
            entityType: 'user',
            entityId: result.rows[0].id,
            details: `Created user ${username} with role ${role}`,
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Tạo user thành công',
        });
    } catch (error) {
        console.error('[Users API] Create error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'ID không hợp lệ',
            });
        }

        // Prevent deleting self
        if (userId === req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Không thể xóa chính mình',
            });
        }

        // Check if user exists
        const userResult = await query(
            `SELECT username FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User không tồn tại',
            });
        }

        const username = userResult.rows[0].username;

        // Delete user (cascade will handle related records)
        await query(`DELETE FROM users WHERE id = $1`, [userId]);

        // Log audit
        await authService.logAudit({
            userId: req.user.id,
            action: 'DELETE_USER',
            entityType: 'user',
            entityId: userId,
            details: `Deleted user ${username}`,
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            message: 'Xóa user thành công',
        });
    } catch (error) {
        console.error('[Users API] Delete error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * PATCH /api/users/:id/activate
 * Activate/deactivate user (admin only)
 */
router.patch('/:id/activate', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { is_active } = req.body;

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'ID không hợp lệ',
            });
        }

        // Prevent deactivating self
        if (userId === req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Không thể tự deactivate chính mình',
            });
        }

        const result = await query(
            `UPDATE users 
             SET is_active = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, username, role, is_active`,
            [is_active, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User không tồn tại',
            });
        }

        // Log audit
        await authService.logAudit({
            userId: req.user.id,
            action: is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
            entityType: 'user',
            entityId: userId,
            details: `${is_active ? 'Activated' : 'Deactivated'} user ${result.rows[0].username}`,
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            data: result.rows[0],
            message: is_active ? 'Kích hoạt user thành công' : 'Vô hiệu hóa user thành công',
        });
    } catch (error) {
        console.error('[Users API] Activate error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
