const CACHE = 'claro-v40';
const FILES = ['./', './index.html', './legal.html', './styles.css', './overrides.css', './guidance.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png'];
// Descarga siempre la versión más nueva del servidor (sin usar la caché del navegador) y se activa de inmediato.
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, {cache: 'reload'})))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('claro-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
// Primero la red (para ver siempre lo último); si no hay internet, se usa la copia guardada.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request, {cache: 'no-cache'}).then(response => {
    if (response && response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request, {ignoreSearch: request.mode === 'navigate'}).then(found => found || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(client => 'focus' in client);
    return open ? open.focus() : self.clients.openWindow('./#recordatorios');
  }));
});
