const SUPPLIER_SCREENS = {
  'Kho ARTE': 'arte',
  'Kho Gimmersta': 'gimmersta',
};

let activeWarehouse = null;
let screen = 'stock';
let views = {};

export function screenForWarehouse(warehouseName) {
  return SUPPLIER_SCREENS[warehouseName] || 'stock';
}

export function getActiveWarehouse() {
  return activeWarehouse;
}

export function getScreen() {
  return screen;
}

export function registerViews(nextViews) {
  views = nextViews || {};
  applyScreen();
}

export function showScreen(nextScreen) {
  screen = nextScreen || 'stock';
  applyScreen();
}

export function showWarehouse(warehouseName) {
  activeWarehouse = warehouseName || null;
  if (screen !== 'stocktake') screen = screenForWarehouse(activeWarehouse);
  applyScreen();
}

export function resetToWarehouse(warehouseName) {
  activeWarehouse = warehouseName || null;
  screen = screenForWarehouse(activeWarehouse);
  applyScreen();
}

function setHidden(element, hidden) {
  element?.classList.toggle('hidden', hidden);
}

function applyScreen() {
  const catalog = screen === 'stock';
  setHidden(views.stock, !catalog);
  setHidden(views.arte, screen !== 'arte');
  setHidden(views.gimmersta, screen !== 'gimmersta');
  setHidden(views.stocktake, screen !== 'stocktake');
  setHidden(views.search, !catalog);
  setHidden(views.filters, screen === 'stocktake');
  setHidden(views.tabs, screen === 'stocktake');

  for (const element of [views.category, views.sort, views.clearBtn, views.discontinued]) {
    if (element) element.style.display = catalog ? '' : 'none';
  }
}
