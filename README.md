# Event HUD

イベントの日程・現地の天気・地図と経路・iPhoneカレンダーへの追加を、1つにまとめたウェブアプリです。
Event list の日程を **読むだけ** で使います（Event list・Verdant Log のコードとデータは変更しません）。
ビルド作業は不要で、このフォルダをそのまま公開できます（GitHub Pages など）。

## つながる先（すべて無料・登録不要）

| 使いみち | 接続先 |
| --- | --- |
| 日程 | Event list の `feed.json`（GitHub Pages → だめなら GitHub の生データ） |
| 天気 | Open-Meteo |
| 地図の画像 | OpenStreetMap ＋ CARTO（暗い色の地図） |
| 経路（車） | OSRM の公開サーバー |
| 一覧に無い会場の位置 | OpenStreetMap の検索（Nominatim。1秒に1回まで） |
| 道案内 | iPhone 標準の「マップ」に引き継ぐ |

## 構成と、直したいときの目安

| 変えたいこと | 直すファイル |
| --- | --- |
| 色・文字・間隔 | `css/tokens.css` |
| 画面の枠（上の帯・下のボタン・共通ボタン） | `css/base.css` / `index.html` |
| 部品の見た目（カード・行・期限・天気） | `css/components.css` |
| 詳細・地図の画面の見た目 | `css/views.css` |
| 接続先・日数・件数などの決まりごと | `js/config.js` |
| 会場の位置の一覧（足すときはここに1行） | `js/data/venues.js` |
| 日程の読み込み（端末に残っている分を先に出す） | `js/data/feed.js` |
| Event list のバックアップの読み込み | `js/data/backup.js` / 画面は `js/ui/data-sheet.js` |
| 日程の形の整え方 | `js/data/normalize.js` |
| 「これから」「今月」「期限」の取り出し方 | `js/data/events.js` |
| 天気 / 位置 / 現在地 / 経路 | `js/services/weather.js` / `geo.js` / `location.js` / `route.js` |
| カレンダー追加（Event list と同じ方法） | `js/services/ics.js` / `calendar.js` |
| マップへの引き継ぎ | `js/services/maps-link.js` |
| 画面の切り替え | `js/ui/router.js` |
| 各画面 | `js/ui/views/home.js` / `list.js` / `deadlines.js` / `map.js` / `detail.js` |
| 部品 | `js/ui/components/` |
| 状態の置き場 | `js/state.js` |
| 入口（部品をつなぐだけ） | `js/main.js` |
| 動作確認用の1枚のHTMLを作る | `tools/make_preview.py` |

## ファイルを足したり消したりしたとき

`sw.js` の `ASSETS` を直し、`CACHE` の番号を1つ上げてください。

## 自分で入力した予定を出すには

Event list の ⚙️ →「バックアップを書き出す」で保存したファイルを、このアプリの右上「データ」から読み込みます。
iPhone では、ホーム画面に追加したアプリどうしはデータを共有できないため、この方法をとっています。
