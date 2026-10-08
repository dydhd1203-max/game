"""Split the approved reference sheet into the base body's garment layers.

Source: assets/avatar-reference-candidates/body-study-2026-10-04.png
(male/female x front/right/back). Each layer keeps the sheet's pixel grid,
so every part rect and joint below is in original sheet pixels.

Outputs (assets/sd-foundation-ref-*):
  shirt.png    torso + collar, armhole/arm-covered areas refilled
  sleeves.png  sleeves with cuffs
  shorts.png   shorts, hand-covered areas refilled
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


def build():
    sheet = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)
    H, W = sheet.shape[:2]
    layers = {k: np.zeros((H, W, 4), np.float32) for k in ('shirt', 'sleeves', 'shorts', 'shoes', 'arms', 'legs', 'neck')}
    labels = np.zeros((H, W), np.int8)  # debug: 1 shirt 2 sleeve 3 arm 4 shorts 5 leg 6 shoe
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
        # zone can touch; it stays with the shirt.
        collar_cream = (r_ > 232) & (g_ > 226) & (b_ > 170) & ~skin & (Y < f['cuff_top'] - 25)
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
        # Refill torso under the sleeves / arm, then outline the refilled edge.
        def refill(name, polygon, under):
            sil = poly_mask((h, w), loc(polygon))
            have = part[name] > .9
            # Diffuse only the cloth's own ground colour: prints, flowers and
            # outlines smeared into the hidden area as pale ghosts.
            ground = np.median(rgb[have], axis=0)
            plain = have & (np.abs(rgb - ground).sum(-1) < 70)
            colors = fill_colors(cell, plain)
            # Only refill where the sheet was painted (under a sleeve, arm or
            # hand); the outer contour stays the sheet's own outline.
            hole = (sil > 0) & (part[name] < .9) & (sum(part[u] for u in under) > .05)
            out_rgb = np.where(hole[..., None], colors, rgb)
            cover = np.maximum(part[name], np.where(hole, sil, 0))
            # No drawn outline along the refilled edge: it showed through the
            # sleeve's feathered seam as a line the reference does not have.
            return out_rgb, cover
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
                sleeve_a = sleeve_a * np.maximum(fade, keep)
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
    # Last pin-holes: a painted sheet pixel left in no layer but enclosed by
    # neck/shirt pixels (cleaning can open one at a three-layer junction).
    trio = [layers[n] for n in ('neck', 'shirt', 'sleeves')]
    solid = [L[..., 3] > 200 for L in trio]
    empty = (sheet[..., 3] > 200) & ~np.logical_or.reduce([L[..., 3] > 30 for L in trio])
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
        meta[key]['radii'] = radii_for(layers, f)
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


if __name__ == '__main__':
    sheet, labels = build()
    if '--debug' in sys.argv:
        debug(sheet, labels, sys.argv[sys.argv.index('--debug') + 1])
    print('ok')
