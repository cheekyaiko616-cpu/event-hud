// 画面の切り替え（#/home など）。開いている画面は常に1つだけで、移るときに前の画面を片付ける。
// 画面のプログラムは、初めて開くときに読み込む（最初の起動を軽くする）。
import { getState, subscribe } from '../state.js';
import { rafBatch } from '../util/dom.js';

const ROUTES = {
  home: () => import('./views/home.js'),
  list: () => import('./views/list.js'),
  deadlines: () => import('./views/deadlines.js'),
  map: () => import('./views/map.js'),
  event: () => import('./views/detail.js')
};
const TABS = ['home', 'list', 'deadlines', 'map'];

function parse(hash) {
  const [, name = 'home', arg = ''] = (hash || '').match(/^#\/([^/]*)\/?(.*)$/) || [];
  return ROUTES[name] ? { name, params: { id: decodeURIComponent(arg) } } : { name: 'home', params: {} };
}

export function startRouter({ root, nav, appName }) {
  let current = null;       // { view, unsub, name }
  let token = 0;
  let lastTab = 'home';
  let started = false;      // 最初の表示が済んだか
  const scrolls = new Map(); // 画面ごとのスクロール位置（詳細から戻ったときに戻す）

  async function go() {
    const { name, params } = parse(location.hash);
    const my = ++token;
    if (current) {
      scrolls.set(current.name, scrollY);
      current.unsub();
      current.view.unmount();
      current = null;
    }
    nav.querySelectorAll('a').forEach((a) => {
      const on = a.dataset.tab === (name === 'event' ? lastTab : name);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    let mod;
    try { mod = await ROUTES[name](); } catch {
      root.innerHTML = '<div class="status" role="alert"><b>画面を読み込めませんでした</b><p>通信を確かめて、開き直してください。</p><button class="btn" type="button" onclick="location.reload()">開き直す</button></div>';
      return;
    }
    if (my !== token) return; // 読み込み中に別の画面へ移った
    root.innerHTML = '';
    root.__html = undefined;
    const view = mod.mount(root, { params, back: `#/${lastTab}` });
    const update = rafBatch(() => view.update(getState()));
    current = { view, name, unsub: subscribe(update) };
    view.update(getState());
    if (TABS.includes(name)) lastTab = name;
    document.title = `${mod.title} | ${appName}`;
    scrollTo(0, name === 'event' ? 0 : scrolls.get(name) || 0);
    // 読み上げを使う人のために、新しい画面の見出しへ移る（最初の表示では動かさない）
    if (started) root.querySelector('h1')?.focus({ preventScroll: true });
    started = true;
  }

  addEventListener('hashchange', go);
  go();
  return {
    /** 画面が空になっていたら（他のアプリから戻ったときなど）、今の画面を描き直す。 */
    repair() {
      if (!root.firstElementChild || root.querySelector('.boot')) go();
    }
  };
}
