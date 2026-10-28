// 一覧に並んだ予定へ、天気を後から差し込む。
// 予報が出る日（16日以内）の予定だけを、手が空いたときに少しずつ調べる。行ごとに書き換えるので、画面全体は描き直さない。
import { knownPlace } from '../services/geo.js';
import { forecast, forecastable } from '../services/weather.js';
import { weatherMini } from './components/weather.js';

const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));

/** root の中の [data-wx] に天気を入れる。signal で途中で止められる。 */
export function fillWeather(root, events, today, signal) {
  const targets = [...root.querySelectorAll('[data-wx]')];
  if (!targets.length) return;
  const byId = new Map(events.map((e) => [e.id, e]));
  idle(async () => {
    for (const el of targets) {
      if (signal.aborted) return;
      const e = byId.get(el.dataset.wx);
      const day = e && (e.date < today ? today : e.date);
      if (!e || !forecastable(day, today)) continue;
      const pos = knownPlace(e.place); // 一覧では、位置を調べる通信はしない（詳細を開いたときだけ）
      if (!pos) continue;
      try {
        const data = await forecast(pos, { signal });
        if (!signal.aborted && data[day]) el.innerHTML = weatherMini(data[day]);
      } catch { /* 天気は無くても困らない */ }
    }
  });
}
