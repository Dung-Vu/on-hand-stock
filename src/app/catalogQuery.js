import {
  COMPANY_FILTERS,
  DEFAULT_COMPANY_FILTER,
  isAllowedCompanyKey,
  normalizeCompanyName,
} from '../data/stockPipeline.js';
import { DEFAULT_SORT_KEY } from '../store/modules/stockView.js';

export const COMPANY_FILTER_STORAGE_KEY = 'selectedCompany';

const DEFAULTS = {
  company: DEFAULT_COMPANY_FILTER,
  sort: DEFAULT_SORT_KEY,
};

export function formatCategoryDisplayLabel(categoryName = '') {
  const cleaned = String(categoryName || '')
    .replace(/^BON\s*\/\s*/i, '')
    .replace(/^ORD\s*\/\s*/i, '')
    .replace(/\s*\/\s*/g, ' › ')
    .trim();
  return cleaned || categoryName;
}

export function readCatalogControls(doc = globalThis.document) {
  if (!doc) {
    return {
      searchTerm: '',
      warehouseValue: '',
      categoryValue: '',
      sortKey: DEFAULT_SORT_KEY,
      discontinuedOnly: false,
      q: '',
      company: '',
      category: '',
      sort: '',
      discontinued: '',
    };
  }

  return {
    searchTerm: doc.getElementById('searchInput')?.value || '',
    warehouseValue: doc.getElementById('warehouseFilter')?.value || '',
    categoryValue: doc.getElementById('categoryFilter')?.value || '',
    sortKey: doc.getElementById('sortFilter')?.value || DEFAULT_SORT_KEY,
    discontinuedOnly: Boolean(doc.getElementById('discontinuedFilter')?.checked),
    q: doc.getElementById('searchInput')?.value?.trim() || '',
    company: doc.getElementById('companyFilter')?.value || '',
    category: doc.getElementById('categoryFilter')?.value || '',
    sort: doc.getElementById('sortFilter')?.value || '',
    discontinued: doc.getElementById('discontinuedFilter')?.checked ? '1' : '',
  };
}

export function resetCatalogControls(doc = globalThis.document) {
  if (!doc) return;
  const searchInput = doc.getElementById('searchInput');
  const warehouseFilter = doc.getElementById('warehouseFilter');
  const categoryFilter = doc.getElementById('categoryFilter');
  const sortFilter = doc.getElementById('sortFilter');
  const discontinuedFilter = doc.getElementById('discontinuedFilter');

  if (searchInput) searchInput.value = '';
  if (warehouseFilter) warehouseFilter.value = '';
  if (categoryFilter) categoryFilter.value = '';
  if (sortFilter) sortFilter.value = DEFAULT_SORT_KEY;
  if (discontinuedFilter) discontinuedFilter.checked = false;
  doc.querySelector?.('.discontinued-filter-toggle')?.classList?.remove('is-on');
}

export function getSelectedCompanyName(
  doc = globalThis.document,
  storage = globalThis.localStorage
) {
  let selectedCompany = '';

  if (doc) {
    const companyFilter = doc.getElementById('companyFilter');
    if (companyFilter) {
      selectedCompany = normalizeCompanyName(companyFilter.value);
    }
  }

  if (!selectedCompany && storage) {
    selectedCompany = normalizeCompanyName(storage.getItem(COMPANY_FILTER_STORAGE_KEY));
  }

  return isAllowedCompanyKey(selectedCompany) ? selectedCompany : DEFAULT_COMPANY_FILTER;
}

export function syncCompanyFilterOptions(
  doc = globalThis.document,
  storage = globalThis.localStorage
) {
  if (!doc) return DEFAULT_COMPANY_FILTER;

  const companySelect = doc.getElementById('companyFilter');
  if (!companySelect) return getSelectedCompanyName(doc, storage);

  const savedCompany = normalizeCompanyName(
    companySelect.value || storage?.getItem(COMPANY_FILTER_STORAGE_KEY)
  );
  const nextValue = isAllowedCompanyKey(savedCompany) ? savedCompany : DEFAULT_COMPANY_FILTER;

  companySelect.innerHTML = '';
  COMPANY_FILTERS.forEach(company => {
    const option = doc.createElement('option');
    option.value = company.key;
    option.textContent = `Công ty: ${company.label}`;
    companySelect.appendChild(option);
  });

  companySelect.value = nextValue;
  storage?.setItem(COMPANY_FILTER_STORAGE_KEY, nextValue);
  return nextValue;
}

export function collectCategoryOptions(groupedData, activeWarehouse = null) {
  if (!groupedData || Object.keys(groupedData).length === 0) {
    return [];
  }

  let warehousesToUse = [];
  if (activeWarehouse && groupedData[activeWarehouse]) {
    warehousesToUse.push(groupedData[activeWarehouse]);
  }
  if (warehousesToUse.length === 0) {
    warehousesToUse = Object.values(groupedData);
  }

  const categoriesSet = new Set();
  warehousesToUse.forEach(warehouse => {
    Object.keys(warehouse.categories || {}).forEach(categoryName => {
      categoriesSet.add(categoryName);
    });
  });

  return Array.from(categoriesSet).sort();
}

export function syncCategoryFilterOptions(
  groupedData,
  activeWarehouse = null,
  doc = globalThis.document
) {
  if (!doc) return;
  const categorySelect = doc.getElementById('categoryFilter');
  if (!categorySelect) return;

  const pendingCategory = categorySelect.getAttribute('data-pending-category');
  const preferredCategory = pendingCategory ?? categorySelect.value ?? '';

  const categories = collectCategoryOptions(groupedData, activeWarehouse);
  const whObj = activeWarehouse && groupedData?.[activeWarehouse] ? groupedData[activeWarehouse] : null;

  categorySelect.innerHTML = `<option value="">Tất cả nhóm sản phẩm${categories.length ? ` (${categories.length} nhóm)` : ''}</option>`;

  categories.forEach(categoryName => {
    const option = doc.createElement('option');
    option.value = categoryName;
    const count = whObj?.categories?.[categoryName]?.products
      ? Object.keys(whObj.categories[categoryName].products).length
      : 0;
    const displayLabel = formatCategoryDisplayLabel(categoryName);
    option.textContent = count > 0 ? `${displayLabel} (${count})` : displayLabel;
    categorySelect.appendChild(option);
  });

  if (preferredCategory && categories.includes(preferredCategory)) {
    categorySelect.value = preferredCategory;
  } else {
    categorySelect.value = '';
  }

  if (pendingCategory !== null) {
    categorySelect.removeAttribute('data-pending-category');
  }
}

export function buildCatalogSearch(currentSearch, values) {
  const params = new URLSearchParams(currentSearch);
  params.delete('view');
  params.delete('density');

  for (const key of ['q', 'company', 'category', 'sort', 'discontinued', 'warehouse']) {
    const value = values[key] || '';
    if (!value || value === DEFAULTS[key]) params.delete(key);
    else params.set(key, value);
  }

  return params.toString();
}

export function syncCatalogQuery(warehouseName) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const controls = readCatalogControls(document);
  const nextQuery = buildCatalogSearch(window.location.search, {
    q: controls.q,
    company: controls.company,
    category: controls.category,
    sort: controls.sort,
    discontinued: controls.discontinued,
    warehouse: warehouseName || '',
  });
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) window.history.replaceState(null, '', nextUrl);
}
