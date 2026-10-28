// 天気の表示。予報がまだ出ない・取れない・場所が無い、も同じ場所に出す。
import { esc } from '../../util/dom.js';
import { md, weekday, addDays, daysBetween } from '../../util/date.js';
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
 * @param {{ state: 'ready'|'loading'|'later'|'error'|'none', e: object, today: string, data?: object, message?: string }} p
 */
export function weatherStrip({ state, e, today, data, message }) {
  if (state === 'loading') return '<div class="skel" aria-hidden="true"></div><span class="sr-only" role="status">天気を読み込み中</span>';
  if (state === 'none') return '<p class="wx-note">場所が決まっていないため、天気は出せません。</p>';
  if (state === 'error') return `<p class="wx-note" role="status">天気を取得できませんでした。${esc(message || '')}</p>`;
  if (state === 'later') {
    const from = addDays(e.date, -(WEATHER_DAYS - 1));
    return `<p class="wx-note">予報は ${md(from)}(${weekday(from)}) ごろから表示されます（あと${daysBetween(today, from)}日）。</p>`;
  }
  const days = [];
  for (let d = e.date; d <= (e.end || e.date) && days.length < 5; d = addDays(d, 1)) if (data[d]) days.push(d);
  if (!days.length) return '<p class="wx-note">この日の予報はまだありません。</p>';
  return '<div class="wx-strip">' + days.map((d) => {
    const w = data[d], { icon, label } = describe(w.code);
    return `<div class="wx-day${d === today ? ' hit' : ''}"><small>${md(d)} ${weekday(d)}</small><div class="i" role="img" aria-label="${label}">${icon}</div>`
      + `<div class="t">${w.max}° <span class="muted">/ ${w.min}°</span></div><div class="p">降水 ${w.pop ?? '-'}%</div></div>`;
  }).join('') + '</div><p class="wx-note" style="margin-top:6px">現地の日付・気温。予報は3時間ごとに更新。</p>';
}
