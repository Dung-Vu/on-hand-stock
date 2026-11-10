import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getActiveWarehouse,
  getScreen,
  registerViews,
  resetToWarehouse,
  showScreen,
  showWarehouse,
} from './screen.js';

function fakeElement() {
  const classes = new Set();
  return {
    classList: {
      toggle(name, on) {
        if (on) classes.add(name);
        else classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    style: { display: '' },
  };
}

test('warehouse screen follows the selected warehouse and hides the other views', () => {
  const views = {
    stock: fakeElement(),
    arte: fakeElement(),
    gimmersta: fakeElement(),
    stocktake: fakeElement(),
    search: fakeElement(),
    filters: fakeElement(),
    tabs: fakeElement(),
    category: fakeElement(),
  };
  registerViews(views);

  showWarehouse('Kho ARTE');
  assert.equal(getScreen(), 'arte');
  assert.equal(getActiveWarehouse(), 'Kho ARTE');
  assert.equal(views.arte.classList.contains('hidden'), false);
  assert.equal(views.stock.classList.contains('hidden'), true);
  assert.equal(views.search.classList.contains('hidden'), true);
  assert.equal(views.category.style.display, 'none');

  showWarehouse('BONAP/Stock');
  assert.equal(getScreen(), 'stock');
  assert.equal(views.stock.classList.contains('hidden'), false);
  assert.equal(views.arte.classList.contains('hidden'), true);
  assert.equal(views.category.style.display, '');
});

test('stocktake stays open when the warehouse changes, then returns to that warehouse', () => {
  const views = {
    stock: fakeElement(),
    arte: fakeElement(),
    stocktake: fakeElement(),
    search: fakeElement(),
    filters: fakeElement(),
    tabs: fakeElement(),
  };
  registerViews(views);
  showWarehouse('Kho Gimmersta');
  showScreen('stocktake');
  assert.equal(views.stocktake.classList.contains('hidden'), false);
  assert.equal(views.filters.classList.contains('hidden'), true);

  showWarehouse('Kho ARTE');
  assert.equal(getScreen(), 'stocktake');
  assert.equal(getActiveWarehouse(), 'Kho ARTE');

  resetToWarehouse('Kho ARTE');
  assert.equal(getScreen(), 'arte');
  assert.equal(views.arte.classList.contains('hidden'), false);
  assert.equal(views.stocktake.classList.contains('hidden'), true);
});
