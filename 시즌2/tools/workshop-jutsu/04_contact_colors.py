"""Hosted texture-free contact AO and visible forge flame; neutral vertex colors multiply PBR."""
import bpy,math,random,bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
random.seed(21)
# Small opaque sculpted flames are static forge art, not gameplay particles.
for i,(x,y,h,r) in enumerate([(-1.24,.34,.66,.15),(-.95,.51,1.05,.23),(-.53,.58,.72,.16),(-.85,.25,.51,.16)]):
 profile=[(r*.5,0,0),(r,.20*h,0),(r*.82,.49*h,.02),(r*.44,.74*h,-.04),(0,h,.08)]
 verts=[(x+rr*math.cos(j*math.pi/4)+dx,y+rr*.65*math.sin(j*math.pi/4),1.48+z) for rr,z,dx in profile for j in range(8)];faces=[]
 for k in range(len(profile)-1):
  for j in range(8):faces.append((k*8+j,k*8+(j+1)%8,(k+1)*8+(j+1)%8,(k+1)*8+j))
 faces.append(tuple(range(7,-1,-1)));me=bpy.data.meshes.new('forge_flame');me.from_pydata(verts,[],faces);me.materials.append(bpy.data.materials['canvas' if i%2 else 'tileLight']);ob=bpy.data.objects.new('HERO_forge_flame_%d'%i,me);bpy.context.collection.objects.link(ob)
# Build one world-space acceleration structure from evaluated hero geometry.
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();verts=[];faces=[]
heroes=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('HERO_')]
for o in heroes:
 eo=o.evaluated_get(deps);me=eo.to_mesh();off=len(verts);verts.extend(o.matrix_world@v.co for v in me.vertices);faces.extend(tuple(off+i for i in p.vertices) for p in me.polygons);eo.to_mesh_clear()
bvh=BVHTree.FromPolygons(verts,faces)
directions=[]
for k in range(12):
 z=(k+.5)/12;a=k*2.39996322973;r=(1-z*z)**.5;directions.append(Vector((r*math.cos(a),r*math.sin(a),z)))
lo=1;hi=0;samples=0
for o in heroes:
 me=o.data;attr=me.color_attributes.get('Color') or me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 me.color_attributes.active_color=attr
 normalmat=o.matrix_world.to_3x3().inverted().transposed();cache={};variation=.965+random.random()*.035
 for p in me.polygons:
  n=(normalmat@p.normal).normalized();u=n.cross(Vector((0,0,1)))
  if u.length<.05:u=n.cross(Vector((0,1,0)))
  u.normalize();v=n.cross(u)
  for li in p.loop_indices:
   vi=me.loops[li].vertex_index;key=(vi,tuple(round(t,2) for t in n))
   if key not in cache:
    point=o.matrix_world@me.vertices[vi].co+n*.055;occ=0
    for d in directions:
     direction=u*d.x+v*d.y+n*d.z;hit,hn,idx,dist=bvh.ray_cast(point,direction,2.15)
     if hit is not None:occ+=max(0,1-dist/2.15)
    ao=max(.48,1-.56*occ/len(directions))*variation
    if o.name.startswith(('HERO_ember','HERO_forge_flame','HERO_lantern_glass')):ao=1.0
    cache[key]=ao
   ao=cache[key];attr.data[li].color=(ao,ao,ao,1);lo=min(lo,ao);hi=max(hi,ao);samples+=1
 # Keep constant PBR colors portable; color attribute is consumed by glTF and game importer.
 o['contact_color']='12 hemisphere BVH rays, 2.15m reach, min48%; neutral linear AO'
for mat in bpy.data.materials:mat.use_backface_culling=True
bpy.context.scene['workshop_revision_note']='Rounded tiled eaves, hollow forge, side-window workshop, two canvas layers, baked vertex contact shadows'
result={'heroMeshes':len(heroes),'AOmin':lo,'AOmax':hi,'cornerColors':samples,'opaqueMaterials':len(bpy.data.materials),'textures':len(bpy.data.images)}
