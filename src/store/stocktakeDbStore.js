// ============================================
// STOCKTAKE DATABASE STORE
// Sync with PostgreSQL backend instead of localStorage
// ============================================

import { stocktake } from '../services/apiClient.js';

// Cache for current session
let currentSession = null;
let currentMonth = null;
let currentWarehouse = null;

/**
 * Format month as YYYY-MM
 */
function ymKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/**
 * Load or create stocktake session from database
 */
export async function loadStocktakeDb({ month, warehouse }) {
    try {
        currentMonth = month;
        currentWarehouse = warehouse;

        // Try to get existing session
        const result = await stocktake.getSessionByMonthWarehouse(month, warehouse);

        if (result.success && result.data) {
            currentSession = result.data;
            return {
                id: currentSession.id,
                month,
                warehouse,
                status: currentSession.status,
                createdAt: currentSession.created_at,
                updatedAt: currentSession.updated_at,
                lines: (currentSession.lines || []).reduce((acc, line) => {
                    acc[String(line.product_id)] = {
                        counted: line.counted_qty,
                        note: line.note,
                    };
                    return acc;
                }, {}),
                stats: currentSession.stats,
            };
        }

        // No session exists, return empty structure
        currentSession = null;
        return {
            id: null,
            month,
            warehouse,
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lines: {},
            stats: null,
        };
    } catch (error) {
        console.error('[StocktakeDB] Load error:', error);
        // Fallback to empty structure
        return {
            id: null,
            month,
            warehouse,
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lines: {},
            stats: null,
        };
    }
}

/**
 * Save/update session (creates if not exists)
 */
async function ensureSessionExists(month, warehouse) {
    if (currentSession && currentSession.id) {
        return currentSession;
    }

    // Create new session
    const result = await stocktake.createSession(month, warehouse);
    if (result.success) {
        currentSession = result.data;
        return currentSession;
    }

    throw new Error('Failed to create session');
}

/**
 * Set line (counted quantity and note)
 */
export async function setLineDb({ doc, productId, counted, note }) {
    try {
        const pid = String(productId);
        
        // Ensure session exists
        if (!doc.id) {
            await ensureSessionExists(doc.month, doc.warehouse);
            doc.id = currentSession.id;
        }

        // Update single line
        const lineData = {
            productId: parseInt(productId),
            productName: '', // Will be filled by backend from Odoo
            systemQty: 0,    // Will be filled by backend
            countedQty: counted === '' || counted === null || counted === undefined ? null : Number(counted),
            note: note,
        };

        await stocktake.updateLine(doc.id, lineData);

        // Update local cache
        const next = {
            ...doc,
            lines: {
                ...(doc.lines || {}),
                [pid]: {
                    counted: counted === '' || counted === null || counted === undefined ? null : Number(counted),
                    note: note ?? doc.lines?.[pid]?.note ?? '',
                },
            },
            updatedAt: new Date().toISOString(),
        };

        return next;
    } catch (error) {
        console.error('[StocktakeDB] Set line error:', error);
        throw error;
    }
}

/**
 * Bulk update lines (for initial load)
 */
export async function bulkUpdateLinesDb(sessionId, lines, userId) {
    try {
        const result = await stocktake.updateLines(sessionId, lines);
        if (result.success) {
            return result.data;
        }
        throw new Error('Failed to update lines');
    } catch (error) {
        console.error('[StocktakeDB] Bulk update error:', error);
        throw error;
    }
}

/**
 * Lock session
 */
export async function lockStocktakeDb(doc) {
    try {
        if (!doc.id) {
            throw new Error('No session to lock');
        }

        const result = await stocktake.lockSession(doc.id);
        if (result.success) {
            currentSession = result.data;
            return {
                ...doc,
                status: 'locked',
                updatedAt: new Date().toISOString(),
            };
        }
        throw new Error('Failed to lock session');
    } catch (error) {
        console.error('[StocktakeDB] Lock error:', error);
        throw error;
    }
}

/**
 * Unlock session
 */
export async function unlockStocktakeDb(doc) {
    try {
        if (!doc.id) {
            throw new Error('No session to unlock');
        }

        const result = await stocktake.unlockSession(doc.id);
        if (result.success) {
            currentSession = result.data;
            return {
                ...doc,
                status: 'in_progress',
                updatedAt: new Date().toISOString(),
            };
        }
        throw new Error('Failed to unlock session');
    } catch (error) {
        console.error('[StocktakeDB] Unlock error:', error);
        throw error;
    }
}

/**
 * Complete session
 */
export async function completeStocktakeDb(doc) {
    try {
        if (!doc.id) {
            throw new Error('No session to complete');
        }

        const result = await stocktake.completeSession(doc.id);
        if (result.success) {
            currentSession = result.data;
            return {
                ...doc,
                status: 'completed',
                updatedAt: new Date().toISOString(),
            };
        }
        throw new Error('Failed to complete session');
    } catch (error) {
        console.error('[StocktakeDB] Complete error:', error);
        throw error;
    }
}

/**
 * List sessions (for history dropdown)
 */
export async function listStocktakesDb(filters = {}) {
    try {
        const result = await stocktake.listSessions(filters);
        if (result.success) {
            return result.data.map(s => ({
                key: String(s.id),
                id: s.id,
                month: s.month,
                warehouse: s.warehouse,
                status: s.status,
                updatedAt: s.updated_at,
                createdAt: s.created_at,
            }));
        }
        return [];
    } catch (error) {
        console.error('[StocktakeDB] List error:', error);
        return [];
    }
}

/**
 * Get session stats
 */
export async function getSessionStatsDb(sessionId) {
    try {
        const result = await stocktake.getSessionStats(sessionId);
        if (result.success) {
            return result.data;
        }
        return null;
    } catch (error) {
        console.error('[StocktakeDB] Stats error:', error);
        return null;
    }
}

/**
 * Get current session ID
 */
export function getCurrentSessionId() {
    return currentSession?.id || null;
}

/**
 * Clear cache (for logout)
 */
export function clearStocktakeCache() {
    currentSession = null;
    currentMonth = null;
    currentWarehouse = null;
}

export default {
    loadStocktakeDb,
    setLineDb,
    bulkUpdateLinesDb,
    lockStocktakeDb,
    unlockStocktakeDb,
    completeStocktakeDb,
    listStocktakesDb,
    getSessionStatsDb,
    getCurrentSessionId,
    clearStocktakeCache,
};
