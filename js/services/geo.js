// 予定の場所を、地図に置ける位置（緯度・経度）にする。
// 一覧（venues.js）→ 端末に覚えた結果 → 地図サービスで検索、の順。検索は1秒に1回までに抑える。
import { VENUES, NO_PLACE } from '../data/venues.js';
import { GEOCODE_URL, KEYS, TTL } from '../config.js';
import { createCache } from '../util/cache.js';
import { fetchJson } from '../util/net.js';

const cache = createCache(KEYS.geo, { ttl: TTL.geo, max: 200 });
let lastQuery = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 通信せずに分かる位置。分からなければ undefined、場所が無い予定なら null。 */
export function knownPlace(place) {
  if (!place || NO_PLACE.test(place)) return null;
  const v = VENUES.find((x) => place.includes(x.match));
  if (v) return { lat: v.lat, lon: v.lon, name: v.name, station: v.station || '', stationKm: v.stationKm ?? null };
  const c = cache.get(place);
  return c === undefined ? undefined : c;
}

/** 位置を求める。見つからないときは null。 */
export async function locate(place, { signal } = {}) {
  const k = knownPlace(place);
  if (k !== undefined) return k;
  return cache.through(place, async () => {
    const gap = 1100 - (Date.now() - lastQuery);
    if (gap > 0) await wait(gap);
    lastQuery = Date.now();
    const q = place.replace(/[（(].*?[）)]/g, ' ').trim();
    const url = `${GEOCODE_URL}?format=jsonv2&limit=1&accept-language=ja&q=${encodeURIComponent(q)}`;
    const r = await fetchJson(url, { signal });
    const hit = Array.isArray(r) && r[0];
    return hit ? { lat: +hit.lat, lon: +hit.lon, name: place } : null;
  });
}
