// 種類で絞り込むタブ（「すべて」＋ 種類ごと。Event list と同じフォルダ形）。
import { esc } from '../../util/dom.js';

/** @param {{ tabs: {name: string, color: number}[], value: string }} p */
export function tabsHtml({ tabs, value }) {
  const items = [{ id: 'all', name: 'すべて', color: 'var(--fg)' }, ...tabs.map((t) => ({ id: t.name, name: t.name, color: `var(--c${t.color})` }))];
  return '<div class="tabs" id="tabs"><div class="tabs-in" role="tablist" aria-label="種類で絞り込み">'
    + items.map((x) => `<button class="tab" type="button" role="tab" data-tab="${esc(x.id)}" style="--c:${x.color}" aria-selected="${x.id === value}">${esc(x.name)}</button>`).join('')
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
