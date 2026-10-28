// 予定の詳細（下から出る画面）：日程・申し込み・天気・行き方（乗り換え／ナビ／マップ）・カレンダー追加。
// 開いている予定は URL の # に入る（#/list/予定のid）。他のアプリへ移って戻ったときに読み込み直されても、同じ画面に戻れる。
// 外のアプリ・サイトは、必ず普通のリンク（<a>）で開く。window.open は、iPhone のホーム画面アプリで戻ったときに白い画面になる。
import { esc, setHtml } from '../util/dom.js';
import { readStore, writeStore } from '../util/cache.js';
import { longRange, md, weekday, daysBetween, countdownLabel } from '../util/date.js';
import { isDomestic } from '../util/geo-math.js';
import { DATE_KINDS, DEADLINE_SOON, KEYS, TRANSIT } from '../config.js';
import { findEvent } from '../data/events.js';
import { knownPlace, locate } from '../services/geo.js';
import { forecast, forecastable } from '../services/weather.js';
import { currentPosition } from '../services/location.js';
import { nearbyStations, cleanStationName } from '../services/stations.js';
import { yahooTransitUrl, yahooCarNaviUrl, appleMapsUrl, whenLabel } from '../services/transit-links.js';
import { addToCalendar } from '../services/calendar.js';
import { segmented, bindSegmented } from './components/segmented.js';
import { weatherStrip } from './components/weather.js';
import { statusBlock, skeleton } from './components/status.js';
import { toast } from './components/toast.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);
const SVG_CLOSE = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/** 予定ごとに、前回の乗り換えの日時を覚えておく（読み込み直されても残る）。最大20件。 */
const queries = {
  get: (id) => (readStore(KEYS.query) || {})[id] || null,
  set(id, q) {
    const all = readStore(KEYS.query) || {};
    delete all[id];
    all[id] = q;
    const ids = Object.keys(all);
    ids.slice(0, Math.max(0, ids.length - 20)).forEach((k) => delete all[k]);
    writeStore(KEYS.query, all);
  }
};

function infoHtml(e, today) {
  const end = e.end || e.date;
  const status = !e.date ? '日程未定' : end < today ? '終了しました' : countdownLabel(Math.max(0, daysBetween(today, e.date)), e.date < today);
  let rows = `<dt>日程</dt><dd>${e.date ? longRange(e.date, e.end) : '未定（公式発表待ち）'}</dd><dt>状況</dt><dd>${status}</dd>`;
  e.dates.forEach((d) => {
    const days = daysBetween(today, d.date);
    rows += `<dt>${esc(DATE_KINDS[d.kind])}</dt><dd class="${days < 0 ? 'done' : days <= DEADLINE_SOON ? 'soon' : ''}">${md(d.date)}(${weekday(d.date)})${d.note ? `　${esc(d.note)}` : ''}${days < 0 ? '（終了）' : days === 0 ? '（今日）' : days === 1 ? '（明日）' : ''}</dd>`;
  });
  if (e.place) rows += `<dt>場所</dt><dd>${esc(e.place)}</dd>`;
  if (e.source) rows += `<dt>出典</dt><dd>${esc(e.source)}</dd>`;
  if (e.note) rows += `<dt>メモ</dt><dd>${esc(e.note)}</dd>`;
  return `<div class="panel"><dl class="kv">${rows}</dl></div>`;
}

/** 「行き方」の枠（中身は位置が分かってから入る）。 */
const accessShell = '<section class="sec" id="accessSec" hidden><h3>行き方</h3><div class="panel" id="access"></div></section>';

function accessHtml({ e, pos, today }) {
  const dest = pos.station || '';
  const q = queries.get(e.id) || {};
  const date = DATE_RE.test(q.date || '') && q.date >= today ? q.date : (e.date && e.date >= today ? e.date : today);
  const from = q.from ?? readStore(KEYS.origin) ?? '';
  const arrive = q.arrive ?? true;
  const links = `<div class="btn-row links"><a class="btn" data-link="carnavi" href="${yahooCarNaviUrl({ dest: pos, label: pos.name || e.place })}">Yahoo!カーナビ</a>`
    + `<a class="btn" data-link="map" href="${appleMapsUrl(pos, e.place)}" target="_blank" rel="noopener">マップで開く</a></div>`;
  if (!isDomestic(pos)) return `<div class="btn-col"><a class="btn" data-link="map" href="${appleMapsUrl(pos, e.place)}" target="_blank" rel="noopener">マップで開く</a></div>`;
  return `<form class="tform" novalidate>`
    + `<div class="input-row"><div class="field"><label for="tFrom">出発駅</label><input id="tFrom" name="from" type="text" autocomplete="off" enterkeyhint="next" placeholder="例）新宿" value="${esc(from)}"></div>`
    + `<button class="btn" type="button" data-act="near-me">現在地</button></div>`
    + `<div class="chips" id="fromChips"></div>`
    + `<div class="field"><label for="tTo">到着駅</label><input id="tTo" name="to" type="text" autocomplete="off" enterkeyhint="done" placeholder="例）御殿場" value="${esc(dest)}"></div>`
    + `<div class="chips" id="toChips"></div>`
    + `<div class="field-row"><div class="field"><label for="tDate">日付</label><input id="tDate" name="date" type="date" min="${today}" value="${date}"></div>`
    + `<div class="field"><label for="tTime">時刻</label><input id="tTime" name="time" type="time" value="${esc(q.time || TRANSIT.defaultTime)}"></div></div>`
    + segmented({ name: 'when', label: '時刻の意味', options: [{ value: 'arrive', label: '到着' }, { value: 'depart', label: '出発' }], value: arrive ? 'arrive' : 'depart' })
    + '<p class="err" id="tErr" role="alert"></p>'
    + '<a class="btn solid wide" data-link="yahoo" target="_blank" rel="noopener" href="#"><span>Yahoo!乗換案内で検索<small id="tWhen"></small></span></a>'
    + '</form>' + links;
}

/**
 * 詳細の画面を作る。
 * @param {{ getState: () => object, onClose: () => void }} p
 *   onClose：×・外側・Escape で閉じられたときに呼ぶ（URL を元に戻す）
 * @returns {{ show(id: string): void, hide(): void, update(): void }}
 */
export function createEventSheet({ getState, onClose }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet';
  dlg.setAttribute('aria-labelledby', 'sheetTitle');
  dlg.innerHTML = `<div class="sheet-head"><h2 id="sheetTitle" tabindex="-1"></h2><button class="sheet-close" type="button" data-act="close" aria-label="閉じる">${SVG_CLOSE}</button></div><div class="sheet-body" id="sheetBody"></div>`;
  document.body.append(dlg);
  const body = dlg.querySelector('#sheetBody');
  const heading = dlg.querySelector('#sheetTitle');

  let id = '', shown = '', ctrl = null, pos, offWhen = () => {}, bodyClick = null;
  body.addEventListener('click', (ev) => { if (bodyClick) bodyClick(ev); }); // 開いている予定の分だけ、あとから差し替える

  const close = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => { if (id) { id = ''; shown = ''; stop(); onClose(); } });
  dlg.addEventListener('click', (ev) => {
    if (ev.target === dlg) { close(); return; }
    if (ev.target.closest('[data-act="close"]')) { close(); return; }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'cal') { const e = findEvent(getState().events, id); if (e) { addToCalendar(e); toast('カレンダーの登録画面を開きます'); } }
  });

  function stop() { if (ctrl) ctrl.abort(); ctrl = null; offWhen(); offWhen = () => {}; bodyClick = null; }

  /* ---- 行き方の動き ---- */
  function bindAccess(e) {
    const f = body.querySelector('.tform');
    const $ = (sel) => body.querySelector(sel);
    const val = (sel) => cleanStationName($(sel).value);
    let arrive = (queries.get(e.id)?.arrive ?? true);
    const current = () => ({ from: val('#tFrom'), to: val('#tTo'), date: $('#tDate').value, time: $('#tTime').value, arrive });
    const validate = (q) => (!q.from ? ['出発駅を入力してください', '#tFrom'] : !q.to ? ['到着駅を入力してください', '#tTo'] : q.from === q.to ? ['出発駅と到着駅が同じです', '#tFrom']
      : !DATE_RE.test(q.date) ? ['日付を選んでください', '#tDate'] : !TIME_RE.test(q.time) ? ['時刻を選んでください', '#tTime'] : null);
    const chips = (list, target) => list.length > 1
      ? list.slice(0, 3).map((s) => `<button type="button" class="pick" data-pick="${target}" data-name="${esc(s.name)}">${esc(s.name)}<small>${fmtKm(s.km)}</small></button>`).join('') : '';

    /** 押した時点の入力で、リンクと「◯月◯日 ◯時 到着」の表示を作り直す。 */
    function refresh() {
      const q = current();
      const ok = !validate(q);
      $('[data-link="yahoo"]').href = ok ? yahooTransitUrl(q) : '#';
      $('#tWhen').textContent = DATE_RE.test(q.date) && TIME_RE.test(q.time) ? whenLabel(q) : '';
      return q;
    }

    async function fillArrival() {
      if ($('#tTo').value) return;
      try {
        const list = await nearbyStations(pos);
        if (!list.length || !alive(e)) return;
        if (!$('#tTo').value) $('#tTo').value = list[0].name;
        $('#toChips').innerHTML = chips(list, 'to');
        refresh();
      } catch { /* 入力してもらう */ }
    }

    async function nearMe(btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      $('#tErr').textContent = '';
      try {
        const me = await currentPosition();
        if (!isDomestic(me)) throw new Error('現在地が日本国外のため使えません');
        const list = await nearbyStations(me);
        if (!list.length) throw new Error('近くに駅が見つかりませんでした');
        if (!alive(e)) return;
        $('#tFrom').value = list[0].name;
        $('#fromChips').innerHTML = chips(list, 'from');
        refresh();
      } catch (err) {
        if (alive(e)) $('#tErr').textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }

    offWhen = bindSegmented(body, 'when', (v) => {
      arrive = v === 'arrive';
      body.querySelectorAll('[data-seg="when"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
      refresh();
    });
    f.addEventListener('input', () => { $('#tErr').textContent = ''; refresh(); });
    f.addEventListener('change', () => { $('#tErr').textContent = ''; refresh(); }); // iPhone の日付・時刻は「change」しか来ないことがある
    f.addEventListener('submit', (ev) => { ev.preventDefault(); $('[data-link="yahoo"]').click(); });
    bodyClick = (ev) => {
      const pick = ev.target.closest('[data-pick]');
      if (pick) { $(pick.dataset.pick === 'from' ? '#tFrom' : '#tTo').value = pick.dataset.name; $('#tErr').textContent = ''; refresh(); return; }
      if (ev.target.closest('[data-act="near-me"]')) { nearMe(ev.target.closest('button')); return; }
      const y = ev.target.closest('[data-link="yahoo"]');
      if (y) {
        const q = refresh();                          // 押した瞬間の入力で必ず作り直す
        const bad = validate(q);
        $('#tErr').textContent = bad ? bad[0] : '';
        if (bad) { ev.preventDefault(); $(bad[1]).focus(); return; }
        y.href = yahooTransitUrl(q);
        writeStore(KEYS.origin, q.from);
        queries.set(e.id, { from: q.from, date: q.date, time: q.time, arrive: q.arrive });
      }
    };
    refresh();
    fillArrival();
  }

  const alive = (e) => id === e.id && ctrl && !ctrl.signal.aborted;

  async function loadWeather(e, today, el) {
    if (!e.date) { el.innerHTML = '<p class="wx-text">日程が決まると表示されます</p>'; return; }
    if (!pos) { el.innerHTML = weatherStrip({ state: 'none' }); return; }
    const day = e.date < today ? today : e.date;
    if (!forecastable(day, today)) { el.innerHTML = weatherStrip({ state: 'later', e, today }); return; }
    try {
      const data = await forecast(pos, { signal: ctrl.signal });
      if (alive(e)) el.innerHTML = weatherStrip({ state: 'ready', e: { ...e, date: day }, today, data });
    } catch { if (alive(e)) el.innerHTML = weatherStrip({ state: 'error' }); }
  }

  function placeReady(e, today) {
    const wx = body.querySelector('#wx');
    loadWeather(e, today, wx);
    const sec = body.querySelector('#accessSec');
    if (pos === null) {
      if (e.place && !/オンライン|配信/.test(e.place)) {
        sec.hidden = false;
        sec.querySelector('#access').innerHTML = `<a class="btn wide" data-link="map" target="_blank" rel="noopener" href="${appleMapsUrl(null, e.place)}">マップで探す</a>`;
      }
      return;
    }
    sec.hidden = false;
    sec.querySelector('#access').innerHTML = accessHtml({ e, pos, today });
    if (body.querySelector('.tform')) bindAccess(e);
  }

  function render() {
    const s = getState();
    const e = findEvent(s.events, id);
    if (!e) {
      heading.textContent = '';
      if (s.feedStatus === 'loading' || s.feedStatus === 'idle') { setHtml(body, skeleton(3)); return; }
      heading.textContent = '予定が見つかりません';
      setHtml(body, statusBlock({ kind: 'empty', title: 'この予定は見つかりません', message: '日程が更新されて、なくなった可能性があります' }));
      return;
    }
    const sig = `${e.id}|${s.today}`;
    if (shown === sig) return; // 同じ予定・同じ日なら描き直さない（入力中の内容を消さない）
    shown = sig;
    stop();
    ctrl = new AbortController();
    heading.textContent = e.title;
    pos = knownPlace(e.place);
    body.__html = undefined;
    body.innerHTML = infoHtml(e, s.today)
      + `<section class="sec"><h3>現地の天気</h3><div class="panel" id="wx">${weatherStrip({ state: 'loading' })}</div></section>`
      + accessShell
      + `<section class="sec"><div class="btn-col"><button class="btn solid wide" type="button" data-act="cal"${e.date || e.dates.length ? '' : ' disabled'}>iPhoneのカレンダーに追加</button>`
      + (e.url ? `<a class="btn wide" href="${esc(e.url)}" target="_blank" rel="noopener">公式の情報を見る</a>` : '') + '</div></section>';
    body.scrollTop = 0;
    if (pos !== undefined) { placeReady(e, s.today); return; }
    locate(e.place, { signal: ctrl.signal }).then((p) => p, () => null).then((p) => { if (alive(e)) { pos = p; placeReady(e, s.today); } });
  }

  return {
    show(newId) {
      if (id === newId && dlg.open) { render(); return; }
      id = newId; shown = '';
      if (!dlg.open) dlg.showModal();
      render();
      heading.focus({ preventScroll: true });
    },
    hide() { if (!dlg.open) return; id = ''; shown = ''; stop(); dlg.close(); },
    update() { if (id && dlg.open) render(); }
  };
}
