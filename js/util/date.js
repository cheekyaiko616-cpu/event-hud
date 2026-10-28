// 日付の計算と表示。日付は 'YYYY-MM-DD' の文字列で持ち、比べるときも文字のまま比べる。
import { WEEKDAYS } from '../config.js';

const pad = (n) => (n < 10 ? '0' : '') + n;
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 実在する日付なら Date（その日の0時）、それ以外は null。 */
export function toDate(iso) {
  const m = RE.exec(iso || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}
export const isDate = (iso) => toDate(iso) !== null;
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => toIso(new Date());

export function addDays(iso, n) {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** a から b までの日数（同じ日なら0）。夏時間のずれは丸めて消す。 */
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

export const weekday = (iso) => WEEKDAYS[toDate(iso).getDay()];
export const md = (iso) => { const d = toDate(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };

/** 一覧向けの短い期間表示：11/6(金)〜11/8(日) */
export function shortRange(start, end) {
  const a = `${md(start)}(${weekday(start)})`;
  return end && end !== start ? `${a}〜${md(end)}(${weekday(end)})` : a;
}

/** 詳細向けの期間表示：2026年11月6日(金)〜8日(日) */
export function longRange(start, end) {
  const a = toDate(start);
  const head = `${a.getFullYear()}年${a.getMonth() + 1}月${a.getDate()}日(${weekday(start)})`;
  if (!end || end === start) return head;
  const b = toDate(end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${head}〜${b.getDate()}日(${weekday(end)})`;
  return `${head}〜${b.getFullYear()}年${b.getMonth() + 1}月${b.getDate()}日(${weekday(end)})`;
}

/** 「今週末」「今月」「来月」の始まりと終わり（どちらも含む）。 */
export function periodRange(kind, today) {
  const t = toDate(today);
  if (kind === 'weekend') {
    const dow = t.getDay(); // 日曜は、その日だけを今週末とする
    const sat = dow === 0 ? -1 : 6 - dow;
    return { from: dow === 0 ? today : addDays(today, Math.max(0, sat)), to: addDays(today, dow === 0 ? 0 : sat + 1) };
  }
  const y = t.getFullYear(), m = t.getMonth() + (kind === 'next' ? 1 : 0);
  return { from: toIso(new Date(y, m, 1)), to: toIso(new Date(y, m + 1, 0)) };
}

/** 「あと◯日」の文言。開催中・今日・明日も扱う。 */
export function countdownLabel(days, ongoing) {
  if (ongoing) return '開催中';
  if (days === 0) return '今日';
  if (days === 1) return '明日';
  return `あと${days}日`;
}
