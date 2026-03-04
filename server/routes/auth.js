// ============================================
// AUTH ROUTES
// Login, register, user management
// ============================================

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import * as authService from '../services/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password required',
            });
        }
        
        const result = await authService.authenticate(username, password);
        
        if (!result) {
            return res.status(401).json({
                success: false,
                error: 'Invalid username or password',
            });
        }
        
        // Log audit
        await authService.logAudit({
            userId: result.id,
            action: 'LOGIN',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[Auth Route] Login error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout (client should discard token)
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        // Log audit
        await authService.logAudit({
            userId: req.user.id,
            action: 'LOGOUT',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        
        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('[Auth Route] Logout error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await authService.getUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        
        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('[Auth Route] Get me error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/auth/users
 * List all users (admin only)
 */
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const users = await authService.listUsers();
        
        res.json({
            success: true,
            data: users,
        });
    } catch (error) {
        console.error('[Auth Route] List users error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/users
 * Create new user (admin only)
 */
router.post('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password required',
            });
        }
        
        if (role && !['admin', 'counter'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Role must be "admin" or "counter"',
            });
        }
        
        const user = await authService.createUser(
            { username, password, role: role || 'counter' },
            req.user.id
        );
        
        // Log audit
        await authService.logAudit({
            userId: req.user.id,
            action: 'CREATE_USER',
            entityType: 'user',
            entityId: user.id,
            details: { username: user.username, role: user.role },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        
        res.status(201).json({
            success: true,
            data: user,
        });
    } catch (error) {
        if (error.code === 'USER_EXISTS') {
            return res.status(409).json({
                success: false,
                error: error.message,
            });
        }
        
        console.error('[Auth Route] Create user error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * PUT /api/auth/users/:id
 * Update user (admin only)
 */
router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { password, role, is_active } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
            });
        }
        
        // Prevent self-demotion
        if (userId === req.user.id && role && role !== 'admin') {
            return res.status(400).json({
                success: false,
                error: 'Cannot change your own role',
            });
        }
        
        const updates = {};
        if (password) updates.password = password;
        if (role) updates.role = role;
        if (is_active !== undefined) updates.is_active = is_active;
        
        const user = await authService.updateUser(userId, updates);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        
        // Log audit
        await authService.logAudit({
            userId: req.user.id,
            action: 'UPDATE_USER',
            entityType: 'user',
            entityId: userId,
            details: { updates },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        
        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error('[Auth Route] Update user error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * DELETE /api/auth/users/:id
 * Delete user (soft delete - admin only)
 */
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID',
            });
        }
        
        // Prevent self-deletion
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete yourself',
            });
        }
        
        const deleted = await authService.deleteUser(userId);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        
        // Log audit
        await authService.logAudit({
            userId: req.user.id,
            action: 'DELETE_USER',
            entityType: 'user',
            entityId: userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        
        res.json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        console.error('[Auth Route] Delete user error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
