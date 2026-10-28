// 予定の一覧から、画面ごとに必要な分を取り出す（Event list の一覧と同じ決まり）。
// 並べ替えや色の割り当ては、データが変わったときに1回だけ行い、画面を描くたびにはしない。
import { daysBetween, toDate } from '../util/date.js';

const KEY = (e) => `${e.title}|${e.date}`;
const dateOf = (e) => e.date || '9999-12-31';

/**
 * 自動取得の分と、バックアップから読んだ分を合わせる。同じ予定はバックアップ側（自分の分）を優先。
 * 種類（タブ）は、読み込んだ順に 1〜8 の色を割り当てる。
 * @returns {{ events: object[], tabs: { name: string, color: number }[] }}
 */
export function mergeEvents(feed, mine) {
  const byKey = new Map();
  const taken = new Set(mine.map((e) => e.feedId).filter(Boolean));
  feed.forEach((e) => { if (!taken.has(e.id)) byKey.set(KEY(e), e); });
  mine.forEach((e) => byKey.set(KEY(e), e));
  const events = [...byKey.values()];
  const tabs = [];
  const colorOf = new Map();
  events.forEach((e) => {
    if (!colorOf.has(e.tab)) { colorOf.set(e.tab, (colorOf.size % 8) + 1); tabs.push({ name: e.tab, color: colorOf.get(e.tab) }); }
    e.color = colorOf.get(e.tab);
  });
  events.sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : a.title.localeCompare(b.title, 'ja')));
  return { events, tabs };
}

export const lastDay = (e) => e.end || e.date;

/**
 * 種類で絞り込み、「これから」「過去」「日程未定」に分ける。
 * @param {string} tab  'all' か種類の名前
 */
export function select(events, tab, today) {
  const list = tab === 'all' ? events : events.filter((e) => e.tab === tab);
  const dated = list.filter((e) => e.date);
  return {
    up: dated.filter((e) => lastDay(e) >= today),
    past: dated.filter((e) => lastDay(e) < today).reverse(),
    undated: list.filter((e) => !e.date)
  };
}

/** 月の変わり目ごとにまとめる。 */
export function groupByMonth(items) {
  const out = [];
  let cur = null;
  items.forEach((e) => {
    const d = toDate(e.date);
    const key = d.getFullYear() * 100 + d.getMonth() + 1;
    if (!cur || cur.key !== key) { cur = { key, y: d.getFullYear(), m: d.getMonth() + 1, items: [] }; out.push(cur); }
    cur.items.push(e);
  });
  return out;
}

/** 開催中（今日が期間に入っている）の予定。 */
export const liveNow = (up, today) => up.filter((e) => e.date <= today);

/** 次の予定（まだ始まっていない、いちばん近いもの）。 */
export const nextEvent = (up, today) => up.find((e) => e.date > today) || null;

/** 今日以降でいちばん近い申込締切。{ e, d, days } か null。日程未定の予定も含む。 */
export function nextCloseDeadline(events, today) {
  let best = null;
  events.forEach((e) => {
    if (e.date && lastDay(e) < today) return;
    const d = e.dates.find((x) => x.kind === 'close' && x.date >= today);
    if (d && (!best || d.date < best.d.date)) best = { e, d, days: daysBetween(today, d.date) };
  });
  return best;
}

/** その予定の、今日以降でいちばん近い申し込み・期限（種類を問わない）。終わった予定には出さない。 */
export function nextDeadline(e, today) {
  if (e.date && lastDay(e) < today) return null;
  const d = e.dates.find((x) => x.date >= today);
  return d ? { ...d, days: daysBetween(today, d.date) } : null;
}

export const findEvent = (events, id) => events.find((e) => e.id === id) || null;
