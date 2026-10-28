// オフライン用。アプリ本体は保存済みを先に出し、裏で新しい版を取りに行く。
// 地図の画像・天気・日程はここでは保存しない（容量を使いすぎないため。日程はアプリ側で覚えている）。
// ファイルを足したり消したりしたら、ASSETS を直して CACHE の番号を1つ上げる。
const CACHE = 'event-hud-v2';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon.svg',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/views.css',
  'js/main.js', 'js/config.js', 'js/state.js',
  'js/util/date.js', 'js/util/dom.js', 'js/util/cache.js', 'js/util/net.js', 'js/util/geo-math.js',
  'js/data/normalize.js', 'js/data/feed.js', 'js/data/backup.js', 'js/data/events.js', 'js/data/venues.js',
  'js/services/geo.js', 'js/services/weather.js', 'js/services/location.js', 'js/services/route.js',
  'js/services/ics.js', 'js/services/calendar.js', 'js/services/maps-link.js',
  'js/services/stations.js', 'js/services/transit-links.js',
  'js/ui/router.js', 'js/ui/data-sheet.js', 'js/ui/help-sheet.js', 'js/ui/weather-fill.js',
  'js/ui/components/status.js', 'js/ui/components/event-row.js', 'js/ui/components/countdown.js',
  'js/ui/components/deadline-item.js', 'js/ui/components/weather.js', 'js/ui/components/segmented.js',
  'js/ui/components/toast.js', 'js/ui/components/map-box.js', 'js/ui/components/intro-card.js',
  'js/ui/views/home.js', 'js/ui/views/list.js', 'js/ui/views/deadlines.js', 'js/ui/views/map.js',
  'js/ui/views/detail.js', 'js/ui/views/detail-access.js', 'js/ui/views/feed-state.js', 'js/ui/views/util.js',
  'lib/leaflet/leaflet.js', 'lib/leaflet/leaflet.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // 外の通信には関わらない
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
