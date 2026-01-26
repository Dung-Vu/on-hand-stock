// ============================================
// SAMPLE DATA
// Used when useSampleData is true or API is unavailable
// ============================================

export const SAMPLE_DATA = [
    {
        id: 1,
        product_id: [1, "Product A"],
        location_id: [157, "ORDAP/Stock"],
        quantity: 100,
        available_quantity: 95,
        lot_id: [1, "LOT001"],
        package_id: false,
        owner_id: false,
        product_categ_id: [1, "Category 1"],
    },
    {
        id: 2,
        product_id: [2, "Product B"],
        location_id: [157, "ORDAP/Stock"],
        quantity: 50,
        available_quantity: 50,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [1, "Category 1"],
    },
    {
        id: 3,
        product_id: [3, "Product C"],
        location_id: [165, "BONAP/Stock"],
        quantity: 200,
        available_quantity: 180,
        lot_id: [2, "LOT002"],
        package_id: false,
        owner_id: false,
        product_categ_id: [2, "Category 2"],
    },
    {
        id: 4,
        product_id: [4, "Product D"],
        location_id: [165, "BONAP/Stock"],
        quantity: 75,
        available_quantity: 75,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [2, "Category 2"],
    },
    {
        id: 5,
        product_id: [5, "Product E"],
        location_id: [20, "ORDHL/Stock"],
        quantity: 30,
        available_quantity: 30,
        lot_id: false,
        package_id: false,
        owner_id: false,
        product_categ_id: [1, "Category 1"],
    },
];

export default SAMPLE_DATA;
