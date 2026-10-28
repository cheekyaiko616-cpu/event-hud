// 予定の詳細：日程・期限・天気・地図・行き方（電車・バス／車）・カレンダー追加を1画面にまとめる。
// 会場の位置が分かってから、天気・地図・行き方をそれぞれの場所だけ書き換える（他の部分は描き直さない）。
import { setHtml, esc } from '../../util/dom.js';
import { findEvent } from '../../data/events.js';
import { longRange, md, weekday, daysBetween, countdownLabel } from '../../util/date.js';
import { isDomestic } from '../../util/geo-math.js';
import { DATE_KINDS } from '../../config.js';
import { knownPlace, locate } from '../../services/geo.js';
import { forecast, forecastable } from '../../services/weather.js';
import { addToCalendar } from '../../services/calendar.js';
import { appleMapsUrl } from '../../services/maps-link.js';
import { weatherStrip } from '../components/weather.js';
import { createMap, mapFallback } from '../components/map-box.js';
import { statusBlock, skeleton } from '../components/status.js';
import { toast } from '../components/toast.js';
import { accessHtml, bindAccess } from './detail-access.js';

export const title = '予定の詳細';

function infoHtml(e, today) {
  const end = e.end || e.date;
  const days = e.date ? daysBetween(today, e.date) : null;
  const status = !e.date ? '日程未定' : end < today ? '終了しました' : countdownLabel(Math.max(0, days), e.date < today);
  const dls = e.dates.length ? `<h2 class="hud">// DEADLINE 申し込み・期限</h2><div class="card"><ul class="dl-list">${e.dates.map((d) =>
    `<li class="${d.date < today ? 'past' : ''}"><span class="k">${esc(DATE_KINDS[d.kind])}</span><span class="mono">${md(d.date)}(${weekday(d.date)})</span><span class="muted">${esc(d.note)}</span></li>`).join('')}</ul></div>` : '';
  return `<span class="tag c${e.color}">${esc(e.tab)}</span><h1 tabindex="-1">${esc(e.title)}</h1>`
    + `<div class="card corners"><dl class="kv"><dt>DATE</dt><dd>${e.date ? longRange(e.date, e.end) : '未定（公式発表待ち）'}</dd>`
    + `<dt>PLACE</dt><dd>${esc(e.place || '未定')}</dd><dt>COUNT</dt><dd class="cd">${status}</dd>`
    + (e.source ? `<dt>SOURCE</dt><dd>${esc(e.source)}</dd>` : '') + '</dl>'
    + (e.note ? `<p class="note-text">${esc(e.note)}</p>` : '') + '</div>' + dls;
}

export function mount(root, { params, back }) {
  const ctrl = new AbortController();
  const signal = ctrl.signal;
  let box = null, pos, shownId = '', unbindAccess = () => {};
  let lastState = null;

  async function loadWeather(e, today, el) {
    if (!e.date) { setHtml(el, '<p class="wx-note">日程が決まると、予報が出ます。</p>'); return; }
    if (!pos) { setHtml(el, weatherStrip({ state: 'none' })); return; }
    const day = e.date < today ? today : e.date;
    if (!forecastable(day, today)) { setHtml(el, weatherStrip({ state: 'later', e, today })); return; }
    try {
      const data = await forecast(pos, { signal });
      if (!signal.aborted) setHtml(el, weatherStrip({ state: 'ready', e: { ...e, date: day }, today, data }));
    } catch (err) {
      if (!signal.aborted) setHtml(el, weatherStrip({ state: 'error', message: err.message }));
    }
  }

  async function loadMap(e, el) {
    try {
      const b = await createMap(el, { center: [pos.lat, pos.lon], zoom: 14, label: `${e.place}の地図` });
      if (signal.aborted) { b.destroy(); return; }
      box = b;
      box.pin(pos, { title: e.place });
    } catch (err) {
      setHtml(el, mapFallback(err.message));
    }
  }

  /** 会場の位置が決まったあと：天気・地図・行き方を出す。 */
  function placeReady(e, today) {
    const wxEl = root.querySelector('#wx');
    const mapWrap = root.querySelector('#mapWrap');
    const accessWrap = root.querySelector('#accessWrap');
    loadWeather(e, today, wxEl);
    if (pos === null) { // 場所が無い・見つからない
      setHtml(mapWrap, e.place && !/オンライン|配信/.test(e.place)
        ? `<h2 class="hud">// MAP</h2><div class="card">${statusBlock({ kind: 'empty', title: '会場の位置が見つかりませんでした', message: 'マップアプリで場所名から探せます。' })}<a class="btn wide" target="_blank" rel="noopener" href="${appleMapsUrl(null, e.place)}">マップで探す</a></div>`
        : '');
      return;
    }
    if (isDomestic(pos)) {
      setHtml(mapWrap, '<h2 class="hud">// MAP</h2><div class="card"><div class="map-box"></div></div>');
      loadMap(e, mapWrap.querySelector('.map-box'));
    } else setHtml(mapWrap, '');
    setHtml(accessWrap, accessHtml({ e, pos, today }));
    unbindAccess = bindAccess(root, { e, getPos: () => pos, getBox: () => box, signal });
  }

  function render(s) {
    const e = findEvent(s.events, params.id);
    if (!e) {
      if (s.feedStatus === 'loading' || s.feedStatus === 'idle') { setHtml(root, skeleton(['hero', 'row'])); return; }
      setHtml(root, `<a class="back" href="${back}">‹ 戻る</a>` + statusBlock({ kind: 'empty', title: 'この予定は見つかりません', message: '日程が更新されて、なくなった可能性があります。' }));
      return;
    }
    if (shownId === `${e.id}|${s.today}`) return; // 同じ予定・同じ日なら描き直さない（地図を作り直さない）
    shownId = `${e.id}|${s.today}`;
    if (box) { box.destroy(); box = null; }
    unbindAccess();
    pos = knownPlace(e.place);
    setHtml(root, `<a class="back" href="${back}">‹ 戻る</a><article class="detail">${infoHtml(e, s.today)}`
      + `<h2 class="hud">// WEATHER 現地の予報</h2><div class="card" id="wx">${weatherStrip({ state: 'loading' })}</div>`
      + '<div id="mapWrap"></div><div id="accessWrap"></div>'
      + `<h2 class="hud">// CALENDAR</h2><div class="card"><div class="btn-col"><button class="btn primary wide" type="button" data-act="cal"${e.date || e.dates.length ? '' : ' disabled'}>iPhoneのカレンダーに追加</button>`
      + (e.url ? `<a class="btn wide" href="${esc(e.url)}" target="_blank" rel="noopener">公式の情報を見る</a>` : '') + '</div>'
      + `<p class="wx-note" style="margin-top:8px">前日の朝9時にお知らせ${e.dates.length ? '。申し込み・期限の日も一緒に入ります' : ''}。</p></div></article>`);
    if (pos !== undefined) { placeReady(e, s.today); return; }
    // 一覧に無い会場：位置を調べてから出す
    setHtml(root.querySelector('#mapWrap'), '<h2 class="hud">// MAP</h2><div class="card"><p class="wx-note" role="status">会場の位置を調べています…</p></div>');
    locate(e.place, { signal })
      .then((p) => p, () => null)
      .then((p) => { if (!signal.aborted) { pos = p; placeReady(e, s.today); } });
  }

  const onClick = (ev) => {
    const b = ev.target.closest('[data-act="cal"]');
    if (!b || !lastState) return;
    const e = findEvent(lastState.events, params.id);
    if (e) { addToCalendar(e); toast('カレンダーの登録画面を開きます'); }
  };
  root.addEventListener('click', onClick);
  return {
    update(s) { lastState = s; render(s); },
    unmount() { ctrl.abort(); unbindAccess(); root.removeEventListener('click', onClick); if (box) box.destroy(); box = null; }
  };
}
