// 最小 Service Worker。APP_VERSION でキャッシュ名を切り、古いSW事故を防ぐ。
// index.html は常にネットワーク優先（no-cache 相当）にして、古いUIを配り続けない。
const APP_VERSION = 'v1.1.0';
const CACHE = `shikodojo-${APP_VERSION}`;
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // API は絶対にキャッシュしない
  if (url.pathname.startsWith('/api/')) return;
  // HTML/ナビゲーションはネットワーク優先（新しいUIを優先）
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  // それ以外はキャッシュ優先＋裏で更新
  e.respondWith(
    caches.match(request).then((cached) => {
      const net = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && url.origin === location.origin) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
