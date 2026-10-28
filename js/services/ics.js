// カレンダー用ファイル（.ics）の中身を作る。Event list の js/services/ics.js と同じ書き方（終日予定・前日のお知らせ）。
import { CAL_ALERT, DATE_KINDS } from '../config.js';
import { addDays } from '../util/date.js';

const enc = new TextEncoder();
const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (iso) => iso.replace(/-/g, '');
const p2 = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;

/** 1行75バイトまで。日本語の文字は途中で切らない。 */
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

function vevent(uid, start, endIncl, title, e, now) {
  const lines = ['BEGIN:VEVENT', `UID:${uid}@event-hud`, `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${compact(start)}`, `DTEND;VALUE=DATE:${compact(addDays(endIncl, 1))}`, `SUMMARY:${escapeText(title)}`];
  if (e.place) lines.push(`LOCATION:${escapeText(e.place)}`);
  const desc = [e.source && `出典: ${e.source}`, e.note].filter(Boolean).join('\n');
  if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(title)}`, `TRIGGER:${CAL_ALERT}`, 'END:VALARM', 'END:VEVENT');
  return lines;
}

/** 予定1件（＋申し込みなどの日付）を .ics の文字にする。 */
export function buildIcs(e, { withDates = true, now = new Date() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//event-hud//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (e.date) lines.push(...vevent(e.id, e.date, e.end || e.date, e.title, e, now));
  if (withDates) e.dates.forEach((d, i) => lines.push(...vevent(`${e.id}-d${i}`, d.date, d.date, `【${DATE_KINDS[d.kind]}】${e.title}`, e, now)));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
