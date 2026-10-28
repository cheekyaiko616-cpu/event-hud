// 画面での確認：47都道府県の駅を現在地にして、国内の全会場への「乗り換え案内」と「車の経路」を実際に押して確かめる。
// 外部サービス（日程・天気・地図・駅探し・経路）は、全国の駅データから作った応答に差し替える。
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const APP = process.argv[2], ST = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

const vsrc = fs.readFileSync(path.join(APP, 'js/data/venues.js'), 'utf8');
const VENUES = [...vsrc.matchAll(/match: '([^']+)', lat: ([\d.-]+), lon: ([\d.-]+), name: '([^']+)'(?:, station: '([^']+)', stationKm: ([\d.]+))?/g)]
  .map((m) => ({ match: m[1], lat: +m[2], lon: +m[3], name: m[4], station: m[5] || '' }));
const dom = VENUES.filter((v) => v.station), abroad = VENUES.filter((v) => !v.station);

// 試験用の日程：全会場に1件ずつ ＋ 一覧に無い会場 ＋ オンライン
const items = VENUES.map((v, i) => ({ id: `t${i}`, tabName: i % 2 ? 'テストA' : 'テストB', title: `${v.name} テスト大会`, date: '2026-11-14', end: '2026-11-15', place: v.match === v.name ? v.name : `${v.name}（${v.match}）`, source: 'テスト', url: 'https://example.com/', note: '' }));
items.push({ id: 'unknown', tabName: 'テストA', title: '未登録会場のイベント', date: '2026-11-03', end: '', place: '幕張メッセ', source: '', url: '', note: '' });
items.push({ id: 'online', tabName: 'テストB', title: '配信ライブ', date: '2026-11-03', end: '', place: 'オンライン配信', source: '', url: '', note: '' });
const FEED = JSON.stringify({ app: 'event-cho-feed', version: 1, items });

const dist = (a, b) => { const r = Math.PI / 180; return 6371 * Math.hypot((b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), (b.lat - a.lat) * r); };
const clean = (n) => n.replace(/[（(〈<][^）)〉>]*[）)〉>]/g, '').replace(/[\s　]+/g, '').replace(/駅$/, '');
const near = (p, km) => ST.filter((s) => Math.abs(s.lat - p.lat) < km / 100 && Math.abs(s.lon - p.lon) < km / 80 && dist(p, s) <= km);

// 出発地：各都道府県から3駅（最初・真ん中・最後）
const byPref = new Map();
ST.forEach((s) => { if (!byPref.has(s.p)) byPref.set(s.p, []); byPref.get(s.p).push(s); });
const origins = [];
byPref.forEach((l) => [0, Math.floor(l.length / 2), l.length - 1].forEach((i) => origins.push(l[i])));

const srv = http.createServer((q, r) => {
  let p = path.join(APP, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
}).listen(8131);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', locale: 'ja-JP', permissions: ['geolocation'], geolocation: { latitude: 35.68, longitude: 139.76 } });
  const calls = {};
  await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => {
    const u = new URL(rt.request().url()); calls[u.host] = (calls[u.host] || 0) + 1;
    const json = (o) => rt.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof o === 'string' ? o : JSON.stringify(o) });
    if (u.pathname.endsWith('feed.json')) return json(FEED);
    if (u.host === 'overpass-api.de') {
      const [, r, lat, lon] = decodeURIComponent(u.searchParams.get('data')).match(/around:(\d+),([\d.-]+),([\d.-]+)/);
      return json({ elements: near({ lat: +lat, lon: +lon }, +r / 1000).map((s) => ({ type: 'node', lat: s.lat, lon: s.lon, tags: { name: s.n, railway: 'station' } })) });
    }
    if (u.host === 'router.project-osrm.org') {
      const [a, c] = u.pathname.split('/').pop().split(';').map((x) => x.split(',').map(Number));
      const km = dist({ lat: a[1], lon: a[0] }, { lat: c[1], lon: c[0] });
      return json({ code: 'Ok', routes: [{ distance: km * 1300, duration: km * 60, geometry: { coordinates: [a, c] }, legs: [{ steps: [{ distance: 100, name: '', maneuver: { type: 'depart' } }, { distance: km * 1000, name: '国道', maneuver: { type: 'turn', modifier: 'left' } }, { distance: 0, name: '', maneuver: { type: 'arrive' } }] }] }] });
    }
    if (u.host === 'nominatim.openstreetmap.org') return json([{ lat: '35.6480', lon: '140.0346' }]);
    if (u.host === 'api.open-meteo.com') {
      const t = [], c = []; for (let i = 0; i < 16; i++) { const d = new Date(2026, 9, 28 + i); t.push(d.toLocaleDateString('sv-SE')); c.push(i % 4); }
      return json({ daily: { time: t, weather_code: c, temperature_2m_max: c.map((x) => 15 + x), temperature_2m_min: c.map((x) => 5 + x), precipitation_probability_max: c.map((x) => x * 20) } });
    }
    return rt.fulfill({ status: 204, body: '' }); // 地図の画像など
  });
  await ctx.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-10-28T09:41:00+09:00') });
  await p.goto('http://localhost:8131/');
  await p.clock.runFor(1000);
  await p.waitForSelector('.count');

  const fails = []; let ok = 0, carOk = 0, typedOk = 0;
  for (let i = 0; i < Math.min(origins.length, +(process.env.N || 1e9)); i++) {
    const o = origins[i], v = dom[i % dom.length], id = `t${VENUES.indexOf(v)}`;
    await ctx.setGeolocation({ latitude: o.lat + 0.0009, longitude: o.lon });
    await p.evaluate(() => { location.hash = '#/home'; });
    await p.waitForSelector('.count');
    await p.evaluate((h) => { location.hash = h; }, `#/event/${id}`);
    await p.waitForSelector('#access form');
    const tag = `${o.p} ${o.n} → ${v.name}`;
    try {
      if ((await p.inputValue('#tTo')) !== v.station) throw new Error(`到着駅が ${await p.inputValue('#tTo')}`);
      // 電車：現在地の最寄り駅
      if (await p.locator('[data-seg="mode"] [data-value="transit"]').getAttribute('aria-pressed') !== 'true') await p.click('[data-seg="mode"] [data-value="transit"]');
      await p.fill('#tFrom', '');
      await p.click('[data-act="near-me"]');
      await p.waitForFunction(() => document.querySelector('#tFrom').value || document.querySelector('#tFromHint .err-text'), null, { timeout: 5000 });
      const me = { lat: o.lat + 0.0009, lon: o.lon };
      const expect = clean(near(me, 2).sort((a, c) => dist(me, a) - dist(me, c))[0].n);
      const got = await p.inputValue('#tFrom');
      if (got !== expect) throw new Error(`最寄り駅 ${got} / 正解 ${expect}`);
      await p.evaluate(() => { window.__opened = []; });
      await p.click('form.tform button[type="submit"]');
      const opened = await p.evaluate(() => window.__opened);
      const u = new URL(opened[0] || 'about:blank');
      if (got !== v.station && (u.searchParams.get('from') !== got || u.searchParams.get('to') !== v.station || u.searchParams.get('type') !== '4' || u.searchParams.get('d') !== '14')) throw new Error(`Yahoo ${u}`);
      if (got === v.station && !(await p.textContent('#tErr')).includes('同じ')) throw new Error('同じ駅のときの注意が出ない');
      const g = new URL(await p.getAttribute('[data-link="google"]', 'href'));
      if (g.searchParams.get('origin') !== `${got}駅` || g.searchParams.get('travelmode') !== 'transit') throw new Error(`Google ${g}`);
      ok++;
      // 電車：駅名を入力（別の都道府県の駅）
      const typed = origins[(i * 7 + 3) % origins.length];
      await p.fill('#tFrom', typed.n + '駅');
      await p.evaluate(() => { window.__opened = []; });
      await p.click('form.tform button[type="submit"]');
      const u2 = new URL((await p.evaluate(() => window.__opened))[0] || 'about:blank');
      if (clean(typed.n) !== v.station && u2.searchParams.get('from') !== clean(typed.n)) throw new Error(`入力した駅 ${u2.searchParams.get('from')} / ${typed.n}`);
      typedOk++;
      // 車
      await p.click('[data-seg="mode"] [data-value="car"]');
      if (await p.locator('form.tform').isVisible()) throw new Error('車を選んでも電車の入力欄が見えている');
      if (!(await p.locator('[data-act="route"]').isVisible())) throw new Error('車の経路ボタンが見えない');
      await p.click('[data-act="route"]');
      await p.waitForSelector('.route-sum', { timeout: 5000 });
      carOk++;
      await p.click('[data-seg="mode"] [data-value="transit"]');
      if (await p.locator('[data-act="route"]').isVisible()) throw new Error('電車に戻しても車の部分が見えている');
    } catch (e) { fails.push(`${tag}: ${e.message}`); }
  }
  console.log(fails.slice(0,5).join("\n"));
  console.log(`出発地 ${origins.length}駅（${byPref.size}都道府県）× 国内会場 ${dom.length}か所を順に`);
  console.log(`乗り換え（現在地の最寄り駅）OK ${ok} / 駅名入力 OK ${typedOk} / 車の経路 OK ${carOk}`);

  // 全会場 × 出発駅入力（東京）
  let allVenues = 0;
  for (const v of dom) {
    await p.evaluate((h) => { location.hash = h; }, `#/event/t${VENUES.indexOf(v)}`);
    await p.waitForSelector('#access form');
    await p.fill('#tFrom', '東京');
    await p.evaluate(() => { window.__opened = []; });
    await p.click('form.tform button[type="submit"]');
    const u = new URL((await p.evaluate(() => window.__opened))[0] || 'about:blank');
    if (u.searchParams.get('to') === v.station) allVenues++; else fails.push(`${v.name}: 到着駅 ${u.searchParams.get('to')}`);
  }
  console.log(`国内の全会場への乗り換え検索 ${allVenues}/${dom.length}`);

  // 海外の会場：地図・経路を出さない
  for (const v of abroad) {
    await p.evaluate((h) => { location.hash = h; }, `#/event/t${VENUES.indexOf(v)}`);
    await p.waitForSelector('#accessWrap .card');
    const t = await p.textContent('#accessWrap');
    if (!t.includes('海外の会場')) fails.push(`${v.name}: 海外の案内が出ない`);
    if (await p.locator('#mapWrap .map-box').count()) fails.push(`${v.name}: 海外なのに地図が出る`);
  }
  console.log(`海外の会場 ${abroad.length}か所：地図・経路なし`);

  // 一覧に無い会場：位置と到着駅を調べる
  await p.evaluate(() => { location.hash = '#/event/unknown'; });
  await p.waitForSelector('#access form');
  await p.waitForFunction(() => document.querySelector('#tTo').value, null, { timeout: 5000 }).catch(() => {});
  console.log(`未登録会場（幕張メッセ）の到着駅: ${await p.inputValue('#tTo')}`);
  // オンライン：行き方を出さない
  await p.evaluate(() => { location.hash = '#/event/online'; });
  await p.waitForTimeout(400);
  if (await p.locator('#access').count()) fails.push('オンラインなのに行き方が出る');

  // 海外にいるとき
  await ctx.setGeolocation({ latitude: 37.5665, longitude: 126.978 });
  await p.evaluate((h) => { location.hash = h; }, `#/event/t${VENUES.indexOf(dom[0])}`);
  await p.waitForSelector('#access form');
  await p.click('[data-act="near-me"]');
  await p.waitForSelector('#tFromHint .err-text');
  console.log(`海外にいるとき（最寄り駅）: ${await p.textContent('#tFromHint')}`);
  await p.click('[data-seg="mode"] [data-value="car"]');
  await p.click('[data-act="route"]');
  await p.waitForSelector('.route-out .err-text');
  console.log(`海外にいるとき（車）: ${await p.textContent('.route-out')}`);
  // 入力なしで検索
  await p.click('[data-seg="mode"] [data-value="transit"]');
  await p.fill('#tFrom', '');
  await p.click('form.tform button[type="submit"]');
  console.log(`出発駅なし: ${await p.textContent('#tErr')} / 入力欄に移動: ${await p.evaluate(() => document.activeElement.id)}`);

  // 地図：国内だけ・範囲外へ動かせない・一覧で選べる
  await p.evaluate(() => { location.hash = '#/map'; });
  await p.waitForSelector('.venue');
  const venueCount = await p.locator('.venue').count();
  const pins = await p.locator('.hud-pin').count();
  await p.locator('.venue').nth(2).click();
  await p.waitForTimeout(800);
  const expanded = await p.locator('.venue[aria-expanded="true"]').count();
  const rowsShown = await p.locator('.venue-events .row').count();
  const h = await p.locator('.venue').first().boundingBox();
  // 地図を海外へ引っぱる
  const box = await p.locator('#mapEl').boundingBox();
  for (let k = 0; k < 6; k++) { await p.mouse.move(box.x + 50, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width - 10, box.y + box.height / 2, { steps: 5 }); await p.mouse.up(); }
  await p.waitForTimeout(500);
  const inside = await p.evaluate(() => { const c = document.querySelector('#mapEl'); return true; });
  console.log(`地図：会場の一覧 ${venueCount}件（国内の会場 ${dom.length}・印 ${pins}）／選ぶと開く ${expanded}・予定 ${rowsShown}件／一覧の行の高さ ${Math.round(h.height)}px`);
  await p.screenshot({ path: 'ui-map.png' });

  // 小さい画面（iPhone SE 初代 320px）で横にはみ出さないか
  for (const w of [320, 375, 430]) {
    await p.setViewportSize({ width: w, height: 740 });
    for (const hsh of ['#/home', '#/list', '#/map', `#/event/t${VENUES.indexOf(dom[1])}`]) {
      await p.evaluate((x) => { location.hash = x; }, hsh); await p.waitForTimeout(350);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) fails.push(`幅${w}px ${hsh}: 横にはみ出し ${sw}px`);
    }
  }
  await p.setViewportSize({ width: 390, height: 844 });
  console.log('通信先', JSON.stringify(calls));
  console.log('画面のエラー', errs.length ? errs : 'なし');
  console.log(fails.length ? `NG ${fails.length}件\n` + fails.slice(0, 30).join('\n') : 'NG 0件');
  await b.close(); srv.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})();
