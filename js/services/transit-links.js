// 乗り換え・ナビ・地図アプリを開くためのURLを作る（通信しない）。
import { TRANSIT, CARNAVI, WEEKDAYS } from '../config.js';

const p2 = (n) => String(n).padStart(2, '0');

/**
 * Yahoo!乗換案内の検索結果のURL。
 * @param {{ from: string, to: string, date: string, time: string, arrive: boolean }} p
 *   date は 'YYYY-MM-DD'、time は 'HH:MM'、arrive が true なら「到着時刻」で探す
 * 日付は y / m / d と ym / datepick の両方で渡す（Yahoo! の検索フォームと同じ項目を全部入れる）。
 */
export function yahooTransitUrl({ from, to, date, time, arrive }) {
  const [y, m, d] = date.split('-');
  const [hh, mm] = time.split(':');
  const q = new URLSearchParams({
    from, to,
    y, m: p2(+m), d: p2(+d), ym: `${y}${p2(+m)}`, datepick: `${y}${p2(+m)}${p2(+d)}`,
    hh: String(+hh), m1: mm[0], m2: mm[1],
    type: arrive ? '4' : '1',            // 1=出発、4=到着
    ticket: 'ic', expkind: '1', ws: '3', s: '0',
    al: '1', shin: '1', ex: '1', hb: '1', lb: '1', sr: '1' // 飛行機・新幹線・特急・高速バス・路線バス・フェリーも使う
  });
  return `${TRANSIT.yahoo}?${q}`;
}

/** 検索する日時の表示：11/6(金) 9:00 到着 */
export function whenLabel({ date, time, arrive }) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':');
  return `${m}/${d}(${WEEKDAYS[new Date(y, m - 1, d).getDay()]}) ${+hh}:${mm} ${arrive ? '到着' : '出発'}`;
}

/**
 * Yahoo!カーナビで、現在地から会場までの案内を始める（アプリが必要）。
 * 公式の呼び出し方：point=current（現在地）→ point=緯度,経度,名前。緯度経度は小数7桁まで。
 */
export function yahooCarNaviUrl({ dest, label }) {
  const name = String(label || '目的地').replace(/,/g, ' ');
  return `${CARNAVI.scheme}?point=current&point=${dest.lat.toFixed(7)},${dest.lon.toFixed(7)},${encodeURIComponent(name)}`;
}

/** iPhone 標準の「マップ」で会場を開く。 */
export function appleMapsUrl(pos, label) {
  const q = encodeURIComponent(label || '会場');
  return pos ? `https://maps.apple.com/?ll=${pos.lat},${pos.lon}&q=${q}` : `https://maps.apple.com/?q=${q}`;
}
