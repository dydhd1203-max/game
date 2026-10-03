#!/usr/bin/env python3
"""Extract supplied screenshot pixels; never paint or generate replacement art.
Requires Pillow only for this reproducible authoring step, not for deployment.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
from collections import deque
import json, hashlib
ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / 'assets/forest-village-library'
OUT = LIB / 'extracted'
OUT.mkdir(exist_ok=True)
SOURCES = {n: LIB / 'originals' / (n + '.png') for n in ['picnic-garden','forest-classroom','treehouse','quiz-island']}
SOURCES['houses'] = ROOT / 'assets/house-library/originals/house-0c0b1bd03495c453.jpg'
images = {n: Image.open(p).convert('RGBA') for n,p in SOURCES.items()}
records = []
def save(name, im, source, rect, **extra):
    p = OUT / (name+'.png'); im.save(p,optimize=True)
    records.append(dict(id=name,file='extracted/'+p.name,source=str(SOURCES[source].relative_to(ROOT)),sourceSHA256=hashlib.sha256(SOURCES[source].read_bytes()).hexdigest(),sourceRect=rect,width=im.width,height=im.height,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),**extra))
def crop(name, source, rect, polygon=None, background=False):
    x,y,w,h=rect; im=images[source].crop((x,y,x+w,y+h))
    if polygon:
        mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(polygon,fill=255);im.putalpha(mask)
    if background:
        # Remove only edge-connected cream sheet background, keeping interior
        # cream walls and original paving. No RGB repaint, blur or inpainting.
        pix=im.load();seen=set();q=deque()
        for xx in range(w):q.extend([(xx,0),(xx,h-1)])
        for yy in range(h):q.extend([(0,yy),(w-1,yy)])
        while q:
            xx,yy=q.popleft()
            if (xx,yy) in seen or not(0<=xx<w and 0<=yy<h):continue
            seen.add((xx,yy));r,g,b,a=pix[xx,yy]
            if r<228 or g<218 or b<193:continue
            pix[xx,yy]=(r,g,b,0)
            q.extend([(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)])
    save(name,im,source,rect,polygon=polygon,edgeConnectedBackground=background)
    return im
# Patches are object-sized polygons, never lawn rectangles across tree groups.
# Every source pixel outside these explicit masks remains byte-for-byte intact.
def patch_ground(im, source, donor, polygon, reason, patches, ground_transition=0, outside_transition=0):
    mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(polygon,fill=255)
    x,y,w,h=donor; tile=images[source].crop((x,y,x+w,y+h));layer=Image.new('RGBA',im.size)
    for yy in range(0,im.height,h):
        for xx in range(0,im.width,w):layer.paste(tile,(xx,yy))
    if ground_transition:
        # Blend only the ground pixels inside the recorded perimeter. This
        # filters the alpha mask, never the tree/flower artwork or source RGB.
        mask=ImageChops.multiply(mask,mask.filter(ImageFilter.GaussianBlur(ground_transition)))
    if outside_transition:
        # The object removal stays fully opaque. Only a narrow surrounding
        # grass ring blends source samples, so no old furniture bleeds back.
        ring=mask.filter(ImageFilter.GaussianBlur(outside_transition))
        ring=ImageChops.multiply(ring,mask.filter(ImageFilter.MaxFilter(outside_transition*4+1)))
        mask=ImageChops.lighter(mask,ring)
    im.paste(layer,(0,0),mask)
    patches.append(dict(donorRect=donor,maskPolygon=polygon,reason=reason,groundTransition=ground_transition,groundOutsideTransition=outside_transition))

def source_sprite(im, source, rect, poly, target, patches, reason='whole native tree with crown, trunk and ground shadow', flip=False):
    x,y,w,h=rect;piece=images[source].crop((x,y,x+w,y+h))
    if flip:piece=piece.transpose(Image.Transpose.FLIP_LEFT_RIGHT);poly=[(w-1-px,py) for px,py in poly]
    mask=Image.new('L',(w,h));ImageDraw.Draw(mask).polygon(poly,fill=255)
    im.paste(piece,target,mask)
    patches.append(dict(sourceRect=rect,polygon=poly,target=target,flipX=flip,reason=reason))

im=images['picnic-garden'].copy();patches=[]
# Two rugs, their adjacent bench and one complete dining group are removed.
# The second courtyard occupies the tree's old plot; remove the WHOLE tree.
for poly,reason in [
 ([(278,68),(350,65),(362,132),(283,135)],'entire upper picnic rug'),
 ([(259,161),(333,163),(337,231),(256,230)],'entire lower picnic rug'),
 ([(360,158),(388,158),(389,218),(381,227),(361,224)],'entire rug-side bench'),
 ([(282,465),(307,465),(310,487),(328,487),(340,494),(340,539),(324,547),(324,562),(311,575),(281,575),(277,544),(249,542),(248,492),(272,489),(281,488)],'entire white dining table and four chairs'),
 ([(338,424),(365,424),(386,439),(395,461),(392,486),(371,500),(372,511),(341,514),(337,500),(321,484),(319,456),(327,439)],'entire courtyard tree including crown, trunk and shadow')
]:patch_ground(im,'picnic-garden',[558,702,32,24],poly,reason,patches,outside_transition=2 if 'rug' in reason else 0)
# The name and avatar sit on clean path. Narrow masks retain neighboring
# bushes, yellow flower, lamp and pine: no rectangular terrain overpainting.
for poly in [[(562,397),(581,397),(581,398),(621,398),(621,414),(581,414),(581,416),(562,416)],[(589,417),(608,417),(608,450),(587,450)]]:
    patch_ground(im,'picnic-garden',[599,480,20,22],poly,'captured name/avatar only',patches)
# The original name also covered the lower flowering shrub and tiny yellow
# flower. Keep the intact parent bush and clock; replace only the complete
# affected lower plant with a traced whole flowering shrub from the same map.
patch_ground(im,'picnic-garden',[558,702,32,24],[(611,383),(635,384),(643,392),(642,402),(634,407),(627,410),(627,416),(621,422),(614,422),(609,418),(610,410),(604,403),(603,397),(607,390)],'complete UI-occluded lower flower shrub and tiny flower; parent bush stays intact',patches)
# Restore the clean parent shrub through its curved lower outline. Its bottom
# overlaps the replacement flower, so a horizontal mask must never truncate it.
source_sprite(im,'picnic-garden',[599,366,36,30],[(11,1),(23,0),(32,5),(35,13),(34,18),(21,23),(15,28),(8,26),(3,22),(1,13),(2,8)],(599,366),patches,'unchanged parent shrub and curved lower silhouette at original registration')
purple_polygon=[(17,6),(20,5),(23,5),(25,6),(29,6),(30,8),(31,10),(34,11),(36,14),(37,17),(36,21),(34,24),(28,25),(27,27),(25,27),(23,26),(20,26),(19,27),(16,27),(15,25),(11,24),(9,22),(8,21),(5,21),(5,19),(7,18),(8,15),(9,12),(10,10),(12,7),(15,7)]
source_sprite(im,'picnic-garden',[415,233,45,31],purple_polygon,(599,380),patches,'complete flowering shrub; reflected to match the source bed orientation',flip=True)
# The toolbar occupies trees at the outer top edge. Use the clean map below
# that edge, rather than invent the hidden crowns. Coordinates record the crop.
save('village-composition',im.crop((0,64,1115,800)),'picnic-garden',[0,64,1115,736],patches=patches)
# Central-plaza redesign is a separate derivative; the first composition and
# the original pink tree remain available. Each affected object is removed in
# full, then replaced/relocated in the scene rather than hidden by a crop.
plaza=im.copy();plaza_patches=list(patches)
plaza_removals=[
 ([(566,32),(704,30),(761,43),(796,77),(803,124),(794,164),(737,184),(708,200),(675,226),(636,220),(597,196),(581,163),(578,121),(565,86)],'complete original pond with its overlapping front pine, shore props and small chair; replace with brook'),
 ([(638,235),(656,226),(682,226),(715,218),(774,218),(789,228),(813,218),(868,217),(880,202),(894,202),(900,243),(907,262),(900,279),(883,279),(877,269),(674,272),(647,266),(638,254)],'complete north bench, stool, fence, flowers and lamp group for the great-tree crown'),
 ([(708,276),(729,258),(808,258),(832,274),(858,307),(860,334),(838,352),(823,374),(823,399),(742,402),(742,374),(710,365),(694,337),(704,301)],'complete pink tree and fallen petals; original tree is relocated intact to the secret garden'),
 ([(813,328),(852,326),(921,352),(926,374),(885,396),(863,401),(817,381),(807,359)],'complete blue picnic blanket, cup and tea pot'),
 ([(681,350),(718,348),(749,365),(764,374),(796,392),(802,417),(775,440),(715,440),(679,415),(672,386)],'complete umbrella, basket and pink picnic blanket'),
 ([(818,410),(858,376),(878,370),(922,373),(941,394),(952,431),(939,461),(915,491),(896,501),(872,499),(819,482)],'complete two eastern courtyard trees and attached root shrubs; not a cut crown'),
]
for polygon,reason in plaza_removals:patch_ground(plaza,'picnic-garden',[558,702,32,24],polygon,reason,plaza_patches,outside_transition=1)
# Remove the entire small west post/fence assembly (including its foot).
patch_ground(plaza,'picnic-garden',[558,702,32,24],[(633,233),(697,233),(705,253),(698,279),(674,285),(635,284)],'whole west signpost, fence and flowers; preserve both neighboring vertical benches',plaza_patches,outside_transition=2)
patch_ground(plaza,'picnic-garden',[558,702,32,24],[(728,151),(749,151),(754,160),(754,184),(743,190),(727,181)],'entire remaining pond shrub at fence foot; no rectangular dark green stump',plaza_patches,outside_transition=1)
# Reconnect the original east-west path to the actual brook bridge. The ground
# samples are from the same path; the shore itself is the adapted brook sprite.
patch_ground(plaza,'picnic-garden',[599,480,20,22],[(580,202),(610,203),(646,204),(667,199),(699,183),(737,177),(780,179),(823,179),(858,179),(889,185),(914,219),(928,249),(922,268),(901,252),(877,237),(846,232),(804,232),(766,232),(730,231),(700,239),(667,252),(637,258),(609,248),(580,230)],'continuous curved path meeting the brook bridge; remove straight grass patch cuts',plaza_patches,outside_transition=2)
source_sprite(plaza,'picnic-garden',[744,151,151,29],[(6,9),(8,9),(8,0),(15,0),(20,9),(35,9),(41,0),(48,0),(52,10),(150,8),(150,28),(15,28),(12,25),(12,21),(6,21)],(744,151),plaza_patches,'restore the complete northern fence at original registration; never leave a half fence under a terrain patch')
source_sprite(plaza,'picnic-garden',[795,115,25,28],[(1,0),(24,0),(24,18),(22,28),(4,28),(1,19)],(795,115),plaza_patches,'complete original northern stool, all four legs and shadow; pond removal must not crop it')
# Recover the curved path beside the removed grove using original path pixels.
patch_ground(plaza,'picnic-garden',[599,480,20,22],[(949,367),(963,367),(963,464),(929,494),(905,507),(877,507),(877,499),(902,489),(920,466),(934,440),(942,410)],'curved east path after whole grove removal; no angular lawn over paving',plaza_patches,outside_transition=2)
# The full southern bench and its own flower bed stay at original registration.
source_sprite(plaza,'picnic-garden',[802,465,89,33],[(0,0),(71,0),(71,7),(85,8),(89,15),(87,25),(80,31),(69,32),(66,27),(5,26),(0,20)],(802,465),plaza_patches,'complete southern bench, legs, shadow and small right flower bed restored after grove removal')
source_sprite(plaza,'picnic-garden',[871,456,41,39],[(17,0),(29,2),(36,7),(40,16),(37,29),(28,36),(16,38),(6,33),(0,23),(2,12),(9,4)],(871,456),plaza_patches,'whole bench-side flowering shrub and shadow; no chopped old tree remnant')
save('plaza-composition',plaza.crop((0,64,1115,800)),'picnic-garden',[0,64,1115,736],patches=plaza_patches)


# Garden: preserve the entire gate/fence and all surrounding trees. UI is
# removed locally; four whole source trees restore the affected border grove.
im=images['forest-classroom'].copy();patches=[]
for poly in [[(419,452),(508,452),(508,478),(419,478)],[(461,479),(483,479),(483,509),(461,509)]]:
    patch_ground(im,'forest-classroom',[490,490,12,12],poly,'captured name/avatar and complete obscured hanging garland; keep both posts',patches)
# UI has occluded these source trees and shrub crowns. Replace each entire
# affected border group, including the old roots, rather than retain a half
# crown below the toolbar. Adjacent complete trees are protected separately.
for poly in [
 [(104,0),(234,0),(239,68),(218,83),(211,105),(197,123),(162,135),(126,127),(123,105),(120,85),(103,70)],
 [(780,0),(962,0),(962,78),(911,74),(885,71),(840,71),(819,64),(794,56),(782,25)]
]:patch_ground(im,'forest-classroom',[260,155,12,12] if poly[0][0]<500 else [904,62,12,12],poly,'entire UI-occluded border tree group; replace whole silhouettes',patches,ground_transition=3)
# Distinct complete native trees, including roots, rather than a rectangular
# block of forest that shears the next tree at the join.
round_rect=[35,46,83,88];round_poly=[(30,0),(60,5),(79,22),(82,44),(66,59),(43,66),(43,84),(29,87),(24,82),(27,66),(8,57),(0,40),(4,20)]
source_sprite(im,'forest-classroom',round_rect,round_poly,(88,-9),patches)
round2_rect=[845,131,74,87];round2_poly=[(23,0),(47,0),(66,15),(73,35),(68,51),(51,65),(42,67),(44,82),(28,86),(25,78),(28,63),(11,60),(0,41),(4,19)]
source_sprite(im,'forest-classroom',round2_rect,round2_poly,(163,15),patches)
# Restore the whole unobscured neighboring tree, then a complete native pine.
source_sprite(im,'forest-classroom',round_rect,round_poly,(35,46),patches)
source_sprite(im,'forest-classroom',[93,248,67,84],[(34,0),(41,14),(47,27),(55,39),(62,53),(66,61),(56,70),(40,74),(40,82),(29,84),(26,76),(10,71),(0,62),(9,43),(18,29),(27,13)],(125,45),patches)
source_sprite(im,'forest-classroom',round_rect,round_poly,(771,-39),patches)
source_sprite(im,'forest-classroom',round_rect,round_poly,(835,-21),patches)
source_sprite(im,'forest-classroom',round2_rect,round2_poly,(902,-15),patches)
save('garden-composition',im,'forest-classroom',[0,0,962,541],patches=patches)

for name,rect in [('flower-home',[11,5,352,295]),('bakery-home',[9,308,354,289])]:crop(name,'houses',rect,background=True)
# Exact source registration: foreground sits on the same original pixels.
# Standalone relocation needs alpha around the WHOLE tree, unlike a foreground
# crop that still shares its old ground. Preserve RGB; remove only green lawn.
pink_rect=[690,250,181,153]
pink_poly=[(65,17),(86,15),(107,19),(126,19),(137,27),(144,30),(144,37),(151,39),(152,49),(156,55),(155,68),(162,75),(164,81),(158,89),(145,92),(130,104),(117,109),(118,121),(113,124),(105,124),(98,120),(97,109),(72,103),(58,106),(45,108),(26,102),(15,95),(17,84),(25,75),(23,68),(31,57),(40,55),(41,47),(47,39),(47,32),(61,26)]
pink=images['picnic-garden'].crop((690,250,871,403));alpha=Image.new('L',pink.size);ImageDraw.Draw(alpha).polygon(pink_poly,fill=255)
petals_poly=[(53,104),(147,104),(153,132),(116,143),(97,139),(83,134),(69,124),(53,120)]
petals=Image.new('L',pink.size);ImageDraw.Draw(petals).polygon(petals_poly,fill=255)
for yy in range(pink.height):
    for xx in range(pink.width):
        r,g,bb,_=pink.getpixel((xx,yy))
        if g>r*1.015 and g>bb*1.03:alpha.putpixel((xx,yy),0)
        elif petals.getpixel((xx,yy)) and r>g*1.15 and bb>g*.85:alpha.putpixel((xx,yy),255)
pink.putalpha(alpha)
save('pink-tree',pink,'picnic-garden',pink_rect,polygon=pink_poly,petalsPolygon=petals_poly,alphaExtraction={'greenBackground':'G > R*1.015 and G > B*1.03','fallenPetals':'R > G*1.15 and B > G*.85','RGB':'unchanged original pixels'})
# Low flower units use the same native map palette. Keep petals, leaves and
# ground shadows together, excluding adjacent stepping stones and other props.
crop('flowers-purple','picnic-garden',[415,233,45,31],purple_polygon)
crop('flowers-ivory','picnic-garden',[647,347,30,23],[(13,0),(19,0),(20,3),(25,4),(28,8),(26,11),(29,14),(27,18),(23,18),(23,21),(17,22),(14,21),(9,22),(7,20),(3,19),(3,16),(0,15),(1,11),(2,9),(4,7),(3,5),(6,3),(10,3)])
crop('flowers-gold','forest-classroom',[208,477,32,31],[(10,1),(18,1),(19,3),(24,3),(25,6),(29,7),(31,11),(28,14),(31,18),(29,22),(26,23),(26,26),(22,28),(16,29),(12,28),(7,29),(3,27),(1,23),(1,18),(0,15),(2,10),(4,7),(7,6)])
crop('flowers-meadow','forest-classroom',[367,393,33,24],[(19,3),(25,3),(28,6),(28,11),(31,13),(30,18),(26,21),(22,21),(19,18),(16,17),(14,21),(9,23),(5,21),(4,17),(1,13),(3,10),(5,8),(11,8),(14,10),(16,7)])
crop('treehouse-composition','treehouse',[0,64,946,740])
im=images['quiz-island'].copy();patches=[]
# Captured UI crosses the stepping stones. Remove the whole affected stones
# as well as the complete avatar; restore complete stones from this same map.
patch_ground(im,'quiz-island',[615,260,12,12],[(558,232),(624,232),(624,253),(609,253),(609,288),(585,288),(585,267),(566,267),(563,257),(558,253)],'complete captured UI/avatar and UI-obscured stepping stones',patches)
source_sprite(im,'quiz-island',[570,299,24,12],[(5,0),(18,0),(23,4),(22,9),(16,11),(5,11),(0,7),(1,3)],(566,249),patches,'complete native stepping stone')
source_sprite(im,'quiz-island',[573,273,12,7],[(3,0),(10,0),(11,4),(8,6),(0,6),(0,2)],(571,233),patches,'complete native stepping stone')
# Sky UI has no terrain behind it: source sky only, safely above clouds.
im.paste(images['quiz-island'].crop((395,0,512,84)),(839,0));patches.append(dict(sourceRect=[395,0,117,84],target=[839,0],reason='service toolbar on empty sky'))
save('sky-composition',im,'quiz-island',[0,0,956,553],patches=patches)
(LIB/'extractions.json').write_text(json.dumps(dict(version=2,policy='User-provided pixels; full-object masks and protected surrounding silhouettes. Original files remain unchanged.',assets=records),ensure_ascii=False,indent=2)+'\n')
print('Extracted',len(records),'registered source regions.')
