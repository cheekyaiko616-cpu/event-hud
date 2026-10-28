// 状態の表示（読み込み中・失敗・空）。どの画面でも同じ見た目・同じ読み上げにする。
import { esc } from '../../util/dom.js';

/**
 * @param {{ kind: 'error'|'empty'|'offline', title: string, message?: string, action?: { label: string, act: string } }} p
 * action.act は押されたときに data-act として画面に渡る名前。
 */
export function statusBlock({ kind, title, message = '', action }) {
  const icon = { error: '⚠', empty: '◌', offline: '⌁' }[kind] || '◌';
  const role = kind === 'error' ? 'alert' : 'status';
  return `<div class="status" role="${role}"><span class="ic" aria-hidden="true">${icon}</span><b>${esc(title)}</b>`
    + (message ? `<p>${esc(message)}</p>` : '')
    + (action ? `<button class="btn" type="button" data-act="${esc(action.act)}">${esc(action.label)}</button>` : '')
    + '</div>';
}

/** 読み込み中の仮の形。shape: 'hero' | 'row'。読み上げでは「読み込み中」とだけ伝える。 */
export function skeleton(shapes) {
  return `<div role="status" aria-live="polite"><span class="sr-only">読み込み中</span>`
    + shapes.map((s) => `<div class="skel${s === 'hero' ? ' big' : ''}" aria-hidden="true"></div>`).join('') + '</div>';
}
