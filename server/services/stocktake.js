// ============================================
// STOCKTAKE SERVICE
// Stocktake session and line management
// ============================================

import { query, getClient } from '../db/index.js';

/**
 * Create a new stocktake session
 * @param {Object} data - Session data
 * @param {string} data.month - Month (YYYY-MM)
 * @param {string} data.warehouse - Warehouse name
 * @param {number} data.createdBy - User ID
 * @returns {Promise<Object>} Created session
 */
export async function createSession({ month, warehouse, createdBy }) {
    try {
        const result = await query(
            `INSERT INTO stocktake_sessions (month, warehouse, created_by, status)
             VALUES ($1, $2, $3, 'draft')
             ON CONFLICT (month, warehouse) DO UPDATE
             SET updated_at = NOW(), status = 'draft'
             RETURNING *`,
            [month, warehouse, createdBy]
        );

        return result.rows[0];
    } catch (error) {
        console.error('[Stocktake] Create session error:', error.message);
        throw error;
    }
}

/**
 * Get session by ID
 * @param {number} sessionId - Session ID
 * @returns {Promise<Object|null>}
 */
export async function getSessionById(sessionId) {
    const result = await query(
        `SELECT s.*, 
                u.username as created_by_username,
                l.username as locked_by_username,
                c.username as completed_by_username
         FROM stocktake_sessions s
         LEFT JOIN users u ON s.created_by = u.id
         LEFT JOIN users l ON s.locked_by = l.id
         LEFT JOIN users c ON s.completed_by = c.id
         WHERE s.id = $1`,
        [sessionId]
    );

    return result.rows[0] || null;
}

/**
 * Get session by month and warehouse
 * @param {string} month - Month (YYYY-MM)
 * @param {string} warehouse - Warehouse name
 * @returns {Promise<Object|null>}
 */
export async function getSessionByMonthWarehouse(month, warehouse) {
    const result = await query(
        `SELECT s.*, 
                u.username as created_by_username,
                l.username as locked_by_username,
                c.username as completed_by_username
         FROM stocktake_sessions s
         LEFT JOIN users u ON s.created_by = u.id
         LEFT JOIN users l ON s.locked_by = l.id
         LEFT JOIN users c ON s.completed_by = c.id
         WHERE s.month = $1 AND s.warehouse = $2`,
        [month, warehouse]
    );

    return result.rows[0] || null;
}

/**
 * List sessions with filters
 * @param {Object} filters - Filters
 * @param {string} [filters.month] - Filter by month
 * @param {string} [filters.warehouse] - Filter by warehouse
 * @param {string} [filters.status] - Filter by status
 * @param {number} [filters.limit] - Limit results
 * @param {number} [filters.offset] - Offset results
 * @returns {Promise<Array>}
 */
export async function listSessions(filters = {}) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.month) {
        conditions.push(`s.month = $${paramIndex++}`);
        values.push(filters.month);
    }

    if (filters.warehouse) {
        conditions.push(`s.warehouse = $${paramIndex++}`);
        values.push(filters.warehouse);
    }

    if (filters.status) {
        conditions.push(`s.status = $${paramIndex++}`);
        values.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
        `SELECT s.*, 
                u.username as created_by_username,
                l.username as locked_by_username,
                c.username as completed_by_username
         FROM stocktake_sessions s
         LEFT JOIN users u ON s.created_by = u.id
         LEFT JOIN users l ON s.locked_by = l.id
         LEFT JOIN users c ON s.completed_by = c.id
         ${whereClause}
         ORDER BY s.month DESC, s.warehouse ASC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...values, filters.limit || 100, filters.offset || 0]
    );

    return result.rows;
}

/**
 * Get session lines
 * @param {number} sessionId - Session ID
 * @returns {Promise<Array>}
 */
export async function getSessionLines(sessionId) {
    const result = await query(
        `SELECT sl.*, u.username as counted_by_username
         FROM stocktake_lines sl
         LEFT JOIN users u ON sl.counted_by = u.id
         WHERE sl.session_id = $1
         ORDER BY sl.product_name ASC`,
        [sessionId]
    );

    return result.rows;
}

/**
 * Upsert session line (create or update)
 * @param {Object} data - Line data
 * @param {number} data.sessionId - Session ID
 * @param {number} data.productId - Product ID
 * @param {string} data.productName - Product name
 * @param {number} data.systemQty - System quantity
 * @param {number|null} data.countedQty - Counted quantity
 * @param {string} [data.note] - Note
 * @param {number} data.countedBy - User ID who counted
 * @returns {Promise<Object>} Created/updated line
 */
export async function upsertLine({ sessionId, productId, productName, systemQty, countedQty, note, countedBy }) {
    try {
        const result = await query(
            `INSERT INTO stocktake_lines (session_id, product_id, product_name, system_qty, counted_qty, note, counted_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (session_id, product_id) DO UPDATE
             SET counted_qty = $5, note = COALESCE($6, stocktake_lines.note), 
                 counted_by = $7, counted_at = NOW(), updated_at = NOW()
             RETURNING *`,
            [sessionId, productId, productName, systemQty, countedQty, note, countedBy]
        );

        // Update session status to in_progress if it's draft
        await query(
            `UPDATE stocktake_sessions 
             SET status = 'in_progress', updated_at = NOW() 
             WHERE id = $1 AND status = 'draft'`,
            [sessionId]
        );

        return result.rows[0];
    } catch (error) {
        console.error('[Stocktake] Upsert line error:', error.message);
        throw error;
    }
}

/**
 * Bulk upsert lines
 * @param {number} sessionId - Session ID
 * @param {Array} lines - Array of line data
 * @param {number} countedBy - User ID
 * @returns {Promise<Array>}
 */
export async function bulkUpsertLines(sessionId, lines, countedBy) {
    const client = await getClient();
    
    try {
        await client.query('BEGIN');

        const results = [];
        
        for (const line of lines) {
            const result = await client.query(
                `INSERT INTO stocktake_lines (session_id, product_id, product_name, system_qty, counted_qty, note, counted_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (session_id, product_id) DO UPDATE
                 SET counted_qty = $5, note = COALESCE($6, stocktake_lines.note), 
                     counted_by = $7, counted_at = NOW(), updated_at = NOW()
                 RETURNING *`,
                [sessionId, line.productId, line.productName, line.systemQty, line.countedQty, line.note, countedBy]
            );
            results.push(result.rows[0]);
        }

        // Update session status to in_progress if it's draft
        await client.query(
            `UPDATE stocktake_sessions 
             SET status = 'in_progress', updated_at = NOW() 
             WHERE id = $1 AND status = 'draft'`,
            [sessionId]
        );

        await client.query('COMMIT');
        return results;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Stocktake] Bulk upsert error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Lock session
 * @param {number} sessionId - Session ID
 * @param {number} lockedBy - User ID
 * @returns {Promise<Object>} Updated session
 */
export async function lockSession(sessionId, lockedBy) {
    const result = await query(
        `UPDATE stocktake_sessions 
         SET status = 'locked', locked_at = NOW(), locked_by = $1, updated_at = NOW()
         WHERE id = $1 AND status != 'locked'
         RETURNING *`,
        [lockedBy, sessionId]
    );

    return result.rows[0] || null;
}

/**
 * Unlock session
 * @param {number} sessionId - Session ID
 * @returns {Promise<Object>} Updated session
 */
export async function unlockSession(sessionId) {
    const result = await query(
        `UPDATE stocktake_sessions 
         SET status = 'in_progress', locked_at = NULL, locked_by = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'locked'
         RETURNING *`,
        [sessionId]
    );

    return result.rows[0] || null;
}

/**
 * Complete session
 * @param {number} sessionId - Session ID
 * @param {number} completedBy - User ID
 * @returns {Promise<Object>} Updated session
 */
export async function completeSession(sessionId, completedBy) {
    const result = await query(
        `UPDATE stocktake_sessions 
         SET status = 'completed', completed_at = NOW(), completed_by = $1, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [completedBy, sessionId]
    );

    return result.rows[0] || null;
}

/**
 * Delete session
 * @param {number} sessionId - Session ID
 * @returns {Promise<boolean>}
 */
export async function deleteSession(sessionId) {
    const result = await query(
        `DELETE FROM stocktake_sessions WHERE id = $1 RETURNING id`,
        [sessionId]
    );

    return result.rows.length > 0;
}

/**
 * Get session statistics
 * @param {number} sessionId - Session ID
 * @returns {Promise<Object>}
 */
export async function getSessionStats(sessionId) {
    const result = await query(
        `SELECT 
            COUNT(*) as total_products,
            COUNT(CASE WHEN counted_qty IS NOT NULL THEN 1 END) as counted_products,
            COUNT(CASE WHEN counted_qty IS NULL THEN 1 END) as pending_products,
            COALESCE(SUM(system_qty), 0) as total_system_qty,
            COALESCE(SUM(counted_qty), 0) as total_counted_qty,
            COALESCE(SUM(counted_qty - system_qty), 0) as total_variance,
            COUNT(CASE WHEN counted_qty != system_qty AND counted_qty IS NOT NULL THEN 1 END) as variance_products
         FROM stocktake_lines
         WHERE session_id = $1`,
        [sessionId]
    );

    return result.rows[0];
}

export default {
    createSession,
    getSessionById,
    getSessionByMonthWarehouse,
    listSessions,
    getSessionLines,
    upsertLine,
    bulkUpsertLines,
    lockSession,
    unlockSession,
    completeSession,
    deleteSession,
    getSessionStats,
};
