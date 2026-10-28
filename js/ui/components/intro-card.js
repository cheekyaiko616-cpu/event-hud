// はじめて開いた人へのひとこと（ホームの上）。「閉じる」を押すと二度と出さない。
import { KEYS } from '../../config.js';
import { readStore, writeStore } from '../../util/cache.js';

export const introDismissed = () => readStore(KEYS.intro) === true;
export const dismissIntro = () => writeStore(KEYS.intro, true);

export function introCard() {
  return '<section class="card intro" aria-labelledby="introTitle"><h2 id="introTitle">はじめての方へ</h2>'
    + '<p>イベントの日程・現地の天気・会場への行き方（乗り換え案内・車）をまとめて見られます。予定を押すと詳しく見られます。</p>'
    + '<div class="btn-row"><button class="btn" type="button" data-act="help">使い方を見る</button><button class="btn" type="button" data-act="intro-close">閉じる</button></div></section>';
}
