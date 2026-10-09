"""Korean registration report of an uploaded garment sheet (stage 3, WP5).

  python3 tools/garment/report.py --sheet assets/garment-sources/top-shirt-10-chatgpt-2026-10-09.webp \
      --product top:shirt [--out 검증/옷/top-shirt] [--slot top] [--sexes m,f]

Registers the sheet (tools/avatar_build/register.py) and writes to --out
(default 검증/옷/<cat>-<shape>/, not committed):

  등록-보고.png  per figure the registered upload with the frozen body outline
                (cyan), checked parts in green (orange: warning, red: failed,
                with the measured offset), the result line ('통과 (6/6)' or
                '다시 요청이 필요해요 (6개 중 n개 통과)'), 1-3 Korean bullets
                and the copy-ready ChatGPT sentences. Marked 배포 전.
  보고.md       the same in text, with the registration table and the input
                record (format, encoder, ICC, calibration column)
  보고.json     the registration result (no images) and the texts

All texts come from tools/garment/messages.json. The worker opens the PNG
before sending it; an automatic pass is not an art approval.
"""
import argparse
import datetime
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # no __pycache__ in the repo
sys.path.insert(0, TOOLS)
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402

ROOT = os.path.dirname(TOOLS)
MESSAGES = os.path.join(TOOLS, 'garment', 'messages.json')
PRODUCTS = os.path.join(ROOT, 'assets', 'garment-template', 'products.json')
FONT_R = os.path.join(ROOT, 'assets', 'fonts', 'NanumSquareRoundR.ttf')
FONT_B = os.path.join(ROOT, 'assets', 'fonts', 'NanumSquareRoundB.ttf')
FONT_EB = os.path.join(ROOT, 'assets', 'fonts', 'NanumSquareRoundEB.ttf')

GREEN, ORANGE, RED, CYAN = (24, 150, 70), (230, 140, 0), (215, 40, 40), (0, 190, 220)
INK, GREY, PAPER = (35, 40, 55), (110, 115, 130), (255, 255, 255)


def load_messages(path=MESSAGES):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# Korean text
# ---------------------------------------------------------------------------
_DIGIT_BATCHIM = {'0': True, '1': True, '2': False, '3': True, '4': False, '5': False, '6': True, '7': True,
                  '8': True, '9': False}


def _batchim(word):
    """(has final consonant, the final is rieul) of the last pronounced char."""
    for ch in reversed(word.strip()):
        if '가' <= ch <= '힣':
            jong = (ord(ch) - 0xAC00) % 28
            return jong != 0, jong == 8
        if ch.isdigit():
            return _DIGIT_BATCHIM[ch], ch in '178'
        if ch.isalpha():
            return False, False
    return False, False


def josa(word, particle):
    has, rieul = _batchim(word)
    pairs = {'은': ('은', '는'), '는': ('은', '는'), '이': ('이', '가'), '가': ('이', '가'), '을': ('을', '를'),
             '를': ('을', '를'), '와': ('과', '와'), '과': ('과', '와')}
    if particle in pairs:
        return word + (pairs[particle][0] if has else pairs[particle][1])
    if particle in ('로', '으로'):
        return word + ('으로' if has and not rieul else '로')
    return word + particle


def fill(template, ctx):
    """Replace {name} and {name|particle} placeholders."""
    if template is None:
        return None
    out, i = '', 0
    while i < len(template):
        j = template.find('{', i)
        if j < 0:
            out += template[i:]
            break
        k = template.index('}', j)
        out += template[i:j]
        key = template[j + 1:k]
        name, _, part = key.partition('|')
        val = str(ctx.get(name, ''))
        out += josa(val, part) if part else val
        i = k + 1
    return out


def figures_ko(keys, msgs):
    keys = [k for k in R.FIG_KO if k in (keys or [])]
    if not keys:
        return ''
    if len(keys) == 6:
        return '여섯 그림 모두'
    by = {}
    for k in keys:
        by.setdefault(k[0], []).append(k)
    parts = []
    for sex, ks in by.items():
        child = msgs['children'][sex]
        if len(ks) == 3:
            parts.append('%s 세 모습' % child)
        else:
            views = [msgs['figures'][k].split(' ', 1)[1] for k in ks]
            parts.append('%s %s' % (child, '·'.join(views)))
    return ', '.join(parts)


def _join_and(words):
    if not words:
        return ''
    if len(words) == 1:
        return words[0]
    return ', '.join(words[:-2] + [josa(words[-2], '와') + ' ' + words[-1]])


def describe(res, msgs, product_name=None):
    """The user-facing items: one per code (failures) and per warning."""
    slot = res['spec']['slot']
    sexes = res['spec']['sexes']
    product = msgs['slots'][slot]
    keep = _join_and([msgs['slots'][s] for s in ('top', 'bottom', 'shoes') if s != slot])
    child = other = ''
    if len(sexes) == 1:
        child = msgs['children'][sexes[0]]
        other = msgs['children']['f' if sexes[0] == 'm' else 'm']
    items = []
    for level, codes in (('fail', res['codes']), ('warn', res['warnings'])):
        for c in codes:
            spec = msgs['codes'].get(c['code'])
            if spec is None:
                raise KeyError('messages.json has no entry for code %s' % c['code'])
            figs = c.get('figures') or ([c['figure']] if c.get('figure') else [])
            part = c.get('part')
            if c['code'] == 'BODY_DRIFT' and part in ('leg', 'arm'):
                part_ko = msgs['slots'][part]
            else:
                part_ko = msgs['parts'].get(part, part or '')
            value = c.get('value')
            if c['code'] in ('FIGURE_SCALE', 'W_SCALE') and isinstance(value, (int, float)):
                value_ko = '%+.1f%%' % (100 * value)
            elif isinstance(value, (int, float)):
                value_ko = ('%.1f' % value).rstrip('0').rstrip('.') if isinstance(value, float) else str(value)
            else:
                value_ko = ''
            ctx = dict(figures=figures_ko(figs, msgs), part=part_ko, value=value_ko, product=product, keep=keep,
                       changed=msgs['slots'].get(c.get('slot') or part, ''), child=child, other=other,
                       detail=c.get('detail', ''))
            message = spec['message']
            if c['code'] == 'LAYOUT_COUNT' and c.get('kind') in spec.get('messageByKind', {}):
                message = spec['messageByKind'][c['kind']] + ' ' + spec['message']
            items.append(dict(code=c['code'], level=spec['level'] if level == 'fail' else 'warn',
                              title=spec['title'], message=fill(message, ctx),
                              retry=fill(spec.get('retry'), ctx) if level == 'fail' else None,
                              figures=figs, part=part, detail=c.get('detail')))
    return items


def passing_figures(res):
    if any(c['code'] in ('SIZE_SMALL', 'BACKGROUND', 'SQUASH') or ('figure' not in c and 'figures' not in c)
           for c in res['codes']):
        return []
    bad = set()
    for c in res['codes']:
        bad.update(c.get('figures') or [c.get('figure')])
    return [k for k in R.FIG_KO if k not in bad and k in res['figures']]


# ---------------------------------------------------------------------------
# Image
# ---------------------------------------------------------------------------
def _font(path, size):
    return ImageFont.truetype(path, size)


def _wrap(draw, text, font, width):
    lines = []
    for para in text.split('\n'):
        cur = ''
        for word in para.split(' '):
            trial = (cur + ' ' + word) if cur else word
            if draw.textlength(trial, font=font) <= width:
                cur = trial
                continue
            if cur:
                lines.append(cur)
            # a single word longer than the width: break by characters
            while draw.textlength(word, font=font) > width:
                n = len(word)
                while n > 1 and draw.textlength(word[:n], font=font) > width:
                    n -= 1
                lines.append(word[:n])
                word = word[n:]
            cur = word
        lines.append(cur)
    return lines


def _text_block(draw, xy, text, font, width, fill_=INK, gap=6):
    x, y = xy
    for line in _wrap(draw, text, font, width):
        draw.text((x, y), line, font=font, fill=fill_)
        y += font.size + gap
    return y


def _outline(mask):
    return mask & ~M.erode(mask, 1)


def _fig_state(res, key):
    for c in res['codes']:
        if key in (c.get('figures') or [c.get('figure')]):
            return 'fail'
    for w in res['warnings']:
        if w.get('figure') == key:
            return 'warn'
    return 'ok'


def _panel(res, spec, key, msgs, scale):
    """One figure: registered upload, frozen outline, part boxes."""
    reg = res['images']['registered']
    x0, y0, x1, y1 = spec['cells'][key]
    rgb = reg[y0:y1, x0:x1, :3].copy()
    a = reg[y0:y1, x0:x1, 3:] / 255
    base = rgb * a + 255 * (1 - a)
    tfg = spec['templateFg'][y0:y1, x0:x1]
    line = _outline(tfg) | _outline(M.erode(tfg, 1))
    base[line] = base[line] * .25 + np.array(CYAN) * .75
    im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    if scale != 1:
        im = im.resize((int(round(im.width * scale)), int(round(im.height * scale))), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    small = _font(FONT_B, 15)
    fr = res['figures'][key]
    failing_parts = {(c.get('part')) for c in res['codes'] if c.get('figure') == key}
    for p in fr.get('parts', []):
        bx0, by0, bx1, by1 = [v for v in p['bbox']]
        bx0, bx1 = (bx0 - x0) * scale, (bx1 - x0) * scale
        by0, by1 = (by0 - y0) * scale, (by1 - y0) * scale
        name = p['part'] + p['side']
        col = GREEN if p['state'] == 'ok' else (ORANGE if p['state'] == 'warn' else RED)
        if p['part'] == 'torso':
            col = GREEN if p['state'] == 'ok' else ORANGE
        d.rectangle((bx0 - 2, by0 - 2, bx1 + 2, by1 + 2), outline=col, width=2 if col == GREEN else 3)
        if col != GREEN or name in failing_parts:
            label = '%s %.1fpx' % (msgs['parts'].get(name, name), p['shift'])
            tw = d.textlength(label, font=small)
            lx = min(max(0, bx0), im.width - tw - 4)
            d.rectangle((lx, by1 + 3, lx + tw + 6, by1 + 22), fill=(255, 255, 255))
            d.text((lx + 3, by1 + 4), label, font=small, fill=col)
    # slot / floor / hair findings
    owner = spec['owner'][y0:y1, x0:x1]
    for c in res['codes']:
        figs = c.get('figures') or [c.get('figure')]
        if key not in figs:
            continue
        box = None
        if c['code'] in ('OTHER_SLOT_CHANGED', 'SINGLE_SEX_CHANGED') and c.get('part'):
            labels_ = {'top': (1, 2), 'bottom': (4,), 'shoes': (6,), 'leg': (5,), 'arm': (3,)}.get(c['part'])
            if labels_:
                ys, xs = np.nonzero(np.isin(owner, labels_))
                if len(xs):
                    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        elif c['code'] == 'SHADOW':
            fl = spec['zones'][key]['floor'] - y0
            box = (0, fl - 14, x1 - x0, y1 - y0 - 1)
        elif c['code'] == 'HAIR_OVER_GARMENT':
            ys, xs = np.nonzero(spec['productMask'][y0:y1, x0:x1])
            if len(xs):
                box = (xs.min(), ys.min(), xs.max() + 1, min(ys.max() + 1, ys.min() + 80))
        elif c['code'] in ('BODY_DRIFT', 'FIGURE_SCALE', 'LAYOUT_MOVED') and c.get('part') not in ('leg', 'arm'):
            ys, xs = np.nonzero(tfg)
            box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        if box is not None:
            bx0, by0, bx1, by1 = [v * scale for v in box]
            d.rectangle((bx0, by0, bx1, by1), outline=RED, width=3)
            label = msgs['codes'][c['code']]['title']
            tw = d.textlength(label, font=small)
            d.rectangle((bx0, by0, bx0 + tw + 8, by0 + 20), fill=RED)
            d.text((bx0 + 4, by0 + 2), label, font=small, fill=(255, 255, 255))
    return im


def _zooms(img, d, res, spec, msgs, tx, ty, width, H, n=2, zoom=2.5):
    """Close-ups of the failing parts: the registered upload with the
    frozen outline (cyan) at `zoom` x, so the offset is visible."""
    reg = res['images']['registered']
    tfg = spec['templateFg']
    shown = 0
    small = _font(FONT_B, 15)
    for c in res['codes']:
        if c['code'] not in ('POSE_ARM', 'POSE_LEG') or shown >= n:
            continue
        fr = res['figures'][c['figure']]
        p = next((q for q in fr['parts'] if q['part'] + q['side'] == c['part']), None)
        if p is None:
            continue
        x0, y0, x1, y1 = p['bbox']
        x0, y0, x1, y1 = x0 - 14, y0 - 14, x1 + 14, y1 + 14
        crop = reg[y0:y1, x0:x1]
        a = crop[..., 3:] / 255
        base = crop[..., :3] * a + 255 * (1 - a)
        t = tfg[y0:y1, x0:x1]
        line = _outline(t)
        base[line] = base[line] * .2 + np.array(CYAN) * .8
        im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
        w = int(min(width / 2 - 8, im.width * zoom))
        h = int(round(im.height * w / im.width))
        if ty + h + 30 > H - 10:
            break
        im = im.resize((w, h), Image.NEAREST)
        x = tx + shown * (width // 2)
        d.text((x, ty), '확대: %s %s' % (msgs['figures'][c['figure']], msgs['parts'].get(c['part'], c['part'])),
               font=small, fill=RED)
        img.paste(im, (x, ty + 22))
        d.rectangle((x - 1, ty + 21, x + w, ty + 22 + h), outline=RED, width=2)
        shown += 1
        bottom = ty + 22 + h
    if shown:
        ty = bottom + 16
    return ty


def render_png(res, items, path, header):
    msgs = header['messages']
    spec = header['spec']
    W_TEXT = 470
    pad = 16
    title_f = _font(FONT_EB, 34)
    big = _font(FONT_B, 21)
    body = _font(FONT_R, 19)
    small = _font(FONT_R, 16)
    smallb = _font(FONT_B, 16)
    registered = 'images' in res and 'registered' in res['images']
    scale = .8
    if registered:
        cols = [spec['cells'][k] for k in R.LAYOUT[0]]
        pw = [int(round((c[2] - c[0]) * scale)) for c in cols]
        ph = [int(round((spec['cells'][r[0]][3] - spec['cells'][r[0]][1]) * scale)) for r in R.LAYOUT]
        body_w = sum(pw) + 2 * (pad // 2 + 4)
        body_h = sum(ph) + 2 * 48 + 30
    else:
        up = res.get('images', {}).get('upload')
        if up is None:
            up = np.asarray(Image.open(res['input']['path']).convert('RGB')).astype(np.float32)
        thumb_w = 980
        th = int(round(up.shape[0] * thumb_w / up.shape[1]))
        body_w, body_h = thumb_w, th + 10
    W = pad + body_w + pad + W_TEXT + pad
    H = 150 + max(body_h, 900) + pad
    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)
    # header
    passed = passing_figures(res)
    ok = res['ok']
    title = '통과 (6/6)' if ok else '다시 요청이 필요해요 (6개 중 %d개 통과)' % len(passed)
    d.text((pad, 14), title, font=title_f, fill=GREEN if ok else RED)
    badge = '배포 전 · 체험용 검사 결과'
    bw = d.textlength(badge, font=big)
    d.rounded_rectangle((W - pad - bw - 24, 16, W - pad, 52), radius=10, fill=(255, 236, 200), outline=ORANGE, width=2)
    d.text((W - pad - bw - 12, 22), badge, font=big, fill=(150, 80, 0))
    rec = res['input']
    enc = rec.get('encoder', {})
    line1 = '%s  ·  %s  ·  %s' % (header['product'], os.path.basename(rec['path']), header['date'])
    line2 = '%dx%d %s %s  ·  ICC %s  ·  보정 기준 %s  ·  sha256 %s…' % (
        rec['size'][0], rec['size'][1], enc.get('container', ''), enc.get('codec', enc.get('quality', '')),
        rec['icc'].get('description') or '없음', '손실 압축' if rec.get('calibration') == 'lossy' else 'PNG(무손실)',
        rec['sha256'][:12])
    d.text((pad, 62), line1, font=body, fill=INK)
    d.text((pad, 88), line2, font=small, fill=GREY)
    if res.get('global'):
        g = res['global']
        line3 = '전체 맞춤: 배율 %.5f (기대 %.5f, 차이 %+.3f%%), 위치 차이 %+.2f/%+.2f px  ·  %.1f초' % (
            g['s'], g['nominal']['s'], 100 * g['vsNominal']['scale'], g['vsNominal']['dx'], g['vsNominal']['dy'],
            res['timing']['total'])
    else:
        line3 = '맞춤 전에 멈췄어요  ·  %.1f초' % res['timing']['total']
    d.text((pad, 112), line3, font=small, fill=GREY)
    y_top = 150
    # body
    if registered:
        y = y_top
        for r, row in enumerate(R.LAYOUT):
            x = pad
            for c, key in enumerate(row):
                st = _fig_state(res, key)
                col = {'ok': GREEN, 'warn': ORANGE, 'fail': RED}[st]
                fr = res['figures'][key]
                lab = '%s  %s' % (msgs['figures'][key], {'ok': '통과', 'warn': '통과(경고)', 'fail': '다시'}[st])
                d.text((x, y + 2), lab, font=big, fill=col)
                nums = '배율 %+.2f%% · 최대 %.2fpx · 색차 %.1f/%.1f' % (
                    100 * (fr['sRel'] - 1), fr['maxPx'], fr.get('dE', float('nan')), fr.get('dEp95', float('nan')))
                d.text((x, y + 27), nums, font=_font(FONT_R, 13), fill=GREY)
                panel = _panel(res, spec, key, msgs, scale)
                img.paste(panel, (x, y + 46))
                d.rectangle((x - 1, y + 45, x + panel.width, y + 46 + panel.height), outline=col, width=2)
                x += pw[c] + pad // 2 + 4
            y += ph[r] + 48
        d.text((pad, y + 4), '하늘색 선: 고정된 기준 몸  ·  초록: 맞음  ·  주황: 경고  ·  빨강: 다시 요청',
               font=small, fill=GREY)
    else:
        up = res.get('images', {}).get('upload')
        if up is None:
            up = np.asarray(Image.open(res['input']['path']).convert('RGB')).astype(np.float32)
        th = int(round(up.shape[0] * thumb_w / up.shape[1]))
        t = Image.fromarray(np.clip(up, 0, 255).astype(np.uint8)).resize((thumb_w, th), Image.LANCZOS)
        img.paste(t, (pad, y_top))
        d.rectangle((pad - 1, y_top - 1, pad + thumb_w, y_top + th), outline=RED, width=2)
        sc = thumb_w / up.shape[1]
        for key, box in res.get('layout', {}).get('boxes', {}).items():
            bx0, by0, bx1, by1 = [v * sc for v in box]
            bad = any(key in (c.get('figures') or []) for c in res['codes'])
            col = RED if bad else GREEN
            d.rectangle((pad + bx0, y_top + by0, pad + bx1, y_top + by1), outline=col, width=3)
            label = '%s 자리' % msgs['figures'][key]
            tw = d.textlength(label, font=smallb)
            d.rectangle((pad + bx0 + 2, y_top + by0 + 2, pad + bx0 + tw + 10, y_top + by0 + 22), fill=(255, 255, 255))
            d.text((pad + bx0 + 6, y_top + by0 + 4), label, font=smallb, fill=col)
        for box in res.get('marks', {}).get('boxes', []):
            bx0, by0, bx1, by1 = [v * sc for v in box]
            d.rectangle((pad + bx0 - 3, y_top + by0 - 3, pad + bx1 + 3, y_top + by1 + 3), outline=RED, width=3)
    # text column
    tx = pad + body_w + pad
    ty = y_top
    fails = [i for i in items if i['level'] == 'fail']
    warns = [i for i in items if i['level'] == 'warn']
    if fails:
        d.text((tx, ty), '무엇이 문제인가요', font=big, fill=RED)
        ty += 34
        for i in fails[:3]:
            d.ellipse((tx + 1, ty + 7, tx + 9, ty + 15), fill=RED)
            ty = _text_block(d, (tx + 14, ty), i['title'], _font(FONT_B, 19), W_TEXT - 14, RED)
            ty = _text_block(d, (tx + 14, ty), i['message'], body, W_TEXT - 14, INK) + 8
        if len(fails) > 3:
            ty = _text_block(d, (tx, ty), '그 밖에 %d가지는 보고.md에 있어요.' % (len(fails) - 3), small, W_TEXT, GREY) + 6
        ty += 8
        d.text((tx, ty), '같은 ChatGPT 대화에 붙여 넣을 문장', font=big, fill=INK)
        ty += 34
        seen = []
        for i in fails:
            if i['retry'] and i['retry'] not in seen:
                seen.append(i['retry'])
        box_top = ty
        ty += 10
        for sentence in seen[:3]:
            ty = _text_block(d, (tx + 12, ty), sentence, _font(FONT_B, 19), W_TEXT - 24, INK) + 8
        d.rounded_rectangle((tx, box_top, tx + W_TEXT, ty + 2), radius=10, outline=(120, 140, 200), width=2)
        ty += 20
    else:
        d.text((tx, ty), '여섯 그림이 모두 기준 몸에 맞았어요', font=big, fill=GREEN)
        ty += 36
        ty = _text_block(d, (tx, ty), '다음 단계: 바뀐 옷만 잘라 내고 소매·밑단·깃·신발 높이를 검사해요(옷 만들기). '
                                     '자동 검사 통과는 그림 승인이 아니에요. 체험 화면에서 직접 보고 확인해요.',
                         body, W_TEXT, INK) + 14
    if warns:
        d.text((tx, ty), '참고(경고)', font=big, fill=ORANGE)
        ty += 32
        for i in warns[:4]:
            d.ellipse((tx + 1, ty + 6, tx + 8, ty + 13), fill=ORANGE)
            ty = _text_block(d, (tx + 14, ty), i['message'], small, W_TEXT - 14, INK) + 4
        ty += 10
    if registered:
        ty = _zooms(img, d, res, spec, msgs, tx, ty, W_TEXT, H)
    if res.get('figures'):
        d.text((tx, ty), '맞춤 수치(기준 몸 px)', font=big, fill=INK)
        ty += 32
        for key in R.FIG_KO:
            fr = res['figures'].get(key)
            if not fr:
                continue
            t = '%s  배율 %+.2f%%  최대 %.2fpx  윤곽 %.3f' % (msgs['figures'][key], 100 * (fr['sRel'] - 1), fr['maxPx'],
                                                       fr.get('stableIoU', float('nan')))
            d.text((tx, ty), t, font=small, fill=INK)
            ty += 22
        cm = res.get('matte', {}).get('collar')
        if cm:
            ty += 6
            d.text((tx, ty), '흰 깃 보존(여자아이): %.1f%%' % (100 * cm['keptShare']), font=small, fill=INK)
            ty += 22
    img.save(path, optimize=True)
    return path


# ---------------------------------------------------------------------------
# Text and JSON
# ---------------------------------------------------------------------------
def write_md(res, items, path, header):
    msgs = header['messages']
    rec = res['input']
    enc = rec.get('encoder', {})
    passed = passing_figures(res)
    L = []
    L.append('# 등록 보고: %s' % header['product'])
    L.append('')
    L.append('배포 전 · 체험용 검사 결과 (%s). 자동 검사 통과는 그림 승인이 아니다.' % header['date'])
    L.append('')
    L.append('- 결과: **%s**' % ('통과 (6/6)' if res['ok'] else '다시 요청이 필요해요 (6개 중 %d개 통과)' % len(passed)))
    L.append('- 올린 파일: `%s` (%d바이트, %dx%d)' % (rec['path'], rec['bytes'], rec['size'][0], rec['size'][1]))
    L.append('- sha256: `%s`' % rec['sha256'])
    L.append('- 형식: %s %s%s, ICC %s%s' % (
        enc.get('container', ''), enc.get('codec', ''), (' 품질 약 %s' % enc['quality']) if enc.get('quality') else '',
        rec['icc'].get('description') or '없음',
        (' (%s)' % rec['icc']['copyright']) if rec['icc'].get('copyright') else ''))
    L.append('- 보정 기준: %s' % ('손실 압축 입력(lossy) 열' if rec.get('calibration') == 'lossy' else 'PNG(무손실) 열'))
    if res.get('global'):
        g = res['global']
        L.append('- 전체 맞춤: 배율 %.6f (그림 폭 기준 %.6f, 차이 %+.3f%%), 위치 차이 %+.2f / %+.2f px' % (
            g['s'], g['nominal']['s'], 100 * g['vsNominal']['scale'], g['vsNominal']['dx'], g['vsNominal']['dy']))
    L.append('- 걸린 시간: %.1f초' % res['timing']['total'])
    L.append('')
    fails = [i for i in items if i['level'] == 'fail']
    if fails:
        L.append('## 다시 요청할 내용')
        L.append('')
        for n, i in enumerate(fails, 1):
            L.append('%d. **%s** (`%s`): %s' % (n, i['title'], i['code'], i['message']))
            if i['retry']:
                L.append('   - 붙여 넣을 문장: "%s"' % i['retry'])
        L.append('')
        L.append('### 같은 ChatGPT 대화에 붙여 넣을 문장 (한 번에)')
        L.append('')
        seen = []
        for i in fails:
            if i['retry'] and i['retry'] not in seen:
                seen.append(i['retry'])
        L.append('```')
        L.append(' '.join(seen))
        L.append('```')
        L.append('')
    warns = [i for i in items if i['level'] == 'warn']
    if warns:
        L.append('## 경고 (그대로 사용)')
        L.append('')
        for i in warns:
            L.append('- %s (`%s`)' % (i['message'], i['code']))
        L.append('')
    if res.get('figures'):
        L.append('## 그림별 맞춤 (기준 몸 px, 전체 맞춤 대비)')
        L.append('')
        L.append('| 그림 | 배율 차이 | dx | dy | 관절 최대 차이 | 색 차이 중앙/95% | 윤곽 IoU | 상태 |')
        L.append('|---|---|---|---|---|---|---|---|')
        for key in R.FIG_KO:
            fr = res['figures'].get(key)
            if not fr:
                continue
            st = {'ok': '통과', 'warn': '경고', 'fail': '다시'}[_fig_state(res, key)]
            L.append('| %s | %+.3f%% | %+.2f | %+.2f | %.2f | %.2f / %.2f | %.3f | %s |' % (
                msgs['figures'][key], 100 * (fr['sRel'] - 1), fr['dx'], fr['dy'], fr['maxPx'], fr.get('dE', float('nan')),
                fr.get('dEp95', float('nan')), fr.get('stableIoU', float('nan')), st))
        L.append('')
        slots = []
        for key in R.FIG_KO:
            fr = res['figures'].get(key)
            if fr and fr.get('slots'):
                slots.append('%s: %s' % (msgs['figures'][key], ', '.join(
                    '%s %.0f%%' % (msgs['slots'].get(n, n), 100 * v['share']) for n, v in fr['slots'].items())))
        if slots:
            L.append('다른 부분이 다시 그려진 비율(흐린 색 차이 10 넘는 픽셀, 한계 반바지 30%·신발 20%·윗옷 30%·다리 5%·팔 10%):')
            L.append('')
            for s_ in slots:
                L.append('- ' + s_)
            L.append('')
    if res.get('explained'):
        L.append('## 다른 문제로 설명되어 따로 요청하지 않는 항목')
        L.append('')
        for c in res['explained']:
            L.append('- `%s` %s (%s)' % (c['code'], c.get('detail', ''), c.get('explainedBy')))
        L.append('')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))
    return path


def product_info(product):
    parts = product.split(':')
    cat, shape = parts[0], parts[1] if len(parts) > 1 else ''
    slot = {'top': 'top', 'bottom': 'bottom', 'shoes': 'shoes'}.get(cat, 'top')
    sexes = ['m', 'f']
    try:
        prods = json.load(open(PRODUCTS, encoding='utf-8'))['products']
        p = prods.get('%s:%s' % (cat, shape))
        if p:
            sexes = p.get('sexes', sexes)
    except (OSError, ValueError, KeyError):
        pass
    return cat, shape, slot, sexes


def report(res, out_dir, product, msgs=None, spec=None, date=None):
    msgs = msgs or load_messages()
    spec = spec or R.garment_spec(res['spec']['slot'], tuple(res['spec']['sexes']))
    os.makedirs(out_dir, exist_ok=True)
    header = dict(product=product, date=date or datetime.date.today().isoformat(), messages=msgs, spec=spec)
    items = describe(res, msgs)
    png = render_png(res, items, os.path.join(out_dir, '등록-보고.png'), header)
    md = write_md(res, items, os.path.join(out_dir, '보고.md'), header)
    js = os.path.join(out_dir, '보고.json')
    with open(js, 'w', encoding='utf-8') as fh:
        json.dump(dict(product=product, items=items, result=R.summary(res)), fh, ensure_ascii=False, indent=1,
                  default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    return dict(png=png, md=md, json=js, items=items)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--product', required=True, help="cat:shape[:ci], e.g. top:shirt:10")
    ap.add_argument('--out')
    ap.add_argument('--slot', choices=('top', 'bottom', 'shoes'))
    ap.add_argument('--sexes', help='m,f | m | f (default: products.json)')
    a = ap.parse_args(argv)
    cat, shape, slot, sexes = product_info(a.product)
    slot = a.slot or slot
    sexes = a.sexes.split(',') if a.sexes else sexes
    out = a.out or os.path.join(ROOT, '검증', '옷', '%s-%s' % (cat, shape))
    res = R.register(a.sheet, slot=slot, sexes=tuple(sexes))
    r = report(res, out, a.product)
    print('%s  %s' % ('통과' if res['ok'] else '다시 요청', ', '.join(i['code'] for i in r['items']) or '-'))
    for k in ('png', 'md', 'json'):
        print('  ' + r[k])
    return 0 if res['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
