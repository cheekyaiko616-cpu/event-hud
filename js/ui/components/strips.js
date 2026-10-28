// 開催中・次の予定・次の申込締切の帯（Event list の一覧の上に出る帯と同じ）。
import { esc } from '../../util/dom.js';
import { md, daysBetween } from '../../util/date.js';
import { lastDay } from '../../data/events.js';
import { DEADLINE_SOON } from '../../config.js';

const link = (base, e) => `#/${base}/${encodeURIComponent(e.id)}`;
const strip = (cls, base, e, pill, end) =>
  `<a class="strip ${cls}" href="${link(base, e)}" style="--c:var(--c${e.color})"><span class="strip-pill">${pill}</span>`
  + `<span class="strip-title">${esc(e.title)}</span><span class="strip-end">${end}</span></a>`;

export const liveStrip = (e, today, base) => strip('live', base, e, '開催中', lastDay(e) === today ? '今日まで' : `あと${daysBetween(today, lastDay(e))}日`);

export function nextStrip(e, today, base) {
  const n = daysBetween(today, e.date);
  return strip('next', base, e, '次の予定', n === 1 ? '明日' : `${n}日後`);
}

export function deadlineStrip({ e, d, days }, base) {
  const left = days === 0 ? '今日まで' : days === 1 ? '明日まで' : `${md(d.date)}（あと${days}日）`;
  return strip(days <= DEADLINE_SOON ? 'dl soon' : 'dl', base, e, '申込締切', left);
}
