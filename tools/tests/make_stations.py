"""確認用の「全国の駅の一覧（都道府県つき）」を作る。アプリには入れない（アプリには data/stations.json が入っている）。
元データ: npm の japan-train-data（MIT。駅データ.jp をもとにした 2019年ごろの全国 8,878駅）
使い方:
  npm install japan-train-data --ignore-scripts   （中のプログラムは動かさず、データとして読むだけ）
  python3 tools/tests/make_stations.py node_modules/japan-train-data/dist/bundle.es.js stations-test.json"""
import json, sys
src = open(sys.argv[1], encoding='utf-8').read()
data, _ = json.JSONDecoder().raw_decode(src, src.index('['))
st = {}
for p in data:
    for l in p['lines']:
        for x in l['stations']:
            g = x.get('gid') or x['id']
            v = st.setdefault(g, {'g': g, 'n': x['name']['ja'], 'lat': x['location']['lat'], 'lon': x['location']['lng'], 'p': p['name']['ja'], 'l': set()})
            v['l'].add(l['name']['ja'])
out = [{**v, 'l': sorted(v['l'])} for v in st.values()]
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out), 'stations')
