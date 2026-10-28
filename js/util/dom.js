// 画面づくりの小さな道具。文字は必ず esc を通してから HTML に入れる。
const MAP_ = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP_[c]);

/** http/https 以外の URL は使わない。 */
export function safeUrl(u) {
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : ''; } catch { return ''; }
}

export const $ = (sel, root = document) => root.querySelector(sel);

/** 中身が変わったときだけ書き換える（同じ内容での描き直しを省く）。 */
export function setHtml(el, html) {
  if (el.__html === html) return false;
  el.__html = html;
  el.innerHTML = html;
  return true;
}

/** 同じフレーム内の複数の描き直し依頼を1回にまとめる。 */
export function rafBatch(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  };
}

