// 全国の全駅で、乗り換え案内のURL・国内判定・最寄り駅の選び方を確かめる（外部サービスは使わない）。
import fs from 'node:fs';
const APP = process.argv[2];
const ST = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const { yahooTransitUrl, googleTransitUrl, appleTransitUrl } = await import(`${APP}/js/services/transit-links.js`);
const { cleanStationName, parseStations, nearbyStations } = await import(`${APP}/js/services/stations.js`);
const { isDomestic, distanceKm } = await import(`${APP}/js/util/geo-math.js`);
const { VENUES } = await import(`${APP}/js/data/venues.js`);

const fails = [];
const fail = (k, msg) => { if (fails.length < 40) fails.push(`${k}: ${msg}`); else fails.length++; };
const domVenues = VENUES.filter((v) => v.station);

// 近くの駅を速く探すための区分け（0.05度ごと）
const grid = new Map();
const cell = (lat, lon) => `${Math.floor(lat / 0.05)},${Math.floor(lon / 0.05)}`;
ST.forEach((s) => { const k = cell(s.lat, s.lon); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); });
function within(p, km) {
  const r = Math.ceil(km / 5) + 1, out = [];
  const cy = Math.floor(p.lat / 0.05), cx = Math.floor(p.lon / 0.05);
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) for (const s of grid.get(`${y},${x}`) || []) if (distanceKm(p, s) <= km) out.push(s);
  return out;
}
const overpassFor = (p, km) => ({ elements: within(p, km).map((s) => ({ type: 'node', lat: s.lat, lon: s.lon, tags: { name: s.n, railway: 'station' } })) });

let urls = 0, nearest = 0, escalated = 0;
const prefs = new Set();
for (const s of ST) {
  prefs.add(s.p);
  const name = cleanStationName(s.n);
  if (!name) fail(s.n, '駅名が空になった');
  if (/[（）()〈〉]|駅$/.test(name)) fail(s.n, `駅名の整え漏れ: ${name}`);
  if (!isDomestic(s)) fail(s.n, `国内判定が外れた (${s.lat},${s.lon})`);
  // 出発駅 × 国内の全会場：URL
  for (const v of domVenues) {
    if (name === v.station) continue;
    for (const arrive of [true, false]) {
      const u = new URL(yahooTransitUrl({ from: name, to: v.station, date: '2026-11-14', time: '09:05', arrive }));
      const q = u.searchParams;
      if (u.host !== 'transit.yahoo.co.jp' || q.get('from') !== name || q.get('to') !== v.station || q.get('type') !== (arrive ? '4' : '1')
        || q.get('y') !== '2026' || q.get('m') !== '11' || q.get('d') !== '14' || q.get('hh') !== '9' || q.get('m1') !== '0' || q.get('m2') !== '5') fail(s.n, `Yahoo URL: ${u}`);
      urls++;
    }
    const g = new URL(googleTransitUrl({ from: name, dest: v }));
    if (g.searchParams.get('origin') !== `${name}駅` || g.searchParams.get('travelmode') !== 'transit' || g.searchParams.get('destination') !== `${v.lat},${v.lon}`) fail(s.n, `Google URL: ${g}`);
    const a = new URL(appleTransitUrl({ from: name, dest: v, label: v.name }));
    if (a.searchParams.get('saddr') !== `${name}駅` || a.searchParams.get('dirflg') !== 'r') fail(s.n, `Apple URL: ${a}`);
    urls += 2;
  }
  // 現在地＝駅から約100m離れた所：一番近い駅が選ばれるか
  const me = { lat: s.lat + 0.0009, lon: s.lon };
  const list = parseStations(overpassFor(me, 2), me);
  const truth = within(me, 2).sort((a, b) => distanceKm(me, a) - distanceKm(me, b))[0];
  if (!list.length || list[0].name !== cleanStationName(truth.n)) fail(s.n, `最寄り駅の選択: ${list[0]?.name} / 正解 ${truth?.n}`);
  else nearest++;
}

// 駅から遠い場所（山の中など）：2km → 10km → 30km と広げて見つかるか（通信は差し替え）
const remote = [{ lat: 36.0, lon: 138.9, label: '秩父山地' }, { lat: 43.6, lon: 142.9, label: '大雪山' }, { lat: 33.75, lon: 133.2, label: '四国山地' }, { lat: 32.0, lon: 131.1, label: '宮崎の山中' }, { lat: 38.75, lon: 140.55, label: '奥羽山脈' }];
globalThis.fetch = async (url) => {
  const q = decodeURIComponent(new URL(url).searchParams.get('data'));
  const [, r, lat, lon] = q.match(/around:(\d+),([\d.]+),([\d.]+)/);
  return { ok: true, json: async () => overpassFor({ lat: +lat, lon: +lon }, +r / 1000) };
};
for (const p of remote) {
  const list = await nearbyStations(p);
  if (!list.length) fail(p.label, '30km以内に駅が見つからない');
  else { escalated++; console.log(`  ${p.label}: ${list[0].name} ${list[0].km.toFixed(1)}km`); }
}

// 国外は国内と判定しないこと
const abroad = { ソウル: [37.5665, 126.978], 釜山: [35.1, 129.04], 巨済島: [34.85, 128.6], 済州島: [33.5, 126.53], 鬱陵島: [37.5, 130.9], 平壌: [39.03, 125.75],
  ウラジオストク: [43.12, 131.89], ユジノサハリンスク: [46.96, 142.73], 沿海州の海岸: [45.0, 136.8], 台北: [25.03, 121.56], 花蓮: [23.98, 121.6], 上海: [31.23, 121.47], 北京: [39.9, 116.4], グアム: [13.44, 144.79], マニラ: [14.6, 120.98] };
let outside = 0;
for (const [k, [lat, lon]] of Object.entries(abroad)) { if (isDomestic({ lat, lon })) fail(k, '国外なのに国内と判定'); else outside++; }
// 国内の端の島など
const edges = { 与那国島: [24.47, 123.0], 石垣島: [24.34, 124.16], 那覇: [26.21, 127.68], 父島: [27.09, 142.19], 八丈島: [33.11, 139.79], 青ヶ島: [32.46, 139.76], 対馬: [34.2, 129.29], 壱岐: [33.79, 129.72], 五島: [32.7, 128.84], 隠岐: [36.2, 133.3], 佐渡: [38.0, 138.4], 奥尻島: [42.15, 139.47], 礼文島: [45.38, 141.0], 稚内: [45.42, 141.67], 根室: [43.33, 145.58], 知床: [44.07, 145.0], 屋久島: [30.35, 130.53], 奄美: [28.38, 129.49] };
let inside = 0;
for (const [k, [lat, lon]] of Object.entries(edges)) { if (!isDomestic({ lat, lon })) fail(k, '国内なのに国外と判定'); else inside++; }
console.log(`国外 ${outside}/${Object.keys(abroad).length} を国外と判定 / 国内の端の島など ${inside}/${Object.keys(edges).length} を国内と判定`);
console.log(`都道府県 ${prefs.size} / 駅 ${ST.length} / 会場 ${domVenues.length}`);
console.log(`URL確認 ${urls}件 / 最寄り駅の選択 ${nearest}件 正解 / 遠い場所 ${escalated}/${remote.length}`);
console.log(fails.length ? `NG ${fails.length}件\n${fails.join('\n')}` : 'NG 0件');
process.exit(fails.length ? 1 : 0);
