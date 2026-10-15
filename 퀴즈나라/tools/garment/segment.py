"""Three-way segmentation of a registered upload (stage 3, WP6; plan 'segmentation').

A registered upload U (tools/avatar_build/register.py, sheet space) is split
into the product slot's pixels and everything else by comparing it with
  T  the template (the reference sheet on white), and
  B  the frozen layers EXCEPT the product slot (the body with the art the
     product is fitted against, the other basic slots and the reference
     head: what shows when the slot is empty),
under the frozen owner map O (tools/garment/frozen/owner-map.png). No fixed
palette is used anywhere: every colour decision is a likelihood ratio of
colour models learned from THIS sheet (Lab k-means + diagonal Gaussians, per
child: skin, product, the neighbouring slot, hair).

Per figure (cell), in this order:
 1. base labels from O and the change map D_T (window-min Lab distance to T
    after the sheet's tone map, threshold tau = max(7, p95 of the stable
    pixels + 1)): product owners -> product; new paint (template background)
    inside the product's allowance zone (its frozen footprint dilated 20 px,
    never in the head) -> product, outside it -> foreign; everything else
    keeps its owner. The reference hair lying on a top at rest (frozen
    hair-occlusion mask) is a hole (rebuilt in fill.py) unless it changed
    into product colour (the product model beating the hair AND the skin
    model); the upload's own hair tips beyond the frozen hair zone (changed,
    hair model likelier than product and skin, joined to the head or the
    hair) are a hole inside the frozen basic top, else not the garment's;
 2. growth: changed pixels of the body or of another slot inside the zone
    that the product model explains better than the model of what lies
    there, and that touch the product -> product (a longer sleeve over the
    arm, a lower hem over the shorts, a taller shoe over the leg); a body
    part's own redrawn outline never grows into the product;
 3. exposure: changed product pixels (by the window minimum or pixel by
    pixel: beside the body the window finds the template's own skin) that
    now show what B holds there (skin by the skin model; another slot by the
    neighbour-slot model's likelihood ratio against the product model, never
    equality with B, whose cloth under the old hem is a refill), touching it
    and within 24 px of the old boundary -> not product. Exposure where B has
    no body art (a belly under a short top, skin in a lowered neckline over
    the torso) is label 5 after the seams (5a): the class checks measure the
    garment without it (HEM_HIGH / NECK_OPEN). The product colour model never
    learns from the band next to the neighbouring slot (12 px), so a belly
    painted there stays unexplained by it;
 4. skin gate: product pixels in the frozen body-skin zones that the skin
    model wins become body; the zones are dilated 4 px only OUTSIDE the
    product's frozen footprint (REDTEAM: the dilation ate cuff and collar
    cloth next to skin);
 5. variable boundaries by DP seams in frozen bands (seam.py): cuffs, collar,
    hem, shorts cuffs, shoe tops. The garment's own drawn edge (outline
    ridge) is the primary evidence, the colour likelihood ratio the
    tie-breaker;
 6. line-art rule: changed dark ridges within 2 px of a painted body part
    that lie outside the product interior go to that body part (the arm's
    own outline redrawn beside the shirt);
 7. tiny product islands (< 20 px) are dropped.
Labels: 0 background, 1 product, 2 body / another slot, 3 hole (hair over
the product), 4 foreign paint (outside the allowance zone), 5 skin exposed
where the body has no art (HEM_HIGH / NECK_OPEN evidence).

The frozen 'drawn' basic garments (drawn_layers) are the legacy garment
layers with their own outline lines handed back from the body layers (the
body build gave the cuff/collar/shorts-cuff line to the limb: 'let the arm
keep it') and without the skin-coloured pale bands at those edges. They are
the basic boundary the seams lean on (a small distance prior), the round
trip's reference (verify-pipeline.py) and the synthetic positives' start.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
for _p in (TOOLS, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)
from avatar_build import matte as M  # noqa: E402
from avatar_build import register as R  # noqa: E402
from avatar_build.common import SHEET, TEMPLATE, lum_of  # noqa: E402
from avatar_build.frozen import CELLS, skinish  # noqa: E402

ROOT = os.path.dirname(TOOLS)
ASSETS = os.path.join(ROOT, 'assets')
FROZEN = os.path.join(ROOT, 'tools', 'garment', 'frozen')
FIXTURE = os.path.join(ROOT, 'tools', 'garment', 'fixtures', 'runtime-side-raised.json')
LAYERS = ('shirt', 'sleeves', 'shorts', 'shoes', 'arms', 'legs', 'neck')
# Resting draw order, topmost first (frozen.Z_ORDER with the head on top).
Z_TOP_FIRST = ('head', 'sleeves', 'arms', 'shirt', 'shorts', 'shoes', 'legs', 'neck')
OWN = {'background': 0, 'shirt': 1, 'sleeve': 2, 'arm': 3, 'shorts': 4, 'leg': 5, 'shoe': 6, 'neck': 7, 'head': 8}
LAYER_OWNER = {'shirt': 1, 'sleeves': 2, 'arms': 3, 'shorts': 4, 'legs': 5, 'shoes': 6, 'neck': 7, 'head': 8}
BODY_LABELS = (3, 5, 7)
HEAD = 8

SLOT = {
    'top': dict(labels=(1, 2), layers=('shirt', 'sleeves'), cls='top/short-sleeve', neighbour=(4,)),
    'bottom': dict(labels=(4,), layers=('shorts',), cls='bottom/shorts', neighbour=(1, 2)),
    'shoes': dict(labels=(6,), layers=('shoes',), cls='shoes/low', neighbour=(4,)),
}
CLASS_SLOT = {v['cls']: k for k, v in SLOT.items()}
# Owners lying above each product layer at rest: fixed occluders (they keep
# their pixels; a seam never moves through them).
ABOVE = {'shirt': (2, 3, HEAD), 'sleeves': (HEAD,), 'shorts': (1, 2, 3, HEAD), 'shoes': (1, 2, 3, HEAD)}
# Drawn basic garments: the body part each garment's edge line was handed
# to, and that part's contact band label (frozen/contact-bands.png).
DRAWN_PAIRS = (('sleeves', 'arms', 1), ('shirt', 'neck', 2), ('shorts', 'legs', 3))

# Thresholds (provisional; calibrated on the identity input, the 1536 WebP
# q80 template, the geometric positives and the real top:shirt:10 sheet).
P = dict(
    tauMin=7.0, zoneGrow=20, prodErode=3, prodDeep=4.0,
    growLR=1.5, exposeLR=2.0, exposeNear=24, skinGateLR=3.0, skinGrow=4,
    lineDark=.5, lineNear=2, hairLR=2.0, hairStrong=10.0, hairSpeck=60, neighbourStrong=20.0, skinStrong=20.0,
    minIsland=20, kSkin=3, kProduct=6, kNeighbour=4, kHair=3, cuffOuter=0.0, cuffInner=0.5, hemBand=12,
)
LAB_W = np.array([.7, 1.0, 1.0], np.float32)


# ---------------------------------------------------------------------------
# Frozen inputs (read once per process)
# ---------------------------------------------------------------------------
def read_data():
    text = open(os.path.join(ASSETS, 'sd-foundation-ref-data.js'), encoding='utf-8').read()
    return json.loads(text[text.index('Object.freeze(') + 14:text.rindex(');')])


def over(top, bottom):
    """Straight-alpha 'over' of two float RGBA arrays (0..255)."""
    ta = top[..., 3:] / 255
    ba = bottom[..., 3:] / 255
    oa = ta + ba * (1 - ta)
    rgb = (top[..., :3] * ta + bottom[..., :3] * ba * (1 - ta)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], -1)


def load_rgba(path):
    return np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)


class Frozen:
    """The frozen body, the legacy layers, the owner map, zones and limits,
    and the drawn basic garments."""

    def __init__(self):
        self.sheet = load_rgba(os.path.join(ASSETS, 'avatar-reference-candidates', 'body-study-2026-10-04.png'))
        tpl = np.asarray(Image.open(os.path.join(ASSETS, 'garment-template', 'template-sheet.png')).convert('RGB')).astype(np.float32)
        self.template = tpl[:, TEMPLATE['left']:TEMPLATE['left'] + SHEET['width']].copy()
        self.owner = np.asarray(Image.open(os.path.join(FROZEN, 'owner-map.png'))).copy()
        self.bands = np.asarray(Image.open(os.path.join(FROZEN, 'contact-bands.png'))).copy()
        self.hair_occ = np.asarray(Image.open(os.path.join(FROZEN, 'hair-occlusion.png'))) > 127
        self.cover_torso = np.asarray(Image.open(os.path.join(FROZEN, 'cover-torso.png'))) > 127
        self.cover_bottom = np.asarray(Image.open(os.path.join(FROZEN, 'cover-bottom.png'))) > 127
        zj = json.load(open(os.path.join(FROZEN, 'zones.json'), encoding='utf-8'))
        self.zones = zj['figures']
        self.limits = json.load(open(os.path.join(FROZEN, 'limits.json'), encoding='utf-8'))
        self.data = read_data()['figures']
        self.layers = {n: load_rgba(os.path.join(ASSETS, 'sd-foundation-ref-%s.png' % n)) for n in LAYERS}
        # the legs with their run under the shoe (drawn under pipeline shoes):
        # the shoe opening (SHOE_LOW_OPENING) is measured against it
        self.legs_under = load_rgba(os.path.join(ASSETS, 'sd-foundation-ref-legs-under.png'))
        self.clean = {'arms': load_rgba(os.path.join(ASSETS, 'sd-foundation-ref-arms-clean.png')),
                      'neck': load_rgba(os.path.join(ASSETS, 'sd-foundation-ref-neck-clean.png'))}
        # The head layer: the head owner's pixels and the sheet's paint above
        # the head/body cut (the jaw over the neck painting's top, which the
        # runtime head covers): the neck painting's copied rows up there are
        # never seen.
        head = np.zeros_like(self.sheet)
        hm = self.owner == HEAD
        H, W = self.owner.shape
        yy = np.arange(H)[:, None]
        for key, (x0, y0, x1, y1) in CELLS.items():
            cols = [(c[0], c[4]) for c in self.zones[key]['upper']['columns'] if c[4] is not None]
            if not cols:
                continue
            cols.sort()
            xs = np.arange(x0, x1)
            cut = np.interp(xs, [c[0] for c in cols], [c[1] for c in cols])
            inside = (xs >= cols[0][0]) & (xs <= cols[-1][0])
            above = np.zeros((H, W), bool)
            above[y0:y1, x0:x1] = (yy[y0:y1] < cut[None, :]) & inside[None, :]
            hm |= above & (self.owner == 7)
        head[hm] = self.sheet[hm]
        self.head = head
        self.fixture = json.load(open(FIXTURE, encoding='utf-8'))
        self.drawn, self.drawn_info = drawn_layers(self)
        self.O = drawn_owner(self)
        self._B = {}
        self._foot = {}
        self._near = {}
        self._Bown = {}

    def body(self, art):
        """The limb/neck art: 'clean' (sd-foundation-ref-*-clean.png, the
        art pipeline records are fitted against) or 'legacy'."""
        return {'arms': self.clean['arms'] if art == 'clean' else self.layers['arms'],
                'legs': self.layers['legs'],
                'neck': self.clean['neck'] if art == 'clean' else self.layers['neck']}

    @staticmethod
    def art_for(slot):
        # A top is drawn over the clean arm/neck art; a bottom or shoes product
        # keeps the basic top, which lies over the legacy art it was cut from.
        return 'clean' if slot == 'top' else 'legacy'

    def B(self, slot):
        """RGBA of everything but the product slot (z order)."""
        if slot not in self._B:
            body = self.body(self.art_for(slot))
            out = np.zeros_like(self.sheet)
            own = np.zeros(self.owner.shape, np.uint8)
            for name in reversed(Z_TOP_FIRST):
                if name in SLOT[slot]['layers']:
                    continue
                lay = self.head if name == 'head' else body.get(name, self.layers.get(name))
                out = over(lay, out)
                own[lay[..., 3] > 127] = LAYER_OWNER[name]
            self._B[slot] = out
            self._Bown[slot] = own
        return self._B[slot]

    def B_owner(self, slot):
        """Topmost layer of B per pixel (owner labels), 0 where B is empty."""
        self.B(slot)
        return self._Bown[slot]

    def near_owner(self, key):
        """Per cell: the owner map with each background pixel within 3 px of
        the figure given the owner next to it."""
        if key not in self._near:
            x0, y0, x1, y1 = CELLS[key]
            O = self.O[y0:y1, x0:x1].copy()
            for _ in range(3):
                empty = O == 0
                grown = M._max_filter(O.astype(np.uint8), 1)
                O[empty] = grown[empty]
            self._near[key] = O
        return self._near[key]

    def foot(self, slot):
        """The product's frozen footprint: its drawn layers (hidden cloth
        included) and its visible owners."""
        if slot not in self._foot:
            m = np.isin(self.O, SLOT[slot]['labels'])
            for n in SLOT[slot]['layers']:
                m |= self.drawn[n][..., 3] > 127
            self._foot[slot] = m
        return self._foot[slot]


def drawn_layers(fz):
    """The legacy garment layers as drawn garments, by the frozen bands
    (seam.py) of the cuffs and collar (top) and the shorts cuffs (bottom).

    Per band column the drawn edge is the outermost line run (sheet lum <
    150) that meets the legacy garment's boundary (from 8 px inside it to 6 px
    beyond it); the garment ends where that line's coverage ends (the same
    half-way lightness rule as seam.solve). Inside the band region the
    garment is then exactly the sheet's paint on the product side of that
    edge: the line handed to the limb ('let the arm keep it') and the cream
    under the legacy cuff notches join the garment, and the skin-coloured
    rows the legacy shorts and sleeves kept below their line (the pale band)
    leave it. Columns without such a line keep the legacy boundary. Outside
    the band regions, the shoes and the hem the legacy layers are unchanged
    (their lines live in the garment)."""
    import seam as S
    lum = lum_of(fz.sheet[..., :3])
    lay = {n: fz.layers[n].copy() for n in ('shirt', 'sleeves', 'shorts', 'shoes')}
    info = {n: dict(addedPx=0, droppedPx=0, columns=0, lineColumns=0) for n in ('sleeves', 'shirt', 'shorts')}
    for slot, kinds in (('top', ('cuff', 'collar')), ('bottom', ('shorts',))):
        for key, (x0, y0, x1, y1) in CELLS.items():
            for band in S.bands_for(fz, slot, key, outer=P['cuffOuter'], inner=P['cuffInner']):
                if band.kind not in kinds:
                    continue
                g = lay[band.layer]
                cell = g[y0:y1, x0:x1]
                legacy = fz.layers[band.layer][y0:y1, x0:x1, 3] > 127
                lm = lum[y0:y1, x0:x1]
                b_leg = S.basic_boundary(band, legacy)
                bd = S.despike(S.line_boundary(band, b_leg, lm, fill_ends=True), half=3, tol=2.5)
                ok = ~np.isnan(bd)
                if not ok.any():
                    continue
                ys, xs = np.nonzero(band.region)
                u, v = band.from_px(xs, ys)
                order = np.argsort(band.cols[ok])
                B = np.interp(u, band.cols[ok][order], bd[ok][order])
                inside = v < B
                sheet = fz.sheet[y0:y1, x0:x1]
                add = inside & ~legacy[ys, xs] & (sheet[ys, xs, 3] > 127)
                drop = ~inside & legacy[ys, xs]
                cell[ys[add], xs[add], :3] = sheet[ys[add], xs[add], :3]
                cell[ys[add], xs[add], 3] = 255
                cell[ys[drop], xs[drop], 3] = 0
                # Beyond the band's ends: legacy garment paint hanging more
                # than 1 px below the drawn edge (held level from the end
                # column) over the limb's own painting is a traced notch that
                # took the limb's outline (sleeve and shorts cuff corners):
                # it leaves the garment.
                hh, ww = legacy.shape
                gy, gx = np.mgrid[0:hh, 0:ww]
                gu, gv = band.from_px(gx, gy)
                cmin, cmax = float(band.cols[ok].min()), float(band.cols[ok].max())
                # the drawn edge at every column (held level past the ends);
                # also the band columns' rows outside the region (the limb's
                # side outline at the cuff's ends)
                vend = np.interp(gu, band.cols[ok][order], bd[ok][order])
                beyond = (gu >= cmin - 6) & (gu <= cmax + 6) & ~band.region
                beyond &= (gv >= float(band.vlo.min())) & (gv <= float(band.vhi.max()))
                if band.arm is not None:
                    beyond &= np.abs(gu) <= 3 * band.extra['arm']['re']
                limb = fz.layers[band.body][y0:y1, x0:x1, 3] > 127
                inband = (gu >= cmin - .5) & (gu <= cmax + .5)
                notch = beyond & (gv > vend + 1) & (limb | inband) & (cell[..., 3] > 0) & (band.kind in ('cuff', 'shorts'))
                cell[notch, 3] = 0
                inf = info[band.layer]
                inf['notchPx'] = inf.get('notchPx', 0) + int(notch.sum())
                inf['addedPx'] += int(add.sum()); inf['droppedPx'] += int(drop.sum())
                inf['columns'] += len(band.cols); inf['lineColumns'] += int((~np.isnan(bd) & (bd != b_leg)).sum())
    return lay, info


def drawn_owner(fz):
    """The owner map with the drawn garments' edges: the lines a drawn
    garment reclaimed from its body part are the garment's, the pale-band
    pixels it dropped the body part's. The segmentation's frozen ownership
    (the original map stays the registration's and the limits')."""
    O = fz.owner.copy()
    for garment, body, band_label in DRAWN_PAIRS:
        g, b = LAYER_OWNER[garment], LAYER_OWNER[body]
        leg = fz.layers[garment][..., 3] > 127
        dr = fz.drawn[garment][..., 3] > 127
        O[dr & ~leg & (fz.owner == b)] = g
        O[leg & ~dr & (fz.owner == g)] = b
    return O


_FZ = None


def frozen():
    global _FZ
    if _FZ is None:
        _FZ = Frozen()
    return _FZ


# ---------------------------------------------------------------------------
# Colour models: Lab k-means (deterministic farthest-point start from the
# median) and one diagonal Gaussian per cluster; nll = -log mixture density.
# ---------------------------------------------------------------------------
class ColourModel:
    def __init__(self, X, k, name='', var_floor=4.0, max_n=8000):
        X = np.asarray(X, np.float32).reshape(-1, 3) * LAB_W
        self.name = name
        self.n = len(X)
        if self.n == 0:
            raise ValueError('colour model %s: no samples' % name)
        if self.n > max_n:
            X = X[np.linspace(0, self.n - 1, max_n).astype(int)]
        k = max(1, min(k, len(X) // 30 or 1))
        c = [np.median(X, 0)]
        d = ((X - c[0]) ** 2).sum(1)
        for _ in range(1, k):
            c.append(X[int(np.argmax(d))])
            d = np.minimum(d, ((X - c[-1]) ** 2).sum(1))
        c = np.array(c, np.float32)
        for _ in range(30):
            lab_ = ((X[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
            new = np.array([X[lab_ == j].mean(0) if (lab_ == j).any() else c[j] for j in range(len(c))], np.float32)
            if np.allclose(new, c, atol=1e-3):
                break
            c = new
        lab_ = ((X[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        self.mu = c
        self.var = np.array([np.maximum(X[lab_ == j].var(0), var_floor) if (lab_ == j).sum() > 3 else np.full(3, 25.0, np.float32)
                             for j in range(len(c))], np.float32)
        w = np.array([(lab_ == j).mean() for j in range(len(c))], np.float32)
        self.logw = np.log(np.maximum(w, 1e-4))
        self.const = .5 * np.log(self.var).sum(1) - self.logw

    def nll(self, lab):
        shape = lab.shape[:-1]
        X = lab.reshape(-1, 3).astype(np.float32) * LAB_W
        q = (((X[:, None, :] - self.mu[None]) ** 2) / self.var[None]).sum(-1) * .5 + self.const[None]
        m = q.min(1)
        out = m - np.log(np.exp(-(q - m[:, None])).sum(1))
        return out.reshape(shape)

    def main_lab(self):
        """Lab of the heaviest cluster (the cloth's main colour)."""
        return (self.mu[int(np.argmax(self.logw))] / LAB_W).astype(np.float32)

    def summary(self):
        return dict(name=self.name, n=int(self.n), centres=[[round(float(v), 2) for v in (c / LAB_W)] for c in self.mu],
                    weights=[round(float(v), 3) for v in np.exp(self.logw)])


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------
def median3(a):
    p = np.pad(a, 1, mode='edge')
    h, w = a.shape
    st = np.stack([p[dy:dy + h, dx:dx + w] for dy in range(3) for dx in range(3)])
    return np.median(st, 0)


def ink_map(rgb):
    """Outline ridge strength 0..1: how much darker a pixel is than the
    brightest pixel of its 5x5 neighbourhood (a garment's drawn edge, a body
    part's outline). Light outlines (a taupe line on white cloth) count from
    a 16-level step."""
    lum = lum_of(rgb)
    lmax = M._max_filter(np.clip(lum, 0, 255).astype(np.uint8), 2).astype(np.float32)
    depth = lmax - lum
    return np.clip((depth - 16) / 40, 0, 1), lum, depth


def islands(mask, minimum):
    lab_, comps = M.components(mask)
    small = [c['label'] for c in comps if c['size'] < minimum]
    return np.isin(lab_, small) if small else np.zeros_like(mask)


def distance_to(mask, cap=32):
    """Chessboard distance (px) of every pixel to `mask`, capped."""
    out = np.full(mask.shape, cap, np.int16)
    cur = mask.copy()
    out[cur] = 0
    for d in range(1, cap):
        nxt = M.dilate(cur, 1)
        out[nxt & ~cur] = d
        cur = nxt
        if cur.all():
            break
    return out


# ---------------------------------------------------------------------------
# One build's context: registered upload, change maps, colour models
# ---------------------------------------------------------------------------
class Context:
    def __init__(self, res, slot, sexes=('m', 'f'), fz=None):
        self.fz = fz or frozen()
        self.slot = slot
        self.sexes = tuple(sexes)
        img = res['images']['registered']
        self.U = img[..., :3].astype(np.float32)
        self.A = res['images']['alpha'].astype(np.float32)
        self.res = res
        g = np.array(res['tone']['gain'], np.float32)
        o = np.array(res['tone']['offset'], np.float32)
        self.tone = (g, o)
        H, W = self.U.shape[:2]
        self.Tlab = np.zeros((H, W, 3), np.float32)
        self.Ut = np.zeros((H, W, 3), np.float32)
        self.Blab = np.zeros((H, W, 3), np.float32)
        self.D = np.zeros((H, W), np.float32)
        self.DB = np.zeros((H, W), np.float32)
        Bw = self.fz.B(slot)
        a = Bw[..., 3:] / 255
        Bwhite = Bw[..., :3] * a + 255 * (1 - a)
        for k, (x0, y0, x1, y1) in CELLS.items():
            sl = np.s_[y0:y1, x0:x1]
            self.Tlab[sl] = R.lab(self.fz.template[sl])
            self.Ut[sl] = R.lab(self.U[sl]) * g + o
            self.Blab[sl] = R.lab(Bwhite[sl])
            self.D[sl] = median3(R.winmin_de(R.blur3(self.Ut[sl], 1), R.blur3(self.Tlab[sl], 1), 2, .7))
            self.DB[sl] = R.de(self.Ut[sl], self.Blab[sl], .7)
        spec = R.garment_spec(slot, sexes)
        st = np.zeros(self.D.shape, bool)
        for k in CELLS:
            st |= spec['stable'][k]
        st &= self.A > .5
        self.tau = float(max(P['tauMin'], np.percentile(self.D[st], 95) + 1)) if st.any() else P['tauMin']
        self.ink, self.lum, self.depth = ink_map(self.U)
        self.tlum = lum_of(self.fz.template)
        self.models = {sex: self._models(sex) for sex in ('m', 'f')}

    def cells(self, sex):
        return [k for k in CELLS if k[0] == sex]

    def _models(self, sex):
        fz = self.fz
        O = fz.O
        fg = self.A > .5
        foot = fz.foot(self.slot)
        rows = np.zeros(O.shape, bool)
        for k in self.cells(sex):
            x0, y0, x1, y1 = CELLS[k]
            rows[y0:y1, x0:x1] = True
        fgr = fg & rows
        changed = self.D > self.tau
        skin = M.erode(np.isin(O, BODY_LABELS), 2) & fgr & ~M.dilate(foot, 6) & ~changed
        plabels = SLOT[self.slot]['labels']
        isP = np.isin(O, plabels)
        deep = M.erode(isP, P['prodErode'])
        # deep inside the product: away from every other owner (an exposed
        # neighbour or skin under a shorter garment stays out of the model)
        far = M.erode(isP | (O == 0), int(P['prodDeep']))
        prod = deep & far & fgr & ~fz.hair_occ
        # nor the band next to the neighbouring slot (a top's hem over the
        # shorts): where the body has no art, a short top shows skin there,
        # which must stay unexplained by the product model (HEM_HIGH evidence)
        prod &= ~M.dilate(np.isin(O, SLOT[self.slot]['neighbour']), P['hemBand'])
        new = M.erode(fgr & (O == 0) & M.dilate(foot, P['zoneGrow']), 2) & changed
        prod |= new
        neigh = M.erode(np.isin(O, SLOT[self.slot]['neighbour']), 3) & fgr & ~M.dilate(foot, 4)
        hair = M.erode(O == HEAD, 3) & fgr & (self.lum < 150)
        cy = R.COLLAR_Y[sex]
        band = np.zeros(O.shape, bool)
        band[max(0, cy - 90):cy + 40] = True
        hair &= band
        out = {}
        for name, m, k in (('skin', skin, P['kSkin']), ('product', prod, P['kProduct']),
                           ('neighbour', neigh, P['kNeighbour']), ('hair', hair, P['kHair'])):
            out[name] = ColourModel(self.Ut[m], k, name) if m.sum() >= 50 else None
        return out


# ---------------------------------------------------------------------------
# Segmentation of one figure
# ---------------------------------------------------------------------------
def _nll(mods, name, Ut):
    m = mods.get(name)
    return m.nll(Ut) if m is not None else np.full(Ut.shape[:2], 50.0, np.float32)


def seam_at(cols, vals, u, n=5, max_slope=1.5, open_end=None, slack=2.0):
    """The seam v at frame positions u: interpolated inside, continued past
    each end along the slope of its last n columns (a cuff's lower line runs
    on beyond the band's columns, toward the torso). open_end 'lo' / 'hi':
    past that end (+ slack px) the seam is not continued (+inf: a cuff's
    rounded outer corner turns down there, which a straight continuation
    would cut off)."""
    order = np.argsort(cols)
    c, v = np.asarray(cols, float)[order], np.asarray(vals, float)[order]
    out = np.interp(u, c, v)
    if len(c) >= 2:
        k = min(n, len(c))
        lo = np.clip(np.polyfit(c[:k], v[:k], 1)[0], -max_slope, max_slope) if k >= 2 else 0.0
        hi = np.clip(np.polyfit(c[-k:], v[-k:], 1)[0], -max_slope, max_slope) if k >= 2 else 0.0
        out = np.where(u < c[0], v[0] + lo * (u - c[0]), out)
        out = np.where(u > c[-1], v[-1] + hi * (u - c[-1]), out)
    if open_end == 'lo':
        out = np.where(u < c[0] - slack, np.inf, out)
    elif open_end == 'hi':
        out = np.where(u > c[-1] + slack, np.inf, out)
    return out


def outer_end(band):
    """'hi' / 'lo': the end of a front/back cuff band away from the body
    (None for profile bands)."""
    op = band.extra.get('outPos') if band.extra else None
    return None if op is None else ('hi' if op else 'lo')


def rows_near_collar(fz, key, shape, y0):
    """Rows a bob can reach: from the head down to 40 px below the collar
    row (the hair model's own band)."""
    from avatar_build.register import COLLAR_Y
    out = np.zeros(shape, bool)
    cy = COLLAR_Y[key[0]] - y0
    out[:max(0, min(shape[0], cy + 40))] = True
    return out


def segment_cell(ctx, key, seams=True):
    import seam as S
    fz = ctx.fz
    slot = ctx.slot
    x0, y0, x1, y1 = CELLS[key]
    sl = np.s_[y0:y1, x0:x1]
    O = fz.O[sl]
    fg = ctx.A[sl] > .5
    plabels = SLOT[slot]['labels']
    isP = np.isin(O, plabels)
    foot = fz.foot(slot)[sl]
    hair_occ = fz.hair_occ[sl] & (slot == 'top')
    head = (O == HEAD) & ~hair_occ
    zone = M.dilate(foot, P['zoneGrow']) & ~M.dilate(head, 1)
    mods = ctx.models[key[0]]
    Ut = ctx.Ut[sl]
    nll = {n: _nll(mods, n, Ut) for n in ('skin', 'product', 'neighbour', 'hair')}
    changed = ctx.D[sl] > ctx.tau
    Bown = fz.B_owner(slot)[sl]
    body = np.isin(O, BODY_LABELS)
    neigh = np.isin(O, SLOT[slot]['neighbour'])
    # the model of what lies at a pixel when it is not product
    other_nll = np.where(np.isin(Bown, BODY_LABELS), nll['skin'], np.where(np.isin(Bown, SLOT[slot]['neighbour']), nll['neighbour'],
                                                                        np.minimum(nll['skin'], nll['neighbour'])))
    lr = nll['product'] - other_nll  # > 0: looks like what lies there, < 0: like the product
    diag = dict(tau=round(ctx.tau, 2))
    # 1. base labels
    label = np.zeros(O.shape, np.uint8)
    label[fg & (O != 0)] = 2
    label[fg & isP] = 1
    label[fg & (O == 0) & zone & changed] = 1
    label[fg & (O == 0) & ~zone & changed] = 4
    # Unchanged paint outside the frozen figure is the template's own soft
    # fringe: it belongs to the owner next to it.
    fringe = fg & (O == 0) & ~changed
    if fringe.any():
        near = fz.near_owner(key)
        label[fringe & np.isin(near, plabels)] = 1
        label[fringe & (near != 0) & ~np.isin(near, plabels)] = 2
    if slot == 'top':
        hole = fg & hair_occ & (O == HEAD)
        # changed into product paint: the product model beats the hair model
        # and the skin model (a nape of skin between the bob's halves stays a
        # hole, rebuilt as cloth)
        unhair = hole & changed & (nll['product'] - nll['hair'] < -P['hairLR']) & (nll['product'] - nll['skin'] < -P['hairLR'])
        label[hole] = 3
        label[unhair] = 1
        # 1b. hair beyond the frozen hair zone: the upload's bob may hang a
        # little lower or wider than the template's (ChatGPT redraws it), so
        # its tips land on the garment. Changed paint that this sheet's hair
        # model explains better than the product and the skin model, joined
        # to the head or the hair over the garment, is hair: a hole (rebuilt as
        # cloth) where the frozen basic top lies, else not the garment's.
        # Unchanged paint counts too when the hair model wins by a wide margin:
        # the template's own bob tips past the frozen hair-occlusion mask lie
        # on the shirt (the upload keeps them, so they read unchanged; real
        # top:shirt:10 f-front collar points).
        # Only right beside the head or the hair over the garment (4 px): a
        # garment's own brown outline is hair-coloured too (a cream blouse's
        # contour, the placket line under the collar).
        # Front and back only, and only small specks (a tip, not a contour
        # running along the bob: in profile the bob lies on the blouse's back
        # edge).
        strong = (nll['hair'] - nll['product'] < -P['hairStrong']) & (nll['hair'] - nll['skin'] < 0) & \
            M.dilate((O == HEAD) | (label == 3), 4) & ~changed & fg & np.isin(label, (0, 1)) & ~head
        if key.endswith('right'):
            strong[:] = False
        strong &= islands(strong, P['hairSpeck'] + 1)
        hairish = (changed | strong) & fg & np.isin(label, (0, 1)) & ~head & (nll['hair'] - nll['product'] < -P['hairLR']) & \
            (nll['hair'] - nll['skin'] < -P['hairLR'])
        hairish &= rows_near_collar(fz, key, O.shape, y0)
        if hairish.any():
            seeds = (hairish & M.dilate((O == HEAD) | (label == 3), 1)) | (hairish & strong)
            hairish = M.connected_to(hairish, seeds)
            basic = np.zeros(O.shape, bool)
            for n in SLOT[slot]['layers']:
                basic |= fz.drawn[n][sl][..., 3] > 127
            label[hairish & basic] = 3
            label[hairish & ~basic] = 2
        diag['hairTipsPx'] = int(hairish.sum())
    fixed = np.zeros(O.shape, bool)
    for layer in SLOT[slot]['layers']:
        fixed |= np.isin(O, [l for l in ABOVE[layer] if l not in plabels])
    if slot == 'top':
        fixed &= ~(O == 3)  # the arm lies under the sleeve: a longer sleeve may cover it
    # 2. growth over what lies under the product
    cand = fg & ~isP & (O != 0) & ~head & zone & changed & (lr < -P['growLR']) & (ctx.DB[sl] > ctx.tau)
    # a body part's own redrawn outline is no growth (a cuff, collar, hem or
    # shoe line drawn over the body is placed by its band's seam below)
    cand &= ~(body & (ctx.ink[sl] > P['lineDark']))
    if slot == 'top':
        cand &= ~((O == 3) & ~M.dilate(np.isin(O, (2,)), 30))  # only the upper arm near the sleeve
    if cand.any():
        seed = label == 1
        grow = M.connected_to(cand | seed, seed) & cand
        label[grow] = 1
        diag['grownPx'] = int(grow.sum())
    # 3. exposure
    # changed pixel by pixel too: next to the body the window minimum finds
    # the template's own skin within 2 px and calls a narrower collar's
    # uncovered neck 'unchanged'
    moved = changed | (R.de(Ut, ctx.Tlab[sl], .7) > ctx.tau)
    cand = (label == 1) & isP & moved & (lr > P['exposeLR']) & (Bown != 0)
    near = M.dilate(~isP & (O != 0), P['exposeNear'])
    cand &= near
    if cand.any():
        q = (label == 2) & ~head
        expose = M.connected_to(cand | q, q) & cand
        label[expose] = 2
        diag['exposedPx'] = int(expose.sum())
    # 4. skin gate
    zone_skin = (M.dilate(body, P['skinGrow']) & ~foot) | (body & foot)
    gate = zone_skin & (label == 1) & (nll['product'] - nll['skin'] > P['skinGateLR'])
    # a drawn line where the frozen garment has its own pixels is the
    # garment's edge whatever its colour: a rust or brown cloth's outline
    # reads like the leg's red-brown outline (WP8 rust shorts: the inner
    # leg edge went to the legs, bottom IoU .961)
    gate &= ~((ctx.ink[sl] > P['lineDark']) & isP)
    # 5. seams
    bands = S.bands_for(fz, slot, key, outer=P['cuffOuter'], inner=P['cuffInner']) if seams else []
    in_band = np.zeros(O.shape, bool)
    for b in bands:
        in_band |= b.region
    gate &= ~in_band
    label[gate] = 2
    diag['skinGatePx'] = int(gate.sum())
    results = []
    for b in bands:
        r = S.solve(ctx, key, b, nll, O, fg)
        results.append(r)
        S.assign(b, r, label, O, fg, fixed)
    inside = seam_inside(bands, results, O.shape)
    # 5a. exposure where the body has no art (a belly under a short top, skin
    # inside a lowered neckline over the torso): changed product pixels where
    # B holds no body art (empty, or the other slot's refilled cloth under the
    # old hem) that this sheet's skin model explains better than its
    # product model, reaching the garment's edge (4-connected to what is not
    # product), are no garment. They are label 5 ('exposed'): the class checks
    # measure the garment without them (HEM_HIGH, NECK_OPEN), and the report
    # counts them. A cream cloth is explained by its own product model. The
    # skin model must beat the neighbour slot's too: a dark hem's 1-2 px mixed
    # with the girl's gold shorts button read as skin against a navy product
    # (WP8 recoloured tops: HEM_HIGH -1 px at the centre front).
    noart = (label == 1) & isP & changed & ~np.isin(Bown, BODY_LABELS) & fg & (nll['product'] - nll['skin'] > P['exposeLR']) & \
        (nll['neighbour'] - nll['skin'] > P['exposeLR'])
    if noart.any():
        edge = fg & (label != 1) & ~head
        noart = M.connected_to(noart, noart & M.dilate(edge, 2))  # a 1-2 px mixed rim (WebP) may part it from the edge
        # ... and that rim itself, squeezed between the exposure and the edge
        rim = (label == 1) & changed & ~np.isin(Bown, BODY_LABELS) & M.dilate(noart, 3) & M.dilate(edge, 3)
        noart |= rim if noart.any() else False
        label[noart] = 5
    diag['exposedNoArtPx'] = int(noart.sum())
    # the drawn edge carried past the band's columns: changed body pixels on
    # the garment's side of it, joined to the garment, are the garment (a
    # cuff's line running on beyond the arm toward the torso)
    # (changed pixel by pixel: the window minimum forgives the 2-3 px a line
    # moved over the arm)
    # (moved: computed with the exposure, step 3)
    carry = inside & (label == 2) & moved & np.isin(O, BODY_LABELS) & fg & ~fixed
    if carry.any():
        seed = label == 1
        carry = M.connected_to(carry | seed, seed) & carry
        label[carry] = 1
    diag['carriedPx'] = int(carry.sum())
    # 5b. below the cuff opening the arm is the arm: on the clean arm art
    # (grown 3 px: the upload's arm outline may lie a pixel or two outside
    # the frozen one), outside the frozen torso, nothing past the cuff seam
    # (in the seam's own frame, its ends held level) that changed or looks
    # like this sheet's skin is product (the basic sleeve's pale band there is
    # the template's skin-coloured cuff: a real arm over it reads unchanged).
    # The band only spans the arm's columns; the arm's side outlines meeting
    # the cuff stuck out of the opening as thin skin spikes (real sheet).
    if slot == 'top':
        skinlike = nll['skin'] - nll['product'] < -P['skinGateLR']
        # Beside the arm (the 3 px margin) only changed pixels: the profile
        # cuff's inner lining left and right of the arm is tan, skin-like
        # paint of the sleeve itself (unchanged on the basic).
        armArt = fz.clean['arms'][sl][..., 3] > 64
        armA = ((M.dilate(armArt, 3) & changed) | (armArt & skinlike)) & np.isin(O, (0, 2, 3))
        below = np.zeros(O.shape, bool)
        for b, r in zip(bands, results):
            ok = ~np.isnan(r['v'])
            if b.kind != 'cuff' or ok.sum() < 2:
                continue
            ys, xs = np.nonzero(armA & (label == 1) & ~inside)
            if not len(ys):
                continue
            u, v = b.from_px(xs, ys)
            vs = seam_at(r['cols'][ok], r['v'][ok], u, open_end=outer_end(b))
            hit = v > vs + .5
            below[ys[hit], xs[hit]] = True
        label[below] = 2
        diag['belowCuffPx'] = int(below.sum())
        # 5c. the cuff seam continued past the band's ends (seam_inside) also
        # covered the arm skin beside the cuff's inner corner: a pixel of the
        # frozen arm art (owner arm, no sleeve over it) that this sheet's skin
        # model explains far better than its product model is the arm (WP8
        # recoloured tops: 8-24 px of skin kept at the girl's cuff corners,
        # UNTINTED_SKIN). A cream cuff is not moved: the product model knows
        # its colour, so skin never wins by this margin there.
        corner = inside & (label == 1) & (O == 3) & (nll['product'] - nll['skin'] > P['skinStrong'])
        label[corner] = 2
        diag['cuffCornerSkinPx'] = int(corner.sum())
    # 6. line-art rule
    ink = ctx.ink[sl] > P['lineDark']
    painted_body = body & fg
    rim = M.dilate(painted_body, P['lineNear']) & ~body
    interior = M.erode(isP, 2)
    line = rim & ink & (label == 1) & ~interior & ~in_band & ~inside & changed  # unchanged pixels keep their label
    label[line] = 2
    diag['lineArtPx'] = int(line.sum())
    # 6b. the other slot's fringe: changed product pixels within 4 px of the
    # neighbour slot's frozen pixels that the neighbour model explains better
    # than the product by the exposure ratio (a waistband top caught under a
    # light hem line whose DP seam took the shorts' darker edge). Drawn lines
    # are never judged by colour here: a navy hem line over navy shorts is
    # the top's own edge.
    nb = M.dilate(neigh & fg, 4)
    fringe_n = nb & (label == 1) & changed & (nll['product'] - nll['neighbour'] > P['exposeLR']) & ~interior & ~ink & ~inside
    # The same, on the neighbour slot's own frozen ground, for paint that
    # the neighbour model explains by a wide margin whatever the seams say
    # (the hem seam ran a few px below the drawn hem line on some columns
    # and kept a ragged strip of shorts blue under a cream top: real
    # top:shirt:10 f-front / f-back), the shorts' own waistband line
    # included: the product model knows the top's own lines, so its hem line
    # is never beaten by this margin (a navy hem over navy shorts stays).
    strong_n = neigh & fg & (label == 1) & (nll['product'] - nll['neighbour'] > P['neighbourStrong']) & ~interior
    fringe_n |= strong_n
    label[fringe_n] = 2
    diag['neighbourFringePx'] = int(fringe_n.sum())

    # 7. tiny islands
    tiny = islands(label == 1, P['minIsland'])
    label[tiny] = np.where(np.isin(O[tiny], plabels) | (O[tiny] == 0), 0, 2).astype(np.uint8)
    diag['tinyPx'] = int(tiny.sum())
    exposed_body = (label == 2) & isP
    return dict(key=key, label=label, product=label == 1, hole=label == 3, foreign=label == 4, seams=results,
                bands=bands, nll=nll, lr=lr, diag=diag, origin=(x0, y0), noart=noart, exposed=exposed_body, fixed=fixed,
                inside=inside)


def seam_inside(bands, results, shape, ext=6, ext_cuff=16):
    """Pixels on the product side of a seam (the garment's own drawn edge):
    within each band's v range and its columns widened by ext px, before the
    seam (continued past its ends, seam_at). Colour rules after the seams
    (the skin strip) never move these to the body: a cream cuff next to skin
    is the cuff up to its line."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w]
    out = np.zeros(shape, bool)
    for b, r in zip(bands, results):
        ok = ~np.isnan(r['v'])
        if ok.sum() < 2:
            continue
        u, v = b.from_px(xx, yy)
        e = ext_cuff if b.kind == 'cuff' else (0 if b.kind == 'collar' else ext)  # a collar's ends turn up the neck's sides
        c0, c1 = float(r['cols'][ok].min()) - e, float(r['cols'][ok].max()) + e
        sel = (u >= c0) & (u <= c1) & (v >= float(b.vlo.min())) & (v <= float(b.vhi.max()))
        if b.arm is not None:
            sel &= np.abs(u) <= 3 * b.extra['arm']['re']
        vs = seam_at(r['cols'][ok], r['v'][ok], u[sel])
        m = np.zeros(shape, bool)
        m[sel] = v[sel] < vs
        out |= m
    return out


def segment(ctx, keys=None, seams=True):
    out = {}
    for k in keys or CELLS:
        if k[0] not in ctx.sexes:
            continue
        out[k] = segment_cell(ctx, k, seams)
    return out
