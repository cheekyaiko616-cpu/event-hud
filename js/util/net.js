// 通信。時間がかかりすぎたら打ち切る。画面を離れたときは signal で止められる。
import { FETCH_TIMEOUT } from '../config.js';

export class NetError extends Error {
  constructor(kind, msg) { super(msg); this.kind = kind; } // kind: offline（圏外）/ network（つながらない）/ timeout / http / parse / aborted
}

export async function fetchJson(url, { signal, timeout = FETCH_TIMEOUT, headers } = {}) {
  if (navigator.onLine === false) throw new NetError('offline', '圏外のようです');
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  const timer = setTimeout(stop, timeout);
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, cache: 'no-cache' });
    if (!res.ok) throw new NetError('http', `通信エラー（${res.status}）`);
    try { return await res.json(); } catch { throw new NetError('parse', 'データの形が正しくありません'); }
  } catch (e) {
    if (e instanceof NetError) throw e;
    if (signal?.aborted) throw new NetError('aborted', '中止しました');
    if (ctrl.signal.aborted) throw new NetError('timeout', '応答がありません');
    throw new NetError('network', 'つながりませんでした');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}
