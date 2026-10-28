// アプリの状態の置き場。書き換えは set だけ。変わったら、登録した画面に知らせる。
const state = {
  events: [],          // 整えたあとの予定（js/data/events.js の形）
  feedStatus: 'idle',  // idle / loading / ready / error
  feedError: '',
  feedAt: '',          // 日程を最後に読めた時刻（ISO）
  fromCache: false,    // 今の表示が、端末に残っていた分かどうか
  today: '',
  online: true
};
const subs = new Set();

export const getState = () => state;

export function set(patch) {
  let changed = false;
  for (const k in patch) if (state[k] !== patch[k]) { state[k] = patch[k]; changed = true; }
  if (changed) subs.forEach((fn) => fn(state));
}

/** 変化を受け取る。戻り値を呼ぶと止まる（画面を閉じたときに必ず呼ぶ）。 */
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
