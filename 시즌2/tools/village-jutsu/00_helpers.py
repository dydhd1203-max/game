"""Shared authoring helpers, concatenated into hosted Blender operations.
Metres; Blender Z up/-Y front. Every landmark retains separate semantic parts.
Meshes are translated to a preview grid only; runtime packing removes those offsets.
"""
import bpy, math, random, bmesh
from mathutils import Vector
random.seed(83)
OFFSETS={'wagon':(-8,-5),'market':(2,-5),'assembly':(11,-4),'smithYard':(-5,5),'supplyYard':(5,5)}
K='wagon'
M={m.name:m for m in bpy.data.materials}
def landmark(k):
 global K
 K=k
def mesh(n,v,f,mat,smooth=False):
 ox,oy=OFFSETS[K];d=bpy.data.meshes.new(n)
 d.from_pydata([(x+ox,y+oy,z) for x,y,z in v],[],f);d.update()
 ob=bpy.data.objects.new('HERO_'+K+'_'+n,d);bpy.context.collection.objects.link(ob);d.materials.append(M[mat])
 ob['landmark']=K;ob['preview_offset']=[ox,oy,0]
 if smooth:
  for p in d.polygons:p.use_smooth=True
 return ob
def box(n,loc,sz,mat,bevel=.025):
 x,y,z=[s/2 for s in sz];cx,cy,cz=loc
 v=[(cx+a*x,cy+b*y,cz+c*z) for a,b,c in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 ob=mesh(n,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
 if bevel:
  mod=ob.modifiers.new('Hand finished edge','BEVEL');mod.width=bevel;mod.segments=1
  mod=ob.modifiers.new('Weighted planes','WEIGHTED_NORMAL');mod.keep_sharp=True
 return ob
def rod(n,a,b,r,mat,segments=10):
 a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,1,0)))
 if u.length<.01:u=axis.cross(Vector((1,0,0)))
 u.normalize();v=axis.cross(u)
 pts=[tuple(p+r*(u*math.cos(i*2*math.pi/segments)+v*math.sin(i*2*math.pi/segments))) for p in [a,b] for i in range(segments)]
 faces=[tuple(range(segments-1,-1,-1)),tuple(range(segments,2*segments))]+[(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
 return mesh(n,pts,faces,mat)
def pipe(n,path,r,mat,segments=8):
 # Continuous wood/rope/iron sweep, not disconnected cylinders.
 pts=[]
 for i,p in enumerate(path):
  p=Vector(p);a=Vector(path[max(0,i-1)]);b=Vector(path[min(len(path)-1,i+1)]);axis=(b-a).normalized();u=axis.cross(Vector((0,0,1)))
  if u.length<.01:u=axis.cross(Vector((0,1,0)))
  u.normalize();v=axis.cross(u)
  pts.extend(tuple(p+r*(u*math.cos(j*2*math.pi/segments)+v*math.sin(j*2*math.pi/segments))) for j in range(segments))
 faces=[]
 for i in range(len(path)-1):
  for j in range(segments):faces.append((i*segments+j,i*segments+(j+1)%segments,(i+1)*segments+(j+1)%segments,(i+1)*segments+j))
 faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(path)-1)*segments+j for j in range(segments))])
 return mesh(n,pts,faces,mat,True)
def vessel(n,loc,profile,mat,segments=16,smooth=True):
 x,y,z=loc;pts=[(x+r*math.cos(i*2*math.pi/segments),y+r*math.sin(i*2*math.pi/segments),z+h) for r,h in profile for i in range(segments)]
 faces=[]
 for j in range(len(profile)-1):
  for i in range(segments):faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
 faces.append(tuple(range(segments-1,-1,-1)))
 return mesh(n,pts,faces,mat,smooth)
def torus(n,loc,r,t,mat,axis='Z',segments=32,minor=8):
 x,y,z=loc;pts=[]
 for i in range(segments):
  a=i*2*math.pi/segments
  for j in range(minor):
   b=j*2*math.pi/minor;rr=r+t*math.cos(b);p=(rr*math.cos(a),rr*math.sin(a),t*math.sin(b))
   if axis=='X':p=(p[2],p[0],p[1])
   if axis=='Y':p=(p[0],p[2],p[1])
   pts.append((x+p[0],y+p[1],z+p[2]))
 faces=[(i*minor+j,((i+1)%segments)*minor+j,((i+1)%segments)*minor+(j+1)%minor,i*minor+(j+1)%minor) for i in range(segments) for j in range(minor)]
 return mesh(n,pts,faces,mat,True)
def surface(n,fn,nx,ny,mat,thickness=.045):
 pts=[fn(i/nx,j/ny) for j in range(ny+1) for i in range(nx+1)]
 faces=[(j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i+1,(j+1)*(nx+1)+i) for j in range(ny) for i in range(nx)]
 ob=mesh(n,pts,faces,mat,True);m=ob.modifiers.new('Physical material thickness','SOLIDIFY');m.thickness=thickness;return ob
def extrude(n,shape,y,depth,mat):
 nn=len(shape);pts=[(x,y+dy,z) for dy in [0,depth] for x,z in shape]
 return mesh(n,pts,[tuple(range(nn-1,-1,-1)),tuple(range(nn,2*nn))]+[(i,(i+1)%nn,(i+1)%nn+nn,i+nn) for i in range(nn)],mat)
def barrel(n,x,y,z,r=.4,h=.9):
 vessel(n+'_staves',(x,y,z),[(r*.78,0),(r*.94,h*.14),(r,h*.4),(r,h*.58),(r*.94,h*.85),(r*.78,h),(r*.71,h),(r*.71,h-.08)],'timber',20)
 for p in [.16,.78]:torus(n+'_hoop_'+str(p),(x,y,z+h*p),r*.97,.037,'iron',segments=24,minor=6)
 for i in range(16):
  a=i*2*math.pi/16;pipe(n+'_seam_'+str(i),[(x+rr*math.cos(a),y+rr*math.sin(a),z+hh) for rr,hh in [(r*.8,.03),(r*.95,.18*h),(r*1.007,.45*h),(r*.96,.8*h),(r*.8,.99*h)]],.009,'brass',4)
 for i in range(3):box(n+'_lid_'+str(i),(x+(i-1)*r*.42,y,z+h-.035),(r*.39,r*1.23,.065),'timber',.013)
def sack(n,x,y,z,r=.35,h=.8):
 vessel(n,(x,y,z),[(r*.50,0),(r*.87,h*.07),(r,h*.3),(r*.91,h*.57),(r*.62,h*.76),(r*.17,h*.86),(r*.32,h*.99),(r*.18,h)],'plaster',20)
 torus(n+'_rope',(x,y,z+h*.865),r*.20,.033,'timber',segments=16,minor=6)
def jar(n,x,y,z,r=.23,h=.5,mat='tileLight'):
 vessel(n,(x,y,z),[(r*.58,0),(r*.9,h*.12),(r,h*.42),(r*.84,h*.69),(r*.43,h*.84),(r*.47,h),(r*.36,h),(r*.33,h*.8)],mat,20)
def basket(n,x,y,z,r=.38,h=.4):
 vessel(n,(x,y,z),[(r*.65,0),(r*.78,h*.3),(r,h),(r*.91,h),(r*.69,h*.12)],'timber',20)
 for zz in [.16,.48,.80]:torus(n+'_weave_'+str(zz),(x,y,z+zz*h),r*(.7+.3*zz),.018,'plaster',segments=24,minor=4)
 torus(n+'_rim',(x,y,z+h),r*.96,.035,'plaster',segments=24,minor=6)
def fruit(n,x,y,z,r=.10,mat='tileLight'):
 vessel(n,(x,y,z-r),[(r*.1,0),(r*.74,r*.23),(r,r*.8),(r*.88,r*1.5),(r*.1,r*1.8)],mat,10)
def lantern(n,x,y,z):
 vessel(n+'_body',(x,y,z),[(.12,0),(.17,.09),(.17,.36),(.1,.42)],'brass',8)
 vessel(n+'_cap',(x,y,z+.38),[(.2,0),(.16,.10),(.065,.18)],'iron',8)
 torus(n+'_loop',(x,y,z+.64),.11,.025,'iron','Y',16,6)
 for dx,dy in [(-.115,-.115),(.115,-.115),(-.115,.115),(.115,.115)]:rod(n+'_frame_'+str(dx)+str(dy),(x+dx,y+dy,z),(x+dx,y+dy,z+.4),.018,'iron',6)
def normalize_normals():
 for o in bpy.data.objects:
  if o.type=='MESH' and o.name.startswith('HERO_'):
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
def audit():
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();out={}
 for key,(ox,oy) in OFFSETS.items():
  pts=[];tris=0;parts=0
  for ob in bpy.data.objects:
   if ob.type!='MESH' or not ob.name.startswith('HERO_'+key+'_'):continue
   eo=ob.evaluated_get(deps);d=eo.to_mesh();d.calc_loop_triangles();tris+=len(d.loop_triangles);parts+=1;pts.extend(ob.matrix_world@v.co-Vector((ox,oy,0)) for v in d.vertices);eo.to_mesh_clear()
  out[key]={'parts':parts,'triangles':tris,'radius':max(math.hypot(p.x,p.y) for p in pts),'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)]}
 return out
