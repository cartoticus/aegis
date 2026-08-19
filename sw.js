/* AEGIS service worker — network-first app shell so the newest version
   always loads when online; cached copies are used only offline. */
const CACHE = 'aegis-v1.6.0';

/* Must-have shell — and ONLY what is genuinely must-have. If either of these
   fails the install SHOULD fail, because an app that cannot boot offline is not
   installed and pretending otherwise hides the breakage until the user is on a
   train. Everything else, including the web manifest, is optional: a missing
   manifest costs installability, not offline capability, and trading away
   offline to punish a missing icon file is the wrong bargain. */
const SHELL = [
  './',
  './index.html'
];

/* Nice-to-have. Cached individually so one 404 cannot abort the whole install.
   cache.addAll() is atomic: a single missing icon would otherwise leave the user
   with NO service worker at all, which is a far worse failure than a missing icon.
   ARC content lives here too — Domain 1 must work offline, but a learner who
   never turns on ARC mode should not lose the app because a module is missing. */
const OPTIONAL = [
  './manifest.webmanifest',
  './outline-versions.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './arc-core.mjs',
  './modules/index.json'
];

/* Read the manifest at install time and precache whatever it lists, so the
   corpus is available offline even if the learner never opened ARC mode online.
   Failure here is non-fatal: the app degrades to classic mode, which is exactly
   what the beta toggle already does when the corpus will not load. */
async function precacheCorpus(cache) {
  try {
    const res = await fetch('./modules/index.json', { cache: 'no-store' });
    if (!res.ok) return 0;
    await cache.put('./modules/index.json', res.clone());
    const man = await res.json();
    const files = (man.modules || []).map((m) => (typeof m === 'string' ? m : m.file));
    const results = await Promise.allSettled(files.map((f) => cache.add('./modules/' + f)));
    return results.filter((r) => r.status === 'fulfilled').length;
  } catch (e) {
    return 0;
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);                                    // fatal if it fails
    await Promise.allSettled(OPTIONAL.map((a) => c.add(a)));  // never fatal
    await precacheCorpus(c);                                  // never fatal
    await self.skipWaiting();
  })());
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

  // Cache-first for static assets (icons, manifest) AND for ARC content —
  // arc-core.mjs and modules/*.json. Content is safe to serve from cache because
  // the cache name carries the app version, so a release evicts the whole corpus
  // and refetches it. This is also what makes Domain 1 work offline.
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
        // Offline with nothing cached. Return a real Response rather than
        // undefined: respondWith(undefined) surfaces as an opaque TypeError at
        // the call site, which is indistinguishable from a bug in the caller.
        .catch(() => cached || new Response(
          JSON.stringify({ error: 'offline', url: url.pathname }),
          { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'application/json' } }
        ))
    )
  );
});
