/* Välimuistiin tallennetaan vain julkiset sovellustiedostot, ei työaika- eikä kirjautumistietoja. */
const CACHE = 'tyomaatunnit-shell-v02a-5';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith('tyomaatunnit-') && k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Pilottiversiossa app shell -pyyntöihin käytetään verkkoa ensisijaisesti.
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok && (e.request.destination === 'script' || e.request.destination === 'style' || url.pathname.endsWith('/') || url.pathname.endsWith('.html'))) {
      const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request)));
});