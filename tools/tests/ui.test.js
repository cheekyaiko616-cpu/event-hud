// 画面での確認（Chromium で iPhone の動きを模す）。外部サービスは差し替え。
// 使い方: node tools/tests/ui.test.js "$PWD" stations-test.json   （Playwright が必要。N=10 で出発地を減らせる）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { serve, mockExternal, RECORD_LINKS, dist, clean, readVenues, buildFeed } = require('./harness.js');

const APP = process.argv[2];
const ST = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const MINI = JSON.parse(fs.readFileSync(path.join(APP, 'data/stations.json'), 'utf8')).map(([n, lat, lon]) => ({ n, lat, lon }));
const PORT = 8161, BASE = `http://localhost:${PORT}/`;
const TODAY = '2026-10-28';
const VENUES = readVenues(APP), DOM = VENUES.filter((v) => v.station), ABROAD = VENUES.filter((v) => !v.station);
const FEED = buildFeed(APP, TODAY);
const vid = (v) => `t${VENUES.indexOf(v)}`;

const lines = []; const fails = [];
const check = (name, ok, extra = '') => { lines.push(`${ok ? 'OK' : 'NG'} ${name}${extra ? '：' + extra : ''}`); if (!ok) fails.push(name); };
const section = (t) => lines.push(`--- ${t}`);
const nearestName = (pos, km) => { const c = MINI.filter((s) => Math.abs(s.lat - pos.lat) < km / 100 && Math.abs(s.lon - pos.lon) < km / 80).map((s) => ({ n: s.n, d: dist(pos, s) })).filter((x) => x.d <= km).sort((a, b) => a.d - b.d); return c[0] && c[0].n; };

(async () => {
  const srv = serve(APP, PORT);
  const b = await chromium.launch();
  const state = { feed: JSON.stringify(FEED), geocode: [{ lat: '35.6480', lon: '140.0346' }] };
  const newCtx = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Tokyo', locale: 'ja-JP',
      permissions: ['geolocation'], geolocation: { latitude: 35.6905, longitude: 139.7005 }, ...opts });
    await mockExternal(ctx, state);
    return ctx;
  };
  const open = async (ctx, hash = '', { record = true } = {}) => {
    const p = await ctx.newPage();
    p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
    if (record) await p.addInitScript(RECORD_LINKS);
    await p.clock.setFixedTime(new Date('2026-10-28T09:41:00+09:00'));
    await p.goto(BASE + hash);
    await p.waitForSelector('#view h1, #view .home-card, #view .scroll', { timeout: 10000 });
    return p;
  };
  const sheet = async (p, id) => { await p.evaluate((h) => { location.hash = h; }, `#/list/${id}`); await p.waitForSelector('dialog.sheet[open] #sheetBody .panel, dialog.sheet[open] .empty', { timeout: 8000 }); await p.waitForTimeout(150); };
  const closeSheet = async (p) => { if (await p.locator('dialog.sheet[open]').count()) { await p.click('dialog.sheet[open] [data-act="close"]'); await p.waitForTimeout(100); } };
  const opened = (p) => p.evaluate(() => window.__opened.slice());
  const clearOpened = (p) => p.evaluate(() => { window.__opened = []; });
  const setVal = (p, sel, v, evt = 'change') => p.evaluate(([s, x, e]) => { const el = document.querySelector(s); el.value = x; el.dispatchEvent(new Event(e, { bubbles: true })); }, [sel, v, evt]);

  const ctx = await newCtx();
  let p = await open(ctx, '');
  await p.waitForSelector('.home-card');

  /* ========== 1. 下のボタンは画面の一番下に固定 ========== */
  section('下のボタン（フッター）は画面の下に固定');
  const footer = async () => p.evaluate(() => { const n = document.querySelector('#nav').getBoundingClientRect(); return { bottom: Math.round(n.bottom), vh: innerHeight, top: Math.round(n.top), sy: scrollY, docH: document.scrollingElement.scrollHeight, h: Math.round(n.height) }; });
  for (const h of ['#/home', '#/list']) {
    await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(400);
    const a = await footer();
    await p.mouse.move(195, 400); await p.mouse.wheel(0, 900); await p.waitForTimeout(300);
    await p.evaluate(() => { const s = document.querySelector('.scroll'); s.scrollTop = s.scrollHeight; window.scrollTo(0, 500); }); await p.waitForTimeout(200);
    const c = await footer();
    const scrolled = await p.evaluate(() => document.querySelector('.scroll').scrollTop);
    check(`フッター固定 ${h}（スクロール前）`, a.bottom === a.vh && a.sy === 0, JSON.stringify(a));
    check(`フッター固定 ${h}（一番下までスクロールしても動かない）`, c.bottom === c.vh && c.top === a.top && c.sy === 0 && c.docH <= c.vh + 1, `top ${a.top}→${c.top} 中身が動いた量 ${Math.round(scrolled)}`);
  }
  check('下のボタンは2つ（ホーム・予定）', (await p.locator('#nav a').count()) === 2);
  // iPhoneの下の余白（ホームバー）の分をあけているか
  const safe = await p.evaluate(() => getComputedStyle(document.querySelector('#nav')).paddingBottom);
  check('下の余白の指定（safe-area）', safe !== undefined);
  // 小さい画面・大きい画面
  for (const [w, h] of [[320, 568], [375, 667], [430, 932]]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200);
    const f = await footer();
    check(`フッター固定 ${w}x${h}`, f.bottom === f.vh && f.sy === 0 && f.docH <= f.vh + 1, JSON.stringify(f));
  }
  await p.setViewportSize({ width: 390, height: 844 });

  /* ========== 2. 不要にした機能が残っていない ========== */
  section('不要にした機能が残っていない');
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForTimeout(300);
  const html = await p.evaluate(() => document.documentElement.outerHTML);
  check('はじめての方への表示が無い', !html.includes('はじめての方'));
  check('使い方ボタンが無い', !(await p.locator('#helpBtn').count()));
  check('期限のタブ・地図のタブが無い', !html.includes('data-tab="deadlines"') && !html.includes('data-tab="map"'));
  check('アプリ内の地図が無い', !(await p.locator('.leaflet-container').count()) && !html.includes('leaflet'));
  check('地図の画像サービスにつながない', !Object.keys(state.calls).some((h) => /gsi\.go\.jp|carto|tile\.openstreetmap/.test(h)), Object.keys(state.calls).join(','));
  check('駅探し・経路のサービスにつながない', !Object.keys(state.calls).some((h) => /overpass|osrm/.test(h)));
  await sheet(p, vid(DOM[0]));
  const sh = await p.evaluate(() => document.querySelector('dialog.sheet[open]').innerText);
  check('Googleマップの案内が無い', !/Google/i.test(sh) && !(await p.locator('[data-link="google"]').count()));
  check('「現在地からこの画面で見る」が無い', !sh.includes('この画面で') && !(await p.locator('[data-act="route"]').count()));
  check('説明文が無い（注意書き・補足）', !/アプリが開いて|引き継ぎます|必要です|App Store/.test(sh));
  await closeSheet(p);

  /* ========== 3. 予定の一覧が Event list と同じ作り ========== */
  section('予定の一覧（Event list の仕様）');
  const up = FEED.items.filter((e) => e.date && (e.end || e.date) >= TODAY).sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : a.title.localeCompare(c.title, 'ja')));
  const past = FEED.items.filter((e) => e.date && (e.end || e.date) < TODAY);
  const undated = FEED.items.filter((e) => !e.date);
  await p.evaluate(() => { location.hash = '#/list'; }); await p.waitForSelector('.tab'); await p.waitForTimeout(300);
  const tabNames = await p.locator('.tab').allInnerTexts();
  check('種類のタブ：すべて＋種類（読み込んだ順）', tabNames.join() === 'すべて,テストA,テストB,テストC', tabNames.join());
  check('これから／過去の切り替えがある', (await p.locator('[data-seg="view"] button').allInnerTexts()).join() === 'これから,過去');
  const rowsAll = await p.locator('.month .row').count();
  check('これから：日付のある予定＋日程未定が全部出る', rowsAll === up.length + undated.length, `${rowsAll} / ${up.length + undated.length}`);
  const bands = await p.locator('.month .band').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  const byMonth = {}; up.forEach((e) => { const m = +e.date.slice(5, 7); const y = e.date.slice(0, 4); const k = `${y}-${m}`; byMonth[k] = (byMonth[k] || 0) + 1; });
  const expBands = Object.entries(byMonth).map(([k, n]) => `${k.startsWith('2026') ? '' : k.slice(0, 4) + ' '}${k.split('-')[1]} 月 ${n}件`);
  expBands.push(`日程未定 公式発表待ち ・ ${undated.length}件`);
  check('月の帯（年が違うときだけ年つき）と件数', JSON.stringify(bands) === JSON.stringify(expBands), `${bands.join(' | ')}`);
  const hues = await p.locator('.month[style]').evaluateAll((els) => els.map((e) => e.style.getPropertyValue('--h')));
  check('月ごとに帯の色が違う', new Set(hues).size === hues.length && hues.length >= 3, hues.join());
  const sticky = await p.evaluate(() => { const sc = document.querySelector('.scroll'); const sec = document.querySelectorAll('.month')[1]; const band = sec.querySelector('.band'); sc.scrollTop = sec.offsetTop + 400; const t = band.getBoundingClientRect().top - sc.getBoundingClientRect().top; return { pos: getComputedStyle(band).position, t: Math.round(t) }; });
  check('月の帯は上に固定される', sticky.pos === 'sticky' && sticky.t === 0, JSON.stringify(sticky));
  await p.evaluate(() => { document.querySelector('.scroll').scrollTop = 0; });
  // 帯（開催中・次の予定・申込締切）
  const strips = await p.locator('.strip').evaluateAll((els) => els.map((e) => ({ cls: e.className, pill: e.querySelector('.strip-pill').innerText, title: e.querySelector('.strip-title').innerText, end: e.querySelector('.strip-end').innerText })));
  const next = up.find((e) => e.date > TODAY);
  check('開催中の帯', strips.some((s) => s.pill === '開催中' && s.title === '開催中のイベント' && s.end === 'あと1日'), JSON.stringify(strips[0]));
  check('次の予定の帯', strips.some((s) => s.pill === '次の予定' && s.title === next.title && s.end === `${Math.round((new Date(next.date) - new Date(TODAY)) / 86400000)}日後`), next.title);
  check('次の申込締切の帯（3日以内は目立つ）', strips.some((s) => s.pill === '申込締切' && s.title === '配信ライブ' && s.end === '明日まで' && s.cls.includes('soon')), JSON.stringify(strips.find((s) => s.pill === '申込締切')));
  // 行の中身
  const row0 = await p.locator('.row', { hasText: 'テスト大会' }).filter({ hasText: 'もてぎ' }).first().evaluate((e) => ({ d: e.querySelector('.d').innerText, w: e.querySelector('.w').innerText, t: e.querySelector('.t').innerText, chip: e.querySelector('.chip')?.innerText, hasChev: !!e.querySelector('.chev'), href: e.querySelector('a').getAttribute('href') }));
  check('行：日付・曜日・題名・種類の印・矢印', row0.d === '14' && row0.w === '土' && row0.chip && row0.hasChev && row0.href.startsWith('#/list/'), JSON.stringify(row0));
  const multi = await p.locator('.row', { hasText: '富士スピードウェイ テスト大会' }).first().evaluate((e) => e.querySelector('.d').innerText + ' ' + e.querySelector('.w').innerText);
  check('行：期間は「14–15 土–日」', /^14–15 土–日$/.test(multi), multi);
  const rowD = p.locator('.row', { hasText: 'テスト大会' }).filter({ hasText: 'もてぎ' }).first();
  const badge = await rowD.locator('.badge').innerText();
  check('行：近い申し込み・期限の印（3日以内は目立つ）', /申込締切 10\/30/.test(badge) && (await rowD.locator('.badge.soon').count()) === 1, badge);
  check('行：日程未定は「未定」', await p.locator('.row', { hasText: '日程未定のイベント' }).locator('.pill').innerText() === '未定');
  // 種類で絞り込む
  for (const t of ['テストA', 'テストB', 'テストC']) {
    await p.click(`.tab[data-tab="${t}"]`); await p.waitForTimeout(200);
    const n = await p.locator('.month .row').count();
    const exp = up.concat(undated).filter((e) => e.tabName === t).length;
    const chips = await p.locator('.month .row .chip').count();
    check(`種類「${t}」で絞り込み`, n === exp && chips === 0 && (await p.locator(`.tab[aria-selected="true"]`).innerText()) === t, `${n}/${exp} 種類の印 ${chips}`);
  }
  await p.click('.tab[data-tab="all"]'); await p.waitForTimeout(200);
  // 過去
  await p.click('[data-seg="view"] [data-value="past"]'); await p.waitForTimeout(250);
  const pastRows = await p.locator('.month .row').allInnerTexts();
  check('過去：終わった予定だけ（開催中・日程未定は出ない）', pastRows.length === past.length && pastRows[0].includes('終わったイベント') && !(await p.locator('.strip').count()), `${pastRows.length}/${past.length}`);
  await p.click('[data-seg="view"] [data-value="up"]'); await p.waitForTimeout(250);
  // 画面を移っても選んだ種類・位置を覚えている
  await p.click('.tab[data-tab="テストB"]'); await p.evaluate(() => { document.querySelector('.scroll').scrollTop = 120; });
  await p.click('#nav a[data-tab="home"]'); await p.waitForTimeout(300); await p.click('#nav a[data-tab="list"]'); await p.waitForTimeout(300);
  check('別の画面から戻っても、種類とスクロール位置を覚えている', (await p.locator('.tab[aria-selected="true"]').innerText()) === 'テストB' && (await p.evaluate(() => Math.round(document.querySelector('.scroll').scrollTop))) === 120);
  await p.click('.tab[data-tab="all"]'); await p.waitForTimeout(200);

  /* ========== 4. ホーム ========== */
  section('ホーム');
  await p.click('#nav a[data-tab="home"]'); await p.waitForSelector('.home-card'); await p.waitForTimeout(500);
  const hero = await p.locator('.home-card').innerText();
  check('ホーム：開催中があれば先頭に出す', hero.includes('開催中のイベント') && hero.includes('いま開催中'), hero.replace(/\n/g, ' ').slice(0, 60));
  const homeRows = await p.locator('.home-list .row').count();
  check('ホーム：これからの予定は最大5件', homeRows === 5, String(homeRows));
  check('ホーム：天気が入る（予報の出る16日以内・場所が分かる予定だけ）', (await p.locator('.home-card [data-wx]:not(:empty)').count()) === 1 && (await p.locator('.home-list [data-wx]:not(:empty)').count()) >= 1 && (await p.locator('.home-list .row', { hasText: '来年' }).count()) === 0, String(await p.locator('.home-list [data-wx]:not(:empty)').count()));
  await p.click('.section-title a'); await p.waitForTimeout(300);
  check('ホーム：「すべて見る」で予定へ', location_hash(await p.url()) === '#/list');

  /* ========== 4b. 予定のタブ：固定とスワイプ（Event list と同じ） ========== */
  section('予定のタブ：固定と左右スワイプ');
  await p.evaluate(() => { location.hash = '#/list'; }); await p.waitForSelector('.tab'); await p.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(p);
  const swipe = async (x1, x2, { y = 520, hold = false, wait = 450 } = {}) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / 10, y: y + i }] }); await p.waitForTimeout(16); }
    if (hold) return;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(wait);
  };
  const cur = () => p.evaluate(() => document.querySelector('.tab[aria-selected="true"]').dataset.tab);
  const pos = () => p.evaluate(() => ({ tabs: Math.round(document.querySelector('.tabs').getBoundingClientRect().top), now: Math.round(document.querySelector('#now').getBoundingClientRect().top), sc: Math.round(document.querySelector('#scroll').getBoundingClientRect().top) }));
  check('初めは「すべて」', (await cur()) === 'all');
  await swipe(300, 80); check('左へスワイプ：次のタブへ', (await cur()) === 'テストA', await cur());
  const rowsA = await p.locator('#scroll .row').count();
  check('切り替わった先は、その種類だけの一覧', rowsA === up.filter((e) => e.tabName === 'テストA').length, String(rowsA));
  await swipe(300, 80); check('もう一度左へ：さらに次のタブ', (await cur()) === 'テストB');
  await swipe(80, 300); check('右へスワイプ：前のタブへ', (await cur()) === 'テストA');
  await swipe(80, 300); await swipe(80, 300); check('先頭より前へは進まない', (await cur()) === 'all');
  await swipe(300, 270); check('少しだけ動かして離すと、元のタブのまま', (await cur()) === 'all');
  check('動かし終わったあと、仮の画面は残らない', (await p.locator('.swipe-ghost').count()) === 0 && (await p.evaluate(() => document.querySelector('#scroll').style.transform)) === '');
  await swipe(300, 80, { hold: true }); await p.waitForTimeout(80);
  check('指を動かしている間は、隣の画面が続いて見える', (await p.locator('.swipe-ghost').count()) === 1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(450);
  check('離すと切り替わる', (await cur()) === 'テストA');
  await swipe(80, 300);
  await p.evaluate(() => { document.querySelector('#scroll').scrollTop = 600; }); await p.waitForTimeout(100);
  const fixed = await pos();
  check('一覧をスクロールしても、タブ・帯は動かない', fixed.tabs === (await pos()).tabs && (await p.evaluate(() => document.querySelector('#now').getBoundingClientRect().height)) > 0 && fixed.now < fixed.sc, JSON.stringify(fixed));
  await swipe(300, 80);
  check('切り替えると、一覧は先頭に戻る', (await p.evaluate(() => document.querySelector('#scroll').scrollTop)) === 0);
  check('縦のスワイプでは切り替わらない', await (async () => { const before = await cur(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 700 }] }); for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 + i, y: 700 - i * 20 }] }); await p.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300); return (await cur()) === before; })());
  check('画面の左端からの動きでは切り替わらない（ブラウザの戻る用）', await (async () => { const before = await cur(); await swipe(10, 300); return (await cur()) === before; })());
  await p.click('.tab[data-tab="all"]'); await p.waitForTimeout(300);
  check('タブを押しても切り替わる', (await cur()) === 'all');
  await p.click('[data-seg="view"] button:has-text("過去")'); await p.waitForTimeout(200);
  check('過去：固定の帯は出ない', (await p.locator('#now .strip').count()) === 0);
  await swipe(300, 80); check('過去のまま、スワイプで隣のタブへ', (await cur()) === 'テストA' && (await p.locator('[data-seg="view"] button[aria-pressed="true"]').innerText()) === '過去');
  await p.click('[data-seg="view"] button:has-text("これから")'); await p.waitForTimeout(200);
  await p.click('.tab[data-tab="all"]'); await p.waitForTimeout(300);
  // 「すべて」が左に固定されるか：タブが多いと横に動く
  const stick = await p.evaluate(() => { const a = document.querySelector('.tab-all'); return { pos: getComputedStyle(a).position, left: getComputedStyle(a).left }; });
  check('「すべて」のタブは左に固定', stick.pos === 'sticky', JSON.stringify(stick));
  check('スクリプトのエラーなし（スワイプ）', p.errs.length === 0, p.errs.join('|'));

  /* ========== 5. 詳細の画面の開き閉じ ========== */
  section('詳細の画面');
  const firstRow = p.locator('.month .row a').first();
  await p.evaluate(() => { document.querySelector('.scroll').scrollTop = 150; });
  await firstRow.click(); await p.waitForSelector('dialog.sheet[open] .panel');
  const sc0 = await p.evaluate(() => document.querySelector('.scroll').scrollTop); // 押したときの位置（押すために動くことがある）
  check('行を押すと詳細が下から開く（URLにも入る）', /^#\/list\/./.test(location_hash(await p.url())));
  await p.click('dialog.sheet[open] [data-act="close"]'); await p.waitForTimeout(150);
  check('×で閉じる：URLが戻り、一覧の位置はそのまま', location_hash(await p.url()) === '#/list' && !(await p.locator('dialog.sheet[open]').count()) && Math.round(await p.evaluate(() => document.querySelector('.scroll').scrollTop)) === Math.round(sc0));
  await firstRow.click(); await p.waitForSelector('dialog.sheet[open] .panel'); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check('Escapeで閉じる', !(await p.locator('dialog.sheet[open]').count()) && location_hash(await p.url()) === '#/list');
  await firstRow.click(); await p.waitForSelector('dialog.sheet[open] .panel'); await p.mouse.click(195, 30); await p.waitForTimeout(150);
  check('外側を押して閉じる', !(await p.locator('dialog.sheet[open]').count()) && location_hash(await p.url()) === '#/list');
  await firstRow.click(); await p.waitForSelector('dialog.sheet[open] .panel'); await p.goBack(); await p.waitForTimeout(250);
  check('ブラウザの「戻る」で閉じる', !(await p.locator('dialog.sheet[open]').count()) && location_hash(await p.url()) === '#/list');
  await p.evaluate(() => { location.hash = '#/list/nope'; }); await p.waitForSelector('dialog.sheet[open] .empty'); 
  check('存在しない予定：見つからない表示', (await p.locator('dialog.sheet[open]').innerText()).includes('見つかりません'));
  await closeSheet(p);
  await p.evaluate(() => { location.hash = '#/home'; }); await p.waitForSelector('.home-card');
  await p.click('.home-card'); await p.waitForSelector('dialog.sheet[open] .panel');
  check('ホームの予定からも開く（ホームのまま）', /^#\/home\/./.test(location_hash(await p.url())) && (await p.locator('.home-card').count()) === 1);
  await closeSheet(p);

  /* ========== 6. 行き方（国内の全会場・乗り換え・ナビ） ========== */
  section('行き方（国内の全会場）');
  let venueOk = 0;
  for (const v of DOM) {
    await sheet(p, vid(v));
    const to = await p.inputValue('#tTo');
    const nav = await p.getAttribute('[data-link="carnavi"]', 'href');
    const map = await p.getAttribute('[data-link="map"]', 'href');
    const okNav = nav.startsWith(`yjcarnavi://navi/select?point=current&point=${v.lat.toFixed(7)},${v.lon.toFixed(7)},`);
    const okMap = map.startsWith(`https://maps.apple.com/?ll=${v.lat}%2C${v.lon}`) || map.startsWith(`https://maps.apple.com/?ll=${v.lat},${v.lon}`);
    if (to === v.station && okNav && okMap && !(await p.locator('[data-act="route"],[data-link="google"]').count())) venueOk++;
    else check(`会場 ${v.name}`, false, `到着駅 ${to}/${v.station} nav ${okNav} map ${okMap}`);
    await closeSheet(p);
  }
  check(`国内の全会場 ${DOM.length}か所：到着駅・ナビ・マップが正しい`, venueOk === DOM.length, `${venueOk}/${DOM.length}`);
  for (const v of ABROAD) {
    await sheet(p, vid(v));
    const tf = await p.locator('.tform').count(), cn = await p.locator('[data-link="carnavi"]').count(), mp = await p.locator('[data-link="map"]').count();
    if (!(tf === 0 && cn === 0 && mp === 1)) check(`海外の会場 ${v.name}`, false, `form ${tf} navi ${cn} map ${mp}`);
    await closeSheet(p);
  }
  check(`海外の会場 ${ABROAD.length}か所：乗り換え・ナビは出さず、マップだけ`, true);
  // 一覧に無い会場
  await sheet(p, 'unknown'); await p.waitForFunction(() => document.querySelector('#tTo') && document.querySelector('#tTo').value, null, { timeout: 5000 }).catch(() => {});
  const unkTo = await p.inputValue('#tTo').catch(() => '');
  check('一覧に無い会場：位置を調べて、最寄り駅を到着駅に入れる', unkTo === nearestName({ lat: 35.648, lon: 140.0346 }, 2), `${unkTo} / ${nearestName({ lat: 35.648, lon: 140.0346 }, 2)}`);
  await closeSheet(p);
  state.geocode = [];
  await sheet(p, 'unknown2'); await p.waitForSelector('#accessSec:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('位置が見つからない会場：「マップで探す」だけ', (await p.locator('.tform').count()) === 0 && (await p.locator('[data-link="map"]').count()) === 1);
  await closeSheet(p);
  state.geocode = [{ lat: '35.6480', lon: '140.0346' }];
  await sheet(p, 'online');
  check('オンライン配信：行き方を出さない', await p.locator('#accessSec').isHidden());
  await closeSheet(p);
  await sheet(p, 'tbd');
  check('日程未定：カレンダー追加は押せない', await p.locator('[data-act="cal"]').isDisabled());
  await closeSheet(p);

  /* ========== 7. 乗り換え：日にち・時刻が必ず入る ========== */
  section('乗り換え：指定した日にち・時刻');
  const V0 = DOM[0];
  await sheet(p, vid(V0));
  await p.fill('#tFrom', '新宿');
  const yq = async () => { await clearOpened(p); await p.click('[data-link="yahoo"]'); const o = await opened(p); return o.length ? new URL(o[0]).searchParams : null; };
  let q = await yq();
  check('初めの日付は予定の開催日', q && q.get('y') === '2026' && q.get('m') === '11' && q.get('d') === '14' && q.get('ym') === '202611' && q.get('datepick') === '20261114' && q.get('hh') === '9' && q.get('m1') === '0' && q.get('m2') === '0' && q.get('type') === '4', q && q.toString());
  await p.fill('#tDate', '2026-12-25'); q = await yq();
  check('日付を変える（入力）→ 2026-12-25', q.get('y') === '2026' && q.get('m') === '12' && q.get('d') === '25' && q.get('ym') === '202612' && q.get('datepick') === '20261225');
  await setVal(p, '#tDate', '2027-01-03', 'change'); q = await yq();
  check('日付を変える（iPhone：changeだけ）→ 2027-01-03', q.get('y') === '2027' && q.get('m') === '01' && q.get('d') === '03' && q.get('datepick') === '20270103');
  await setVal(p, '#tTime', '07:35', 'change'); await p.click('[data-seg="when"] [data-value="depart"]'); q = await yq();
  check('時刻と出発を変える → 7:35 出発', q.get('hh') === '7' && q.get('m1') === '3' && q.get('m2') === '5' && q.get('type') === '1');
  check('ボタンに検索する日時が出る', (await p.locator('[data-link="yahoo"]').innerText()).includes('1/3(日) 7:35 出発'), (await p.locator('[data-link="yahoo"]').innerText()).replace(/\n/g, ' '));
  await p.fill('#tDate', '2026-11-30'); await p.fill('#tTime', '23:05'); q = await yq();
  check('続けて変えても、最後の入力が入る', q.get('d') === '30' && q.get('m') === '11' && q.get('hh') === '23' && q.get('m1') === '0' && q.get('m2') === '5');
  await p.fill('#tDate', ''); q = await yq();
  check('日付が空：エラーを出して開かない', q === null && (await p.textContent('#tErr')).includes('日付'));
  await p.fill('#tDate', '2026-11-30'); await p.fill('#tFrom', ''); q = await yq();
  check('出発駅が空：エラーを出して開かない', q === null && (await p.textContent('#tErr')).includes('出発駅'));
  await p.fill('#tFrom', V0.station); q = await yq();
  check('出発と到着が同じ：エラー', q === null && (await p.textContent('#tErr')).includes('同じ'));
  await p.fill('#tFrom', '品川駅'); q = await yq();
  check('「駅」をつけても通る（品川駅→品川）', q && q.get('from') === '品川');
  await closeSheet(p);
  // 読み込み直し・開き直しても、日時・出発駅が残る
  await p.reload(); await p.waitForSelector('dialog.sheet[open] .tform, .home-card, .scroll'); await sheet(p, vid(V0));
  check('開き直しても日時と出発駅が残る', (await p.inputValue('#tDate')) === '2026-11-30' && (await p.inputValue('#tTime')) === '23:05' && (await p.inputValue('#tFrom')) === '品川');
  await closeSheet(p);

  /* ========== 8. 現在地から出発駅を探す ========== */
  section('出発駅を現在地から探す（全国）');
  const byPref = new Map(); ST.forEach((s) => { if (!byPref.has(s.p)) byPref.set(s.p, []); byPref.get(s.p).push(s); });
  const origins = []; byPref.forEach((l) => [0, Math.floor(l.length / 2), l.length - 1].forEach((i) => origins.push(l[i])));
  const N = Math.min(origins.length, +(process.env.N || 1e9));
  let near = 0, nearFail = [];
  await sheet(p, vid(DOM[1]));
  for (let i = 0; i < N; i++) {
    const o = origins[i], me = { lat: o.lat + 0.0009, lon: o.lon };
    await ctx.setGeolocation({ latitude: me.lat, longitude: me.lon });
    await p.fill('#tFrom', '');
    await p.click('[data-act="near-me"]');
    await p.waitForFunction(() => document.querySelector('#tFrom').value || document.querySelector('#tErr').textContent, null, { timeout: 5000 });
    const got = await p.inputValue('#tFrom');
    const exp = nearestName(me, 2) || nearestName(me, 10) || nearestName(me, 30);
    if (got === exp) near++; else nearFail.push(`${o.p} ${o.n}: ${got}/${exp}`);
  }
  check(`現在地から最寄り駅：${byPref.size}都道府県・${N}地点`, near === N, `${near}/${N} ${nearFail.slice(0, 3).join(' ')}`);
  // 圏外でも探せる
  await ctx.setOffline(true);
  await ctx.setGeolocation({ latitude: 35.6905, longitude: 139.7005 });
  await p.fill('#tFrom', ''); await p.click('[data-act="near-me"]'); await p.waitForFunction(() => document.querySelector('#tFrom').value, null, { timeout: 5000 }).catch(() => {});
  check('圏外でも、現在地から出発駅を探せる', (await p.inputValue('#tFrom')) === '新宿', await p.inputValue('#tFrom'));
  await ctx.setOffline(false);
  // ほかの駅の候補
  check('近くの駅の候補（押すと入る）', (await p.locator('#fromChips .pick').count()) >= 2);
  await p.locator('#fromChips .pick').nth(1).click();
  check('候補を押すと出発駅に入り、リンクも変わる', (await p.inputValue('#tFrom')) !== '新宿' && new URL(await p.getAttribute('[data-link="yahoo"]', 'href')).searchParams.get('from') === (await p.inputValue('#tFrom')));
  // 海外・鉄道のない場所
  await ctx.setGeolocation({ latitude: 37.5665, longitude: 126.978 });
  await p.click('[data-act="near-me"]'); await p.waitForFunction(() => document.querySelector('#tErr').textContent);
  check('海外にいるとき：理由を表示', (await p.textContent('#tErr')).includes('国外'), await p.textContent('#tErr'));
  await ctx.setGeolocation({ latitude: 45.38, longitude: 141.0 });
  await p.click('[data-act="near-me"]'); await p.waitForFunction(() => document.querySelector('#tErr').textContent.includes('駅'));
  check('鉄道のない島：「近くに駅が見つかりません」', (await p.textContent('#tErr')).includes('見つかりません'));
  await ctx.setGeolocation({ latitude: 35.6905, longitude: 139.7005 });
  await closeSheet(p);
  // 位置情報を許可していないとき
  const ctxNo = await newCtx({ permissions: [] });
  const pn = await open(ctxNo, ''); await sheet(pn, vid(DOM[1]));
  await pn.click('[data-act="near-me"]'); await pn.waitForFunction(() => document.querySelector('#tErr').textContent, null, { timeout: 8000 });
  check('位置情報を許可していないとき：理由を表示（駅名の入力を案内）', (await pn.textContent('#tErr')).includes('許可'), await pn.textContent('#tErr'));
  await pn.fill('#tFrom', '東京');
  check('許可しなくても、駅名を入力して使える', new URL(await pn.getAttribute('[data-link="yahoo"]', 'href')).searchParams.get('from') === '東京');
  await ctxNo.close();

  /* ========== 9. 外のアプリを開いて戻る ========== */
  section('外のアプリ・サイトを開いて戻る');
  const ctx2 = await newCtx();
  const p2 = await open(ctx2, '', { record: false });
  await sheet(p2, vid(DOM[0]));
  await p2.fill('#tFrom', '新宿'); await p2.fill('#tDate', '2026-11-20'); await p2.fill('#tTime', '08:15');
  const [pop] = await Promise.all([ctx2.waitForEvent('page', { timeout: 5000 }), p2.click('[data-link="yahoo"]')]);
  await pop.waitForLoadState();
  const pu = new URL(pop.url());
  check('Yahoo!乗換案内が別の画面で開き、日時が入っている', pu.host === 'transit.yahoo.co.jp' && pu.searchParams.get('d') === '20' && pu.searchParams.get('hh') === '8' && pu.searchParams.get('m1') === '1' && pu.searchParams.get('m2') === '5' && pu.searchParams.get('from') === '新宿', pop.url().slice(0, 100));
  await pop.close(); await p2.bringToFront();
  check('戻ると、詳細の画面も入力もそのまま', (await p2.locator('dialog.sheet[open]').count()) === 1 && (await p2.inputValue('#tDate')) === '2026-11-20');
  const [pop2] = await Promise.all([ctx2.waitForEvent('page', { timeout: 5000 }), p2.click('[data-link="map"]')]);
  check('マップが別の画面で開く', new URL(pop2.url()).host === 'maps.apple.com'); await pop2.close(); await p2.bringToFront();
  await p2.click('[data-link="carnavi"]').catch(() => {}); await p2.waitForTimeout(400);
  check('Yahoo!カーナビを押しても、アプリの画面が消えない', p2.url().startsWith(BASE) && (await p2.locator('dialog.sheet[open]').count()) === 1);
  // 他のアプリへ行って戻る（画面が隠れる→見える）
  const setVis = (v) => p2.evaluate((x) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => x }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event(x === 'visible' ? 'focus' : 'blur')); }, v);
  await setVis('hidden'); await setVis('visible'); await p2.waitForTimeout(200);
  check('裏へ行って戻っても、中身がある', (await p2.locator('dialog.sheet[open] #tFrom').count()) === 1);
  // iPhone が中身を捨てた（空になった）とき
  await closeSheet(p2); await p2.evaluate(() => { document.querySelector('#view').innerHTML = ''; window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await p2.waitForSelector('#view .scroll', { timeout: 5000 }).catch(() => {});
  check('画面が空になったら、戻ったときに描き直す', (await p2.locator('#view .scroll').count()) === 1);
  // 読み込み直し（通信あり・圏外）：詳細を開いたまま
  await p2.evaluate(() => navigator.serviceWorker.ready); await p2.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 }).catch(() => {});
  await p2.goto(BASE + `#/list/${vid(DOM[0])}`); await p2.waitForSelector('dialog.sheet[open] .tform');
  check('読み込み直しても、同じ予定の詳細が開き、日時が残る', (await p2.inputValue('#tDate')) === '2026-11-20' && (await p2.inputValue('#tFrom')) === '新宿');
  await ctx2.setOffline(true);
  for (const h of ['#/home', '#/list', `#/list/${vid(DOM[0])}`, '#/home/' + vid(DOM[2])]) {
    await p2.goto(BASE + h).catch(() => {}); await p2.waitForSelector('#view .scroll', { timeout: 8000 }).catch(() => {});
    const bg = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check(`読み込み直し（圏外）${h}`, (await p2.locator('#view .scroll').count()) === 1 && bg === 'rgb(11, 16, 32)', bg);
  }
  await ctx2.setOffline(false);
  // 新しい版に切り替わったとき
  await p2.goto(BASE + '#/list'); await p2.waitForSelector('#view .scroll');
  await p2.evaluate(() => { window.__marker = 'old'; }); // 読み込み直されたら消える
  srv.close();
  const srv2 = serve(APP, PORT, { '/sw.js': () => fs.readFileSync(path.join(APP, 'sw.js'), 'utf8').replace(/const CACHE = '([^']+)'/, "const CACHE = '$1-next'") });
  p2.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update())).catch(() => {});
  await p2.waitForFunction(() => window.__marker !== 'old', null, { timeout: 15000 }).catch(() => {});
  await p2.waitForSelector('#view .scroll', { timeout: 8000 }).catch(() => {});
  const keys = await p2.evaluate(() => caches.keys()).catch(() => []);
  const swR = { reloaded: await p2.evaluate(() => window.__marker !== 'old'), scrolls: await p2.locator('#view .scroll').count(), keys: keys.join() };
  check('新しい版に切り替わると読み込み直し、画面が出る', swR.reloaded && swR.scrolls === 1 && keys.length === 1 && keys[0].endsWith('-next'), JSON.stringify(swR));
  check('カレンダー追加を押しても画面が消えない', await (async () => { await sheet(p2, vid(DOM[0])); await p2.click('[data-act="cal"]'); await p2.waitForTimeout(200); return (await p2.locator('dialog.sheet[open]').count()) === 1 && (await p2.locator('iframe').count()) === 1; })());
  await ctx2.close();
  srv2.close();
  const srv3 = serve(APP, PORT);

  /* ========== 10. 読み込みの失敗・圏外・バックアップ ========== */
  section('読み込みの失敗・圏外・バックアップ');
  const ctx3 = await newCtx();
  state.feedFails = true;
  const p3 = await open(ctx3, '');
  await p3.waitForSelector('.empty [data-act="refresh"]', { timeout: 8000 });
  check('日程を読めないとき：理由と「もう一度」', (await p3.locator('.empty').innerText()).includes('読み込めませんでした'));
  state.feedFails = false;
  await p3.click('[data-act="refresh"]'); await p3.waitForSelector('.home-card', { timeout: 8000 });
  check('「もう一度読み込む」で復帰', true);
  state.feedFails = true; await p3.reload(); await p3.waitForSelector('.home-card, .empty', { timeout: 8000 });
  check('前回の内容が残っていれば、読めなくてもそれを出す', (await p3.locator('.home-card').count()) === 1, '');
  state.feedFails = false;
  await ctx3.setOffline(true); await p3.reload().catch(() => {}); await p3.waitForSelector('.home-card', { timeout: 8000 }).catch(() => {});
  check('圏外：前回の内容と「オフライン」の表示', (await p3.locator('.home-card').count()) === 1 && (await p3.locator('#sync').innerText()).includes('オフライン'), await p3.locator('#sync').innerText());
  await ctx3.setOffline(false);
  // バックアップ
  const bk = { app: 'event-cho', schema: 1, savedAt: '2026-10-27T10:00:00Z', tabs: [{ id: 'ado', name: 'Ado' }], events: [{ id: 'm1', type: 'ado', title: 'Ado 東京ドーム公演', date: '2026-11-23', place: '東京ドーム', dates: [{ kind: 'close', date: '2026-10-29', note: '' }] }, { id: 'm2', type: 'ado', title: 'もてぎ テスト', feedId: 't0', date: '2026-11-14', place: 'モビリティリゾートもてぎ' }] };
  fs.writeFileSync('/tmp/hud-backup.json', JSON.stringify(bk));
  await p3.goto(BASE + '#/list'); await p3.waitForSelector('.tab'); const before = await p3.locator('.month .row').count();
  await p3.click('#dataBtn'); await p3.setInputFiles('[data-act="file"]', '/tmp/hud-backup.json'); await p3.waitForTimeout(400);
  await p3.click('dialog.data [data-act="close"]'); await p3.waitForTimeout(200);
  const after = await p3.locator('.month .row').count();
  check('バックアップを読み込むと予定が増え、新しい種類のタブも出る', after === before + 1 && (await p3.locator('.tab', { hasText: 'Ado' }).count()) === 1, `${before}→${after}`);
  fs.writeFileSync('/tmp/hud-bad.json', '{"x":1}');
  await p3.click('#dataBtn'); await p3.setInputFiles('[data-act="file"]', '/tmp/hud-bad.json'); await p3.waitForTimeout(300);
  check('違うファイルは、読み込まずに知らせる', (await p3.locator('.toast.on').innerText()).includes('バックアップ'));
  await p3.click('dialog.data [data-act="clear"]'); await p3.waitForTimeout(200); await p3.click('dialog.data [data-act="close"]'); await p3.waitForTimeout(200);
  check('読み込んだ予定を消せる', (await p3.locator('.month .row').count()) === before);
  await ctx3.close();

  /* ========== 11. 見やすさ・使いやすさ ========== */
  section('見やすさ・使いやすさ（文字の大きさ・押す大きさ・色の差・はみ出し）');
  const ctx4 = await newCtx();
  const p4 = await open(ctx4, ''); await p4.waitForSelector('.home-card'); await p4.waitForTimeout(500);
  const tiny = async (pg) => pg.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('.sr-only, script, style')) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) out.push(`${el.className || el.tagName}:${fs}px "${n.textContent.trim().slice(0, 12)}"`);
    }
    return out;
  });
  const small = async (pg) => pg.evaluate(() => [...document.querySelectorAll('button, a.btn, a.row-btn, a.strip, .nav a, input, .tab, .pick, .seg button, .icon-btn')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && e.offsetParent !== null; })
    .map((e) => { const r = e.getBoundingClientRect(); return { n: `${e.tagName}.${e.className}`.slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 40 || x.w < 40));
  for (const h of ['#/home', '#/list', '#/list/' + vid(DOM[0])]) {
    await p4.evaluate((x) => { location.hash = x; }, h); await p4.waitForTimeout(500);
    const t = await tiny(p4), s = await small(p4);
    check(`${h}：文字は12px以上`, t.length === 0, t.slice(0, 3).join(' | '));
    check(`${h}：ボタン・入力欄は40px以上（指で押せる）`, s.length === 0, JSON.stringify(s.slice(0, 3)));
    const inp = await p4.evaluate(() => [...document.querySelectorAll('input')].filter((e) => e.offsetParent).map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((f) => f < 16));
    check(`${h}：入力欄の文字は16px以上（入力で拡大されない）`, inp.length === 0);
  }
  await closeSheet(p4);
  for (const w of [320, 375, 430]) {
    await p4.setViewportSize({ width: w, height: 740 });
    for (const h of ['#/home', '#/list', '#/list/' + vid(DOM[1]), '#/list/live1']) {
      await p4.evaluate((x) => { location.hash = x; }, h); await p4.waitForTimeout(400);
      const o = await p4.evaluate(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > W + 0.5 && !e.closest('.tabs'); }).slice(0, 3).map((e) => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().right)}`); });
      if (o.length) check(`幅${w}px ${h}：横にはみ出さない`, false, o.join(' '));
    }
  }
  check('幅 320・375・430px：横にはみ出さない', !lines.some((l) => l.startsWith('NG 幅')));
  await p4.setViewportSize({ width: 390, height: 844 });
  // 色の差（文字と背景）
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const css = fs.readFileSync(path.join(APP, 'css/tokens.css'), 'utf8');
  const tok = (n) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))[1];
  const pairs = [['fg', 'bg'], ['fg', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'], ['accent', 'bg'], ['accent', 'surface'], ['on-accent', 'accent'], ['warn', 'bg'], ['danger', 'bg'], ['c1', 'surface'], ['c2', 'surface'], ['c3', 'surface'], ['c4', 'surface'], ['c5', 'surface'], ['c6', 'surface'], ['c7', 'surface'], ['c8', 'surface']];
  const bad = pairs.map(([f, g]) => [f, g, ratio(hex(tok(f)), hex(tok(g)))]).filter(([, , r]) => r < 4.5);
  check('色の差：文字と背景が 4.5:1 以上（全13組）', bad.length === 0, bad.map((x) => `${x[0]}/${x[1]} ${x[2].toFixed(2)}`).join(' '));
  const hsl = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)); };
  let minBand = 99; for (let m = 1; m <= 12; m++) { const h = (m * 150) % 360; minBand = Math.min(minBand, ratio(hsl(h, 70, 80), hsl(h, 30, 19))); }
  check('色の差：月の帯の文字が 4.5:1 以上（12か月）', minBand >= 4.5, minBand.toFixed(2));
  check('画面のエラーなし', [p, p2, p3, p4].every((x) => x.errs.length === 0), [p, p2, p3, p4].flatMap((x) => x.errs).join(' / '));

  console.log(lines.join('\n'));
  console.log(fails.length ? `\nNG ${fails.length}件：${fails.join(' / ')}` : '\nNG 0件');
  await b.close(); srv3.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.log(lines.join('\n')); console.error('途中で止まった:', e); process.exit(2); });

function location_hash(url) { const i = url.indexOf('#'); return i < 0 ? '' : url.slice(i); }
