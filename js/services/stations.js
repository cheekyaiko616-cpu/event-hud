// 近くの駅を探す。全国の駅の一覧（data/stations.json・約8,900駅）を端末の中に持っているので、
// 通信なしで、すぐに、圏外でも使える。最初に使うときだけ一覧を読み込む。
// 一覧は 2019年ごろのもの（japan-train-data / 駅データ.jp）。それ以降にできた駅は含まない。
import { distanceKm } from '../util/geo-math.js';

let loading = null;
let grid = null; // 緯度・経度 0.1度ごとの区分けで、近くだけを調べる

/** 駅名を乗り換え案内で通じる形にする（末尾の「駅」や、かっこ書き「（）〈〉」を外し、空白を詰める）。 */
export function cleanStationName(name) {
  return String(name || '').replace(/[（(〈<][^）)〉>]*[）)〉>]/g, '').replace(/[\s　]+/g, '').replace(/駅$/, '').trim();
}

const cell = (lat, lon) => `${Math.floor(lat * 10)},${Math.floor(lon * 10)}`;

function build(list) {
  const g = new Map();
  for (const [name, lat, lon] of list) {
    const k = cell(lat, lon);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push({ name, lat, lon });
  }
  return g;
}

/** 駅の一覧を読み込む（1回だけ）。失敗したら、次に呼んだときにやり直す。 */
export function loadStations() {
  if (grid) return Promise.resolve(grid);
  if (window.__HUD_STATIONS__) { grid = build(window.__HUD_STATIONS__); return Promise.resolve(grid); } // 動作確認用の1枚のHTMLには、一覧が入っている
  if (loading) return loading;
  const url = new URL('data/stations.json', document.baseURI);
  loading = fetch(url).then((r) => { if (!r.ok) throw new Error('駅の一覧を読み込めませんでした'); return r.json(); })
    .then((list) => { grid = build(list); return grid; })
    .finally(() => { loading = null; });
  return loading;
}

/** 区分け（grid）から、半径 km 以内の駅を近い順に。 */
export function nearIn(g, pos, km, max = 5) {
  const r = Math.ceil(km / 11) + 1; // 0.1度は約11km
  const cy = Math.floor(pos.lat * 10), cx = Math.floor(pos.lon * 10);
  const seen = new Map();
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      for (const s of g.get(`${y},${x}`) || []) {
        const d = distanceKm(pos, s);
        if (d > km) continue;
        const prev = seen.get(s.name);
        if (!prev || d < prev.km) seen.set(s.name, { name: s.name, lat: s.lat, lon: s.lon, km: d });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.km - b.km).slice(0, max);
}

/** 近くの駅（近い順・最大5件）。2km → 10km → 30km と広げて、見つからなければ空。 */
export async function nearbyStations(pos) {
  const g = await loadStations();
  for (const km of [2, 10, 30]) {
    const list = nearIn(g, pos, km);
    if (list.length) return list;
  }
  return [];
}
