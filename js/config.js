// アプリ全体の定数。数や接続先を変えたいときは、まずここを直す。
export const APP = { id: 'event-hud', name: 'Event HUD' };

// Event list が毎日自動で集めている日程。上から順に試す（読むだけ）。
export const FEED_URLS = [
  'https://cheekyaiko616-cpu.github.io/event-list/feed.json',
  'https://raw.githubusercontent.com/cheekyaiko616-cpu/event-list/main/feed.json'
];

// このアプリ専用の保存名。Event list・Verdant Log の保存データには触れない。
export const KEYS = {
  feed: 'hud.feed.v1',         // 最後に読めた日程
  backup: 'hud.backup.v1',     // 読み込んだ Event list のバックアップ（自分で足した予定）
  geo: 'hud.geo.v1',           // 会場名 → 位置（調べた結果）
  weather: 'hud.weather.v1',   // 天気予報（位置ごと）
  stations: 'hud.stations.v1', // 位置 → 近くの駅（調べた結果）
  origin: 'hud.origin.v1',     // 前回入力した出発駅
  intro: 'hud.intro.v1'        // 「はじめての方へ」を閉じたか
};

export const TTL = {
  feed: 30 * 60e3,        // これより新しければ、通信せずに使う
  weather: 3 * 3600e3,
  geo: 90 * 86400e3,
  stations: 30 * 86400e3
};

export const FETCH_TIMEOUT = 10e3;
export const WEATHER_DAYS = 16;     // 天気予報が出る先の日数（Open-Meteo の上限）
export const DEADLINE_DAYS = 14;    // ホームで「期限が近い」と出す日数
export const UPCOMING_MAX = 5;      // ホームに並べる件数

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 申し込みなどの日付の種類（Event list と同じ id）
export const DATE_KINDS = {
  open: '申込開始', close: '申込締切', result: '当落発表', pay: '入金期限', other: 'その他'
};

// カレンダーのお知らせ。Event list の初期値と同じ「前日の朝9時」
export const CAL_ALERT = '-PT15H';

// 地図（無料）と経路（無料）
export const MAP = {
  // 国土地理院の地図（無料・登録不要・日本国内のみ）。暗い色は、表示のときに色を反転して作る（css/views.css）
  tiles: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
  attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
  home: [36.2, 138.25], homeZoom: 5,
  // 地図は日本国内だけ。この四角の外へは動かせない（沖縄・小笠原・北海道の端まで入る）
  bounds: [[20.0, 122.5], [46.0, 154.5]],
  minZoom: 5,   // 国土地理院の地図は、ズーム5より引いた画像がない
  maxZoom: 18
};
export const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';
export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
export const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// 乗り換え案内（結果は各サービスの画面で見る。どれも無料・登録不要）
export const TRANSIT = {
  yahoo: 'https://transit.yahoo.co.jp/search/result',
  google: 'https://www.google.com/maps/dir/',
  apple: 'https://maps.apple.com/',
  defaultTime: '09:00',     // 初めに入れておく時刻（開催日のこの時刻に「到着」）
  walkKmPerMin: 0.08,       // 歩く速さの目安（分速80m）
  farKm: 2                  // 駅から会場がこれより遠いと「バス・タクシーなど」と案内する
};

// 車のナビは Yahoo!カーナビ（無料アプリ）に引き継ぐ。公式に公開されている呼び出し方を使う
export const CARNAVI = {
  scheme: 'yjcarnavi://navi/select',
  appStore: 'https://apps.apple.com/jp/app/id890808217'
};
