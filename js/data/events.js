// 予定の一覧から、画面ごとに必要な分を取り出す。
// 並べ替えや色の割り当ては、データが変わったときに1回だけ行い、画面を描くたびにはしない。
import { daysBetween, periodRange } from '../util/date.js';

/** 自動取得の分と、バックアップから読んだ分を合わせる。同じ予定はバックアップ側（自分の分）を優先。 */
export function mergeEvents(feed, mine) {
  const byKey = new Map();
  const key = (e) => `${e.title}|${e.date}`;
  const taken = new Set(mine.map((e) => e.feedId).filter(Boolean));
  feed.forEach((e) => { if (!taken.has(e.id)) byKey.set(key(e), e); });
  mine.forEach((e) => byKey.set(key(e), e));
  const list = [...byKey.values()];
  list.sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : (a.date || '9999') > (b.date || '9999') ? 1 : a.title.localeCompare(b.title, 'ja'));
  // タブ名ごとに色を決める（出てきた順。8色で回す）
  const colors = new Map();
  list.forEach((e) => { if (!colors.has(e.tab)) colors.set(e.tab, (colors.size % 8) + 1); e.color = colors.get(e.tab); });
  return list;
}

const lastDay = (e) => e.end || e.date;

/** これから・開催中の予定（日付のあるものだけ）。days: 開始までの日数、ongoing: 開催中か。 */
export function upcoming(events, today) {
  const out = [];
  for (const e of events) {
    if (!e.date || lastDay(e) < today) continue;
    out.push({ e, days: Math.max(0, daysBetween(today, e.date)), ongoing: e.date < today });
  }
  return out;
}

/** 期間に重なる予定。 */
export function inPeriod(events, today, kind) {
  const { from, to } = periodRange(kind, today);
  return upcoming(events, today).filter(({ e }) => e.date <= to && lastDay(e) >= from);
}

/** これからの申し込み・期限（近い順）。within を指定すると、その日数以内だけ。 */
export function deadlines(events, today, within = Infinity) {
  const out = [];
  for (const e of events) {
    for (const d of e.dates) {
      if (d.date < today) continue;
      const days = daysBetween(today, d.date);
      if (days <= within) out.push({ e, d, days });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

export const findEvent = (events, id) => events.find((e) => e.id === id) || null;

/** 日程未定の予定。 */
export const undated = (events) => events.filter((e) => !e.date);
