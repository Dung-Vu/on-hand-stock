import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectStocktakeProducts,
  filterAndSearchData,
  filterGroupedDataByCompany,
  groupDataByWarehouseAndCategory,
  processIncomingData,
  processOdooData,
} from './stockPipeline.js';

test('incoming keeps the earliest date and stays inside the active warehouse', () => {
  const onhand = processOdooData([
    {
      id: 1,
      product_id: [9, 'F-SF-LINEN'],
      location_id: [217, 'Kho Vải'],
      quantity: 4,
      available_quantity: 4,
      product_categ_id: [1, 'BON / NVL / VAISOFA'],
      product_uom_id: [1, 'm'],
    },
  ]);
  const incoming = processIncomingData(
    [
      { product_id: [9, 'F-SF-LINEN'], incoming_qty: 2, incoming_date: '2026-12-01' },
      { product_id: [9, 'F-SF-LINEN'], incoming_qty: 5, incoming_date: '2026-11-01' },
    ],
    onhand
  );

  assert.equal(incoming.length, 1);
  assert.equal(incoming[0].incoming_qty, 5);

  const grouped = groupDataByWarehouseAndCategory([...onhand, ...incoming]);
  const product = Object.values(Object.values(grouped['Kho Vải'].categories)[0].products)[0];
  assert.equal(product.quantity, 4);
  assert.equal(product.incoming_qty, 5);

  const matched = filterAndSearchData(grouped, 'LINEN', '', '', { activeWarehouse: 'Kho Vải' });
  assert.ok(matched['Kho Vải']);
  const otherWarehouse = filterAndSearchData(grouped, 'LINEN', '', '', {
    activeWarehouse: 'BONAP/Stock',
  });
  assert.equal(Object.keys(otherWarehouse).length, 0);
});

test('filterGroupedDataByCompany scopes grouped warehouses to selected company and collectStocktakeProducts sorts products', () => {
  const rows = processOdooData([
    {
      id: 1,
      product_id: [11, 'BON-ZETA'],
      location_id: [165, 'BONAP/Stock'],
      quantity: 12,
      available_quantity: 10,
      product_categ_id: [1, 'BON / GDT / JP'],
    },
    {
      id: 2,
      product_id: [12, 'BON-ALPHA'],
      location_id: [165, 'BONAP/Stock'],
      quantity: 5,
      available_quantity: 4,
      product_categ_id: [1, 'BON / GDT / JP'],
    },
    {
      id: 3,
      product_id: [21, 'ORD-WALL'],
      location_id: [157, 'ORDAP/Stock'],
      quantity: 8,
      available_quantity: 8,
      product_categ_id: [2, 'ORD / WALLPAPER'],
    },
  ]);

  const grouped = groupDataByWarehouseAndCategory(rows);
  const bonarioScoped = filterGroupedDataByCompany(grouped, 'Bonario');
  const ordinaireScoped = filterGroupedDataByCompany(grouped, 'Ordinaire');

  assert.deepEqual(Object.keys(bonarioScoped), ['BONAP/Stock']);
  assert.deepEqual(Object.keys(ordinaireScoped), ['ORDAP/Stock']);

  const stocktakeList = collectStocktakeProducts(bonarioScoped, 'BONAP/Stock');
  assert.deepEqual(
    stocktakeList.map(item => [item.productId, item.name, item.systemQty]),
    [
      [12, 'BON-ALPHA', 5],
      [11, 'BON-ZETA', 12],
    ]
  );
});
