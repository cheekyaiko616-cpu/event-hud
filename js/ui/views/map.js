// 地図：これからの予定の会場を、国内に限って地図に出す。下の大きな一覧からも会場を選べる。
// 同じ会場の予定は1つにまとめる。一覧に無い会場は、ここでは調べない（大量の通信を避けるため）。
import { setHtml, esc } from '../../util/dom.js';
import { upcoming } from '../../data/events.js';
import { md, weekday } from '../../util/date.js';
import { isDomestic } from '../../util/geo-math.js';
import { knownPlace } from '../../services/geo.js';
import { createMap, mapFallback } from '../components/map-box.js';
import { eventRows } from '../components/event-row.js';
import { feedState } from './feed-state.js';

export const title = '地図';
let selected = ''; // 選んだ会場（画面を移っても覚えておく）

function venues(s) {
  const groups = new Map();
  let unknown = 0, abroad = 0;
  upcoming(s.events, s.today).forEach((x) => {
    const pos = knownPlace(x.e.place);
    if (pos === null) return;                 // オンラインなど
    if (pos === undefined) { unknown++; return; }
    if (!isDomestic(pos)) { abroad++; return; }
    const k = `${pos.lat},${pos.lon}`;
    if (!groups.has(k)) groups.set(k, { key: k, pos, items: [] });
    groups.get(k).items.push(x);
  });
  return { groups: [...groups.values()], unknown, abroad };
}

export function mount(root) {
  let box = null, sig = '', alive = true, building = null, data = { groups: [] };
  setHtml(root, '<h1 class="view-title" tabindex="-1">会場の地図</h1><div class="map-box map-full" id="mapEl"></div>'
    + '<h2 class="hud">// VENUES <small>会場を選ぶ</small></h2><div id="venueList"></div>');
  const mapEl = root.querySelector('#mapEl');
  const listEl = root.querySelector('#venueList');

  function renderList() {
    const { groups, unknown, abroad } = data;
    const note = [abroad && `海外の会場 ${abroad}件は地図に出しません`, unknown && `位置が未登録の会場 ${unknown}件は、予定を開くと位置を調べます`].filter(Boolean).join('。');
    setHtml(listEl, (groups.length ? `<ul class="venue-list">${groups.map((g) => {
      const on = g.key === selected;
      const first = g.items[0].e;
      return `<li><button type="button" class="venue${on ? ' on' : ''}" data-venue="${esc(g.key)}" aria-expanded="${on}">`
        + `<span class="vn">${esc(g.pos.name)}</span><span class="vm">${g.items.length}件 ・ 次は ${md(first.date)}(${weekday(first.date)})</span></button>`
        + (on ? `<div class="venue-events">${eventRows(g.items)}</div>` : '') + '</li>';
    }).join('')}</ul>` : '<div class="card"><p class="wx-note">これからの国内の会場はありません。</p></div>')
      + (note ? `<p class="map-legend">${note}。</p>` : ''));
  }

  function select(key, { fromMap = false } = {}) {
    selected = selected === key && !fromMap ? '' : key;
    renderList();
    const g = data.groups.find((x) => x.key === selected);
    if (g && box) box.focus(g.pos, 12);
    if (g && fromMap) listEl.querySelector(`[data-venue="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function build(s) {
    data = venues(s);
    renderList();
    const nextSig = data.groups.map((g) => `${g.key}:${g.items.length}`).join('|');
    if (nextSig === sig && box) return; // 中身が同じなら、地図を作り直さない
    sig = nextSig;
    try {
      if (!box) box = await createMap(mapEl, { label: '国内の会場の地図' });
      if (!alive) { box.destroy(); box = null; return; }
      box.map.eachLayer((l) => { if (l.options && l.options.icon) l.remove(); });
      data.groups.forEach((g) => box.pin(g.pos, { title: g.pos.name, count: g.items.length, onClick: () => select(g.key, { fromMap: true }) }));
      const g = data.groups.find((x) => x.key === selected);
      if (g) box.focus(g.pos, 12); else box.fit(data.groups.map((x) => x.pos));
    } catch (e) {
      setHtml(mapEl, mapFallback(e.message));
    }
  }

  const onClick = (ev) => {
    const b = ev.target.closest('[data-venue]');
    if (b) select(b.dataset.venue);
  };
  root.addEventListener('click', onClick);

  return {
    update(s) {
      const gate = feedState(s, ['row', 'row']);
      if (gate) { setHtml(listEl, gate); return; }
      building = (building || Promise.resolve()).then(() => build(s));
    },
    unmount() { alive = false; root.removeEventListener('click', onClick); if (box) box.destroy(); box = null; }
  };
}
