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
  weather: 'hud.weather.v1'    // 天気予報（位置ごと）
};

export const TTL = {
  feed: 30 * 60e3,        // これより新しければ、通信せずに使う
  weather: 3 * 3600e3,
  geo: 90 * 86400e3
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
  tiles: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  home: [36.2, 138.25], homeZoom: 5
};
export const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';
export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
export const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
