// 種類で絞り込むタブ（「すべて」＋ 種類ごと。Event list と同じフォルダ形）。
import { esc } from '../../util/dom.js';

/** タブの並び（先頭は「すべて」）。 */
export const tabIds = (tabs) => ['all', ...tabs.map((t) => t.name)];

/** @param {{ tabs: {name: string, color: number}[], value: string }} p */
export function tabsHtml({ tabs, value }) {
  const items = [{ id: 'all', name: 'すべて', color: 'var(--fg)' }, ...tabs.map((t) => ({ id: t.name, name: t.name, color: `var(--c${t.color})` }))];
  return '<div class="tabs" id="tabs"><div class="tabs-in" role="tablist" aria-label="種類で絞り込み">'
    + items.map((x) => `<button class="${x.id === 'all' ? 'tab tab-all' : 'tab'}" type="button" role="tab" data-tab="${esc(x.id)}" style="--c:${x.color}" aria-selected="${x.id === value}" tabindex="${x.id === value ? 0 : -1}">${esc(x.name)}</button>`).join('')
    + '</div></div>';
}

/** 押されたら onChange(id)。左右キーで隣へ。戻り値で解除。 */
export function bindTabs(root, onChange) {
  const click = (ev) => { const b = ev.target.closest('.tab'); if (b && b.getAttribute('aria-selected') !== 'true') onChange(b.dataset.tab); };
  const key = (ev) => {
    const b = ev.target.closest('.tab');
    if (!b || (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft')) return;
    const s = ev.key === 'ArrowRight' ? b.nextElementSibling : b.previousElementSibling;
    if (s) { s.focus(); onChange(s.dataset.tab); }
  };
  root.addEventListener('click', click);
  root.addEventListener('keydown', key);
  return () => { root.removeEventListener('click', click); root.removeEventListener('keydown', key); };
}

/** 選んだタブの印だけを付け替え、見える位置までスクロールする（左に固定した「すべて」の幅は除く）。 */
export function selectTab(root, id) {
  const scroller = root.querySelector('.tabs');
  if (!scroller) return;
  let sel = null;
  root.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on) sel = b;
  });
  const all = root.querySelector('.tab-all');
  const stickyW = all ? all.offsetWidth + 4 : 0;
  if (!sel || sel === all) { scroller.scrollLeft = 0; return; }
  if (sel.offsetLeft - stickyW < scroller.scrollLeft) scroller.scrollLeft = Math.max(0, sel.offsetLeft - stickyW - 8);
  else if (sel.offsetLeft + sel.offsetWidth > scroller.scrollLeft + scroller.clientWidth - 8) scroller.scrollLeft = sel.offsetLeft + sel.offsetWidth - scroller.clientWidth + 16;
}
