// 地図の部品。地図の仕組み（Leaflet）は、地図を出す画面を開いたときに初めて読み込む（最初の起動を軽くする）。
import { MAP } from '../../config.js';
import { esc } from '../../util/dom.js';

let loading = null;

/** Leaflet を1回だけ読み込む。 */
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  const base = new URL('../../../lib/leaflet/', import.meta.url);
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('leaflet.css', base).href;
    document.head.append(css);
    const s = document.createElement('script');
    s.src = new URL('leaflet.js', base).href;
    s.onload = () => resolve(window.L);
    s.onerror = () => { loading = null; reject(new Error('地図を読み込めませんでした')); };
    document.head.append(s);
  });
  return loading;
}

const pinIcon = (L, { me = false, count = 0 } = {}) => L.divIcon({
  className: '', iconSize: [18, 18], iconAnchor: [9, 9],
  html: `<div class="hud-pin${me ? ' me' : ''}">${count > 1 ? `<span>${count}</span>` : ''}</div>`
});

/**
 * 地図を作る。画面を閉じるときは必ず destroy() を呼ぶ（地図の画像や動きを片付けて、メモリを返す）。
 * @param {HTMLElement} el
 * @param {{ center?: [number, number], zoom?: number, label: string }} p  label は読み上げ用の説明
 */
export async function createMap(el, { center = MAP.home, zoom = MAP.homeZoom, label }) {
  const L = await loadLeaflet();
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', label);
  // 日本国内だけ：この範囲の外へは動かせず、日本全体より引いて見られない
  const map = L.map(el, {
    zoomControl: true, attributionControl: true, tap: true,
    maxBounds: MAP.bounds, maxBoundsViscosity: 1, minZoom: MAP.minZoom
  }).setView(center, zoom);
  const layer = L.tileLayer(MAP.tiles, { attribution: MAP.attribution, maxZoom: MAP.maxZoom, minZoom: MAP.minZoom, bounds: MAP.bounds }).addTo(map);
  // 地図の画像が1枚も読めないとき（圏外・サービス停止）は、理由を地図の上に出す
  let loaded = 0, failed = 0;
  const note = document.createElement('div');
  note.className = 'map-note';
  note.setAttribute('role', 'status');
  note.hidden = true;
  note.textContent = '地図の画像を読み込めません。電波の良い所で開き直してください（会場の位置と経路の線は表示されます）。';
  el.append(note);
  layer.on('tileload', () => { loaded++; note.hidden = true; });
  layer.on('tileerror', () => { failed++; if (!loaded && failed >= 4) note.hidden = false; });
  // 他のアプリへ移っている間は地図の画像を手放す（iPhone がメモリ不足でこのアプリを落とし、戻ると白い画面になるのを防ぐ）
  const onVis = () => {
    if (document.visibilityState === 'hidden') layer.remove();
    else if (!map.hasLayer(layer)) { layer.addTo(map); map.invalidateSize(); }
  };
  document.addEventListener('visibilitychange', onVis);
  let routeLayer = null;
  return {
    map,
    pin(pos, { title, count, me, onClick } = {}) {
      const m = L.marker([pos.lat, pos.lon], { icon: pinIcon(L, { me, count }), title, alt: title, keyboard: true }).addTo(map);
      if (onClick) m.on('click', onClick);
      return m;
    },
    route(line) {
      if (routeLayer) routeLayer.remove();
      routeLayer = L.polyline(line, { color: '#2ee6ff', weight: 5, opacity: .9 }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [24, 24] });
    },
    focus(pos, zoom = 13) { map.flyTo([pos.lat, pos.lon], zoom, { duration: 0.6 }); },
    fit(points) {
      if (points.length === 1) map.setView([points[0].lat, points[0].lon], 13);
      else if (points.length) map.fitBounds(points.map((p) => [p.lat, p.lon]), { padding: [30, 30], maxZoom: 12 });
    },
    destroy() { document.removeEventListener('visibilitychange', onVis); map.off(); map.remove(); }
  };
}

export const mapFallback = (msg) => `<div class="status" role="status"><b>${esc(msg)}</b></div>`;
