const CACHE_NAME = 'bonario-stock-v1';
const CACHE_VERSION = '3.2.0';
const FULL_CACHE_NAME = `${CACHE_NAME}-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/src/main.js',
    '/src/App.js',
    '/src/config.js',
    '/src/style.css',
];

const API_CACHE_URLS = [
    '/api/stock',
    '/api/incoming',
    '/api/fabric-products',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(FULL_CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((name) => name.startsWith(CACHE_NAME) && name !== FULL_CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    if (isApiRequest(url)) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    event.respondWith(cacheFirstStrategy(request));
});

async function networkFirstStrategy(request) {
    const cache = await caches.open(FULL_CACHE_NAME);

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        return new Response(
            JSON.stringify({
                success: false,
                error: 'Không có kết nối mạng và không có dữ liệu cache',
                offline: true,
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}

async function cacheFirstStrategy(request) {
    const cache = await caches.open(FULL_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        updateCacheInBackground(cache, request);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        if (request.mode === 'navigate') {
            return cache.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
    }
}

async function updateCacheInBackground(cache, request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse);
        }
    } catch {
        // The cached response has already been served.
    }
}

function isApiRequest(url) {
    return API_CACHE_URLS.some((apiUrl) => url.pathname.includes(apiUrl));
}

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data?.type === 'CLEAR_CACHE') {
        caches.delete(FULL_CACHE_NAME).then(() => {
            event.ports[0]?.postMessage({ success: true });
        });
    }
});
