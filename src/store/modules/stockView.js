export const DEFAULT_SORT_KEY = "quantity_desc";

export const SORT_LABELS = {
    quantity_desc: "Sắp xếp: tồn nhiều nhất",
    quantity_asc: "Sắp xếp: tồn ít nhất",
    available_asc: "Sắp xếp: khả dụng thấp",
    incoming_desc: "Sắp xếp: đang đến nhiều",
    name_asc: "Sắp xếp: tên A-Z",
};

export const COLUMN_SORT_BY_FIELD = {
    product: "name_asc",
    quantity: "quantity_desc",
    available: "available_asc",
    incoming: "incoming_desc",
};

export function getProductName(product = {}) {
    return product.product_name || product.product_id?.[1] || "";
}

export function getNumericStockValue(product = {}, field) {
    const value = Number(product[field]);
    return Number.isFinite(value) ? value : 0;
}

export function getSortLabel(sortKey) {
    return SORT_LABELS[sortKey] || SORT_LABELS[DEFAULT_SORT_KEY];
}

export function sortProducts(products, sortKey = DEFAULT_SORT_KEY) {
    const sorted = [...products];
    const byName = (a, b) => getProductName(a).localeCompare(getProductName(b), "vi");

    sorted.sort((a, b) => {
        switch (sortKey) {
            case "quantity_asc":
                return getNumericStockValue(a, "quantity") - getNumericStockValue(b, "quantity") || byName(a, b);
            case "available_asc":
                return getNumericStockValue(a, "available_quantity") - getNumericStockValue(b, "available_quantity") || byName(a, b);
            case "incoming_desc":
                return getNumericStockValue(b, "incoming_qty") - getNumericStockValue(a, "incoming_qty") || byName(a, b);
            case "name_asc":
                return byName(a, b);
            case "quantity_desc":
            default:
                return getNumericStockValue(b, "quantity") - getNumericStockValue(a, "quantity") || byName(a, b);
        }
    });

    return sorted;
}

export function getVisibleWarehouseCount(products) {
    return new Set(products.map((product) => product.warehouseName).filter(Boolean)).size;
}
