// 期限：これからの申し込み・締切・入金などを、近い順に「3日以内／2週間以内／それ以降」で分けて出す。
import { setHtml } from '../../util/dom.js';
import { deadlines } from '../../data/events.js';
import { deadlineItem, URGENT_DAYS } from '../components/deadline-item.js';
import { statusBlock } from '../components/status.js';
import { feedState } from './feed-state.js';

export const title = '期限';

export function mount(root) {
  return {
    update(s) {
      const head = '<h1 class="view-title" tabindex="-1">申し込み・期限</h1>';
      const gate = feedState(s, ['row', 'row', 'row']);
      if (gate) { setHtml(root, head + gate); return; }
      const all = deadlines(s.events, s.today);
      if (!all.length) { setHtml(root, head + statusBlock({ kind: 'empty', title: 'これからの期限はありません', message: '申し込み開始や締切の日付がある予定が、ここに並びます。' })); return; }
      const groups = [
        [`${URGENT_DAYS}日以内`, all.filter((x) => x.days <= URGENT_DAYS)],
        ['2週間以内', all.filter((x) => x.days > URGENT_DAYS && x.days <= 14)],
        ['それ以降', all.filter((x) => x.days > 14)]
      ].filter(([, l]) => l.length);
      setHtml(root, head + groups.map(([t, l]) => `<h2 class="hud">// ${t} <small>${l.length}件</small></h2>${l.map(deadlineItem).join('')}`).join(''));
    },
    unmount() {}
  };
}
