"""Hosted 3D Jutsu blockout. Blender units metres; front -Y; static game landmark.
Passport: rounded ochre workshop / lowpoly hero GLB; HERO semantic parts, ENV/CAM/LGT helpers;
9.8m height and 5.7m radius limits; 50mm front-three-quarter; warm daylight; no animation.
Coarse acceptance: hollow forge, stepped side bay, thick curved roof, ground contact.
"""
import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for mat in list(bpy.data.materials): bpy.data.materials.remove(mat)
PALETTE = {'plaster':(0.80,0.66,0.43,1),'stone':(.41,.43,.36,1),'timber':(.27,.115,.043,1),'tile':(.56,.16,.065,1),'tileLight':(.74,.26,.095,1),'canvas':(.89,.58,.18,1),'iron':(.12,.17,.17,1),'brass':(.77,.40,.075,1)}
M={}
for k,col in PALETTE.items():
 m=bpy.data.materials.new(k); m.diffuse_color=col; m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=col; p.inputs['Roughness'].default_value=.83 if k not in ('iron','brass') else .48; p.inputs['Metallic'].default_value=.45 if k in ('iron','brass') else 0
 M[k]=m

def mesh(name,v,f,mat):
 data=bpy.data.meshes.new(name); data.from_pydata(v,[],f); data.update(); o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.data.materials.append(M[mat]); return o

def box(name,loc,sz,mat,bevel=0):
 x,y,z=[a/2 for a in sz]; v=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]; f=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
 o=mesh(name,v,f,mat);o.location=loc
 if bevel:
  b=o.modifiers.new('Soft handmade edges','BEVEL');b.width=bevel;b.segments=1
  n=o.modifiers.new('Weighted broad faces','WEIGHTED_NORMAL');n.keep_sharp=True
 return o

def ringform(name,rings,n,mat):
 v=[(cx+rx*math.cos(t*2*math.pi/n),cy+ry*math.sin(t*2*math.pi/n),z) for cx,cy,rx,ry,z in rings for t in range(n)]; f=[]
 for j in range(len(rings)-1):
  for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 f.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+i for i in range(n))]);return mesh(name,v,f,mat)
# main grounded open workshop; no front wall filling the portal
box('HERO_foundation',(-.65,.2,.2),(5.8,4.7,.4),'stone',.15)
box('HERO_backwall',(-.65,2.05,1.9),(5.1,.42,3.2),'plaster',.08)
box('HERO_leftwall',(-3.05,.3,1.9),(.36,3.7,3.2),'plaster',.08)
box('HERO_rightwall',(1.75,.55,1.9),(.4,3.25,3.2),'plaster',.08)
for x in [-2.9,1.6]:box('HERO_frontpost_'+str(x),(x,-1.95,1.9),(.42,.48,3.35),'timber',.08)
box('HERO_frontlintel',(-.65,-1.95,3.48),(4.9,.5,.5),'timber',.08)
ringform('HERO_upper_plaster',[(-.65,.2,2.55,2.08,3.55),(-.65,.2,2.52,2.05,5.62)],12,'plaster')
ringform('HERO_roof_thickness',[(-.65,.2,3.15,2.65,5.70),(-.65,.2,3.15,2.65,5.91),(-.65,.2,2.80,2.38,6.06),(-.65,.2,1.95,1.65,6.72),(-.65,.2,.58,.50,7.70)],36,'tile')
# offset low annex, support depth and cloth canopy silhouette
box('HERO_annex_floor',(-3.5,-.2,.25),(1.8,3.75,.5),'stone',.1)
box('HERO_annex_back',(-3.55,1.43,1.75),(1.85,.25,2.5),'plaster',.06)
for y in [-1.72,1.32]:box('HERO_annex_post_'+str(y),(-4.25,y,1.75),(.26,.3,2.8),'timber',.04)
o=box('HERO_annex_roof',(-3.8,-.15,3.42),(2.25,4.05,.24),'tile',.10);o.rotation_euler[1]=-.16
box('HERO_main_workbench',(-.45,-.95,1.25),(3.15,.8,.2),'timber',.06)
for x in [-1.65,.75]:box('HERO_bench_foot_'+str(x),(x,-.95,.8),(.22,.64,.9),'timber',.03)
box('HERO_forge_back',(-.75,1.3,2.05),(1.5,1.1,2.85),'stone',.12)
box('HERO_chimney',(-1.2,1.25,6.55),(1.0,1.0,4.0),'stone',.1)
box('HERO_chimney_cap',(-1.2,1.25,8.56),(1.22,1.22,.27),'stone',.07)
# helpers separate from runtime hero
box('ENV_ground',(0,0,-.12),(35,35,.20),'stone',0)
scene=bpy.context.scene
world=bpy.data.worlds.new('Workshop daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.65,.72,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
ld=bpy.data.lights.new('LGT_key','SUN');ld.energy=2.8;ld.angle=.16;lo=bpy.data.objects.new('LGT_key',ld);bpy.context.collection.objects.link(lo);lo.rotation_euler=(math.radians(28),math.radians(-24),math.radians(-28))
ld=bpy.data.lights.new('LGT_fill','POINT');ld.energy=900;ld.shadow_soft_size=6;lo=bpy.data.objects.new('LGT_fill',ld);bpy.context.collection.objects.link(lo);lo.location=(6,-8,9)
cd=bpy.data.cameras.new('CAM_main');co=bpy.data.objects.new('CAM_main',cd);bpy.context.collection.objects.link(co);co.location=(13,-20,12);co.rotation_euler=(Vector((-.25,0,3.7))-co.location).to_track_quat('-Z','Y').to_euler();cd.type='ORTHO';cd.ortho_scale=13.8;scene.camera=co
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=800;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene['asset_contract']='Static workshop; Blender -Y front / GLB +Z front; export HERO only; collision radius 5.7'
bpy.context.view_layer.update()
result={'objects':len(bpy.data.objects),'hero_parts':len([o for o in bpy.data.objects if o.name.startswith('HERO_')]),'materials':list(M)}
