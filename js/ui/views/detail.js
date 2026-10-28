// 予定の詳細：日程・天気・地図・経路・カレンダー追加を1画面にまとめる。
// 天気・位置・経路は、それぞれの場所だけを書き換える（他の部分は描き直さない）。
import { setHtml, esc } from '../../util/dom.js';
import { findEvent } from '../../data/events.js';
import { longRange, md, weekday, daysBetween, countdownLabel } from '../../util/date.js';
import { DATE_KINDS } from '../../config.js';
import { knownPlace, locate } from '../../services/geo.js';
import { forecast, forecastable } from '../../services/weather.js';
import { currentPosition } from '../../services/location.js';
import { drivingRoute, formatDuration, formatKm } from '../../services/route.js';
import { addToCalendar } from '../../services/calendar.js';
import { appleMapsUrl } from '../../services/maps-link.js';
import { weatherStrip } from '../components/weather.js';
import { createMap, mapFallback } from '../components/map-box.js';
import { statusBlock, skeleton } from '../components/status.js';
import { toast } from '../components/toast.js';

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
  let box = null, pos, shownId = '', alive = true;

  async function loadWeather(e, today, el) {
    if (pos === null) { setHtml(el, weatherStrip({ state: 'none' })); return; }
    const day = e.date < today ? today : e.date;
    if (!forecastable(day, today)) { setHtml(el, weatherStrip({ state: 'later', e, today })); return; }
    setHtml(el, weatherStrip({ state: 'loading' }));
    try {
      const data = await forecast(pos, { signal });
      setHtml(el, weatherStrip({ state: 'ready', e: { ...e, date: day }, today, data }));
    } catch (err) {
      if (!signal.aborted) setHtml(el, weatherStrip({ state: 'error', message: err.message }));
    }
  }

  async function loadMap(e, el) {
    try {
      box = await createMap(el.querySelector('.map-box'), { center: [pos.lat, pos.lon], zoom: 13, label: `${e.place}の地図` });
      if (!alive) { box.destroy(); box = null; return; }
      box.pin(pos, { title: e.place });
    } catch (err) {
      setHtml(el.querySelector('.map-box'), mapFallback(err.message));
    }
  }

  async function showRoute(e, el, btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    const out = el.querySelector('.route-out');
    setHtml(out, '<p class="wx-note" role="status">現在地と経路を調べています…</p>');
    try {
      const me = await currentPosition();
      const r = await drivingRoute(me, pos, { signal });
      if (!alive) return;
      if (box) { box.pin(me, { me: true, title: '現在地' }); box.route(r.line); }
      setHtml(out, `<div class="route-sum" role="status"><b>${formatDuration(r.min)}</b><span class="mono">${formatKm(r.km)}</span><span class="muted">車・目安</span></div>`
        + `<details class="route-steps"><summary>曲がる所の一覧（${r.steps.length}）</summary><ol>${r.steps.map((s) => `<li>${esc(s.text)}${s.km ? `<small>${formatKm(s.km)}</small>` : ''}</li>`).join('')}</ol></details>`);
    } catch (err) {
      if (!signal.aborted) setHtml(out, `<p class="wx-note" role="alert">${esc(err.message)}</p>`);
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
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
    pos = knownPlace(e.place);
    const hasPlace = pos !== null;
    setHtml(root, `<a class="back" href="${back}">‹ 戻る</a><article class="detail">${infoHtml(e, s.today)}`
      + `<h2 class="hud">// WEATHER 現地の予報</h2><div class="card" id="wx"></div>`
      + (hasPlace ? `<h2 class="hud">// MAP</h2><div class="card" id="mapCard"><div class="map-box"></div>`
        + `<div class="btn-row"><button class="btn" type="button" data-act="route">現在地から経路</button><a class="btn" data-act="open-map" target="_blank" rel="noopener" href="${appleMapsUrl(pos, e.place, { directions: true })}">マップで案内開始</a></div>`
        + '<div class="route-out" style="margin-top:10px"></div></div>' : '')
      + `<h2 class="hud">// CALENDAR</h2><div class="card"><div class="btn-col"><button class="btn primary" type="button" data-act="cal"${e.date || e.dates.length ? '' : ' disabled'}>iPhoneのカレンダーに追加</button>`
      + (e.url ? `<a class="btn" href="${esc(e.url)}" target="_blank" rel="noopener">公式の情報</a>` : '') + '</div>'
      + `<p class="wx-note" style="margin-top:8px">前日の朝9時にお知らせ${e.dates.length ? '。申し込み・期限の日も一緒に入ります' : ''}。</p></div></article>`);
    const wxEl = root.querySelector('#wx');
    const mapCard = root.querySelector('#mapCard');
    const start = async () => {
      if (pos === undefined) { // 一覧に無い会場：調べる
        setHtml(wxEl, weatherStrip({ state: 'loading' }));
        try { pos = await locate(e.place, { signal }); } catch { pos = null; }
        if (!alive) return;
        if (!pos && mapCard) setHtml(mapCard, statusBlock({ kind: 'empty', title: '会場の位置が見つかりませんでした', message: 'マップアプリで場所名から探せます。' }) + `<a class="btn" style="width:100%" target="_blank" rel="noopener" href="${appleMapsUrl(null, e.place)}">マップで探す</a>`);
        else if (pos && mapCard) mapCard.querySelector('[data-act="open-map"]').href = appleMapsUrl(pos, e.place, { directions: true });
      }
      if (e.date) loadWeather(e, s.today, wxEl); else setHtml(wxEl, '<p class="wx-note">日程が決まると、予報が出ます。</p>');
      if (pos && mapCard) loadMap(e, mapCard);
    };
    start();
  }

  const onClick = (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const e = findEvent(lastState.events, params.id);
    if (!e) return;
    if (b.dataset.act === 'cal') { addToCalendar(e); toast('カレンダーの登録画面を開きます'); }
    if (b.dataset.act === 'route' && pos) showRoute(e, root.querySelector('#mapCard'), b);
  };
  let lastState = null;
  root.addEventListener('click', onClick);
  return {
    update(s) { lastState = s; render(s); },
    unmount() { alive = false; ctrl.abort(); root.removeEventListener('click', onClick); if (box) box.destroy(); box = null; }
  };
}
