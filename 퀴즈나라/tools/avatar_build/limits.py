"""Class limits from body coverage and runtime constants (stage 3, WP1).

No limit is 'basic +-N px'. Each one says what in the frozen body or the
runtime it protects (see LIMITS[...]['why']); the basic outfit is then
measured against it and must pass with >= MIN_MARGIN px.

Geometry (zones) comes from the frozen data only: joints, radii, the build
trace (armhole S/A, clean-art rows) and the original layers. Measurements
take plain boolean masks, so the same code measures the basic layers, a
registered upload, or a synthetic control.
"""
import numpy as np

from .common import dilate, erode
from .frozen import CELLS, SEAM_TOLERANCE

MIN_MARGIN = 2.0

LIMITS = {
    'top/short-sleeve': {
        'SLEEVE_LONG': {'why': 'A folded forearm (run, jump, cheer) is pasted over its own sleeve; its clip ends in a round '
                               'cap of radius re past the elbow (avatar-foundation-skin.js forearmOverlay). Sleeve cloth '
                               'on the arm band beyond elbow + re would stick out past the folded elbow.',
                        'rule': 'max t of top pixels on the arm band (|c| <= re/2) <= tElbow + re (t along the resting upper arm, px)'},
        'SLEEVE_SHORT': {'why': 'Above the clean-art top row (cuff_top) the arm layer is copied skin without outline '
                                '(build-reference-body.py limb extension). It must stay under the sleeve.',
                         'rule': 'every arm-band line is covered from the shoulder down to tHidden (the cuff_top row)'},
        'GHOST_EDGE': {'why': 'Legacy arm/neck art carries the basic cuff/collar edge (contact bands). Only for a top that '
                              'is drawn on the legacy art; the clean art has no band. The basic itself is exempt: the band '
                              'is its own cuff/collar outline.',
                       'rule': 'every contact-band pixel is covered by the top at rest'},
        'CAP_HIGH': {'why': 'A gesture-raised arm carries its whole sleeve (hold 0), so a crown taller than the shoulder '
                            'swings toward the head and the bob (RT minor finding). Outward of the shoulder point S '
                            '(armhole S of the build, on the sheet outline: the shoulder line for boys, the bob edge for '
                            'girls) the top may rise collarAllowU above S, plus the seam tolerance every measured '
                            'upload edge carries (registration <= .6 px + seam <= 2 px). A row proxy until the WP7 '
                            'raised-arm probe (no sleeve pixel in the head/neck capsule).',
                     'rule': 'front/back, columns outward of S: top rows >= S.y - collarAllowU - seam tolerance'},
        'COLLAR_HIGH': {'why': 'Girls, front/back: the shared hair clip (FRONT_HAIR_CLIP/BACK_HAIR_CLIP) keeps >= .10 '
                               'head units over the collar/shoulder outline; the measured nod-peak margin is .40, so the '
                               'outline may rise (.40-.10)*HEAD_SCALE u (H1 will replace this with the per-column clip '
                               'line). Boys and profile views: no hair hangs over the collar; the head is drawn over the '
                               'body, so the limit is the head cut (the top must not paint into the head).',
                        'rule': 'girls front/back: collar columns >= outline - collarAllowU, shoulder columns >= '
                                'min(outline, S.y) - collarAllowU; otherwise >= head cut + 1'},
        'NECK_OPEN': {'why': 'The torso has no skin art: skin may show only where the neck painting is opaque.',
                      'rule': 'skin of the upload inside the frozen top region, not covered by the new top (and not '
                              'arm, hair or under the head: head cut + VIEW_HEAD front drop), lies inside the clean neck '
                              'art (alpha > 200) eroded 1 px; the 1 px rim at the new top edge is the seam'},
        'HEM_HIGH': {'why': 'Seated breathing lifts the chest SEATED_BREATH.rise over the seat. Bottoms are extended up '
                            'to the waist cover line W (shorts top - .24 u - seam tolerance), so a top must reach W + '
                            '.24 u (.14 rise + .10).',
                     'rule': 'hem >= W + .24 u on every torso column not covered by the hanging arm'},
        'HEM_LOW': {'why': 'Short-sleeve tops end above the leg joints: past hip + .25 u the rigid hem lies over the '
                           'swinging thighs.',
                    'rule': 'hem <= hip row + .25 u'},
    },
    'bottom/shorts': {
        'SHORTS_SHORT': {'why': 'Leg art above the legs hidden row (shorts_bottom - 8) is copied rows without outline.',
                         'rule': 'cuff edge >= legs hidden row on the leg band'},
        'SHORTS_LONG': {'why': 'Floor-sit tubes end .42 u before the knee (avatar-foundation-outfit.js seatedShorts).',
                        'rule': 'cuff edge <= knee - floorSitTubeEndU'},
        'GHOST_EDGE': {'why': 'Legacy leg art carries the basic shorts cuff line (contact band 3); no clean legs yet.',
                       'rule': 'every leg contact-band pixel is covered by the bottom'},
        'SKIRT_LIKE': {'why': 'One shorts mesh with the centre seam at body x=16 splits into two legs.',
                       'rule': 'the centre column is open between the crotch and the cuff (front/back)'},
        'WAIST_VISIBLE': {'why': 'Bottoms are drawn under the top and extended up to W; their own waistband must not show '
                                 'below the top hem.',
                          'rule': 'bottom pixels visible above the frozen hem - seam tolerance = 0'},
    },
    'shoes/low': {
        'SOLE_OFF_FLOOR': {'why': 'Shoes hang from the ankle joint (floor - 30); the sole must sit on the frozen floor.',
                           'rule': '|sole edge - floor| <= seam tolerance'},
        'SHOE_LOW_OPENING': {'why': 'The leg painting ends at the basic shoe top: a lower opening shows its cut end.',
                             'rule': 'shoe top <= leg art end + seam tolerance'},
        'SHOE_HIGH': {'why': 'Low shoes (class rule: opening under the ankle bone, never a boot).',
                      'rule': 'shoe top >= ankle - 20 px'},
        'SHOE_MISSING': {'why': 'Both feet are drawn in front/back views.', 'rule': 'a shoe on each foot band'},
    },
}


def _rows(mask_col):
    return np.nonzero(mask_col)[0]


def _first(mask, x, y0, y1):
    r = _rows(mask[y0:y1, x])
    return int(r.min() + y0) if len(r) else None


def _last_edge(mask, x, y0, y1):
    r = _rows(mask[y0:y1, x])
    return int(r.max() + y0 + 1) if len(r) else None


def _walk_down(mask, x, y_start, y_stop, gap=1):
    """Edge row where a run of `mask` starting at y_start ends (gaps <= gap)."""
    y, miss = y_start, 0
    last = None
    while y < y_stop:
        if mask[y, x]:
            last, miss = y, 0
        else:
            miss += 1
            if miss > gap:
                break
        y += 1
    return (last + 1) if last is not None else y_start


def geometry(key, F, tr, layers, clean_neck, labels, rc, cut=None):
    """Frozen zones of one figure (sheet px). `cut`: the head/body cut row
    per sheet column of this cell (body mode only; stored in the zones)."""
    x0, y0, x1, y1 = CELLS[key]
    k = F['k']; J = F['joints']; view = F['view']
    alpha = {n: layers[n][..., 3] > 127 for n in layers}
    top_b = alpha['shirt'] | alpha['sleeves']
    g = dict(key=key, view=view, sex=F['sex'], k=k, center=F['center'], cell=[x0, y0, x1, y1], floor=F['floor'])
    sides = [0] if view == 'right' else [0, 1]
    # Sleeve frames (the runtime's sleeve frame: shoulder joint, resting upper arm).
    arms = []
    for i in sides:
        sh, el = np.array(J['shoulder'][i], float), np.array(J['elbow'][i], float)
        v = el - sh; tE = float(np.hypot(*v)); ax = v / tE; nrm = np.array([-ax[1], ax[0]])
        re = float(F['radii']['arm'][i][1])
        lb = tr['limbs']['arm%d' % i]
        arms.append(dict(i=i, shoulder=sh.tolist(), elbow=el.tolist(), axis=ax.tolist(), normal=nrm.tolist(), tElbow=round(tE, 2),
                         re=re, tCap=round(tE + re, 2), half=round(max(2.0, re / 2), 2), hiddenRow=lb['hidden'], cleanRow=lb['src'],
                         canvasEndT=round(rc['sleeveCanvasHalfU'] / k, 2)))
    g['arms'] = arms
    g['armholes'] = tr.get('armholes', [])
    # Hem band: torso columns between the hip sides.
    hips = [J['hip'][i] for i in sides]
    rh = [F['radii']['leg'][i][0] for i in sides]
    hx0 = int(np.floor(min(h[0] - r for h, r in zip(hips, rh))))
    hx1 = int(np.ceil(max(h[0] + r for h, r in zip(hips, rh))))
    hem_cols = []
    for x in range(hx0, hx1 + 1):
        hb = _last_edge(alpha['shirt'], x, y0, y1)
        st = _first(alpha['shorts'], x, y0, y1)
        if hb is None or st is None:
            continue
        armed = bool((labels[hb - 6:hb + 7, x] == 3).any())
        hem_cols.append([x, hb, st, int(armed)])
    hip_row = float(np.mean([h[1] for h in hips]))
    over = rc['seatedBreathRiseU'] + .10
    g['hem'] = dict(columns=hem_cols, hipRow=hip_row, overlapU=round(over, 3),
                    waistCoverOffsetPx=round(over / k + SEAM_TOLERANCE, 2), hemLowRow=round(hip_row + .25 / k, 2))
    # Upper outline (collar / shoulder / sleeve crown), per column:
    #   collar   the basic outline touches the neck art;
    #   cap      front/back, outward of the shoulder point S;
    #   shoulder the rest. Steep columns (side edges) are not outline.
    up_cols = []
    S = {a['side']: a['S'] for a in g['armholes']}
    neck_legacy = layers['neck'][..., 3] > 0
    ubs = {}
    for x in range(x0, x1):
        ub = _first(top_b, x, y0, y1)
        if ub is not None:
            ubs[x] = ub
    for x, ub in ubs.items():
        lft, rgt = ubs.get(x - 1, ub), ubs.get(x + 1, ub)
        if max(abs(lft - ub), abs(rgt - ub)) > 2:
            continue
        if neck_legacy[max(y0, ub - 6):ub + 3, x].any():
            zone = 'collar'
        elif view != 'right' and S and not (S[-1][0] <= x <= S[1][0]):
            zone = 'cap'
        else:
            zone = 'shoulder'
        hidden_by_hair = bool((labels[max(y0, ub - 2):ub, x] == 8).any())
        cut_row = int(np.ceil(cut[x - x0])) if cut is not None else None
        side = -1 if x < F['center'] else 1
        s_row = round(float(S[side][1]), 2) if S else None
        up_cols.append([x, ub, zone, int(hidden_by_hair), cut_row, s_row])
    g['upper'] = dict(columns=up_cols, allowPx=round(rc['collarAllowU'] / k, 2),
                      headDropPx=round(rc['headDropU'][F['sex']]['profile' if view == 'right' else view] / k, 2))
    # Neck window: the eroded clean neck art.
    nk = erode(clean_neck[..., 3] > 200, 1)
    depth = []
    for x, ub, zone, hid, cut_row, s_row in up_cols:
        if zone != 'collar':
            continue
        rows = _rows(nk[y0:y1, x])
        if len(rows):
            depth.append([x, int(rows.max() + y0 - ub + 1)])
    cx = int(round(F['center']))
    g['neck'] = dict(depthByColumn=depth, centerColumn=cx,
                     centerDepthPx=next((d for x, d in depth if x == cx), None))
    # Shorts and shoes bands.
    legs = []
    for i in sides:
        kn = J['knee'][i]; r = F['radii']['leg'][i][1]
        lb = tr['limbs']['leg%d' % i]
        legs.append(dict(i=i, knee=kn, cols=[int(round(kn[0] - r / 2)), int(round(kn[0] + r / 2))], hiddenRow=lb['hidden'],
                         cleanRow=lb['src'], longRow=round(kn[1] - rc['floorSitTubeEndU'] / k, 2)))
    g['legs'] = legs
    feet = []
    for i in sides:
        an = J['ankle'][i]; r = F['radii']['leg'][i][2]
        feet.append(dict(i=i, ankle=an, cols=[int(round(an[0] - r / 2)), int(round(an[0] + r / 2))], highRow=an[1] - 20))
    g['feet'] = feet
    return g


def arm_samples(a, c_step=.5, t_step=.5, t0=None, t1=None):
    sh, ax, nr = np.array(a['shoulder']), np.array(a['axis']), np.array(a['normal'])
    cs = np.arange(-a['half'], a['half'] + 1e-6, c_step)
    t0 = a['tElbow'] - 45 if t0 is None else t0
    t1 = a['tCap'] + 25 if t1 is None else t1
    ts = np.arange(t0, t1 + 1e-6, t_step)
    P = sh[None, None, :] + ax[None, None, :] * ts[None, :, None] + nr[None, None, :] * cs[:, None, None]
    return cs, ts, P


def t_hidden(a, c):
    sh, ax, nr = np.array(a['shoulder']), np.array(a['axis']), np.array(a['normal'])
    return (a['hiddenRow'] - sh[1] - nr[1] * c) / ax[1]


def _upper_limit(g, x, ub, zone, cut_row, s_row):
    """Highest row the top may reach in one outline column (see LIMITS)."""
    allow = g['upper']['allowPx']
    if zone == 'cap':
        return 'CAP_HIGH', s_row - allow - SEAM_TOLERANCE
    hair_clip = g['sex'] == 'f' and g['view'] != 'right'
    if hair_clip:
        ref = ub if zone == 'collar' or s_row is None else min(ub, s_row)
        return 'COLLAR_HIGH', ref - allow
    return 'COLLAR_HIGH', cut_row + 1


def measure_top(g, M, band=None, top_region=None, owners=None, neck_art=None, gap=8, skin=None):
    """Top limits for one figure. M: bool mask of top pixels visible at rest.
    band: contact-band mask (legacy art) or None. top_region: frozen top
    region (basic top alpha); owners: owner map (arm 3, head 8 excluded from
    NECK_OPEN); neck_art: neck alpha > 200 (eroded 1 px inside). `gap`:
    samples (.5 px) a run may skip (probe holes, buttons). skin: the
    upload's skin-coloured pixels; NECK_OPEN counts exposed skin only (line
    art at the neck sides is the neck's or the collar's outline)."""
    out = {}
    x0, y0, x1, y1 = g['cell']
    H, W = M.shape
    for a in g['arms']:
        cs, ts, P = arm_samples(a)
        X = np.clip(np.floor(P[..., 0]).astype(int), 0, W - 1); Y = np.clip(np.floor(P[..., 1]).astype(int), 0, H - 1)
        S = M[Y, X]
        ends, margins_short = [], []
        for ci, c in enumerate(cs):
            th = t_hidden(a, c)
            jh = int(np.searchsorted(ts, th)) - 1
            if not S[ci, jh]:
                above = np.nonzero(S[ci, :jh])[0]
                end = ts[above.max()] + .5 if len(above) else ts[0]
            else:
                j, miss, end = jh, 0, ts[jh] + .5
                while j < len(ts):
                    if S[ci, j]:
                        end, miss = ts[j] + .5, 0
                    else:
                        miss += 1
                        if miss > gap:
                            break
                    j += 1
            ends.append(end); margins_short.append(end - th)
        name = 'arm%d' % a['i']
        reach = float(np.max(ends))
        out.setdefault('SLEEVE_LONG', {})[name] = dict(limitT=a['tCap'], t=round(reach, 2), marginPx=round(a['tCap'] - reach, 2))
        out.setdefault('SLEEVE_SHORT', {})[name] = dict(limitT=round(float(t_hidden(a, 0)), 2), t=round(float(np.min(ends)), 2),
                                                        marginPx=round(float(np.min(margins_short)), 2))
        if band is not None:
            side = np.zeros(M.shape, bool)
            side[a['hiddenRow'] - 4:a['cleanRow'] + 2, int(a['elbow'][0] - 30):int(a['elbow'][0] + 30)] = True
            b = band & side
            out.setdefault('GHOST_EDGE', {})[name] = dict(bandPx=int(b.sum()), uncoveredPx=int((b & ~M).sum()))
    hem = []
    for x, hb, st, armed in g['hem']['columns']:
        if armed:
            continue
        e = _last_edge(M, x, hb - 30, hb + 30)
        e = hb - 30 if e is None else e
        wline = st - g['hem']['waistCoverOffsetPx']
        need = wline + g['hem']['overlapU'] / g['k']
        hem.append((x, e, need))
    if hem:
        hem = np.array(hem, float)
        # A hem is one edge: a hole of a few columns (a probe hole, a button)
        # is bridged by its neighbours (max over +-3 columns).
        by_x = {int(x): e for x, e, n in hem}
        hem[:, 1] = [max(by_x.get(int(x) + d, -1e9) for d in range(-3, 4)) for x in hem[:, 0]]
        hi = hem[:, 1] - hem[:, 2]
        lo = g['hem']['hemLowRow'] - hem[:, 1]
        out['HEM_HIGH'] = dict(minMarginPx=round(float(hi.min()), 2), atColumn=int(hem[hi.argmin(), 0]), columns=len(hem))
        out['HEM_LOW'] = dict(limitRow=g['hem']['hemLowRow'], lowestHem=int(hem[:, 1].max()), minMarginPx=round(float(lo.min()), 2))
    per = {}
    for x, ub, zone, hid, cut_row, s_row in g['upper']['columns']:
        if hid:
            continue
        name, limit_row = _upper_limit(g, x, ub, zone, cut_row, s_row)
        lo = max(y0, int(min(ub, limit_row)) - 30)
        r = np.nonzero(M[lo:ub + 30, x])[0]
        if not len(r):
            continue
        up = int(r.min() + lo)
        per.setdefault(name, []).append((x, up - limit_row, ub - up, zone))
    for name, ms in per.items():
        worst = min(ms, key=lambda m: m[1])
        out[name] = dict(allowPx=g['upper']['allowPx'], minMarginPx=round(float(worst[1]), 2), atColumn=int(worst[0]), zone=worst[3],
                         highestRisePx=round(float(max(m[2] for m in ms)), 2), columns=len(ms))
    if top_region is not None and neck_art is not None:
        nk = erode(neck_art, 1)
        win = np.zeros(M.shape, bool)
        drop = g['upper'].get('headDropPx', 0)
        for x, ub, z, hid, cut_row, s_row in g['upper']['columns']:
            if z == 'collar':
                top_row = max(ub, int(np.ceil(cut_row + drop)) + 1) if cut_row is not None else ub
                win[top_row:ub + 26, x] = True
        exposed = win & top_region & ~M
        if skin is not None:
            exposed &= skin
        if owners is not None:
            # The runtime head and its hair sit headDropPx lower than the
            # sheet's (VIEW_HEAD): what they cover at rest is not exposed.
            head = owners == 8
            cover = head.copy()
            for d in range(1, int(np.ceil(drop)) + 1):
                cover[d:] |= head[:-d]
            exposed &= ~(owners == 3) & ~cover
        # The 1 px rim next to the new top's edge is the seam itself (the
        # build closes it with the top's own edge, seamTolerancePx).
        bad = exposed & ~nk & ~dilate(M, 1)
        if band is not None:
            nb = band & win & top_region & ~M & ~cover if owners is not None else band & win & ~M
            out.setdefault('GHOST_EDGE', {})['neck'] = dict(bandPx=int((band & win).sum()), uncoveredPx=int(nb.sum()))
        out['NECK_OPEN'] = dict(exposedPx=int(exposed.sum()), outsideNeckArtPx=int(bad.sum()),
                                centerDepthPx=g['neck']['centerDepthPx'])
    return out


def measure_bottom(g, B, band=None, visible=None):
    """Bottom limits. B: bottom alpha; visible: bottom pixels visible at
    rest (defaults to B)."""
    out = {}
    visible = B if visible is None else visible
    x0, y0, x1, y1 = g['cell']
    for lg in g['legs']:
        cuffs = []
        for x in range(lg['cols'][0], lg['cols'][1] + 1):
            cuffs.append(_walk_down(B, x, lg['hiddenRow'] - 12, lg['knee'][1] + 20))
        name = 'leg%d' % lg['i']
        out.setdefault('SHORTS_SHORT', {})[name] = dict(limitRow=lg['hiddenRow'], cuff=min(cuffs), marginPx=min(cuffs) - lg['hiddenRow'])
        out.setdefault('SHORTS_LONG', {})[name] = dict(limitRow=lg['longRow'], cuff=max(cuffs), marginPx=round(lg['longRow'] - max(cuffs), 2))
        if band is not None:
            side = np.zeros(B.shape, bool)
            side[lg['hiddenRow'] - 2:lg['cleanRow'] + 2, int(lg['knee'][0] - 30):int(lg['knee'][0] + 30)] = True
            b = band & side
            out.setdefault('GHOST_EDGE', {})[name] = dict(bandPx=int(b.sum()), uncoveredPx=int((b & ~B).sum()))
    if g['view'] != 'right':
        cx = int(round(g['center']))
        crotch = _last_edge(B[:, cx:cx + 1], 0, y0, y1)
        cuff = min(min(_walk_down(B, x, lg['hiddenRow'] - 12, lg['knee'][1] + 20) for x in range(*lg['cols'])) for lg in g['legs'])
        out['SKIRT_LIKE'] = dict(crotchEdge=crotch, cuffEdge=cuff, openRows=int(cuff - crotch) if crotch else None,
                                 marginPx=int(cuff - crotch) if crotch else None)
    vis = 0
    for x, hb, st, armed in g['hem']['columns']:
        vis += int(visible[y0:hb - SEAM_TOLERANCE, x].sum())
    out['WAIST_VISIBLE'] = dict(visibleAboveHemPx=vis, marginPx=SEAM_TOLERANCE if vis == 0 else 0)
    return out


def measure_shoes(g, Sh, legs_alpha):
    out = {}
    x0, y0, x1, y1 = g['cell']
    for ft in g['feet']:
        tops, soles, pairs = [], [], []
        for x in range(ft['cols'][0], ft['cols'][1] + 1):
            t = _first(Sh, x, y0, y1); s = _last_edge(Sh, x, y0, y1); e = _last_edge(legs_alpha, x, y0, y1)
            if t is not None:
                tops.append(t); soles.append(s)
                if e is not None:
                    pairs.append((x, e + SEAM_TOLERANCE - t, e, t))
        name = 'foot%d' % ft['i']
        if not tops:
            out.setdefault('SHOE_MISSING', {})[name] = dict(missing=True)
            continue
        sole = float(np.median(soles))
        out.setdefault('SOLE_OFF_FLOOR', {})[name] = dict(floor=g['floor'], sole=sole, marginPx=round(SEAM_TOLERANCE - abs(sole - g['floor']), 2))
        worst = min(pairs, key=lambda p: p[1])
        out.setdefault('SHOE_LOW_OPENING', {})[name] = dict(legEnd=worst[2], shoeTop=worst[3], atColumn=worst[0], marginPx=worst[1])
        out.setdefault('SHOE_HIGH', {})[name] = dict(limitRow=ft['highRow'], shoeTop=min(tops), marginPx=round(min(tops) - ft['highRow'], 2))
        out.setdefault('SHOE_MISSING', {})[name] = dict(missing=False)
    return out


def margins(result):
    """Flatten {LIMIT: {part: {marginPx}} | {minMarginPx}} -> [(limit, part, margin)]."""
    rows = []
    for lim, v in result.items():
        if 'minMarginPx' in v:
            rows.append((lim, '-', v['minMarginPx']))
        elif 'marginPx' in v:
            rows.append((lim, '-', v['marginPx']))
        else:
            for part, w in v.items():
                if isinstance(w, dict) and 'marginPx' in w:
                    rows.append((lim, part, w['marginPx']))
    return rows


def pass_zones(g, band_arm=None):
    """Width (px) of the allowed interval per limit pair, at the arm axis /
    centre column. Clean art and, for information, legacy art."""
    z = {}
    for a in g['arms']:
        lo = float(t_hidden(a, 0)); hi = a['tCap']
        z['sleeve arm%d (clean art)' % a['i']] = [round(lo, 2), round(hi, 2), round(hi - lo, 2)]
        if band_arm is not None:
            cs, ts, P = arm_samples(a, t0=a['tElbow'] - 30, t1=a['tCap'] + 5)
            X = np.floor(P[..., 0]).astype(int); Y = np.floor(P[..., 1]).astype(int)
            hit = band_arm[Y, X]
            if hit.any():
                lo2 = float(np.max(np.where(hit, ts[None, :] + .5, -1e9)))
                z['sleeve arm%d (legacy art: cover band)' % a['i']] = [round(lo2, 2), round(hi, 2), round(hi - lo2, 2)]
    hem = [(st - g['hem']['waistCoverOffsetPx'] + g['hem']['overlapU'] / g['k']) for x, hb, st, armed in g['hem']['columns'] if not armed]
    if hem:
        lo = max(hem); hi = g['hem']['hemLowRow']
        z['hem'] = [round(lo, 2), round(hi, 2), round(hi - lo, 2)]
    for lg in g['legs']:
        z['shorts cuff leg%d' % lg['i']] = [lg['hiddenRow'], lg['longRow'], round(lg['longRow'] - lg['hiddenRow'], 2)]
    for ft in g['feet']:
        z['shoe sole foot%d' % ft['i']] = [g['floor'] - SEAM_TOLERANCE, g['floor'] + SEAM_TOLERANCE, 2 * SEAM_TOLERANCE]
    allow = g['upper']['allowPx']
    if g['neck']['centerDepthPx'] is not None:
        z['neckline at centre (rise allowance .. neck art depth)'] = [round(-allow, 2), g['neck']['centerDepthPx'],
                                                                       round(allow + g['neck']['centerDepthPx'], 2)]
    return z
