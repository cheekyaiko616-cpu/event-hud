// 現在地。許可されなかった・取れなかったときは、理由が分かる言葉で返す。
// 電車で移動中でも正しい最寄り駅が出るよう、前に取った位置は使い回さない（maximumAge: 0）。
export function currentPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('この端末では現在地を使えません')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? '現在地の利用が許可されていません。iPhoneの「設定」→「プライバシーとセキュリティ」→「位置情報サービス」→「Safari」で許可するか、駅名を入力してください。' : '現在地を取得できませんでした。屋内などで電波が弱いときは、駅名を入力してください。')),
      { enableHighAccuracy: false, timeout, maximumAge: 0 }
    );
  });
}
