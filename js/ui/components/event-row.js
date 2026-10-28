// 予定1件の行（Event list の行と同じ作り）。押すと詳細の画面（下から出る）が開く。
import { esc } from '../../util/dom.js';
import { toDate, md } from '../../util/date.js';
import { WEEKDAYS, DATE_KINDS } from '../../config.js';
import { nextDeadline, lastDay } from '../../data/events.js';
import { DEADLINE_SOON } from '../../config.js';

const wd = (iso) => WEEKDAYS[toDate(iso).getDay()];

/** いちばん近い申し込み・期限の印。3日以内は目立たせる。 */
function deadlineBadge(e, today) {
  const d = nextDeadline(e, today);
  if (!d) return '';
  const tail = d.days === 0 ? '（今日）' : d.days === 1 ? '（明日）' : '';
  return `<span class="badge${d.days <= DEADLINE_SOON ? ' soon' : ''}">${esc(DATE_KINDS[d.kind])} ${md(d.date)}${tail}</span>`;
}

/**
 * @param {{ e: object, today: string, base: 'home'|'list', past?: boolean, showTab?: boolean, wx?: boolean }} p
 *   showTab: 種類の印を出すか（「すべて」のとき）、wx: 天気の置き場所を作るか
 */
export function rowHtml({ e, today, base, past = false, showTab = true, wx = false }) {
  let when;
  if (e.date) {
    const last = lastDay(e);
    const multi = last !== e.date;
    const a = toDate(e.date), b = toDate(last);
    when = `<span class="when"><b class="d${multi ? ' multi' : ''}">${multi ? `${a.getDate()}–${b.getDate()}` : a.getDate()}</b>`
      + `<span class="w">${multi ? `${wd(e.date)}–${wd(last)}` : wd(e.date)}</span></span>`;
  } else when = '<span class="when"><b class="pill">未定</b></span>';
  return `<li class="row${past ? ' past' : ''}"><a class="row-btn" href="#/${base}/${encodeURIComponent(e.id)}">${when}`
    + `<span class="what"><span class="t">${esc(e.title)}</span><span class="meta">`
    + (showTab ? `<span class="chip" style="--c:var(--c${e.color})">${esc(e.tab)}</span>` : '')
    + deadlineBadge(e, today)
    + (e.place ? `<span>${esc(e.place)}</span>` : '')
    + (wx ? `<span class="wx" data-wx="${esc(e.id)}"></span>` : '')
    + '</span></span><span class="chev" aria-hidden="true"></span></a></li>';
}
