/**
 * Helper function to create DOM elements
 */
export function createElement(tag, attributes = {}, ...children) {
  const element = document.createElement(tag)
  
  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'class') {
      element.className = value
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value)
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, value)
    } else if (key === 'textContent') {
      element.textContent = value
    } else if (key === 'innerHTML') {
      element.innerHTML = value
    } else {
      element.setAttribute(key, value)
    }
  })
  
  // Add children
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child))
    } else if (child instanceof Node) {
      element.appendChild(child)
    } else if (Array.isArray(child)) {
      child.forEach(c => element.appendChild(c))
    }
  })
  
  return element
}

/**
 * Create icon element (using Unicode or SVG)
 */
export function createIcon(name, className = 'w-5 h-5') {
  const icons = {
    refresh: '🔄',
    download: '📥',
    search: '🔍',
    filter: '⚙️',
    clear: '✕',
    warehouse: '📦',
    category: '🏷️',
    product: '📋',
    stats: '📊',
    loading: '⏳'
  }
  
  const span = createElement('span', { class: className })
  span.textContent = icons[name] || '•'
  return span
}
