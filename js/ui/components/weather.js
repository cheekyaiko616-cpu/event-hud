// 天気の表示。予報がまだ出ない・取れない・場所が無い、も同じ場所に出す。
import { esc } from '../../util/dom.js';
import { md, weekday, addDays } from '../../util/date.js';
import { describe } from '../../services/weather.js';
import { WEATHER_DAYS } from '../../config.js';

/** 行の右に出す小さな天気（その日の分）。 */
export function weatherMini(w) {
  if (!w) return '';
  const { icon, label } = describe(w.code);
  return `<span aria-label="${esc(`${label}、最高${w.max}度`)}"><span aria-hidden="true">${icon} ${w.max}°</span></span>`;
}

/**
 * 予定の日ごとの予報（最大5日）。
 * @param {{ state: 'ready'|'loading'|'later'|'error'|'none', e: object, today: string, data?: object }} p
 */
export function weatherStrip({ state, e, today, data }) {
  if (state === 'loading') return '<p class="wx-text" role="status">読み込み中…</p>';
  if (state === 'none') return '<p class="wx-text">場所が未定のため出せません</p>';
  if (state === 'error') return '<p class="wx-text" role="status">取得できませんでした</p>';
  if (state === 'later') { const from = addDays(e.date, -(WEATHER_DAYS - 1)); return `<p class="wx-text">${md(from)}(${weekday(from)})ごろから表示されます</p>`; }
  const days = [];
  for (let d = e.date; d <= (e.end || e.date) && days.length < 5; d = addDays(d, 1)) if (data[d]) days.push(d);
  if (!days.length) return '<p class="wx-text">この日の予報はまだありません</p>';
  return '<div class="wx-strip">' + days.map((d) => {
    const w = data[d], { icon, label } = describe(w.code);
    return `<div class="wx-day"><small>${md(d)} ${weekday(d)}</small><div class="i" role="img" aria-label="${label}">${icon}</div>`
      + `<div class="t">${w.max}° <span class="muted">/ ${w.min}°</span></div><div class="p">降水 ${w.pop ?? '-'}%</div></div>`;
  }).join('') + '</div>';
}
