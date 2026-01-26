import { createElement } from './utils/dom.js'
import Header from './components/Header.js'
import Tabs from './components/Tabs.js'
import { loadData, applyFilters, clearFilters, exportData, refreshCategoryFilter } from './store/dataStore.js'

let currentActiveWarehouse = null

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
    applyFilters()
    refreshCategoryFilter()
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

    const tabs = Tabs({
      warehouses: warehouseList,
      activeWarehouse: currentActiveWarehouse || firstWarehouse,
      onTabChange: (warehouse) => {
        currentActiveWarehouse = warehouse
        applyFilters()
        refreshCategoryFilter()
      }
    })

    container.appendChild(tabs)

    // Set first warehouse as active if none selected
    if (!currentActiveWarehouse) {
      currentActiveWarehouse = firstWarehouse
    }
  }

  // Initialize and load data
  setTimeout(() => {
    loadData()
  }, 100)

  return container
}
