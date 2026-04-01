// ============================================
// API SERVICE
// Backend API client for auth and stocktake
// ============================================

const API_BASE = typeof window !== 'undefined' 
    ? (window.location.hostname.includes('bonstu.site') 
        ? ''  // Empty - nginx handles /api routing
        : 'http://localhost:4001')
    : 'http://localhost:4001';

/**
 * Get auth token from localStorage
 */
function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
}

/**
 * Set auth token in localStorage
 */
function setToken(token) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('auth_token', token);
}

/**
 * Remove auth token from localStorage
 */
function removeToken() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
}

/**
 * Get current user from localStorage
 */
function getCurrentUser() {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
}

/**
 * Set current user in localStorage
 */
function setCurrentUser(user) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('auth_user', JSON.stringify(user));
}

/**
 * Make API request with auth token
 */
async function request(endpoint, options = {}) {
    const token = getToken();
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    };
    
    // Handle relative vs absolute URLs
    const url = API_BASE.startsWith('/') 
        ? `${API_BASE}${endpoint}`  // Relative path for production
        : `${API_BASE}${endpoint}`;  // Absolute for local
    
    console.log('[API Request]', endpoint, url);
    
    const response = await fetch(url, config);
    const data = await response.json();
    
    console.log('[API Response]', endpoint, response.status, data);
    
    if (!response.ok) {
        const error = new Error(data.error || 'API request failed');
        error.code = data.code;
        error.status = response.status;
        throw error;
    }
    
    return data;
}

// ============================================
// AUTH API
// ============================================

export const auth = {
    /**
     * Login
     */
    async login(username, password) {
        const data = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        
        if (data.success) {
            setToken(data.data.token);
            setCurrentUser({
                id: data.data.id,
                username: data.data.username,
                role: data.data.role,
            });
        }
        
        return data;
    },
    
    /**
     * Logout
     */
    async logout() {
        try {
            await request('/api/auth/logout', { method: 'POST' });
        } finally {
            removeToken();
        }
    },
    
    /**
     * Get current user
     */
    async me() {
        return request('/api/auth/me');
    },
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!getToken();
    },
    
    /**
     * Get current user (from localStorage, no API call)
     */
    getCurrentUser() {
        return getCurrentUser();
    },
    
    /**
     * List all users (admin only)
     */
    async listUsers() {
        return request('/api/auth/users');
    },
    
    /**
     * Create user (admin only)
     */
    async createUser(username, password, role = 'counter') {
        return request('/api/auth/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, role }),
        });
    },
    
    /**
     * Update user (admin only)
     */
    async updateUser(userId, updates) {
        return request(`/api/auth/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },
    
    /**
     * Delete user (admin only)
     */
    async deleteUser(userId) {
        return request(`/api/auth/users/${userId}`, {
            method: 'DELETE',
        });
    },
};

// ============================================
// STOCKTAKE API
// ============================================

export const stocktake = {
    /**
     * List sessions
     */
    async listSessions(filters = {}) {
        const params = new URLSearchParams();
        if (filters.month) params.append('month', filters.month);
        if (filters.warehouse) params.append('warehouse', filters.warehouse);
        if (filters.status) params.append('status', filters.status);
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.offset) params.append('offset', filters.offset);
        
        const queryString = params.toString();
        return request(`/api/stocktake/sessions${queryString ? `?${queryString}` : ''}`);
    },
    
    /**
     * Get session by ID
     */
    async getSession(sessionId) {
        return request(`/api/stocktake/sessions/${sessionId}`);
    },
    
    /**
     * Get session by month and warehouse
     */
    async getSessionByMonthWarehouse(month, warehouse) {
        return request(`/api/stocktake/sessions/by-month-warehouse?month=${month}&warehouse=${encodeURIComponent(warehouse)}`);
    },
    
    /**
     * Create session
     */
    async createSession(month, warehouse) {
        return request('/api/stocktake/sessions', {
            method: 'POST',
            body: JSON.stringify({ month, warehouse }),
        });
    },
    
    /**
     * Update lines (bulk)
     */
    async updateLines(sessionId, lines) {
        return request(`/api/stocktake/sessions/${sessionId}/lines`, {
            method: 'PUT',
            body: JSON.stringify({ lines }),
        });
    },
    
    /**
     * Update single line
     */
    async updateLine(sessionId, lineData) {
        return request(`/api/stocktake/sessions/${sessionId}/line`, {
            method: 'POST',
            body: JSON.stringify(lineData),
        });
    },
    
    /**
     * Lock session
     */
    async lockSession(sessionId) {
        return request(`/api/stocktake/sessions/${sessionId}/lock`, {
            method: 'POST',
        });
    },
    
    /**
     * Unlock session
     */
    async unlockSession(sessionId) {
        return request(`/api/stocktake/sessions/${sessionId}/unlock`, {
            method: 'POST',
        });
    },
    
    /**
     * Complete session
     */
    async completeSession(sessionId) {
        return request(`/api/stocktake/sessions/${sessionId}/complete`, {
            method: 'POST',
        });
    },
    
    /**
     * Delete session
     */
    async deleteSession(sessionId) {
        return request(`/api/stocktake/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    },
    
    /**
     * Get session stats
     */
    async getSessionStats(sessionId) {
        return request(`/api/stocktake/sessions/${sessionId}/stats`);
    },
};

// ============================================
// EXPORTS
// ============================================

export default {
    auth,
    stocktake,
    getToken,
    setToken,
    removeToken,
    getCurrentUser,
    isAuthenticated: () => !!getToken(),
};
