// ============================================
// WEBSOCKET CLIENT
// Real-time stock updates with auto-reconnect
// ============================================

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
    url: null, // Will auto-detect from window.location
    reconnectDelay: 3000, // 3 seconds
    maxReconnectDelay: 30000, // 30 seconds
    reconnectDecay: 1.5, // Exponential backoff multiplier
    maxReconnectAttempts: Infinity,
    heartbeatInterval: 30000, // 30 seconds
};

/**
 * Get WebSocket configuration
 * @returns {Object}
 */
function getConfig() {
    const config = { ...DEFAULT_CONFIG };

    // Auto-detect WebSocket URL from window.location
    if (!config.url && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        // For production tunnel domain, use relative WebSocket path
        // This allows Nginx to proxy WebSocket requests, avoiding CORS issues
        // Nginx is configured to proxy /ws to backend:4001
        if (hostname.includes('bonstu.site')) {
            // Use relative path - Nginx will proxy /ws to backend WebSocket server
            // Convert https://stock.bonstu.site to wss://stock.bonstu.site/ws
            config.url = `${protocol}//${hostname}/ws`;
        }
        // For local development, use the backend port directly
        // Local dev uses 4002, Docker uses 4001
        else if (hostname === 'localhost' || hostname === '127.0.0.1') {
            config.url = 'ws://localhost:4002'; // Local dev port
        }
        // Fallback
        else {
            const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
            config.url = `${protocol}//${hostname}:${port}/ws`;
        }
    }

    // Allow override from window.WS_CONFIG
    if (typeof window !== 'undefined' && window.WS_CONFIG) {
        Object.assign(config, window.WS_CONFIG);
    }

    return config;
}

// ============================================
// WEBSOCKET CLIENT CLASS
// ============================================

class WebSocketClient {
    constructor(config = {}) {
        this.config = { ...getConfig(), ...config };
        this.ws = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.isIntentionallyClosed = false;
        this.subscriptions = [];

        // Event handlers
        this.eventHandlers = {
            open: [],
            close: [],
            error: [],
            message: [],
            reconnect: [],
            stock_update: [],
            stock_updates: [],
        };
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            console.warn('[WebSocket] Already connected or connecting');
            return;
        }

        this.isIntentionallyClosed = false;

        try {
            console.log(`[WebSocket] Connecting to ${this.config.url}...`);
            this.ws = new WebSocket(this.config.url);

            this.ws.onopen = (event) => this.handleOpen(event);
            this.ws.onclose = (event) => this.handleClose(event);
            this.ws.onerror = (event) => this.handleError(event);
            this.ws.onmessage = (event) => this.handleMessage(event);
        } catch (error) {
            console.error('[WebSocket] Connection error:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        this.isIntentionallyClosed = true;
        this.clearTimers();

        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }

        console.log('[WebSocket] Disconnected');
    }

    /**
     * Send message to server
     * @param {Object} message - Message to send
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('[WebSocket] Send error:', error);
                return false;
            }
        }
        console.warn('[WebSocket] Cannot send, not connected');
        return false;
    }

    /**
     * Subscribe to warehouse updates
     * @param {Array<string>} warehouses - Warehouse names
     */
    subscribe(warehouses) {
        this.subscriptions = Array.isArray(warehouses) ? warehouses : [warehouses];
        this.send({
            type: 'subscribe',
            warehouses: this.subscriptions,
        });
    }

    /**
     * Unsubscribe from all updates
     */
    unsubscribe() {
        this.subscriptions = [];
        this.send({ type: 'unsubscribe' });
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
        }
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
    }

    /**
     * Emit event to all listeners
     * @param {string} event - Event name
     * @param {any} data - Event data
     */
    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach((handler) => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`[WebSocket] Error in ${event} handler:`, error);
                }
            });
        }
    }

    // ============================================
    // INTERNAL HANDLERS
    // ============================================

    handleOpen(event) {
        console.log('[WebSocket] Connected successfully');
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // Resubscribe if there were previous subscriptions
        if (this.subscriptions.length > 0) {
            this.subscribe(this.subscriptions);
        }

        this.emit('open', event);
    }

    handleClose(event) {
        console.log(`[WebSocket] Connection closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
        this.clearTimers();

        this.emit('close', event);

        // Reconnect if not intentionally closed
        if (!this.isIntentionallyClosed) {
            this.scheduleReconnect();
        }
    }

    handleError(event) {
        console.error('[WebSocket] Error:', event);
        this.emit('error', event);
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);

            // Emit specific event type if available
            if (message.type) {
                this.emit(message.type, message);
            }

            // Emit generic message event
            this.emit('message', message);

            // Handle specific message types
            switch (message.type) {
                case 'connected':
                    console.log('[WebSocket] Server welcome:', message.message);
                    break;

                case 'pong':
                    // Heartbeat response
                    break;

                case 'stock_update':
                    console.log('[WebSocket] Stock update received:', message.data);
                    break;

                case 'stock_updates':
                    console.log(`[WebSocket] Batch stock updates received: ${message.count} items`);
                    break;

                default:
                    // Unknown message type
                    break;
            }
        } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
        }
    }

    // ============================================
    // RECONNECTION LOGIC
    // ============================================

    scheduleReconnect() {
        if (this.reconnectTimer) {
            return; // Already scheduled
        }

        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnect attempts reached');
            return;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
            this.config.maxReconnectDelay
        );

        this.reconnectAttempts++;

        console.log(`[WebSocket] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.emit('reconnect', { attempt: this.reconnectAttempts });
            this.connect();
        }, delay);
    }

    // ============================================
    // HEARTBEAT
    // ============================================

    startHeartbeat() {
        this.clearHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, this.config.heartbeatInterval);
    }

    clearHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // ============================================
    // UTILITY
    // ============================================

    clearTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.clearHeartbeat();
    }

    /**
     * Get connection state
     * @returns {string}
     */
    getState() {
        if (!this.ws) return 'CLOSED';

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance = null;

/**
 * Get WebSocket client instance (singleton)
 * @param {Object} config - Configuration options
 * @returns {WebSocketClient}
 */
export function getWebSocketClient(config = {}) {
    if (!instance) {
        instance = new WebSocketClient(config);
    }
    return instance;
}

/**
 * Initialize and connect WebSocket client
 * @param {Object} config - Configuration options
 * @returns {WebSocketClient}
 */
export function initWebSocket(config = {}) {
    const client = getWebSocketClient(config);

    if (!client.isConnected()) {
        client.connect();
    }

    return client;
}

// ============================================
// EXPORTS
// ============================================

export default {
    WebSocketClient,
    getWebSocketClient,
    initWebSocket,
};
