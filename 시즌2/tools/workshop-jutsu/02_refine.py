"""Hosted refinement after coarse silhouette/depth visual check. All meshes remain editable."""
import bpy,math,random
from mathutils import Vector
random.seed(17)
M={m.name:m for m in bpy.data.materials}
def mesh(name,v,f,mat):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(M[mat]);return o
def box(name,loc,sz,mat,bevel=.035):
 x,y,z=[a/2 for a in sz];v=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)];f=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)];o=mesh(name,v,f,mat);o.location=loc
 if bevel:b=o.modifiers.new('Hand cut edge','BEVEL');b.width=bevel;b.segments=1;n=o.modifiers.new('Broad face normals','WEIGHTED_NORMAL');n.keep_sharp=True
 return o
def rod(name,a,b,r,mat,n=8):
 a,b=Vector(a),Vector(b);axis=b-a;u=axis.normalized().cross(Vector((0,1,0)))
 if u.length<.01:u=axis.normalized().cross(Vector((1,0,0)))
 u.normalize();w=axis.normalized().cross(u);v=[tuple(p+r*(math.cos(t*2*math.pi/n)*u+math.sin(t*2*math.pi/n)*w)) for p in [a,b] for t in range(n)];f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh(name,v,f,mat)
def band(name,cx,cy,z,rx,ry,width,depth,mat,n=36):
 v=[(cx+r[0]*math.cos(t*2*math.pi/n),cy+r[1]*math.sin(t*2*math.pi/n),z+dz) for dz in [-depth/2,depth/2] for r in [(rx,ry),(rx-width,ry-width)] for t in range(n)];f=[]
 for i in range(n):
  j=(i+1)%n;f.extend([(i,j,2*n+j,2*n+i),(n+j,n+i,3*n+i,3*n+j),(2*n+i,2*n+j,3*n+j,3*n+i),(j,i,n+i,n+j)])
 return mesh(name,v,f,mat)
def extrude(name,shape,y,depth,mat):
 n=len(shape);v=[(x,y+dy,z) for dy in [0,depth] for x,z in shape];f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];return mesh(name,v,f,mat)
def arch(name,cx,y,bottom,width,shoulder,rise,thick,depth,mat):
 path=[(cx-width/2,bottom),(cx-width/2,shoulder)]+[(cx+width/2*math.cos(math.pi-i*math.pi/12),shoulder+rise*math.sin(math.pi-i*math.pi/12)) for i in range(1,12)]+[(cx+width/2,shoulder),(cx+width/2,bottom)]
 out=[]
 for i,(x,z) in enumerate(path):
  if i<2:out.append((x-thick,z))
  elif i>=len(path)-2:out.append((x+thick,z))
  else:a=math.pi-(i-1)*math.pi/12;out.append((x+thick*math.cos(a),z+thick*math.sin(a)))
 return extrude(name,path+out[::-1],y,depth,mat)
def vessel(name,loc,profile,mat,n=12):
 x,y,z=loc;v=[(x+r*math.cos(i*2*math.pi/n),y+r*math.sin(i*2*math.pi/n),z+h) for r,h in profile for i in range(n)];f=[]
 for j in range(len(profile)-1):
  for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 f.append(tuple(range(n-1,-1,-1)));return mesh(name,v,f,mat)
# complete beam support around upper drum, softly rounded posts and braces
band('HERO_upper_sill',-.65,.2,3.57,2.64,2.17,.15,.24,'timber',12)
band('HERO_eave_soffit',-.65,.2,5.71,3.12,2.62,.65,.22,'timber')
band('HERO_eave_lip',-.65,.2,5.89,3.19,2.69,.12,.13,'tileLight')
for i in range(12):
 a=i*2*math.pi/12;x=-.65+2.56*math.cos(a);y=.2+2.10*math.sin(a)
 rod('HERO_upper_timber_%02d'%i,(x,y,3.55),(x,y,5.68),.11,'timber',8)
# sweep tiles along curved radial hips; geometry carries overlap and curved thickness
# remove coarse cap to avoid unsupported shape beneath tiles, retain its useful base
roof=bpy.data.objects['HERO_roof_thickness']
def roofz(r):return 5.96+1.86*(1-r)**1.30
for j in range(9):
 r0=.16+j*.095;r1=min(1.018,r0+.118);count=max(12,int(42*r1));step=2*math.pi/count
 for i in range(count):
  ac=(i+(j%2)*.5)*step;verts=[]
  for thick in [0,.075]:
   for ir in range(3):
    r=r0+(r1-r0)*ir/2
    for ia in range(4):
     a=ac-step*.485+step*.97*ia/3;wob=.025*math.sin(ia*math.pi/3)
     verts.append((-.65+3.16*r*math.cos(a),.2+2.66*r*math.sin(a),roofz(min(r,1))+.06+thick+wob))
  f=[]
  for k in [0,12]:
   for ir in range(2):
    for ia in range(3):
     ix=k+ir*4+ia;q=(ix,ix+1,ix+5,ix+4);f.append(q if k else q[::-1])
  boundary=[0,1,2,3,7,11,10,9,8,4]
  for k,ix in enumerate(boundary):nx=boundary[(k+1)%len(boundary)];f.append((ix,nx,nx+12,ix+12))
  mesh('HERO_roof_tile_%02d_%02d'%(j,i),verts,f,'tileLight' if (i+j)%5==0 else 'tile')
vessel('HERO_roof_peak',(-.65,.2,7.63),[(.55,0),(.55,.12),(.3,.25),(.20,.29)],'tileLight',16)
# annex tiled surface, true sloping thick roof supports
for y in [-1.7,1.25]:
 rod('HERO_annex_knee_'+str(y),(-4.25,y,2.65),(-3.55,y,3.28),.095,'timber')
for j in range(7):
 for i in range(5):
  x=-4.76+i*.4;y=-1.99+j*.57;z=3.42+(x+3.8)*.161+.20
  o=box('HERO_annex_tile_%02d_%02d'%(j,i),(x,y,z),(.445,.62,.11),'tileLight' if (i+j)%4==0 else 'tile',.045);o.rotation_euler[1]=-.16
# real curved facade beam with large open negative space
arch('HERO_forge_arch',-.65,-2.18,.55,4.06,2.45,.82,.23,.35,'timber')
for x in [-2.95,1.64]:
 box('HERO_post_stone_'+str(x),(x,-1.98,.64),(.64,.71,.72),'stone',.10)
 rod('HERO_front_knee_'+str(x),(x,-2,2.5),(x+(.58 if x<0 else -.58),-2,3.42),.12,'timber')
# foundation masonry courses plus shallow welcoming stair
for z in [.42,.79]:
 for i in range(9):
  x=-3.2+i*.58
  if x< -2.3 or x>1.1:box('HERO_foundation_block_%s_%s'%(z,i),(x,-2.06,z),(.55,.48,.33),'stone',.065)
for step in range(3):
 box('HERO_front_step_%d'%step,(-.65,-2.30-step*.23,.27-step*.07),(4.65-step*.16,.43,.20),'stone',.055)
# Signboard suspended with metal rings and relief anvil icon
for x in [-1.8,.55]:rod('HERO_sign_hanger_'+str(x),(x,-2.21,4.8),(x,-2.34,4.45),.046,'iron')
for i in range(3):box('HERO_sign_plank_%d'%i,(-.62,-2.34,3.82+i*.27),(3.2,.19,.25),'canvas',.055)
for x in [-2.19,.95]:box('HERO_sign_rim_'+str(x),(x,-2.46,4.10),(.13,.1,.91),'timber',.025)
anvil=[(-1.44,4.39),(.15,4.39),(.02,4.16),(-.35,4.06),(-.48,3.91),(-.23,3.84),(-1.05,3.84),(-.81,3.97),(-.95,4.19),(-1.40,4.23)]
extrude('HERO_sign_anvil_icon',anvil,-2.49,.05,'iron')
# windows on front-left and right faces; deep recess color with arched board shutters
for idx,(cx,cy) in enumerate([(-2.10,-1.52),(.83,-1.50)]):
 shape=[(cx-.42,4.44),(cx-.42,5.11)]+[(cx+.42*math.cos(math.pi-t*math.pi/8),5.11+.4*math.sin(math.pi-t*math.pi/8)) for t in range(9)]+[(cx+.42,4.44)]
 extrude('HERO_window_recess_%d'%idx,shape,cy-.02,.05,'iron');arch('HERO_window_arch_%d'%idx,cx,cy-.1,4.43,.88,5.11,.42,.095,.12,'timber')
 for side in [-1,1]:box('HERO_shutter_%d_%d'%(idx,side),(cx+side*.54,cy-.1,4.92),(.20,.11,.83),'timber',.025)
 box('HERO_window_sill_%d'%idx,(cx,cy-.19,4.40),(1.08,.4,.15),'timber',.04)
 rod('HERO_window_mullion_%d'%idx,(cx,cy-.12,4.48),(cx,cy-.12,5.48),.032,'brass')
# side opening underneath a two-piece sagging golden canvas; cloth surface with real edge
for k,(xa,xb,ya,yb,za,zb) in enumerate([(1.3,4.35,-1.6,-2.6,3.57,2.94),(1.6,4.30,.65,-.9,3.57,3.0)]):
 v=[];nx=12;ny=6
 for j in range(ny+1):
  t=j/ny
  for i in range(nx+1):
   u=i/nx;v.append((xa+(xb-xa)*u,ya+(yb-ya)*t,za+(zb-za)*t-.20*math.sin(math.pi*u)*math.sin(math.pi*t)+.035*math.sin(u*math.pi*6)))
 f=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
 o=mesh('HERO_canvas_layer_%d'%k,v,f,'canvas');m=o.modifiers.new('Visible fabric thickness','SOLIDIFY');m.thickness=.04
 for x in [xa,xb]:rod('HERO_canvas_rope_%d_%s'%(k,x),(x,ya,za),(x,yb,zb),.035,'timber',6)
 for i in range(nx):
  x=xa+(xb-xa)*(i+.5)/nx;shape=[(x-.125,zb),(x+.125,zb),(x+.12,zb-.16),(x+.075,zb-.22),(x-.075,zb-.22),(x-.12,zb-.16)];extrude('HERO_canvas_scallop_%d_%d'%(k,i),shape,yb,.04,'canvas')
for x,y,z in [(4.35,-2.55,3.05),(4.3,-.9,3.15),(1.7,-2.5,3.1)]:
 rod('HERO_awning_post_%s_%s'%(x,y),(x,y,.14),(x,y,z),.11,'timber');box('HERO_awning_foot_%s'%y,(x,y,.22),(.38,.38,.4),'stone',.055)
# Side workbench fully furnished
for i in range(4):box('HERO_side_bench_plank_%d'%i,(3.12,-1.29+i*.16,1.16),(2.04,.148,.15),'timber',.025)
for x in [2.36,3.88]:
 for y in [-1.28,-.81]:rod('HERO_side_bench_leg_%s_%s'%(x,y),(x,y,.15),(x,y,1.1),.09,'timber')
box('HERO_side_bench_crossbar',(3.12,-1.06,.42),(1.8,.18,.16),'timber',.025)
# forge recess: hood, hearth, visible orange ember tessellation; bevel-faced anvil
bpy.data.objects.remove(bpy.data.objects['HERO_forge_back'],do_unlink=True)
box('HERO_hearth_plinth',(-.90,.75,.81),(1.55,1.15,1.02),'stone',.10)
box('HERO_hearth_dark',(-.90,.65,1.36),(1.31,.85,.10),'iron',.04)
for x in [-1.62,-.17]:box('HERO_forge_jamb_'+str(x),(x,.95,1.9),(.32,.75,1.48),'stone',.06)
arch('HERO_forge_hood',-.9,.53,1.57,1.14,2.15,.48,.22,.7,'stone')
for i in range(9):
 x=-1.42+(i%3)*.43;y=.31+(i//3)*.26
 o=box('HERO_ember_%d'%i,(x,y,1.49+random.random()*.07),(.30,.19,.16),'brass' if i%2 else 'tileLight',.07);o.rotation_euler[2]=random.uniform(-.4,.4)
extrude('HERO_anvil_iron',[(-.70,.88),(.03,.88),(-.07,1.03),(-.22,1.15),(-.10,1.37),(.48,1.44),(.63,1.64),(-.9,1.64),(-.83,1.43),(-.4,1.33),(-.47,1.09)],-2.02,.42,'iron')
box('HERO_anvil_stump',(-.18,-1.82,.59),(.83,.74,.68),'timber',.09)
# shelves and hand tools visible deep inside the hollow bay
for z in [1.45,2.08,2.72]:
 box('HERO_wall_shelf_'+str(z),(.89,.42,z),(1.18,.49,.10),'timber',.025)
 for i in range(3):vessel('HERO_shelf_jar_%s_%d'%(z,i),(.44+i*.39,.36,z+.06),[(.10,0),(.15,.08),(.13,.29),(.07,.36),(.08,.38)],'brass' if i==1 else 'stone',10)
for i in range(5):
 x=-2.38+i*.27;rod('HERO_hung_handle_%d'%i,(x,1.7,1.55),(x,1.7,2.12),.034,'timber',6)
 o=box('HERO_hung_hammer_%d'%i,(x,1.67,2.18),(.25,.11,.12),'iron',.02);o.rotation_euler[1]=.2*(i%2)
for i in range(3):
 x=2.55+i*.50;vessel('HERO_bench_pot_%d'%i,(x,-1.1,1.26),[(.13,0),(.19,.10),(.18,.28),(.11,.40),(.12,.44)],'stone' if i%2 else 'brass',12)
rod('HERO_bench_hammer_handle',(2.6,-1.36,1.28),(3.25,-1.36,1.28),.041,'timber',8);box('HERO_bench_hammer_head',(3.3,-1.36,1.30),(.15,.32,.17),'iron',.03)
# coopering detail, wrapped staves and hoops
for bi,(x,y,r,h) in enumerate([(-3.65,-1.83,.4,.95),(3.47,.0,.44,1.0),(2.55,.50,.31,.7)]):
 vessel('HERO_barrel_%d'%bi,(x,y,.14),[(r*.8,0),(r,.22*h),(r*1.06,.5*h),(r,.8*h),(r*.8,h)],'timber',14)
 for hz in [.20,.78]:band('HERO_barrel_hoop_%d_%s'%(bi,hz),x,y,.14+h*hz,r*1.03,r*1.03,.04,.075,'iron',14)
 box('HERO_barrel_lid_%d'%bi,(x,y,.14+h),(.52*r*2,.55*r*2,.06),'timber',.025)
 for i in range(12):
  a=i*math.pi/6;rod('HERO_barrel_seam_%d_%d'%(bi,i),(x+r*.84*math.cos(a),y+r*.84*math.sin(a),.2),(x+r*math.cos(a),y+r*math.sin(a),.14+h*.75),.012,'brass',4)
# pair of small lanterns, warm solid glass with real metal frames
for li,(x,y,z) in enumerate([(-2.85,-2.36,2.46),(4.32,-2.62,2.55)]):
 rod('HERO_lantern_hook_%d'%li,(x,y+.17,z+.6),(x,y,z+.5),.03,'iron',6)
 vessel('HERO_lantern_glass_%d'%li,(x,y,z),[(.13,0),(.18,.12),(.17,.41),(.09,.48)],'brass',8)
 vessel('HERO_lantern_cap_%d'%li,(x,y,z+.44),[(.22,0),(.19,.08),(.08,.20)],'iron',8)
 for dx,dy in [(-.12,-.12),(.12,-.12),(-.12,.12),(.12,.12)]:rod('HERO_lantern_frame_%d_%s_%s'%(li,dx,dy),(x+dx,y+dy,z),(x+dx,y+dy,z+.47),.022,'iron',5)
# Chimney has offset clay-brick rows and a hollow capped mouth
for z in [5.62,6.2,6.8,7.4,8.0]:
 for x in [-1.62,-1.1]:box('HERO_chimney_brick_%s_%s'%(z,x),(x,.72,z),(.47,.12,.25),'tileLight',.04)
box('HERO_chimney_mouth',(-1.2,1.25,8.708),(.83,.83,.03),'iron',.06)
# Geometry audit; semantic editability retained, materials and helper roles explicit
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();tris=0;pts=[]
for o in bpy.data.objects:
 if o.name.startswith('HERO_') and o.type=='MESH':
  eo=o.evaluated_get(deps);me=eo.to_mesh();me.calc_loop_triangles();tris+=len(me.loop_triangles);pts.extend(o.matrix_world@v.co for v in me.vertices);eo.to_mesh_clear()
result={'heroParts':sum(o.name.startswith('HERO_') for o in bpy.data.objects),'triangles':tris,'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)],'radius':max((p.x*p.x+p.y*p.y)**.5 for p in pts),'materials':len(M)}
for m in M.values():m.use_backface_culling=True
# Preserve broad faces and consistently outward normal islands at export.
import bmesh
for o in bpy.data.objects:
 if o.name.startswith('HERO_') and o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
