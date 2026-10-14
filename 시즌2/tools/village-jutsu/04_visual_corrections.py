"""Revision2 exact GLB close-up revealed detached outer rim pins and a sign without hangers.
Correct their contact, then rerun 03_contact_colors.py to update final contact AO.
"""
landmark('wagon')
for ob in bpy.data.objects:
 if ob.name.startswith('HERO_wagon_') and ('hubcap' in ob.name or 'rim_pin' in ob.name):
  cx=sum(v.co.x for v in ob.data.vertices)/len(ob.data.vertices)-OFFSETS['wagon'][0]
  ob.location.x+=-.10 if cx>0 else .10
for x in [-.62,.62]:
 z=2.55+2.15*math.sqrt(1-(x/1.83)**2)
 rod('trade_sign_hanger',(x,-2.28,z-.04),(x,-2.36,2.91),.021,'iron',6)
rod('lantern_hook_support',(1.70,-2.20,3.34),(1.70,-2.15,3.03),.035,'iron',8)
normalize_normals();result=audit()
