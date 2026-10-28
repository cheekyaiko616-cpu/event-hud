// 予定：今週末・今月・来月・すべて を切り替えて一覧にする。
import { setHtml, esc } from '../../util/dom.js';
import { upcoming, inPeriod, undated } from '../../data/events.js';
import { segmented, bindSegmented } from '../components/segmented.js';
import { eventRows } from '../components/event-row.js';
import { statusBlock } from '../components/status.js';
import { feedState } from './feed-state.js';
import { fillWeather } from '../weather-fill.js';
import { nextDeadlineOf } from './util.js';

export const title = '予定';
const OPTIONS = [
  { value: 'weekend', label: '今週末' }, { value: 'month', label: '今月' },
  { value: 'next', label: '来月' }, { value: 'all', label: 'すべて' }
];
const EMPTY = { weekend: '今週末の予定はありません', month: '今月の予定はありません', next: '来月の予定はありません', all: 'これからの予定はありません' };
let period = null; // 画面を移っても、選んだ期間は覚えておく（最初は、今月に予定が無ければ「すべて」）

function monthGroups(items) {
  const groups = new Map();
  items.forEach((x) => { const k = x.e.date.slice(0, 7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
  return groups;
}

export function mount(root) {
  let ctrl = new AbortController();
  let last = null;
  const off = bindSegmented(root, 'period', (v) => { period = v; if (last) render(last); });

  function render(s) {
    last = s;
    if (!period && s.events.length) period = inPeriod(s.events, s.today, 'month').length ? 'month' : 'all';
    const gate = feedState(s, ['row', 'row', 'row', 'row', 'row']);
    const head = `<h1 class="view-title" tabindex="-1">予定</h1>${segmented({ name: 'period', label: '期間', options: OPTIONS, value: period || 'month' })}`;
    if (gate) { setHtml(root, head + gate); return; }
    const items = period === 'all' ? upcoming(s.events, s.today) : inPeriod(s.events, s.today, period);
    const withDl = items.map((x) => ({ ...x, deadline: nextDeadlineOf(x.e, s.today) }));
    let body;
    if (!withDl.length) body = statusBlock({ kind: 'empty', title: EMPTY[period] });
    else if (period === 'all') {
      body = [...monthGroups(withDl)].map(([ym, list]) => `<section class="month"><h2 class="hud">// ${ym.replace('-', '.')} <small>${list.length}件</small></h2>${eventRows(list, { wx: true })}</section>`).join('');
      const tbd = undated(s.events);
      if (tbd.length) body += `<h2 class="hud">// 日程未定</h2><ul class="rows card flush">${tbd.map((e) => `<li class="row"><a href="#/event/${encodeURIComponent(e.id)}"><span class="d"><b>—</b></span><span class="x"><span class="t">${esc(e.title)}</span><span class="s">${esc(e.place || e.tab)}</span></span></a></li>`).join('')}</ul>`;
    } else body = `<p class="sr-only" role="status">${withDl.length}件</p>${eventRows(withDl, { wx: true })}`;
    if (setHtml(root, head + body)) {
      ctrl.abort();
      ctrl = new AbortController();
      fillWeather(root, s.events, s.today, ctrl.signal);
    }
  }
  return { update: render, unmount() { ctrl.abort(); off(); } };
}
