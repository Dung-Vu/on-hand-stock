// ============================================
// UI MODULE - UI State Management
// ============================================

import { signal, computed } from '@preact/signals-core';

// ============================================
// UI STATE
// ============================================

// Loading state
export const isLoading = signal(false);

// WebSocket connection status
export const wsConnected = signal(false);

// Modal state
export const activeModal = signal(null);

// Sidebar state
export const sidebarOpen = signal(false);

// Toast notifications queue
export const toasts = signal([]);

// Cache statistics
export const cacheStats = signal({
    size: 0,
    hits: 0,
    misses: 0
});

// Export progress
export const exportProgress = signal({
    active: false,
    progress: 0,
    type: null
});

// ============================================
// UI ACTIONS
// ============================================

export function setLoading(value) {
    isLoading.value = value;
}

export function setWsConnected(connected) {
    wsConnected.value = connected;
}

export function openModal(modalId, data = null) {
    activeModal.value = { id: modalId, data };
}

export function closeModal() {
    activeModal.value = null;
}

export function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
}

export function setSidebarOpen(open) {
    sidebarOpen.value = open;
}

export function addToast(toast) {
    const newToasts = [...toasts.value];
    const id = Date.now() + Math.random();
    
    newToasts.push({
        id,
        message: toast.message,
        type: toast.type || 'info',
        duration: toast.duration || 3000,
        timestamp: Date.now()
    });
    
    toasts.value = newToasts;
    
    // Auto remove after duration
    setTimeout(() => {
        removeToast(id);
    }, toast.duration || 3000);
    
    return id;
}

export function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
}

export function clearToasts() {
    toasts.value = [];
}

export function setCacheStats(stats) {
    cacheStats.value = stats;
}

export function setExportProgress(progress) {
    exportProgress.value = progress;
}

export function startExport(type) {
    exportProgress.value = {
        active: true,
        progress: 0,
        type
    };
}

export function updateExportProgress(progress) {
    const current = exportProgress.value;
    exportProgress.value = {
        ...current,
        progress
    };
}

export function completeExport() {
    exportProgress.value = {
        active: false,
        progress: 100,
        type: null
    };
}

// ============================================
// COMPUTED UI STATE
// ============================================

// Is any modal open
export const isModalOpen = computed(() => {
    return activeModal.value !== null;
});

// Has active toasts
export const hasToasts = computed(() => {
    return toasts.value.length > 0;
});

// Cache hit rate
export const cacheHitRate = computed(() => {
    const stats = cacheStats.value;
    const total = stats.hits + stats.misses;
    
    if (total === 0) return 0;
    
    return Math.round((stats.hits / total) * 100);
});

// Is exporting
export const isExporting = computed(() => {
    return exportProgress.value.active;
});

// Export status text
export const exportStatusText = computed(() => {
    const { active, progress, type } = exportProgress.value;
    
    if (!active) return null;
    
    const typeLabel = type === 'excel' ? 'Excel' : 'PDF';
    return `Exporting ${typeLabel}... ${progress}%`;
});
