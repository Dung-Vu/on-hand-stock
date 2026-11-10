import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalogSearch,
  collectCategoryOptions,
  getSelectedCompanyName,
  readCatalogControls,
  resetCatalogControls,
} from './catalogQuery.js';

test('catalog query keeps search and warehouse, and drops default company, sort, and retired params', () => {
  const query = buildCatalogSearch('?view=old&density=compact&company=Bonario&sort=quantity_desc', {
    q: 'ICON',
    company: 'Bonario',
    category: '',
    sort: 'quantity_desc',
    discontinued: '',
    warehouse: 'BONAP/Stock',
  });

  assert.equal(query, 'q=ICON&warehouse=BONAP%2FStock');
});

test('collectCategoryOptions returns sorted categories scoped to active warehouse with all-warehouse fallback', () => {
  const grouped = {
    'BONAP/Stock': {
      categories: {
        'BON / GDT / ROLL': {},
        'BON / GDT / JP': {},
      },
    },
    'Kho Vải': {
      categories: {
        'BON / NVL / VAISOFA': {},
      },
    },
  };

  assert.deepEqual(collectCategoryOptions(grouped, 'BONAP/Stock'), [
    'BON / GDT / JP',
    'BON / GDT / ROLL',
  ]);
  assert.deepEqual(collectCategoryOptions(grouped, 'UNKNOWN'), [
    'BON / GDT / JP',
    'BON / GDT / ROLL',
    'BON / NVL / VAISOFA',
  ]);
});

test('readCatalogControls, resetCatalogControls, and getSelectedCompanyName manage filter state cleanly', () => {
  const elements = {
    searchInput: { value: '  linen ' },
    warehouseFilter: { value: 'Kho Vải' },
    categoryFilter: { value: 'BON / NVL / VAISOFA' },
    sortFilter: { value: 'available_asc' },
    discontinuedFilter: { checked: true },
    companyFilter: { value: 'Ordinaire' },
  };
  let toggleIsOn = true;
  const fakeDoc = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector() {
      return {
        classList: {
          remove(cls) {
            if (cls === 'is-on') toggleIsOn = false;
          },
        },
      };
    },
  };

  const controls = readCatalogControls(fakeDoc);
  assert.equal(controls.q, 'linen');
  assert.equal(controls.company, 'Ordinaire');
  assert.equal(controls.discontinued, '1');
  assert.equal(getSelectedCompanyName(fakeDoc, null), 'Ordinaire');

  resetCatalogControls(fakeDoc);
  assert.equal(elements.searchInput.value, '');
  assert.equal(elements.categoryFilter.value, '');
  assert.equal(elements.sortFilter.value, 'quantity_desc');
  assert.equal(elements.discontinuedFilter.checked, false);
  assert.equal(toggleIsOn, false);
});
