"""Worker guide overlay: assets/garment-template/작업자-안내도.png (stage 3, WP4).

  python3 tools/garment/guide-overlay.py           write the guide
  python3 tools/garment/guide-overlay.py --check   rebuild in memory, compare with the committed file (writes nothing)
  python3 tools/garment/guide-overlay.py --out F   write to F instead (review)

For the worker and the production guide only. It is NEVER given to ChatGPT:
ChatGPT repaints every mark it sees, so image 1 stays the clean template.

The six figures of the template (assets/garment-template/template-sheet.png,
x = sheet x + 90) are dimmed, the body and head that no garment may change
are washed grey with hatching, and the class limits are drawn from
tools/garment/frozen/limits.json (pass zones) and zones.json (geometry), with
the same functions the pipeline measures with (tools/avatar_build/limits.py):

  sleeve-end band   t_hidden (SLEEVE_SHORT) .. elbow + re (SLEEVE_LONG), along the resting upper arm
  hem band          W + .24 u (HEM_HIGH) .. hip + .25 u (HEM_LOW); W = waist cover line
  collar/shoulder   per-column highest row (COLLAR_HIGH, CAP_HIGH)
  neckline          the clean neck art (NECK_OPEN) and the centre-column zone
  shorts cuff band  legs hidden row (SHORTS_SHORT) .. knee - .42 u (SHORTS_LONG)
  shoe opening      leg art end + seam tolerance (SHOE_LOW_OPENING) .. ankle - 20 px (SHOE_HIGH)
  sole line         floor +- seam tolerance (SOLE_OFF_FLOOR)
  hair zone         reference hair lying on the garment (the girls' bob over the collar)

Every drawn pass-zone value is collected and compared with limits.json; the
run fails on any difference (the legacy-art sleeve cover bands are not drawn:
new garments use the clean arm art the user approved on 2026-10-09).
Labels use the bundled font assets/fonts/NanumSquareRoundB.ttf.
"""
import argparse
import io
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import limits  # noqa: E402
from avatar_build.common import TEMPLATE, erode, load_rgba  # noqa: E402
from avatar_build.frozen import SEAM_TOLERANCE  # noqa: E402

ROOT = os.path.dirname(TOOLS)
FZ = os.path.join(ROOT, 'tools', 'garment', 'frozen')
KIT = os.path.join(ROOT, 'assets', 'garment-template')
OUT = os.path.join(KIT, '작업자-안내도.png')
FONT = os.path.join(ROOT, 'assets', 'fonts', 'NanumSquareRoundB.ttf')
OX = TEMPLATE['left']  # sheet x -> template x
LEGEND_H = 650

NAMES = {'m-front': '남자 앞', 'm-right': '남자 옆(오른쪽)', 'm-back': '남자 뒤',
         'f-front': '여자 앞', 'f-right': '여자 옆(오른쪽)', 'f-back': '여자 뒤'}
ORDER = ('m-front', 'm-right', 'm-back', 'f-front', 'f-right', 'f-back')
C = {  # RGB
    'keep': (92, 104, 128), 'sleeve': (22, 150, 80), 'hem': (226, 132, 0), 'waist': (40, 100, 220),
    'collar': (214, 30, 120), 'cap': (200, 20, 20), 'neck': (0, 150, 180), 'cuff': (124, 60, 210),
    'shoe': (176, 82, 20), 'sole': (20, 110, 60), 'hair': (255, 140, 0), 'now': (255, 255, 255), 'ink': (30, 34, 48),
}


def font(size):
    return ImageFont.truetype(FONT, size)


class Drawn:
    """Every pass-zone value the overlay draws, keyed like limits.json passZones."""

    def __init__(self):
        self.zones = {}

    def add(self, fig, name, lo, hi):
        self.zones.setdefault(fig, {})[name] = [lo, hi, round(hi - lo, 2)]
        return lo, hi


def P(x, y):
    return (x + OX, y)


def arm_point(a, t, c):
    sh, ax, nr = np.array(a['shoulder']), np.array(a['axis']), np.array(a['normal'])
    p = sh + ax * t + nr * c
    return P(float(p[0]), float(p[1]))


def dashed(d, pts, fill, width=2, dash=6, gap=4):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(np.hypot(x1 - x0, y1 - y0) // (dash + gap)))
        for i in range(n + 1):
            a = i * (dash + gap) / max(1e-6, np.hypot(x1 - x0, y1 - y0))
            b = min(1.0, a + dash / max(1e-6, np.hypot(x1 - x0, y1 - y0)))
            if a >= 1:
                break
            d.line([(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a), (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)], fill=fill, width=width)


def runs(points):
    """Split (x, y) points into runs of consecutive columns."""
    out, cur = [], []
    for p in points:
        if cur and p[0] - cur[-1][0] > 1:
            out.append(cur); cur = []
        cur.append(p)
    if cur:
        out.append(cur)
    return out


def hatch(mask, step=7):
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w]
    return mask & ((xx + yy) % step == 0)


def base_image(labels, hair):
    T = np.asarray(Image.open(os.path.join(KIT, 'template-sheet.png')).convert('RGB')).astype(np.float32)
    out = T * .42 + 255 * .58
    body = np.zeros(T.shape[:2], bool)
    body[:, OX:OX + labels.shape[1]] = np.isin(labels, (3, 5, 7, 8))
    out[body] = out[body] * .7 + np.array(C['keep'], np.float32) * .3
    out[hatch(body, 9)] = out[hatch(body, 9)] * .35 + np.array(C['keep'], np.float32) * .65
    hz = np.zeros(T.shape[:2], bool)
    hz[:, OX:OX + labels.shape[1]] = hair
    out[hz] = out[hz] * .45 + np.array(C['hair'], np.float32) * .55
    out[hatch(hz, 4)] = np.array(C['hair'], np.float32) * .7
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def leg_end(legs_alpha, x, y0, y1):
    r = np.nonzero(legs_alpha[y0:y1, x])[0]
    return int(r.max() + y0 + 1) if len(r) else None


def draw_figure(d, over, key, g, lim, drawn, legs_alpha, neck_win):
    pz = lim['passZones'][key]
    basic = lim['basic'][key]['top/short-sleeve']
    # Sleeve-end band (clean arm art).
    for a in g['arms']:
        name = 'sleeve arm%d (clean art)' % a['i']
        lo, hi = drawn.add(key, name, round(float(limits.t_hidden(a, 0)), 2), a['tCap'])
        w = a['half'] * 2.4
        quad = [arm_point(a, lo, -w), arm_point(a, lo, w), arm_point(a, hi, w), arm_point(a, hi, -w)]
        over.polygon(quad, fill=C['sleeve'] + (80,))
        d.line([arm_point(a, lo, -w), arm_point(a, lo, w)], fill=C['sleeve'], width=3)
        d.line([arm_point(a, hi, -w), arm_point(a, hi, w)], fill=C['cap'], width=3)
        now = basic['SLEEVE_SHORT']['arm%d' % a['i']]['t']
        d.line([arm_point(a, now, -w * .7), arm_point(a, now, w * .7)], fill=C['now'], width=2)
    # Hem band and the waist cover line W. The band's top is the per-column
    # HEM_HIGH need (W + .24 u); its maximum is the pass-zone value.
    cols = [c for c in g['hem']['columns'] if not c[3]]
    if 'hem' in pz:
        off, over_px = g['hem']['waistCoverOffsetPx'], g['hem']['overlapU'] / g['k']
        need = [(x, st - off + over_px) for x, hb, st, armed in cols]
        lo, hi = drawn.add(key, 'hem', round(max(n for x, n in need), 2), g['hem']['hemLowRow'])
        for run in runs(need):
            if len(run) < 2:
                continue
            over.polygon([P(x, n) for x, n in run] + [P(run[-1][0], hi), P(run[0][0], hi)], fill=C['hem'] + (80,))
            d.line([P(x, n) for x, n in run], fill=C['hem'], width=2)
            d.line([P(run[0][0], hi), P(run[-1][0], hi)], fill=C['cap'], width=2)
        for run in runs([(x, st - off) for x, hb, st, armed in g['hem']['columns']]):
            dashed(d, [P(x, y) for x, y in run], C['waist'], width=2)
    # Collar / shoulder / sleeve-crown limit per outline column.
    pts = {'COLLAR_HIGH': [], 'CAP_HIGH': []}
    for x, ub, zone, hid, cut_row, s_row in g['upper']['columns']:
        if hid:
            continue
        name, row = limits._upper_limit(g, x, ub, zone, cut_row, s_row)
        pts[name].append((x, row))
    for name, col in (('COLLAR_HIGH', C['collar']), ('CAP_HIGH', C['cap'])):
        for run in runs(sorted(pts[name])):
            if len(run) > 1:
                d.line([P(x, y) for x, y in run], fill=col, width=2)
            else:
                d.ellipse([P(run[0][0] - 1.5, run[0][1] - 1.5), P(run[0][0] + 1.5, run[0][1] + 1.5)], fill=col)
    # Neckline: the clean neck art window and the centre-column zone.
    x0, y0, x1, y1 = g['cell']
    win = neck_win[y0:y1, x0:x1]
    edge = win & ~erode(win, 1)
    ys, xs = np.nonzero(edge)
    for y, x in zip(ys, xs):
        d.point(P(x + x0, y + y0), fill=C['neck'])
    nz = [k for k in pz if k.startswith('neckline')]
    if nz:
        cx = g['neck']['centerColumn']
        ub = next(c[1] for c in g['upper']['columns'] if c[0] == cx)
        lo, hi = drawn.add(key, nz[0], round(-g['upper']['allowPx'], 2), g['neck']['centerDepthPx'])
        d.line([P(cx, ub + lo), P(cx, ub + hi)], fill=C['neck'], width=3)
        for yy in (ub + lo, ub + hi):
            d.line([P(cx - 5, yy), P(cx + 5, yy)], fill=C['neck'], width=2)
    # Shorts cuff band.
    for lg in g['legs']:
        lo, hi = drawn.add(key, 'shorts cuff leg%d' % lg['i'], lg['hiddenRow'], lg['longRow'])
        c0, c1 = lg['cols'][0] - 9, lg['cols'][1] + 9
        over.rectangle([P(c0, lo), P(c1, hi)], fill=C['cuff'] + (80,))
        d.line([P(c0, lo), P(c1, lo)], fill=C['cuff'], width=2)
        d.line([P(c0, hi), P(c1, hi)], fill=C['cap'], width=2)
    # Shoe opening band (leg art end + seam .. ankle - 20) and the sole line.
    for ft in g['feet']:
        c0, c1 = ft['cols'][0] - 8, ft['cols'][1] + 8
        lo, hi = drawn.add(key, 'shoe sole foot%d' % ft['i'], g['floor'] - SEAM_TOLERANCE, g['floor'] + SEAM_TOLERANCE)
        over.rectangle([P(c0 - 4, lo), P(c1 + 4, hi)], fill=C['sole'] + (110,))
        ends = [(x, leg_end(legs_alpha, x, y0, y1)) for x in range(ft['cols'][0], ft['cols'][1] + 1)]
        ends = [(x, e + SEAM_TOLERANCE) for x, e in ends if e is not None]
        if ends:
            over.polygon([P(x, ft['highRow']) for x, e in ends] + [P(x, e) for x, e in reversed(ends)], fill=C['shoe'] + (70,))
            d.line([P(x, e) for x, e in ends], fill=C['shoe'], width=3)
        d.line([P(c0, ft['highRow']), P(c1, ft['highRow'])], fill=C['cap'], width=2)
    # Caption.
    d.rounded_rectangle([P(x0 - 80, y0 + 8), P(x0 + 70, y0 + 40)], radius=8, fill=(255, 255, 255), outline=C['ink'], width=2)
    d.text(P(x0 - 70, y0 + 13), NAMES[key], fill=C['ink'], font=font(19))


def legend(width, lim, drawn):
    im = Image.new('RGB', (width, LEGEND_H), (250, 248, 242))
    d = ImageDraw.Draw(im)
    big, mid, small = font(26), font(19), font(16)
    d.text((24, 16), '작업자·안내서 전용 그림입니다. ChatGPT에는 절대 올리지 않습니다 (그림 틀은 표시 없는 template-sheet.png).', fill=(170, 20, 40), font=big)
    d.text((24, 54), '값은 tools/garment/frozen/limits.json에서 그렸습니다 (그림 틀 px: 세로는 그대로, 가로는 기준 시트 +90). '
                     '빨간 선은 넘으면 안 되는 끝입니다.', fill=C['ink'], font=small)
    items = [
        ('keep', 'hatch', '그대로 두는 몸·머리: 얼굴·머리카락·목·팔·다리. 업로드에서는 상품 옷만 가져옵니다.'),
        ('sleeve', 'band', '소매 끝 범위: 위 = 팔 그림이 시작되는 줄(더 짧으면 복사한 피부가 드러남), 아래(빨강) = 팔꿈치 + 접힌 팔 둥근 끝.'),
        ('now', 'tick', '흰 눈금 = 지금 기본 소매 끝. 프롬프트는 "지금과 같거나 아주 조금 더 길게, 더 짧게는 안 됨"입니다.'),
        ('hem', 'band', '밑단 범위: 위 = 허리 덮개선 + .24u(앉아 숨쉴 때도 반바지 허리를 덮음), 아래(빨강) = 엉덩이 관절 + .25u.'),
        ('waist', 'dash', '파란 점선 = 허리 덮개선: 반바지는 여기까지 위로 이어 그려져 윗옷 밑에 숨습니다.'),
        ('collar', 'line', '깃·어깨 높이 한계: 남자·옆모습은 머리 아래, 여자 앞·뒤는 단발이 덮을 여유(.10 머리 단위)를 남기는 선.'),
        ('cap', 'line', '빨간 선 = 넘으면 안 되는 끝(소매 아래 끝, 밑단 아래 끝, 바짓단 아래 끝, 신발 입구 위, 어깨 바깥 소매 윗부분).'),
        ('neck', 'line', '목선 한계: 맨살은 청록 윤곽(목 그림) 안에서만 보일 수 있습니다. 가운데 세로 눈금 = 깃 높이 여유 ~ 목 그림 끝.'),
        ('cuff', 'band', '반바지 단 범위: 위 = 다리 그림의 복사 줄 끝(더 짧으면 이음·옛 단 선이 보임), 아래(빨강) = 무릎 - .42u.'),
        ('shoe', 'line', '신발 입구 아래 한계(갈색) = 다리 그림 끝 + 3px: 더 낮게 파면 다리 끝이 보입니다. 빨강 = 발목 - 20px(부츠 금지). 사이의 갈색 칸에 입구가 와야 합니다.'),
        ('sole', 'band', '밑창선: 바닥 ± 3px 안에 밑창이 닿아야 합니다.'),
        ('hair', 'hatch', '머리카락에 가려지는 옷(주로 여자 단발): 이 안은 보이지 않으므로 파이프라인이 규칙으로 채웁니다.'),
    ]
    y = 88
    for key, kind, text in items:
        col = C[key]
        if kind == 'band':
            d.rectangle([24, y + 4, 64, y + 20], fill=tuple(int(v * .45 + 255 * .55) for v in col), outline=col, width=2)
        elif kind == 'hatch':
            d.rectangle([24, y + 4, 64, y + 20], fill=tuple(int(v * .4 + 255 * .6) for v in col))
            for i in range(-16, 41, 6):
                d.line([(24 + max(0, i), y + 20 - max(0, -i)), (24 + min(40, i + 16), y + 4 + max(0, i + 16 - 40))], fill=col, width=1)
        elif kind == 'dash':
            for i in range(24, 64, 10):
                d.line([(i, y + 12), (i + 6, y + 12)], fill=col, width=3)
        elif kind == 'tick':
            d.rectangle([24, y + 4, 64, y + 20], fill=(150, 150, 150))
            d.line([(44, y + 4), (44, y + 20)], fill=col, width=3)
        else:
            d.line([(24, y + 12), (64, y + 12)], fill=col, width=4)
        d.text((76, y + 2), text, fill=C['ink'], font=small)
        y += 26
    # Pass-zone table (the drawn values; equal to limits.json).
    y += 8
    d.text((24, y), '통과 범위(그린 값 = limits.json passZones)', fill=C['ink'], font=mid)
    y += 30
    rows = [('소매 끝 팔0 (어깨에서 px)', 'sleeve arm0 (clean art)'), ('소매 끝 팔1', 'sleeve arm1 (clean art)'),
            ('밑단 (줄)', 'hem'), ('반바지 단 다리0 (줄)', 'shorts cuff leg0'), ('반바지 단 다리1', 'shorts cuff leg1'),
            ('밑창 (줄)', 'shoe sole foot0'), ('목선 가운데 (깃에서 위 -, 아래 +)', None)]
    colx = [24] + [330 + i * 212 for i in range(len(ORDER))]
    for i, key in enumerate(ORDER):
        d.text((colx[i + 1], y), NAMES[key], fill=C['ink'], font=small)
    y += 22
    for label, name in rows:
        d.text((colx[0], y), label, fill=C['ink'], font=small)
        for i, key in enumerate(ORDER):
            z = drawn.zones.get(key, {})
            k = name if name else next((n for n in z if n.startswith('neckline')), None)
            v = z.get(k) if k else None
            d.text((colx[i + 1], y), '%g – %g' % (v[0], v[1]) if v else '—', fill=C['ink'], font=small)
        y += 21
    return im


def compare(drawn, lim):
    """Drawn pass zones vs limits.json (legacy-art cover bands are not drawn)."""
    problems, n = [], 0
    for key, zones in lim['passZones'].items():
        for name, want in zones.items():
            if 'legacy art' in name:
                continue
            got = drawn.zones.get(key, {}).get(name)
            n += 1
            if got is None:
                problems.append('%s %s: not drawn' % (key, name))
            elif [round(float(v), 2) for v in got] != [round(float(v), 2) for v in want]:
                problems.append('%s %s: drawn %s, limits.json %s' % (key, name, got, want))
    for key, zones in drawn.zones.items():
        for name in zones:
            if name not in lim['passZones'].get(key, {}):
                problems.append('%s %s: drawn but not in limits.json' % (key, name))
    return n, problems


def build():
    zones = json.load(open(os.path.join(FZ, 'zones.json'), encoding='utf-8'))
    lim = json.load(open(os.path.join(FZ, 'limits.json'), encoding='utf-8'))
    labels = np.asarray(Image.open(os.path.join(FZ, 'owner-map.png')))
    hair = np.asarray(Image.open(os.path.join(FZ, 'hair-occlusion.png'))) > 0
    legs_alpha = load_rgba(os.path.join(ROOT, 'assets', 'sd-foundation-ref-legs.png'))[..., 3] > 127
    neck_win = erode(load_rgba(os.path.join(ROOT, 'assets', 'sd-foundation-ref-neck-clean.png'))[..., 3] > 200, 1)
    figure = base_image(labels, hair).convert('RGBA')
    over_img = Image.new('RGBA', figure.size, (0, 0, 0, 0))
    over = ImageDraw.Draw(over_img)
    line_img = Image.new('RGBA', figure.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(line_img)
    drawn = Drawn()
    for key in ORDER:
        draw_figure(d, over, key, zones['figures'][key], lim, drawn, legs_alpha, neck_win)
    figure.alpha_composite(over_img)
    figure.alpha_composite(line_img)
    page = Image.new('RGB', (figure.width, figure.height + LEGEND_H), (255, 255, 255))
    page.paste(figure.convert('RGB'), (0, 0))
    page.paste(legend(figure.width, lim, drawn), (0, figure.height))
    n, problems = compare(drawn, lim)
    return page, n, problems, drawn


def encode(image):
    buf = io.BytesIO()
    image.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--out')
    args = ap.parse_args(argv)
    page, n, problems, drawn = build()
    data = encode(page)
    status = {'size': list(page.size), 'passZonesCompared': n, 'problems': problems}
    if args.check:
        same = os.path.exists(OUT) and open(OUT, 'rb').read() == data
        status['committedIdentical'] = same
        if not same:
            problems.append('작업자-안내도.png is not what guide-overlay.py draws now (rerun it)')
    else:
        target = args.out or OUT
        with open(target, 'wb') as fh:
            fh.write(data)
        status['written'] = os.path.relpath(target, ROOT) if not os.path.relpath(target, ROOT).startswith('..') else target
    print(json.dumps(status, ensure_ascii=False, indent=1))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
