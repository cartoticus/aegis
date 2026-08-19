/* AEGIS service worker — network-first app shell so the newest version
   always loads when online; cached copies are used only offline. */
const CACHE = 'aegis-v1.5.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './outline-versions.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const isHTML =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html');
  const isManifestJSON = url.pathname.endsWith('outline-versions.json');

  // Network-first for the app HTML and the version manifest → always fresh online.
  if (isHTML || isManifestJSON) {
    const fallback = isHTML ? './index.html' : './outline-versions.json';
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(fallback, copy));
          return resp;
        })
        .catch(() => caches.match(fallback))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest).
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok && url.origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => cached)
    )
  );
});
