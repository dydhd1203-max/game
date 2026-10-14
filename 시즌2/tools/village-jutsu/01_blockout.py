"""Scene Passport: five distinct static warm village landmarks, not scene duplication.
Procedural HERO collections on separate preview pads; gameplay front is +Z after glTF.
Deliver 5 origin-centred GLBs, shared 8 materials, 65–85k triangle ceiling target.
Presentation camera front three-quarter, sun from left, soft fill; game look comes from S1.
Silhouette gates: wagon barrel-vault, pavilion hanging cloth, low meeting hearth,
repair annex thick sloping tiles, compact cloth-roof store with visible shelves.
"""
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):bpy.data.materials.remove(m)
palette={'plaster':(.80,.66,.43,1),'stone':(.41,.43,.36,1),'timber':(.27,.115,.043,1),'tile':(.56,.16,.065,1),'tileLight':(.74,.26,.095,1),'iron':(.12,.17,.17,1),'brass':(.77,.40,.075,1),'canvas':(.17,.38,.33,1)}
M={}
for n,c in palette.items():
 m=bpy.data.materials.new(n);m.diffuse_color=c;m.use_nodes=True;m.use_backface_culling=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=.85 if n not in ['iron','brass'] else .5;p.inputs['Metallic'].default_value=.4 if n in ['iron','brass'] else 0;M[n]=m
# Trading caravan, open covered cargo compartment with four real wheels.
landmark('wagon')
box('bed',(0,0,1.30),(3.5,4.6,.24),'timber',.06)
for x in [-1.80,1.80]:box('sideboard',(x,.15,1.72),(.14,4.24,.70),'timber',.045)
for y in [-1.60,1.60]:
 rod('axle',( -2.20,y,.79),(2.20,y,.79),.15,'iron')
 for x in [-2.08,2.08]:
  torus('wheel_rim',(x,y,.79),.68,.10,'timber','X');torus('iron_tire',(x,y,.79),.78,.025,'iron','X')
  rod('wheel_hub',(x-.14,y,.79),(x+.14,y,.79),.18,'timber')
  for i in range(12):
   a=i*math.pi/6;rod('wheel_spoke',(x,y,.79),(x,y+.63*math.cos(a),.79+.63*math.sin(a)),.035,'timber',6)
surface('barrel_canvas',lambda u,v:(-1.83*math.cos(u*math.pi),-2.24+4.48*v,2.55+2.15*math.sin(u*math.pi)+.035*math.sin(v*math.pi*10)),20,16,'plaster',.06)
for y in [-2.24,-1.12,0,1.12,2.24]:pipe('bow',[( -1.83*math.cos(i*math.pi/20),y,2.55+2.15*math.sin(i*math.pi/20)) for i in range(21)],.065,'timber')
for x in [-1.7,1.7]:rod('shaft',(x,-1.8,1.2),(x,-3.80,.76),.095,'timber')
# Layered draped open market pavilion.
landmark('market')
for x in [-2.8,2.8]:
 for y in [-1.85,1.85]:
  box('post',(x,y,1.66),(.20,.20,3.30),'timber',.045);box('post_stone',(x,y,.18),(.42,.42,.36),'stone',.06)
def canopy(u,v):return (-3.2+6.4*u,-2.15+4.3*v,3.18+.74*math.sin(math.pi*u)-.15*math.sin(math.pi*v)+.05*math.sin(u*math.pi*8))
surface('main_draped_canopy',canopy,24,16,'canvas',.045)
surface('counter_awning',lambda u,v:(-3.22+6.44*u,-2.55+.55*v,2.77+.30*v-.12*math.sin(u*math.pi)),24,4,'plaster',.04)
for y in [-1.80,1.80]:rod('crossbeam',(-2.95,y,3.12),(2.95,y,3.12),.12,'timber')
box('counter',(0,-1.45,1.09),(5.55,.88,.20),'timber',.05)
for x in [-2.3,0,2.3]:box('counter_leg',(x,-1.45,.55),(.20,.65,1.05),'timber',.025)
box('rear_shelf',(0,1.48,1.6),(4.9,.64,.17),'timber')
# Circular waystation, low enough for group sightlines.
landmark('assembly')
for i in range(16):
 a=i*math.pi/8;box('hearth_stone',(1.25*math.cos(a),.4+1.25*math.sin(a),.23),(.49,.43,.46),'stone',.12)
for x in [-2.6,2.6]:
 box('bench_seat',(x,0,.78),(.65,3.1,.18),'timber',.075)
 for y in [-1.1,1.1]:box('bench_foot',(x,y,.40),(.53,.30,.70),'stone',.07)
for x in [-1.35,1.35]:box('notice_post',(x,2.65,1.47),(.22,.26,2.94),'timber',.035)
box('notice_board',(0,2.65,2.05),(2.8,.2,1.45),'timber',.05)
for side in [-1,1]:surface('notice_roof',lambda u,v,s=side:(s*(.04+1.62*u),2.15+.98*v,3.55-.46*u+.11*u*u),9,4,'tile',.16)
# Roofed repair annex with true open front and tool recess.
landmark('smithYard')
box('floor',(0,.15,.12),(4.5,3.4,.24),'stone',.08)
box('rear_plaster',(0,1.59,1.52),(4.12,.25,2.77),'plaster',.06)
for x in [-2,2]:
 for y in [-1.35,1.55]:box('post',(x,y,1.48),(.23,.23,2.90),'timber',.04)
surface('sloping_roof',lambda u,v:(-2.45+4.9*u,-1.72+3.65*v,2.9+.75*v+.10*math.sin(math.pi*u)),18,10,'tile',.19)
box('workbench',(0,.83,1.00),(3.6,.90,.20),'timber',.04)
for x in [-1.35,1.35]:box('bench_leg',(x,.82,.55),(.20,.72,.85),'timber',.03)
# Curved cloth supply store, back/side shelves leave front visibly open.
landmark('supplyYard')
box('plank_floor',(0,0,.13),(4.25,3.48,.26),'timber',.035)
for x in [-1.96,1.96]:
 for y in [-1.48,1.48]:box('post',(x,y,1.48),(.20,.20,2.93),'timber',.045)
surface('cloth_roof',lambda u,v:(-2.22+4.44*u,-1.79+3.58*v,2.98+.63*math.sin(math.pi*u)-.10*math.sin(math.pi*v)+.04*math.sin(v*math.pi*6)),20,12,'canvas',.06)
for z in [.65,1.30,1.95]:box('rear_shelf',(0,1.18,z),(3.80,.57,.12),'timber',.03)
for x in [-1.75,1.75]:box('shelf_upright',(x,1.26,1.4),(.12,.13,2.55),'timber')
# Working light and camera rig, excluded from runtime assets.
K='assembly';o=box('presentation_ground',(0,0,-.13),(40,26,.20),'stone',0);o.name='ENV_ground';o.data.materials[0]=M['stone']
scene=bpy.context.scene;world=bpy.data.worlds.new('Village daylight');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.65,.72,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
ld=bpy.data.lights.new('LGT_key','SUN');ld.energy=2.5;ld.angle=.2;lo=bpy.data.objects.new('LGT_key',ld);bpy.context.collection.objects.link(lo);lo.rotation_euler=(.45,-.38,-.5)
ld=bpy.data.lights.new('LGT_fill','POINT');ld.energy=1500;ld.shadow_soft_size=9;lo=bpy.data.objects.new('LGT_fill',ld);bpy.context.collection.objects.link(lo);lo.location=(4,-12,14)
cd=bpy.data.cameras.new('CAM_main');co=bpy.data.objects.new('CAM_main',cd);bpy.context.collection.objects.link(co);co.location=(26,-36,26);co.rotation_euler=(Vector((1,0,1.4))-co.location).to_track_quat('-Z','Y').to_euler();cd.type='ORTHO';cd.ortho_scale=35;scene.camera=co
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=840;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene['passport']='Five independent village landmarks, Blender -Y front, 8 opaque materials, runtime no helpers, no animation.'
normalize_normals();result=audit()
