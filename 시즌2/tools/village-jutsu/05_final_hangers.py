"""Final exact runtime close-ups: complete physical hanging supports.
Run with 00_helpers.py then 03_contact_colors.py; no layout or silhouette changes.
"""
landmark('supplyYard')
for x in [-.51,.51]:
 z=2.98+.63*math.sin(math.pi*(x+2.22)/4.44)
 rod('supply_sign_hanger',(x,-1.79,z-.015),(x,-1.84,2.56),.021,'iron',6)
for key,points in [
 ('supplyYard',[(1.96,-1.48,2.91),(1.97,-1.67,2.90),(1.97,-1.67,2.80)]),
 ('market',[(-2.8,-1.85,3.01),(-2.79,-1.98,3.01),(-2.79,-1.98,2.87)]),
 ('assembly',[(1.35,2.54,2.87),(1.53,2.26,2.91),(1.53,2.26,2.79)]),
 ('smithYard',[(-2,-1.35,2.83),(-1.93,-1.49,2.86),(-1.93,-1.49,2.75)])]:
 landmark(key);pipe('lantern_bracket',points,.025,'iron',6)
normalize_normals();result=audit()
