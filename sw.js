// オフライン用。アプリ本体は「版ごとにまとめて」保存し、その版の中身だけを出す（新旧のファイルが混ざらない）。
// 新しい版は、sw.js が変わったときにまとめて入れ替わる。切り替わったら、画面側（js/main.js）が読み込み直す。
// 地図の画像・天気・日程はここでは保存しない（容量を使いすぎないため。日程はアプリ側で覚えている）。
// ファイルを足したり消したりしたら、ASSETS を直して CACHE の番号を1つ上げる。
const CACHE = 'event-hud-v4';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'data/stations.json',
  'css/base.css',
  'css/home.css',
  'css/list.css',
  'css/sheet.css',
  'css/tokens.css',
  'js/config.js',
  'js/data/backup.js',
  'js/data/events.js',
  'js/data/feed.js',
  'js/data/normalize.js',
  'js/data/venues.js',
  'js/main.js',
  'js/services/calendar.js',
  'js/services/geo.js',
  'js/services/ics.js',
  'js/services/location.js',
  'js/services/stations.js',
  'js/services/transit-links.js',
  'js/services/weather.js',
  'js/state.js',
  'js/ui/components/event-row.js',
  'js/ui/components/segmented.js',
  'js/ui/components/status.js',
  'js/ui/components/strips.js',
  'js/ui/components/tabs-bar.js',
  'js/ui/components/toast.js',
  'js/ui/components/weather.js',
  'js/ui/data-sheet.js',
  'js/ui/event-sheet.js',
  'js/ui/router.js',
  'js/ui/views/feed-state.js',
  'js/ui/views/home.js',
  'js/ui/views/list.js',
  'js/ui/weather-fill.js',
  'js/util/cache.js',
  'js/util/date.js',
  'js/util/dom.js',
  'js/util/geo-math.js',
  'js/util/net.js'
];

self.addEventListener('install', (e) => {
  // 取りこぼしがあると古い版と混ざるので、全部そろったときだけ入れる（HTTPの保存は使わず必ず取り直す）
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    const old = ks.filter((k) => k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    // 古い版で開いている画面に「読み込み直して」と知らせる（新旧のプログラムが混ざると画面が出なくなるため）
    if (old.length) {
      const wins = await self.clients.matchAll({ type: 'window' });
      wins.forEach((w) => w.postMessage({ type: 'reload' }));
    }
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // 外の通信（日程・天気・地図など）には関わらない
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // 画面そのもの（どのURLで開いても同じ index.html）
    if (req.mode === 'navigate') return (await c.match('index.html')) || fetch(req);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch { return new Response('', { status: 504, statusText: 'offline' }); }
  })());
});
