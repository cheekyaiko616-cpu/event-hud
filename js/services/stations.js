// 位置から近くの駅を探す（OpenStreetMap の Overpass・無料）。
// まず2km以内、無ければ10km、30kmと広げる。結果は位置（約100m単位）ごとに30日覚える。
import { OVERPASS_URL, KEYS, TTL } from '../config.js';
import { createCache } from '../util/cache.js';
import { fetchJson } from '../util/net.js';
import { distanceKm } from '../util/geo-math.js';

const cache = createCache(KEYS.stations, { ttl: TTL.stations, max: 60 });
const RADII = [2000, 10000, 30000];

/** 駅名を乗り換え案内で通じる形にする（末尾の「駅」や、かっこ書き「（）〈〉」を外す。全角の空白も詰める）。 */
export function cleanStationName(name) {
  return String(name || '').replace(/[（(〈<][^）)〉>]*[）)〉>]/g, '').replace(/[\s　]+/g, '').replace(/駅$/, '').trim();
}

/** Overpass の結果から、駅だけを近い順に並べる（同じ名前は1つにまとめる）。 */
export function parseStations(res, from) {
  const seen = new Map();
  for (const el of (res && res.elements) || []) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    const name = cleanStationName(t['name:ja'] || t.name);
    if (!name || lat == null || t.station === 'miniature' || t.usage === 'tourism') continue;
    const km = distanceKm(from, { lat, lon });
    const prev = seen.get(name);
    if (!prev || km < prev.km) seen.set(name, { name, lat, lon, km, line: t.line || t.operator || '' });
  }
  return [...seen.values()].sort((a, b) => a.km - b.km);
}

const query = (p, r) => `[out:json][timeout:20];(node["railway"~"^(station|halt)$"](around:${r},${p.lat},${p.lon});`
  + `node["public_transport"="station"]["train"="yes"](around:${r},${p.lat},${p.lon}););out body 40;`;

/** 近くの駅（近い順・最大5件）。見つからなければ空の一覧。 */
export function nearbyStations(pos, { signal } = {}) {
  const k = `${pos.lat.toFixed(3)},${pos.lon.toFixed(3)}`;
  return cache.through(k, async () => {
    for (const r of RADII) {
      const res = await fetchJson(`${OVERPASS_URL}?data=${encodeURIComponent(query(pos, r))}`, { signal, timeout: 20000 });
      const list = parseStations(res, pos);
      if (list.length) return list.slice(0, 5);
    }
    return [];
  });
}
