const CACHE_NAME = 'union-staff-v1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/data/cambridge-staff-rota.json',
  '/data/chelmsford-staff-rota.json',
  '/data/cambridge-stallholders.json',
  '/data/chelmsford-stallholders.json',
  '/admin/stallholder-editor.html',
  '/assets/images/unionlogo.png',
  '/assets/images/192.png',
  '/assets/images/512.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache install failed:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});