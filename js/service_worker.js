// Cambridge Stall Planner - Service Worker
// Provides offline functionality and caching for mobile web app

const CACHE_NAME = 'cambridge-stall-planner-v1.0.0';
const STATIC_CACHE_NAME = 'static-v1.0.0';

// Files to cache immediately (app shell)
const STATIC_FILES = [
  '/',
  '/index.html',
  '/ruskin-courtyard.html',
  '/science-walkway.html', 
  '/lab-courtyard.html',
  '/styles/main.css',
  '/styles/layout.css',
  '/js/main.js',
  '/js/drag-handler.js',
  '/js/mobile-utils.js',
  '/manifest.json',
  // CDN resources
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js'
];

// Runtime cache patterns
const RUNTIME_CACHE = 'runtime-v1.0.0';

/**
 * Install event - cache app shell immediately
 */
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] App shell cached successfully');
        return self.skipWaiting(); // Force activation
      })
      .catch(error => {
        console.error('[SW] Failed to cache app shell:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const deletePromises = cacheNames
          .filter(cacheName => {
            // Keep current caches, delete old ones
            return !cacheName.includes('v1.0.0');
          })
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        return self.clients.claim(); // Take control immediately
      })
  );
});

/**
 * Fetch event - serve from cache, fallback to network
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const { url, method } = request;
  
  // Only handle GET requests
  if (method !== 'GET') return;
  
  // Skip non-HTTP requests
  if (!url.startsWith('http')) return;
  
  event.respondWith(handleFetch(request));
});

/**
 * Handle fetch requests with cache-first strategy for app shell,
 * network-first for dynamic content
 */
async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Cache-first strategy for app shell and static assets
    if (isStaticAsset(url)) {
      return await cacheFirst(request);
    }
    
    // Network-first strategy for external resources
    if (isExternalResource(url)) {
      return await networkFirst(request);
    }
    
    // Default: cache-first for everything else
    return await cacheFirst(request);
    
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return await caches.match('/index.html');
    }
    
    throw error;
  }
}

/**
 * Cache-first strategy: Check cache, fallback to network
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving from cache:', request.url);
    return cachedResponse;
  }
  
  console.log('[SW] Fetching from network:', request.url);
  const networkResponse = await fetch(request);
  
  // Cache successful responses
  if (networkResponse.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

/**
 * Network-first strategy: Try network, fallback to cache
 */
async function networkFirst(request) {
  try {
    console.log('[SW] Network-first fetch:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Check if URL is a static app asset
 */
function isStaticAsset(url) {
  const pathname = url.pathname;
  
  return pathname.endsWith('.html') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.json') ||
         pathname === '/' ||
         STATIC_FILES.some(file => pathname.includes(file));
}

/**
 * Check if URL is an external resource (CDN)
 */
function isExternalResource(url) {
  return url.hostname !== self.location.hostname;
}

/**
 * Handle background sync (future enhancement)
 */
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'stall-layout-sync') {
    event.waitUntil(syncStallLayouts());
  }
});

/**
 * Sync stall layouts when connection restored
 */
async function syncStallLayouts() {
  try {
    console.log('[SW] Syncing stall layouts...');
    // Future: sync any pending layout changes
    // For now, just ensure fresh content is cached
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = [
      new Request('/ruskin-courtyard.html'),
      new Request('/science-walkway.html'),
      new Request('/lab-courtyard.html')
    ];
    
    const promises = requests.map(request => 
      fetch(request).then(response => {
        if (response.ok) {
          return cache.put(request, response);
        }
      }).catch(() => {
        // Ignore sync failures
      })
    );
    
    await Promise.all(promises);
    console.log('[SW] Layout sync completed');
    
  } catch (error) {
    console.error('[SW] Layout sync failed:', error);
  }
}

/**
 * Handle push notifications (future enhancement)
 */
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'Your stall layout has been updated',
    icon: '/manifest.json', // Will use icon from manifest
    badge: '/manifest.json',
    vibrate: [200, 100, 200],
    tag: 'stall-update',
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification('Cambridge Stall Planner', options)
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    self.clients.openWindow('/')
  );
});

// Log service worker lifecycle
console.log('[SW] Service worker script loaded');