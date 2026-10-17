"""H5: the new-hairstyle pipeline (build-hairstyle.py) proven without a real sheet (3단계-계획.txt 'hair' 7, T1-T10).

  python3 -B tools/hair/verify-hairstyle-pipeline.py [--out 검증/머리/H5] [--only T1,T5,N] [--no-runtime] [--jobs 4]

Synthetic sheets: old converted styles drawn by the runtime at the hair template's place, each also without its hair
layer (make-hair-template.cjs --style ... --no-hair, into 검증/머리/새머리/틀, made when missing); their difference
is the hair, the truth. Scores are taken outside the eyes, the mouth and the brows (the old styles drew lashes and
brows in their hair layer; the pipeline keeps the base head's) and outside the truth's 1 px border (antialiasing).
  T1  f long, f braid, m spiky, m fade, m messy: build ok; solid hair against the truth IoU >= .97 per view (thin
      hair over skin, the truth's difference 24-60 or alpha .12-.7, left out: the old m fade has its front stubble in
      the hair layer and its back stubble in the skin layer; the strict IoU is recorded, and m fade's front, whose
      stubble is in the hair layer, needs strict IoU >= .975);
      the colour dyed back to 갈색 against the sheet's: mean ΔE <= 3; every probe of build-hairstyle.py in its limit.
  T2  drift: the content .96 on the same page, zoomed 1.04 in place, or the sheet returned 4 % larger (page and
      content 1.04), moved by 15 px; one figure moved alone: every figure's registration within RMS 1.5 px of the truth (its anchors and a
      grid over the head), build ok. (Zoomed 4 % and moved 15 px on the same page, the back figure leaves the page: T7.)
  T3  hue +-12 deg, brightness +-8 %: build ok, IoU >= .95.
  T4  a .7 px blur, then JPEG q70: build ok, IoU >= .93.
  T5  the other sex's face pasted over the face (front, side): hair in the face <= .5 % of it.
  T6  the body-study sheet's real ChatGPT heads cut to the template's framing: a robustness demo (codes, hair found
      and its board recorded; no threshold).
  T7  the head moved 30 px, the head missing, the content zoomed 4 % past the page edge, the sheet squashed 5 %
      across: fails.
  T8  pink hair: W_HAIR_COLOUR (a warning: the build still passes).
  T9  a scarf over the neck, the neck drawn as a turtleneck: NECK_CHANGED.
  T10 hair over a cell's edge (twin, wolf as they are): HAIR_CROSSES_CELL.
  M   every code raised has a Korean title, message and retry sentence without leftover placeholders.
  N   each --negative of build-hairstyle.py makes its probe or test fail.
Found hair is alpha > .12 (PRED_A), about the share the truth's difference of 24 marks.
  R   f long built as 'f:tlong' and installed for the run: board-heads.cjs --matrix (840 px neck holes, idle
      4 directions x 5 tones x 4 colours, poses, boards), then the assets put back as they were.
Writes OUT/report.json, OUT/cases/<case>/ (reports, boards), OUT/IoU-보기.png (truth vs found per view: grey
both, red found only, blue truth only), OUT/R/ (runtime boards). Exit 1 when a check fails. About 8 minutes.
"""
import concurrent.futures as CF
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
_spec = importlib.util.spec_from_file_location('build_hairstyle', os.path.join(HERE, 'build-hairstyle.py'))
BH = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(BH)
M, R = BH.M, BH.R

SHEETS = os.path.join(ROOT, '검증', '머리', '새머리', '틀')
PAIRS = (('long', 'spiky'), ('braid', 'fade'), ('twin', 'messy'), (None, 'wolf'))     # one make-hair-template run each
T1_STYLES = (('f', 'long'), ('f', 'braid'), ('m', 'spiky'), ('m', 'fade'), ('m', 'messy'))
LIMITS = dict(iou1=.97, de1=3., rms2=1.5, iou3=.95, iou4=.93, face5=.005, fadeFront=.975)
PRED_A = .12        # found hair: alpha above this; the truth: the sheets differ by more than 24 (about the same share)
THIN_DIFF, THIN_A = 60, .7      # thin hair, left out of the solid score: the truth's difference below, alpha below
VIEWS = BH.VIEWS
CW = BH.CELL_W


def sheet_path(sex, shape, bare=False):
    return os.path.join(SHEETS, '머리-그림틀-%s-%s%s.png' % (shape, sex, '-민' if bare else ''))


def ensure_sheets():
    for f, m in PAIRS:
        want = [(x, s) for x, s in (('f', f), ('m', m)) if s]
        if all(os.path.exists(sheet_path(x, s)) and os.path.exists(sheet_path(x, s, True)) for x, s in want):
            continue
        style = ','.join('%s:%s' % (x, s) for x, s in want)
        print('making synthetic sheets ' + style)
        subprocess.run(['node', os.path.join(HERE, 'make-hair-template.cjs'), SHEETS, '--style', style, '--no-hair'],
                       cwd=ROOT, check=True)


def rgb(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float64)


def save(arr, path):
    Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8)).save(path)


def units(ctm, shape):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return (xx + .5 - ctm[4]) / ctm[0], (yy + .5 - ctm[5]) / ctm[3]


# ---------------------------------------------------------------- variants (a sheet in, a sheet out)
def drift(img, s=1., d=(0, 0), fig=None, fd=(0, 0), k=1., sx=None):
    """The sheet on a page k times its size, its content scaled by s (sx: x alone) about the centre and moved by d,
    after figure `fig` alone moved by fd."""
    (dx, dy), (fdx, fdy) = d, fd
    im = img.copy()
    if fig is not None:
        x0 = fig * CW
        cell = np.full((im.shape[0], CW, 3), 255.)
        src = im[:, x0:x0 + CW]
        ys, xs = slice(max(0, fdy), im.shape[0] + min(0, fdy)), slice(max(0, fdx), CW + min(0, fdx))
        ys2, xs2 = slice(max(0, -fdy), im.shape[0] + min(0, -fdy)), slice(max(0, -fdx), CW + min(0, -fdx))
        cell[ys, xs] = src[ys2, xs2]
        im[:, x0:x0 + CW] = cell
    cx, cy = im.shape[1] / 2, im.shape[0] / 2
    size = (int(round(im.shape[1] * k)), int(round(im.shape[0] * k)))
    ox, oy = size[0] / 2, size[1] / 2
    sxx = sx or s
    pil = Image.fromarray(np.clip(np.rint(im), 0, 255).astype(np.uint8))
    out = pil.transform(size, Image.AFFINE, (1 / sxx, 0, cx - (ox + dx) / sxx, 0, 1 / s, cy - (oy + dy) / s),
                        resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    return np.asarray(out).astype(np.float64)


def bright(img, f):
    """The figures lighter (f > 1, toward white) or darker; the page stays white, as ChatGPT keeps it (the garment
    tests' v_bright)."""
    page = M.connected_to(img.min(2) >= 248, np.pad(np.zeros((img.shape[0] - 2, img.shape[1] - 2), bool), 1, constant_values=True))
    out = np.clip(img * f if f < 1 else 255 - (255 - img) * (2 - f), 0, 255)
    out[page] = 255.
    return out


def hue(img, deg):
    hsv = np.asarray(Image.fromarray(img.astype(np.uint8)).convert('HSV')).astype(np.int32)
    hsv[..., 0] = (hsv[..., 0] + int(round(deg / 360 * 256))) % 256
    return np.asarray(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float64)


def paste_face(img, sex, other):
    """The other sex's face (its sheet sampled at the same head units) over this sheet's face, front and side."""
    m_t = BH.meta()
    out = img.copy()
    B = rgb(os.path.join(BH.TPL, '머리-그림틀-민머리-%s.png' % sex))
    bald = M.erode(B.min(2) < 245, 6)
    for i, (k, view) in enumerate(VIEWS[:2]):
        ctm, cto = m_t['sexes'][sex]['views'][view]['ctm'], m_t['sexes'][other[0]]['views'][view]['ctm']
        U_, V_ = units(ctm, img.shape[:2])
        face = bald & (V_ > 19.5) & (V_ < 27.8) & ((np.abs(U_ - 16) < 6) if view == 'front' else ((U_ > 16) & (U_ < 24)))
        face[:, :i * CW] = False
        face[:, (i + 1) * CW:] = False
        ys, xs = np.nonzero(face)
        X, Y = BH.to_px(cto, U_[ys, xs], V_[ys, xs])
        out[ys, xs] = BH.BB.bilinear(other[1], X, Y)
    return out


def head_band(sex, view_i, shape, below=27.5):
    ctm = BH.meta()['sexes'][sex]['views'][VIEWS[view_i][1]]['ctm']
    m = np.zeros(shape, bool)
    m[:int(BH.to_px(ctm, 16, below)[1]), view_i * CW:(view_i + 1) * CW] = True
    return m


def head_moved(img, sex, dx=30):
    band = head_band(sex, 0, img.shape[:2])
    out = img.copy()
    rows = np.nonzero(band.any(1))[0]
    sl = out[rows, 0:CW].copy()
    out[rows, 0:CW] = 255.
    out[rows, dx:CW] = sl[:, :CW - dx]
    return out


def head_missing(img, sex):
    out = img.copy()
    out[head_band(sex, 0, img.shape[:2])] = 255.
    return out


def pink(img, truth):
    hsv = np.asarray(Image.fromarray(img.astype(np.uint8)).convert('HSV')).astype(np.float64)
    hsv[..., 0] = 234                               # 330 deg
    hsv[..., 1] = np.maximum(hsv[..., 1], 110)
    p = np.asarray(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB')).astype(np.float64)
    w = np.clip(truth / 60., 0, 1)[..., None]
    return img * (1 - w) + p * w


def neck_paint(img, sex, kind):
    """kind 'scarf': a red scarf over the neck (front and side); 'turtle': the neck drawn in the shirt's green."""
    m_t = BH.meta()
    pil = Image.fromarray(img.astype(np.uint8))
    dr = ImageDraw.Draw(pil)
    for i, (k, view) in enumerate(VIEWS[:2]):
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        cu = 16. if view == 'front' else 18.
        if kind == 'scarf':
            x0, y0 = BH.to_px(ctm, cu - 4.2, 28.4)
            x1, y1 = BH.to_px(ctm, cu + 4.2, 30.6)
            dr.rounded_rectangle([x0, y0, x1, y1], radius=10, fill=(214, 46, 52), outline=(90, 20, 24), width=3)
        else:
            x0, y0 = BH.to_px(ctm, cu - 2.4, 28.7)
            x1, y1 = BH.to_px(ctm, cu + 2.4, 30.2)
            dr.rectangle([x0, y0, x1, y1], fill=(96, 170, 60), outline=(40, 80, 30), width=2)
    return np.asarray(pil).astype(np.float64)


def body_study():
    """The body-study sheet's heads (the user's reference, a real ChatGPT image) cut to the template's framing: each
    figure scaled and placed so that its shoulders and chest (below the chin) best match the template's."""
    src = np.asarray(Image.open(os.path.join(ROOT, 'assets', 'avatar-reference-candidates', 'body-study-2026-10-04.png')).convert('RGBA')).astype(np.float64)
    a = src[..., 3] / 255.
    comps = M.components(a > .5, min_size=4000)[1]
    comps.sort(key=lambda c: (c['bbox'][1] // 300, c['bbox'][0]))
    m_t = BH.meta()
    sheets = {}
    for row, sex in ((0, 'm'), (1, 'f')):
        T = rgb(os.path.join(BH.TPL, '머리-그림틀-%s.png' % sex))
        out = np.full(T.shape, 255.)
        for i, (k, view) in enumerate(VIEWS):
            c = comps[row * 3 + i]['bbox']
            fig = src[c[1]:c[3], c[0]:c[2]]
            ctm = m_t['sexes'][sex]['views'][view]['ctm']
            y_chin, y_cut = int(BH.to_px(ctm, 16, 28.6)[1]), int(BH.to_px(ctm, 16, 38)[1])
            tfg = T[y_chin:y_cut, i * CW:(i + 1) * CW].min(2) < 245
            best = None
            for s in np.arange(1.2, 2.4, .01):
                w, h = int(fig.shape[1] * s), int(fig.shape[0] * s)
                al = np.asarray(Image.fromarray((fig[..., 3]).astype(np.uint8)).resize((w, h), Image.BILINEAR)) > 128
                # the figure's top at y0, centred by its silhouette: search y0, then x
                for y0 in range(0, 400, 4):
                    part = al[max(0, y_chin - y0):max(0, y_cut - y0)]
                    if part.shape[0] != y_cut - y_chin:
                        continue
                    cols = np.nonzero(part.any(0))[0]
                    tcols = np.nonzero(tfg.any(0))[0]
                    if not len(cols) or not len(tcols):
                        continue
                    x0 = int(round((tcols.mean()) - cols.mean()))
                    canvas = np.zeros(tfg.shape, bool)
                    xs, xe = max(0, x0), min(CW, x0 + w)
                    if xe <= xs:
                        continue
                    canvas[:, xs:xe] = part[:, xs - x0:xe - x0]
                    iou = (canvas & tfg).sum() / max((canvas | tfg).sum(), 1)
                    if best is None or iou > best[0]:
                        best = (iou, s, y0, x0)
            iou, s, y0, x0 = best
            w, h = int(fig.shape[1] * s), int(fig.shape[0] * s)
            im = np.asarray(Image.fromarray(fig.astype(np.uint8), 'RGBA').resize((w, h), Image.LANCZOS)).astype(np.float64)
            canvas = np.zeros((T.shape[0], CW, 4))
            ys, ye = y0, min(T.shape[0], y0 + h)
            xs, xe = max(0, x0), min(CW, x0 + w)
            canvas[ys:ye, xs:xe] = im[:ye - ys, xs - x0:xe - x0]
            aa = canvas[..., 3:4] / 255.
            cell = canvas[..., :3] * aa + 255 * (1 - aa)
            y_cut0 = m_t['sexes'][sex]['cutY']
            cell[y_cut0:] = 255.
            out[:, i * CW:(i + 1) * CW] = cell
            sheets.setdefault(sex + '-fit', []).append(dict(view=k, scale=round(float(s), 3), iou=round(float(iou), 3)))
        sheets[sex] = out
    return sheets


# ---------------------------------------------------------------- one case
def truth_of(sex, shape):
    return np.abs(rgb(sheet_path(sex, shape)) - rgb(sheet_path(sex, shape, True))).max(2)


def scoring_mask(sex, truth, shape=None):
    m_t = BH.meta()
    B = rgb(os.path.join(BH.TPL, '머리-그림틀-민머리-%s.png' % sex))
    bald = B.min(2) < 245
    base = json.load(open(os.path.join(ROOT, 'assets', 'sd-hair-base.json')))['styles']['%s:base' % sex]
    skip = M.dilate(BH.eye_zones(sex, bald.shape, m_t, base, B), 6) & M.dilate(bald, 1)     # (the old lashes round them)
    for k, boxes in BH.brow_boxes(sex, m_t, base, B, bald).items():
        for x0, y0, x1, y1 in boxes:
            skip[int(y0):int(np.ceil(y1)), int(x0):int(np.ceil(x1))] = True
    gt = truth > 24
    skip |= M.dilate(gt, 2) & ~M.erode(gt, 2)       # (antialiasing under the bilinear resample: 2 px)
    # where the sheet is the bald head's paint (ΔE < 12) no tool can tell hair from it: the old m fade keeps skin-
    # coloured stubble in its hair layer there
    S = rgb(sheet_path(sex, shape)) if shape else None
    if S is not None:
        skip |= bald & (R.winmin_de(R.lab(S), R.lab(B), r=1) < 12)
    # the old layers carried the face's own outline (jaw, ears) in the hair layer: thin truth below the brows is
    # not hair the pipeline should take (it keeps the base head's face)
    low = np.zeros(gt.shape, bool)
    for i, (k, view) in enumerate(VIEWS):
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        low[int(BH.to_px(ctm, 16, BH.LIM['browV'])[1]):, i * CW:(i + 1) * CW] = True
    skip |= low & gt & ~M.dilate(M.erode(gt, 2), 2)
    return ~skip, gt


def ious(pred, gt, keep):
    out = {}
    for i, (k, _) in enumerate(VIEWS):
        sl = (slice(None), slice(i * CW, (i + 1) * CW))
        p, g, m = pred[sl], gt[sl], keep[sl]
        out[k] = round(float((p & g & m).sum() / max(((p | g) & m).sum(), 1)), 4)
    return out


def mean_de(res, gt):
    """The hair's colour dyed back to 갈색 by the runtime's formula against the sheet's, where it is whole."""
    h = res['hair']
    a, col = h['alpha'], h['colour']
    U = res['images']['registered'][..., :3].astype(np.float64)
    brown = BH.HL.hexrgb(BH.BB.HAIR1)
    L = np.clip(102. * (col @ brown) / (brown @ brown), 0, 255)
    dyed = np.clip(brown[None, None] * L[..., None] / 102. + (np.maximum(0, L - 160) * .38)[..., None], 0, 255)
    sel = (a > .95) & M.erode(gt, 2)
    if not sel.any():
        return None
    return round(float(np.sqrt(((R.lab(dyed[sel][None]) - R.lab(U[sel][None])) ** 2).sum(-1)).mean()), 2)


def fit_rms(res, sex, s=1., d=(0, 0), fig=None, fd=(0, 0), k=1., sx=None):
    """Per figure the RMS (px) of its registration against the drift's truth over its anchors and a head grid."""
    spec = BH.make_spec(sex)[0]
    m_t = BH.meta()
    C = np.array([BH.SHEET[0] / 2, BH.SHEET[1] / 2])
    C2 = np.array([round(BH.SHEET[0] * k) / 2, round(BH.SHEET[1] * k) / 2])
    s0 = s
    out = {}
    for i, (k, view) in enumerate(VIEWS):
        f = res['figures'].get(k)
        if not f:
            out[k] = None
            continue
        ctm = m_t['sexes'][sex]['views'][view]['ctm']
        uu, vv = np.meshgrid(np.linspace(6, 26, 6), np.linspace(6, 30, 7))
        grid = np.stack(BH.to_px(ctm, uu.ravel(), vv.ravel()), 1)
        P = np.concatenate([spec['anchors'][k], grid])
        shift = np.array(fd if fig == i else (0, 0), np.float64)
        Q = s0 * (P + shift - C) + C2 + np.array(d, np.float64)
        Qf = f['s'] * P + np.array(f['b'])
        out[k] = round(float(np.sqrt(((Qf - Q) ** 2).sum(1).mean())), 3)
    return out


def run_case(case):
    os.environ.setdefault('OMP_NUM_THREADS', '1')
    BH.NEG.clear()
    if case.get('neg'):
        BH.NEG.add(case['neg'])
    t0 = time.time()
    d = os.path.join(case['out'], 'cases', case['name'])
    os.makedirs(d, exist_ok=True)
    sex, shape = case['sex'], case['shape']
    path = case.get('path') or os.path.join(d, 'sheet.png')
    if not case.get('path'):
        img = rgb(sheet_path(sex, shape)) if case['make'][0] != 'bodystudy' else None
        kind, args = case['make'][0], case['make'][1:]
        if kind == 'plain':
            pass
        elif kind == 'drift':
            img = drift(img, **args[0])
        elif kind == 'hue':
            img = hue(img, *args)
        elif kind == 'bright':
            img = bright(img, args[0])
        elif kind == 'jpeg':
            pil = Image.fromarray(img.astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7))
            path = os.path.join(d, 'sheet.jpg')
            pil.save(path, 'JPEG', quality=70)
            img = None
        elif kind == 'face':
            other = ('m' if sex == 'f' else 'f', rgb(sheet_path('m' if sex == 'f' else 'f', args[0])))
            img = paste_face(img, sex, other)
        elif kind == 'moved':
            img = head_moved(img, sex)
        elif kind == 'missing':
            img = head_missing(img, sex)
        elif kind == 'pink':
            img = pink(img, truth_of(sex, shape))
        elif kind == 'neck':
            img = neck_paint(img, sex, args[0])
        elif kind == 'bodystudy':
            img = body_study()[sex]
        if img is not None:
            save(img, path)
    res, entry = BH.build(path, sex, 't' + shape, d, keep=True, debug=case.get('debug', False))
    out = dict(name=case['name'], test=case['test'], neg=case.get('neg'), ok=bool(res['ok']),
               codes=[c['code'] for c in res['codes']], warnings=[w['code'] for w in res.get('warnings', [])],
               messages=BH.explain(res), probes=res.get('probes'), probeFails=res.get('probeFails'),
               hairPx=res.get('hairPx'), seconds=round(time.time() - t0, 1))
    if 'hair' in res:
        truth_src = case.get('truth', (sex, shape))
        if truth_src:
            truth = truth_of(*truth_src)
            keep, gt = scoring_mask(sex, truth, truth_src[1])
            a_ = res['hair']['alpha']
            pred = a_ > PRED_A
            out['iouStrict'] = ious(pred, gt, keep)
            # solid hair: thin hair over skin (a fade's stubble) is hair in one old layer and skin in another (m fade
            # front and back); where either side sees it thin, it is left out
            thin = ((truth > 24) & (truth < THIN_DIFF)) | ((a_ > PRED_A) & (a_ < THIN_A))
            out['iou'] = ious(pred, gt, keep & ~thin)
            out['de'] = mean_de(res, gt)
            if case.get('board'):
                np.save(os.path.join(d, 'pred.npy'), np.packbits(pred))
        if case['make'][0] == 'drift':
            out['rms'] = fit_rms(res, sex, **case['make'][1])
        if case['make'][0] == 'face':
            m_t = BH.meta()
            B = rgb(os.path.join(BH.TPL, '머리-그림틀-민머리-%s.png' % sex))
            bald = M.erode(B.min(2) < 245, 6)
            gt = truth_of(sex, shape) > 24
            share = {}
            for i, (k, view) in enumerate(VIEWS[:2]):
                ctm = m_t['sexes'][sex]['views'][view]['ctm']
                U_, V_ = units(ctm, bald.shape)
                face = bald & (V_ > 19.5) & (V_ < 27.8) & ((np.abs(U_ - 16) < 6) if view == 'front' else ((U_ > 16) & (U_ < 24)))
                face[:, :i * CW] = False
                face[:, (i + 1) * CW:] = False
                face &= ~M.dilate(gt, 2)
                share[k] = round(float(((res['hair']['alpha'] > .5) & face).sum() / max(face.sum(), 1)), 5)
            out['faceHair'] = share
    if case['make'][0] == 'bodystudy':
        out['fit'] = None
    return out


# ---------------------------------------------------------------- the cases
def cases(out):
    c = []
    add = lambda test, name, sex, shape, make, **kw: c.append(dict(test=test, name=name, sex=sex, shape=shape, make=make, out=out, **kw))
    for sex, shape in T1_STYLES:
        add('T1', 'T1-%s-%s' % (sex, shape), sex, shape, ('plain',), debug=True, board=True)
    # .96: the content smaller on the same page; 1.04: the sheet returned 4 % larger (page and content; zoomed 4 %
    # inside the same page the back figure leaves the page, which T7 expects to fail)
    for s, dx, dy, k in ((.96, 15, 15, 1.), (.96, -15, -15, 1.), (1.04, 15, -15, 1.04), (1.04, -15, 15, 1.04)):
        add('T2', 'T2-m-spiky-%.2f-%+d%+d' % (s, dx, dy), 'm', 'spiky', ('drift', dict(s=s, d=(dx, dy), k=k)))
    add('T2', 'T2-m-spiky-1.04-zoom', 'm', 'spiky', ('drift', dict(s=1.04)))
    add('T2', 'T2-f-long-0.96+15-15', 'f', 'long', ('drift', dict(s=.96, d=(15, -15))))
    add('T2', 'T2-f-long-1.04-15+15', 'f', 'long', ('drift', dict(s=1.04, d=(-15, 15), k=1.04)))
    add('T2', 'T2-m-fade-figure', 'm', 'fade', ('drift', dict(d=(8, -6), fig=1, fd=(6, -5))))
    for sex, shape in (('f', 'long'), ('m', 'spiky')):
        for deg in (12, -12):
            add('T3', 'T3-%s-%s-hue%+d' % (sex, shape, deg), sex, shape, ('hue', deg), board=True)
        for f in (1.08, .92):
            add('T3', 'T3-%s-%s-bright%.2f' % (sex, shape, f), sex, shape, ('bright', f))
        add('T4', 'T4-%s-%s-jpeg' % (sex, shape), sex, shape, ('jpeg',), board=True)
    add('T5', 'T5-f-long-face', 'f', 'long', ('face', 'spiky'), debug=True)
    add('T5', 'T5-m-spiky-face', 'm', 'spiky', ('face', 'long'), debug=True)
    add('T6', 'T6-m-bodystudy', 'm', 'bodystudy', ('bodystudy',), debug=True, truth=None)
    add('T6', 'T6-f-bodystudy', 'f', 'bodystudy', ('bodystudy',), debug=True, truth=None)
    add('T7', 'T7-f-long-moved', 'f', 'long', ('moved',), truth=None)
    add('T7', 'T7-m-spiky-missing', 'm', 'spiky', ('missing',), truth=None)
    add('T7', 'T7-m-spiky-zoomed', 'm', 'spiky', ('drift', dict(s=1.04, d=(15, -15))), truth=None)
    add('T7', 'T7-f-long-squashed', 'f', 'long', ('drift', dict(s=1., sx=.95)), truth=None)
    add('T8', 'T8-f-long-pink', 'f', 'long', ('pink',), debug=True)
    add('T9', 'T9-f-long-scarf', 'f', 'long', ('neck', 'scarf'), truth=None)
    add('T9', 'T9-m-spiky-turtle', 'm', 'spiky', ('neck', 'turtle'), truth=None)
    add('T10', 'T10-f-twin', 'f', 'twin', ('plain',), truth=None)
    add('T10', 'T10-m-wolf', 'm', 'wolf', ('plain',), truth=None)
    for neg, sex, shape, make in (('freetone', 'f', 'long', ('plain',)), ('nolike', 'f', 'long', ('face', 'spiky')),
                                  ('nofill', 'f', 'long', ('plain',)), ('oldedge', 'm', 'spiky', ('plain',)),
                                  ('nocap', 'm', 'fade', ('plain',)), ('nothin', 'm', 'fade', ('plain',)),
                                  ('nogap', 'f', 'long', ('plain',)), ('flowers', 'f', 'braid', ('plain',)),
                                  ('nobrow', 'f', 'braid', ('plain',)), ('stackover', 'm', 'spiky', ('plain',)),
                                  ('nomix', 'm', 'fade', ('plain',))):
        add('N', 'N-%s' % neg, sex, shape, make, neg=neg)
    return c


NEG_PROBE = dict(nofill='holesInMass', oldedge='edgeLight', nocap='lightOverSkin', nothin='thinBand', nogap='neckGaps',
                 flowers='bodyHair', nobrow='browBlobs', stackover='baseKept')


def judge(r):
    """(ok, line) for one case."""
    t, iou = r['test'], r.get('iou') or {}
    worst = min(iou.values()) if iou else None
    if t == 'T1':
        # the old m fade keeps its front stubble in the hair layer: there the thin hair counts (strict front)
        fade = r['name'] != 'T1-m-fade' or (r.get('iouStrict') or {}).get('front', 0) >= LIMITS['fadeFront']
        ok = r['ok'] and worst is not None and worst >= LIMITS['iou1'] and (r['de'] or 99) <= LIMITS['de1'] and not r['probeFails'] and fade
        return ok, 'IoU %s (strict %s), ΔE %s, probes over: %s' % (iou, r.get('iouStrict'), r.get('de'), r.get('probeFails') or 'none')
    if t == 'T2':
        rms = r.get('rms') or {}
        ok = r['ok'] and rms and all(v is not None and v <= LIMITS['rms2'] for v in rms.values())
        return ok, 'RMS px %s, IoU %s' % (rms, iou)
    if t in ('T3', 'T4'):
        lim = LIMITS['iou3' if t == 'T3' else 'iou4']
        return r['ok'] and worst is not None and worst >= lim, 'IoU %s (>= %.2f), codes %s' % (iou, lim, r['codes'])
    if t == 'T5':
        fh = r.get('faceHair') or {}
        return bool(fh) and all(v <= LIMITS['face5'] for v in fh.values()), 'hair in the face %s, codes %s' % (fh, r['codes'])
    if t == 'T6':
        return True, 'demo: ok %s, codes %s, warnings %s, hair px %s' % (r['ok'], r['codes'], r['warnings'], r['hairPx'])
    if t == 'T7':
        return not r['ok'] and bool(r['codes']), 'codes %s' % r['codes']
    if t == 'T8':
        return 'W_HAIR_COLOUR' in r['warnings'], 'ok %s, warnings %s' % (r['ok'], r['warnings'])
    if t == 'T9':
        return 'NECK_CHANGED' in r['codes'], 'codes %s' % r['codes']
    if t == 'T10':
        return 'HAIR_CROSSES_CELL' in r['codes'], 'codes %s' % r['codes']
    if t == 'N':
        neg = r['neg']
        if neg == 'freetone':
            return (not r['ok']) or (worst is not None and worst < LIMITS['iou1']), 'ok %s, codes %s, IoU %s' % (r['ok'], r['codes'], iou)
        if neg == 'nomix':
            front = (r.get('iouStrict') or {}).get('front')
            return front is not None and front < LIMITS['fadeFront'], 'm fade front strict IoU %s (T1 needs %.3f)' % (front, LIMITS['fadeFront'])
        if neg == 'nolike':
            fh = r.get('faceHair') or {}
            return any(v > LIMITS['face5'] for v in fh.values()), 'hair in the face %s' % fh
        p = NEG_PROBE[neg]
        return bool(r.get('probeFails') and p in r['probeFails']), '%s %s (limit %s)' % (p, (r.get('probes') or {}).get(p), BH.PROBE_LIMITS[p])
    return False, 'unknown test'


def messages_ok(results):
    bad = []
    for r in results:
        for m in r['messages']:
            text = m['title'] + m['message'] + m['retry']
            if not (m['title'] and m['message'] and m['retry']) or '{' in text or not any('가' <= ch <= '힣' for ch in text):
                bad.append((r['name'], m['code']))
    return not bad, bad


def iou_board(results, out):
    """Per scored case and view: grey found and truth, red found only, blue truth only (scaled to 40 %)."""
    rows = []
    for r in results:
        if r['test'] not in ('T1', 'T3', 'T4') or 'iou' not in r:
            continue
        d = os.path.join(out, 'cases', r['name'], 'pred.npy')
        if not os.path.exists(d):
            continue
        sex, shape = r['name'].split('-')[1:3]
        pred = np.unpackbits(np.load(d))[:BH.SHEET[0] * BH.SHEET[1]].reshape(BH.SHEET[1], BH.SHEET[0]).astype(bool)
        keep, gt = scoring_mask(sex, truth_of(sex, shape), shape)
        img = np.full(pred.shape + (3,), 255.)
        img[pred & gt] = (150, 150, 150)
        img[pred & ~gt & keep] = (230, 40, 40)
        img[gt & ~pred & keep] = (40, 70, 230)
        img[~keep & (pred | gt)] = (215, 215, 215)
        pil = Image.fromarray(img.astype(np.uint8)).resize((BH.SHEET[0] * 2 // 5, BH.SHEET[1] * 2 // 5), Image.BOX)
        ImageDraw.Draw(pil).text((6, 4), '%s  %s' % (r['name'], r['iou']), fill=(0, 0, 0))
        rows.append(pil)
    if rows:
        W, Hh = rows[0].size
        board = Image.new('RGB', (W, (Hh + 4) * len(rows)), 'white')
        for i, p in enumerate(rows):
            board.paste(p, (0, i * (Hh + 4)))
        board.save(os.path.join(out, 'IoU-보기.png'))


def runtime(out):
    """f long installed as 'f:tlong' for the moment, the studio matrix on it, then the assets as they were."""
    assets = os.path.join(ROOT, 'assets')
    data, sheet_rec, atlas = (os.path.join(assets, n) for n in ('sd-hair-data.js', 'sd-hair-sheet.json', 'sd-hair-f-tlong.webp'))
    keep = {p: open(p, 'rb').read() for p in (data, sheet_rec) if os.path.exists(p)}
    had_atlas = os.path.exists(atlas)
    try:
        BH.NEG.clear()
        res, entry = BH.build(sheet_path('f', 'long'), 'f', 'tlong', os.path.join(out, 'R'), install=True)
        if not res['ok']:
            return False, 'install failed: %s' % res['codes']
        p = subprocess.run(['node', os.path.join(HERE, 'board-heads.cjs'), '--styles', 'f:tlong', '--with', 'f:long', '--matrix',
                            '--out', os.path.join(out, 'R')], cwd=ROOT, capture_output=True, text=True)
        tail = (p.stdout + p.stderr).strip().splitlines()[-6:]
        return p.returncode == 0, ' | '.join(tail)
    finally:
        for p in (data, sheet_rec):
            if p in keep:
                open(p, 'wb').write(keep[p])
            elif os.path.exists(p):
                os.remove(p)
        if not had_atlas and os.path.exists(atlas):
            os.remove(atlas)


def main(argv):
    opt = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
    out = os.path.abspath(opt('--out', os.path.join(ROOT, '검증', '머리', 'H5')))
    only = set(opt('--only', '').split(',')) - {''}
    jobs = int(opt('--jobs', '4'))
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    ensure_sheets()
    todo = [c for c in cases(out) if not only or c['test'] in only]
    results = []
    with CF.ProcessPoolExecutor(jobs) as ex:
        futs = {ex.submit(run_case, c): c for c in todo}
        for f in CF.as_completed(futs):
            c = futs[f]
            try:
                results.append(f.result())
            except Exception as e:      # a crash is a failure of that case, the others still report
                results.append(dict(name=c['name'], test=c['test'], neg=c.get('neg'), ok=False, codes=['CRASH'], warnings=[],
                                    messages=[], error=repr(e)))
    order = {c['name']: i for i, c in enumerate(todo)}
    results.sort(key=lambda r: order[r['name']])
    checks = []
    for r in results:
        ok, line = (False, 'crashed: ' + r['error']) if 'error' in r else judge(r)
        checks.append(dict(name=r['name'], test=r['test'], ok=bool(ok), detail=line))
        print('%s %-28s %s' % ('ok  ' if ok else 'FAIL', r['name'], line))
    mok, mbad = messages_ok(results)
    checks.append(dict(name='M-messages', test='M', ok=mok, detail=mbad))
    print('%s %-28s %s' % ('ok  ' if mok else 'FAIL', 'M-messages', 'every code has Korean title, message and retry' if mok else mbad))
    if '--no-runtime' not in argv and (not only or 'R' in only):
        rok, rline = runtime(out)
        checks.append(dict(name='R-studio', test='R', ok=rok, detail=rline))
        print('%s %-28s %s' % ('ok  ' if rok else 'FAIL', 'R-studio', rline))
    iou_board(results, out)
    report = dict(tool='verify-hairstyle-pipeline', created=time.strftime('%Y-%m-%dT%H:%M:%S'), limits=LIMITS,
                  probeLimits=BH.PROBE_LIMITS, checks=checks, results=results, seconds=round(time.time() - t0))
    json.dump(report, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False, indent=1, default=str)
    fails = [c['name'] for c in checks if not c['ok']]
    print('%s: %d/%d checks, %d s; %s' % ('PASS' if not fails else 'FAIL', len(checks) - len(fails), len(checks), report['seconds'],
                                         os.path.join(out, 'report.json')))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
