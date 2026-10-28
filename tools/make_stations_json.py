"""data/stations.json（全国の駅の一覧。[駅名, 緯度, 経度] の並び）を作る。
元データ: npm の japan-train-data（MIT。駅データ.jp をもとにした 2019年ごろの全国 8,878駅）
・駅名は乗り換え案内で通じる形にする（「駅」・かっこ書きを外す）
・「明治神宮前〈原宿〉」のように別名がある駅は、別名（原宿）も1つの駅として入れる
使い方:
  npm install japan-train-data --ignore-scripts   （中のプログラムは動かさず、データとして読むだけ）
  python3 tools/make_stations_json.py node_modules/japan-train-data/dist/bundle.es.js data/stations.json"""
import json, re, sys
src = open(sys.argv[1], encoding='utf-8').read()
data, _ = json.JSONDecoder().raw_decode(src, src.index('['))
def clean(n):
    n = re.sub(r'[（(〈<][^）)〉>]*[）)〉>]', '', n)
    return re.sub(r'駅$', '', re.sub(r'[\s　]+', '', n)).strip()
seen = {}
for p in data:
    for l in p['lines']:
        for x in l['stations']:
            raw = x['name']['ja']
            names = [clean(raw)] + re.findall(r'[〈<]([^〉>]+)[〉>]', raw)
            for n in names:
                n = clean(n)
                if not n: continue
                lat, lon = x['location']['lat'], x['location']['lng']
                seen.setdefault((n, round(lat, 2), round(lon, 2)), [n, round(lat, 4), round(lon, 4)])
out = sorted(seen.values(), key=lambda v: (v[1], v[2]))
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'stations')
