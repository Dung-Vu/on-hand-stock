// Odoo API Configuration
// NOTE: Sensitive data (API key, credentials) are now stored securely on the backend server

// Auto-detect API endpoint based on current hostname
// If running on tunnel domain, use tunnel API endpoint; otherwise use localhost
const getApiEndpoint = () => {
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        // Check if running on tunnel domain
        if (hostname.includes("bonstu.site") || hostname.includes("stock.bonstu.site")) {
            return "https://api-stock.bonstu.site/api/stock";
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
        ["location_id", "in", [165, 157, 20, 219, 195, 217, 184]], // All warehouses
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
