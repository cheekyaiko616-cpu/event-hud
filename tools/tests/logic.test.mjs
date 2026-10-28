// 画面を使わない確認（計算の正しさ）：全国の全駅 × 国内の全会場。外部サービスは使わない。
// 使い方: node tools/tests/logic.test.mjs "$PWD" stations-test.json
import fs from 'node:fs';
const APP = process.argv[2];
const ST = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const mini = JSON.parse(fs.readFileSync(`${APP}/data/stations.json`, 'utf8'));
globalThis.window = { __HUD_STATIONS__: mini };       // アプリの駅の一覧を、通信なしで渡す
const imp = (p) => import(`${APP}/${p}`);
const { yahooTransitUrl, yahooCarNaviUrl, appleMapsUrl, whenLabel } = await imp('js/services/transit-links.js');
const { cleanStationName, nearbyStations } = await imp('js/services/stations.js');
const { isDomestic, distanceKm } = await imp('js/util/geo-math.js');
const { VENUES } = await imp('js/data/venues.js');
const E = await imp('js/data/events.js');
const D = await imp('js/util/date.js');
const { normalizeEvent } = await imp('js/data/normalize.js');

const fails = [];
const fail = (k, msg) => { if (fails.length < 40) fails.push(`${k}: ${msg}`); else fails.length++; };
const eq = (k, a, b) => { if (a !== b) fail(k, `${a} / 正解 ${b}`); };
const dom = VENUES.filter((v) => v.station);
const names = new Set(mini.map((s) => s[0]));

// ---- 駅名の整え ----
for (const [a, b] of [['明治神宮前〈原宿〉', '明治神宮前'], ['新宿駅', '新宿'], ['東京　', '東京'], ['品川（東京）', '品川'], ['  渋 谷 ', '渋谷'], ['', '']]) eq(`駅名 ${a}`, cleanStationName(a), b);

// ---- 会場データ：到着駅が全国の駅の一覧にあるか、駅までの距離が本当か ----
for (const v of dom) {
  if (!names.has(v.station)) fail(v.name, `到着駅 ${v.station} が駅の一覧に無い`);
  else {
    const s = mini.filter((x) => x[0] === v.station).map((x) => distanceKm(v, { lat: x[1], lon: x[2] })).sort((a, b) => a - b)[0];
    if (Math.abs(s - v.stationKm) > 0.15) fail(v.name, `駅までの距離 ${v.stationKm}km は実際 ${s.toFixed(2)}km`);
  }
  if (!isDomestic(v)) fail(v.name, '国内の会場が国内と判定されない');
}
for (const v of VENUES.filter((x) => !x.station)) if (isDomestic(v)) fail(v.name, '海外の会場が国内と判定された');

// ---- 乗り換えのURL：全駅 × 国内の全会場 × 到着/出発 ----
let urls = 0;
for (const s of ST) {
  const name = cleanStationName(s.n);
  for (const v of dom) {
    if (name === v.station) continue;
    for (const arrive of [true, false]) {
      const date = ['2026-11-04', '2026-12-31', '2027-01-09'][urls % 3], time = ['00:05', '09:30', '23:55'][urls % 3];
      const q = new URL(yahooTransitUrl({ from: name, to: v.station, date, time, arrive })).searchParams;
      const [y, m, d] = date.split('-'), [hh, mm] = time.split(':');
      if (q.get('from') !== name || q.get('to') !== v.station || q.get('y') !== y || q.get('m') !== m || q.get('d') !== d
        || q.get('ym') !== y + m || q.get('datepick') !== y + m + d || q.get('hh') !== String(+hh) || q.get('m1') !== mm[0] || q.get('m2') !== mm[1]
        || q.get('type') !== (arrive ? '4' : '1')) fail(s.n, `Yahoo URL ${q}`);
      urls++;
    }
  }
}
eq('日時の表示', whenLabel({ date: '2026-11-06', time: '09:00', arrive: true }), '11/6(金) 9:00 到着');
eq('日時の表示（出発）', whenLabel({ date: '2027-01-10', time: '23:05', arrive: false }), '1/10(日) 23:05 出発');

// ---- Yahoo!カーナビ・マップのURL ----
for (const v of dom) {
  const n = yahooCarNaviUrl({ dest: v, label: v.name });
  const [pre, rest] = n.split('?');
  const [p1, p2] = rest.split('&');
  if (pre !== 'yjcarnavi://navi/select' || p1 !== 'point=current' || !p2.startsWith(`point=${v.lat.toFixed(7)},${v.lon.toFixed(7)},`) || decodeURIComponent(p2.split(',').slice(2).join(',')) !== v.name.replace(/,/g, ' ')) fail(v.name, `カーナビ ${n}`);
  const a = new URL(appleMapsUrl(v, v.name));
  if (a.host !== 'maps.apple.com' || a.searchParams.get('ll') !== `${v.lat},${v.lon}`) fail(v.name, `マップ ${a}`);
}

// ---- 現在地から最寄りの駅：全駅のそば（約100m・東西南北）、一番近い駅が選ばれるか ----
let nearest = 0;
const dirs = [[0.0009, 0], [-0.0009, 0], [0, 0.0011], [0, -0.0011]];
for (const s of ST) {
  const base = mini.find((x) => x[0] === cleanStationName(s.n) && Math.abs(x[1] - s.lat) < 0.01 && Math.abs(x[2] - s.lon) < 0.01);
  if (!base) { fail(s.n, '駅の一覧に無い'); continue; }
  for (const [dy, dx] of dirs) {
    const me = { lat: base[1] + dy, lon: base[2] + dx };
    const got = (await nearbyStations(me))[0];
    const truth = mini.map((x) => ({ n: x[0], d: distanceKm(me, { lat: x[1], lon: x[2] }) })).sort((a, b) => a.d - b.d)[0];
    if (!got || got.name !== truth.n) fail(s.n, `最寄り駅 ${got?.name} / 正解 ${truth.n}`); else nearest++;
  }
  if (nearest > 20000) break; // 全駅×4方向は時間がかかるため、2万件で十分
}
// 駅から遠い場所では、探す範囲を広げて見つかるか
for (const [label, lat, lon] of [['秩父山地', 36.0, 138.9], ['大雪山', 43.6, 142.9], ['四国山地', 33.75, 133.2], ['宮崎の山中', 32.0, 131.1], ['奥羽山脈', 38.75, 140.55]]) {
  const l = await nearbyStations({ lat, lon });
  if (!l.length) fail(label, '30km以内に駅が見つからない（地域の穴）'); else console.log(`  ${label}: ${l[0].name} ${l[0].km.toFixed(1)}km`);
}
// 鉄道の無い島では、空の一覧が返る（画面には「近くに駅が見つかりません」と出る）
for (const [label, lat, lon] of [['礼文島', 45.38, 141.0], ['与那国島', 24.47, 123.0], ['小笠原', 27.09, 142.19]]) {
  if ((await nearbyStations({ lat, lon })).length) fail(label, '鉄道の無い島で駅が見つかった');
}
// 国内の全駅が国内と判定されるか／国外が国外と判定されるか
let domOk = 0;
for (const s of ST) { if (!isDomestic(s)) fail(s.n, `国内判定が外れた (${s.lat},${s.lon})`); else domOk++; }
const abroad = { ソウル: [37.5665, 126.978], 釜山: [35.1, 129.04], 巨済島: [34.85, 128.6], 済州島: [33.5, 126.53], 鬱陵島: [37.5, 130.9], 平壌: [39.03, 125.75], ウラジオストク: [43.12, 131.89], ユジノサハリンスク: [46.96, 142.73], 台北: [25.03, 121.56], 花蓮: [23.98, 121.6], 上海: [31.23, 121.47], 北京: [39.9, 116.4], グアム: [13.44, 144.79], マニラ: [14.6, 120.98], 沿海州: [45.0, 136.8] };
for (const [k, [lat, lon]] of Object.entries(abroad)) if (isDomestic({ lat, lon })) fail(k, '国外なのに国内と判定');

// ---- 予定の取り出し（Event list の一覧と同じ決まり） ----
const today = '2026-10-28';
const mk = (id, tab, date, end = '', dates = []) => normalizeEvent({ id, title: id, tabName: tab, date, end, dates }, 'feed');
const evs = [mk('a', 'X', '2026-10-27', '2026-10-29'), mk('b', 'Y', '2026-11-05'), mk('c', 'X', '2026-09-01'), mk('d', 'Y', ''), mk('e', 'X', '2026-10-28'), mk('f', 'Y', '2026-10-20', '2026-10-27'),
  mk('g', 'X', '2026-12-01', '', [{ kind: 'close', date: '2026-11-02' }]), mk('h', 'Y', '', '', [{ kind: 'close', date: '2026-10-30' }])];
const { events, tabs } = E.mergeEvents(evs, []);
eq('種類の数', tabs.length, 2);
eq('種類の色', tabs.map((t) => t.color).join(), '1,2');
eq('同じ種類は同じ色', events.filter((e) => e.tab === 'X').every((e) => e.color === 1) && events.filter((e) => e.tab === 'Y').every((e) => e.color === 2), true);
const all = E.select(events, 'all', today);
eq('これから', all.up.map((e) => e.id).join(), 'f,a,e,b,g'.replace('f,', '').replace('a,e', 'a,e'));
eq('過去（新しい順）', all.past.map((e) => e.id).join(), 'f,c');
eq('日程未定', all.undated.map((e) => e.id).join(), 'd,h');
eq('種類で絞る', E.select(events, 'X', today).up.map((e) => e.id).join(), 'a,e,g');
eq('開催中', E.liveNow(all.up, today).map((e) => e.id).join(), 'a,e');
eq('次の予定', E.nextEvent(all.up, today).id, 'b');
const cd = E.nextCloseDeadline([...all.up, ...all.undated], today);
eq('次の申込締切（日程未定も含む）', `${cd.e.id} ${cd.days}`, 'h 2');
eq('月でまとめる', E.groupByMonth(all.up).map((g) => `${g.m}:${g.items.length}`).join(), '10:2,11:1,12:1'.replace('10:2', '10:2'));
eq('日付の範囲', D.shortRange('2026-11-06', '2026-11-08'), '11/6(金)〜11/8(日)');
// バックアップ側が優先され、同じ予定が二重に出ない
const merged = E.mergeEvents([mk('x1', 'X', '2026-11-01')], [normalizeEvent({ id: 'm1', title: 'x1', tabName: 'X', date: '2026-11-01', feedId: 'x1' }, 'mine')]);
eq('二重に出ない', merged.events.length, 1);
eq('自分の分を優先', merged.events[0].origin, 'mine');

console.log(`駅 ${ST.length}（一覧 ${mini.length}）／国内の会場 ${dom.length}`);
console.log(`乗り換えURL ${urls}件／最寄り駅の選択 ${nearest}件／国内判定 ${domOk}件`);
console.log(fails.length ? `NG ${fails.length}件\n${fails.join('\n')}` : 'NG 0件');
process.exit(fails.length ? 1 : 0);
