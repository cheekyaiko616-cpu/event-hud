// 「データ」の画面：Event list のバックアップ（自分で入力した予定）の読み込み・取り消し。
import { esc } from '../util/dom.js';
import { parseBackup, saveBackup, loadBackup, clearBackup } from '../data/backup.js';
import { toast } from './components/toast.js';

const SVG_CLOSE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** @param {{ onChange: () => void }} p  バックアップを読み込んだ・消したときに呼ぶ */
export function createDataSheet({ onChange }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet data';
  dlg.setAttribute('aria-labelledby', 'dataTitle');
  document.body.append(dlg);

  function render() {
    const b = loadBackup();
    dlg.innerHTML = `<div class="sheet-head"><h2 id="dataTitle">データ</h2><button class="sheet-close" type="button" data-act="close" aria-label="閉じる">${SVG_CLOSE}</button></div>`
      + '<div class="sheet-body">'
      + `<p>${b.events.length ? `Event list のバックアップを読み込み済み：${b.events.length}件${b.savedAt ? `（${esc(b.savedAt.slice(0, 10))} 書き出し）` : ''}` : 'Event list で自分で入力した予定は、バックアップのファイルを読み込むと出ます'}</p>`
      + '<label class="btn solid wide">バックアップを読み込む<input type="file" accept=".json,application/json" data-act="file"></label>'
      + (b.events.length ? '<button class="btn wide" type="button" data-act="clear">読み込んだ予定を消す</button>' : '')
      + '</div>';
  }

  dlg.addEventListener('change', async (ev) => {
    const input = ev.target.closest('[data-act="file"]');
    if (!input || !input.files[0]) return;
    const r = parseBackup(await input.files[0].text());
    if (!r.ok) { toast(r.error); return; }
    if (!saveBackup(r.events, r.savedAt)) { toast('保存できませんでした'); return; }
    toast(`${r.events.length}件の予定を読み込みました`);
    render();
    onChange();
  });
  dlg.addEventListener('click', (ev) => {
    if (ev.target === dlg) { dlg.close(); return; } // 外側を押したら閉じる
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') dlg.close();
    if (act === 'clear') { clearBackup(); toast('読み込んだ予定を消しました'); render(); onChange(); }
  });

  return { open() { render(); dlg.showModal(); } };
}
