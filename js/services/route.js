// 現在地から会場までの車の経路（OSRM・無料）。線・距離・時間・曲がる所の一覧を返す。
import { ROUTE_URL } from '../config.js';
import { fetchJson } from '../util/net.js';

const memo = new Map(); // 同じ出発地（約100m単位）と目的地なら、通信しない

const TURN = { left: '左折', right: '右折', 'slight left': '斜め左', 'slight right': '斜め右', 'sharp left': '大きく左', 'sharp right': '大きく右', straight: '直進', uturn: 'Uターン' };

function stepText(s) {
  const t = s.maneuver.type, m = s.maneuver.modifier;
  const road = s.name ? `「${s.name}」` : '';
  if (t === 'depart') return `出発${road ? `し、${road}へ` : ''}`;
  if (t === 'arrive') return '目的地に到着';
  if (t === 'roundabout' || t === 'rotary') return `ロータリーを進み${road}へ`;
  return `${TURN[m] || '進む'}${road ? ` → ${road}` : ''}`;
}

export async function drivingRoute(from, to, { signal } = {}) {
  const k = `${from.lat.toFixed(3)},${from.lon.toFixed(3)}>${to.lat},${to.lon}`;
  if (memo.has(k)) return memo.get(k);
  const url = `${ROUTE_URL}${from.lon},${from.lat};${to.lon},${to.lat}?overview=simplified&geometries=geojson&steps=true`;
  const r = await fetchJson(url, { signal, timeout: 15000 });
  const route = r && r.code === 'Ok' && r.routes && r.routes[0];
  if (!route) throw new Error('経路が見つかりませんでした（海外や離島は車の経路を出せません）');
  const out = {
    line: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    km: route.distance / 1000,
    min: Math.round(route.duration / 60),
    steps: route.legs[0].steps.filter((s) => s.distance > 0 || s.maneuver.type === 'arrive').slice(0, 40)
      .map((s) => ({ text: stepText(s), km: s.distance / 1000 }))
  };
  if (memo.size > 20) memo.delete(memo.keys().next().value);
  memo.set(k, out);
  return out;
}

export const formatDuration = (min) => (min < 60 ? `${min}分` : `${Math.floor(min / 60)}時間${min % 60 ? `${min % 60}分` : ''}`);
export const formatKm = (km) => (km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`);
