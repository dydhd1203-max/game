"""Receive one ChatGPT garment sheet in one command (2026-10-16): save, cut, board, game checks, summary.

  python3 -B tools/garment/receive.py top:jacket 받은그림.png [--name top-jacket-dark2] [--no-vfg] [--skin 0,4]

  1. copies the sheet to assets/garment-sources/<name>-chatgpt-<date>.png (name: <cat>-<shape>[-dark]) and prints
     its sha256 for the README row (the row itself is written by hand, after looking);
  2. cuts it (tools/garment/build-garment.py --out 검증/옷/<cat>-<shape>) and lists its codes with the worker's
     Korean title (tools/garment/messages.json), so a re-request sentence is at hand;
  3. draws the game board on the lightest and darkest skin (a top: tools/boards/longsleeve-board.cjs, standing x
     walk/run/jump/wave/climb/desk sit; shoes: tools/boards/feet-board.cjs);
  4. runs the game checks for this record (tools/verify-foundation-garments.cjs --only matrix,probes, ~12 min;
     --no-vfg skips) and lists the failed checks and the probe images;
  5. writes 검증/옷/<cat>-<shape>/받기-요약.md: what to look at, in order. Automatic passes are not an art
     approval: open the boards and the probe images before reporting.
Why: the long sleeves (2026-10-16) needed the same five steps by hand for every sheet, and the waist gaps and
the zipper slit were found only by the game checks run late.
"""
import argparse
import datetime
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PRODUCTS = os.path.join(ROOT, 'assets', 'garment-template', 'products.json')
MESSAGES = os.path.join(HERE, 'messages.json')


def run(cmd, log, timeout):
    print('$ ' + ' '.join(cmd), flush=True)
    with open(log, 'w', encoding='utf-8') as fh:
        p = subprocess.run(cmd, cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT, timeout=timeout)
    return p.returncode, open(log, encoding='utf-8').read()


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('product', help='cat:shape, e.g. top:jacket')
    ap.add_argument('sheet', help='the returned sheet (PNG/WebP as received)')
    ap.add_argument('--name', help='source file stem (default <cat>-<shape>[-dark])')
    ap.add_argument('--date', default=datetime.date.today().isoformat())
    ap.add_argument('--no-vfg', action='store_true', help='skip the ~12 min game checks')
    ap.add_argument('--skin', default='0,4', help='board skin tones')
    a = ap.parse_args(argv)
    cat, shape = a.product.split(':')[:2]
    prod = json.load(open(PRODUCTS, encoding='utf-8'))['products'].get('%s:%s' % (cat, shape))
    if prod is None:
        raise SystemExit('%s:%s is not in products.json' % (cat, shape))
    cls = prod['class']
    stem = a.name or '%s-%s%s' % (cat, shape, '-dark' if prod.get('base') == 'dark' else '')
    ext = os.path.splitext(a.sheet)[1].lower() or '.png'
    src = os.path.join(ROOT, 'assets', 'garment-sources', '%s-chatgpt-%s%s' % (stem, a.date, ext))
    if os.path.exists(src) and open(src, 'rb').read() != open(a.sheet, 'rb').read():
        raise SystemExit('%s exists with other pixels: pass --name for this sheet' % os.path.relpath(src, ROOT))
    if not (os.path.exists(src) and os.path.samefile(a.sheet, src)):  # a new session re-cuts a stored original in place
        shutil.copyfile(a.sheet, src)
    sha = hashlib.sha256(open(src, 'rb').read()).hexdigest()
    out = os.path.join(ROOT, '검증', '옷', '%s-%s' % (cat, shape))
    os.makedirs(out, exist_ok=True)
    lines = ['# %s:%s 받기 요약 (%s)' % (cat, shape, a.date), '',
             '원본 `%s` sha256 `%s` (README 행은 그림을 본 뒤 직접 씀)' % (os.path.relpath(src, ROOT), sha), '']

    # 2. cut
    code, text = run([sys.executable, '-B', 'tools/garment/build-garment.py', '%s:%s' % (cat, shape), '--sheet', src,
                      '--out', out], os.path.join(out, '받기-자르기.log'), 3600)
    M_ = json.load(open(MESSAGES, encoding='utf-8'))
    msgs = M_['codes']
    slot_ko = M_['slots'].get({'top': 'top', 'bottom': 'bottom', 'shoes': 'shoes'}.get(cat, cat), '')
    built = 'built in' in text and 'NOT built' not in text
    lines += ['## 1. 자르기: %s' % ('잘림' if built else '**안 잘림**'), '']
    for m in re.finditer(r'^\s+(code|warn) (\S+) (.*)$', text, re.M):
        kind, c, rest = m.groups()
        t = msgs.get(c, {})
        lines.append('- %s `%s` %s — %s%s' % ('실패' if kind == 'code' else '경고', c, rest.strip(), t.get('title', ''),
                                             (' / 다시 요청: ' + t['retry'].replace('{product}', slot_ko).replace('{keep}', '나머지')) if t.get('retry') else ''))
    if not built:
        lines += ['', '```', text[-2000:], '```']
        open(os.path.join(out, '받기-요약.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        print('\n'.join(lines))
        return 2
    lines.append('')

    # 3. boards
    lines += ['## 2. 게임 확인판 (직접 열어 볼 것)', '']
    board = 'tools/boards/longsleeve-board.cjs' if cat == 'top' else 'tools/boards/feet-board.cjs' if cat == 'shoes' else None
    if board:
        for sk in a.skin.split(','):
            png = os.path.join(out, '받기-판-피부%s.png' % sk)
            args = ['node', board, '.', png, '280', out] + ([sk] if cat == 'top' else [])
            rc, t = run(args, os.path.join(out, '받기-판-%s.log' % sk), 900)
            lines.append('- `%s`%s' % (os.path.relpath(png, ROOT), '' if rc == 0 else ' **그리기 실패**: ' + t[-300:]))
    else:
        lines.append('- 이 종류의 확인판 도구가 아직 없음')
    lines.append('')

    # 4. game checks
    if not a.no_vfg:
        vout = os.path.join(ROOT, '검증', '옷검사-%s' % shape)
        rc, t = run(['node', 'tools/verify-foundation-garments.cjs', '--only', 'matrix,probes', '--ids', '%s:%s' % (cat, shape),
                     '--records', out, '--out', vout], os.path.join(out, '받기-게임검사.log'), 5400)
        fails = [l for l in t.splitlines() if l.startswith('FAIL ')]
        lines += ['## 3. 게임 검사: %s' % (t.strip().splitlines()[-1][:200] if t.strip() else '결과 없음'), '']
        lines += ['- ' + l[5:].replace('(%s:%s + bottom:shorts + shoes:sneaker)' % (cat, shape), '')[:220] for l in fails]
        probes = sorted(glob.glob(os.path.join(vout, 'probes', '*%s*.png' % shape)))
        if probes:
            lines += ['', '검사 그림(빨강이 잡힌 픽셀):'] + ['- `%s`' % os.path.relpath(p, ROOT) for p in probes]
        lines.append('')
    lines += ['## 4. 다음', '', '- 확인판·검사 그림을 직접 본다. 허리 틈은 waist-gap 그림, 원화 탓이면 위 다시 요청 문장을 쓴다.',
              '- 좋으면 `assets/garment-sources/README.md` 행을 쓰고 커밋한다.']
    open(os.path.join(out, '받기-요약.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
