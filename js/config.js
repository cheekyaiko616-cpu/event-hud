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
  origin: 'hud.origin.v1',     // 前回入力した出発駅
  query: 'hud.query.v1'        // 予定ごとの、前回の乗り換えの日時
};

export const TTL = {
  feed: 30 * 60e3,        // これより新しければ、通信せずに使う
  weather: 3 * 3600e3,
  geo: 90 * 86400e3
};

export const FETCH_TIMEOUT = 10e3;
export const WEATHER_DAYS = 16;     // 天気予報が出る先の日数（Open-Meteo の上限）
export const UPCOMING_MAX = 5;      // ホームに並べる件数
export const DEADLINE_SOON = 3;     // 申し込み・期限を「近い」とする日数

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 申し込みなどの日付の種類（Event list と同じ id）
export const DATE_KINDS = {
  open: '申込開始', close: '申込締切', result: '当落発表', pay: '入金期限', other: 'その他'
};

// カレンダーのお知らせ。Event list の初期値と同じ「前日の朝9時」
export const CAL_ALERT = '-PT15H';

export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
export const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';

// 乗り換え・ナビ
export const TRANSIT = {
  yahoo: 'https://transit.yahoo.co.jp/search/result',
  defaultTime: '09:00'      // 初めに入れておく時刻（開催日のこの時刻に「到着」）
};
export const CARNAVI = { scheme: 'yjcarnavi://navi/select' };
