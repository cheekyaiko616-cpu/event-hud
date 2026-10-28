// 位置の計算（通信しない）。距離と、日本国内かどうか。
/** 2点の距離（km）。数km〜数百kmの目安には十分な近似。 */
export function distanceKm(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return 6371 * Math.hypot(x, y);
}

// 日本の範囲を、いくつかの四角の組み合わせで表す（韓国・ロシア・台湾にかからないように分けてある）。
// [南端の緯度, 北端の緯度, 西端の経度, 東端の経度]
const JAPAN = [
  [23.8, 28.6, 122.8, 131.4],   // 沖縄・奄美（台湾より東）
  [28.6, 34.0, 128.0, 132.1],   // 九州・五島・壱岐（済州島より東）
  [34.05, 34.75, 129.1, 129.55], // 対馬（釜山より南）
  [32.6, 36.5, 130.6, 136.0],   // 中国・四国・近畿の西（鬱陵島より南）
  [32.3, 41.6, 136.0, 142.2],   // 近畿の東・中部・関東・東北・伊豆諸島
  [41.3, 45.6, 139.3, 145.9],   // 北海道（サハリンより南）
  [24.0, 27.8, 140.8, 142.5]    // 小笠原
];

/** 日本国内の位置か。 */
export function isDomestic(pos) {
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return false;
  return JAPAN.some(([s, n, w, e]) => pos.lat >= s && pos.lat <= n && pos.lon >= w && pos.lon <= e);
}
