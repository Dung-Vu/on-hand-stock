// ============================================
// WEBSOCKET SERVER
// Real-time stock updates using WebSockets
// ============================================

import { WebSocketServer } from 'ws';
import { config } from 'dotenv';

// Load environment variables
config();

const WS_PORT = process.env.WS_PORT || 4002;

// ============================================
// CLIENT MANAGEMENT
// ============================================

const clients = new Set();

/**
 * Broadcast message to all connected clients
 * @param {Object} message - Message to broadcast
 * @param {WebSocket|null} exclude - Client to exclude from broadcast
 */
export function broadcast(message, exclude = null) {
    const data = JSON.stringify(message);
    let successCount = 0;
    let failCount = 0;

    clients.forEach((client) => {
        if (client !== exclude && client.readyState === 1) { // 1 = OPEN
            try {
                client.send(data);
                successCount++;
            } catch (error) {
                console.error('[WebSocket] Failed to send to client:', error.message);
                failCount++;
            }
        }
    });

    if (successCount > 0 || failCount > 0) {
        console.log(`[WebSocket] Broadcast: ${successCount} sent, ${failCount} failed`);
    }
}

/**
 * Send message to specific client
 * @param {WebSocket} client - Target client
 * @param {Object} message - Message to send
 */
export function sendToClient(client, message) {
    if (client.readyState === 1) {
        try {
            client.send(JSON.stringify(message));
        } catch (error) {
            console.error('[WebSocket] Failed to send to client:', error.message);
        }
    }
}

/**
 * Get number of connected clients
 * @returns {number}
 */
export function getClientCount() {
    return clients.size;
}

// ============================================
// MESSAGE HANDLERS
// ============================================

/**
 * Handle incoming message from client
 * @param {WebSocket} ws - WebSocket client
 * @param {string} data - Message data
 */
function handleMessage(ws, data) {
    try {
        const message = JSON.parse(data);

        switch (message.type) {
            case 'ping':
                sendToClient(ws, { type: 'pong', timestamp: Date.now() });
                break;

            case 'subscribe':
                // Client subscribes to specific warehouse updates
                ws.subscriptions = message.warehouses || [];
                sendToClient(ws, {
                    type: 'subscribed',
                    warehouses: ws.subscriptions,
                });
                console.log(`[WebSocket] Client subscribed to: ${ws.subscriptions.join(', ')}`);
                break;

            case 'unsubscribe':
                ws.subscriptions = [];
                sendToClient(ws, { type: 'unsubscribed' });
                break;

            default:
                console.warn(`[WebSocket] Unknown message type: ${message.type}`);
        }
    } catch (error) {
        console.error('[WebSocket] Error handling message:', error.message);
    }
}

// ============================================
// CONNECTION HANDLERS
// ============================================

/**
 * Handle new WebSocket connection
 * @param {WebSocket} ws - WebSocket client
 * @param {Object} req - HTTP request
 */
function handleConnection(ws, req) {
    const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    console.log(`[WebSocket] Client connected: ${clientId}`);

    // Add to clients set
    clients.add(ws);

    // Initialize client properties
    ws.subscriptions = [];
    ws.clientId = clientId;

    // Send welcome message
    sendToClient(ws, {
        type: 'connected',
        clientId,
        timestamp: Date.now(),
        message: 'Connected to Bonario Stock WebSocket Server',
    });

    // Handle messages
    ws.on('message', (data) => {
        handleMessage(ws, data.toString());
    });

    // Handle ping/pong for keepalive
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
        clients.delete(ws);
        console.log(`[WebSocket] Client disconnected: ${clientId} (code: ${code}, reason: ${reason || 'none'})`);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error(`[WebSocket] Client error (${clientId}):`, error.message);
    });
}

// ============================================
// SERVER SETUP
// ============================================

let wss = null;
let heartbeatInterval = null;

/**
 * Start WebSocket server
 * @param {Object} httpServer - HTTP server instance (optional)
 * @returns {WebSocketServer}
 */
export function startWebSocketServer(httpServer = null) {
    if (wss) {
        console.warn('[WebSocket] Server already running');
        return wss;
    }

    // Create WebSocket server
    const options = httpServer
        ? { server: httpServer } // Attach to existing HTTP server
        : { port: WS_PORT }; // Standalone server

    wss = new WebSocketServer(options);

    wss.on('connection', handleConnection);

    wss.on('error', (error) => {
        console.error('[WebSocket] Server error:', error.message);
    });

    // Heartbeat to detect broken connections
    heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                console.log(`[WebSocket] Terminating inactive client: ${ws.clientId}`);
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000); // Every 30 seconds

    const port = httpServer ? 'attached to HTTP server' : WS_PORT;
    console.log(`[WebSocket] Server started on port ${port}`);
    console.log(`[WebSocket] Clients can connect to: ws://localhost:${WS_PORT}`);

    return wss;
}

/**
 * Stop WebSocket server
 */
export function stopWebSocketServer() {
    if (!wss) {
        return;
    }

    // Clear heartbeat interval
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    // Close all connections
    wss.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
    });

    // Close server
    wss.close(() => {
        console.log('[WebSocket] Server stopped');
    });

    wss = null;
    clients.clear();
}

// ============================================
// STOCK UPDATE HELPERS
// ============================================

/**
 * Broadcast stock update to subscribed clients
 * @param {Object} update - Stock update data
 */
export function broadcastStockUpdate(update) {
    const message = {
        type: 'stock_update',
        data: update,
        timestamp: Date.now(),
    };

    // If update has warehouse info, only send to subscribed clients
    if (update.warehouse) {
        clients.forEach((client) => {
            if (
                client.subscriptions.length === 0 ||
                client.subscriptions.includes(update.warehouse)
            ) {
                sendToClient(client, message);
            }
        });
    } else {
        // Broadcast to all
        broadcast(message);
    }
}

/**
 * Broadcast multiple stock updates
 * @param {Array} updates - Array of stock updates
 */
export function broadcastStockUpdates(updates) {
    const message = {
        type: 'stock_updates',
        data: updates,
        count: updates.length,
        timestamp: Date.now(),
    };

    broadcast(message);
}

// ============================================
// EXPORTS
// ============================================

export default {
    startWebSocketServer,
    stopWebSocketServer,
    broadcast,
    sendToClient,
    broadcastStockUpdate,
    broadcastStockUpdates,
    getClientCount,
};
