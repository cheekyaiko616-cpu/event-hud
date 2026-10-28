// 会場名 → 位置の一覧。ここに無い会場は、地図サービスで調べて端末に覚える（js/services/geo.js）。
// 会場を足すときは、場所の文字に含まれる言葉（match）と、緯度・経度・表示名を1行で書く。
// station は乗り換え案内の到着駅（公式の案内がある会場はその駅、ほかは直線距離で一番近い駅）、stationKm は駅から会場までの直線距離。
// 海外の会場は station を書かない（地図・経路・乗り換えは国内だけ）。
export const VENUES = [
  { match: 'もてぎ', lat: 36.5326, lon: 140.2276, name: 'モビリティリゾートもてぎ', station: '茂木', stationKm: 4.1 },
  { match: '富士スピードウェイ', lat: 35.3717, lon: 138.9272, name: '富士スピードウェイ', station: '御殿場', stationKm: 8.0 },
  { match: '鈴鹿サーキット', lat: 34.8431, lon: 136.5407, name: '鈴鹿サーキット', station: '鈴鹿サーキット稲生', stationKm: 1.3 },
  { match: '岡山国際', lat: 34.9150, lon: 134.2211, name: '岡山国際サーキット', station: '美作土居', stationKm: 9.6 },
  { match: 'オートポリス', lat: 33.0378, lon: 131.0656, name: 'オートポリス', station: '内牧', stationKm: 10.8 },
  { match: 'SUGO', lat: 38.1397, lon: 140.7756, name: 'スポーツランドSUGO', station: '槻木', stationKm: 7.4 },
  { match: '吹上ホール', lat: 35.1606, lon: 136.9378, name: '吹上ホール', station: '吹上', stationKm: 0.3 },
  { match: 'ポートメッセなごや', lat: 35.0453, lon: 136.8478, name: 'ポートメッセなごや', station: '金城ふ頭', stationKm: 0.4 },
  { match: 'ツインメッセ静岡', lat: 34.9600, lon: 138.4069, name: 'ツインメッセ静岡', station: '静岡', stationKm: 2.1 },
  { match: '有明アリーナ', lat: 35.6386, lon: 139.7903, name: '有明アリーナ', station: '有明テニスの森', stationKm: 0.2 },
  { match: '国立代々木競技場', lat: 35.6678, lon: 139.7003, name: '国立代々木競技場 第一体育館', station: '原宿', stationKm: 0.5 },
  { match: '日産スタジアム', lat: 35.5100, lon: 139.6064, name: '日産スタジアム', station: '新横浜', stationKm: 1.1 },
  { match: 'Asueアリーナ大阪', lat: 34.6628, lon: 135.4482, name: 'Asueアリーナ大阪', station: '朝潮橋', stationKm: 0.2 },
  { match: '東京国立博物館', lat: 35.7188, lon: 139.7765, name: '東京国立博物館', station: '上野', stationKm: 0.6 },
  { match: '箱根湯本', lat: 35.2327, lon: 139.1060, name: '箱根湯本駅', station: '箱根湯本', stationKm: 0.2 },
  { match: 'セパン', lat: 2.7608, lon: 101.7382, name: 'セパン・インターナショナル・サーキット' },
  { match: 'バーレーン', lat: 26.0325, lon: 50.5106, name: 'バーレーン・インターナショナル・サーキット' },
  { match: 'カタール', lat: 25.4900, lon: 51.4542, name: 'ルサイル・インターナショナル・サーキット' },
  { match: 'イモラ', lat: 44.3439, lon: 11.7167, name: 'イモラ・サーキット' },
  { match: 'スパ・フランコルシャン', lat: 50.4372, lon: 5.9714, name: 'スパ・フランコルシャン' },
  { match: 'ル・マン', lat: 47.9561, lon: 0.2078, name: 'サルト・サーキット（ル・マン）' },
  { match: 'シルバーストン', lat: 52.0786, lon: -1.0169, name: 'シルバーストン・サーキット' },
  { match: 'サンパウロ', lat: -23.7036, lon: -46.6997, name: 'インテルラゴス・サーキット' }
];

// 会場が無い・場所を決められない予定（地図と天気を出さない）
export const NO_PLACE = /オンライン|配信|未発表|未定/;
