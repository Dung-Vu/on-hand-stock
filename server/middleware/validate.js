// ============================================
// INPUT VALIDATION MIDDLEWARE
// Using Zod for schema validation
// ============================================

import { z } from 'zod';

// ============================================
// SCHEMAS
// ============================================

// Odoo authentication schema
export const odooAuthSchema = z.object({
    url: z.string().url().optional(),
    db: z.string().min(1).max(100).optional(),
    username: z.string().email().optional(),
    password: z.string().min(1).max(200).optional()
});

// Stock query schema
export const stockQuerySchema = z.object({
    warehouse: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(10000).optional(),
    offset: z.coerce.number().int().min(0).optional()
});

// Generic JSON-RPC request schema
export const jsonRpcSchema = z.object({
    jsonrpc: z.literal('2.0'),
    method: z.string().min(1).max(100),
    params: z.record(z.any()).optional(),
    id: z.union([z.string(), z.number()]).optional()
});

// ============================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================

/**
 * Create validation middleware for request body
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export function validateBody(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                return res.status(400).json({
                    error: 'Validation Error',
                    details: result.error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }
            req.validatedBody = result.data;
            next();
        } catch (error) {
            console.error('Validation middleware error:', error);
            res.status(500).json({ error: 'Internal validation error' });
        }
    };
}

/**
 * Create validation middleware for query parameters
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export function validateQuery(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success) {
                return res.status(400).json({
                    error: 'Validation Error',
                    details: result.error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }
            req.validatedQuery = result.data;
            next();
        } catch (error) {
            console.error('Validation middleware error:', error);
            res.status(500).json({ error: 'Internal validation error' });
        }
    };
}

/**
 * Sanitize string input - remove potential XSS
 * @param {string} input
 * @returns {string}
 */
export function sanitizeString(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
}

/**
 * Sanitize request middleware
 * Cleans all string inputs in body and query
 */
export function sanitizeRequest(req, res, next) {
    // Sanitize query params
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeString(req.query[key]);
            }
        });
    }

    // Sanitize body (shallow)
    if (req.body && typeof req.body === 'object') {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeString(req.body[key]);
            }
        });
    }

    next();
}

// Re-export zod for custom schemas
export { z };
