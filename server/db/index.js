// ============================================
// DATABASE CONNECTION
// PostgreSQL connection pool
// ============================================

import { Pool } from 'pg';
import { config } from 'dotenv';

config();

// Database connection configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false, // Disable SSL for Docker internal network
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
    process.exit(-1);
});

/**
 * Execute a query with optional parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<QueryResult>}
 */
export async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('[DB] Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount });
        }
        
        return result;
    } catch (error) {
        console.error('[DB] Query error', { text: text.substring(0, 100), error: error.message });
        throw error;
    }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<PoolClient>}
 */
export async function getClient() {
    const client = await pool.connect();
    const query = client.query.bind(client);
    const release = client.release.bind(client);
    
    // Set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
        console.error('[DB] A client has been checked out for more than 5 seconds!');
    }, 5000);
    
    // Monkey patch the release method to clear our timeout
    client.release = () => {
        clearTimeout(timeout);
        return release();
    };
    
    return client;
}

/**
 * Health check
 * @returns {Promise<boolean>}
 */
export async function healthCheck() {
    try {
        await query('SELECT NOW()');
        return true;
    } catch (error) {
        console.error('[DB] Health check failed:', error.message);
        return false;
    }
}

/**
 * Get pool stats
 * @returns {Object}
 */
export function getStats() {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
}

export default {
    query,
    getClient,
    healthCheck,
    getStats,
};
