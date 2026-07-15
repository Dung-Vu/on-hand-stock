import test from "node:test";
import assert from "node:assert/strict";

import {
    getNumericStockValue,
    getProductName,
    getSortLabel,
    getVisibleWarehouseCount,
    sortProducts,
} from "./stockView.js";

const products = [
    {
        product_id: [1, "Beta"],
        product_name: "Beta",
        quantity: 5,
        available_quantity: 1,
        incoming_qty: 20,
        warehouseName: "A/Stock",
    },
    {
        product_id: [2, "Alpha"],
        product_name: "Alpha",
        quantity: 10,
        available_quantity: 6,
        incoming_qty: 0,
        warehouseName: "B/Stock",
    },
    {
        product_id: [3, "Gamma"],
        product_name: "Gamma",
        quantity: 0,
        available_quantity: 0,
        incoming_qty: 8,
        warehouseName: "A/Stock",
    },
];

test("sortProducts sorts by stock quantity descending by default", () => {
    assert.deepEqual(sortProducts(products).map(getProductName), ["Alpha", "Beta", "Gamma"]);
});

test("sortProducts supports low-stock and incoming workflows", () => {
    assert.deepEqual(sortProducts(products, "quantity_asc").map(getProductName), ["Gamma", "Beta", "Alpha"]);
    assert.deepEqual(sortProducts(products, "available_asc").map(getProductName), ["Gamma", "Beta", "Alpha"]);
    assert.deepEqual(sortProducts(products, "incoming_desc").map(getProductName), ["Beta", "Gamma", "Alpha"]);
});

test("stock view helpers handle missing values", () => {
    assert.equal(getProductName({ product_id: [9, "Fallback"] }), "Fallback");
    assert.equal(getNumericStockValue({ quantity: "bad" }, "quantity"), 0);
    assert.equal(getVisibleWarehouseCount(products), 2);
    assert.equal(getSortLabel("unknown"), getSortLabel("quantity_desc"));
});
