// 「データ」の画面：日程の読み込み元の説明と、Event list のバックアップの読み込み・取り消し。
import { esc } from '../util/dom.js';
import { parseBackup, saveBackup, loadBackup, clearBackup } from '../data/backup.js';
import { toast } from './components/toast.js';

/** @param {{ onChange: () => void }} p  バックアップを読み込んだ・消したときに呼ぶ */
export function createDataSheet({ onChange }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.setAttribute('aria-labelledby', 'dataTitle');
  document.body.append(dlg);

  function render() {
    const b = loadBackup();
    dlg.innerHTML = `<h2 id="dataTitle">データ</h2>`
      + '<p>自動で集めた日程は、Event list の公開データから毎回読み込みます（読むだけで、Event list 側は変わりません）。</p>'
      + `<p>自分で入力した予定を出すには、Event list の「⚙️ → バックアップを書き出す」で保存したファイルを読み込みます。<br>`
      + (b.events.length ? `<b>読み込み済み：${b.events.length}件</b>${b.savedAt ? `（${esc(b.savedAt.slice(0, 10))} 書き出し分）` : ''}` : '未読み込み') + '</p>'
      + '<label class="btn primary">バックアップを読み込む<input type="file" accept=".json,application/json" class="sr-only" data-act="file"></label>'
      + (b.events.length ? '<button class="btn" type="button" data-act="clear">読み込んだ予定を消す</button>' : '')
      + '<button class="btn" type="button" data-act="close">閉じる</button>';
  }

  dlg.addEventListener('change', async (ev) => {
    const input = ev.target.closest('[data-act="file"]');
    if (!input || !input.files[0]) return;
    const r = parseBackup(await input.files[0].text());
    if (!r.ok) { toast(r.error); return; }
    if (!saveBackup(r.events, r.savedAt)) { toast('保存できませんでした（空き容量をご確認ください）'); return; }
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
