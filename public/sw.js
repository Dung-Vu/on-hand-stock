// ============================================
// SERVICE WORKER - Offline Support & Caching
// ============================================

const CACHE_NAME = 'bonario-stock-v1';
const CACHE_VERSION = '1.0.0';
const FULL_CACHE_NAME = `${CACHE_NAME}-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/src/main.js',
    '/src/App.js',
    '/src/config.js',
    '/src/style.css'
];

// API endpoints to cache with network-first strategy
const API_CACHE_URLS = [
    '/api/stock',
    '/api/incoming',
    '/api/fabric-products'
];

// ============================================
// INSTALL EVENT
// Cache static assets
// ============================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(FULL_CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Service worker installed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache:', error);
            })
    );
});

// ============================================
// ACTIVATE EVENT
// Clean up old caches
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith(CACHE_NAME) && name !== FULL_CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
});

// ============================================
// FETCH EVENT
// Handle network requests with caching strategies
// ============================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) protocols
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // API requests: Network-first, fallback to cache
    if (isApiRequest(url)) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Static assets: Cache-first, fallback to network
    event.respondWith(cacheFirstStrategy(request));
});

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Network-first strategy (for API calls)
 * Try network first, fall back to cache if offline
 */
async function networkFirstStrategy(request) {
    const cache = await caches.open(FULL_CACHE_NAME);
    
    try {
        const networkResponse = await fetch(request);
        
        // Only cache successful responses
        if (networkResponse.ok) {
            // Clone response before caching (response can only be consumed once)
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Serving from cache:', request.url);
            return cachedResponse;
        }
        
        // Return offline response if no cache available
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Không có kết nối mạng và không có dữ liệu cache',
                offline: true
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Cache-first strategy (for static assets)
 * Try cache first, fall back to network
 */
async function cacheFirstStrategy(request) {
    const cache = await caches.open(FULL_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // Return cached response immediately
        // Also update cache in background (stale-while-revalidate)
        updateCacheInBackground(cache, request);
        return cachedResponse;
    }
    
    // Not in cache, fetch from network
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed for static asset:', request.url);
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return cache.match('/index.html');
        }
        
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Update cache in background (stale-while-revalidate)
 */
async function updateCacheInBackground(cache, request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse);
        }
    } catch (error) {
        // Silently fail - we already served cached content
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if request is an API call
 */
function isApiRequest(url) {
    return API_CACHE_URLS.some(apiUrl => url.pathname.includes(apiUrl));
}

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(FULL_CACHE_NAME).then(() => {
            console.log('[SW] Cache cleared');
            event.ports[0].postMessage({ success: true });
        });
    }
});

console.log('[SW] Service worker loaded');
