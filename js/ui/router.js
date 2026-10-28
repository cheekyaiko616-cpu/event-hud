// 画面の切り替え（#/home・#/list）と、予定の詳細（#/list/予定のid）。
// 開いている画面は常に1つ。移るときに前の画面を片付ける。画面のプログラムは、初めて開くときに読み込む。
import { getState, subscribe } from '../state.js';
import { rafBatch } from '../util/dom.js';

const ROUTES = {
  home: () => import('./views/home.js'),
  list: () => import('./views/list.js')
};

/** '#/list/abc' → { name: 'list', id: 'abc' }。知らない名前や、昔の形（#/event/…）は、近い画面へ寄せる。 */
export function parseHash(hash) {
  const m = /^#\/([^/]*)\/?(.*)$/.exec(hash || '');
  let name = m ? m[1] : 'home';
  let id = m && m[2] ? decodeURIComponent(m[2]) : '';
  if (name === 'event') name = 'list';
  if (!ROUTES[name]) { name = 'home'; id = ''; }
  return { name, id };
}

/**
 * @param {{ root: HTMLElement, nav: HTMLElement, appName: string, sheet: { show(id: string): void, hide(): void } }} p
 */
export function startRouter({ root, nav, appName, sheet }) {
  let current = null;       // { view, unsub, name }
  let token = 0;
  let started = false;
  const scrolls = new Map(); // 画面ごとのスクロール位置

  async function go() {
    const { name, id } = parseHash(location.hash);
    if (current && current.name === name) { // 同じ画面のまま、詳細だけ開く・閉じる
      id ? sheet.show(id) : sheet.hide();
      return;
    }
    const my = ++token;
    if (current) {
      if (current.view.scrollEl) scrolls.set(current.name, current.view.scrollEl.scrollTop);
      current.unsub();
      current.view.unmount();
      current = null;
    }
    nav.querySelectorAll('a').forEach((a) => {
      if (a.dataset.tab === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    let mod;
    try { mod = await ROUTES[name](); } catch {
      root.innerHTML = '<div class="empty" role="alert"><b>画面を読み込めませんでした</b><p>通信を確かめて、開き直してください</p><button class="btn" type="button" onclick="location.reload()">開き直す</button></div>';
      return;
    }
    if (my !== token) return; // 読み込み中に別の画面へ移った
    root.innerHTML = '';
    root.__html = undefined;
    const view = mod.mount(root);
    const update = rafBatch(() => view.update(getState()));
    current = { view, name, unsub: subscribe(update) };
    view.update(getState());
    if (view.scrollEl) view.scrollEl.scrollTop = scrolls.get(name) || 0;
    document.title = `${mod.title} | ${appName}`;
    if (started) root.querySelector('h1')?.focus({ preventScroll: true }); // 読み上げを使う人のために、新しい画面の見出しへ
    started = true;
    id ? sheet.show(id) : sheet.hide();
  }

  addEventListener('hashchange', go);
  go();
  return {
    /** 画面が空になっていたら（他のアプリから戻ったときなど）、今の画面を描き直す。 */
    repair() {
      if (!root.firstElementChild) { current = null; go(); }
    }
  };
}
