/**
 * Script to check archived products that still have stock
 * Run with: node check-archived-products.js
 */

import fs from "fs";
import path from "path";
import { config } from "dotenv";

// Load environment variables from server folder
config({ path: "./server/.env" });

const ODOO_CONFIG = {
    apiEndpoint: process.env.ODOO_API_ENDPOINT,
    database: process.env.ODOO_DATABASE,
    userId: parseInt(process.env.ODOO_USER_ID),
    apiKey: process.env.ODOO_API_KEY,
};

// Đồng bộ với server/index.js
const WAREHOUSE_IDS = [165, 157, 261, 20, 269, 219, 277, 195, 285, 217, 324, 184, 325];

// Đồng bộ với src/store/modules/warehouse.js
const WAREHOUSE_MAP = {
    165: "BONAP/Stock",
    157: "ORDAP/Stock",
    261: "ORDAP/Stock",
    20: "ORDHL/Stock",
    269: "ORDHL/Stock",
    219: "ORDHY/Stock",
    277: "ORDHY/Stock",
    195: "ORDST/Stock",
    285: "ORDST/Stock",
    217: "Kho Vải",
    324: "Kho Vải",
    184: "Kho Vải",
    325: "Kho Vải",
};

async function checkArchivedProductsWithStock() {
    console.log("🔍 Checking for archived products with stock...\n");

    try {
        // Step 1: Get all stock.quant with quantity > 0
        console.log("📦 Fetching stock data...");
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
                            ["location_id", "in", WAREHOUSE_IDS],
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
        console.log(`✅ Found ${stockData.length} stock records\n`);

        // Get unique product IDs from stock data
        const productIds = [...new Set(stockData.map((item) => item.product_id[0]))];
        console.log(`📋 Found ${productIds.length} unique products with stock\n`);

        if (productIds.length === 0) {
            console.log("No products with stock found.");
            return;
        }

        // Step 2: Check which products are archived (active = false)
        console.log("🔎 Checking for archived products...");
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
                        context: { active_test: false },
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
        console.log(`⚠️  Found ${archivedProducts.length} archived products with stock\n`);

        if (archivedProducts.length === 0) {
            console.log("✨ No archived products with stock found!");
            
            // Create empty report
            const emptyReport = `# Archived Products With Stock Report

📅 **Generated:** ${new Date().toLocaleString("vi-VN")}

---

## Summary

✅ **No archived products with stock found!**

All products with inventory are currently active.
`;
            fs.writeFileSync("ARCHIVED-PRODUCTS-WITH-STOCK.md", emptyReport);
            console.log("\n📄 Report saved to: ARCHIVED-PRODUCTS-WITH-STOCK.md");
            return;
        }

        const archivedProductIds = new Set(archivedProducts.map((p) => p.id));

        // Step 3: Combine stock data with archived product info
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

        // Add product details
        const archivedProductsWithStock = [];
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

        // Generate markdown report
        let markdown = `# Archived Products With Stock Report

📅 **Generated:** ${new Date().toLocaleString("vi-VN")}

---

## Summary

- **Total archived products with stock:** ${archivedProductsWithStock.length}
- **Total quantity in stock:** ${archivedProductsWithStock.reduce((sum, p) => sum + p.total_quantity, 0).toLocaleString()}
- **Total available quantity:** ${archivedProductsWithStock.reduce((sum, p) => sum + p.total_available, 0).toLocaleString()}

---

## Action Required

Các sản phẩm dưới đây đang bị **Archive (Ẩn)** nhưng vẫn còn **tồn kho**. Cần xử lý:

1. **Unarchive sản phẩm** nếu sản phẩm vẫn đang được bán
2. **Điều chỉnh tồn kho về 0** nếu số lượng không chính xác
3. **Chuyển kho** nếu cần chuyển hàng sang sản phẩm khác

---

## Product List

| # | Product ID | Product Name | Default Code | Category | Total Qty | Available Qty |
|---|------------|--------------|--------------|----------|-----------|---------------|
`;

        archivedProductsWithStock.forEach((product, index) => {
            markdown += `| ${index + 1} | ${product.product_id} | ${product.product_name} | ${product.default_code} | ${product.category} | ${product.total_quantity.toLocaleString()} | ${product.total_available.toLocaleString()} |\n`;
        });

        markdown += `\n---\n\n## Detailed Stock by Location\n\n`;

        archivedProductsWithStock.forEach((product, index) => {
            markdown += `### ${index + 1}. ${product.product_name}\n\n`;
            markdown += `- **Product ID:** ${product.product_id}\n`;
            markdown += `- **Default Code:** ${product.default_code || "N/A"}\n`;
            markdown += `- **Category:** ${product.category || "N/A"}\n`;
            markdown += `- **Total Quantity:** ${product.total_quantity.toLocaleString()}\n`;
            markdown += `- **Total Available:** ${product.total_available.toLocaleString()}\n\n`;
            markdown += `| Location | Quantity | Available |\n`;
            markdown += `|----------|----------|----------|\n`;
            product.locations.forEach((loc) => {
                const locationDisplay = WAREHOUSE_MAP[loc.location_id] || loc.location_name;
                markdown += `| ${locationDisplay} | ${loc.quantity.toLocaleString()} | ${loc.available_quantity.toLocaleString()} |\n`;
            });
            markdown += `\n`;
        });

        markdown += `---\n\n*Report generated by check-archived-products.js*\n`;

        // Save to file
        fs.writeFileSync("ARCHIVED-PRODUCTS-WITH-STOCK.md", markdown);
        console.log("📄 Report saved to: ARCHIVED-PRODUCTS-WITH-STOCK.md");

        // Print summary to console
        console.log("\n" + "=".repeat(60));
        console.log("ARCHIVED PRODUCTS WITH STOCK");
        console.log("=".repeat(60));
        archivedProductsWithStock.forEach((product, index) => {
            console.log(`\n${index + 1}. ${product.product_name}`);
            console.log(`   ID: ${product.product_id} | Code: ${product.default_code || "N/A"}`);
            console.log(`   Total Qty: ${product.total_quantity} | Available: ${product.total_available}`);
        });
        console.log("\n" + "=".repeat(60));

    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

checkArchivedProductsWithStock();
