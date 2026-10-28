// 状態の表示（読み込み中・失敗・空）。どの画面でも同じ見た目・同じ読み上げにする。
import { esc } from '../../util/dom.js';

/** @param {{ kind: 'error'|'empty'|'offline', title: string, message?: string, action?: { label: string, act: string } }} p */
export function statusBlock({ kind, title, message = '', action }) {
  return `<div class="empty" role="${kind === 'error' ? 'alert' : 'status'}"><b>${esc(title)}</b>`
    + (message ? `<p>${esc(message)}</p>` : '')
    + (action ? `<button class="btn" type="button" data-act="${esc(action.act)}">${esc(action.label)}</button>` : '')
    + '</div>';
}

/** 読み込み中の仮の形。読み上げでは「読み込み中」とだけ伝える。 */
export function skeleton(n) {
  return `<div role="status" aria-live="polite"><span class="sr-only">読み込み中</span>${'<div class="skel" aria-hidden="true"></div>'.repeat(n)}</div>`;
}
