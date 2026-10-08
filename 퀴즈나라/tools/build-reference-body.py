"""Split the approved reference sheet into the base body's garment layers.

Source: assets/avatar-reference-candidates/body-study-2026-10-04.png
(male/female x front/right/back). Each layer keeps the sheet's pixel grid,
so every part rect and joint below is in original sheet pixels.

Outputs (assets/sd-foundation-ref-*):
  shirt.png    torso + collar; the cloth under the hanging arm and sleeves
               rebuilt from the cloth around it (see rebuild_cloth), with
               the torso's own side outline under the sleeves (front/back)
  sleeves.png  sleeves with cuffs
  shorts.png   shorts; the cloth under the hand rebuilt the same way
  shoes.png    shoes and socks
  arms.png     arms; the part hidden in the sleeve extended to the shoulder
  legs.png     legs; the part hidden in the shorts extended to the hip
  neck.png     neck below the chin, extended up under the original head
  data.js      part rects, joints, limb radii and scale per sex/view

Run: python3 tools/build-reference-body.py [--debug DIR]
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/avatar-reference-candidates/body-study-2026-10-04.png')
OUT = os.path.join(ROOT, 'assets')
SS = 4  # supersampling for anti-aliased zone edges


def mirror(points, cx):
    return [(2 * cx - x, y) for x, y in reversed(points)]


# Landmarks traced on 4x zooms of the sheet. Polylines are y(x) cuts;
# polygons are generous zones whose exact edge comes from the painted
# colours (skin vs. cloth) or from the transparent background.
FIGURES = {
    'm-front': dict(
        view='front', sex='m', center=None,
        cut=[(150, 251), (296, 255), (305, 257), (322, 258), (340, 257), (350, 255), (520, 251)],
        neck_zone=[(292, 250), (352, 250), (352, 268), (345, 280), (323, 288), (300, 280), (292, 268)],
        sleeves=[[(259, 270), (264, 282), (271, 350), (272, 360), (266, 362), (224, 344), (210, 334), (210, 290), (240, 268)]],
        arms=[[(210, 338), (274, 358), (263, 358), (262, 398), (257, 440), (210, 440)]],
        hem=[(150, 401), (250, 401), (290, 406), (323, 407), (356, 406), (396, 401), (520, 401)],
        shorts_bottom=[(150, 468), (300, 469), (310, 469), (323, 447), (336, 469), (346, 469), (520, 468)],
        shoe_top=[(150, 506), (520, 506)],
        torso_fill=[(286, 259), (262, 274), (250, 284), (252, 304), (258, 330), (265, 352), (262, 400), (384, 400), (381, 352), (388, 330), (394, 304), (396, 284), (384, 274), (360, 259)],
    ),
    'm-right': dict(
        view='right', sex='m', center=None,
        cut=[(560, 248), (700, 249), (742, 251), (750, 253), (900, 254)],
        neck_zone=[(700, 246), (766, 246), (766, 280), (745, 272), (705, 262), (700, 258)],
        sleeves=[[(699, 302), (712, 292), (732, 288), (750, 296), (758, 314), (758, 345), (754, 358), (728, 360), (702, 358), (697, 345), (697, 320)]],
        arms=[[(713, 353), (750, 353), (749, 400), (752, 410), (750, 429), (741, 435), (725, 435), (719, 429), (718, 405), (715, 380)]],
        arm_overlaps=True,
        # Back edge of the neck (outer side of its outline) from under the
        # nape hair down to the collar; see the nape block in build(). Kept
        # within ~2 px of the sheet's own line: it only smooths the steps.
        nape=[(710.0, 243), (709.0, 251), (708.0, 254), (707.8, 257)],
        hem=[(560, 403), (730, 407), (900, 403)],
        shorts_bottom=[(560, 467), (900, 467)],
        shoe_top=[(560, 509), (900, 509)],
        torso_fill=[(690, 258), (700, 259), (745, 268), (774, 288), (782, 330), (786, 402), (682, 402), (683, 330), (688, 280)],
        shorts_fill=[(684, 400), (784, 400), (780, 448), (772, 462), (700, 462), (690, 448)],
    ),
    'm-back': dict(
        view='back', sex='m', center=None,
        cut=[(930, 251), (1270, 251)],
        neck_zone=[(1074, 248), (1132, 248), (1132, 270), (1074, 270)],
        sleeves=[[(1047, 268), (1050, 285), (1051, 352), (1052, 362), (1046, 362), (1004, 340), (995, 325), (995, 290), (1025, 268)]],
        arms=[[(995, 335), (1053, 357), (1044, 360), (1042, 398), (1036, 440), (995, 440)]],
        hem=[(930, 400), (1040, 400), (1104, 404), (1168, 400), (1270, 400)],
        shorts_bottom=[(930, 469), (1080, 470), (1092, 470), (1104, 449), (1116, 470), (1128, 470), (1270, 469)],
        shoe_top=[(930, 508), (1270, 508)],
        torso_fill=[(1068, 259), (1045, 274), (1033, 286), (1036, 310), (1042, 332), (1047, 354), (1044, 400), (1164, 400), (1161, 354), (1166, 332), (1172, 310), (1175, 286), (1163, 274), (1140, 259)],
    ),
    'f-front': dict(
        view='front', sex='f', center=None,
        cut=[(150, 778), (300, 779), (322, 780), (345, 779), (520, 778)],
        neck_zone=[(298, 774), (350, 774), (350, 790), (322, 803), (298, 790)],
        sleeves=[[(262, 790), (268, 806), (272, 862), (274, 872), (266, 873), (226, 858), (214, 850), (214, 810), (240, 790)]],
        arms=[[(214, 853), (276, 871), (264, 872), (263, 912), (258, 948), (214, 948)]],
        hem=[(150, 914), (255, 914), (321, 920), (387, 914), (520, 914)],
        shorts_bottom=[(150, 988), (304, 989), (311, 989), (321, 967), (331, 989), (338, 989), (520, 988)],
        shoe_top=[(150, 1032), (520, 1032)],
        torso_fill=[(285, 779), (262, 792), (252, 804), (254, 826), (260, 848), (266, 868), (262, 914), (380, 914), (376, 868), (382, 848), (388, 826), (390, 804), (380, 792), (357, 779)],
    ),
    'f-right': dict(
        view='right', sex='f', center=None,
        cut=[(560, 769), (740, 770), (760, 772), (900, 773)],
        neck_zone=[(705, 762), (772, 762), (772, 796), (745, 791), (712, 786), (705, 783)],
        sleeves=[[(702, 812), (712, 802), (735, 798), (752, 806), (760, 822), (760, 865), (756, 880), (730, 881), (705, 879), (699, 866), (699, 830)]],
        arms=[[(717, 873), (753, 873), (753, 916), (756, 925), (753, 945), (743, 951), (727, 951), (721, 941), (720, 918), (718, 890)]],
        arm_overlaps=True,
        hem=[(560, 922), (726, 926), (900, 922)],
        shorts_bottom=[(560, 990), (900, 990)],
        shoe_top=[(560, 1034), (900, 1034)],
        torso_fill=[(690, 778), (720, 782), (765, 796), (782, 812), (790, 860), (794, 922), (682, 922), (684, 860), (690, 800)],
        shorts_fill=[(686, 920), (790, 920), (788, 966), (780, 986), (692, 986), (688, 966)],
    ),
    'f-back': dict(
        view='back', sex='f', center=None,
        cut=[(930, 780), (1270, 780)],
        neck_zone=None,  # the bob hides it; the male back neck stands in
        # Faint grey line art of the bob's tips lying on both shoulders.
        erase=[[(1000, 770), (1066, 770), (1066, 789.5), (1000, 789.5)], [(1140, 770), (1210, 770), (1210, 789.5), (1140, 789.5)]],
        sleeves=[[(1047, 790), (1052, 806), (1056, 866), (1057, 875), (1050, 875), (1008, 860), (998, 850), (998, 812), (1025, 790)]],
        arms=[[(998, 853), (1058, 873), (1048, 874), (1044, 912), (1040, 948), (998, 948)]],
        hem=[(930, 916), (1040, 916), (1105, 921), (1170, 916), (1270, 916)],
        shorts_bottom=[(930, 986), (1086, 987), (1095, 987), (1105, 966), (1115, 987), (1124, 987), (1270, 986)],
        shoe_top=[(930, 1032), (1270, 1032)],
        torso_fill=[(1068, 786), (1046, 796), (1036, 808), (1038, 828), (1044, 850), (1050, 870), (1046, 916), (1164, 916), (1160, 870), (1166, 850), (1172, 828), (1174, 808), (1164, 796), (1142, 786)],
    ),
}
# Joints, centre lines and floors come from the shared research measurements
# (기준캐릭터-조사/ref/measure-raw.json), not from the traced zones above.
RAW = json.load(open(os.path.join(ROOT, '기준캐릭터-조사/ref/measure-raw.json')))
RAW_NAME = {'m-front': 'male-front', 'm-right': 'male-right', 'm-back': 'male-back',
            'f-front': 'female-front', 'f-right': 'female-right', 'f-back': 'female-back'}
# Collar line shared by every view of a sex (sheet row), mapped to SPEC.collar.
COLLAR_Y = {'m': 264, 'f': 786}
mid = lambda a, b: (a + b) / 2


def derive(key, f):
    """Joint pixels of one figure from the research measurements."""
    r = RAW[RAW_NAME[key]]
    sex, view = f['sex'], f['view']
    front = RAW[RAW_NAME[sex + '-front']]
    floor = max(sh['y1'] for sh in r['shoes'].values())
    front_floor = max(sh['y1'] for sh in front['shoes'].values())
    # The shoulder pivot sits a fixed distance above the cuff top in every view.
    pivot_y = min(c['y0'] for c in front['cuffs'].values()) - 26
    joints = {k: [] for k in ('shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle')}
    hip_y = r['shorts']['blueTop'] + 20
    if view == 'right':
        rows = r['arms']['one']['profile']
        top, bottom = r['arms']['one']['skinTop'], r['arms']['one']['handBottom']
        body = [row for row in rows if top + 4 <= row[0] <= bottom - 12]
        wrist = min(body, key=lambda row: (row[3], -row[0]))
        fit = [row for row in body if row[0] <= wrist[0]]
        ys = np.array([row[0] for row in fit], float); xs = np.array([mid(row[1], row[2]) for row in fit])
        slope, icpt = np.polyfit(ys, xs, 1)
        at = lambda y: float(slope * y + icpt)
        elbow_y = top + 10
        arm = dict(shoulder=(at(pivot_y), pivot_y), elbow=(at(elbow_y), elbow_y), wrist=(mid(wrist[1], wrist[2]), wrist[0]))
        leg = r['legs']['one']
        center = mid(leg['thigh']['l'], leg['thigh']['r'])
        for k, v in arm.items():
            joints[k] = [v, v]
        hand_end = bottom
        legs = [leg, leg]
    else:
        center = mid(mid(r['cuffs']['left']['x0'], r['cuffs']['left']['x1']), mid(r['cuffs']['right']['x0'], r['cuffs']['right']['x1']))
        for side in ('left', 'right'):
            a = r['arms'][side]
            fy, fc = a['forearm']['y'], mid(a['forearm']['l'], a['forearm']['r'])
            wy, wc = a['wrist']['y'], mid(a['wrist']['l'], a['wrist']['r'])
            slope = (wc - fc) / (wy - fy)
            at = lambda y: fc + (y - fy) * slope
            ey = a['cuffBottom'] + 6 if 'cuffBottom' in a else fy + 1
            joints['shoulder'].append((at(pivot_y), pivot_y))
            joints['elbow'].append((at(ey), ey))
            joints['wrist'].append((wc, wy))
        hand_end = max(r['arms'][s]['handBottom'] for s in ('left', 'right'))
        legs = [r['legs']['left'], r['legs']['right']]
    for leg in legs:
        knee_y = leg['top'] + .4 * (leg['shoeTop'] - leg['top'])
        joints['hip'].append((mid(leg['thigh']['l'], leg['thigh']['r']), hip_y))
        joints['knee'].append((mid(leg['knee']['l'], leg['knee']['r']), knee_y))
        joints['ankle'].append((mid(leg['ankle']['l'], leg['ankle']['r']), floor - 30))
    joints = {k: [[round(float(x), 2), round(float(y), 2)] for x, y in v] for k, v in joints.items()}
    joints['hand_end'] = hand_end
    # Below this row the sleeve is opaque cuff; the arm is hidden above it.
    cuff_top = (r['cuffs']['one']['y0'] + 2) if view == 'right' else min(c['y0'] for c in r['cuffs'].values()) + 12
    k = 17.5 / (front_floor - COLLAR_Y[sex])
    return dict(center=round(float(center), 2), neck=(round(float(center), 2), COLLAR_Y[sex]), floor=floor, k=k, joints=joints, cuff_top=cuff_top)


CELLS = {'m-front': (150, 0, 520, 555), 'm-right': (560, 0, 900, 555), 'm-back': (930, 0, 1270, 555),
         'f-front': (150, 555, 520, 1086), 'f-right': (560, 555, 900, 1086), 'f-back': (930, 555, 1270, 1086)}

for key, f in FIGURES.items():
    f.update(derive(key, f))
# Front/back right-hand sleeves and arms mirror the traced left ones.
for f in FIGURES.values():
    if f['view'] != 'right':
        c = f['center']
        f['sleeves'].append(mirror(f['sleeves'][0], c))
        f['arms'].append(mirror(f['arms'][0], c))


def polyline_y(points, xs):
    px = [p[0] for p in points]; py = [p[1] for p in points]
    return np.interp(xs, px, py)


def poly_mask(shape, polygon):
    """Anti-aliased polygon coverage (0..1)."""
    h, w = shape
    img = Image.new('L', (w * SS, h * SS), 0)
    ImageDraw.Draw(img).polygon([(x * SS, y * SS) for x, y in polygon], fill=255)
    return np.asarray(img.resize((w, h), Image.BOX), dtype=np.float32) / 255


def classify(rgb):
    r, g, b = [rgb[..., i].astype(np.int32) for i in range(3)]
    # Cream cuffs/collars in shade (#f5ddbe) sit close to skin; their g-b
    # (31-33) is higher than any skin tone in the sheet (19-24).
    skin = (r > 200) & (g >= 186) & (g <= 234) & (b >= 140) & (b <= 222) & (r - g >= 16) & (r - b >= 30) & (g - b <= 28)
    arm_like = skin | ((r > g + 14) & (r > b + 8) & (r < 245))
    return skin, arm_like


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


# ---------------------------------------------------------------------------
# Cloth under a hanging arm or sleeve (2026-10-08, stage 2 round 2).
#
# The sheet only shows the shirt/shorts around the arm; a swinging arm shows
# what was under it. The old refill diffused one global median colour into
# the hole (flat patches, concentric blobs) and kept the arm's outline and
# cast shadow on the cloth (dark streaks). The hole is now rebuilt from the
# cloth around it, split in two scales:
#   shading  the cloth's local plain colour, continued smoothly into the hole
#            (Laplace equation, boundary = the colour just outside);
#   detail   weave, seams, hem stitching and hem edge, copied patch by patch
#            from clean cloth nearby (exemplar inpainting, Criminisi et al.
#            2004), never from prints: a flower or the acorn is not smeared
#            into the hole, plain ground continues instead.
# Patch matching also compares coverage and distance to the garment edge, so
# a hem edge continues as a hem edge and the interior stays interior.
# ---------------------------------------------------------------------------
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


def print_mask(rgb, ground, cloth):
    """Prints and trims on a cloth (flowers, the acorn, cream collar/cuffs):
    a clearly coloured hue unlike the cloth's own (`cloth`, the garment's
    median colour, so a large collar is not taken for ground), much brighter
    than the local `ground`, or a pale tint on a strongly coloured cloth.
    Shading (painted shadows are more saturated), lines and the hem
    stitching are not prints."""
    hue, chroma = hue_chroma(rgb)
    ch, cc = hue_chroma(np.asarray(cloth, np.float32))
    turn = np.abs((hue - ch + 180) % 360 - 180)
    lift = lum_of(rgb) - lum_of(ground)
    return ((chroma > 45) & (turn > 40)) | (lift > 70) | ((lift > 30) & (chroma < .5 * cc))


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


def exemplar(D, A, E, valid, known, todo, patch=4, window=46, w_pos=.03):
    """Fill the detail image D at `todo` pixels with whole patches copied
    from centres whose patch lies entirely in `valid` (Criminisi et al.).
    A (coverage) and E (distance to the garment edge) are known everywhere
    and must match too. `known` pixels take part in the matching."""
    from numpy.lib.stride_tricks import sliding_window_view as windows
    h, w = todo.shape
    k = 2 * patch + 1
    D = D.copy(); todo = todo.copy(); filled = known & ~todo
    conf = filled.astype(np.float32)
    vsum =np.asarray(Image.fromarray(valid.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(k))) > 127
    vsum[:patch, :] = vsum[-patch:, :] = False; vsum[:, :patch] = vsum[:, -patch:] = False
    cy, cx = np.nonzero(vsum)
    if not len(cy):
        return D
    pad = lambda a: np.pad(a, [(patch, patch), (patch, patch)] + [(0, 0)] * (a.ndim - 2))
    Ap, Ep = pad(A.astype(np.float32)), pad(E.astype(np.float32))
    srcA = windows(Ap, (k, k))[cy, cx]; srcE = windows(Ep, (k, k))[cy, cx]
    srcD = windows(pad(D.astype(np.float32)), (k, k), axis=(0, 1))[cy, cx]  # (n,3,k,k)
    srcIn = srcA > .5
    while todo.any():
        Dp, Fp = pad(D), pad(filled)
        gray = lum_of(D)
        # Front: to-do pixels touching anything already settled.
        front = todo & dilate(~todo, 1)
        fy, fx = np.nonzero(front)
        if not len(fy):
            break
        # Confidence of each front patch.
        cbar = box_blur(conf, patch)[fy, fx]
        # Data term: isophote strength across the front (structure first).
        gp = np.pad(np.where(filled, gray, np.nan), 1)
        gx = (gp[1:-1, 2:] - gp[1:-1, :-2]) / 2; gy = (gp[2:, 1:-1] - gp[:-2, 1:-1]) / 2
        gx = np.nan_to_num(gx)[fy, fx]; gy = np.nan_to_num(gy)[fy, fx]
        m = box_blur(filled.astype(np.float32), 1)
        mp = np.pad(m, 1, mode='edge')
        nx = ((mp[1:-1, 2:] - mp[1:-1, :-2]) / 2)[fy, fx]; ny = ((mp[2:, 1:-1] - mp[:-2, 1:-1]) / 2)[fy, fx]
        nl = np.hypot(nx, ny) + 1e-6
        data = np.abs(-gy * nx / nl + gx * ny / nl) / 64 + .02
        pick = int(np.argmax(cbar * data - 1e-9 * (fy * w + fx)))
        py, px = int(fy[pick]), int(fx[pick])
        tD = Dp[py:py + k, px:px + k]; tA = Ap[py:py + k, px:px + k]; tE = Ep[py:py + k, px:px + k]
        tK = Fp[py:py + k, px:px + k]
        near = (np.abs(cy - py) <= window) & (np.abs(cx - px) <= window)
        idx = np.nonzero(near)[0]
        if not len(idx):
            idx = np.arange(len(cy))
        sD, sA, sE = srcD[idx], srcA[idx], srcE[idx]
        nk = max(1, tK.sum())
        cost = (((sD - tD.transpose(2, 0, 1)[None]) ** 2).sum(1) * tK).sum((1, 2)) / nk
        cost += ((sA - tA) ** 2).sum((1, 2)) * (255 ** 2) / (k * k)
        both = srcIn[idx] & (tA > .5)
        cost += (((sE - tE) * 24) ** 2 * both).sum((1, 2)) / np.maximum(1, both.sum((1, 2)))
        cost += w_pos * ((cy[idx] - py) ** 2 + (cx[idx] - px) ** 2)
        best = idx[int(np.argmin(cost))]
        put = todo[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1]
        oy, ox = max(0, py - patch) - (py - patch), max(0, px - patch) - (px - patch)
        patchD = srcD[best].transpose(1, 2, 0)[oy:oy + put.shape[0], ox:ox + put.shape[1]]
        region = D[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1]
        region[put] = patchD[put]
        conf[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1][put] = cbar[pick]
        filled[max(0, py - patch):py + patch + 1, max(0, px - patch):px + patch + 1][put] = True
        put[:] = False
    return D


def rebuild_cloth(rgb, painted, target, todo, prints, plain_only=False):
    """Shading and detail for the `todo` pixels of one garment (their sum is
    the colour). `painted` is the sheet coverage of the garment, `target`
    the final coverage (equal to it outside the hole). `plain_only` keeps
    only the weave in the copied detail (a torso side under the sleeve has
    no seam or hem to continue; a stray line fragment there read as a mark)."""
    Lf = np.zeros(rgb.shape, np.float32); Df = np.zeros(rgb.shape, np.float32)
    ys, xs = np.nonzero(todo)
    if not len(ys):
        return Lf, Df
    m = 64
    y0, y1 = max(0, ys.min() - m), min(rgb.shape[0], ys.max() + m + 1)
    x0, x1 = max(0, xs.min() - m), min(rgb.shape[1], xs.max() + m + 1)
    C = rgb[y0:y1, x0:x1].astype(np.float32); P = painted[y0:y1, x0:x1]; T = target[y0:y1, x0:x1]
    hole = todo[y0:y1, x0:x1]; pr = prints[y0:y1, x0:x1]
    source = (P > .95) & ~hole
    # Plain ground: the cloth without prints, outlines or seams.
    L1 = local_mean(C, (source & ~pr).astype(np.float32))
    hue, chroma = hue_chroma(C)
    ch, cc = hue_chroma(np.median(C[source & ~pr], axis=0).astype(np.float32))
    own = (np.abs((hue - ch + 180) % 360 - 180) < 35) & (chroma > .25 * cc)
    plain = source & ~pr & own & (np.abs(C - L1).sum(-1) < 40)
    L = local_mean(C, plain.astype(np.float32))
    L = harmonic(L, hole, source & ~hole)
    Dt = np.where(source[..., None], C - L, 0)
    near_hole = dilate(hole, 1)
    valid = ((source & ~dilate(pr, 2)) | ((P < .02) & (T < .02))) & ~near_hole
    E = inner_distance(T > .5, 12.0)
    Dt = exemplar(Dt, T, E, valid, source & ~pr, hole & (T > 0))
    if plain_only:
        weave = 3 * np.median(np.abs(Dt[plain])) + 1
        Dt = np.where(hole[..., None], np.clip(Dt, -weave, weave), Dt)
    Lf[y0:y1, x0:x1] = L; Df[y0:y1, x0:x1] = Dt
    return Lf, Df


def build():
    sheet = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
    H, W = sheet.shape[:2]
    layers = {k: np.zeros((H, W, 4), np.float32) for k in ('shirt', 'sleeves', 'shorts', 'shoes', 'arms', 'legs', 'neck')}
    labels = np.zeros((H, W), np.int8)  # debug: 1 shirt 2 sleeve 3 arm 4 shorts 5 leg 6 shoe
    arm_given = np.zeros((H, W), bool)
    meta = {}
    for key, f in FIGURES.items():
        x0, y0, x1, y1 = CELLS[key]
        cell = sheet[y0:y1, x0:x1]
        h, w = cell.shape[:2]
        xs = np.arange(w) + x0
        Y = np.arange(h)[:, None] + y0 + .5
        alpha = cell[..., 3] / 255
        skin, arm_like = classify(cell)
        r_, g_, b_ = [cell[..., i] for i in range(3)]
        # Skin in the shadow of a cuff, collar or chin. Cream and peach
        # cloth have a higher g-b (31+) and stays cloth.
        shade = (r_ > 170) & (g_ > 120) & (r_ - g_ >= 20) & (r_ - g_ <= 80) & (g_ - b_ <= 28) & (r_ - b_ >= 40)
        loc = lambda poly: [(x - x0, y - y0) for x, y in poly]
        cut = polyline_y(f['cut'], xs)[None, :]
        body = (Y > cut) & (alpha > 0)
        for poly in f.get('erase', []):
            body &= ~(poly_mask((h, w), loc(poly)) > .5)
        # Bob/short hair hanging over the collar and shoulders stays with the head.
        r_, g_, b_ = [cell[..., i] for i in range(3)]
        # Only brown connected to the hair above the collar line; the acorn's
        # brown shading on the chest is not hair.
        hair = (r_ - b_ > 18) & (r_ < 165) & (g_ < r_ * .82) & (b_ < r_ * .72) & (Y < cut + 40)
        neck_zone = (poly_mask((h, w), loc(f['neck_zone'])) > .5) if f.get('neck_zone') else np.zeros((h, w), bool)
        lum = .3 * r_ + .59 * g_ + .11 * b_
        # Collar/cuff cream including its peach shading; skin has g-b <= 28.
        cream = (r_ > 200) & (g_ > 165) & (g_ - b_ >= 29) & (r_ - g_ <= 45) & ~skin
        cloth = cream | (g_ > r_ + 5) | (b_ > r_)
        # The neck is its own skin layer under the shirt: its skin plus the
        # line art along its sides (not the jaw line just under the cut). The
        # collar keeps the outline it shares with the neck.
        # Neck skin includes the chin's cast shadow (#dca78f-like), darker
        # than the limb skin test allows. Shaded collar cream is kept out by
        # g-b, and only the main island counts.
        neck_skin = largest(body & neck_zone & (skin | shade))
        neck_line = body & neck_zone & ~skin & (lum < 160) & dilate(neck_skin, 2) & ~dilate(body & cloth, 3) & (Y > cut + 2)
        # Brown connected to the hair above the cut is hair (also strands
        # hanging past the neck or lying on the shoulders), except the neck's
        # own side lines and the brown outline along a cream collar.
        hair = connected(hair | (Y <= cut), (Y <= cut) & (alpha > 0)) & hair & ~neck_line & ~dilate(cream & (alpha > .5), 3)
        body &= ~hair
        painted = body & (alpha > .5)  # everything that should land in some layer
        neck_px = (neck_skin | neck_line) & body
        body &= ~neck_px
        assigned = np.zeros((h, w), bool)
        part = {n: np.zeros((h, w), np.float32) for n in ('shirt', 'sleeve', 'arm', 'shorts', 'leg', 'shoe')}
        arm_zone = np.zeros((h, w), np.float32)
        for poly in f['arms']:
            arm_zone = np.maximum(arm_zone, poly_mask((h, w), loc(poly)))
        # Cream well above the cuff is the collar, which a side-view sleeve
        # zone can touch; it stays with the shirt. The white petals of a
        # sleeve's flower passed the same colour test and were left on the
        # shirt (a pale petal on the torso, a hole in the sleeve's flower once
        # the arm moved): cream around a flower's yellow centre is a petal
        # unless it joins the collar under the cut.
        collar_cream = (r_ > 232) & (g_ > 226) & (b_ > 170) & ~skin & (Y < f['cuff_top'] - 25)
        flower_heart = (r_ > 200) & (g_ > 120) & (g_ < 215) & (b_ < 100) & (r_ - b_ > 120)
        joined = connected(collar_cream | cream, collar_cream & (Y < cut + 12))
        collar_cream &= joined | ~dilate(flower_heart, 9)
        for poly in f['sleeves']:
            z = poly_mask((h, w), loc(poly))
            sel = body & (z > 0) & ~assigned & ~dilate(collar_cream, 1)
            is_arm = (skin | shade) & (arm_zone > .5)
            part['sleeve'] += np.where(sel & ~is_arm, z, 0)
            assigned |= sel & ~is_arm & (z > .5)
        # Side views: the arm lies over the shirt and shorts, so its traced
        # outline owns every pixel. Front/back arms are separated by colour.
        sel = body & ~assigned & (arm_zone > 0) & arm_like
        # The contour an arm shares with the shirt is dark line art; let the
        # arm keep it (2 px), so a swinging arm is never missing its edge.
        lum = .3 * r_ + .59 * g_ + .11 * b_
        near_arm = dilate(sel & skin, 2) & ~dilate(sel & skin, 0)
        sel |= body & ~assigned & near_arm & (lum < 120) & (Y > f['cuff_top'] + 6)
        if f.get('arm_overlaps'):
            core = np.asarray(Image.fromarray((arm_zone > .5).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(9))) > 127
            sel |= body & ~assigned & core
        part['arm'] += np.where(sel, arm_zone, 0)
        assigned |= sel & (arm_zone > .5)
        hem = polyline_y(f['hem'], xs)[None, :]
        sb = polyline_y(f['shorts_bottom'], xs)[None, :]
        st = polyline_y(f['shoe_top'], xs)[None, :]
        free = body & ~assigned
        # Around the traced hem, blue/navy cloth is shorts and everything else
        # (green, its dark outline, printed flowers) stays with the shirt.
        blue = (b_ > g_ + 8) & (b_ > r_)
        near = (Y > hem - 5) & (Y < hem + 7)
        shirt_px = free & (((Y < hem) & ~(near & blue)) | ((Y >= hem) & near & ~blue & ~skin))
        part['shirt'] += shirt_px
        shorts_zone = free & ~shirt_px & (Y >= hem - 5) & (Y < sb + 6)
        # Peach shorts cuffs are close to skin; only bright skin under the
        # cuff's lower edge belongs to the legs.
        # Below the cuff line the leg's red-brown outline is leg too (left in
        # the shorts it was dropped as a detached speck and the leg lost its
        # edge). Peach cuffs are brighter than line art.
        line_red = (r_ > g_ + 14) & (r_ > b_ + 8) & (lum < 175)
        band = shorts_zone & (Y > sb - 6) & ((skin & (g_ >= 196)) | ((Y >= sb - 1) & (skin | shade | line_red)))
        part['shorts'] += shorts_zone & ~band
        legs = (free & (Y >= sb + 6) & (Y < st)) | band
        shoe_zone = free & (Y >= st)
        sband = shoe_zone & (Y < st + 12) & skin
        part['leg'] += legs | sband
        part['shoe'] += shoe_zone & ~sband
        # Exclusive, anti-aliased coverage: cloth over the arm zone edge.
        total = sum(part.values())
        for n in part:
            part[n] = np.where(total > 1, part[n] / np.maximum(total, 1e-6), part[n]) * alpha
        rgb = cell[..., :3]
        cols_x = np.arange(w)[None, :]

        def garment_prints(painted, hole):
            """Prints/trims of one garment (see print_mask) from its own local
            ground colour, grown 1 px over their soft edges."""
            src = (painted > .95) & ~hole
            cloth = np.median(rgb[src], axis=0)
            # Ground from pixels of the cloth's own hue only: a large cream
            # collar must not lift the ground it is judged against.
            hue, chroma = hue_chroma(rgb)
            ch, cc = hue_chroma(cloth.astype(np.float32))
            own = src & (np.abs((hue - ch + 180) % 360 - 180) < 30) & (chroma > .35 * cc)
            g1 = local_mean(rgb, own.astype(np.float32), (12, 24, 48))
            pr = print_mask(rgb, g1, cloth) & (painted > .5)
            return dilate(pr, 1) & (painted > .2), g1

        def edge_cover(painted, hole, bottom):
            """Side views: coverage below the garment's bottom edge (or above
            its top edge) in the columns where the arm hid it, interpolated
            from the painted edge either side (the hem and waist keep their
            curve instead of the straight bottom of a traced zone)."""
            known_x, known_e = [], []
            for x in range(w):
                rows = np.nonzero(painted[:, x] > .5)[0]
                if not len(rows):
                    continue
                r = int(rows.max() if bottom else rows.min())
                lo, hi = max(0, r - 6), min(h, r + 7)
                if hole[lo:hi, x].any():
                    continue
                band = painted[lo:hi, x].sum()
                known_x.append(x); known_e.append(lo + band if bottom else hi - band)
            e = np.interp(np.arange(w), known_x, known_e)[None, :]
            yy = np.arange(h)[:, None].astype(np.float32)
            return np.clip(e - yy, 0, 1) if bottom else np.clip(yy + 1 - e, 0, 1)

        def side_outline(painted):
            """Front/back: the torso's own outline under each hanging sleeve.

            On the sheet the sleeve hides the torso side above the armpit, so
            a swinging or raised arm showed a straight traced edge with a notch
            where the painted side began, and pale scraps of the cuff. The new
            outline continues the painted side contour from the armpit, curves
            out under the sleeve and meets the sheet's shoulder outline at the
            shoulder point. Where the sleeve's sewn edge is feathered into the
            shirt (the seam fade below), it keeps CLEAR px outside the seam, so
            no torso outline shows through at rest."""
            CLEAR = 9.0
            c = f['center']
            sides = []
            for sp in f['sleeves']:
                s = -1 if np.mean([p[0] for p in sp]) < c else 1
                seam = sp[:3] if abs(sp[0][0] - c) < abs(sp[-1][0] - c) else sp[-3:]
                seam = sorted(seam, key=lambda p: p[1])
                yc = max(p[1] for p in sp if abs(p[0] - seam[-1][0]) < 10)
                rows, edges = [], []
                for yy in range(int(yc) + 2, int(yc) + 26):
                    ly = yy - y0
                    cs = np.nonzero(painted[ly] > .5)[0]
                    cs = cs[(cs + x0 - c) * s > 0]
                    if not len(cs):
                        continue
                    xe = int(cs.max() if s > 0 else cs.min())
                    frac = painted[ly, xe + s] if 0 <= xe + s < w else 0
                    edges.append(xe + x0 + .5 + s * (.5 + frac)); rows.append(yy + .5)
                slope, icpt = np.polyfit(rows, edges, 1)
                line = lambda yv: slope * yv + icpt
                A = np.array([line(yc + 1.5), yc + 1.5])
                xS = seam[0][0] + s * CLEAR
                col = alpha[:, int(round(xS - x0))]
                r0 = int(np.nonzero((col > .5) & (np.arange(h) + y0 > cut[0, int(round(xS - x0))]))[0][0])
                S = np.array([xS, r0 + y0 + 1 - col[r0]])
                k_ = .45 * (A[1] - S[1])
                t = np.linspace(0, 1, 64)[:, None]
                P = [A, A + [0, -k_], S + [s * .15 * k_, k_], S]
                curve = ((1 - t) ** 3) * P[0] + 3 * ((1 - t) ** 2) * t * P[1] + 3 * (1 - t) * t * t * P[2] + t ** 3 * P[3]
                # Keep clear of the feathered seam (the fade is off within 14 px
                # of the cuff end, see the sleeve fade below).
                sy = [p[1] for p in seam]; sx = [p[0] for p in seam]
                need = np.clip((seam[-1][1] - 14 - curve[:, 1]) / 8, 0, 1) * CLEAR
                limit = np.interp(curve[:, 1], sy, sx) + s * need
                curve[:, 0] = np.minimum(curve[:, 0], limit) if s < 0 else np.maximum(curve[:, 0], limit)
                for _ in range(3):  # soften any corner the limit made
                    curve[1:-1, 0] = (curve[:-2, 0] + curve[1:-1, 0] + curve[2:, 0]) / 3
                low = yc + 70
                poly = [(c, y0 + 1), (xS, y0 + 1)] + [tuple(p) for p in curve[::-1]] + [(line(low), low), (c, low)]
                sides.append(dict(s=s, A=A, S=S, line=line, yc=yc, poly=poly))
            cov = np.zeros((h, w), np.float32)
            for sd in sides:
                cov = np.maximum(cov, poly_mask((h, w), loc(sd['poly'])))
            return cov, sides

        def outline_profile(painted, samples, ground):
            """A painted side contour, as colour relative to the local cloth by
            distance from the edge (px). `samples`: (sheet row, side) pairs,
            side -1 for a contour facing -x."""
            # Rows are aligned on their darkest line pixel before taking the
            # median, so the line keeps the painted darkness instead of
            # being smeared by its sub-pixel wobble.
            rows = []
            for yy, s in samples:
                if True:
                    ly = yy - y0
                    cs = np.nonzero(painted[ly] > .5)[0]
                    cs = cs[(cs + x0 - f['center']) * s > 0]
                    if not len(cs):
                        continue
                    xe = int(cs.max() if s > 0 else cs.min())
                    e = xe + .5 + s * (.5 + (painted[ly, xe + s] if 0 <= xe + s < w else 0))
                    inside = [int(np.floor(e - s * (k + .5))) for k in range(4)]
                    dark = min(inside, key=lambda x: lum_of(rgb[ly, x]))
                    rows.append((ly, s, e, abs(dark + .5 - e)))
            line_at = float(np.median([r[3] for r in rows]))
            prof = []
            for ly, s, e, at in rows:
                ref = ground[ly, int(round(e - s * 10))]
                xs_ = e - s * (np.arange(9) + .5 + (at - line_at))
                vals = np.stack([np.interp(xs_ - .5, np.arange(w), rgb[ly, :, ch]) for ch in range(3)], -1)
                prof.append(vals / np.maximum(ref, 1))
            R = np.median(np.array(prof), 0)
            R = R / R[-1]
            # The outermost sample is the sheet's white-mixed fringe (coverage
            # gives the new edge its own soft rim), and past the line the
            # painted rim light and form shadow are kept only as a smooth
            # falloff: a crisp copy read as a second outline along the curve.
            R[0] = R[1]
            for _ in range(2):
                tail = np.pad(R[3:], ((1, 1), (0, 0)), mode='edge')
                R[3:] = (tail[:-2] + tail[1:-1] + tail[2:]) / 3
            return R

        def draw_outline(out, L, Dt, todo, R, dist):
            """Paint profile R (from outline_profile) on the rebuilt pixels
            within 8 px of a new garment edge (`dist`: px from that edge)."""
            near = todo & (dist < 8)
            di = np.clip(dist, 0, 8)
            ratio = np.stack([np.interp(di, np.arange(9) + .5, R[:, ch]) for ch in range(3)], -1)
            wgt = np.clip((di - 3) / 4, 0, 1)[..., None]
            edge_col = np.clip(L * ratio + Dt * wgt * wgt, 0, 255)
            return np.where(near[..., None], edge_col, out)

        def refill(name, polygon, under):
            """Opaque cloth wherever an arm, hand or sleeve covered this
            garment on the sheet, continuing the cloth around it."""
            painted = part[name].copy()
            others = sum(part[u] for u in under)
            side = f['view'] == 'right'
            hue, chroma = hue_chroma(rgb)
            warm = (hue > -15) & (hue < 65) & (chroma > 12)  # skin, outline browns
            white = (rgb.min(-1) > 205) & (rgb.max(-1) - rgb.min(-1) < 30)  # petals
            # Arm/cuff colours; a vivid yellow flower heart is cloth (the arm's
            # edge is a duller warm colour and can touch a flower's petals).
            armish = (skin | shade | cream | warm) & (chroma < 90)
            if side:
                zone = list(polygon)
                if name == 'shirt':
                    # The hem comes from edge_cover; the traced zone stopped at
                    # a straight row above it (a step under the arm).
                    low = max(p[1] for p in zone)
                    zone = [(x, y + 12 if y == low else y) for x, y in zone]
                sil = poly_mask((h, w), loc(zone))
                sides = None
            else:
                # The side contour is measured on cloth-coloured pixels only:
                # shaded skin of the arm left on the shirt beside the torso
                # widened it.
                clothy = np.where(armish, 0, painted)
                sil, sides = side_outline(clothy)
            hole = (sil > 0) & (painted < .9) & (others > .05)
            prints, ground = garment_prints(painted, hole)
            covered = dilate(others > .5, 3)
            # Scraps of the cuff and the skin under it painted on the cloth
            # next to the cuff (not the white petals of a print). On the new
            # outline they are cut away (no coverage there). They belong to
            # the cuff or arm next to them, which takes them over.
            real_print = prints & ~small_islands(prints, 40)
            scraps = (painted > .05) & dilate(sil > .5, 2) & covered & (skin | shade | cream | warm) & ~white & ~collar_cream & ~real_print & (Y > f['cuff_top'] - 25)
            hole |= scraps
            ring = np.zeros((h, w), bool)
            if side:
                # The outline and cast shadow of the arm and sleeve painted on
                # the cloth around them (the sleeve's back edge, the cap's
                # arc, the arm's sides): they streaked the cloth once the arm
                # swung away. The collar keeps its own outline.
                wide = local_mean(rgb, ((painted > .95) & ~hole & ~prints).astype(np.float32), (12, 24, 48))
                darker = lum_of(rgb) < lum_of(wide) - 8
                redder = (rgb[..., 0] - rgb[..., 1]) > (wide[..., 0] - wide[..., 1]) + 12
                owner = dilate(part['arm'] > .5, 5) | dilate(part['sleeve'] > .5, 4)
                # A print keeps its pixels; a few print-coloured specks (the
                # cuff's brown edge) are not a print (real_print above).
                # The figure's own outer contour stays: where the female sleeve
                # forms her back on the sheet, the shirt owns that outline and
                # it is the torso's back line once the arm swings.
                contour = dilate(alpha < .5, 3)
                # Every print keeps its outline (the acorn's stem lies 3 px from
                # the sleeve) except specks touching the arm or sleeve.
                keep_print = prints & ~connected(prints, prints & dilate(others > .5, 1))
                ring = owner & (painted >= .9) & (sil > .5) & ~dilate(keep_print, 2) & ~contour & (darker | redder) & ~dilate(collar_cream, 4)
                if name == 'shorts':
                    # On the shorts the dark arc under the fist stays: once the
                    # hand moves it reads as the pocket's opening, and at rest
                    # it is the fist's shadow. Only the hand's own warm outline
                    # leaves (handed to the arm below).
                    ring &= warm
                hole |= ring
                cover = np.minimum(sil, alpha)
                if name == 'shirt':
                    cover = np.minimum(cover, edge_cover(painted, hole, bottom=True))
                # The shorts keep the traced zone's top under the shirt hem: it
                # is never seen, and the shorts picture keeps its size (the
                # shorts mesh is laid over that rectangle, so a smaller one
                # redrew the resting shorts a little differently).
            else:
                cover = np.minimum(sil, alpha)
                # Shirt left outside the new outline above the armpit (cuff
                # ends, petals) is not shirt.
                above = np.zeros((h, w), bool)
                for sd in sides:
                    above |= (Y < sd['A'][1]) & ((cols_x + x0 - f['center']) * sd['s'] > 0)
                stray = above & (painted > 0) & ~dilate(sil > 0, 1)
                # Below the armpit, the shaded skin of the hanging arm beside
                # the torso failed the arm's colour test and was left on the
                # shirt (a pale block beside the torso once the arm swung).
                beside = np.zeros((h, w), bool)
                for sd in sides:
                    beside |= (Y >= sd['A'][1]) & (Y < sd['yc'] + 26) & ((cols_x + x0 - f['center']) * sd['s'] > 0)
                arm_bits = beside & (painted > .05) & ~dilate(sil > .5, 1) & armish & ~white
                scraps |= arm_bits
                painted = np.where(stray | arm_bits, 0, painted)
            target = np.where(hole, cover, painted)
            todo = hole & (target > 0)
            L, Dt = rebuild_cloth(rgb, painted, target, todo, prints, plain_only=not side)
            out = np.where(todo[..., None], np.clip(L + Dt, 0, 255), rgb)
            if DEBUG_DIR:
                os.makedirs(DEBUG_DIR, exist_ok=True)
                tag = os.path.join(DEBUG_DIR, key + '-' + name)
                Image.fromarray(np.clip(np.where(todo[..., None], L, rgb), 0, 255).astype(np.uint8)).save(tag + '-shading.png')
                Image.fromarray(np.clip(np.where(todo[..., None], 128 + 2 * Dt, 128), 0, 255).astype(np.uint8)).save(tag + '-detail.png')
                Image.fromarray((np.stack([todo, prints, target > .5], -1) * 255).astype(np.uint8)).save(tag + '-masks.png')
            if sides:
                # The new outline takes the painted contour's look.
                R = outline_profile(clothy, [(yy, sd['s']) for sd in sides for yy in range(int(sd['yc']) + 3, int(sd['yc']) + 26)], ground)
                out = draw_outline(out, L, Dt, todo, R, inner_distance(target > .5, 8.0))
            # Hand over what the arm or sleeve itself painted on this cloth, so
            # the figure at rest keeps the sheet's edges and the moving part
            # carries them: cuff scraps, the warm outline of the arm or hand
            # and the dark outline of the sleeve where it lay on the cloth
            # (opaque, as painted; a translucent copy doubled up where the
            # limb's warped triangles overlap). Seams and pocket lines of the
            # cloth next to the hand stay cloth (they are not warm), and the
            # soft cast shadow is cloth rebuilt without it: it belongs to
            # neither part once the arm moves.
            near_sleeve = box_blur((part['sleeve'] > .5).astype(np.float32), 4)
            near_arm = box_blur((part['arm'] > .5).astype(np.float32), 4)
            to_arm = near_arm > near_sleeve
            give = scraps.copy()
            if side:
                give |= ring & dilate(part['arm'] > .5, 3) & warm & (lum_of(rgb) < lum_of(wide) - 10)
                # The sleeve cap's outline and its soft shadow on the shoulder
                # (green on green, it moves with the cap).
                give |= ring & dilate(part['sleeve'] > .5, 4) & ~dilate(part['arm'] > .5, 3) & (Y < f['cuff_top'])
            # Only pixels joined to the part's own paint: a detached speck rode
            # beside the swinging sleeve as a floating stroke.
            arm_own, sleeve_own = part['arm'] > .5, part['sleeve'] > .5
            give = (give & to_arm & connected((give & to_arm) | arm_own, arm_own)) | (give & ~to_arm & connected((give & ~to_arm) | sleeve_own, sleeve_own))
            handover.append(dict(mask=give, rgb=rgb, a=np.where(give, part[name], 0), arm=to_arm))
            return out, target
        handover = []
        shirt_rgb, shirt_a = refill('shirt', f['torso_fill'], ('sleeve', 'arm'))
        shorts_rgb, shorts_a = (refill('shorts', f['shorts_fill'], ('arm',)) if 'shorts_fill' in f else (rgb, part['shorts']))
        # Arms/legs: extend the top painted row upward to the joint (inside
        # sleeve/shorts) so a moving limb never shows a cut end.
        limb_rgb = {'arm': rgb.copy(), 'leg': rgb.copy()}; limb_a = {'arm': part['arm'].copy(), 'leg': part['leg'].copy()}
        J = f['joints']
        sides = [0] if f['view'] == 'right' else [0, 1]
        for i in sides:
            for top_joint, low_joint, mask_name in ((J['shoulder'][i], J['elbow'][i], 'arm'), (J['hip'][i], J['knee'][i], 'leg')):
                m = part[mask_name] > .5
                skin_rgb, skin_a = limb_rgb[mask_name], limb_a[mask_name]
                cx = int(low_joint[0] - x0)
                lo, hi = max(0, cx - 26), min(w, cx + 26)
                # First row where the limb is a solid span, below any cuff shadow.
                widths = np.array([(m[y, lo:hi] & skin[y, lo:hi]).sum() for y in range(h)])
                below = int(low_joint[1] - y0)
                full = widths[below:below + 30].max() * .85
                rows = [y for y in range(int(top_joint[1] - y0), below + 16) if widths[y] >= full]
                if not rows:
                    continue
                # Skip the cuff's shadow and lower outline painted on the skin.
                src = rows[0] + (6 if mask_name == 'arm' else 1)
                # Copy only the row's skin run: line art at its ends (or the
                # shirt contour it touched) would streak up the hidden limb.
                span = np.nonzero(m[src, lo:hi] & skin[src, lo:hi])[0]
                a, b = lo + span.min(), lo + span.max() + 1
                ty = int(top_joint[1] - y0) - 4
                hidden = (f['cuff_top'] if mask_name == 'arm' else int(polyline_y(f['shorts_bottom'], [low_joint[0]])[0]) - 8) - y0
                for yy in range(max(0, ty), src + 1):
                    if yy < hidden:
                        # Fully inside the sleeve/shorts: replace, leaning the
                        # hidden part toward the joint it hangs from.
                        t = (src - yy) / max(1, src - ty)
                        shift = int(round((top_joint[0] - low_joint[0]) * t * .9))
                        skin_a[yy, lo:hi] = 0
                        skin_rgb[yy, a + shift:b + shift] = skin_rgb[src, a:b]
                        skin_a[yy, a + shift:b + shift] = 1.0
                    else:
                        # Visible under the cuff: keep the painted skin and
                        # only fill gaps inside the limb's run.
                        gap = skin_a[yy, a:b] < .5
                        skin_rgb[yy, a:b][gap] = skin_rgb[src, a:b][gap]
                        skin_a[yy, a:b][gap] = 1.0
        neck_rgb, neck_a = rgb.copy(), np.where(neck_px, 1.0, 0.0).astype(np.float32)
        if neck_skin.any():
            runs = neck_skin.sum(1)
            # The top full row still carries the chin's cast shadow; the
            # original head's chin sits ~4 px higher than the sheet's, so that
            # shadow row is continued upward, narrowing to hide behind the
            # round jaw instead of showing square corners.
            first = int(np.nonzero(runs >= runs.max() * .6)[0][0])
            if f['view'] == 'back':
                # Back copies the first row that already has the full
                # neck width with both side lines; a narrower row made the
                # extended top step inwards (a "cut" neck side).
                full = neck_px.sum(1)
                first = int(np.nonzero(full >= full.max() * .92)[0][0])
            skin_cols = np.nonzero(neck_skin[first])[0]
            a0, a1 = skin_cols.min(), skin_cols.max() + 1
            side = f['view'] == 'right'
            # Front/back: the wider face or hair covers the whole top, so the
            # row (with its side lines) continues straight up. Side view: the
            # throat narrows under the jaw and the nape a little under the hair.
            # Copy the row with its side line art, so the extended neck keeps
            # its outline where the original hair stops short of the sheet's.
            line_cols = np.nonzero(neck_px[first])[0]
            a0, a1 = line_cols.min(), line_cols.max() + 1
            reach = 40 if side else 14
            for yy in range(max(0, first - reach), first):
                step = first - yy
                left = 0
                # Side: the throat edge leans in a little under the jaw.
                right = step // 5 if side else 0
                span = slice(a0 + left, a1 - right)
                if side:
                    # Only fill: painted neck rows above `first` keep their
                    # own pixels (the back outline below the hair lives there).
                    empty = neck_a[yy, span] < .5
                    neck_rgb[yy, span][empty] = rgb[first, span][empty]
                    neck_a[yy, span][empty] = 1.0
                else:
                    # Front/back: the sheet's rows above `first` are the chin
                    # edge (dark blended line) and narrower side scraps that
                    # showed as a line and a notch under the higher original
                    # chin; the full row replaces them.
                    neck_a[yy, :] = 0.0
                    neck_rgb[yy, span] = rgb[first, span]
                    neck_a[yy, span] = 1.0
            if f['view'] == 'back':
                # The original back hair frames the nape with strokes a little
                # wider than the sheet's neck; the neck's own outline is
                # widened 3 px under them so no background sliver shows.
                for yy in range(max(0, first - reach), min(h, first + 12)):
                    cols = np.nonzero(neck_a[yy] > .5)[0]
                    if len(cols) < 2:
                        continue
                    l, r = cols.min(), cols.max()
                    for xx in range(max(0, l - 3), l):
                        neck_rgb[yy, xx] = neck_rgb[yy, l]; neck_a[yy, xx] = 1.0
                    for xx in range(r + 1, min(w, r + 4)):
                        neck_rgb[yy, xx] = neck_rgb[yy, r]; neck_a[yy, xx] = 1.0
            # Collar-edge pixels the copy replaced go back to the shirt.
            orphan = neck_px & (neck_a < .5)
            shirt_rgb = np.where(orphan[..., None], rgb, shirt_rgb)
            shirt_a = np.maximum(shirt_a, orphan * alpha)

        # Cloth pixels handed back to the sleeve or arm that painted them (see
        # refill), before the pin-hole pass: at rest the two shares add up to
        # the sheet's pixel again. Limb radii are measured without them.
        for it in handover:
            arm_given[y0:y1, x0:x1] |= it['mask'] & it['arm']
            for sel, a_ in ((it['mask'] & it['arm'], limb_a['arm']), (it['mask'] & ~it['arm'], part['sleeve'])):
                a_[sel] = np.minimum(alpha[sel], a_[sel] + it['a'][sel])

        # Close pin-holes: painted pixels that no layer took (left between
        # neighbouring cuts) join the layer that covers most of their
        # surroundings, so no seam shows the background.
        owners = {'shirt': [shirt_rgb, shirt_a], 'neck': [neck_rgb, neck_a], 'sleeve': [rgb, part['sleeve']],
                  'arm': [limb_rgb['arm'], limb_a['arm']], 'leg': [limb_rgb['leg'], limb_a['leg']],
                  'shorts': [shorts_rgb, shorts_a], 'shoe': [rgb, part['shoe']]}
        # Detached fragments are dropped first, so their pixels are refilled
        # into the layer around them rather than lost.
        for v in owners.values():
            v[1] = v[1] * ~small_islands(v[1] > .1)
        cover = sum(np.clip(v[1], 0, 1) for v in owners.values())
        holes = painted & (cover < .5)
        if True:
            near = {k: box_blur(np.clip(v[1], 0, 1).astype(np.float32), 2) for k, v in owners.items()}
            best = np.argmax(np.stack(list(near.values())), 0)
            for idx, (k, v) in enumerate(owners.items()):
                take = holes & (best == idx)
                if take.any():
                    v[0] = np.where(take[..., None], rgb, v[0]); v[1] = np.maximum(v[1], take * alpha)
            # Boundary pixels split between two zones (one share then lost to a
            # colour test) were left half transparent; the main owner takes
            # the painted alpha back.
            stack = np.stack([np.clip(v[1], 0, 1) for v in owners.values()])
            cover = stack.sum(0)
            short = painted & (cover < alpha - .05)
            top = np.argmax(stack, 0)
            for idx, (k, v) in enumerate(owners.items()):
                fix = short & (top == idx) & (stack[idx] > 0)
                v[1] = np.where(fix, alpha, v[1])
            shirt_rgb, shirt_a = owners['shirt']; neck_rgb, neck_a = owners['neck']
            part['sleeve'] = owners['sleeve'][1]; limb_rgb['arm'], limb_a['arm'] = owners['arm']
            limb_rgb['leg'], limb_a['leg'] = owners['leg']; shorts_rgb, shorts_a = owners['shorts']; part['shoe'] = owners['shoe'][1]

        # The neck continues a few px under the opaque shirt: two anti-aliased
        # edges meeting at the collar left a see-through hairline seam.
        if neck_a.max() > 0:
            solid_neck = neck_a > .5
            under = (dilate(solid_neck, 4) & (shirt_a > .9) & ~solid_neck) | ((neck_a > 0) & (shirt_a > 0))
            if under.any():
                fill = fill_colors(np.concatenate([neck_rgb, solid_neck[..., None] * 255.0], -1), solid_neck)
                neck_rgb = np.where((under & ~solid_neck)[..., None], fill, neck_rgb)
                neck_a = np.where(under, 1.0, neck_a)

        if f.get('nape') and neck_a.max() > 0:
            # Side view: the copied rows keep a vertical back edge (x 710)
            # that met the sheet's thicker painted stroke at 709/708 in two
            # 1-px stair steps (visible at 8x below the nape hair). From the
            # top of the extension down to the collar, the back outline is
            # redrawn on the traced nape curve: every row takes the outline
            # band of the top (copied) row, resampled at sub-pixel position,
            # then its own skin. One outline profile on one smooth line, as on
            # the sheet. Only ever widens. The nape gap itself is closed on the
            # head side (avatar-foundation.js VIEW_HEAD.m.profile).
            nx = [p[0] - x0 for p in f['nape']]; ny = [p[1] - y0 for p in f['nape']]
            lum_n = .3 * neck_rgb[..., 0] + .59 * neck_rgb[..., 1] + .11 * neck_rgb[..., 2]
            def band(yy):
                cols = np.nonzero(neck_a[yy] > .5)[0]
                if not len(cols):
                    return None
                inner = cols[lum_n[yy, cols] >= 175]  # first skin past the outline
                return int(cols.min()), int(inner.min()) if len(inner) else int(cols.min()) + 3
            top = int(np.nonzero((neck_a > .5).any(1))[0][0])
            ls, bs = band(top)
            src_a, src_pm = neck_a[top].copy(), neck_rgb[top] * neck_a[top][:, None]
            centres = np.arange(w) + .5
            def sample(a_row, pm_row, pos):
                pos = pos - .5; i0 = np.clip(np.floor(pos).astype(int), 0, w - 1); i1 = np.clip(i0 + 1, 0, w - 1); t = (pos - np.floor(pos))[:, None]
                return a_row[i0] * (1 - t[:, 0]) + a_row[i1] * t[:, 0], pm_row[i0] * (1 - t) + pm_row[i1] * t
            for yy in range(top, min(h, int(max(ny)) + 1)):
                own = band(yy)
                if own is None:
                    continue
                l, b = own
                edge = min(float(np.interp(yy, ny, nx)), l)
                if l - edge < .05 and yy > top + 1 and (b - l) == (bs - ls):
                    continue
                a_band, pm_band = sample(src_a, src_pm, ls + (centres - edge))
                fill_a, fill_pm = neck_a[yy, b], neck_rgb[yy, b] * neck_a[yy, b]
                in_band = centres - edge < bs - ls
                in_fill = ~in_band & (centres < b + .5)
                back = np.arange(w) <= b
                a_new = np.where(in_band, a_band, np.where(in_fill, fill_a, neck_a[yy]))
                pm_new = np.where(in_band[:, None], pm_band, np.where(in_fill[:, None], fill_pm[None, :], neck_rgb[yy] * neck_a[yy][:, None]))
                neck_rgb[yy, back] = np.where(a_new[back, None] > 0, pm_new[back] / np.maximum(a_new[back], 1e-6)[:, None], neck_rgb[yy, back])
                neck_a[yy, back] = a_new[back]

        def put(name, rgb_, a):
            L = layers[name]
            region = L[y0:y1, x0:x1]
            a = np.clip(a, 0, 1)
            region[..., :3] = np.where(a[..., None] > 0, rgb_, region[..., :3])
            region[..., 3] = np.maximum(region[..., 3], a * 255)
        put('shirt', shirt_rgb, shirt_a)
        # The sewn edge of a sleeve fades into the shirt, so a swinging sleeve
        # never shows a cut line across the torso fabric. Front/back only: a
        # side-view sleeve cap has its own painted seam.
        sleeve_a = part['sleeve']
        if f['view'] != 'right':
            # A print on the sleeve (the female sleeve's flower at the shoulder)
            # stays opaque: it is the sleeve's own and moves with it.
            sleeve_print, _ = garment_prints(part['sleeve'], np.zeros((h, w), bool))
            yy, xx = np.mgrid[0:h, 0:w] + np.array([y0, x0])[:, None, None] + .5
            for poly in f['sleeves']:
                # The traced seam is the three points nearest the body centre.
                seam = poly[:3] if abs(poly[0][0] - f['center']) < abs(poly[-1][0] - f['center']) else poly[-3:]
                d = np.full((h, w), 1e9)
                for (ax, ay), (bx, by) in zip(seam, seam[1:]):
                    vx, vy = bx - ax, by - ay
                    t = np.clip(((xx - ax) * vx + (yy - ay) * vy) / (vx * vx + vy * vy), 0, 1)
                    d = np.minimum(d, np.hypot(xx - ax - t * vx, yy - ay - t * vy))
                end = max(p[1] for p in seam)
                fade = np.clip(d / 6, 0, 1); fade = fade * fade * (3 - 2 * fade)
                keep = np.clip((yy - (end - 22)) / 8, 0, 1)  # cuff end stays crisp
                sleeve_a = sleeve_a * np.maximum(np.maximum(fade, keep), sleeve_print)
        put('sleeves', rgb, sleeve_a)
        put('shorts', shorts_rgb, shorts_a)
        put('shoes', rgb, part['shoe'])
        put('neck', neck_rgb, neck_a)
        put('arms', limb_rgb['arm'], limb_a['arm'])
        put('legs', limb_rgb['leg'], limb_a['leg'])
        for idx, n in enumerate(('shirt', 'sleeve', 'arm', 'shorts', 'leg', 'shoe'), 1):
            labels[y0:y1, x0:x1][part[n] > .5] = idx
        meta[key] = {k: f[k] for k in ('view', 'sex', 'center', 'k', 'neck', 'floor', 'joints', 'cuff_top')}
    for name, L in layers.items():
        clean_edges(L)
        drop_specks(L)
    # Limb widths are measured on the painted limbs alone: an outline pixel
    # handed over in refill must not widen the joints' radii.
    measure = dict(layers); measure['arms'] = np.where(arm_given[..., None], 0, layers['arms'])
    radii = {key: radii_for(measure, f) for key, f in FIGURES.items()}
    # Last pin-holes: a painted sheet pixel left in no layer but enclosed by
    # neck/shirt pixels (cleaning can open one at a three-layer junction).
    trio = [layers[n] for n in ('neck', 'shirt', 'sleeves')]
    solid = [L[..., 3] > 200 for L in trio]
    # A pixel the arm paints is not a hole (it put skin scraps on the shirt
    # at the armpit, seen once the arm moved).
    empty = (sheet[..., 3] > 200) & ~np.logical_or.reduce([L[..., 3] > 30 for L in trio + [layers['arms']]])
    counts = [box_blur(m.astype(np.float32), 1) * 9 for m in solid]
    total = sum(counts)
    best = np.argmax(np.stack(counts), 0)
    for idx, L in enumerate(trio):
        take = empty & (total >= 5) & (best == idx)
        L[take] = np.concatenate([sheet[take][:, :3], np.full((take.sum(), 1), 255.0)], -1)
    for name, L in layers.items():
        Image.fromarray(L.astype(np.uint8)).save(os.path.join(OUT, 'sd-foundation-ref-' + name + '.png'), optimize=True)
    for key, f in FIGURES.items():
        meta[key]['rects'] = rects_for(layers, CELLS[key], f)
        meta[key]['radii'] = radii[key]
    data = {'source': 'assets/avatar-reference-candidates/body-study-2026-10-04.png', 'figures': meta}
    with open(os.path.join(OUT, 'sd-foundation-ref-data.js'), 'w') as fh:
        fh.write('/* Generated by tools/build-reference-body.py. Sheet pixels. Do not edit. */\n'
                 '(typeof window===\'undefined\'?globalThis:window).QPFoundationReferenceData=Object.freeze('
                 + json.dumps(data, separators=(',', ':')) + ');\n')
    return sheet, labels


def radii_for(layers, f):
    """Half widths (px) of each painted limb at its three joints."""
    J = f['joints']
    out = {'arm': [], 'leg': []}
    def half(layer, p, dy=0):
        y = int(round(p[1] + dy)); x = int(round(p[0]))
        row = layers[layer][y, max(0, x - 30):x + 30, 3] > 128
        xs = np.nonzero(row)[0]
        return float((xs.max() - xs.min() + 1) / 2) if len(xs) else 0.0
    for i in range(2):
        out['arm'].append([half('arms', J['shoulder'][i], 12), half('arms', J['elbow'][i]), half('arms', J['wrist'][i])])
        out['leg'].append([half('legs', J['hip'][i], 8), half('legs', J['knee'][i]), half('legs', J['ankle'][i], -14)])
    return out


def dilate(mask, r):
    if r <= 0:
        return mask.copy()
    return np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127


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


def debug(sheet, labels, directory):
    os.makedirs(directory, exist_ok=True)
    pal = np.array([[0, 0, 0], [40, 200, 60], [250, 220, 40], [250, 90, 160], [40, 90, 250], [250, 140, 40], [140, 60, 220]], np.float32)
    rgb = sheet[..., :3].copy(); a = sheet[..., 3:] / 255
    base = rgb * a + 150 * (1 - a)
    over = np.where(labels[..., None] > 0, base * .45 + pal[labels.clip(0)] * .55, base)
    Image.fromarray(over.astype(np.uint8)).save(os.path.join(directory, 'labels.png'))
    for name in ('shirt', 'sleeves', 'shorts', 'shoes', 'arms', 'legs', 'neck'):
        im = Image.open(os.path.join(OUT, 'sd-foundation-ref-' + name + '.png'))
        bg = Image.new('RGBA', im.size, (120, 160, 200, 255)); bg.alpha_composite(im)
        bg.convert('RGB').save(os.path.join(directory, name + '.png'))


DEBUG_DIR = None
if __name__ == '__main__':
    if '--debug' in sys.argv:
        DEBUG_DIR = os.path.join(sys.argv[sys.argv.index('--debug') + 1], 'refill')
    sheet, labels = build()
    if '--debug' in sys.argv:
        debug(sheet, labels, sys.argv[sys.argv.index('--debug') + 1])
    print('ok')
