"""Bring a batch of seated (floor-sit) item sheets in, by their request numbers.

  python3 tools/seated-import.py BATCH.zip|DIR [--date YYYY-MM-DD] [--dry]

The user returns ChatGPT sheets named by the numbers of 인계/앉은옷-요청문.md
(09.png, 17.webp, ...). For every numbered picture this:

  1. finds its item in the request table (number -> sex, slot, item id from
     the attachment name, e.g. 앉은옷/f-bottom-jean_skirt.webp -> f, bottom,
     bottom:jean_skirt),
  2. checks the sheet can be placed (three figures side by side on white;
     tools/seated-cut-body.py register) and stores it as
     assets/pose-references/floor-sit-<sex>-item-<slot>-<shape>-<date>.webp,
  3. cuts its layer (tools/seated-layers.py item, which adds it to
     assets/seated/items.json and syncs the runtime table and deployment list),
  4. checks it against its own sheet (tools/verify-seated-items.py) and makes
     the 280 px board; a sheet drawn in another pose (warn) gets the request
     doc's sentence to send back only if the item also misfits,

then prints one line per number (ok / FAIL with the reason and the request
doc's sentence to send back to ChatGPT), the boards to look at, and the
numbers still missing. A sheet that fails step 2 is not stored. --dry does
steps 1-2 only. Afterwards run node tools/verify-seated-runtime.cjs (every
item, later frames) and look at the boards before calling anything done.
Introduced 2026-10-15 so a batch of 38 sheets needs no hand steps: the
numbers, ids, file names, runtime table and deployment list used to be
typed by hand.
"""
import sys, os, re, json, zipfile, tempfile, datetime, importlib.util, traceback
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
REQUEST = os.path.join(ROOT, '인계', '앉은옷-요청문.md')
PICS = ('.png', '.jpg', '.jpeg', '.webp')


def load(name, file):
    s = importlib.util.spec_from_file_location(name, os.path.join(HERE, file)); m = importlib.util.module_from_spec(s)
    argv = sys.argv; sys.argv = ['x']; s.loader.exec_module(m); sys.argv = argv; return m


def table():
    """{number: {sex, name, slot, item}} from the request doc's tables."""
    rows = {}
    for num, sex, name, att in re.findall(r'^\| (\d\d) \| (남자|여자) \| ([^|]+?) \| `앉은옷/([^`]+)` \|', open(REQUEST).read(), re.M):
        s, slot, shape = os.path.splitext(att)[0].split('-', 2)
        rows[num] = {'sex': s, 'name': name.strip(), 'slot': slot, 'item': slot + ':' + shape}
    return rows


def retry_lines():
    t = open(REQUEST).read(); part = t.split('### 실패하면')[1].split('##')[0]
    return {k: v for k, v in re.findall(r'- (.+?): "(.+?)"', part)}


def pictures(src, work):
    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                base = os.path.basename(n)
                if base.lower().endswith(PICS) and not base.startswith('.'):
                    out = os.path.join(work, base); open(out, 'wb').write(z.read(n))
        src = work
    found = {}
    for f in sorted(os.listdir(src)):
        m = re.match(r'^(\d{1,2})(?=\D|$)', f)
        if m and f.lower().endswith(PICS): found.setdefault('%02d' % int(m.group(1)), []).append(os.path.join(src, f))
    return found


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    date = sys.argv[sys.argv.index('--date') + 1] if '--date' in sys.argv else datetime.date.today().isoformat()
    if '--date' in sys.argv: args.remove(date)
    dry = '--dry' in sys.argv
    rows, retry = table(), retry_lines()
    CB = load('cutbody', 'seated-cut-body.py'); L = load('layers', 'seated-layers.py'); V = load('vitems', 'verify-seated-items.py')
    os.chdir(ROOT)
    work = tempfile.mkdtemp(prefix='seated-import-'); got = pictures(args[0], work)
    report, done = [], []
    for num, files in sorted(got.items()):
        if num not in rows: report.append((num, 'FAIL', '요청문 번호표에 없는 번호', '')); continue
        r = rows[num]; label = f"{num} {'남자' if r['sex'] == 'm' else '여자'} {r['name']} ({r['item']})"
        if len(files) > 1: report.append((label, 'FAIL', '같은 번호 그림이 여러 장: ' + ', '.join(map(os.path.basename, files)), '')); continue
        try:
            img = Image.open(files[0]); img.load(); img = img.convert('RGB')
            tmp = os.path.join(work, num + '-check.png'); img.save(tmp); CB.register(tmp, r['sex'])
        except AssertionError as e:
            report.append((label, 'FAIL', '세 장면을 찾지 못함(' + str(e) + ')', retry.get('왼쪽 옷 그림이나 글자가 들어갔으면', ''))); continue
        except Exception as e:
            report.append((label, 'FAIL', '그림을 읽지 못함: ' + str(e), '')); continue
        shape = r['item'].split(':', 1)[1]
        dest = f"assets/pose-references/floor-sit-{r['sex']}-item-{r['slot']}-{shape}-{date}.webp"
        if dry: report.append((label, 'ok', '배치 가능 (--dry: 저장·자르기 안 함)', '')); continue
        img.save(dest, 'WEBP', quality=92, method=6)
        try:
            L.build_item(dest, r['sex'], r['slot'], r['item']); done.append((label, r))
        except Exception:
            report.append((label, 'FAIL', '자르기 실패: ' + traceback.format_exc(limit=1).strip().splitlines()[-1], '')); continue
    if done:
        L.sync()
        data = json.load(open('assets/seated/layers.json')); out = os.path.join(ROOT, '검증', '앉은옷'); os.makedirs(out, exist_ok=True)
        for label, r in done:
            m = next(x for x in json.load(open('assets/seated/items.json')) if x['sex'] == r['sex'] and x['item'] == r['item'])
            res = V.check(r['sex'], r['item'], r['slot'], m['sheet'], data, out)
            bad = {v: x['fail'] for v, x in res.items() if x['fail']}
            fit = min(x['fit'] for x in res.values()); pose = min(x['pose'] for x in res.values())
            drift = [v for v, x in res.items() if x['warn']]
            note = f'맞춤 최소 {fit}, 자세 겹침 최소 {pose}' + (f' (원화 자세가 기준과 다름: {", ".join(drift)})' if drift else '')
            # a misfit on a sheet drawn in another pose is the sheet's: ask again
            hint = retry.get('자세나 위치가 바뀌었으면', '') if drift and bad else ''
            if bad: report.append((label, 'FAIL', '검사 실패 ' + json.dumps(bad, ensure_ascii=False) + ' / ' + note, hint))
            else: report.append((label, 'ok' if not drift else 'warn', note, ''))
    print()
    for label, st, why, hint in report:
        print(f'{st:4} {label}: {why}' + (f'\n     다시 요청: "{hint}"' if hint else ''))
    have = {m['sex'] + ':' + m['item'] for m in json.load(open(os.path.join(ROOT, 'assets/seated/items.json')))}
    missing = [n for n, r in sorted(rows.items()) if r['sex'] + ':' + r['item'] not in have and n not in got]
    print('\n아직 없는 번호:', ' '.join(missing) or '없음')
    if done: print('비교판:', os.path.join(ROOT, '검증', '앉은옷'), '(직접 볼 것) / 다음: node tools/verify-seated-runtime.cjs')
    sys.exit(1 if any(st == 'FAIL' for _, st, _, _ in report) else 0)


if __name__ == '__main__':
    main()
