import { createElement } from './utils/dom.js'
import Header from './components/Header.js'
import Tabs from './components/Tabs.js'
import Stocktake from './components/Stocktake.js'
import ArteStock from './components/ArteStock.js'
import Login from './components/Login.js'
import AdminDashboard from './components/AdminDashboard.js'
import { loadData, applyFilters, clearFilters, exportData, exportDataPDF, refreshCategoryFilter, forceRefreshData, clearCache, getWarehouseNames, getProductsForWarehouse, showToast, getCurrentGroupedData, updateFilterOptions } from './store/dataStore.js'
import { syncArteWarehouse } from './store/modules/warehouse.js'
import { auth, stocktake } from './services/apiClient.js'

let currentActiveWarehouse = null
const COMPANY_FILTER_STORAGE_KEY = 'selectedCompany'
const COMPANY_OPTIONS = ['Bonario', 'Ordinaire']

// Warehouse list for keyboard navigation
const WAREHOUSE_SHORTCUTS = ['BONAP/Stock', 'O-BAP/Stock', 'ACENB/Stock', 'ORDAP/Stock', 'ORDHL/Stock', 'ORDHY/Stock', 'ORDST/Stock', 'Kho Vải']

export default function App() {
  const container = createElement('div', {
    class: 'min-h-screen'
  })
  container.style.backgroundColor = '#faf8f5'

  // State
  let isLoggedIn = false
  let currentUser = null
  let showAdminDashboard = false
  let showLoginModal = false

  // Check if already logged in
  function checkAuth() {
    isLoggedIn = auth.isAuthenticated()
    currentUser = auth.getCurrentUser()
    return isLoggedIn
  }

  function getUrlCompany() {
    if (typeof window === 'undefined') return null
    const company = new URLSearchParams(window.location.search).get('company')
    return COMPANY_OPTIONS.includes(company) ? company : null
  }

  function hasConfirmedCompanySelection() {
    const urlCompany = getUrlCompany()
    if (urlCompany) {
      localStorage.setItem(COMPANY_FILTER_STORAGE_KEY, urlCompany)
      return true
    }

    return false
  }

  function renderCompanyChooser(onSelected) {
    const overlay = createElement('div', {
      class: 'fixed inset-0 z-50 flex items-center justify-center px-4'
    })
    overlay.style.cssText = 'background: rgba(42,35,31,0.42); backdrop-filter: blur(2px);'

    const panel = createElement('div', {})
    panel.style.cssText = `
      width: min(420px, 100%);
      background: #ffffff;
      border: 1.5px solid #e8ddd4;
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(42,35,31,0.22);
      padding: 22px;
    `

    const title = createElement('h2', {})
    title.textContent = 'Chọn công ty'
    title.style.cssText = 'margin: 0 0 6px; color: #2a231f; font-size: 22px; line-height: 1.2; font-weight: 800;'

    const subtitle = createElement('p', {})
    subtitle.textContent = 'Bạn muốn xem tồn kho của công ty nào?'
    subtitle.style.cssText = 'margin: 0 0 18px; color: #6b5a45; font-size: 14px;'

    const actions = createElement('div', {})
    actions.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;'

    function chooseCompany(company) {
      localStorage.setItem(COMPANY_FILTER_STORAGE_KEY, company)
      const companyFilter = document.getElementById('companyFilter')
      if (companyFilter) companyFilter.value = company
      overlay.remove()
      onSelected?.(company)
    }

    COMPANY_OPTIONS.forEach((company) => {
      const button = createElement('button', {
        type: 'button',
        'aria-label': `Xem tồn kho ${company}`
      })
      button.textContent = company
      button.style.cssText = `
        min-height: 48px;
        border: 1.5px solid #d4c4b0;
        border-radius: 8px;
        background: ${company === 'Bonario' ? '#6b5a45' : '#ffffff'};
        color: ${company === 'Bonario' ? '#ffffff' : '#2a231f'};
        cursor: pointer;
        font-family: inherit;
        font-size: 15px;
        font-weight: 800;
      `
      button.addEventListener('click', () => chooseCompany(company))
      actions.appendChild(button)
    })

    panel.appendChild(title)
    panel.appendChild(subtitle)
    panel.appendChild(actions)
    overlay.appendChild(panel)
    container.appendChild(overlay)
  }

  // Render login modal (only when needed for Stocktake/Admin)
  function renderLoginModal(onLoginComplete) {
    const loginOverlay = createElement('div', {
      class: 'fixed inset-0 z-50 overflow-y-auto'
    })
    loginOverlay.style.backgroundColor = 'rgba(42, 35, 31, 0.5)'

    const loginView = Login({
      onLoginSuccess: (user) => {
        isLoggedIn = true
        currentUser = user
        loginOverlay.remove()
        // Re-render main app để cập nhật header (badge user, nút logout...)
        renderMainApp()
        // Sau khi renderMainApp() render xong DOM mới, restore lại data đã có
        setTimeout(() => {
          const gd = getCurrentGroupedData()
          if (gd && Object.keys(gd).length > 0) {
            // Data đã load trước đó → chỉ cần re-render tabs + filters + cards
            updateFilterOptions(gd)
            applyFilters()
            refreshCategoryFilter()
          } else {
            // Chưa có data → fetch mới
            loadData()
          }
          onLoginComplete?.(user)
        }, 30)
      },
      onToast: showToast,
      onClose: () => {
        loginOverlay.remove()
      }
    })

    loginView.style.minHeight = '100vh'
    loginOverlay.appendChild(loginView)
    container.appendChild(loginOverlay)
  }

  // Render main application (public access, no login required)
  function renderMainApp() {
    container.innerHTML = ''

    // Header with controls
    const header = Header({
      onLoad: loadData,
      onExport: exportData,
      onExportPDF: exportDataPDF,
      onToggleStocktake: () => {
        // Check login before opening Stocktake
        if (!auth.isAuthenticated()) {
          renderLoginModal(() => {
            // After login, open stocktake - DOM đã sẵn sàng nhờ setTimeout trong renderLoginModal
            openStocktakeView()
          })
          return
        }
        openStocktakeView()
      },
      currentUser,
      onLogout: handleLogout,
      onOpenAdmin: () => {
        // Admin also requires login
        if (!auth.isAuthenticated()) {
          renderLoginModal((user) => {
            currentUser = user
            showAdminDashboard = true
            renderAdminDashboard()
          })
          return
        }
        showAdminDashboard = true
        renderAdminDashboard()
      }
    })
    container.appendChild(header)

    // Main content area
    const mainContent = createElement('div', {
      class: 'container mx-auto px-3 sm:px-6 py-4 sm:py-6'
    })

    const stockDataContainer = createElement('div', { id: 'stockData' })
    mainContent.appendChild(stockDataContainer)

    // ARTE stock check view (hidden by default)
    const arteStockView = ArteStock({ onToast: showToast })
    mainContent.appendChild(arteStockView)

    // Stocktake view (hidden by default)
    const stocktakeView = Stocktake({
      getWarehouses: () => getWarehouseNames(),
      getProductsForWarehouse: (warehouseName) => getProductsForWarehouse(warehouseName),
      onToast: showToast,
      currentUser
    })
    mainContent.appendChild(stocktakeView)

    container.appendChild(mainContent)
  }

  // Helper function to open/close stocktake view - luôn query DOM tươi
  function openStocktakeView() {
    const stockDataEl = document.getElementById('stockData')
    const stocktakeEl = document.getElementById('stocktakeView')
    const headerSearch = document.getElementById('headerSearchSection')
    const headerFilters = document.getElementById('headerFiltersSection')
    const headerWarehouseTabs = document.getElementById('warehouseTabsPlaceholder')

    if (!stocktakeEl || !stockDataEl) {
      console.warn('[openStocktakeView] DOM elements not found')
      return
    }

    const isHidden = stocktakeEl.classList.contains('hidden')
    if (isHidden) {
      // Mở kiểm kho
      stockDataEl.classList.add('hidden')
      const arteStockEl = document.getElementById('arteStockView')
      arteStockEl?.classList.add('hidden')
      stocktakeEl.classList.remove('hidden')
      stocktakeEl.refresh?.()
      headerSearch?.classList.add('hidden')
      headerFilters?.classList.add('hidden')
      headerWarehouseTabs?.classList.add('hidden')
      showToast('Đang mở Kiểm kho', 'info', 1500)
    } else {
      // Quay về tra cứu tồn
      stocktakeEl.classList.add('hidden')
      headerWarehouseTabs?.classList.remove('hidden')
      if (currentActiveWarehouse === 'Kho ARTE') {
        setArteViewActive(true)
      } else {
        stockDataEl.classList.remove('hidden')
        headerSearch?.classList.remove('hidden')
        headerFilters?.classList.remove('hidden')
        // Luôn re-render data khi quay về trang kho
        applyFilters()
        refreshCategoryFilter()
      }
      showToast('Đã quay lại Tra cứu tồn', 'info', 1500)
    }
  }

  // Render admin dashboard modal
  function renderAdminDashboard() {
    const adminView = AdminDashboard({
      currentUser,
      onToast: showToast,
      onClose: () => {
        showAdminDashboard = false
        // Remove only the overlay, keep main app intact
        adminView.remove()
        // Re-render the data that was already loaded (tabs + filters)
        applyFilters()
        refreshCategoryFilter()
      }
    })
    container.appendChild(adminView)
  }

  // Handle logout - return to main app (public mode)
  function handleLogout() {
    auth.logout()
    isLoggedIn = false
    currentUser = null
    showToast('Đã đăng xuất', 'info', 2000)
    renderMainApp()
    // Restore data sau khi re-render
    setTimeout(() => {
      const gd = getCurrentGroupedData()
      if (gd && Object.keys(gd).length > 0) {
        updateFilterOptions(gd)
        applyFilters()
        refreshCategoryFilter()
      } else {
        loadData()
      }
    }, 30)
  }

  function setArteViewActive(isActive) {
    const stockDataEl = document.getElementById('stockData')
    const arteStockEl = document.getElementById('arteStockView')
    const headerSearch = document.getElementById('headerSearchSection')
    const categoryFilter = document.getElementById('categoryFilter')
    const sortFilter = document.getElementById('sortFilter')
    const clearBtn = document.getElementById('clearFiltersBtn')
    const discontinuedToggle = document.querySelector('.discontinued-filter-toggle')

    if (isActive) {
      stockDataEl?.classList.add('hidden')
      arteStockEl?.classList.remove('hidden')
      headerSearch?.classList.add('hidden')
      if (categoryFilter) categoryFilter.style.display = 'none'
      if (sortFilter) sortFilter.style.display = 'none'
      if (clearBtn) clearBtn.style.display = 'none'
      if (discontinuedToggle) discontinuedToggle.style.display = 'none'
    } else {
      arteStockEl?.classList.add('hidden')
      stockDataEl?.classList.remove('hidden')
      headerSearch?.classList.remove('hidden')
      if (categoryFilter) categoryFilter.style.display = ''
      if (sortFilter) sortFilter.style.display = ''
      if (clearBtn) clearBtn.style.display = ''
      if (discontinuedToggle) discontinuedToggle.style.display = ''
    }
  }

  // When company changes away from Bonario, reset Kho ARTE if active
  document.addEventListener('companyContextChange', () => {
    const selectedCompany = localStorage.getItem(COMPANY_FILTER_STORAGE_KEY) || 'Bonario'
    if (selectedCompany !== 'Bonario' && currentActiveWarehouse === 'Kho ARTE') {
      currentActiveWarehouse = null
      localStorage.removeItem('lastActiveWarehouse')
      setArteViewActive(false)
    }
  })

  // Function to handle tab change
  window.handleTabChange = (warehouseName) => {
    currentActiveWarehouse = warehouseName
    // Save to localStorage
    localStorage.setItem('lastActiveWarehouse', warehouseName)

    if (warehouseName === 'Kho ARTE') {
      setArteViewActive(true)
    } else {
      setArteViewActive(false)
      applyFilters()
      refreshCategoryFilter()
    }
  }

  // Function to switch warehouse programmatically
  window.switchToWarehouse = (warehouseName) => {
    const tabButton = document.querySelector(`[data-warehouse="${warehouseName}"]`)
    if (tabButton) {
      tabButton.click()
    }
  }

  // Function to update tabs
  window.updateTabs = (warehouses) => {
    const container = document.getElementById('warehouseTabsPlaceholder')
    const selectedCompany = localStorage.getItem(COMPANY_FILTER_STORAGE_KEY) || 'Bonario'

    // Handle warehouses as object with groups or array, synchronizing Kho ARTE consistently
    const warehouseList = syncArteWarehouse(warehouses, selectedCompany)
    let firstWarehouse = null

    if (warehouseList && typeof warehouseList === 'object' && !Array.isArray(warehouseList)) {
      // Get first warehouse from any group
      firstWarehouse =
        (warehouseList.productGroup && warehouseList.productGroup[0]) ||
        (warehouseList.fabricGroup && warehouseList.fabricGroup[0]) ||
        (warehouseList.otherGroup && warehouseList.otherGroup[0]) ||
        (warehouseList.all && warehouseList.all[0]) ||
        null
    } else if (Array.isArray(warehouseList)) {
      firstWarehouse = warehouseList[0]
    }

    if (!container || !firstWarehouse) {
      if (container) container.innerHTML = ''
      return
    }

    container.innerHTML = ''

    const availableWarehouses = Array.isArray(warehouseList)
      ? warehouseList
      : (warehouseList.all || [
          ...(warehouseList.productGroup || []),
          ...(warehouseList.fabricGroup || []),
          ...(warehouseList.otherGroup || [])
        ])

    if (selectedCompany !== 'Bonario' && currentActiveWarehouse === 'Kho ARTE') {
      currentActiveWarehouse = firstWarehouse
      localStorage.setItem('lastActiveWarehouse', firstWarehouse)
      setArteViewActive(false)
    }

    const urlWarehouse = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('warehouse')
      : null
    const savedWarehouse = localStorage.getItem('lastActiveWarehouse')
    const preferredWarehouse = urlWarehouse || savedWarehouse
    const activeWarehouse = preferredWarehouse && availableWarehouses.includes(preferredWarehouse)
      ? preferredWarehouse
      : (currentActiveWarehouse && availableWarehouses.includes(currentActiveWarehouse)
          ? currentActiveWarehouse
          : firstWarehouse)

    const tabs = Tabs({
      warehouses: warehouseList,
      activeWarehouse: activeWarehouse,
      onTabChange: (warehouse) => {
        window.handleTabChange(warehouse)
      }
    })

    container.appendChild(tabs)

    // Set active warehouse
    currentActiveWarehouse = activeWarehouse
    localStorage.setItem('lastActiveWarehouse', activeWarehouse)
    setArteViewActive(activeWarehouse === 'Kho ARTE')
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  document.addEventListener('keydown', (e) => {
    // Only handle shortcuts when logged in and not in admin dashboard
    if (!isLoggedIn || showAdminDashboard) return

    // Ctrl+K or Cmd+K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      const searchInput = document.getElementById('searchInput')
      if (searchInput) {
        searchInput.focus()
        searchInput.select()
      }
    }

    // Ctrl+R or Cmd+R: Force reload data (bypass cache)
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault()
      forceRefreshData()
    }

    // Ctrl+E or Cmd+E: Export data
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault()
      exportData()
    }

    // Number keys 1-8: Switch warehouses (only when not typing)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '8') {
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )

      if (!isTyping) {
        const index = parseInt(e.key) - 1
        if (WAREHOUSE_SHORTCUTS[index]) {
          window.switchToWarehouse(WAREHOUSE_SHORTCUTS[index])
        }
      }
    }

    // Escape: Clear search and filters
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('searchInput')
      const categoryFilter = document.getElementById('categoryFilter')
      if (searchInput) searchInput.value = ''
      if (categoryFilter) categoryFilter.value = ''
      searchInput?.blur()
      applyFilters()
    }
  })

  // Initialize - always show main app (public access)
  checkAuth() // Check if already logged in (for showing user badge)
  renderMainApp()
  setTimeout(() => {
    if (hasConfirmedCompanySelection()) {
      loadData()
      return
    }

    renderCompanyChooser(() => {
      loadData()
    })
  }, 100)

  return container
}
