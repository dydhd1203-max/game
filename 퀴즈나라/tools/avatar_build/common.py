"""Generic imaging helpers shared by the body build, the garment pipeline and
the hair tools (numpy + PIL only).

Moved verbatim out of tools/build-reference-body.py (stage 3, WP1); the body
rebuild is byte-identical with them (tools/garment/verify-body-freeze.py
--rebuild). Every geometry is in reference-sheet pixels (SHEET).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4  # supersampling for anti-aliased zone edges

# The reference sheet (assets/avatar-reference-candidates/body-study-2026-10-04.png)
# and the ChatGPT template made from it (assets/garment-template/template-sheet.png):
# the sheet composited on white with 90 px on the left and 91 px on the right
# (1448 + 90 + 91 = 1629, a 3:2 canvas). Only x offset 90 reproduces the
# sheet (max difference 0.5/255; offsets 89 and 91 give 199), so registration
# must not assume a symmetric margin.
SHEET = dict(width=1448, height=1086)
TEMPLATE = dict(width=1629, height=1086, left=90, right=91, background=(255, 255, 255))
assert TEMPLATE['left'] == 90 and TEMPLATE['right'] == 91, 'template margins are 90/91 px'
assert SHEET['width'] + TEMPLATE['left'] + TEMPLATE['right'] == TEMPLATE['width']
assert SHEET['height'] == TEMPLATE['height']
# ChatGPT returns the 3:2 template at 1536x1024: one global scale, then the margin.
CHATGPT_SIZE = (1536, 1024)
CHATGPT_SCALE = TEMPLATE['width'] / CHATGPT_SIZE[0]  # sheet px per upload px (1629/1536)


def upload_to_sheet(x, y, scale=CHATGPT_SCALE):
    """Upload pixel (ChatGPT 1536 wide) -> reference-sheet pixel (global fit)."""
    return x * scale - TEMPLATE['left'], y * scale


def mirror(points, cx):
    return [(2 * cx - x, y) for x, y in reversed(points)]


def polyline_y(points, xs):
    px = [p[0] for p in points]; py = [p[1] for p in points]
    return np.interp(xs, px, py)


def poly_mask(shape, polygon):
    """Anti-aliased polygon coverage (0..1)."""
    h, w = shape
    img = Image.new('L', (w * SS, h * SS), 0)
    ImageDraw.Draw(img).polygon([(x * SS, y * SS) for x, y in polygon], fill=255)
    return np.asarray(img.resize((w, h), Image.BOX), dtype=np.float32) / 255


def box_blur(a, r):
    """Two passes of a separable box filter (close to a Gaussian)."""
    for _ in range(2):
        for axis in (0, 1):
            p = np.pad(a, [((r + 1, r) if ax == axis else (0, 0)) for ax in range(2)], mode='edge')
            c = np.cumsum(p, axis=axis)
            a = (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return a


def fill_colors(rgba, source_mask, iterations=40):
    """Diffuse the colours of source pixels outward (normalized convolution)."""
    col = rgba[..., :3].astype(np.float32) * source_mask[..., None]
    wt = source_mask.astype(np.float32).copy()
    acc_c, acc_w = col.copy(), wt.copy()
    for radius in (6, 12, 24, 48):
        bc = np.stack([box_blur(col[..., i], radius) for i in range(3)], -1)
        bw = box_blur(wt, radius)
        need = acc_w < 1e-3
        acc_c[need] = bc[need]; acc_w[need] = bw[need]
    return np.clip(acc_c / np.maximum(acc_w, 1e-6)[..., None], 0, 255)


def edge_band(mask, width):
    """Pixels of `mask` within `width` px of its outside."""
    m = Image.fromarray((mask > .5).astype(np.uint8) * 255)
    eroded = np.asarray(m.filter(ImageFilter.MinFilter(2 * width + 1))) > 127
    return (mask > .5) & ~eroded


def local_mean(rgb, weight, radii=(4, 8, 16, 32)):
    """Mean colour of the weighted pixels around each pixel, widening the
    radius where none are near (normalized convolution)."""
    col = rgb * weight[..., None]
    acc_c = np.zeros_like(rgb, dtype=np.float32); acc_w = np.zeros(weight.shape, np.float32)
    for radius in radii:
        bc = np.stack([box_blur(col[..., i], radius) for i in range(3)], -1)
        bw = box_blur(weight.astype(np.float32), radius)
        need = acc_w < 1e-3
        acc_c[need] = bc[need]; acc_w[need] = bw[need]
    return acc_c / np.maximum(acc_w, 1e-6)[..., None]


def lum_of(rgb):
    return .3 * rgb[..., 0] + .59 * rgb[..., 1] + .11 * rgb[..., 2]


def hue_chroma(rgb):
    a = rgb[..., 0] - (rgb[..., 1] + rgb[..., 2]) / 2
    b = (rgb[..., 1] - rgb[..., 2]) * .866
    return np.degrees(np.arctan2(b, a)), np.hypot(a, b)


def harmonic(values, domain, fixed, iterations=500):
    """Smooth (Laplace) continuation of `values` into `domain`. `fixed`
    pixels are the boundary; any other neighbour is left out (zero slope),
    so the shading also runs smoothly up to a garment edge."""
    v = values.astype(np.float32).copy()
    live = np.pad(domain | fixed, 1)
    nb = [live[:-2, 1:-1], live[2:, 1:-1], live[1:-1, :-2], live[1:-1, 2:]]
    cnt = np.maximum(sum(n.astype(np.float32) for n in nb), 1)[..., None]
    nbf = [n[..., None].astype(np.float32) for n in nb]
    yy, xx = np.mgrid[0:domain.shape[0], 0:domain.shape[1]]
    halves = [domain & ((yy + xx) % 2 == k) for k in (0, 1)]
    for _ in range(iterations):
        for m in halves:  # red-black over-relaxation
            p = np.pad(v, ((1, 1), (1, 1), (0, 0)))
            avg = (p[:-2, 1:-1] * nbf[0] + p[2:, 1:-1] * nbf[1] + p[1:-1, :-2] * nbf[2] + p[1:-1, 2:] * nbf[3]) / cnt
            v[m] += 1.85 * (avg[m] - v[m])
    return v


def inner_distance(mask, cap=10.0):
    """Distance (px) from each pixel of `mask` to the nearest pixel outside
    it, capped; exact Euclidean on pixel centres."""
    h, w = mask.shape
    out = np.full((h, w), cap, np.float32)
    edge = ~mask & dilate(mask, 1)
    oy, ox = np.nonzero(edge)
    if not len(oy):
        return out
    near = mask & dilate(edge, int(cap) + 1)
    py, px = np.nonzero(near)
    pts = np.stack([oy, ox], 1).astype(np.float32)
    for s in range(0, len(py), 2048):
        q = np.stack([py[s:s + 2048], px[s:s + 2048]], 1).astype(np.float32)
        d = np.sqrt(((q[:, None, :] - pts[None, :, :]) ** 2).sum(-1)).min(1) - .5
        out[py[s:s + 2048], px[s:s + 2048]] = np.minimum(d, cap)
    out[~mask] = 0
    return out


def dilate(mask, r):
    if r <= 0:
        return mask.copy()
    return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


def erode(mask, r):
    if r <= 0:
        return mask.copy()
    return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(2 * r + 1))) > 127


def largest(mask):
    """The largest 4-connected island of a mask."""
    best = np.zeros_like(mask)
    seen = np.zeros_like(mask)
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        comp = connected(mask, np.eye(1, mask.size, y * mask.shape[1] + x, dtype=bool).reshape(mask.shape))
        seen |= comp
        if comp.sum() > best.sum():
            best = comp
    return best


def connected(mask, seeds):
    """Pixels of `mask` 4-connected to any seed pixel."""
    H, W = mask.shape
    out = np.zeros_like(mask)
    stack = list(zip(*np.nonzero(seeds & mask)))
    for y, x in stack:
        out[y, x] = True
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; stack.append((ny, nx))
    return out


def clean_edges(L):
    """The sheet's soft edge was composited over white: keep the soft alpha
    (dropping it left stair-stepped edges) but give edge pixels the colour of
    the paint just inside. Only the faintest fringe is removed."""
    a = L[..., 3]
    a[a < 40] = 0
    # Line art itself is often only 150-245 alpha; it keeps its colour. Only
    # the faint white-mixed halo (< 100) takes the colour of the paint inside.
    solid = (a >= 150).astype(np.float32)
    rgb = L[..., :3] * solid[..., None]
    acc_c, acc_w = rgb.copy(), solid.copy()
    for radius in (1, 2, 4):
        bc = np.stack([box_blur(rgb[..., i], radius) for i in range(3)], -1)
        bw = box_blur(solid, radius)
        need = (acc_w < 1e-3) & (bw > 1e-3)
        acc_c[need] = bc[need]; acc_w[need] = bw[need]
    edge = (a > 0) & (a < 100) & (acc_w > 1e-3)
    L[..., :3][edge] = (acc_c[edge] / acc_w[edge][:, None])


def small_islands(mask, minimum=40):
    """4-connected islands of a mask smaller than `minimum` pixels."""
    out = np.zeros_like(mask)
    seen = np.zeros_like(mask)
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        comp = connected(mask, np.eye(1, mask.size, y * mask.shape[1] + x, dtype=bool).reshape(mask.shape))
        seen |= comp
        if comp.sum() < minimum:
            out |= comp
    return out


def drop_specks(L, minimum=12):
    """Remove detached generation speckles (small 4-connected islands)."""
    m = L[..., 3] > 25
    H, W = m.shape
    seen = np.zeros_like(m)
    for sy, sx in zip(*np.nonzero(m)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]; seen[sy, sx] = True; comp = []
        while stack:
            y, x = stack.pop(); comp.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; stack.append((ny, nx))
        if len(comp) < minimum:
            ys, xs = zip(*comp)
            L[list(ys), list(xs), 3] = 0
    # Faint fringe left around removed islands.
    L[..., 3][L[..., 3] <= 25] = 0


def bbox(mask, x0, y0, pad=3):
    ys, xs = np.nonzero(mask > .02)
    if not len(xs):
        return None
    return [int(xs.min() + x0 - pad), int(ys.min() + y0 - pad), int(xs.max() - xs.min() + 2 * pad + 1), int(ys.max() - ys.min() + 2 * pad + 1)]


def rects_for(layers, cell, f):
    """Part rects of one figure (sheet px) from the layer alphas: limbs and
    sleeves per side (front/back split at the centre line), shirt, neck and
    shorts with their own padding."""
    x0, y0, x1, y1 = cell
    a = {n: layers[n][y0:y1, x0:x1, 3] / 255 for n in layers}
    c = int(f['center'] - x0)
    out = {}
    for n, layer in (('sleeve', 'sleeves'), ('arm', 'arms'), ('leg', 'legs'), ('shoe', 'shoes')):
        if f['view'] == 'right':
            out[n] = [bbox(a[layer], x0, y0)] * 2
        else:
            left, right = a[layer].copy(), a[layer].copy()
            left[:, c:] = 0; right[:, :c] = 0
            out[n] = [bbox(left, x0, y0), bbox(right, x0, y0)]
    out['shirt'] = bbox(a['shirt'], x0, y0, 6)
    out['neck'] = bbox(a['neck'], x0, y0, 3)
    out['shorts'] = bbox(a['shorts'], x0, y0, 4)
    return out


def sha256_file(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def load_rgba(path):
    return np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)


def save_png(array, path):
    """uint8 RGBA/L PNG, optimised, as the body build writes its layers."""
    Image.fromarray(np.asarray(array).astype(np.uint8)).save(path, optimize=True)
