import { createElement } from './utils/dom.js'
import Header from './components/Header.js'
import Tabs from './components/Tabs.js'
import Stocktake from './components/Stocktake.js'
import Login from './components/Login.js'
import AdminDashboard from './components/AdminDashboard.js'
import { loadData, applyFilters, clearFilters, exportData, exportDataPDF, refreshCategoryFilter, forceRefreshData, clearCache, getWarehouseNames, getProductsForWarehouse, showToast, getCurrentGroupedData, updateFilterOptions } from './store/dataStore.js'
import { auth, stocktake } from './services/apiClient.js'

let currentActiveWarehouse = null

// Warehouse list for keyboard navigation
const WAREHOUSE_SHORTCUTS = ['BONAP/Stock', 'ORDAP/Stock', 'ORDHL/Stock', 'ORDHY/Stock', 'ORDST/Stock', 'Kho Vải']

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
      stocktakeEl.classList.remove('hidden')
      stocktakeEl.refresh?.()
      headerSearch?.classList.add('hidden')
      headerFilters?.classList.add('hidden')
      headerWarehouseTabs?.classList.add('hidden')
      showToast('Đang mở Kiểm kho', 'info', 1500)
    } else {
      // Quay về tra cứu tồn
      stocktakeEl.classList.add('hidden')
      stockDataEl.classList.remove('hidden')
      headerSearch?.classList.remove('hidden')
      headerFilters?.classList.remove('hidden')
      headerWarehouseTabs?.classList.remove('hidden')
      // Luôn re-render data khi quay về trang kho
      applyFilters()
      refreshCategoryFilter()
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

  // Function to handle tab change
  window.handleTabChange = (warehouseName) => {
    currentActiveWarehouse = warehouseName
    // Save to localStorage
    localStorage.setItem('lastActiveWarehouse', warehouseName)
    applyFilters()
    refreshCategoryFilter()
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

    // Handle warehouses as object with groups or array
    let warehouseList = warehouses
    let firstWarehouse = null

    if (warehouses && typeof warehouses === 'object' && !Array.isArray(warehouses)) {
      // It's a grouped object
      warehouseList = warehouses
      // Get first warehouse from any group
      firstWarehouse =
        (warehouses.productGroup && warehouses.productGroup[0]) ||
        (warehouses.fabricGroup && warehouses.fabricGroup[0]) ||
        (warehouses.otherGroup && warehouses.otherGroup[0]) ||
        (warehouses.all && warehouses.all[0]) ||
        null
    } else if (Array.isArray(warehouses)) {
      // It's an array
      warehouseList = warehouses
      firstWarehouse = warehouses[0]
    }

    if (!container || !firstWarehouse) {
      if (container) container.innerHTML = ''
      return
    }

    container.innerHTML = ''

    // Restore last active warehouse from localStorage
    const savedWarehouse = localStorage.getItem('lastActiveWarehouse')
    const activeWarehouse = savedWarehouse &&
      (warehouses.all?.includes(savedWarehouse) ||
       warehouses.productGroup?.includes(savedWarehouse) ||
       warehouses.fabricGroup?.includes(savedWarehouse))
      ? savedWarehouse
      : (currentActiveWarehouse || firstWarehouse)

    const tabs = Tabs({
      warehouses: warehouseList,
      activeWarehouse: activeWarehouse,
      onTabChange: (warehouse) => {
        currentActiveWarehouse = warehouse
        localStorage.setItem('lastActiveWarehouse', warehouse)
        applyFilters()
        refreshCategoryFilter()
      }
    })

    container.appendChild(tabs)

    // Set active warehouse
    if (!currentActiveWarehouse) {
      currentActiveWarehouse = activeWarehouse
    }
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

    // Number keys 1-6: Switch warehouses (only when not typing)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '6') {
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
    loadData()
  }, 100)

  return container
}
