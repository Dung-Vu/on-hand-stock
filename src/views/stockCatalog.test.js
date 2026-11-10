import assert from 'node:assert/strict';
import test from 'node:test';
import { collectWarehouseProducts, stockStatus } from './stockCatalog.js';

test('stock status distinguishes out, low, and available quantities', () => {
  assert.equal(stockStatus(0, 0), 'out');
  assert.equal(stockStatus(8, 8), 'low');
  assert.equal(stockStatus(40, 5), 'low');
  assert.equal(stockStatus(40, 30), 'in');
});

test('catalog collection keeps only the active warehouse and its categories', () => {
  const products = collectWarehouseProducts(
    {
      'BONAP/Stock': {
        categories: {
          Vải: { products: { a: { product_name: 'A', quantity: 2 } } },
        },
      },
      'Kho Vải': {
        categories: {
          Khác: { products: { b: { product_name: 'B', quantity: 9 } } },
        },
      },
    },
    'Kho Vải'
  );

  assert.deepEqual(
    products.map(product => [product.product_name, product.categoryName, product.warehouseName]),
    [['B', 'Khác', 'Kho Vải']]
  );
});
