// 予定1件の行。押すと詳細へ。天気は後から差し込めるように、置き場所（data-wx）だけ用意する。
import { esc } from '../../util/dom.js';
import { md, weekday, countdownLabel } from '../../util/date.js';
import { DATE_KINDS } from '../../config.js';

export const eventHref = (e) => `#/event/${encodeURIComponent(e.id)}`;

/**
 * @param {{ e: object, days: number, ongoing: boolean, deadline?: { kind, date }|null, sub?: string, wx?: boolean }} p
 *   sub: 2行目に出す文字（省略時は場所）、wx: 天気の置き場所を作るか
 */
export function eventRow({ e, days, ongoing, deadline = null, sub, wx = false }) {
  const label = countdownLabel(days, ongoing);
  const line2 = sub ?? (e.place || e.tab);
  return `<li class="row"><a href="${eventHref(e)}" aria-label="${esc(`${e.title}、${md(e.date)}、${label}`)}">`
    + `<span class="d"><b>${md(e.date)}</b><small>${weekday(e.date)}${e.end ? '〜' : ''}</small></span>`
    + `<span class="x"><span class="t">${esc(e.title)}</span><span class="s"><span class="c${e.color}" aria-hidden="true">●</span> ${esc(line2)}</span>`
    + (deadline ? `<span class="dl">⚑ ${esc(DATE_KINDS[deadline.kind])} ${md(deadline.date)}</span>` : '')
    + `</span><span class="r">${wx ? `<span class="wx" data-wx="${esc(e.id)}"></span>` : ''}<small>${label}</small></span></a></li>`;
}

/** 行の一覧。空なら何も返さない（呼ぶ側で「空」の表示を出す）。 */
export const eventRows = (items, opts) => (items.length ? `<ul class="rows card flush">${items.map((x) => eventRow({ ...x, ...opts })).join('')}</ul>` : '');
