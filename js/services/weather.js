// 会場の天気予報（Open-Meteo・無料・登録不要）。位置ごとに3時間覚えて、同じ場所は何度も聞かない。
import { WEATHER_URL, WEATHER_DAYS, KEYS, TTL } from '../config.js';
import { createCache } from '../util/cache.js';
import { fetchJson } from '../util/net.js';
import { daysBetween } from '../util/date.js';

const cache = createCache(KEYS.weather, { ttl: TTL.weather, max: 40 });

/** 予報が出る日か（今日から16日先まで）。 */
export const forecastable = (date, today) => { const d = daysBetween(today, date); return d >= 0 && d < WEATHER_DAYS; };

/** { 'YYYY-MM-DD': { code, max, min, pop } }。日付は現地の日付。 */
export function forecast(pos, { signal } = {}) {
  const k = `${pos.lat.toFixed(2)},${pos.lon.toFixed(2)}`;
  return cache.through(k, async () => {
    const url = `${WEATHER_URL}?latitude=${pos.lat}&longitude=${pos.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=${WEATHER_DAYS}`;
    const r = await fetchJson(url, { signal });
    const d = r && r.daily;
    if (!d || !Array.isArray(d.time)) return undefined; // 覚えない
    const out = {};
    d.time.forEach((t, i) => {
      out[t] = { code: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), pop: d.precipitation_probability_max[i] };
    });
    return out;
  });
}

/** 天気の番号 → 記号と言葉（読み上げにも使う）。 */
export function describe(code) {
  if (code === 0) return { icon: '☀', label: '晴れ' };
  if (code <= 2) return { icon: '🌤', label: '晴れ時々くもり' };
  if (code === 3) return { icon: '☁', label: 'くもり' };
  if (code <= 48) return { icon: '🌫', label: '霧' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: '☂', label: '雨' };
  if (code <= 77 || code === 85 || code === 86) return { icon: '❄', label: '雪' };
  return { icon: '⚡', label: '雷雨' };
}
