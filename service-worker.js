const CACHE = 'claro-v44';
const FILES = ['./', './index.html', './legal.html', './styles.css', './overrides.css', './guidance.css', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png'];
// Al instalar una versión, descarga todos sus archivos del servidor (sin usar la caché del navegador) y se activa de inmediato.
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new Request(file, {cache: 'reload'})))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('claro-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', event => { if (event.data === 'SKIP_WAITING') self.skipWaiting(); });
// La app abre al instante con la copia guardada de esta versión (aunque la señal sea débil o no haya internet).
// Las versiones nuevas llegan completas: al publicar, este archivo cambia, el teléfono descarga todos los archivos nuevos
// a la vez, y la app se recarga sola con ellos. Así nunca se mezclan archivos viejos y nuevos.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE)
    .then(cache => cache.match(request, {ignoreSearch: true}).then(found => found || (request.mode === 'navigate' ? cache.match('./index.html') : undefined)))
    .then(found => found || fetch(request).catch(() => Response.error())));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(client => 'focus' in client);
    return open ? open.focus() : self.clients.openWindow('./#recordatorios');
  }));
});
