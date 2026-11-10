import { createElement } from './utils/dom.js';
import Header from './components/Header.js';
import Stocktake from './components/Stocktake.js';
import ArteStock from './components/ArteStock.js';
import GimmerstaStock from './components/GimmerstaStock.js';
import Login from './components/Login.js';
import AdminDashboard from './components/AdminDashboard.js';
import {
  loadData,
  applyFilters,
  exportData,
  exportDataPDF,
  refreshCategoryFilter,
  forceRefreshData,
  getWarehouseNames,
  getProductsForWarehouse,
  showToast,
  getCurrentGroupedData,
  updateFilterOptions,
} from './store/dataStore.js';
import { auth } from './services/apiClient.js';
import { COMPANY_FILTER_STORAGE_KEY } from './app/catalogQuery.js';
import {
  getActiveWarehouse,
  getScreen,
  registerViews,
  resetToWarehouse,
  screenForWarehouse,
  showScreen,
  showWarehouse,
} from './app/screen.js';
import { switchToWarehouse } from './app/warehouseTabs.js';

const COMPANY_OPTIONS = ['Bonario', 'Ordinaire'];

// Warehouse list for keyboard navigation
const WAREHOUSE_SHORTCUTS = [
  'BONAP/Stock',
  'O-BAP/Stock',
  'ACENB/Stock',
  'ORDAP/Stock',
  'ORDHL/Stock',
  'ORDHY/Stock',
  'ORDST/Stock',
  'Kho Vải',
];

export default function App() {
  const container = createElement('div', {
    class: 'min-h-screen',
  });

  // State
  let isLoggedIn = false;
  let currentUser = null;
  let showAdminDashboard = false;

  // Check if already logged in
  function checkAuth() {
    isLoggedIn = auth.isAuthenticated();
    currentUser = auth.getCurrentUser();
    return isLoggedIn;
  }

  function getUrlCompany() {
    if (typeof window === 'undefined') return null;
    const company = new URLSearchParams(window.location.search).get('company');
    return COMPANY_OPTIONS.includes(company) ? company : null;
  }

  function hasConfirmedCompanySelection() {
    const urlCompany = getUrlCompany();
    if (urlCompany) {
      localStorage.setItem(COMPANY_FILTER_STORAGE_KEY, urlCompany);
      return true;
    }

    return false;
  }

  function renderCompanyChooser(onSelected) {
    const overlay = createElement('div', {
      class: 'company-chooser',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'companyChooserTitle',
    });
    const panel = createElement('div', { class: 'company-panel' });
    const title = createElement('h2', { id: 'companyChooserTitle' });
    title.textContent = 'Chọn công ty';
    const subtitle = createElement('p', {});
    subtitle.textContent = 'Tồn kho sẽ mở theo công ty bạn chọn.';
    const actions = createElement('div', { class: 'company-actions' });

    function chooseCompany(company) {
      localStorage.setItem(COMPANY_FILTER_STORAGE_KEY, company);
      const companyFilter = document.getElementById('companyFilter');
      if (companyFilter) companyFilter.value = company;
      overlay.remove();
      onSelected?.(company);
    }

    COMPANY_OPTIONS.forEach(company => {
      const button = createElement('button', {
        type: 'button',
        'aria-label': `${company} — Xem tồn kho`,
      });
      button.textContent = company;
      if (company === 'Bonario') button.classList.add('is-primary');
      button.addEventListener('click', () => chooseCompany(company));
      actions.appendChild(button);
    });

    panel.appendChild(title);
    panel.appendChild(subtitle);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    container.appendChild(overlay);
    requestAnimationFrame(() => actions.querySelector('button')?.focus());
  }

  // Render login modal (only when needed for Stocktake/Admin)
  function renderLoginModal(onLoginComplete) {
    const loginOverlay = createElement('div', {
      class: 'login-overlay fixed inset-0 z-50 overflow-y-auto',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Đăng nhập',
    });

    const loginView = Login({
      onLoginSuccess: user => {
        isLoggedIn = true;
        currentUser = user;
        loginOverlay.remove();
        renderMainApp();
        setTimeout(() => {
          const gd = getCurrentGroupedData();
          if (gd && Object.keys(gd).length > 0) {
            updateFilterOptions(gd);
            applyFilters();
            refreshCategoryFilter();
          } else {
            loadData();
          }
          onLoginComplete?.(user);
        }, 30);
      },
      onToast: showToast,
      onClose: () => {
        loginOverlay.remove();
      },
    });

    loginView.style.minHeight = '100vh';
    loginOverlay.appendChild(loginView);
    container.appendChild(loginOverlay);
  }

  // Render main application (public access, no login required)
  function renderMainApp() {
    container.innerHTML = '';

    // Header with controls
    const header = Header({
      onLoad: loadData,
      onExport: exportData,
      onExportPDF: exportDataPDF,
      onToggleStocktake: () => {
        if (!auth.isAuthenticated()) {
          renderLoginModal(() => {
            openStocktakeView();
          });
          return;
        }
        openStocktakeView();
      },
      currentUser,
      onLogout: handleLogout,
      onOpenAdmin: () => {
        if (!auth.isAuthenticated()) {
          renderLoginModal(user => {
            currentUser = user;
            showAdminDashboard = true;
            renderAdminDashboard();
          });
          return;
        }
        showAdminDashboard = true;
        renderAdminDashboard();
      },
    });
    container.appendChild(header);

    // Main content landmark
    const mainContent = createElement('main', { id: 'mainContent', class: 'app-main' });

    const stockDataContainer = createElement('div', { id: 'stockData' });
    mainContent.appendChild(stockDataContainer);

    const arteStockView = ArteStock();
    const gimmerstaStockView = GimmerstaStock();
    mainContent.append(arteStockView, gimmerstaStockView);

    const stocktakeView = Stocktake({
      getWarehouses: () => getWarehouseNames(),
      getProductsForWarehouse: warehouseName => getProductsForWarehouse(warehouseName),
      onToast: showToast,
      currentUser,
    });
    mainContent.appendChild(stocktakeView);

    container.appendChild(mainContent);
    registerViews({
      stock: stockDataContainer,
      arte: arteStockView,
      gimmersta: gimmerstaStockView,
      stocktake: stocktakeView,
      search: header.querySelector('#headerSearchSection'),
      filters: header.querySelector('#headerFiltersSection'),
      tabs: header.querySelector('#warehouseTabsPlaceholder'),
      category: header.querySelector('#categoryFilter'),
      sort: header.querySelector('#sortFilter'),
      clearBtn: header.querySelector('#clearFiltersBtn'),
      discontinued: header.querySelector('.discontinued-filter-toggle'),
    });
    resetToWarehouse(getActiveWarehouse());
  }

  function openStocktakeView() {
    if (getScreen() !== 'stocktake') {
      showScreen('stocktake');
      document.getElementById('stocktakeView')?.refresh?.();
      showToast('Đang mở Kiểm kho', 'info', 1500);
      return;
    }

    showScreen(screenForWarehouse(getActiveWarehouse()));
    if (getScreen() === 'stock') {
      refreshCategoryFilter();
      applyFilters();
    }
    showToast('Đã quay lại Tra cứu tồn', 'info', 1500);
  }

  // Render admin dashboard modal
  function renderAdminDashboard() {
    const adminView = AdminDashboard({
      currentUser,
      onToast: showToast,
      onClose: () => {
        showAdminDashboard = false;
        adminView.remove();
        refreshCategoryFilter();
        applyFilters();
      },
    });
    container.appendChild(adminView);
  }

  // Handle logout - return to main app (public mode)
  function handleLogout() {
    auth.logout();
    isLoggedIn = false;
    currentUser = null;
    showToast('Đã đăng xuất', 'info', 2000);
    renderMainApp();
    setTimeout(() => {
      const gd = getCurrentGroupedData();
      if (gd && Object.keys(gd).length > 0) {
        updateFilterOptions(gd);
        applyFilters();
        refreshCategoryFilter();
      } else {
        loadData();
      }
    }, 30);
  }

  document.addEventListener('companyContextChange', () => {
    const selectedCompany = localStorage.getItem(COMPANY_FILTER_STORAGE_KEY) || 'Bonario';
    if (
      selectedCompany !== 'Bonario' &&
      ['Kho ARTE', 'Kho Gimmersta'].includes(getActiveWarehouse())
    ) {
      localStorage.removeItem('lastActiveWarehouse');
      showWarehouse(null);
    }
  });

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  document.addEventListener('keydown', e => {
    if (showAdminDashboard || container.querySelector('.company-chooser, .login-overlay')) {
      return;
    }

    // Ctrl+K or Cmd+K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    // Ctrl+R or Cmd+R: Force reload data (bypass cache)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      forceRefreshData();
    }

    // Ctrl+E or Cmd+E: Export data
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      exportData();
    }

    // Number keys 1-8: Switch warehouses (only when not typing)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '8') {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable);

      if (!isTyping) {
        const index = parseInt(e.key, 10) - 1;
        if (WAREHOUSE_SHORTCUTS[index]) {
          switchToWarehouse(WAREHOUSE_SHORTCUTS[index]);
        }
      }
    }

    // Escape: Clear search and filters when in stock catalog
    if (e.key === 'Escape' && getScreen() === 'stock') {
      const searchInput = document.getElementById('searchInput');
      const categoryFilter = document.getElementById('categoryFilter');
      if (searchInput) searchInput.value = '';
      if (categoryFilter) categoryFilter.value = '';
      searchInput?.blur();
      applyFilters();
    }
  });

  // A server-rejected session must return to login, including while admin is open.
  window.addEventListener('stock-auth-expired', () => {
    const wasInAdmin = showAdminDashboard;
    showAdminDashboard = false;
    isLoggedIn = false;
    currentUser = null;
    renderMainApp();
    if (wasInAdmin) {
      renderLoginModal(user => {
        currentUser = user;
        showAdminDashboard = true;
        renderAdminDashboard();
      });
    }
  });

  // Initialize - always show main app (public access)
  checkAuth();
  renderMainApp();
  setTimeout(() => {
    if (hasConfirmedCompanySelection()) {
      loadData();
      return;
    }

    renderCompanyChooser(() => {
      loadData();
    });
  }, 100);

  return container;
}
