// Event list の自動取得の日程（feed.json）を読む。読むだけで、どこにも書き戻さない。
// 先に端末に残っている分を出し、裏で新しい分を取りに行く（待たずに画面が出る）。
import { FEED_URLS, KEYS, TTL } from '../config.js';
import { fetchJson, NetError } from '../util/net.js';
import { readStore, writeStore } from '../util/cache.js';
import { normalizeEvent } from './normalize.js';

function parseFeed(obj) {
  if (!obj || !Array.isArray(obj.items)) throw new NetError('parse', '日程ファイルの形が正しくありません');
  return obj.items.map((x) => normalizeEvent(x, 'feed')).filter(Boolean);
}

/** 端末に残っている分。{ items, at } か null。 */
export function cachedFeed() {
  const c = readStore(KEYS.feed);
  if (!c || !Array.isArray(c.items)) return null;
  return { items: c.items.map((x) => normalizeEvent(x, 'feed')).filter(Boolean), at: c.at, fresh: Date.now() - Date.parse(c.at) < TTL.feed };
}

/** 新しい分を取りに行く。最初の接続先がだめなら次を試す。 */
export async function fetchFeed({ signal } = {}) {
  let last;
  for (const url of FEED_URLS) {
    try {
      const obj = await fetchJson(url, { signal });
      const items = parseFeed(obj);
      const at = new Date().toISOString();
      writeStore(KEYS.feed, { at, items: obj.items });
      return { items, at };
    } catch (e) {
      if (e.kind === 'aborted' || e.kind === 'offline') throw e;
      last = e;
    }
  }
  throw last;
}
