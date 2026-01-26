import { createElement } from './utils/dom.js'
import Header from './components/Header.js'
import Tabs from './components/Tabs.js'
import { loadData, applyFilters, clearFilters, exportData, refreshCategoryFilter, forceRefreshData, clearCache } from './store/dataStore.js'

let currentActiveWarehouse = null

// Warehouse list for keyboard navigation
const WAREHOUSE_SHORTCUTS = ['BONAP/Stock', 'ORDAP/Stock', 'ORDHL/Stock', 'ORDHY/Stock', 'ORDST/Stock', 'Kho Vải']

export default function App() {
  const container = createElement('div', {
    class: 'min-h-screen'
  })
  container.style.backgroundColor = '#faf8f5'

  // Header with controls
  const header = Header({
    onLoad: loadData
  })
  container.appendChild(header)

  // Main content area
  const mainContent = createElement('div', {
    class: 'container mx-auto px-6 py-6'
  })

  const stockDataContainer = createElement('div', { id: 'stockData' })
  mainContent.appendChild(stockDataContainer)

  container.appendChild(mainContent)

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

  // Initialize and load data
  setTimeout(() => {
    loadData()
  }, 100)

  return container
}
