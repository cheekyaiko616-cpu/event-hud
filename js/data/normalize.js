// 読み込んだ日程を、この画面で使う1つの形に整える。ここを通ったものだけを画面に出す。
import { isDate } from '../util/date.js';
import { DATE_KINDS } from '../config.js';
import { safeUrl } from '../util/dom.js';

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanDates(list) {
  return (Array.isArray(list) ? list : [])
    .filter((d) => d && isDate(d.date))
    .map((d) => ({ kind: DATE_KINDS[d.kind] ? d.kind : 'other', date: d.date, note: str(d.note, 60) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * 1件の予定。
 * { id, title, tab, date, end, place, url, source, note, dates[], feedId, origin: 'feed' | 'mine' }
 * date が空の予定（日程未定）も残す。end は必ず date 以上か空。
 */
export function normalizeEvent(raw, origin) {
  if (!raw || typeof raw !== 'object') return null;
  const id = str(raw.id, 100);
  const title = str(raw.title, 120);
  if (!id || !title) return null;
  const date = isDate(raw.date) ? raw.date : '';
  const end = date && isDate(raw.end) && raw.end > date ? raw.end : '';
  return {
    id, title, date, end,
    tab: str(raw.tabName ?? raw.tab, 30) || 'その他',
    place: str(raw.place, 120),
    url: safeUrl(raw.url || ''),
    source: str(raw.source, 200),
    note: str(raw.note, 600),
    dates: cleanDates(raw.dates),
    feedId: str(raw.feedId, 100), // Event list に取り込まれた自動取得の予定は、元の id を持っている
    origin
  };
}

/** 動作確認用の見本（feed.json と同じ形）を整える。 */
export const normalizeFeedSample = (obj) => (Array.isArray(obj?.items) ? obj.items : []).map((x) => normalizeEvent(x, 'feed')).filter(Boolean);
