// Event list の「バックアップ」で書き出したファイルを読み込む（自分で入力した予定を出すため）。
// 読み込んだ内容はこのアプリの保存場所にだけ置く。Event list 側のデータは変わらない。
import { KEYS } from '../config.js';
import { readStore, writeStore } from '../util/cache.js';
import { normalizeEvent } from './normalize.js';

/** ファイルの文字を確かめて、予定の一覧にする。{ ok, events, error }。 */
export function parseBackup(text) {
  let o;
  try { o = JSON.parse(text); } catch { return { ok: false, error: 'ファイルを読み込めませんでした' }; }
  if (!o || o.app !== 'event-cho' || !Array.isArray(o.events)) return { ok: false, error: 'Event list のバックアップファイルではありません' };
  const tabName = new Map((Array.isArray(o.tabs) ? o.tabs : []).map((t) => [t.id, t.name]));
  const events = o.events
    .map((e) => normalizeEvent({ ...e, tabName: tabName.get(e.type) || e.tabName }, 'mine'))
    .filter(Boolean);
  return { ok: true, events, savedAt: typeof o.savedAt === 'string' ? o.savedAt : '' };
}

export function saveBackup(events, savedAt) {
  return writeStore(KEYS.backup, { events, savedAt, importedAt: new Date().toISOString() });
}

export function loadBackup() {
  const o = readStore(KEYS.backup);
  if (!o || !Array.isArray(o.events)) return { events: [], savedAt: '' };
  return { events: o.events.map((e) => normalizeEvent(e, 'mine')).filter(Boolean), savedAt: o.savedAt || '' };
}

export function clearBackup() {
  try { localStorage.removeItem(KEYS.backup); } catch { /* なくても困らない */ }
}
