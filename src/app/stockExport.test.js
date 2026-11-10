import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFallbackStockCsv } from './stockExport.js';

test('buildFallbackStockCsv sorts warehouses, categories, and products while excluding hidden categories', () => {
  const grouped = {
    'BONAP/Stock': {
      categories: {
        'BON / GDT / JP': {
          products: {
            1: {
              product_id: [1, 'W-JP-RE53186'],
              product_name: 'W-JP-RE53186',
              quantity: 25,
              available_quantity: 20,
              incoming_qty: 0,
              lot_ids: ['LOT-A', 'LOT-B'],
            },
          },
        },
        'BON / HIDDEN': {
          products: {
            2: {
              product_id: [2, 'HIDDEN-ITEM'],
              product_name: 'HIDDEN-ITEM',
              quantity: 10,
              available_quantity: 10,
              incoming_qty: 0,
              lot_ids: [],
            },
          },
        },
      },
    },
  };

  const csv = buildFallbackStockCsv(grouped);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'Kho,Nhóm,Sản phẩm,Số lượng tồn,Số lượng khả dụng,Đang đến,Số lô');
  assert.equal(
    lines[1],
    '"BONAP/Stock","BON / GDT / JP","W-JP-RE53186",25,20,0,"LOT-A, LOT-B"'
  );
});
