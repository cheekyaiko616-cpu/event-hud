// 地図：これからの予定の会場を、まとめて地図に出す。同じ会場の予定は1つの印にまとめる。
// 一覧に無い会場は、ここでは調べない（大量の通信を避けるため）。詳細を開いたときに調べた会場は、次から出る。
import { setHtml, esc } from '../../util/dom.js';
import { upcoming } from '../../data/events.js';
import { knownPlace } from '../../services/geo.js';
import { createMap, mapFallback } from '../components/map-box.js';
import { eventRows } from '../components/event-row.js';
import { feedState } from './feed-state.js';

export const title = '地図';

export function mount(root) {
  let box = null, sig = '', alive = true, building = null;
  setHtml(root, '<h1 class="view-title" tabindex="-1">会場の地図</h1><div class="map-box map-full" id="mapEl"></div><div id="mapInfo" class="map-card"></div>');
  const mapEl = root.querySelector('#mapEl');
  const info = root.querySelector('#mapInfo');

  function venues(s) {
    const groups = new Map();
    let unknown = 0;
    upcoming(s.events, s.today).forEach((x) => {
      const pos = knownPlace(x.e.place);
      if (pos === null) return;              // オンラインなど
      if (pos === undefined) { unknown++; return; }
      const k = `${pos.lat},${pos.lon}`;
      if (!groups.has(k)) groups.set(k, { pos, items: [] });
      groups.get(k).items.push(x);
    });
    return { groups: [...groups.values()], unknown };
  }

  async function build(s) {
    const { groups, unknown } = venues(s);
    const nextSig = groups.map((g) => `${g.pos.lat},${g.pos.lon}:${g.items.length}`).join('|');
    if (nextSig === sig && box) return; // 中身が同じなら、地図を作り直さない
    sig = nextSig;
    try {
      if (!box) box = await createMap(mapEl, { label: '会場の地図' });
      if (!alive) { box.destroy(); box = null; return; }
      box.map.eachLayer((l) => { if (l.options && l.options.icon) l.remove(); });
      groups.forEach((g) => box.pin(g.pos, {
        title: g.pos.name, count: g.items.length,
        onClick: () => { setHtml(info, `<h2 class="hud">// ${esc(g.pos.name)}</h2>${eventRows(g.items)}`); }
      }));
      box.fit(groups.map((g) => g.pos));
      setHtml(info, `<p class="map-legend">${groups.length}か所の会場。印を押すと予定が出ます。${unknown ? `（位置が未登録の会場 ${unknown}件は、予定を開くと地図に加わります）` : ''}</p>`);
    } catch (e) {
      setHtml(mapEl, mapFallback(e.message));
    }
  }

  return {
    update(s) {
      const gate = feedState(s, ['hero']);
      if (gate) { setHtml(info, gate); return; }
      building = (building || Promise.resolve()).then(() => build(s));
    },
    unmount() { alive = false; if (box) box.destroy(); box = null; }
  };
}
