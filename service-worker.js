// Claro guarda una copia completa de la app en el teléfono y abre siempre desde ella (con o sin señal).
// Las versiones nuevas NO se descargan solas: la app revisa version.json (un archivo de ~2 KB), te dice cuánto pesa
// la actualización y solo la descarga si tocas «Descargar». Solo baja los archivos que cambiaron.
const META = 'claro-meta';
const ACTIVE_KEY = './__claro-active.json';
let activeCache = null;

async function readActive() {
  const found = await (await caches.open(META)).match(ACTIVE_KEY);
  return found ? found.json() : null;
}
async function writeActive(info) {
  await (await caches.open(META)).put(ACTIVE_KEY, new Response(JSON.stringify(info), {headers: {'Content-Type': 'application/json'}}));
  activeCache = info.cache;
}
async function currentCacheName() {
  if (activeCache) return activeCache;
  const info = await readActive();
  activeCache = info ? info.cache : null;
  return activeCache;
}
async function sha256(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function fetchManifest() {
  const response = await fetch('./version.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('version.json ' + response.status);
  return response.json();
}
// Arma la versión nueva en una caché aparte. Copia lo que no cambió y descarga solo lo que cambió.
// Si algo falla o llega incompleto, no se toca la versión que ya usas.
async function installVersion(manifest) {
  const old = await readActive();
  const oldFiles = (old && old.files) || {};
  const oldCache = old ? await caches.open(old.cache) : null;
  const name = 'claro-' + manifest.id;
  await caches.delete(name);
  const cache = await caches.open(name);
  try { await fillVersion(manifest, cache, oldFiles, oldCache); }
  catch (error) { await caches.delete(name); throw error; }
  await writeActive({id: manifest.id, label: manifest.label, cache: name, files: manifest.files});
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('claro-') && key !== name && key !== META).map(key => caches.delete(key)));
}
async function fillVersion(manifest, cache, oldFiles, oldCache) {
  for (const [file, meta] of Object.entries(manifest.files)) {
    let response = null;
    if (oldCache && oldFiles[file] && oldFiles[file].hash === meta.hash) response = await oldCache.match(file);
    if (!response) {
      const fresh = await fetch(new Request(file, {cache: 'reload'}));
      if (!fresh.ok) throw new Error(file + ' ' + fresh.status);
      const body = await fresh.clone().arrayBuffer();
      if (await sha256(body) !== meta.hash) throw new Error(file + ' todavía no está publicado');
      response = fresh;
    }
    await cache.put(file, response);
  }
}

self.addEventListener('install', event => event.waitUntil((async () => {
  const active = await readActive();
  // Primera vez (o cambio desde el sistema anterior): hace falta una copia completa para poder abrir sin internet.
  // Si falla, el navegador lo reintenta la próxima vez y mientras tanto sigue la versión anterior.
  if (!active) await installVersion(await fetchManifest());
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', event => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  const reply = message => port && port.postMessage(message);
  if (data.type === 'DOWNLOAD_UPDATE') {
    event.waitUntil(fetchManifest().then(installVersion)
      .then(() => { reply({ok: true}); return self.clients.matchAll({type: 'window'}); })
      .then(list => list && list.forEach(client => client.postMessage({type: 'UPDATED'})))
      .catch(error => reply({ok: false, error: String(error && error.message || error)})));
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/version.json')) return;
  event.respondWith((async () => {
    const name = await currentCacheName();
    if (name) {
      const cache = await caches.open(name);
      const found = await cache.match(request, {ignoreSearch: true}) || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      if (found) return found;
    }
    return fetch(request).catch(() => Response.error());
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(client => 'focus' in client);
    return open ? open.focus() : self.clients.openWindow('./#recordatorios');
  }));
});
