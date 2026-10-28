// 乗り換え案内の画面を開くためのURLを作る（通信しない）。
// 結果は Yahoo!乗換案内・Googleマップ・Appleマップの画面で見る（どれも全国の鉄道に対応）。
import { TRANSIT } from '../config.js';

/**
 * Yahoo!乗換案内の検索結果のURL。
 * @param {{ from: string, to: string, date: string, time: string, arrive: boolean }} p
 *   date は 'YYYY-MM-DD'、time は 'HH:MM'、arrive が true なら「到着時刻」で探す
 */
export function yahooTransitUrl({ from, to, date, time, arrive }) {
  const [y, m, d] = date.split('-');
  const [hh, mm] = time.split(':');
  const q = new URLSearchParams({
    from, to, y, m, d, hh: String(+hh), m1: mm[0], m2: mm[1],
    type: arrive ? '4' : '1',            // 1=出発、4=到着
    ticket: 'ic', expkind: '1', ws: '3', s: '0',
    al: '1', shin: '1', ex: '1', hb: '1', lb: '1', sr: '1' // 飛行機・新幹線・特急・高速バス・路線バス・フェリーも使う
  });
  return `${TRANSIT.yahoo}?${q}`;
}

/** Googleマップの「電車・バスで会場まで」。from が空なら、Googleマップ側で現在地から探す。 */
export function googleTransitUrl({ from, dest }) {
  const q = new URLSearchParams({ api: '1', destination: `${dest.lat},${dest.lon}`, travelmode: 'transit' });
  if (from) q.set('origin', `${from}駅`);
  return `${TRANSIT.google}?${q}`;
}

/** Appleマップの「交通機関で会場まで」。 */
export function appleTransitUrl({ from, dest, label }) {
  const q = new URLSearchParams({ daddr: `${dest.lat},${dest.lon}`, dirflg: 'r' });
  if (from) q.set('saddr', `${from}駅`);
  if (label) q.set('q', label);
  return `${TRANSIT.apple}?${q}`;
}
