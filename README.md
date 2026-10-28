# Event HUD

イベントの日程・現地の天気・乗り換え案内・ナビ・iPhoneカレンダーへの追加を、1つにまとめたウェブアプリです。
Event list の日程を **読むだけ** で使います（Event list・Verdant Log のコードとデータは変更しません）。
ビルド作業は不要で、このフォルダをそのまま公開できます（GitHub Pages など）。

## 画面

| 画面 | 内容 |
| --- | --- |
| ホーム | 次の予定までの大きな数字（開催中があればそれ）、これからの予定5件と天気 |
| 予定 | Event list の一覧と同じ作り：種類のタブ・これから／過去・開催中／次の予定／申込締切の帯・月の帯・予定の行・日程未定 |
| 予定の詳細（下から出る） | 日程・申し込み・期限・天気・行き方（Yahoo!乗換案内／Yahoo!カーナビ／マップ）・カレンダー追加 |

下のボタン（ホーム・予定）は、画面の一番下に固定されています。

## つながる先（すべて無料・登録不要）

| 使いみち | 接続先 |
| --- | --- |
| 日程 | Event list の `feed.json`（GitHub Pages → だめなら GitHub の生データ） |
| 天気 | Open-Meteo |
| 会場の位置（一覧に無い会場だけ） | OpenStreetMap の検索（Nominatim。1秒に1回まで） |
| 近くの駅 | 端末の中の駅の一覧（`data/stations.json`・全国約9,100駅）。通信しない |
| 乗り換え | Yahoo!乗換案内（検索の画面を開く） |
| 車のナビ | Yahoo!カーナビ アプリ（公式に公開されている呼び出し方） |
| 地図 | iPhone 標準の「マップ」を開く |

アプリの中に地図や経路は持ちません。

## 構成と、直したいときの目安

| 変えたいこと | 直すファイル |
| --- | --- |
| 色・文字の大きさ・間隔 | `css/tokens.css` |
| 画面の枠（上の帯・下のボタン・共通のボタンと入力欄） | `css/base.css` / `index.html` |
| 一覧（タブ・帯・月の帯・行） | `css/list.css` |
| ホーム | `css/home.css` |
| 詳細・データの画面 | `css/sheet.css` |
| 接続先・日数・件数などの決まりごと | `js/config.js` |
| 会場の位置と最寄り駅（足すときは1行） | `js/data/venues.js` |
| 全国の駅の一覧を作り直す | `tools/make_stations_json.py` → `data/stations.json` |
| 日程の読み込み（端末に残っている分を先に出す） | `js/data/feed.js` |
| Event list のバックアップの読み込み | `js/data/backup.js` / `js/ui/data-sheet.js` |
| 日程の形の整え方 | `js/data/normalize.js` |
| 「これから」「過去」「申込締切」「月ごと」の取り出し方 | `js/data/events.js` |
| 天気 / 会場の位置 / 現在地 / 近くの駅 | `js/services/weather.js` / `geo.js` / `location.js` / `stations.js` |
| 乗り換え・カーナビ・マップのURL | `js/services/transit-links.js` |
| カレンダー追加（Event list と同じ方法） | `js/services/ics.js` / `calendar.js` |
| 画面の切り替え（#/home・#/list・#/list/予定のid） | `js/ui/router.js` |
| ホーム / 予定の一覧 | `js/ui/views/home.js` / `list.js` |
| 予定の詳細（行き方の入力もここ） | `js/ui/event-sheet.js` |
| 部品（行・帯・タブ・天気・切り替え・お知らせ・状態） | `js/ui/components/` |
| 状態の置き場 | `js/state.js` |
| 入口（部品をつなぐだけ） | `js/main.js` |
| 動作確認用の1枚のHTMLを作る | `tools/make_preview.py` |
| 公開前の点検 | `tools/check.py` |
| 全国の駅・画面での確認 | `tools/tests/`（README あり） |

## ファイルを直したとき（必ず）

`sw.js` の `CACHE` の番号を1つ上げてください。ファイルを足したり消したりしたときは `ASSETS` も直します。
上げ忘れると、iPhone に古い版が残り続けます。公開前に `python3 tools/check.py` で点検できます。

## 外のアプリ・サイトの開き方（守ること）

外へのリンクは必ず普通のリンク（`<a>`）で開きます。`window.open` は、iPhone のホーム画面アプリで戻ったときに白い画面になる不具合があるため使いません。

## 自分で入力した予定を出すには

Event list の ⚙️ →「バックアップを書き出す」で保存したファイルを、このアプリの右上「データ」から読み込みます。
iPhone では、ホーム画面に追加したアプリどうしはデータを共有できないため、この方法をとっています。

## 駅の一覧について

駅の一覧は 2019年ごろのもの（[japan-train-data](https://github.com/adieuadieu/japan-train-data)・MIT・駅データ.jp をもとにしています）です。それ以降にできた駅は入っていません。
