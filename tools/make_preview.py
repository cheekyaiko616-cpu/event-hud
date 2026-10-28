"""動作確認用の「1枚のHTML」を作る。ブラウザで開くだけで画面を試せる。
使い方: python3 tools/make_preview.py 出力先.html
・プログラムを1つにまとめるのに esbuild を使う（環境変数 ESBUILD に場所。無ければ npx で取ってくる）
・通信できないときに備えて、sample/feed.json を見本データとして入れる
・全国の駅の一覧（data/stations.json）も中に入れる（現在地の最寄り駅を、通信なしで探すため）"""
import json, os, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1])
esb = os.environ.get('ESBUILD')
cmd = [esb] if esb else ['npx', '--yes', 'esbuild@0.24.2']
js = subprocess.run(cmd + [str(root / 'js/main.js'), '--bundle', '--format=iife', '--minify', '--target=safari15', '--log-level=error'],
                    check=True, capture_output=True, text=True).stdout
css = '\n'.join((root / f).read_text(encoding='utf-8') for f in
                ['css/tokens.css', 'css/base.css', 'css/list.css', 'css/home.css', 'css/sheet.css'])
stations = (root / 'data/stations.json').read_text(encoding='utf-8')
sample = json.dumps(json.loads((root / 'sample/feed.json').read_text(encoding='utf-8')), ensure_ascii=False)
html = (root / 'index.html').read_text(encoding='utf-8')
head_end = html.index('<link rel="manifest"')
body_start = html.index('<body>')
head = html[:head_end] + f'<style>\n{css}\n</style>\n</head>\n'
safe = lambda s: s.replace('</script', '<\\/script')
body = html[body_start:].replace('</body>', f'<script>window.__HUD_STATIONS__={safe(stations)};</script>\n<script>window.__HUD_SAMPLE__={safe(sample)};</script>\n<script>{safe(js)}</script>\n</body>')
out.write_text(head + body, encoding='utf-8')
print(out, len(head + body) // 1024, 'KB')
