import express from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "dotenv";
import { sanitizeRequest } from "./middleware/validate.js";
import { optionalHmacVerification, verifyHmacSignature } from "./middleware/auth.js";
import { startWebSocketServer, getClientCount } from "./websocket.js";
import * as redis from "./services/redis.js";
import { cacheMiddleware, invalidateCache, clearAllCache } from "./middleware/cache.js";

import { healthCheck as dbHealthCheck, getStats as getDbStats } from "./db/index.js";
import authRoutes from "./routes/auth.js";
import stocktakeRoutes from "./routes/stocktake.js";
import usersRoutes from "./routes/users.js";

// Load environment variables
config();

// Initialize Redis cache (optional)
redis.initRedis().catch(err => {
    console.warn('[Redis] Initialization failed, continuing without cache:', err.message);
});

const app = express();
// Local dev port: 4002 (Docker uses 4001)
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 4001 : 4002);

// Trust proxy - required for rate limiting behind reverse proxy (nginx, cloudflare, etc.)
// This allows express-rate-limit to correctly identify users by X-Forwarded-For header
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// Security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false
}));

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Max 100 requests per window
    message: {
        success: false,
        error: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút',
        retryAfter: 15 * 60
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Response compression (gzip) - reduces payload ~70%
app.use(compression());

// Request logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, Cloudflare Tunnel, etc.)
        // Cloudflare Tunnel may strip Origin header, so we allow requests without origin
        if (!origin) {
            console.log('[CORS] Allowing request with no origin (likely from Cloudflare Tunnel)');
            return callback(null, true);
        }
        
        const allowedOrigins = [
            // Local development ports (Vite dev server)
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:5176",
            "http://localhost:5177",
            "http://localhost:5178", // Primary local dev port
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:5175",
            "http://127.0.0.1:5176",
            "http://127.0.0.1:5177",
            "http://127.0.0.1:5178",
            "http://localhost:8080", // Docker frontend port
            // Cloudflare Tunnel domains
            "https://stock.bonstu.site",
            "http://stock.bonstu.site",
            "https://api-stock.bonstu.site",
            "http://api-stock.bonstu.site",
            "https://api_stock.bonstu.site",
            "http://api_stock.bonstu.site",
        ];
        
        // Check if origin is in allowed list or contains bonstu.site
        const isAllowed = allowedOrigins.indexOf(origin) !== -1 || origin.includes('bonstu.site');
        
        if (isAllowed) {
            console.log(`[CORS] Allowing origin: ${origin}`);
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Signature', 'X-Timestamp', 'X-Request-Id', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Type', 'X-Total-Count'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));
app.use(express.json());

// Input sanitization - remove XSS vectors
app.use(sanitizeRequest);

// HMAC signature verification (optional mode - logs but doesn't block)
// Set NODE_ENV=production and API_SECRET to enforce strict verification
app.use(optionalHmacVerification());

// Odoo API Configuration from environment
const ODOO_CONFIG = {
    apiEndpoint: process.env.ODOO_API_ENDPOINT,
    database: process.env.ODOO_DATABASE,
    userId: parseInt(process.env.ODOO_USER_ID),
    apiKey: process.env.ODOO_API_KEY,
};

// Warehouse mapping
const WAREHOUSE_IDS = [165, 157, 261, 20, 269, 219, 277, 195, 285, 217, 324, 184, 325];

/**
 * GET /api/stock
 * Fetch stock data from Odoo
 * Query params:
 *   - locationIds: comma-separated location IDs (optional, defaults to all warehouses)
 */
app.get("/api/stock", cacheMiddleware(300), async (req, res) => {
    try {
        // Get location IDs from query or use default
        const locationIds = req.query.locationIds
            ? req.query.locationIds.split(",").map((id) => parseInt(id.trim()))
            : WAREHOUSE_IDS;

        // Build Odoo API request
        const requestBody = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "object",
                method: "execute_kw",
                args: [
                    ODOO_CONFIG.database,
                    ODOO_CONFIG.userId,
                    ODOO_CONFIG.apiKey,
                    "stock.quant",
                    "search_read",
                    [
                        [
                            ["location_id", "in", locationIds],
                            ["quantity", ">", 0],
                        ],
                    ],
                    {
                        fields: [
                            "product_id",
                            "location_id",
                            "quantity",
                            "available_quantity",
                            "lot_id",
                            "package_id",
                            "owner_id",
                            "product_categ_id",
                            "product_uom_id",
                        ],
                        order: "product_id asc",
                        limit: 100000,
                    },
                ],
            },
            id: 1,
        };

        // Call Odoo API
        const response = await fetch(ODOO_CONFIG.apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Odoo API error: ${response.status} - ${errorText}`
            );
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message || "Odoo API call failed");
        }

        // Return successful response
        res.json({
            success: true,
            data: result.result || [],
            count: (result.result || []).length,
        });
    } catch (error) {
        console.error("Error fetching stock data:", error.message);
        
        // Send alert for API errors
        alertApiError("/api/stock", error.message).catch(err => {
            console.error("Failed to send alert:", err.message);
        });
        
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/incoming
 * Fetch incoming stock data from Odoo (stock moves assigned to warehouses)
 * Query params:
 *   - locationIds: comma-separated location IDs (optional, defaults to all warehouses)
 */
app.get("/api/incoming", cacheMiddleware(300), async (req, res) => {
    try {
        // Build Odoo API request for stock.move based on user's exact query
        const requestBody = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "object",
                method: "execute_kw",
                args: [
                    ODOO_CONFIG.database,
                    ODOO_CONFIG.userId,
                    ODOO_CONFIG.apiKey,
                    "stock.move",
                    "search_read",
                    [
                        [
                            ["location_dest_id", "in", [8, 244]],
                            ["state", "in", ["assigned", "waiting", "confirmed"]],
                            ["product_qty", ">", 0],
                        ],
                    ],
                    {
                        fields: [
                            "product_id",
                            "location_dest_id",
                            "product_qty",
                            "product_uom",
                            "state",
                            "date",
                        ],
                        order: "product_id asc, date asc",
                        limit: 100000,
                    },
                ],
            },
            id: 1,
        };

        // Call Odoo API
        const response = await fetch(ODOO_CONFIG.apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Odoo API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message || "Odoo API call failed");
        }

        const rawMoves = result.result || [];

        // Filter for products with names containing "F-SF" or "F-ORD"
        const filteredMoves = rawMoves.filter(
            (move) =>
                move.product_id &&
                move.product_id[1] &&
                (move.product_id[1].includes("F-SF") || move.product_id[1].includes("F-ORD"))
        );

        // Trả về tất cả các moves riêng lẻ để frontend xử lý logic
        // Frontend sẽ quyết định: cùng ngày thì cộng dồn, khác ngày thì chỉ lấy đợt sớm nhất
        const incomingData = filteredMoves.map((move) => ({
            product_id: move.product_id,
            incoming_qty: move.product_qty, // Giữ nguyên số lượng từng move
            incoming_date: move.date,
            product_uom: move.product_uom,
        }));

        res.json({
            success: true,
            data: incomingData,
            count: incomingData.length,
        });
    } catch (error) {
        console.error("Error fetching incoming data:", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/fabric-products
 * Fetch all fabric products (variants) with tag "Stock fabrics"
 */
app.get("/api/fabric-products", async (req, res) => {
    try {
        // Build Odoo API request to get products with "Stock fabrics" tag
        const requestBody = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "object",
                method: "execute_kw",
                args: [
                    ODOO_CONFIG.database,
                    ODOO_CONFIG.userId,
                    ODOO_CONFIG.apiKey,
                    "product.product",
                    "search_read",
                    [
                        [
                            ["additional_product_tag_ids.name", "=", "Stock fabrics"]
                        ]
                    ],
                    {
                        fields: ["id", "display_name"],
                        limit: 10000,
                    },
                ],
            },
            id: 1,
        };

        // Call Odoo API
        const response = await fetch(ODOO_CONFIG.apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Odoo API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message || "Odoo API call failed");
        }

        const products = (result.result || []).map((product) => ({
            id: product.id,
            product_id: [product.id, product.display_name],
            display_name: product.display_name,
        }));

        res.json({
            success: true,
            data: products,
            count: products.length,
        });
    } catch (error) {
        console.error("Error fetching fabric products:", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/discontinued-products
 * Fetch product IDs that have the "Discontinued" tag
 * Returns only IDs for lightweight cross-referencing with stock data
 */
app.get("/api/discontinued-products", cacheMiddleware(300), async (req, res) => {
    try {
        const requestBody = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "object",
                method: "execute_kw",
                args: [
                    ODOO_CONFIG.database,
                    ODOO_CONFIG.userId,
                    ODOO_CONFIG.apiKey,
                    "product.product",
                    "search_read",
                    [
                        [
                            ["product_tag_ids.name", "=", "Discontinued"]
                        ]
                    ],
                    {
                        fields: ["id"],
                        limit: 100000,
                    },
                ],
            },
            id: 1,
        };

        const response = await fetch(ODOO_CONFIG.apiEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Odoo API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error.message || "Odoo API call failed");
        }

        const productIds = (result.result || []).map((p) => p.id);

        res.json({
            success: true,
            data: productIds,
            count: productIds.length,
        });
    } catch (error) {
        console.error("Error fetching discontinued products:", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/archived-products-with-stock
 * Fetch products that are archived but still have stock quantity
 */
app.get("/api/archived-products-with-stock", async (req, res) => {
    try {
        // Get location IDs from query or use default
        const locationIds = req.query.locationIds
            ? req.query.locationIds.split(",").map((id) => parseInt(id.trim()))
            : WAREHOUSE_IDS;

        // Step 1: Get all stock.quant with quantity > 0
        const stockRequestBody = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "object",
                method: "execute_kw",
                args: [
                    ODOO_CONFIG.database,
                    ODOO_CONFIG.userId,
                    ODOO_CONFIG.apiKey,
                    "stock.quant",
                    "search_read",
                    [
                        [
                            ["location_id", "in", locationIds],
                            ["quantity", ">", 0],
                        ],
                    ],
                    {
                        fields: [
                            "product_id",
                            "location_id",
                            "quantity",
                            "available_quantity",
                        ],
                        order: "product_id asc",
                        limit: 100000,
                    },
                ],
            },
            id: 1,
        };

        const stockResponse = await fetch(ODOO_CONFIG.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stockRequestBody),
        });

        if (!stockResponse.ok) {
            throw new Error(`Odoo API error: ${stockResponse.status}`);
        }

        const stockResult = await stockResponse.json();
        if (stockResult.error) {
            throw new Error(stockResult.error.message || "Odoo API call failed");
        }

        const stockData = stockResult.result || [];

        // Get unique product IDs from stock data
        const productIds = [...new Set(stockData.map((item) => item.product_id[0]))];

        if (productIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                count: 0,
                message: "No products with stock found",
            });
        }

        // Step 2: Check which products are archived (active = false)
        // Need to use context to include archived products in search
        const productRequestBody = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "object",
                method: "execute_kw",
                args: [
                    ODOO_CONFIG.database,
                    ODOO_CONFIG.userId,
                    ODOO_CONFIG.apiKey,
                    "product.product",
                    "search_read",
                    [
                        [
                            ["id", "in", productIds],
                            ["active", "=", false],
                        ],
                    ],
                    {
                        fields: ["id", "display_name", "default_code", "categ_id", "active"],
                        limit: 100000,
                        context: { active_test: false }, // Include archived products
                    },
                ],
            },
            id: 2,
        };

        const productResponse = await fetch(ODOO_CONFIG.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(productRequestBody),
        });

        if (!productResponse.ok) {
            throw new Error(`Odoo API error: ${productResponse.status}`);
        }

        const productResult = await productResponse.json();
        if (productResult.error) {
            throw new Error(productResult.error.message || "Odoo API call failed");
        }

        const archivedProducts = productResult.result || [];
        const archivedProductIds = new Set(archivedProducts.map((p) => p.id));

        // Step 3: Combine stock data with archived product info
        const archivedProductsWithStock = [];

        // Group stock by product
        const stockByProduct = {};
        stockData.forEach((item) => {
            const productId = item.product_id[0];
            if (archivedProductIds.has(productId)) {
                if (!stockByProduct[productId]) {
                    stockByProduct[productId] = {
                        product_id: productId,
                        product_name: item.product_id[1],
                        locations: [],
                        total_quantity: 0,
                        total_available: 0,
                    };
                }
                stockByProduct[productId].locations.push({
                    location_id: item.location_id[0],
                    location_name: item.location_id[1],
                    quantity: item.quantity,
                    available_quantity: item.available_quantity,
                });
                stockByProduct[productId].total_quantity += item.quantity;
                stockByProduct[productId].total_available += item.available_quantity;
            }
        });

        // Add product details from archived products
        archivedProducts.forEach((product) => {
            if (stockByProduct[product.id]) {
                archivedProductsWithStock.push({
                    ...stockByProduct[product.id],
                    default_code: product.default_code || "",
                    category: product.categ_id ? product.categ_id[1] : "",
                });
            }
        });

        // Sort by product name
        archivedProductsWithStock.sort((a, b) => a.product_name.localeCompare(b.product_name));

        res.json({
            success: true,
            data: archivedProductsWithStock,
            count: archivedProductsWithStock.length,
        });
    } catch (error) {
        console.error("Error fetching archived products with stock:", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ============================================
// AUTH & STOCKTAKE ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/stocktake', stocktakeRoutes);
app.use('/api/users', usersRoutes);

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * GET /api/health
 * Health check endpoint with system metrics
 */
app.get("/api/health", async (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    // Format uptime
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    // Get Redis stats
    const redisStats = await redis.getStats();
    
    // Get Database stats and health
    const dbHealthy = await dbHealthCheck();
    const dbStats = getDbStats();

    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: uptimeSeconds,
            formatted: uptimeFormatted
        },
        memory: {
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
        },
        cache: redisStats,
        database: {
            healthy: dbHealthy,
            ...dbStats,
        },
        nodeVersion: process.version,
        platform: process.platform,
        websocket: {
            enabled: true,
            clients: getClientCount()
        },
        config: {
            database: ODOO_CONFIG.database,
            userId: ODOO_CONFIG.userId,
            hasApiKey: !!ODOO_CONFIG.apiKey,
        },

    });
});

// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📦 Stock API: http://localhost:${PORT}/api/stock`);
    console.log(`📥 Incoming API: http://localhost:${PORT}/api/incoming`);
    console.log(`🧵 Fabric Products API: http://localhost:${PORT}/api/fabric-products`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth/login`);
    console.log(`🧾 Stocktake API: http://localhost:${PORT}/api/stocktake/sessions`);
    console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🗄️  Redis Cache: ${redis.getStatus().enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`🐘 Database: PostgreSQL`);
});

// Start WebSocket server (attached to HTTP server)
startWebSocketServer(server);
console.log(`🔌 WebSocket server attached to HTTP server`);

