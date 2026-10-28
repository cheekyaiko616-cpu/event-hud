// 実際の道案内は iPhone 標準の「マップ」に引き継ぐ（ウェブアプリは画面を消すと止まるため）。
export function appleMapsUrl(pos, label, { directions = false } = {}) {
  const q = encodeURIComponent(label || '目的地');
  const ll = pos ? `${pos.lat},${pos.lon}` : '';
  if (directions) return `https://maps.apple.com/?daddr=${ll || q}&dirflg=d`;
  return ll ? `https://maps.apple.com/?ll=${ll}&q=${q}` : `https://maps.apple.com/?q=${q}`;
}
