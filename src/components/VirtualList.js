// ============================================
// VIRTUAL LIST - Render only visible items
// ============================================
// Vanilla JS implementation for large lists
// Improves performance by only rendering visible cards
// ============================================

/**
 * Virtual List class for efficient rendering of large lists
 * Only renders items visible in the viewport + buffer
 */
export class VirtualList {
    constructor(options) {
        this.container = options.container;
        this.items = options.items || [];
        this.renderItem = options.renderItem;
        this.itemHeight = options.itemHeight || 280; // Default card height
        this.columns = options.columns || 3; // Grid columns
        this.buffer = options.buffer || 3; // Extra rows to render above/below
        this.gap = options.gap || 16; // Gap between items
        
        // Calculate row height (item height + gap)
        this.rowHeight = this.itemHeight + this.gap;
        
        // State
        this.scrollTop = 0;
        this.visibleStartIndex = 0;
        this.visibleEndIndex = 0;
        
        // DOM elements
        this.wrapper = null;
        this.content = null;
        this.scrollContainer = null;
        
        // Throttle scroll handler
        this.scrollHandler = this.throttle(this.onScroll.bind(this), 16);
        
        // Responsive columns
        this.updateColumns();
        window.addEventListener('resize', this.throttle(this.handleResize.bind(this), 100));
    }
    
    /**
     * Initialize the virtual list
     */
    init() {
        if (!this.container) return;
        
        // Create scroll container structure
        this.container.innerHTML = '';
        
        // Wrapper for positioning
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'virtual-list-wrapper';
        this.wrapper.style.cssText = `
            position: relative;
            overflow-y: auto;
            overflow-x: hidden;
            height: 100%;
            max-height: calc(100vh - 300px);
            min-height: 400px;
        `;
        
        // Content container with full height for scrollbar
        this.content = document.createElement('div');
        this.content.className = 'virtual-list-content';
        this.updateContentHeight();
        
        // Visible items container
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-list-visible grid gap-4';
        this.scrollContainer.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            will-change: transform;
        `;
        this.updateGridColumns();
        
        this.content.appendChild(this.scrollContainer);
        this.wrapper.appendChild(this.content);
        this.container.appendChild(this.wrapper);
        
        // Add scroll listener
        this.wrapper.addEventListener('scroll', this.scrollHandler, { passive: true });
        
        // Initial render
        this.render();
    }
    
    /**
     * Update items and re-render
     */
    setItems(items) {
        this.items = items || [];
        this.updateContentHeight();
        this.render();
    }
    
    /**
     * Update total content height based on items count
     */
    updateContentHeight() {
        const totalRows = Math.ceil(this.items.length / this.columns);
        const totalHeight = totalRows * this.rowHeight;
        if (this.content) {
            this.content.style.height = `${totalHeight}px`;
        }
    }
    
    /**
     * Update grid columns based on viewport
     */
    updateColumns() {
        const width = window.innerWidth;
        if (width < 768) {
            this.columns = 1; // Mobile: 1 column
        } else if (width < 1024) {
            this.columns = 2; // Tablet: 2 columns
        } else {
            this.columns = 3; // Desktop: 3 columns
        }
    }
    
    /**
     * Update grid CSS
     */
    updateGridColumns() {
        if (this.scrollContainer) {
            this.scrollContainer.style.gridTemplateColumns = `repeat(${this.columns}, 1fr)`;
        }
    }
    
    /**
     * Handle resize events
     */
    handleResize() {
        const oldColumns = this.columns;
        this.updateColumns();
        
        if (oldColumns !== this.columns) {
            this.updateGridColumns();
            this.updateContentHeight();
            this.render();
        }
    }
    
    /**
     * Handle scroll events
     */
    onScroll() {
        if (!this.wrapper) return;
        this.scrollTop = this.wrapper.scrollTop;
        this.render();
    }
    
    /**
     * Calculate visible range of items
     */
    calculateVisibleRange() {
        const viewportHeight = this.wrapper?.clientHeight || 600;
        
        // Calculate which rows are visible
        const startRow = Math.floor(this.scrollTop / this.rowHeight);
        const visibleRows = Math.ceil(viewportHeight / this.rowHeight);
        
        // Add buffer rows
        const bufferStartRow = Math.max(0, startRow - this.buffer);
        const bufferEndRow = startRow + visibleRows + this.buffer;
        
        // Convert to item indices
        const totalRows = Math.ceil(this.items.length / this.columns);
        this.visibleStartIndex = bufferStartRow * this.columns;
        this.visibleEndIndex = Math.min(
            (bufferEndRow + 1) * this.columns,
            this.items.length
        );
        
        return {
            startRow: bufferStartRow,
            endRow: Math.min(bufferEndRow, totalRows - 1),
            startIndex: this.visibleStartIndex,
            endIndex: this.visibleEndIndex
        };
    }
    
    /**
     * Render visible items
     */
    render() {
        if (!this.scrollContainer || this.items.length === 0) {
            if (this.scrollContainer) {
                this.scrollContainer.innerHTML = '';
            }
            return;
        }
        
        const { startRow, startIndex, endIndex } = this.calculateVisibleRange();
        
        // Position the container
        const offsetY = startRow * this.rowHeight;
        this.scrollContainer.style.transform = `translateY(${offsetY}px)`;
        
        // Render only visible items
        const fragment = document.createDocumentFragment();
        
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.items[i];
            if (!item) continue;
            
            const element = this.renderItem(item, i);
            if (element) {
                fragment.appendChild(element);
            }
        }
        
        this.scrollContainer.innerHTML = '';
        this.scrollContainer.appendChild(fragment);
    }
    
    /**
     * Scroll to a specific item
     */
    scrollToItem(index) {
        if (!this.wrapper) return;
        
        const row = Math.floor(index / this.columns);
        const targetScroll = row * this.rowHeight;
        
        this.wrapper.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
    }
    
    /**
     * Throttle function for performance
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Cleanup - remove event listeners
     */
    destroy() {
        if (this.wrapper) {
            this.wrapper.removeEventListener('scroll', this.scrollHandler);
        }
        window.removeEventListener('resize', this.handleResize);
    }
}

/**
 * Create a product card element for virtual list
 */
export function createProductCard(product, index, options = {}) {
    const { hideIncoming = false } = options;
    
    const productName = product.product_name || `Sản phẩm ID: ${product.product_id?.[0] || 'N/A'}`;
    const lotIds = (product.lot_ids && product.lot_ids.length > 0)
        ? product.lot_ids
            .map((l) => {
                if (typeof l === "string") return l;
                if (l && typeof l === "object") {
                    if (typeof l.name === "string") return l.name;
                    if (Array.isArray(l) && typeof l[1] === "string") return l[1];
                }
                return null;
            })
            .filter(Boolean)
            .join(", ")
        : null;
    
    const status = getStockStatus(product.quantity, product.available_quantity);
    const badge = getStockBadge(status);
    const unit = product.uom_id && product.uom_id[1] ? product.uom_id[1] : "";
    
    const card = document.createElement('div');
    card.className = 'stock-card animate-slide-down flex flex-col';
    card.style.cssText = `animation-delay: ${Math.min(index * 0.02, 0.3)}s; height: 100%;`;
    card.setAttribute('data-category', product.categoryName);
    
    card.innerHTML = `
        <div class="flex items-start justify-between mb-4" style="min-height: 70px;">
            <div class="flex-1 pr-2">
                <h3 class="text-sm font-semibold mb-1 line-clamp-2" style="color: #2a231f; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${escapeHtml(productName)}
                </h3>
                <span class="category-badge">${escapeHtml(product.categoryName || '')}</span>
            </div>
            ${badge}
        </div>

        <div class="grid ${hideIncoming ? "grid-cols-2" : "grid-cols-3"} gap-2 mt-auto pt-4" style="border-top: 1px solid #e8ddd4;">
            <div class="text-center p-2.5 rounded-lg flex flex-col justify-center" style="background-color: #faf8f5; min-height: 90px;">
                <p class="quantity-label mb-1.5">Tồn kho</p>
                <p class="quantity-display mb-1">${(product.quantity || 0).toLocaleString()}</p>
                ${unit ? `<p class="text-xs" style="color: #8b7355; margin-top: auto;">${escapeHtml(unit)}</p>` : `<div style="height: 16px;"></div>`}
            </div>
            <div class="text-center p-2.5 rounded-lg flex flex-col justify-center" style="background-color: ${status === "low" ? "#fff8e6" : "#f5f9f5"}; min-height: 90px;">
                <p class="quantity-label mb-1.5">Khả dụng</p>
                <p class="quantity-display mb-1" style="color: ${status === "low" ? "#856404" : "#2a231f"};">${(product.available_quantity || 0).toLocaleString()}</p>
                ${unit ? `<p class="text-xs" style="color: #8b7355; margin-top: auto;">${escapeHtml(unit)}</p>` : `<div style="height: 16px;"></div>`}
            </div>
            ${hideIncoming ? "" : `
            <div class="text-center p-2.5 rounded-lg flex flex-col justify-center" style="background-color: #e8f4f8; min-height: 90px;">
                <p class="quantity-label mb-1.5">Đang đến</p>
                <p class="quantity-display mb-1" style="color: #0066cc;">
                    ${(Number.isFinite(product.incoming_qty) ? product.incoming_qty : Number(product.incoming_qty) || 0).toLocaleString()}
                </p>
                <div class="flex flex-col" style="margin-top: auto;">
                ${product.incoming_date 
                    ? `<p class="text-[10px] mb-1" style="color: #4b83a6;">ETA: ${new Date(product.incoming_date).toLocaleDateString('vi-VN')}</p>` 
                    : `<div style="height: 12px;"></div>`
                }
                ${unit ? `<p class="text-xs" style="color: #8b7355;">${escapeHtml(unit)}</p>` : `<div style="height: 16px;"></div>`}
                </div>
            </div>`}
        </div>

        ${lotIds ? `
        <div class="mt-3 pt-3" style="border-top: 1px solid #f5f1ea;">
            <p class="text-xs" style="color: #7d6d5a;">
                <strong>Số lô:</strong> ${escapeHtml(lotIds)}
            </p>
        </div>
        ` : ""}
    `;
    
    return card;
}

/**
 * Helper: Get stock status
 */
function getStockStatus(quantity, available) {
    const qty = quantity || 0;
    const avail = available || 0;
    
    if (qty === 0) return 'out';
    if (avail < qty * 0.2) return 'low';
    return 'normal';
}

/**
 * Helper: Get stock badge HTML
 */
function getStockBadge(status) {
    const badges = {
        out: '<span class="stock-badge stock-badge-danger">Hết hàng</span>',
        low: '<span class="stock-badge stock-badge-warning">Tồn thấp</span>',
        normal: '<span class="stock-badge stock-badge-success">Còn hàng</span>'
    };
    return badges[status] || badges.normal;
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export default VirtualList;
