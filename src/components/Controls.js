import { createElement } from '../utils/dom.js'
import { updateFilterOptions } from '../store/dataStore.js'

export default function Controls({ onLoad, onExport, onExportPDF, onClear }) {
  const controls = createElement('div', {
    class: 'glass rounded-xl p-6 space-y-4 border border-white/10'
  })

  // Button group
  const buttonGroup = createElement('div', {
    class: 'flex flex-wrap gap-3'
  })

  const loadBtn = createElement('button', {
    id: 'loadDataBtn',
    class: 'px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2'
  })
  loadBtn.innerHTML = '<span>🔄</span> <span>Tải dữ liệu</span>'
  loadBtn.addEventListener('click', onLoad)

  const exportBtn = createElement('button', {
    id: 'exportBtn',
    class: 'px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2'
  })
  exportBtn.innerHTML = '<span>📊</span> <span>Xuất Excel</span>'
  exportBtn.addEventListener('click', onExport)

  // PDF Export button
  const exportPDFBtn = createElement('button', {
    id: 'exportPDFBtn',
    class: 'px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2'
  })
  exportPDFBtn.innerHTML = '<span>📄</span> <span>Xuất PDF</span>'
  exportPDFBtn.addEventListener('click', onExportPDF)

  buttonGroup.appendChild(loadBtn)
  buttonGroup.appendChild(exportBtn)
  buttonGroup.appendChild(exportPDFBtn)

  // Search and filter group
  const searchFilterGroup = createElement('div', {
    class: 'grid grid-cols-1 md:grid-cols-5 gap-3'
  })

  const searchInput = createElement('input', {
    id: 'searchInput',
    type: 'text',
    placeholder: '🔍 Tìm theo tên sản phẩm hoặc số lô...',
    class: 'px-4 py-3 bg-dark-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
  })

  const warehouseFilter = createElement('select', {
    id: 'warehouseFilter',
    class: 'px-4 py-3 bg-dark-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
  })
  const warehouseOption = createElement('option', { value: '' }, 'Tất cả kho')
  warehouseFilter.appendChild(warehouseOption)

  const categoryFilter = createElement('select', {
    id: 'categoryFilter',
    class: 'px-4 py-3 bg-dark-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
  })
  const categoryOption = createElement('option', { value: '' }, 'Tất cả nhóm')
  categoryFilter.appendChild(categoryOption)

  // Discontinued filter toggle
  const discontinuedFilterWrapper = createElement('label', {
    class: 'discontinued-filter-toggle',
    title: 'Lọc sản phẩm ngưng sản xuất'
  })
  const discontinuedCheckbox = createElement('input', {
    id: 'discontinuedFilter',
    type: 'checkbox',
    class: 'discontinued-checkbox'
  })
  const discontinuedLabel = createElement('span', {
    class: 'discontinued-filter-label'
  })
  discontinuedLabel.innerHTML = '⚠️ Ngưng SX'
  discontinuedFilterWrapper.appendChild(discontinuedCheckbox)
  discontinuedFilterWrapper.appendChild(discontinuedLabel)

  const clearBtn = createElement('button', {
    id: 'clearFiltersBtn',
    class: 'px-4 py-3 bg-red-600/80 hover:bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105',
    title: 'Xoá bộ lọc'
  }, '✕ Xoá')

  searchFilterGroup.appendChild(searchInput)
  searchFilterGroup.appendChild(warehouseFilter)
  searchFilterGroup.appendChild(categoryFilter)
  searchFilterGroup.appendChild(discontinuedFilterWrapper)
  searchFilterGroup.appendChild(clearBtn)

  // Statistics summary
  const statsSummary = createElement('div', {
    id: 'statsSummary',
    class: 'flex flex-wrap gap-6 pt-4 border-t border-gray-700'
  })

  controls.appendChild(buttonGroup)
  controls.appendChild(searchFilterGroup)
  controls.appendChild(statsSummary)

  // Event listeners
  searchInput.addEventListener('input', () => {
    const event = new CustomEvent('filterChange')
    document.dispatchEvent(event)
  })

  warehouseFilter.addEventListener('change', () => {
    const event = new CustomEvent('filterChange')
    document.dispatchEvent(event)
  })

  categoryFilter.addEventListener('change', () => {
    const event = new CustomEvent('filterChange')
    document.dispatchEvent(event)
  })

  discontinuedCheckbox.addEventListener('change', () => {
    const event = new CustomEvent('filterChange')
    document.dispatchEvent(event)
  })

  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    warehouseFilter.value = ''
    categoryFilter.value = ''
    discontinuedCheckbox.checked = false
    onClear()
  })

  return controls
}
