// 現在地。許可されなかった・取れなかったときは、理由が分かる言葉で返す。
export function currentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('この端末では現在地を使えません')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? '現在地の利用が許可されていません（設定 → プライバシー → 位置情報サービス）' : '現在地を取得できませんでした')),
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60e3 }
    );
  });
}
