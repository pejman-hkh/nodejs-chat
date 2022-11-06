// Files to cache
const cacheName = 'pgchat';
const appShellFiles = [
  '/',
  '/js/nodelist.js',
  '/js/lib.js',
  '/js/index.js',
  '/css/bootstrap.min.css',
  '/css/style.css',
];

const contentToCache = appShellFiles.concat([]);

// Installing Service Worker
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    console.log('[Service Worker] Caching all: app shell and content');
    await cache.addAll(contentToCache);
  })());
});

// Fetching content using Service Worker
self.addEventListener('fetch', (e) => {
  e.respondWith((async () => {
    const r = await caches.match(e.request);
    console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
    if (r) return r;
    const response = await fetch(e.request);
    const cache = await caches.open(cacheName);
    console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
    cache.put(e.request, response.clone());
    return response;
  })());
});

self.addEventListener("push", function(event){
  event.waitUntil(
        self.registration.showNotification("New message")
  );
});

self.addEventListener("notificationclick", function(event){
  event.waitUntil(
        clients.openWindow("https://peji.ir:8000/")
  );
});