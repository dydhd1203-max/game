"""Hosted visual corrections and contact-color bake after two-angle review."""
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

# old coarse underlay hid the fine tiles. Replace with a matched curved shell.
bpy.data.objects.remove(bpy.data.objects['HERO_roof_thickness'],do_unlink=True)
profile=[(.04,7.67),(.16,7.40),(.30,7.07),(.48,6.73),(.66,6.42),(.84,6.16),(1.0,5.96),(1.0,5.78)]
v=[(-.65+3.16*r*math.cos(i*math.pi/24),.2+2.66*r*math.sin(i*math.pi/24),z-.04) for r,z in profile for i in range(48)]
f=[]
for j in range(len(profile)-1):
 for i in range(48):f.append((j*48+i,j*48+(i+1)%48,(j+1)*48+(i+1)%48,(j+1)*48+i))
f.append(tuple(range(47,-1,-1)));f.append(tuple((len(profile)-1)*48+i for i in range(48)))
mesh('HERO_roof_curved_underlay',v,f,'tile')
bpy.data.objects['HERO_roof_peak'].location.z-=.20
# side window panel: exact opening in the lower wall, framed recess rather than surface decal
bpy.data.objects.remove(bpy.data.objects['HERO_rightwall'],do_unlink=True)
box('HERO_right_wall_front',(1.75,-.67,1.95),(.40,.82,3.10),'plaster',.07)
box('HERO_right_wall_back',(1.75,1.63,1.95),(.40,.95,3.10),'plaster',.07)
box('HERO_right_wall_below',(1.75,.42,.94),(.40,1.42,1.15),'plaster',.055)
box('HERO_right_wall_above',(1.75,.42,3.15),(.40,1.42,.62),'plaster',.055)
box('HERO_side_window_dark',(1.58,.40,2.19),(.07,1.33,1.17),'iron',.04)
for y in [-.30,1.10]:box('HERO_side_window_jamb_'+str(y),(2.0,y,2.20),(.17,.14,1.36),'timber',.03)
for z in [1.50,2.90]:box('HERO_side_window_cross_'+str(z),(2.0,.40,z),(.2,1.55,.16),'timber',.03)
for y in [-.72,1.5]:
 o=box('HERO_side_shutter_'+str(y),(2.08,y,2.18),(.10,.58,1.19),'timber',.025);o.rotation_euler[2]=-.24 if y<0 else .24
 for z in [1.88,2.47]:box('HERO_shutter_strap_'+str(y)+str(z),(2.16,y,z),(.06,.54,.065),'iron',.01)
rod('HERO_side_window_bar',(2.01,.4,1.56),(2.01,.4,2.83),.04,'brass',6)
box('HERO_side_window_shelf',(2.17,.4,1.44),(.54,1.63,.16),'timber',.04)
# supporting diagonal braces and chunky sidewall masonry at ground level
for y in [-1.11,1.86]:
 rod('HERO_side_corner_post_'+str(y),(2.0,y,.52),(2.0,y,3.46),.115,'timber',8)
 rod('HERO_side_knee_'+str(y),(2.04,y,2.72),(2.04,y+(.55 if y<0 else -.55),3.48),.10,'timber',8)
for j in range(2):
 for i in range(6):box('HERO_side_stone_%d_%d'%(j,i),(1.99,-1.25+i*.56,.5+j*.35),(.42,.53,.31),'stone',.06)
# eaves' radial brackets separate upper plaster from the roof and reveal depth at eye level
for i in range(12):
 a=i*math.pi/6;x=-.65+2.52*math.cos(a);y=.2+2.08*math.sin(a)
 rod('HERO_eave_bracket_%02d'%i,(x,y,5.19),(x+.43*math.cos(a),y+.38*math.sin(a),5.65),.065,'timber',6)
# lower annex task shelf and crossed tools visible from the left flank
box('HERO_annex_shelf',(-3.71,.74,1.38),(1.42,.55,.15),'timber',.04)
for i in range(3):vessel('HERO_annex_pot_'+str(i),(-4.1+i*.37,.72,1.48),[(.09,0),(.14,.11),(.12,.31),(.06,.34)],'stone',10)
# warm grey stone fits the village palette, avoid concrete-like cool grey
M['stone'].diffuse_color=(.56,.50,.37,1)
M['stone'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.56,.50,.37,1)
for m in M.values():m.use_backface_culling=True
# Normalize only authored solid islands before contact sampling.
import bmesh
for o in bpy.data.objects:
 if o.name.startswith('HERO_') and o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.context.view_layer.update()
result={'corrections':['roof underlay follows tile profile','right wall genuine window opening','side shutters and stone courses','warm stone','radial eave brackets']}
