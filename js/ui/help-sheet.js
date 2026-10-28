// 「使い方」の画面。はじめて使う人が、何ができて、データがどこから来て、どこへ送られるかを分かるようにする。
export function createHelpSheet() {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet help';
  dlg.setAttribute('aria-labelledby', 'helpTitle');
  dlg.innerHTML = `<h2 id="helpTitle">使い方</h2>
<h3>できること</h3>
<ul>
<li><b>ホーム</b>：申し込みの締切が近いもの、次の予定まであと何日か、これからの予定と現地の天気。</li>
<li><b>予定</b>：今週末・今月・来月・すべてを切り替えて一覧。</li>
<li><b>期限</b>：申し込み・締切・入金などを近い順に。3日以内は光ります。</li>
<li><b>地図</b>：国内の会場を地図と大きな一覧で。会場を選ぶと、そこでの予定が出ます。</li>
<li><b>予定を開く</b>：天気・地図・行き方（電車・バス／車）・iPhoneのカレンダーへの追加。</li>
</ul>
<h3>乗り換え案内の使い方</h3>
<ol>
<li>予定を開き「行き方」で「電車・バス」を選ぶ。</li>
<li>出発駅を入力（または「現在地の最寄り駅を使う」）。到着駅は会場の最寄り駅が入っています。</li>
<li>日付と時刻を確かめて「Yahoo!乗換案内で検索」。ボタンの上に、検索する日時が出ます。駅から会場までのバスも見たいときは「Googleマップで会場まで」。</li>
</ol>
<p>Yahoo!乗換案内アプリが開いて日時が違うときは、アプリの検索画面で日時を合わせてください（アプリによっては外からの日時指定を受け取らないことがあります）。</p>
<h3>車で行くとき</h3>
<p>「行き方」で「車」を選び「Yahoo!カーナビで案内開始」。無料の Yahoo!カーナビ アプリが開き、現在地から会場までの案内が始まります。アプリが無いときは App Store から入手してください。</p>
<h3>iPhoneのホーム画面に追加</h3>
<p>Safariの共有ボタン（□に↑）→「ホーム画面に追加」。アプリのように全画面で開けます。</p>
<h3>データと位置情報について</h3>
<ul>
<li>日程は、公開されているイベント一覧（Event list）から読み込みます。読むだけで、書き換えません。</li>
<li>位置情報は「現在地の最寄り駅」「車の経路」を押したときだけ使い、駅探し・経路計算のために OpenStreetMap の無料サービスへ送ります。保存はしません。</li>
<li>天気は Open-Meteo、地図は国土地理院（地理院タイル）、駅探しは OpenStreetMap、乗り換えの結果は Yahoo!乗換案内・Googleマップ・Appleマップの画面で表示します。</li>
<li>天気の予報は、開催日の約2週間前から出ます。</li>
</ul>
<button class="btn primary wide" type="button" data-act="close">閉じる</button>`;
  document.body.append(dlg);
  dlg.addEventListener('click', (ev) => {
    if (ev.target === dlg || ev.target.closest('[data-act="close"]')) dlg.close();
  });
  return { open() { dlg.showModal(); dlg.scrollTop = 0; } };
}
