// 予定：Event list の一覧と同じ作り。種類のタブ・これから／過去・開催中／次の予定／申込締切の帯・月の帯・予定の行・日程未定。
import { setHtml } from '../../util/dom.js';
import { select, groupByMonth, liveNow, nextEvent, nextCloseDeadline } from '../../data/events.js';
import { tabsHtml, bindTabs } from '../components/tabs-bar.js';
import { segmented, bindSegmented } from '../components/segmented.js';
import { rowHtml } from '../components/event-row.js';
import { liveStrip, nextStrip, deadlineStrip } from '../components/strips.js';
import { statusBlock } from '../components/status.js';
import { feedState } from './feed-state.js';
import { fillWeather } from '../weather-fill.js';

export const title = '予定';
const hueOf = (m) => (m * 150) % 360; // 隣り合う月の色が大きく離れるようにする（Event list と同じ）

// 画面を移っても、選んだ種類・これから／過去は覚えておく
let tab = 'all';
let view = 'up';

function monthSection(g, s, past, showTab) {
  const thisYear = new Date().getFullYear();
  return `<section class="month" style="--h:${hueOf(g.m)}"><div class="band"><div class="wrap band-in">`
    + (g.y !== thisYear ? `<span class="band-y">${g.y}</span>` : '')
    + `<span class="band-m">${g.m}</span><span class="band-u">月</span><span class="band-r">${g.items.length}件</span></div></div>`
    + `<ul class="wrap rows">${g.items.map((e) => rowHtml({ e, today: s.today, base: 'list', past, showTab, wx: !past })).join('')}</ul></section>`;
}

function undatedSection(items, s, showTab) {
  return `<section class="month"><div class="band tbd"><div class="wrap band-in"><span class="band-t">日程未定</span><span class="band-r">公式発表待ち ・ ${items.length}件</span></div></div>`
    + `<ul class="wrap rows">${items.map((e) => rowHtml({ e, today: s.today, base: 'list', showTab })).join('')}</ul></section>`;
}

export function mount(root) {
  let ctrl = new AbortController();
  let last = null, tabsKey = '';
  setHtml(root, '<div id="tabsMount"></div><div class="scroll" id="scroll"></div>');
  const tabsMount = root.querySelector('#tabsMount');
  const box = root.querySelector('#scroll');
  const rerender = () => { if (last) render(last); };
  const offTabs = bindTabs(tabsMount, (id) => { tab = id; box.scrollTop = 0; rerender(); });
  const offSeg = bindSegmented(box, 'view', (v) => { view = v; box.scrollTop = 0; rerender(); });

  function render(s) {
    last = s;
    const head = '<h1 class="view-title sr-only" tabindex="-1">予定</h1>';
    if (!s.tabs.some((t) => t.name === tab)) tab = 'all'; // 種類が無くなっていたら「すべて」へ
    const key = `${tab}|${s.tabs.map((t) => t.name + t.color).join(',')}`;
    if (key !== tabsKey) { tabsKey = key; tabsMount.innerHTML = s.tabs.length ? tabsHtml({ tabs: s.tabs, value: tab }) : ''; }
    const gate = feedState(s, 5);
    if (gate) { setHtml(box, head + gate); return; }
    const sel = select(s.events, tab, s.today);
    const past = view === 'past';
    const showTab = tab === 'all';
    const switcher = `<div class="switch">${segmented({ name: 'view', label: '表示', options: [{ value: 'up', label: 'これから' }, { value: 'past', label: '過去' }], value: view })}</div>`;
    let strips = '';
    if (!past) {
      const live = liveNow(sel.up, s.today);
      const next = nextEvent(sel.up, s.today);
      const dl = nextCloseDeadline([...sel.up, ...sel.undated], s.today);
      const parts = [...live.map((e) => liveStrip(e, s.today, 'list')), next ? nextStrip(next, s.today, 'list') : '', dl ? deadlineStrip(dl, 'list') : ''].filter(Boolean);
      strips = parts.length ? `<div class="strips">${parts.join('')}</div>` : '';
    }
    const items = past ? sel.past : sel.up;
    let body = groupByMonth(items).map((g) => monthSection(g, s, past, showTab)).join('');
    if (!past && sel.undated.length) body += undatedSection(sel.undated, s, showTab);
    if (!body) body = statusBlock({ kind: 'empty', title: past ? '終わった予定はありません' : '予定がありません' });
    if (setHtml(box, head + switcher + strips + body + '<div class="list-end"></div>')) {
      ctrl.abort();
      ctrl = new AbortController();
      if (!past) fillWeather(box, s.events, s.today, ctrl.signal);
    }
  }
  return { scrollEl: box, update: render, unmount() { ctrl.abort(); offTabs(); offSeg(); } };
}
