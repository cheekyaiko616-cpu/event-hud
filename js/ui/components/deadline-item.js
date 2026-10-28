// 申し込み・期限の1件。3日以内は光らせ、それ以外は落ち着いた色にする。
import { esc } from '../../util/dom.js';
import { md, weekday } from '../../util/date.js';
import { DATE_KINDS } from '../../config.js';
import { eventHref } from './event-row.js';

export const URGENT_DAYS = 3;

/** @param {{ e: object, d: { kind, date, note }, days: number }} p */
export function deadlineItem({ e, d, days }) {
  const urgent = days <= URGENT_DAYS;
  const when = days === 0 ? '本日' : days === 1 ? '明日' : `${days}日後`;
  return `<a class="card alert${urgent ? '' : ' soon'}" href="${eventHref(e)}" aria-label="${esc(`${DATE_KINDS[d.kind]}、${e.title}、${when}`)}">`
    + `<span class="pulse" aria-hidden="true"></span>`
    + `<span class="x"><b>${esc(e.title)}</b><small>${esc(DATE_KINDS[d.kind])}${d.note ? `・${esc(d.note)}` : ''}</small></span>`
    + `<span class="go" aria-hidden="true">${when}<small>${md(d.date)}(${weekday(d.date)})</small></span></a>`;
}
