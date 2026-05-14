// Odoo API Configuration
// NOTE: Sensitive data (API key, credentials) are now stored securely on the backend server

// Auto-detect API endpoint based on current hostname
// If running on tunnel domain, use tunnel API endpoint; otherwise use localhost
const getApiEndpoint = () => {
    if (typeof window !== "undefined") {
        const { hostname, protocol, port } = window.location;
        if (window.API_BASE_URL) {
            return `${window.API_BASE_URL}/api/stock`;
        }
        // Check if running on tunnel domain
        if (hostname.includes("bonstu.site") || hostname.includes("stock.bonstu.site")) {
            // Use HTTPS for production tunnel
            return "https://api-stock.bonstu.site/api/stock";
        }
        // LAN Vite access: use the same host with backend port.
        if (hostname !== "localhost" && hostname !== "127.0.0.1" && /^517\d$/.test(port)) {
            return `${protocol}//${hostname}:4001/api/stock`;
        }
    }
    // Default to localhost for local development
    return "http://localhost:4001/api/stock";
};

export const ODOO_CONFIG = {
    // Whether to use sample data (set to false to use actual API)
    useSampleData: false,

    // Backend API endpoint (proxies to Odoo with secure credentials)
    // Automatically switches between localhost and tunnel domain
    apiEndpoint: getApiEndpoint(),

    // Query parameters (non-sensitive)
    model: "stock.quant",
    method: "search_read",

    // Filter conditions - modify here to query different warehouses
    domain: [
        ["location_id", "in", [165, 328, 157, 261, 20, 269, 219, 277, 195, 285, 217, 324, 184, 325]], // All warehouses
        ["quantity", ">", 0],
    ],

    // Field list
    fields: [
        "product_id",
        "location_id",
        "quantity",
        "available_quantity",
        "lot_id",
        "package_id",
        "owner_id",
        "product_categ_id",
    ],

    // Order and limit
    order: "product_id asc",
    limit: 100000,
};

// Expose config in global scope (for dataStore.js)
if (typeof window !== "undefined") {
    window.ODOO_CONFIG = ODOO_CONFIG;
}
