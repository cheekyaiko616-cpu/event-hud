"""公開前の点検。python3 tools/check.py
・sw.js の ASSETS に、js/ と css/ の全ファイルが入っているか（入っていないとオフラインで画面が出ない）
・ASSETS に、もう無いファイルが残っていないか
・前回の公開（git の HEAD）からアプリのファイルが変わったのに、CACHE の番号が上がっていないか
  （上げ忘れると、iPhone に古い版が残り続ける）"""
import pathlib, re, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
sw = (root / 'sw.js').read_text(encoding='utf-8')
assets = set(re.findall(r"'([^']+\.(?:js|css|html|svg|webmanifest|json))'", sw.split('self.addEventListener')[0]))
ng = []
for p in list(root.glob('js/**/*.js')) + list(root.glob('css/*.css')):
    rel = p.relative_to(root).as_posix()
    if rel not in assets: ng.append(f'ASSETS に無い: {rel}')
for a in assets:
    if not (root / a).exists(): ng.append(f'もう無いファイル: {a}')
try:
    changed = subprocess.run(['git', 'diff', '--name-only', 'HEAD', '--', 'index.html', 'js', 'css', 'lib', 'manifest.webmanifest', 'icons'],
                             cwd=root, capture_output=True, text=True, check=True).stdout.split()
    old = subprocess.run(['git', 'show', 'HEAD:sw.js'], cwd=root, capture_output=True, text=True).stdout
    ver = lambda t: (re.search(r"CACHE = '([^']+)'", t) or [None, ''])[1]
    if changed and ver(old) == ver(sw): ng.append(f'ファイルが変わったのに CACHE の番号が同じ: {ver(sw)}（{len(changed)}ファイル変更）')
except Exception as e:
    print('git での確認は省略:', e)
print('\n'.join(ng) if ng else 'OK')
sys.exit(1 if ng else 0)
