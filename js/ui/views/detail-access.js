// 予定の詳細の「行き方」：電車・バス（Yahoo!乗換案内）と車（経路の確認と Yahoo!カーナビ）。国内の会場だけ。
// 外のアプリ・サイトは、必ず普通のリンク（<a>）で開く。window.open は iPhone のホーム画面アプリで
// 戻ったときに白い画面になる不具合があるため使わない。
import { esc, setHtml } from '../../util/dom.js';
import { readStore, writeStore } from '../../util/cache.js';
import { isDomestic, walkMinutes } from '../../util/geo-math.js';
import { KEYS, TRANSIT, CARNAVI } from '../../config.js';
import { segmented, bindSegmented } from '../components/segmented.js';
import { currentPosition } from '../../services/location.js';
import { nearbyStations, cleanStationName } from '../../services/stations.js';
import { drivingRoute, formatDuration, formatKm } from '../../services/route.js';
import { yahooTransitUrl, googleTransitUrl, appleTransitUrl, yahooCarNaviUrl, whenLabel } from '../../services/transit-links.js';

let mode = 'transit'; // 画面を移っても、選んだ行き方は覚えておく
let when = 'arrive';

const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

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
    + '<p class="when-sum" id="tSum" aria-live="polite"></p>'
    + '<a class="btn primary wide" data-link="yahoo" target="_blank" rel="noopener" href="#">Yahoo!乗換案内で検索</a>'
    + '<p class="wx-note">日時はYahoo!乗換案内に引き継ぎます。Yahoo!乗換案内アプリが開いて日時が違うときは、アプリの検索画面で日時を合わせてください（アプリ側が外からの日時指定に対応していないことがあります）。</p>'
    + '<div class="btn-row"><a class="btn" data-link="google" target="_blank" rel="noopener" href="#">Googleマップで<br>会場まで</a><a class="btn" data-link="apple" target="_blank" rel="noopener" href="#">Appleマップで<br>会場まで</a></div>'
    + '<p class="wx-note">Googleマップ・Appleマップは駅から会場までのバスや徒歩も含みます（日時は各アプリで指定）。</p>'
    + '</form>'
    + `<div data-panel="car"${mode === 'car' ? '' : ' hidden'}><div class="btn-col">`
    + '<a class="btn primary wide" data-link="carnavi" href="#">Yahoo!カーナビで案内開始</a>'
    + '<button class="btn wide" type="button" data-act="route">現在地からの経路をこの画面で見る</button></div>'
    + `<p class="wx-note" style="margin-top:8px">ナビには無料の「Yahoo!カーナビ」アプリが必要です。<a href="${CARNAVI.appStore}" target="_blank" rel="noopener">App Storeで入手</a></p>`
    + '<div class="route-out" style="margin-top:10px"></div></div>'
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

  /** 入力の今の内容。日時が正しくなければ空のまま返す（呼ぶ側で確かめる）。 */
  const current = () => ({ from: val('#tFrom'), to: val('#tTo'), date: $('#tDate').value, time: $('#tTime').value, arrive: when === 'arrive' });

  function validate(q) {
    if (!q.from) return ['出発駅を入力してください。', '#tFrom'];
    if (!q.to) return ['到着駅を入力してください。', '#tTo'];
    if (q.from === q.to) return ['出発駅と到着駅が同じです。', '#tFrom'];
    if (!DATE_RE.test(q.date)) return ['日付を選んでください。', '#tDate'];
    if (!TIME_RE.test(q.time)) return ['時刻を選んでください。', '#tTime'];
    return null;
  }

  /** リンク先を、今の入力に合わせて作り直す（日時・駅が変わるたびに呼ぶ）。 */
  function refreshLinks() {
    const pos = getPos();
    if (!pos) return;
    const q = current();
    const ok = !validate(q);
    const y = card.querySelector('[data-link="yahoo"]');
    y.href = ok ? yahooTransitUrl(q) : '#';
    y.setAttribute('aria-describedby', 'tSum');
    $('#tSum').textContent = ok ? `${q.from} → ${q.to}　${whenLabel(q)} で検索します` : '';
    card.querySelector('[data-link="google"]').href = googleTransitUrl({ from: q.from, dest: pos });
    card.querySelector('[data-link="apple"]').href = appleTransitUrl({ from: q.from, dest: pos, label: e.place });
    card.querySelector('[data-link="carnavi"]').href = yahooCarNaviUrl({ dest: pos, label: pos.name || e.place });
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
      refreshLinks();
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
      $('#tErr').textContent = '';
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

  /** 「Yahoo!乗換案内で検索」：押した瞬間の入力でリンク先を作り直してから開く。足りなければ開かない。 */
  function onYahoo(ev, a) {
    refreshLinks();
    const q = current();
    const bad = validate(q);
    $('#tErr').textContent = bad ? bad[0] : '';
    if (bad) { ev.preventDefault(); $(bad[1]).focus(); return; }
    a.href = yahooTransitUrl(q);
    writeStore(KEYS.origin, q.from);
  }

  const onClick = (ev) => {
    const pick = ev.target.closest('[data-pick]');
    if (pick) { $(pick.dataset.pick === 'from' ? '#tFrom' : '#tTo').value = pick.dataset.name; $('#tErr').textContent = ''; refreshLinks(); return; }
    const link = ev.target.closest('[data-link]');
    if (link) {
      if (link.dataset.link === 'yahoo') onYahoo(ev, link);
      else refreshLinks(); // 念のため、押した瞬間の内容にそろえる
      return;
    }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'near-me') nearMe(ev.target.closest('button'));
    if (act === 'route') showRoute(ev.target.closest('button'));
  };
  // 日付・時刻の入力は、iPhone では「change」しか来ないことがあるので両方で受ける
  const onInput = () => { $('#tErr').textContent = ''; refreshLinks(); };
  const onSubmit = (ev) => { ev.preventDefault(); card.querySelector('[data-link="yahoo"]').click(); }; // 入力中に「開く」を押したとき
  const offMode = bindSegmented(card, 'mode', (v) => {
    mode = v;
    card.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== v; });
    card.querySelectorAll('[data-seg="mode"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
  });
  const offWhen = bindSegmented(card, 'when', (v) => {
    when = v;
    card.querySelectorAll('[data-seg="when"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
    refreshLinks();
  });
  card.addEventListener('click', onClick);
  f.addEventListener('input', onInput);
  f.addEventListener('change', onInput);
  f.addEventListener('submit', onSubmit);
  refreshLinks();
  fillArrival();
  return () => {
    offMode(); offWhen();
    card.removeEventListener('click', onClick);
    f.removeEventListener('input', onInput);
    f.removeEventListener('change', onInput);
    f.removeEventListener('submit', onSubmit);
  };
}
