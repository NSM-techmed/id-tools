// Service worker - Tool consulenze infettivologiche
// Strategia: cache-first per i file statici, con auto-aggiornamento al cambio di CACHE_VERSION
// Per rilasciare una nuova versione: incrementare CACHE_VERSION e fare push

const CACHE_VERSION = 'v1.9';
const CACHE_NAME = 'id-tools-' + CACHE_VERSION;

const ASSETS_TO_CACHE = [
  './',
  './Tool_Consulenze.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

// URL dei font esterni che vogliamo cachare opportunisticamente al primo caricamento online
const RUNTIME_CACHE_PATTERNS = [
  /^https:\/\/fonts\.googleapis\.com/,
  /^https:\/\/fonts\.gstatic\.com/
];

// Installazione: precachica tutti gli asset statici
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Attivazione: pulisce vecchie cache di versioni precedenti
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('id-tools-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first per asset locali, stale-while-revalidate per font esterni
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isFontAsset = RUNTIME_CACHE_PATTERNS.some((p) => p.test(url));

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Per i font: aggiorna in background (stale-while-revalidate)
        if (isFontAsset) {
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
            }
          }).catch(() => {});
        }
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        // Cache asset locali (basic) e font esterni (cors)
        const shouldCache = response.type === 'basic' || (isFontAsset && (response.type === 'cors' || response.type === 'opaque'));
        if (shouldCache) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      }).catch(() => {
        // Offline e risorsa non in cache: fallback all'HTML principale per le navigazioni
        if (event.request.mode === 'navigate') {
          return caches.match('./Tool_Consulenze.html');
        }
      });
    })
  );
});
