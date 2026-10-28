// 入口：部品をつなぐだけ。日程の読み込み・日付の切り替わり・通信状態の見張りを行う。
import { APP } from './config.js';
import { set, getState, subscribe } from './state.js';
import { todayIso } from './util/date.js';
import { $ } from './util/dom.js';
import { cachedFeed, fetchFeed } from './data/feed.js';
import { loadBackup } from './data/backup.js';
import { mergeEvents } from './data/events.js';
import { startRouter } from './ui/router.js';
import { createDataSheet } from './ui/data-sheet.js';
import { createEventSheet } from './ui/event-sheet.js';
import { toast } from './ui/components/toast.js';

let feedItems = [];
let refreshing = null;

function rebuild() {
  set(mergeEvents(feedItems, loadBackup().events)); // { events, tabs }
}

/** 日程を読み込む。端末に残っている分を先に出し、新しければそのまま、古ければ裏で取りに行く。 */
async function refresh({ force = false } = {}) {
  if (refreshing) return refreshing;
  const c = cachedFeed();
  if (c && !feedItems.length) { feedItems = c.items; set({ feedAt: c.at, fromCache: true }); rebuild(); }
  if (c && c.fresh && !force) { set({ feedStatus: 'ready' }); return null; }
  set({ feedStatus: 'loading' });
  refreshing = (async () => {
    try {
      const r = await fetchFeed();
      feedItems = r.items;
      set({ feedStatus: 'ready', feedAt: r.at, fromCache: false, feedError: '' });
      rebuild();
    } catch (e) {
      // 見本データ（動作確認用の1枚のHTMLにだけ入っている）
      if (!feedItems.length && window.__HUD_SAMPLE__) {
        feedItems = (await import('./data/normalize.js')).normalizeFeedSample(window.__HUD_SAMPLE__);
        set({ feedStatus: 'ready', feedAt: '', fromCache: true, feedError: '' });
        rebuild();
        toast('見本データで表示しています');
      } else {
        set({ feedStatus: feedItems.length ? 'ready' : 'error', feedError: e.message });
        if (force) toast(`更新できませんでした：${e.message}`);
      }
    } finally { refreshing = null; }
  })();
  return refreshing;
}

/** 上の帯の「◯時◯分 更新」。 */
function renderChrome(s) {
  const el = $('#sync');
  const t = s.feedAt ? new Date(s.feedAt) : null;
  const when = t ? `${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}` : '';
  el.textContent = !s.online ? `オフライン${when ? `・${when}時点` : ''}` : s.feedStatus === 'loading' ? '更新中…' : when ? `${when} 更新` : (window.__HUD_SAMPLE__ ? '見本データ' : '');
  el.classList.toggle('warn', !s.online || s.feedStatus === 'error');
  $('#refresh').setAttribute('aria-busy', String(s.feedStatus === 'loading'));
}

/** 日付が変わったら（夜0時・アプリに戻ったとき）、「あと◯日」を直す。 */
function watchToday() {
  const check = () => { const t = todayIso(); if (t !== getState().today) set({ today: t }); };
  const schedule = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    setTimeout(() => { check(); schedule(); }, next - now);
  };
  check();
  schedule();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    check();
    refresh(); // 新しさを確かめ、古ければ取りに行く
  });
}

function start() {
  set({ online: navigator.onLine !== false, today: todayIso() });
  addEventListener('online', () => { set({ online: true }); refresh(); });
  addEventListener('offline', () => set({ online: false }));
  subscribe(renderChrome);

  const data = createDataSheet({ onChange: rebuild });
  $('#refresh').addEventListener('click', () => refresh({ force: true }));
  $('#dataBtn').addEventListener('click', () => data.open());
  // 画面の中の「もう一度読み込む」「データを読み込む」
  $('#view').addEventListener('click', (ev) => {
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'refresh') refresh({ force: true });
    if (act === 'data') data.open();
  });

  watchToday();
  // 予定の詳細：開いている予定は URL の # に入る。閉じたら、# を元の画面に戻す（履歴は増やさない）
  const sheet = createEventSheet({
    getState,
    onClose: () => { const name = (location.hash.match(/^#\/([^/]*)/) || [, 'home'])[1]; history.replaceState(null, '', `#/${name}`); }
  });
  subscribe(() => sheet.update());
  const router = startRouter({ root: $('#view'), nav: $('#nav'), appName: APP.name, sheet });
  renderChrome(getState());
  refresh();
  watchResume(router);
  startServiceWorker();
}

/**
 * 他のアプリから戻ったとき：画面が空になっていたら描き直す。
 * （iPhone は裏にいる間にアプリの中身を捨てることがある。戻ってきたら必ず中身があるようにする）
 */
function watchResume(router) {
  const check = () => { if (document.visibilityState === 'visible') router.repair(); };
  addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', check);
  addEventListener('focus', check);
}

/**
 * オフライン用の仕組み（sw.js）。新しい版に切り替わったら、新旧のプログラムが混ざらないよう、すぐに読み込み直す。
 * （画面の場所は URL の # に入っているので、読み込み直しても同じ画面に戻る）
 */
function startServiceWorker() {
  if (!('serviceWorker' in navigator) || !isSecureContext) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
  navigator.serviceWorker.addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'reload') reload(); });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reload(); }); // 初めて入ったときは、そのままでよい
  navigator.serviceWorker.register('sw.js').catch(() => { /* なくても動く */ });
}

start();
