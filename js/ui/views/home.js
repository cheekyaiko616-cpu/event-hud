// ホーム：期限が迫るもの → 次の予定までの日数 → これからの予定。
import { setHtml } from '../../util/dom.js';
import { upcoming, deadlines } from '../../data/events.js';
import { DEADLINE_DAYS, UPCOMING_MAX } from '../../config.js';
import { countdown } from '../components/countdown.js';
import { deadlineItem } from '../components/deadline-item.js';
import { eventRows } from '../components/event-row.js';
import { feedState } from './feed-state.js';
import { fillWeather } from '../weather-fill.js';

export const title = 'ホーム';

export function mount(root) {
  let ctrl = new AbortController();
  return {
    update(s) {
      const gate = feedState(s, ['hero', 'row', 'row', 'row']);
      if (gate) { setHtml(root, `<h1 class="view-title sr-only" tabindex="-1">ホーム</h1>${gate}`); return; }
      const up = upcoming(s.events, s.today);
      const dls = deadlines(s.events, s.today, DEADLINE_DAYS).slice(0, 3);
      const [next, ...rest] = up;
      const html = '<h1 class="view-title sr-only" tabindex="-1">ホーム</h1>'
        + (s.fromCache && !s.online ? '<p class="banner" role="status">圏外のため、前回読み込んだ内容を表示しています。</p>' : '')
        + (dls.length ? `<h2 class="hud">// ALERT <small>申し込み・期限（${DEADLINE_DAYS}日以内）</small></h2>${dls.map(deadlineItem).join('')}` : '')
        + '<h2 class="hud">// NEXT EVENT</h2>'
        + (next ? countdown(next) : '<div class="card"><p class="muted">これからの予定はありません。</p></div>')
        + (rest.length ? `<h2 class="hud">// UPCOMING <small><a href="#/list">すべて見る</a></small></h2>${eventRows(rest.slice(0, UPCOMING_MAX), { wx: true })}` : '');
      if (setHtml(root, html)) {
        ctrl.abort();
        ctrl = new AbortController();
        fillWeather(root, s.events, s.today, ctrl.signal);
      }
    },
    unmount() { ctrl.abort(); }
  };
}
