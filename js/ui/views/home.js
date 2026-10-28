// ホーム：次の予定までの大きな数字と、これからの予定。
import { setHtml, esc } from '../../util/dom.js';
import { shortRange } from '../../util/date.js';
import { select, liveNow, nextEvent } from '../../data/events.js';
import { UPCOMING_MAX } from '../../config.js';
import { rowHtml } from '../components/event-row.js';
import { feedState } from './feed-state.js';
import { fillWeather } from '../weather-fill.js';

export const title = 'ホーム';

function heroHtml(e, today) {
  const ongoing = e.date <= today;
  const days = ongoing ? 0 : Math.round((new Date(e.date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  const big = ongoing ? ['開催中', ''] : days === 0 ? ['今日', ''] : [String(days), '日後'];
  const spoken = ongoing ? '開催中' : days === 0 ? '今日' : `あと${days}日`;
  return `<a class="home-card" href="#/home/${encodeURIComponent(e.id)}" style="--c:var(--c${e.color})" aria-label="${esc(`次の予定、${e.title}、${spoken}`)}">`
    + `<div class="home-label">${ongoing ? 'いま開催中' : '次の予定まで'}</div>`
    + `<div class="count${big[1] ? '' : ' word'}" aria-hidden="true"><b>${big[0]}</b><span>${big[1]}</span></div>`
    + `<div class="home-title">${esc(e.title)}</div>`
    + `<div class="home-sub">${shortRange(e.date, e.end)}${e.place ? `　${esc(e.place)}` : ''}</div>`
    + `<div class="home-meta"><span class="chip" style="--c:var(--c${e.color})">${esc(e.tab)}</span><span data-wx="${esc(e.id)}"></span></div></a>`;
}

export function mount(root) {
  let ctrl = new AbortController();
  setHtml(root, '<div class="scroll" id="scroll"></div>');
  const box = root.querySelector('#scroll');
  return {
    scrollEl: box,
    update(s) {
      const head = '<h1 class="view-title sr-only" tabindex="-1">ホーム</h1>';
      const gate = feedState(s, 4);
      if (gate) { setHtml(box, head + gate); return; }
      const { up } = select(s.events, 'all', s.today);
      const now = liveNow(up, s.today);
      const next = nextEvent(up, s.today);
      const first = now[0] || next;
      const rest = up.filter((e) => e !== first).slice(0, UPCOMING_MAX);
      const html = head
        + (s.fromCache && !s.online ? '<p class="status-line" role="status">圏外のため、前回読み込んだ内容を表示しています</p>' : '')
        + (first ? heroHtml(first, s.today) : '<p class="empty">これからの予定はありません</p>')
        + (rest.length ? `<div class="section-title"><h2>これからの予定</h2><a href="#/list">すべて見る</a></div>`
          + `<ul class="rows home-list">${rest.map((e) => rowHtml({ e, today: s.today, base: 'home', wx: true })).join('')}</ul>` : '')
        + '<div class="list-end"></div>';
      if (setHtml(box, html)) {
        ctrl.abort();
        ctrl = new AbortController();
        fillWeather(box, s.events, s.today, ctrl.signal);
      }
    },
    unmount() { ctrl.abort(); }
  };
}
