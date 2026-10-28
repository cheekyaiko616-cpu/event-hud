// 切り替えボタン（今週末・今月…）。押された方に aria-pressed を付け、左右キーでも動かせる。
import { esc } from '../../util/dom.js';

/** @param {{ name: string, label: string, options: {value: string, label: string}[], value: string }} p */
export function segmented({ name, label, options, value }) {
  return `<div class="seg" role="group" aria-label="${esc(label)}" data-seg="${esc(name)}">`
    + options.map((o) => `<button type="button" data-value="${esc(o.value)}" aria-pressed="${o.value === value}">${esc(o.label)}</button>`).join('')
    + '</div>';
}

/** 押されたら onChange(値)。左右キーで隣へ。戻り値で解除。 */
export function bindSegmented(root, name, onChange) {
  const sel = `[data-seg="${name}"]`;
  const click = (ev) => {
    const b = ev.target.closest(`${sel} button`);
    if (b && b.getAttribute('aria-pressed') !== 'true') onChange(b.dataset.value);
  };
  const key = (ev) => {
    const b = ev.target.closest(`${sel} button`);
    if (!b || (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft')) return;
    const sib = ev.key === 'ArrowRight' ? b.nextElementSibling : b.previousElementSibling;
    if (sib) { sib.focus(); onChange(sib.dataset.value); }
  };
  root.addEventListener('click', click);
  root.addEventListener('keydown', key);
  return () => { root.removeEventListener('click', click); root.removeEventListener('keydown', key); };
}
