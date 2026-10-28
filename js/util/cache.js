// 端末内の小さな保存（期限つき）と、同じ問い合わせの重複をまとめる仕組み。
// 保存できない環境（プライベートブラウズなど）でも、エラーにせず通信だけで動く。

export function readStore(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/**
 * 名前ごとに値を覚えておく箱。localStorage には1つのキーでまとめて保存する。
 * max を超えたら古いものから捨てるので、使い続けても大きくなりすぎない。
 */
export function createCache(storeKey, { ttl, max = 100 }) {
  let map = null;
  const inflight = new Map();
  const load = () => { if (!map) { const o = readStore(storeKey); map = new Map(o ? Object.entries(o) : []); } return map; };
  const persist = () => {
    const m = load();
    while (m.size > max) m.delete(m.keys().next().value);
    writeStore(storeKey, Object.fromEntries(m));
  };
  return {
    get(k) {
      const hit = load().get(k);
      return hit && Date.now() - hit.at < ttl ? hit.v : undefined;
    },
    set(k, v) { const m = load(); m.delete(k); m.set(k, { at: Date.now(), v }); persist(); },
    /** 覚えていればそれを、無ければ fn を1回だけ呼ぶ（同時に頼まれても通信は1回）。 */
    async through(k, fn) {
      const v = this.get(k);
      if (v !== undefined) return v;
      if (inflight.has(k)) return inflight.get(k);
      const p = (async () => { try { const r = await fn(); if (r !== undefined) this.set(k, r); return r; } finally { inflight.delete(k); } })();
      inflight.set(k, p);
      return p;
    }
  };
}
