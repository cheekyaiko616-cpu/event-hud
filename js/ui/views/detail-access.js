// 予定の詳細の「行き方」：電車・バス（乗り換え案内）と車（経路）。国内の会場だけ。
// 乗り換えの結果は Yahoo!乗換案内・Googleマップ・Appleマップの画面で見る（無料で全国の時刻表を引ける手段がそれしか無いため）。
import { esc, setHtml } from '../../util/dom.js';
import { readStore, writeStore } from '../../util/cache.js';
import { isDomestic, walkMinutes } from '../../util/geo-math.js';
import { KEYS, TRANSIT } from '../../config.js';
import { segmented, bindSegmented } from '../components/segmented.js';
import { currentPosition } from '../../services/location.js';
import { nearbyStations, cleanStationName } from '../../services/stations.js';
import { drivingRoute, formatDuration, formatKm } from '../../services/route.js';
import { yahooTransitUrl, googleTransitUrl, appleTransitUrl } from '../../services/transit-links.js';
import { appleMapsUrl } from '../../services/maps-link.js';

let mode = 'transit'; // 画面を移っても、選んだ行き方は覚えておく
let when = 'arrive';

const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);

/** 駅から会場までの案内文。 */
function lastMile(km) {
  if (km == null) return '';
  if (km > TRANSIT.farKm) return `駅から会場まで約${fmtKm(km)}（直線）。バス・タクシー・シャトルバスが必要です。Googleマップなら会場まで調べられます。`;
  return `駅から会場まで約${fmtKm(km)}（徒歩${walkMinutes(km)}分目安）`;
}

/**
 * 「行き方」の部分。pos が null（場所なし）なら何も出さない。海外なら理由だけ出す。
 * @param {{ e: object, pos: object|null|undefined, today: string }} p
 */
export function accessHtml({ e, pos, today }) {
  if (pos === null) return '';
  const head = '<h2 class="hud">// ACCESS 行き方</h2>';
  if (pos && !isDomestic(pos)) return `${head}<div class="card"><p class="wx-note">海外の会場のため、地図・経路・乗り換え案内は出しません。</p></div>`;
  const date = e.date && e.date >= today ? e.date : today;
  const from = readStore(KEYS.origin) || '';
  const to = pos?.station || '';
  return `${head}<div class="card" id="access">`
    + segmented({ name: 'mode', label: '行き方', options: [{ value: 'transit', label: '電車・バス' }, { value: 'car', label: '車' }], value: mode })
    + `<form class="tform" data-panel="transit" novalidate${mode === 'transit' ? '' : ' hidden'}>`
    + `<div class="field"><label for="tFrom">出発駅</label><input id="tFrom" name="from" type="text" inputmode="text" autocomplete="off" enterkeyhint="next" placeholder="例）新宿" value="${esc(from)}" aria-describedby="tFromHint">`
    + `<button class="btn wide" type="button" data-act="near-me">現在地の最寄り駅を使う</button><div class="hint" id="tFromHint"></div></div>`
    + `<div class="field"><label for="tTo">到着駅</label><input id="tTo" name="to" type="text" autocomplete="off" enterkeyhint="done" placeholder="例）御殿場" value="${esc(to)}" aria-describedby="tToHint">`
    + `<div class="hint" id="tToHint">${esc(pos ? lastMile(pos.stationKm) : '')}</div></div>`
    + `<div class="field-row"><div class="field"><label for="tDate">日付</label><input id="tDate" name="date" type="date" min="${today}" value="${date}"></div>`
    + `<div class="field"><label for="tTime">時刻</label><input id="tTime" name="time" type="time" value="${TRANSIT.defaultTime}"></div></div>`
    + segmented({ name: 'when', label: '時刻の意味', options: [{ value: 'arrive', label: 'この時刻に到着' }, { value: 'depart', label: 'この時刻に出発' }], value: when })
    + '<p class="err" id="tErr" role="alert"></p>'
    + '<button class="btn primary wide" type="submit">Yahoo!乗換案内で検索</button>'
    + '<div class="btn-row"><a class="btn" data-link="google" target="_blank" rel="noopener" href="#">Googleマップで<br>会場まで</a><a class="btn" data-link="apple" target="_blank" rel="noopener" href="#">Appleマップで<br>会場まで</a></div>'
    + '<p class="wx-note">結果は各サービスの画面で開きます。Googleマップ・Appleマップは駅から会場までのバスや徒歩も含みます。</p>'
    + '</form>'
    + `<div data-panel="car"${mode === 'car' ? '' : ' hidden'}><div class="btn-col"><button class="btn primary wide" type="button" data-act="route">現在地から車の経路を見る</button>`
    + `<a class="btn wide" data-link="drive" target="_blank" rel="noopener" href="#">マップで案内開始</a></div><div class="route-out" style="margin-top:10px"></div></div>`
    + '</div>';
}

/**
 * 「行き方」の動き。戻り値で解除。
 * @param {HTMLElement} root
 * @param {{ e: object, getPos: () => object|null, getBox: () => object|null, signal: AbortSignal }} p
 */
export function bindAccess(root, { e, getPos, getBox, signal }) {
  const card = root.querySelector('#access');
  if (!card) return () => {};
  const f = card.querySelector('form');
  const $ = (id) => card.querySelector(id);
  const val = (id) => cleanStationName($(id).value);

  function refreshLinks() {
    const pos = getPos();
    if (!pos) return;
    const from = val('#tFrom');
    card.querySelector('[data-link="google"]').href = googleTransitUrl({ from, dest: pos });
    card.querySelector('[data-link="apple"]').href = appleTransitUrl({ from, dest: pos, label: e.place });
    card.querySelector('[data-link="drive"]').href = appleMapsUrl(pos, e.place, { directions: true });
  }

  /** 会場の到着駅が一覧に無いとき：近くの駅を調べて入れる。 */
  async function fillArrival() {
    const pos = getPos();
    if (!pos || pos.station || $('#tTo').value) return;
    setHtml($('#tToHint'), '<span role="status">会場の近くの駅を調べています…</span>');
    try {
      const list = await nearbyStations(pos, { signal });
      if (signal.aborted) return;
      if (!list.length) { setHtml($('#tToHint'), '近くに駅が見つかりませんでした。到着駅を入力するか、Googleマップで会場まで調べてください。'); return; }
      if (!$('#tTo').value) $('#tTo').value = list[0].name;
      setHtml($('#tToHint'), esc(lastMile(list[0].km)) + chips(list, 'to'));
    } catch {
      if (!signal.aborted) setHtml($('#tToHint'), '近くの駅を調べられませんでした。到着駅を入力してください。');
    }
  }

  const chips = (list, target) => (list.length > 1
    ? `<div class="chips" role="group" aria-label="ほかの駅">${list.slice(0, 5).map((s) => `<button type="button" class="chip" data-pick="${target}" data-name="${esc(s.name)}">${esc(s.name)}<small>${fmtKm(s.km)}</small></button>`).join('')}</div>`
    : '');

  async function nearMe(btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    setHtml($('#tFromHint'), '<span role="status">現在地と近くの駅を調べています…</span>');
    try {
      const me = await currentPosition();
      if (!isDomestic(me)) throw new Error('現在地が日本国外のため使えません。出発駅を入力してください。');
      const list = await nearbyStations(me, { signal });
      if (!list.length) throw new Error('近くに駅が見つかりませんでした。出発駅を入力してください。');
      $('#tFrom').value = list[0].name;
      setHtml($('#tFromHint'), `現在地から約${fmtKm(list[0].km)}（徒歩${walkMinutes(list[0].km)}分目安）${chips(list, 'from')}`);
      refreshLinks();
    } catch (err) {
      if (!signal.aborted) setHtml($('#tFromHint'), `<span class="err-text" role="alert">${esc(err.message)}</span>`);
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }

  async function showRoute(btn) {
    const pos = getPos();
    const out = card.querySelector('.route-out');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    setHtml(out, '<p class="wx-note" role="status">現在地と経路を調べています…</p>');
    try {
      const me = await currentPosition();
      if (!isDomestic(me)) throw new Error('現在地が日本国外のため、車の経路は出せません。');
      const r = await drivingRoute(me, pos, { signal });
      if (signal.aborted) return;
      const box = getBox();
      if (box) { box.pin(me, { me: true, title: '現在地' }); box.route(r.line); }
      setHtml(out, `<div class="route-sum" role="status"><b>${formatDuration(r.min)}</b><span class="mono">${formatKm(r.km)}</span><span class="muted">車・渋滞なしの目安</span></div>`
        + `<details class="route-steps"><summary>曲がる所の一覧（${r.steps.length}）</summary><ol>${r.steps.map((s) => `<li>${esc(s.text)}${s.km ? `<small>${formatKm(s.km)}</small>` : ''}</li>`).join('')}</ol></details>`);
    } catch (err) {
      if (!signal.aborted) setHtml(out, `<p class="err-text" role="alert">${esc(err.message)}</p>`);
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }

  function search(ev) {
    ev.preventDefault();
    const from = val('#tFrom'), to = val('#tTo');
    const date = $('#tDate').value, time = $('#tTime').value;
    const err = !from ? '出発駅を入力してください。' : !to ? '到着駅を入力してください。' : from === to ? '出発駅と到着駅が同じです。'
      : !/^\d{4}-\d{2}-\d{2}$/.test(date) ? '日付を選んでください。' : !/^\d{2}:\d{2}$/.test(time) ? '時刻を選んでください。' : '';
    $('#tErr').textContent = err;
    if (err) { (from ? (to ? $('#tDate') : $('#tTo')) : $('#tFrom')).focus(); return; }
    writeStore(KEYS.origin, from);
    window.open(yahooTransitUrl({ from, to, date, time, arrive: when === 'arrive' }), '_blank', 'noopener');
  }

  const onClick = (ev) => {
    const pick = ev.target.closest('[data-pick]');
    if (pick) { $(pick.dataset.pick === 'from' ? '#tFrom' : '#tTo').value = pick.dataset.name; refreshLinks(); return; }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'near-me') nearMe(ev.target.closest('button'));
    if (act === 'route') showRoute(ev.target.closest('button'));
  };
  const onInput = () => { $('#tErr').textContent = ''; refreshLinks(); };
  const offMode = bindSegmented(card, 'mode', (v) => {
    mode = v;
    card.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== v; });
    card.querySelectorAll('[data-seg="mode"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
  });
  const offWhen = bindSegmented(card, 'when', (v) => {
    when = v;
    card.querySelectorAll('[data-seg="when"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
  });
  card.addEventListener('click', onClick);
  f.addEventListener('submit', search);
  f.addEventListener('input', onInput);
  refreshLinks();
  fillArrival();
  return () => { offMode(); offWhen(); card.removeEventListener('click', onClick); f.removeEventListener('submit', search); f.removeEventListener('input', onInput); };
}
