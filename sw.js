// Simple Service Worker that actually works for data updates
const APP_NAME = 'union-staff';
const VERSION = '3.7.0'; // Change this every time you deploy
const CACHE_NAME = `${APP_NAME}-v${VERSION}`;

// What to cache
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/assets/images/unionlogo.png'
];

// Install - cache static files only
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing ${VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_RESOURCES))
      .then(() => self.skipWaiting())
  );
});

// Activate - delete old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating ${VERSION}`);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith(APP_NAME) && name !== CACHE_NAME)
            .map(name => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Message handler - respond to version requests
self.addEventListener('message', (event) => {
  const { type } = event.data;
  
  if (type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});

// Fetch - NEVER cache JSON data files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // For JSON data files: ALWAYS fetch fresh, never cache
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request.url + '?v=' + Date.now(), {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    );
    return;
  }
  
  // For static files: cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
