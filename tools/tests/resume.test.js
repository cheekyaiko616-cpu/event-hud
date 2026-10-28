// 「外のアプリ・サイトを開いて、戻ってくる」流れの確認。
// ・日時の指定が Yahoo!乗換案内のURLに入るか（iPhone のように change だけが来る場合も）
// ・外へのリンクを押してもアプリの画面が消えないか、戻ったときに中身があるか
// ・iPhone がアプリの中身を捨てて読み込み直したとき（通信あり・圏外）に画面が出るか
// ・新しい版に切り替わったとき、新旧が混ざらず画面が出るか
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const APP = process.argv[2];
let swOverride = null; // sw.js の中身を差し替えて「新しい版」を作る
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let p = path.join(APP, u); if (p.endsWith('/')) p += 'index.html';
  if (u.endsWith('/sw.js') && swOverride) { r.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' }); r.end(swOverride); return; }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' }); r.end(d); });
}).listen(8140);
const BASE = 'http://localhost:8140/';
const results = []; const fails = [];
const check = (name, ok, extra = '') => { console.log((ok?'OK ':'NG ')+name+' '+extra); results.push(`${ok ? 'OK' : 'NG'} ${name}${extra ? '：' + extra : ''}`); if (!ok) fails.push(name); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', locale: 'ja-JP', serviceWorkers: 'allow', permissions: ['geolocation'], geolocation: { latitude: 35.6905, longitude: 139.7005 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => {
    const u = new URL(rt.request().url());
    if (u.pathname.endsWith('feed.json')) return rt.fulfill({ contentType: 'application/json', body: fs.readFileSync(path.join(APP, 'sample/feed.json')) });
    if (u.host === 'overpass-api.de') return rt.fulfill({ contentType: 'application/json', body: JSON.stringify({ elements: [{ lat: 35.6896, lon: 139.7006, tags: { name: '新宿', railway: 'station' } }] }) });
    if (u.host === 'router.project-osrm.org') return rt.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 'Ok', routes: [{ distance: 150000, duration: 8000, geometry: { coordinates: [[139.7, 35.69], [140.22, 36.53]] }, legs: [{ steps: [{ distance: 1, name: '', maneuver: { type: 'depart' } }, { distance: 0, name: '', maneuver: { type: 'arrive' } }] }] }] }) });
    if (u.host === 'transit.yahoo.co.jp' || u.host === 'www.google.com' || u.host === 'maps.apple.com' || u.host === 'apps.apple.com') return rt.fulfill({ contentType: 'text/html', body: `<title>外のページ</title><p>${u.host}</p>` });
    return rt.fulfill({ status: 204, body: '' });
  });
  let p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('crash', () => console.log('EVENT crash')); p.on('close', () => console.log('EVENT close'));
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) console.log('EVENT nav', f.url()); });
  ctx.on('serviceworker', (w) => console.log('EVENT sw', w.url()));
  await p.goto(BASE + '#/event/supergt-2026-r8');
  await p.waitForSelector('#access form');
  // 1回目は sw.js が入るのを待つ
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  check('オフライン用の仕組みが入る', true);

  console.log('--- 日時の指定');
  await p.fill('#tFrom', '新宿');
  const setVal = (sel, v) => p.evaluate(([s, x]) => { const el = document.querySelector(s); el.value = x; el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]); // iPhone の日付・時刻は change だけ
  await setVal('#tDate', '2026-11-07'); await setVal('#tTime', '07:35');
  let href = new URL(await p.getAttribute('[data-link="yahoo"]', 'href'));
  const q = Object.fromEntries(href.searchParams);
  check('日付・時刻を変えるとリンクに入る（change だけでも）', q.y === '2026' && q.m === '11' && q.d === '07' && q.hh === '7' && q.m1 === '3' && q.m2 === '5' && q.type === '4', `${q.y}/${q.m}/${q.d} ${q.hh}:${q.m1}${q.m2} type=${q.type}`);
  check('画面にも検索する日時が出る', (await p.textContent('#tSum')).includes('11月7日(土) 7:35 到着'), await p.textContent('#tSum'));
  await p.click('[data-seg="when"] [data-value="depart"]');
  href = new URL(await p.getAttribute('[data-link="yahoo"]', 'href'));
  check('「出発」に切り替えるとリンクも出発になる', href.searchParams.get('type') === '1' && (await p.textContent('#tSum')).includes('出発'));
  await p.evaluate(() => { const el = document.querySelector('#tTime'); el.value = '23:05'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  href = new URL(await p.getAttribute('[data-link="yahoo"]', 'href'));
  check('入力途中（input）でもリンクに入る', href.searchParams.get('hh') === '23' && href.searchParams.get('m1') === '0' && href.searchParams.get('m2') === '5');

  console.log('--- 外のサイトを開いて戻る');
  let yahooOpened = '';
  for (const [name, sel] of [['Yahoo!乗換案内', '[data-link="yahoo"]'], ['Googleマップ', '[data-link="google"]'], ['Appleマップ', '[data-link="apple"]']]) {
    const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }), p.click(sel)]);
    await pop.waitForLoadState();
    const popUrl = pop.url();
    if (sel.includes('yahoo')) yahooOpened = popUrl;
    await pop.close();
    await p.bringToFront();
    const still = await p.locator('#access form').isVisible();
    check(`${name}：別の画面で開き、アプリの画面はそのまま`, still && p.url().startsWith(BASE), popUrl.slice(0, 70));
  }
  const yq = new URL(yahooOpened).searchParams;
  check('実際に開いたYahoo!乗換案内のURLに日時が入っている', yq.get('from') === '新宿' && yq.get('d') === '07' && yq.get('hh') === '23' && yq.get('m1') === '0' && yq.get('m2') === '5' && yq.get('type') === '1', `${yq.get('m')}/${yq.get('d')} ${yq.get('hh')}:${yq.get('m1')}${yq.get('m2')} type=${yq.get('type')}`);

  console.log('--- Yahoo!カーナビ');
  await p.click('[data-seg="mode"] [data-value="car"]');
  const nav = await p.getAttribute('[data-link="carnavi"]', 'href');
  check('Yahoo!カーナビの呼び出し（公式の形）', /^yjcarnavi:\/\/navi\/select\?point=current&point=36\.5326000,140\.2276000,/.test(nav), nav);
  await p.click('[data-link="carnavi"]').catch(() => {});
  await p.waitForTimeout(500);
  check('カーナビを押してもアプリの画面が消えない', p.url().startsWith(BASE) && await p.locator('[data-link="carnavi"]').isVisible());
  await p.click('[data-act="route"]');
  await p.waitForSelector('.route-sum');
  check('この画面で車の経路も見られる', true);

  console.log('--- 他のアプリへ移って戻る（画面が隠れる → 見える）');
  const setVis = (v) => p.evaluate((x) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => x }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => x === 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }, v);
  const tilesBefore = await p.locator('.leaflet-tile-pane .leaflet-layer').count();
  await setVis('hidden');
  const tilesHidden = await p.locator('.leaflet-tile-pane .leaflet-layer').count();
  await setVis('visible');
  await p.waitForTimeout(300);
  const tilesAfter = await p.locator('.leaflet-tile-pane .leaflet-layer').count();
  check('裏にいる間は地図の画像を手放し、戻ると元に戻る', tilesBefore === 1 && tilesHidden === 0 && tilesAfter === 1, `${tilesBefore}→${tilesHidden}→${tilesAfter}`);
  check('戻ったときに画面の中身がある', await p.locator('#access').isVisible());

  console.log('--- 画面が空になっていた場合（中身を捨てられた）');
  await p.evaluate(() => { document.querySelector('#view').innerHTML = ''; window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await p.waitForSelector('#view h1', { timeout: 5000 }).catch(() => {});
  check('空になった画面は、戻ったときに描き直す', await p.locator('#view h1').count() > 0);

  console.log('--- iPhone がアプリを読み込み直したとき（すべての画面で）');
  for (const h of ['#/home', '#/list', '#/deadlines', '#/map', '#/event/supergt-2026-r8']) {
    await p.goto(BASE + h);
    await p.waitForSelector('#view h1, #view .count', { timeout: 8000 }).catch(() => {});
    check(`読み込み直し（通信あり）${h}`, await p.locator('#view h1, #view .count').count() > 0);
  }
  await ctx.setOffline(true);
  for (const h of ['#/home', '#/list', '#/map', '#/event/supergt-2026-r8']) {
    await p.goto(BASE + h).catch(() => {});
    await p.waitForSelector('#view h1, #view .count', { timeout: 8000 }).catch(() => {});
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(`読み込み直し（圏外）${h}`, await p.locator('#view h1, #view .count').count() > 0 && bg === 'rgb(5, 7, 13)', `背景 ${bg}`);
  }
  await ctx.setOffline(false);

  console.log('--- 新しい版に切り替わったとき');
  await p.goto(BASE + '#/event/supergt-2026-r8');
  await p.waitForSelector('#access');
  swOverride = fs.readFileSync(path.join(APP, 'sw.js'), 'utf8').replace(/const CACHE = '([^']+)'/, "const CACHE = '$1-next'");
  const nav0 = await p.evaluate(() => performance.getEntriesByType('navigation')[0].startTime + performance.timeOrigin);
  p.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update())).catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));
  console.log('pages', ctx.pages().map((x) => x.url() + (x.isClosed() ? ' closed' : '')));
  if (p.isClosed()) { p = ctx.pages().find((x) => !x.isClosed()); }
  await p.waitForFunction((t) => performance.timeOrigin > t, nav0, { timeout: 15000 }).catch(() => {});
  await p.waitForSelector('#access', { timeout: 8000 }).catch(() => {});
  const reloaded = await p.evaluate((t) => performance.timeOrigin > t, nav0);
  const keys = await p.evaluate(() => caches.keys());
  check('新しい版に切り替わると読み込み直し、画面が出る', reloaded && await p.locator('#access').count() > 0 && keys.length === 1 && keys[0].endsWith('-next'), keys.join(','));

  console.log('--- カレンダー・公式リンク・ダイアログ');
  await p.click('[data-act="cal"]');
  await p.waitForTimeout(300);
  check('カレンダー追加を押しても画面が消えない', p.url().startsWith(BASE) && await p.locator('#access').count() > 0);
  const off = await p.getAttribute('a.btn[href^="http"]:not([data-link])', 'target');
  check('公式の情報は別の画面で開く', off === '_blank');
  for (const [btn, dlg] of [['#helpBtn', 'dialog.help'], ['#dataBtn', 'dialog.sheet:not(.help)']]) {
    await p.click(btn); const open = await p.locator(dlg).evaluate((d) => d.open);
    await p.keyboard.press('Escape'); const closed = await p.locator(dlg).evaluate((d) => !d.open);
    check(`${btn === '#helpBtn' ? '使い方' : 'データ'}の画面が開いて閉じる`, open && closed);
  }
  // 4つのボタンで移動
  for (const t of ['home', 'list', 'deadlines', 'map']) {
    await p.click(`#nav a[data-tab="${t}"]`); await p.waitForTimeout(400);
    check(`下のボタン：${t}`, await p.locator('#view h1').count() > 0 && (await p.getAttribute(`#nav a[data-tab="${t}"]`, 'aria-current')) === 'page');
  }
  check('画面のエラーなし', errs.length === 0, errs.join(' / '));
  console.log(results.join('\n'));
  console.log(fails.length ? `NG ${fails.length}件` : 'NG 0件');
  await b.close(); srv.close();
  process.exit(fails.length ? 1 : 0);
})();
