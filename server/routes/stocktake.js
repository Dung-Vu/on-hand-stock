// ============================================
// STOCKTAKE ROUTES
// Session and line management
// ============================================

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as stocktakeService from '../services/stocktake.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/stocktake/sessions
 * List stocktake sessions with optional filters
 * Query params: month, warehouse, status, limit, offset
 */
router.get('/sessions', async (req, res) => {
    try {
        const { month, warehouse, status, limit, offset } = req.query;
        
        const sessions = await stocktakeService.listSessions({
            month,
            warehouse,
            status,
            limit: limit ? parseInt(limit) : 100,
            offset: offset ? parseInt(offset) : 0,
        });
        
        res.json({
            success: true,
            data: sessions,
        });
    } catch (error) {
        console.error('[Stocktake Route] List sessions error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/stocktake/sessions
 * Create a new stocktake session
 * Body: { month, warehouse }
 */
router.post('/sessions', async (req, res) => {
    try {
        const { month, warehouse } = req.body;
        
        if (!month || !warehouse) {
            return res.status(400).json({
                success: false,
                error: 'Month and warehouse required',
            });
        }
        
        // Validate month format (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({
                success: false,
                error: 'Month must be in YYYY-MM format',
            });
        }
        
        const session = await stocktakeService.createSession({
            month,
            warehouse,
            createdBy: req.user.id,
        });
        
        res.status(201).json({
            success: true,
            data: session,
        });
    } catch (error) {
        console.error('[Stocktake Route] Create session error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/stocktake/sessions/:id
 * Get session by ID with lines
 */
router.get('/sessions/:id', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        const session = await stocktakeService.getSessionById(sessionId);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }
        
        // Get lines
        const lines = await stocktakeService.getSessionLines(sessionId);
        
        // Get stats
        const stats = await stocktakeService.getSessionStats(sessionId);
        
        res.json({
            success: true,
            data: {
                ...session,
                lines,
                stats,
            },
        });
    } catch (error) {
        console.error('[Stocktake Route] Get session error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/stocktake/sessions/by-month-warehouse
 * Get session by month and warehouse
 * Query params: month, warehouse
 */
router.get('/sessions/by-month-warehouse', async (req, res) => {
    try {
        const { month, warehouse } = req.query;
        
        if (!month || !warehouse) {
            return res.status(400).json({
                success: false,
                error: 'Month and warehouse required',
            });
        }
        
        const session = await stocktakeService.getSessionByMonthWarehouse(month, warehouse);
        
        if (!session) {
            // Return empty session structure
            return res.json({
                success: true,
                data: null,
            });
        }
        
        // Get lines
        const lines = await stocktakeService.getSessionLines(session.id);
        
        // Get stats
        const stats = await stocktakeService.getSessionStats(session.id);
        
        res.json({
            success: true,
            data: {
                ...session,
                lines,
                stats,
            },
        });
    } catch (error) {
        console.error('[Stocktake Route] Get session by month/warehouse error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * PUT /api/stocktake/sessions/:id/lines
 * Bulk upsert lines
 * Body: { lines: [{ productId, productName, systemQty, countedQty?, note? }] }
 */
router.put('/sessions/:id/lines', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        const { lines } = req.body;
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        if (!lines || !Array.isArray(lines)) {
            return res.status(400).json({
                success: false,
                error: 'Lines array required',
            });
        }
        
        const results = await stocktakeService.bulkUpsertLines(
            sessionId,
            lines,
            req.user.id
        );
        
        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('[Stocktake Route] Bulk upsert lines error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/stocktake/sessions/:id/line
 * Upsert a single line
 * Body: { productId, productName, systemQty, countedQty?, note? }
 */
router.post('/sessions/:id/line', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        const { productId, productName, systemQty, countedQty, note } = req.body;
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        if (!productId || !productName || systemQty === undefined) {
            return res.status(400).json({
                success: false,
                error: 'productId, productName, and systemQty required',
            });
        }
        
        const line = await stocktakeService.upsertLine({
            sessionId,
            productId,
            productName,
            systemQty,
            countedQty: countedQty !== undefined ? countedQty : null,
            note,
            countedBy: req.user.id,
        });
        
        res.json({
            success: true,
            data: line,
        });
    } catch (error) {
        console.error('[Stocktake Route] Upsert line error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/stocktake/sessions/:id/lock
 * Lock session
 */
router.post('/sessions/:id/lock', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        const session = await stocktakeService.lockSession(sessionId, req.user.id);
        
        if (!session) {
            return res.status(400).json({
                success: false,
                error: 'Session not found or already locked',
            });
        }
        
        res.json({
            success: true,
            data: session,
        });
    } catch (error) {
        console.error('[Stocktake Route] Lock session error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/stocktake/sessions/:id/unlock
 * Unlock session
 */
router.post('/sessions/:id/unlock', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        const session = await stocktakeService.unlockSession(sessionId);
        
        if (!session) {
            return res.status(400).json({
                success: false,
                error: 'Session not found or not locked',
            });
        }
        
        res.json({
            success: true,
            data: session,
        });
    } catch (error) {
        console.error('[Stocktake Route] Unlock session error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/stocktake/sessions/:id/complete
 * Complete session
 */
router.post('/sessions/:id/complete', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        const session = await stocktakeService.completeSession(sessionId, req.user.id);
        
        if (!session) {
            return res.status(400).json({
                success: false,
                error: 'Session not found',
            });
        }
        
        res.json({
            success: true,
            data: session,
        });
    } catch (error) {
        console.error('[Stocktake Route] Complete session error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * DELETE /api/stocktake/sessions/:id
 * Delete session
 */
router.delete('/sessions/:id', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        const deleted = await stocktakeService.deleteSession(sessionId);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }
        
        res.json({
            success: true,
            message: 'Session deleted successfully',
        });
    } catch (error) {
        console.error('[Stocktake Route] Delete session error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/stocktake/sessions/:id/stats
 * Get session statistics
 */
router.get('/sessions/:id/stats', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.id);
        
        if (isNaN(sessionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid session ID',
            });
        }
        
        const stats = await stocktakeService.getSessionStats(sessionId);
        
        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('[Stocktake Route] Get stats error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
