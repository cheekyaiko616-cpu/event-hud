// 確認用の共通部品：アプリを配る小さなサーバーと、外部サービス（日程・天気・駅・位置検索）の差し替え。
const fs = require('fs'), path = require('path'), http = require('http');

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

/** APP フォルダを配る。overrides: { '/sw.js': 中身 } で一部だけ差し替えられる。 */
function serve(APP, port, overrides = {}) {
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (overrides[u]) { r.writeHead(200, { 'content-type': TYPES[path.extname(u)] || 'text/plain', 'cache-control': 'no-cache' }); r.end(overrides[u]()); return; }
    let p = path.join(APP, u); if (p.endsWith('/')) p += 'index.html';
    fs.readFile(p, (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' }); r.end(d);
    });
  }).listen(port);
  return srv;
}

const iso = (d) => d.toLocaleDateString('sv-SE');
function weatherBody(days = 16, from = new Date(2026, 9, 28)) {
  const t = [], c = [];
  for (let i = 0; i < days; i++) { const d = new Date(from); d.setDate(d.getDate() + i); t.push(iso(d)); c.push([0, 2, 3, 61][i % 4]); }
  return { daily: { time: t, weather_code: c, temperature_2m_max: c.map((x) => 15 + x), temperature_2m_min: c.map((x) => 5 + x), precipitation_probability_max: c.map((x) => x * 10) } };
}

/**
 * 外部サービスの差し替え。state.feed に日程（文字）、state.feedFails が true なら日程だけ失敗させる。
 * 外へのリンク先（Yahoo! など）は、簡単なページを返す。
 */
function mockExternal(ctx, state) {
  state.calls = {};
  return ctx.route(/^https?:\/\/(?!localhost)/, (rt) => {
    const u = new URL(rt.request().url());
    state.calls[u.host] = (state.calls[u.host] || 0) + 1;
    const json = (o) => rt.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof o === 'string' ? o : JSON.stringify(o) });
    if (u.pathname.endsWith('feed.json')) return state.feedFails ? rt.abort() : json(state.feed);
    if (u.host === 'api.open-meteo.com') return json(weatherBody());
    if (u.host === 'nominatim.openstreetmap.org') return json(state.geocode || []);
    if (['transit.yahoo.co.jp', 'maps.apple.com', 'apps.apple.com'].includes(u.host)) return rt.fulfill({ contentType: 'text/html', body: `<title>外のページ</title><p>${u.host}</p>` });
    return rt.fulfill({ status: 204, body: '' });
  });
}

/** 外へのリンク（data-link）を押したとき、開く先のURLを window.__opened に記録して、実際には開かない。 */
const RECORD_LINKS = () => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push('WINDOW.OPEN:' + u); return null; };
  window.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[data-link]');
    if (!a) return;
    if (!ev.defaultPrevented) window.__opened.push(a.href);
    ev.preventDefault();
  });
};

const dist = (a, b) => { const r = Math.PI / 180; return 6371 * Math.hypot((b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), (b.lat - a.lat) * r); };
const clean = (n) => n.replace(/[（(〈<][^）)〉>]*[）)〉>]/g, '').replace(/[\s　]+/g, '').replace(/駅$/, '');

/** 会場の一覧（venues.js から）。station があるものが国内。 */
function readVenues(APP) {
  const src = fs.readFileSync(path.join(APP, 'js/data/venues.js'), 'utf8');
  return [...src.matchAll(/match: '([^']+)', lat: ([\d.-]+), lon: ([\d.-]+), name: '([^']+)'(?:, station: '([^']+)', stationKm: ([\d.]+))?/g)]
    .map((m) => ({ match: m[1], lat: +m[2], lon: +m[3], name: m[4], station: m[5] || '' }));
}

/** 試験用の日程：全会場に1件ずつ ＋ 一覧に無い会場 ＋ オンライン ＋ 日程未定 ＋ 過去 ＋ 開催中。 */
function buildFeed(APP, today = '2026-10-28') {
  const V = readVenues(APP);
  const items = V.map((v, i) => ({ id: `t${i}`, tabName: i % 3 === 0 ? 'テストA' : i % 3 === 1 ? 'テストB' : 'テストC', title: `${v.name} テスト大会`, date: '2026-11-14', end: i % 2 ? '2026-11-15' : '', place: v.match === v.name ? v.name : `${v.name}（${v.match}）`, source: 'テスト', url: 'https://example.com/', note: 'メモ', dates: i % 4 === 0 ? [{ kind: 'close', date: '2026-10-30', note: '23:59まで' }, { kind: 'pay', date: '2026-11-05' }] : [] }));
  items.push({ id: 'unknown', tabName: 'テストA', title: '未登録会場のイベント', date: '2026-11-03', end: '', place: '幕張メッセ', source: '', url: '', note: '', dates: [] });
  items.push({ id: 'unknown2', tabName: 'テストA', title: '場所が探せない会場のイベント', date: '2026-11-04', end: '', place: '架空の会場ABC', source: '', url: '', note: '', dates: [] });
  items.push({ id: 'online', tabName: 'テストB', title: '配信ライブ', date: '2026-11-03', end: '', place: 'オンライン配信', source: '', url: '', note: '', dates: [{ kind: 'close', date: '2026-10-29', note: '' }] });
  items.push({ id: 'tbd', tabName: 'テストC', title: '日程未定のイベント', date: '', end: '', place: '', source: '', url: '', note: '', dates: [] });
  items.push({ id: 'past1', tabName: 'テストA', title: '終わったイベント', date: '2026-09-01', end: '', place: '東京', source: '', url: '', note: '', dates: [] });
  items.push({ id: 'live1', tabName: 'テストB', title: '開催中のイベント', date: '2026-10-27', end: '2026-10-29', place: '富士スピードウェイ', source: '', url: '', note: '', dates: [] });
  items.push({ id: 'near1', tabName: 'テストA', title: '近日のイベント', date: '2026-11-02', end: '', place: 'モビリティリゾートもてぎ', source: '', url: '', note: '', dates: [] });
  items.push({ id: 'next-year', tabName: 'テストA', title: '来年のイベント', date: '2027-02-10', end: '', place: '', source: '', url: '', note: '', dates: [] });
  return { app: 'event-cho-feed', version: 1, items };
}

module.exports = { serve, mockExternal, RECORD_LINKS, dist, clean, readVenues, buildFeed, weatherBody, iso };
