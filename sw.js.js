// Enhanced Service Worker for UNION Staff Management App
// Version: 2.0 - Enhanced cache management and update handling

const APP_NAME = 'union-staff';
const VERSION = '2.0.1'; // Increment this for each deployment
const CACHE_NAME = `${APP_NAME}-v${VERSION}`;

// Cache strategies for different types of resources
const CACHE_STRATEGIES = {
  // Core app files - cache first, update in background
  APP_SHELL: `${APP_NAME}-app-shell-v${VERSION}`,
  // Data files - network first, fallback to cache
  DATA: `${APP_NAME}-data-v${VERSION}`,
  // Assets - cache first with long expiration
  ASSETS: `${APP_NAME}-assets-v${VERSION}`
};

// Define which files belong to which cache strategy
const CACHE_RESOURCES = {
  [CACHE_STRATEGIES.APP_SHELL]: [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/admin/stallholder-editor.html'
  ],
  [CACHE_STRATEGIES.DATA]: [
    '/data/cambridge-staff-rota.json',
    '/data/chelmsford-staff-rota.json',
    '/data/cambridge-stallholders.json',
    '/data/chelmsford-stallholders.json'
  ],
  [CACHE_STRATEGIES.ASSETS]: [
    '/assets/images/unionlogo.png',
    '/assets/images/192.png',
    '/assets/images/512.png'
  ]
};

// All resources that should be cached
const ALL_CACHE_RESOURCES = [
  ...CACHE_RESOURCES[CACHE_STRATEGIES.APP_SHELL],
  ...CACHE_RESOURCES[CACHE_STRATEGIES.DATA],
  ...CACHE_RESOURCES[CACHE_STRATEGIES.ASSETS]
];

// Resources that are critical for offline functionality
const CRITICAL_RESOURCES = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js'
];

// INSTALL EVENT - Download and cache resources
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Cache app shell resources
      caches.open(CACHE_STRATEGIES.APP_SHELL)
        .then(cache => {
          console.log('[SW] Caching app shell resources');
          return cache.addAll(CACHE_RESOURCES[CACHE_STRATEGIES.APP_SHELL]);
        }),
      
      // Cache data resources  
      caches.open(CACHE_STRATEGIES.DATA)
        .then(cache => {
          console.log('[SW] Caching data resources');
          return cache.addAll(CACHE_RESOURCES[CACHE_STRATEGIES.DATA]);
        }),
        
      // Cache asset resources
      caches.open(CACHE_STRATEGIES.ASSETS)
        .then(cache => {
          console.log('[SW] Caching asset resources');
          return cache.addAll(CACHE_RESOURCES[CACHE_STRATEGIES.ASSETS]);
        })
    ])
    .then(() => {
      console.log('[SW] Installation successful');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
    .catch(error => {
      console.error('[SW] Installation failed:', error);
    })
  );
});

// ACTIVATE EVENT - Clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        const deletePromises = cacheNames
          .filter(cacheName => {
            // Keep current version caches
            return cacheName.startsWith(APP_NAME) && 
                   !Object.values(CACHE_STRATEGIES).includes(cacheName);
          })
          .map(cacheName => {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      }),
      
      // Take control of all clients immediately
      self.clients.claim()
    ])
    .then(() => {
      console.log('[SW] Activation successful, controlling all clients');
      
      // Notify all clients about the update
      return self.clients.matchAll();
    })
    .then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: VERSION
        });
      });
    })
    .catch(error => {
      console.error('[SW] Activation failed:', error);
    })
  );
});

// FETCH EVENT - Handle network requests with appropriate cache strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Determine cache strategy based on request
  if (isDataRequest(request)) {
    event.respondWith(handleDataRequest(request));
  } else if (isAppShellRequest(request)) {
    event.respondWith(handleAppShellRequest(request));
  } else if (isAssetRequest(request)) {
    event.respondWith(handleAssetRequest(request));
  } else {
    event.respondWith(handleGenericRequest(request));
  }
});

// MESSAGE EVENT - Handle messages from the main app
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      console.log('[SW] Received SKIP_WAITING message');
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: VERSION });
      break;
      
    case 'CLEAR_DATA_CACHE':
      console.log('[SW] Clearing data cache on request');
      caches.delete(CACHE_STRATEGIES.DATA)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch(error => {
          event.ports[0].postMessage({ success: false, error });
        });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// CACHE STRATEGY FUNCTIONS

// Data requests: Network first, fallback to cache
async function handleDataRequest(request) {
  const cacheName = CACHE_STRATEGIES.DATA;
  
  try {
    console.log('[SW] Fetching fresh data:', request.url);
    const response = await fetch(request);
    
    if (response.ok) {
      // Update cache with fresh data
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      console.log('[SW] Updated data cache:', request.url);
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Serving from data cache:', request.url);
      return cachedResponse;
    }
    
    // If it's a critical data file, return a meaningful error
    if (request.url.includes('.json')) {
      return new Response(
        JSON.stringify({ 
          error: 'Data temporarily unavailable',
          offline: true,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 503
        }
      );
    }
    
    throw error;
  }
}

// App shell requests: Cache first with network update
async function handleAppShellRequest(request) {
  const cacheName = CACHE_STRATEGIES.APP_SHELL;
  
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('[SW] Serving from app shell cache:', request.url);
    
    // Update cache in background
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(cacheName)
            .then(cache => cache.put(request, response));
        }
      })
      .catch(() => {}); // Ignore background update failures
    
    return cachedResponse;
  }
  
  // Fallback to network
  try {
    console.log('[SW] Cache miss, fetching from network:', request.url);
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // If it's the root request, serve index.html from cache
    if (request.mode === 'navigate') {
      const indexResponse = await caches.match('/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }
    
    throw error;
  }
}

// Asset requests: Cache first, long-term storage
async function handleAssetRequest(request) {
  const cacheName = CACHE_STRATEGIES.ASSETS;
  
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log('[SW] Serving from asset cache:', request.url);
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      console.log('[SW] Cached new asset:', request.url);
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Asset request failed:', request.url, error);
    throw error;
  }
}

// Generic requests: Basic cache-first strategy
async function handleGenericRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  return fetch(request);
}

// HELPER FUNCTIONS

function isDataRequest(request) {
  return request.url.includes('/data/') && request.url.endsWith('.json');
}

function isAppShellRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  return CACHE_RESOURCES[CACHE_STRATEGIES.APP_SHELL].some(resource => 
    pathname === resource || pathname.endsWith(resource)
  );
}

function isAssetRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  return pathname.startsWith('/assets/') || 
         pathname.endsWith('.png') || 
         pathname.endsWith('.jpg') || 
         pathname.endsWith('.jpeg') || 
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico');
}

// UTILITY FUNCTIONS FOR DEBUGGING

// Log cache contents (useful for debugging)
async function logCacheContents() {
  const cacheNames = await caches.keys();
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    console.log(`[SW] Cache ${cacheName}:`, requests.map(r => r.url));
  }
}

// Clear all caches (for debugging)
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

// Export functions for debugging (accessible via console)
self.logCacheContents = logCacheContents;
self.clearAllCaches = clearAllCaches;

console.log(`[SW] Service Worker ${VERSION} loaded and ready`);