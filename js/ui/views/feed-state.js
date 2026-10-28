// どの画面でも共通の「まだ予定が無い」ときの表示（読み込み中・失敗）。予定があれば null。
import { skeleton, statusBlock } from '../components/status.js';

export function feedState(s, rows = 5) {
  if (s.events.length) return null;
  if (s.feedStatus === 'loading' || s.feedStatus === 'idle') return skeleton(rows);
  if (s.feedStatus === 'error') {
    return statusBlock({
      kind: s.online ? 'error' : 'offline',
      title: s.online ? '日程を読み込めませんでした' : '圏外です',
      message: s.feedError,
      action: { label: 'もう一度読み込む', act: 'refresh' }
    });
  }
  return statusBlock({ kind: 'empty', title: '予定がありません', action: { label: 'データを読み込む', act: 'data' } });
}
