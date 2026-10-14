"""Inspect an exact downloaded hosted GLB, without downloading remote render images.
blender -b --python this.py -- source.glb output.png [front|side|detail:KEY]
The runtime export itself is never modified by this inspection.
"""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];src,out=args[:2];mode=args[2] if len(args)>2 else 'front'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
if Path(src).is_dir():
 for key,(x,y) in {'wagon':(-8,-5),'market':(2,-5),'assembly':(11,-4),'smithYard':(-5,5),'supplyYard':(5,5)}.items():
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(Path(src)/('village-'+key+'.glb')))
  for ob in set(bpy.data.objects)-before:
   if not ob.parent:ob.location+=Vector((x,y,0))
else:bpy.ops.import_scene.gltf(filepath=src)
scene=bpy.context.scene
for ob in list(bpy.data.objects):
 if ob.type in ['LIGHT','CAMERA'] or ob.name.startswith('ENV_'):bpy.data.objects.remove(ob,do_unlink=True)
world=bpy.data.worlds.new('Inspection daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.65,.72,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
ld=bpy.data.lights.new('inspect_key','SUN');ld.energy=2.5;ld.angle=.2;ob=bpy.data.objects.new('inspect_key',ld);bpy.context.collection.objects.link(ob);ob.rotation_euler=(.45,-.38,-.5)
ld=bpy.data.lights.new('inspect_fill','POINT');ld.energy=1500;ld.shadow_soft_size=9;ob=bpy.data.objects.new('inspect_fill',ld);bpy.context.collection.objects.link(ob);ob.location=(4,-12,14)
cd=bpy.data.cameras.new('inspect_cam');cam=bpy.data.objects.new('inspect_cam',cd);bpy.context.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
if mode.startswith('detail:'):
 key=mode.split(':')[1];offs={'wagon':(-8,-5),'market':(2,-5),'assembly':(11,-4),'smithYard':(-5,5),'supplyYard':(5,5)};x,y=offs[key]
 for ob in bpy.data.objects:
  if ob.type=='MESH' and not ob.name.startswith('HERO_'+key+'_'):ob.hide_render=True
 cam.location=(x+9,y-13,9);target=(x,y,2);cd.ortho_scale=10
elif mode=='side':cam.location=(34,0,15);target=(1,0,1.6);cd.ortho_scale=27
else:cam.location=(26,-36,26);target=(1,0,1.4);cd.ortho_scale=35
cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=False
scene.render.resolution_x=1400;scene.render.resolution_y=980;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=out;scene.render.film_transparent=False
bpy.ops.render.render(write_still=True)
