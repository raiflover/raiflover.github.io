const CACHE_NAME = 'tracker-v2-static-v2';
const APP_SHELL = [
  './',
  'index.html',
  'site.webmanifest',
  'icon.svg',
  'analytics.svg',
  'cat.svg',
  'notebook-nav.svg',
  'heart.svg',
  'flower-new.svg',
  'bastard2.svg',
  'bastard3.svg',
  'star1.svg',
  'star2.svg',
  'star3.svg',
  'background/styles2.css',
  'background/script2.js',
  'trackers/sleep.css',
  'trackers/sleep.js',
  'trackers/caffeine.js',
  'analytics/analytics.css',
  'analytics/analytics.js',
  'analytics/charts.js',
  'analytics/insights.js',
  'analytics/utils.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('index.html'))
      )
  );
});
