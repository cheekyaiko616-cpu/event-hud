// iPhone 標準カレンダーへの追加。Event list と同じく、.ics を見えない枠で開いて登録画面を出す。
// ※ ボタンを押した直後に呼ぶこと（時間をおくと iPhone が開かせてくれない）。
import { buildIcs } from './ics.js';

export function addToCalendar(e) {
  const url = URL.createObjectURL(new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' }));
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
  f.setAttribute('aria-hidden', 'true');
  f.src = url;
  document.body.append(f);
  setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 60000); // 使い終わった分は必ず片付ける
}
