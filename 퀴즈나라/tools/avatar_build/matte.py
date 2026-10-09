"""Input record and white-background matte of an uploaded sheet (stage 3, WP5).

Shared by the garment pipeline (tools/garment/) and the hair pipeline
(tools/hair/). numpy + PIL only.

  read_input(path)   bytes, sha256, container/encoder (PNG, lossy VP8 or
                     lossless VP8L WebP, JPEG with its estimated quality),
                     ICC profile, the calibration column ('png' or 'lossy')
                     and SIZE_SMALL
  to_rgb(...)        the pixels in sRGB on white (alpha composited)
  background(...)    BACKGROUND: a transparent sheet's baked checkerboard
                     (periodic on two or more sides), or a 12 px border that
                     is not one plain near-white (median >= 240, std <= 6
                     after dropping the farthest 10 %). A side that is mostly
                     paint (a figure cut by the edge) is left out and named,
                     so the layout reports the cut instead.
  matte(...)         foreground = every pixel NOT connected to the border
                     through near-white. Connectivity, never a per-pixel
                     whiteness test, so a white collar or cuff inside its
                     drawn outline stays cloth. The outline ridge (a pixel
                     darker than its 5x5 neighbourhood) is a barrier even
                     when it is light, and the fill runs on the passable set
                     eroded 1 px, so a 1-2 px break in a soft outline does
                     not let the background in.
  label(mask)        4-connected components by run-length union-find
                     (scipy is not available)

All thresholds here are about the PAGE (white level, outline contrast), never
about garment colours.
"""
import hashlib
import io
import struct

import numpy as np
from PIL import Image, ImageFilter

SIZE_MIN = 1200          # long side, px (plan: SIZE_SMALL below)
BORDER = 12              # px strip for the page statistics
BORDER_MIN_LEVEL = 240   # median of the border
BORDER_MAX_STD = 6.0     # std of the border after dropping the 10% farthest (figures touching it)
BORDER_MAX_FAR = .15     # share of border pixels more than 12 off the median
ALPHA_SHARE = .05        # >= 5% transparent pixels: the alpha is the matte
NEAR_WHITE = 16          # a background pixel is within this of the page level in every channel
NEAR_CHROMA = 12         # and this grey (max - min channel)
RIDGE = 8                # outline ridge: this much darker than the 5x5 maximum


# ---------------------------------------------------------------------------
# Input record
# ---------------------------------------------------------------------------
def _webp_chunks(data):
    out = []
    if data[:4] != b'RIFF' or data[8:12] != b'WEBP':
        return out
    pos = 12
    while pos + 8 <= len(data):
        tag = data[pos:pos + 4].decode('latin-1')
        size = struct.unpack('<I', data[pos + 4:pos + 8])[0]
        out.append((tag, size))
        pos += 8 + size + (size & 1)
    return out


def _png_chunks(data):
    out = []
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return out
    pos = 8
    while pos + 8 <= len(data):
        size = struct.unpack('>I', data[pos:pos + 4])[0]
        out.append(data[pos + 4:pos + 8].decode('latin-1'))
        pos += 12 + size
    return out


def _icc_description(icc):
    """The 'desc' tag of an ICC profile (v2 textDescription or v4 mluc)."""
    if not icc or len(icc) < 132:
        return None
    try:
        n = struct.unpack('>I', icc[128:132])[0]
        for i in range(n):
            sig, off, size = struct.unpack('>4sII', icc[132 + 12 * i:144 + 12 * i])
            if sig != b'desc':
                continue
            tag = icc[off:off + size]
            if tag[:4] == b'desc':
                length = struct.unpack('>I', tag[8:12])[0]
                return tag[12:12 + length].rstrip(b'\x00').decode('latin-1')
            if tag[:4] == b'mluc':
                count, rec = struct.unpack('>II', tag[8:16])
                if count:
                    _, _, ln, lo = struct.unpack('>2s2sII', tag[16:28])
                    return tag[lo:lo + ln].decode('utf-16-be')
    except (struct.error, UnicodeDecodeError):
        return None
    return None


def _icc_copyright(icc):
    if not icc or len(icc) < 132:
        return None
    try:
        n = struct.unpack('>I', icc[128:132])[0]
        for i in range(n):
            sig, off, size = struct.unpack('>4sII', icc[132 + 12 * i:144 + 12 * i])
            if sig == b'cprt':
                tag = icc[off:off + size]
                if tag[:4] == b'text':
                    return tag[8:].rstrip(b'\x00').decode('latin-1')
                if tag[:4] == b'mluc':
                    _, _, ln, lo = struct.unpack('>2s2sII', tag[16:28])
                    return tag[lo:lo + ln].decode('utf-16-be')
    except (struct.error, UnicodeDecodeError):
        return None
    return None


def _jpeg_quality(im):
    """IJG quality estimate from the luminance quantisation table."""
    q = getattr(im, 'quantization', None)
    if not q or 0 not in q:
        return None
    std = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
           14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
           49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99]
    table = list(q[0])
    # PIL keeps tables in zigzag order; the ratio of sums does not care.
    scale = 100.0 * sum(table) / sum(std)
    quality = (200 - scale) / 2 if scale <= 100 else 5000 / scale
    return int(round(max(1, min(100, quality))))


def _jpeg_sampling(im):
    from PIL import JpegImagePlugin
    try:
        return {0: '4:4:4', 1: '4:2:2', 2: '4:2:0'}.get(JpegImagePlugin.get_sampling(im), 'unknown')
    except Exception:
        return 'unknown'


def read_input(path):
    """Everything about the upload before any pixel is used: the stored bytes'
    sha256, container and encoder, ICC, size and the calibration column."""
    data = open(path, 'rb').read()
    im = Image.open(io.BytesIO(data))
    im.load()
    fmt = (im.format or '').lower()
    rec = {
        'path': str(path), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'format': fmt, 'size': [im.width, im.height], 'mode': im.mode,
        'hasAlpha': im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info),
    }
    icc = im.info.get('icc_profile')
    rec['icc'] = {'present': bool(icc), 'bytes': len(icc) if icc else 0, 'description': _icc_description(icc),
                  'copyright': _icc_copyright(icc)}
    desc = (rec['icc']['description'] or '').lower()
    rec['icc']['srgb'] = (not icc) or ('srgb' in desc) or ('iec61966' in desc)
    if fmt == 'webp':
        chunks = _webp_chunks(data)
        tags = [t for t, _ in chunks]
        lossless = 'VP8L' in tags
        rec['encoder'] = {'container': 'WebP', 'chunks': tags,
                          'codec': 'VP8L (lossless)' if lossless else 'VP8 (lossy)',
                          'bitsPerPixel': round(8.0 * len(data) / (im.width * im.height), 3)}
        rec['lossy'] = not lossless
    elif fmt == 'jpeg':
        rec['encoder'] = {'container': 'JPEG', 'quality': _jpeg_quality(im),
                          'subsampling': _jpeg_sampling(im),
                          'bitsPerPixel': round(8.0 * len(data) / (im.width * im.height), 3)}
        rec['lossy'] = True
    elif fmt == 'png':
        rec['encoder'] = {'container': 'PNG', 'chunks': _png_chunks(data), 'bitDepth': im.info.get('bit_depth')}
        rec['lossy'] = False
    else:
        rec['encoder'] = {'container': fmt.upper() or 'unknown'}
        rec['lossy'] = True
    # Separate calibration columns (REDTEAM): a lossless upload is held to the
    # PNG numbers, any lossy re-encode to the lossy ones.
    rec['calibration'] = 'lossy' if rec['lossy'] else 'png'
    rec['longSide'] = max(im.width, im.height)
    rec['sizeOk'] = rec['longSide'] >= SIZE_MIN
    return rec, im


def to_rgb(im, rec):
    """sRGB pixels (float32, 0-255) and the alpha (0-1). A non-sRGB ICC
    profile is converted with ImageCms; an alpha channel is kept apart."""
    if rec['icc']['present'] and not rec['icc']['srgb']:
        try:
            from PIL import ImageCms
            src = ImageCms.ImageCmsProfile(io.BytesIO(im.info['icc_profile']))
            dst = ImageCms.createProfile('sRGB')
            base = im.convert('RGBA') if rec['hasAlpha'] else im.convert('RGB')
            mode = base.mode
            im = ImageCms.profileToProfile(base, src, dst, outputMode=mode)
            rec['icc']['converted'] = True
        except Exception as exc:  # pragma: no cover - reported, never silent
            rec['icc']['converted'] = False
            rec['icc']['error'] = str(exc)
    rgba = np.asarray(im.convert('RGBA')).astype(np.float32)
    return rgba[..., :3], rgba[..., 3] / 255.0


# ---------------------------------------------------------------------------
# Connected components (run-length union-find, 4-connectivity)
# ---------------------------------------------------------------------------
def runs_of(mask):
    m = np.pad(mask.astype(np.int8), ((0, 0), (1, 1)))
    d = np.diff(m, axis=1)
    ys, x0 = np.nonzero(d == 1)
    ye, x1 = np.nonzero(d == -1)
    assert (ys == ye).all()
    return ys, x0, x1


def label(mask):
    """Labels (int32, 0 = not in mask, 1..n), n, and the component sizes
    (index 0 unused)."""
    H, W = mask.shape
    ys, x0, x1 = runs_of(mask)
    n = len(ys)
    out = np.zeros((H, W), np.int32)
    if not n:
        return out, 0, np.zeros(1, np.int64)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    row_start = np.searchsorted(ys, np.arange(H + 1))
    for y in range(H - 1):
        a0, a1 = row_start[y], row_start[y + 1]
        b0, b1 = row_start[y + 1], row_start[y + 2]
        if a0 == a1 or b0 == b1:
            continue
        bx0, bx1 = x0[b0:b1], x1[b0:b1]
        lo = np.searchsorted(bx1, x0[a0:a1], side='right')
        hi = np.searchsorted(bx0, x1[a0:a1], side='left')
        for i, (l, h) in enumerate(zip(lo, hi)):
            if l < h:
                ra = find(a0 + i)
                for j in range(b0 + l, b0 + h):
                    rb = find(j)
                    if ra != rb:
                        parent[rb] = ra
    roots = np.array([find(i) for i in range(n)])
    uniq, comp = np.unique(roots, return_inverse=True)
    comp = comp + 1
    lengths = x1 - x0
    for k in range(n):
        out[ys[k], x0[k]:x1[k]] = comp[k]
    sizes = np.bincount(comp, weights=lengths, minlength=len(uniq) + 1).astype(np.int64)
    return out, len(uniq), sizes


def components(mask, min_size=1):
    """[{label, size, bbox [x0, y0, x1, y1] (exclusive)}] of a mask."""
    lab, n, sizes = label(mask)
    if not n:
        return lab, []
    out = []
    ys, xs = np.nonzero(lab)
    ls = lab[ys, xs]
    order = np.argsort(ls, kind='stable')
    ls, ys, xs = ls[order], ys[order], xs[order]
    starts = np.searchsorted(ls, np.arange(1, n + 2))
    for k in range(1, n + 1):
        if sizes[k] < min_size:
            continue
        s, e = starts[k - 1], starts[k]
        out.append({'label': k, 'size': int(sizes[k]),
                    'bbox': [int(xs[s:e].min()), int(ys[s:e].min()), int(xs[s:e].max()) + 1, int(ys[s:e].max()) + 1]})
    return lab, out


def connected_to(mask, seeds):
    """Pixels of `mask` 4-connected to any seed pixel (run-length labels)."""
    lab, n, _ = label(mask)
    keep = np.unique(lab[seeds & mask])
    keep = keep[keep > 0]
    return np.isin(lab, keep)


def _max_filter(a, r):
    return np.asarray(Image.fromarray(a).filter(ImageFilter.MaxFilter(2 * r + 1)))


def _min_filter(a, r):
    return np.asarray(Image.fromarray(a).filter(ImageFilter.MinFilter(2 * r + 1)))


def _window_any(mask, r, axis):
    """True where any pixel of `mask` lies within r px along `axis`
    (cumulative sums, O(n) whatever the radius)."""
    m = mask.astype(np.int32)
    pad = [(0, 0), (0, 0)]
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(m, pad), axis=axis)
    n = m.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) > 0


def dilate(mask, r):
    """Square (2r+1) dilation, the same as PIL MaxFilter on a binary mask."""
    if r <= 0:
        return mask.copy()
    return _window_any(_window_any(mask, r, 0), r, 1)


def erode(mask, r):
    """Square (2r+1) erosion; outside the image counts as set (as PIL's
    MinFilter, which repeats the edge)."""
    if r <= 0:
        return mask.copy()
    inv = ~mask.astype(bool)
    return ~_window_any(_window_any(inv, r, 0), r, 1)


# ---------------------------------------------------------------------------
# Page checks
# ---------------------------------------------------------------------------
def _periodic(strip):
    """Strongest autocorrelation of a 1-D luminance profile at lags 6..80
    (a baked transparency checkerboard is strongly periodic)."""
    v = strip - strip.mean()
    if v.std() < 1:
        return 0.0, 0
    best, lag = 0.0, 0
    for k in range(6, min(81, len(v) // 3)):
        c = float((v[:-k] * v[k:]).mean() / (v.var() + 1e-9))
        if c > best:
            best, lag = c, k
    return best, lag


def background(rgb, alpha):
    """Page check. Returns dict(ok, code, mode, level, ...).
    mode 'alpha': >= 5% transparent pixels, the alpha is the matte.
    Otherwise the 12 px border must be one plain near-white. A side that is
    mostly paint (a figure cut by the page edge, a frame) is left out of the
    page statistics and reported as touched; the layout check names the cut
    figure. A two-tone periodic border (a baked transparency checkerboard)
    or no clean side at all is BACKGROUND."""
    transparent = float((alpha < .98).mean())
    if transparent >= ALPHA_SHARE:
        return {'ok': True, 'code': None, 'mode': 'alpha', 'level': 255.0, 'transparentShare': round(transparent, 4)}
    H, W = rgb.shape[:2]
    b = BORDER
    sides = {'top': rgb[:b].reshape(-1, 3), 'bottom': rgb[H - b:].reshape(-1, 3),
             'left': rgb[b:H - b, :b].reshape(-1, 3), 'right': rgb[b:H - b, W - b:].reshape(-1, 3)}
    lines = {'top': rgb[2, :].mean(-1), 'bottom': rgb[-3, :].mean(-1), 'left': rgb[:, 2].mean(-1),
             'right': rgb[:, -3].mean(-1)}
    allpx = np.concatenate(list(sides.values()))
    med_all = np.median(allpx, 0)
    per_side = {}
    for name, px in sides.items():
        dev = np.abs(px - med_all).max(1)
        per = _periodic(lines[name])
        per_side[name] = dict(far=round(float((dev > 12).mean()), 4), periodicity=round(per[0], 3), period=per[1])
    touched = [n for n, v in per_side.items() if v['far'] > .3]
    periodic = [n for n, v in per_side.items() if v['periodicity'] > .6 and v['far'] > .05]
    clean = [n for n in sides if n not in touched]
    out = {'mode': 'white', 'sides': per_side, 'touchedSides': touched, 'transparentShare': round(transparent, 4)}
    reasons = []
    if len(periodic) >= 2:
        reasons.append('checkerboard')
    if not clean:
        reasons.append('no plain page on any side')
        px = allpx
    else:
        px = np.concatenate([sides[n] for n in clean])
    med = np.median(px, 0)
    dev = np.abs(px - med).max(1)
    far = float((dev > 12).mean())
    trim = px[dev <= np.percentile(dev, 90)]
    std = float(trim.std(0).max())
    level = float(med.min())
    out.update({'level': round(level, 2), 'median': [round(float(v), 1) for v in med], 'trimmedStd': round(std, 3),
                'farShare': round(far, 4)})
    if level < BORDER_MIN_LEVEL:
        reasons.append('not white (border median %.0f < %d)' % (level, BORDER_MIN_LEVEL))
    if std > BORDER_MAX_STD:
        reasons.append('uneven border (std %.1f > %.0f)' % (std, BORDER_MAX_STD))
    if far > BORDER_MAX_FAR:
        reasons.append('border pattern (%.0f%% off the median)' % (100 * far))
    out['ok'] = not reasons
    out['code'] = None if out['ok'] else 'BACKGROUND'
    out['reasons'] = reasons
    return out


# ---------------------------------------------------------------------------
# Matte
# ---------------------------------------------------------------------------
def near_white(rgb, level):
    lo = rgb.min(-1)
    return (lo >= level - NEAR_WHITE) & (rgb.max(-1) - lo <= NEAR_CHROMA)


def ridge(rgb, level, r=2):
    """Outline ridge: a pixel clearly darker than the brightest pixel in its
    5x5 neighbourhood and not page white itself."""
    lum = rgb.mean(-1)
    lmax = _max_filter(np.clip(lum, 0, 255).astype(np.uint8), r).astype(np.float32)
    return (lmax - lum >= RIDGE) & (lum < level - 2)


def matte(rgb, alpha=None, page=None):
    """Foreground of an upload on a white page.

    Returns dict(fg bool, alpha float 0..1, background bool, pockets bool,
    level, barrier bool). `pockets` are near-white pixels enclosed by
    outlines: they are foreground here (a white collar, a cuff, or a small
    background pocket between arm and body). register.py decides about
    pockets after registration with the template prior."""
    H, W = rgb.shape[:2]
    if page is None:
        page = background(rgb, alpha if alpha is not None else np.ones((H, W), np.float32))
    if page.get('mode') == 'alpha':
        fg = alpha >= .5
        return {'fg': fg, 'alpha': alpha.astype(np.float32), 'background': ~fg, 'pockets': np.zeros_like(fg),
                'level': 255.0, 'barrier': np.zeros_like(fg), 'mode': 'alpha'}
    level = min(255.0, max(page['level'], 200.0))
    white = near_white(rgb, level)
    barrier = ridge(rgb, level)
    passable = white & ~barrier
    seeds = np.zeros((H, W), bool)
    seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True
    core = erode(passable, 1)
    # Border seeds: the eroded set touches the page border one pixel in.
    edge = np.zeros((H, W), bool)
    edge[:2, :] = edge[-2:, :] = edge[:, :2] = edge[:, -2:] = True
    fill = connected_to(core, edge & core)
    bg = dilate(fill, 1) & passable
    # Close the last one-pixel rim along the page border.
    bg |= seeds & passable & dilate(bg, 1)
    fg = ~bg
    pockets = passable & fg
    # Soft edge: foreground pixels next to the background take an alpha from
    # their distance to the page white, relative to the paint just inside.
    dev = np.clip(level - rgb.min(-1), 0, 255)
    inner = erode(fg, 2)
    ref = _max_filter(np.clip(dev * inner, 0, 255).astype(np.uint8), 3).astype(np.float32)
    a = fg.astype(np.float32)
    rim = fg & dilate(bg, 1)
    a[rim] = np.clip(dev[rim] / np.maximum(ref[rim], 40.0), 0, 1)
    return {'fg': fg, 'alpha': a, 'background': bg, 'pockets': pockets, 'level': level, 'barrier': barrier,
            'mode': 'white'}
