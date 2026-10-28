// 予定：Event list の一覧と同じ作り。種類のタブ・これから／過去・開催中／次の予定／申込締切の帯・月の帯・予定の行・日程未定。
import { setHtml } from '../../util/dom.js';
import { select, groupByMonth, liveNow, nextEvent, nextCloseDeadline } from '../../data/events.js';
import { tabsHtml, bindTabs, selectTab, tabIds } from '../components/tabs-bar.js';
import { initTabSwipe } from '../tab-swipe.js';
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

/** 種類 tabId の画面を、固定の帯（now）と一覧（list）に分けて作る。 */
function parts(s, tabId, view, { gate = true } = {}) {
  const head = '<h1 class="view-title sr-only" tabindex="-1">予定</h1>';
  const blocked = gate && feedState(s, 5);
  if (blocked) return { now: '', list: head + blocked, rows: false };
  const sel = select(s.events, tabId, s.today);
  const past = view === 'past';
  const showTab = tabId === 'all';
  const switcher = `<div class="switch">${segmented({ name: 'view', label: '表示', options: [{ value: 'up', label: 'これから' }, { value: 'past', label: '過去' }], value: view })}</div>`;
  let now = '';
  if (!past) {
    const live = liveNow(sel.up, s.today);
    const next = nextEvent(sel.up, s.today);
    const dl = nextCloseDeadline([...sel.up, ...sel.undated], s.today);
    const strips = [...live.map((e) => liveStrip(e, s.today, 'list')), next ? nextStrip(next, s.today, 'list') : '', dl ? deadlineStrip(dl, 'list') : ''].filter(Boolean);
    now = strips.length ? `<div class="strips">${strips.join('')}</div>` : '';
  }
  const items = past ? sel.past : sel.up;
  let body = groupByMonth(items).map((g) => monthSection(g, s, past, showTab)).join('');
  if (!past && sel.undated.length) body += undatedSection(sel.undated, s, showTab);
  if (!body) body = statusBlock({ kind: 'empty', title: past ? '終わった予定はありません' : '予定がありません' });
  return { now, list: head + switcher + body + '<div class="list-end"></div>', rows: true };
}

export function mount(root) {
  let ctrl = new AbortController();
  let last = null, tabsKey = '';
  setHtml(root, '<div id="tabsMount"></div><div id="now"></div><div class="scroll" id="scroll"></div>');
  const tabsMount = root.querySelector('#tabsMount');
  const nowBox = root.querySelector('#now');
  const box = root.querySelector('#scroll');
  const rerender = () => { if (last) render(last); };
  const slide = (dir) => { if (dir && box.animate) [nowBox, box].forEach((m) => m.animate([{ opacity: 0, transform: `translateX(${dir * 28}px)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2, .7, .2, 1)' })); };
  const ids = () => tabIds(last ? last.tabs : []);
  const go = (id, animate) => {
    const dir = Math.sign(ids().indexOf(id) - ids().indexOf(tab));
    tab = id; box.scrollTop = 0; selectTab(tabsMount, id); rerender();
    if (animate) slide(dir);
  };
  const offTabs = bindTabs(tabsMount, (id) => go(id, true));
  const offSeg = bindSegmented(box, 'view', (v) => { view = v; box.scrollTop = 0; rerender(); });
  const offSwipe = initTabSwipe({
    area: box, now: nowBox, ids, current: () => tab, go: (id) => go(id, false),
    ghost: (id) => { const p = parts(last, id, view); return { now: p.now, list: p.list }; }
  });

  function render(s) {
    last = s;
    if (!s.tabs.some((t) => t.name === tab)) tab = 'all'; // 種類が無くなっていたら「すべて」へ
    const key = s.tabs.map((t) => t.name + t.color).join(',');
    if (key !== tabsKey) { tabsKey = key; tabsMount.innerHTML = s.tabs.length ? tabsHtml({ tabs: s.tabs, value: tab }) : ''; }
    selectTab(tabsMount, tab);
    const p = parts(s, tab, view);
    setHtml(nowBox, p.now);
    if (setHtml(box, p.list) && p.rows) {
      ctrl.abort();
      ctrl = new AbortController();
      if (view !== 'past') fillWeather(box, s.events, s.today, ctrl.signal);
    }
  }
  return { scrollEl: box, update: render, unmount() { ctrl.abort(); offTabs(); offSeg(); offSwipe(); } };
}
