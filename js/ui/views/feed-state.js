// どの画面でも共通の「まだ予定が無い」ときの表示（読み込み中・失敗）。予定があれば null。
import { skeleton, statusBlock } from '../components/status.js';

export function feedState(s, shapes) {
  if (s.events.length) return null;
  if (s.feedStatus === 'loading' || s.feedStatus === 'idle') return skeleton(shapes);
  if (s.feedStatus === 'error') {
    return statusBlock({
      kind: s.online ? 'error' : 'offline',
      title: s.online ? '日程を読み込めませんでした' : '圏外です',
      message: s.feedError || 'しばらくしてから、もう一度お試しください。',
      action: { label: 'もう一度読み込む', act: 'refresh' }
    });
  }
  return statusBlock({ kind: 'empty', title: '予定がまだありません', message: '右上の「データ」から、Event list のバックアップも読み込めます。', action: { label: 'データを読み込む', act: 'data' } });
}
