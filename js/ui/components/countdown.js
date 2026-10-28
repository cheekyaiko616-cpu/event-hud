// 次の予定までの大きな数字。
import { esc } from '../../util/dom.js';
import { shortRange } from '../../util/date.js';
import { eventHref } from './event-row.js';

/** @param {{ e: object, days: number, ongoing: boolean }} p */
export function countdown({ e, days, ongoing }) {
  const big = ongoing ? ['開催中', ''] : days === 0 ? ['今日', ''] : [String(days), '日後'];
  const spoken = ongoing ? '開催中' : days === 0 ? '今日' : `あと${days}日`;
  return `<a class="card corners hero-link" href="${eventHref(e)}" aria-label="${esc(`次の予定、${e.title}、${spoken}`)}">`
    + `<div class="count${big[1] ? '' : ' word'}" aria-hidden="true"><b>${big[0]}</b><span>${big[1]}</span></div>`
    + `<div class="hero-title">${esc(e.title)}</div>`
    + `<div class="hero-sub">${shortRange(e.date, e.end)}${e.place ? ` ・ ${esc(e.place)}` : ''}</div>`
    + `<div class="hero-meta"><span class="tag c${e.color}">${esc(e.tab)}</span><span data-wx="${esc(e.id)}"></span></div></a>`;
}
