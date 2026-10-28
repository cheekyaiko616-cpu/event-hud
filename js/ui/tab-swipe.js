// 一覧の上で左右にスワイプしたら、種類のタブを切り替える（左へ＝次のタブ、右へ＝前のタブ）。Event list と同じ動き。
// 指に合わせて今の画面が動き、動いた先に隣のタブの画面が続いて見える。十分に動かして離すと切り替わり、足りなければ元へ戻る。
// 上のタブの帯は固定のまま。動くのは「帯（開催中など）」と「一覧」だけ。
const EDGE = 24;   // 画面の左端から始めたスワイプは、ブラウザの「戻る」用なので対象外
const LOCK = 10;   // 横の動きと決める最小の距離（px）
const GIVE = 0.2;  // 端のタブで、それ以上進めないときに指についてくる割合
const MS = 200;
const EASE = 'cubic-bezier(.2, .7, .2, 1)';

/**
 * @param {{ area: HTMLElement, now: HTMLElement, ids: () => string[], current: () => string,
 *           go: (id: string) => void, ghost: (id: string) => { now: string, list: string } }} p
 * @returns {() => void} 解除
 */
export function initTabSwipe({ area, now, ids, current, go, ghost: buildGhost }) {
  let x0 = 0, y0 = 0, t0 = 0, mode = 'idle'; // idle / wait / h / v / anim
  let ghost = null, ghostDir = 0;            // 隣のタブの仮の画面と、その向き（+1 次 / -1 前）
  let timer = 0;

  const neighbor = (dir) => {
    const list = ids();
    const j = list.indexOf(current()) + dir;
    return j >= 0 && j < list.length ? list[j] : null;
  };
  const movers = () => [now, area];
  const setX = (x, ms) => movers().forEach((m) => {
    m.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none';
    m.style.transform = x ? `translateX(${x}px)` : '';
  });
  const clearStyle = () => movers().forEach((m) => { m.style.transform = ''; m.style.transition = ''; });
  const W = () => area.clientWidth || window.innerWidth;

  function dropGhost() { if (ghost) ghost.remove(); ghost = null; ghostDir = 0; }

  function makeGhost(dir) {
    dropGhost();
    const id = neighbor(dir);
    if (!id) return;
    const html = buildGhost(id);
    const top = (now.offsetHeight ? now : area).getBoundingClientRect().top;
    const bottom = area.getBoundingClientRect().bottom;
    ghost = document.createElement('div');
    ghost.className = 'swipe-ghost';
    ghost.style.cssText = `top:${top}px;height:${bottom - top}px`;
    ghost.innerHTML = `<div class="ghost-now">${html.now}</div><div class="ghost-list">${html.list}</div>`;
    document.body.append(ghost);
    ghostDir = dir;
  }
  const setGhostX = (x, ms) => {
    if (!ghost) return;
    ghost.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none';
    ghost.style.transform = `translateX(${x}px)`;
  };

  const start = (ev) => {
    if (mode === 'anim') return;
    const t = ev.touches[0];
    if (ev.touches.length !== 1 || t.clientX <= EDGE) { mode = 'idle'; return; }
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); mode = 'wait';
  };
  const move = (ev) => {
    if (mode !== 'wait' && mode !== 'h') return;
    const t = ev.touches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (mode === 'wait') {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.4) { mode = 'h'; area.style.overflowY = 'hidden'; } else { mode = 'v'; return; }
    }
    const dir = dx < 0 ? 1 : -1;
    if (dx !== 0 && ghostDir !== dir) makeGhost(dir); // 向きが変わったら、その向きの隣を用意する
    const m = ghost ? dx : dx * GIVE;
    setX(m);
    if (ghost) setGhostX(m + dir * W());
  };
  const settle = () => { clearStyle(); area.style.overflowY = ''; dropGhost(); mode = 'idle'; };
  const finish = (ev) => {
    if (mode !== 'h') { if (mode !== 'anim') mode = 'idle'; return; }
    const dx = ev.changedTouches[0].clientX - x0;
    const w = W();
    const dir = dx < 0 ? 1 : -1;
    const fast = Math.abs(dx) > 40 && Math.abs(dx) / Math.max(1, Date.now() - t0) > 0.5;
    const to = ghost && ghostDir === dir ? neighbor(dir) : null;
    mode = 'anim';
    if (!to || !(Math.abs(dx) > w * 0.25 || fast)) { // 元へ戻る
      setX(0, MS);
      if (ghost) setGhostX(dir * w, MS);
      timer = setTimeout(settle, MS + 20);
      return;
    }
    // 切り替える：今の画面を外へ、隣の画面を所定の位置へ。終わったら本物の画面に入れ替える
    setX(-dir * w, MS);
    setGhostX(0, MS);
    timer = setTimeout(() => {
      clearStyle();
      go(to);
      area.scrollTop = 0;
      area.style.overflowY = '';
      dropGhost();
      mode = 'idle';
    }, MS + 10);
  };
  const cancel = () => { if (mode === 'h') settle(); else if (mode !== 'anim') mode = 'idle'; };

  area.addEventListener('touchstart', start, { passive: true });
  area.addEventListener('touchmove', move, { passive: true });
  area.addEventListener('touchend', finish, { passive: true });
  area.addEventListener('touchcancel', cancel, { passive: true });
  return () => {
    clearTimeout(timer);
    area.removeEventListener('touchstart', start); area.removeEventListener('touchmove', move);
    area.removeEventListener('touchend', finish); area.removeEventListener('touchcancel', cancel);
    settle();
  };
}
