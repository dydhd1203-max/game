"""Final geometry budget and portable neutral contact shading.
Only sub-pixel duplicated decoration is thinned; primary silhouettes stay unchanged.
BVH contact shadow is baked once, not computed by the game each frame.
"""
from mathutils.bvhtree import BVHTree
# Revision2 measured 86,602 triangles. Keep eight visible stave seams per barrel,
# and eleven pieces of produce per basket, without changing a basket or roof.
removed=[]
for o in list(bpy.data.objects):
 n=o.name
 seam=n.startswith('HERO_') and '_seam_' in n and 'canvas_' not in n and int(n.rsplit('_',1)[-1])%2==1
 produce=n.startswith('HERO_market_goods_') and n.endswith(('_11','_12'))
 if seam or produce:removed.append(n);bpy.data.objects.remove(o,do_unlink=True)
normalize_normals();bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
heroes=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('HERO_')]
verts=[];faces=[]
for o in heroes:
 eo=o.evaluated_get(deps);me=eo.to_mesh();off=len(verts);verts.extend(o.matrix_world@v.co for v in me.vertices);faces.extend(tuple(off+i for i in p.vertices) for p in me.polygons);eo.to_mesh_clear()
bvh=BVHTree.FromPolygons(verts,faces)
directions=[]
for k in range(12):
 z=(k+.5)/12;a=k*2.39996322973;r=math.sqrt(1-z*z);directions.append(Vector((r*math.cos(a),r*math.sin(a),z)))
lo=1.;hi=0.;corners=0
for o in heroes:
 me=o.data;attr=me.color_attributes.get('Color') or me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER');me.color_attributes.active_color=attr
 normalmat=o.matrix_world.to_3x3().inverted().transposed();cache={};variation=.97+random.random()*.03
 for p in me.polygons:
  n=(normalmat@p.normal).normalized();u=n.cross(Vector((0,0,1)))
  if u.length<.05:u=n.cross(Vector((0,1,0)))
  u.normalize();v=n.cross(u)
  for li in p.loop_indices:
   vi=me.loops[li].vertex_index;key=(vi,tuple(round(t,2) for t in n))
   if key not in cache:
    point=o.matrix_world@me.vertices[vi].co+n*.035;occ=0
    for d in directions:
     hit,hn,idx,dist=bvh.ray_cast(point,u*d.x+v*d.y+n*d.z,1.60)
     if hit is not None:occ+=max(0,1-dist/1.60)
    cache[key]=max(.50,1-.52*occ/len(directions))*variation
   ao=cache[key];attr.data[li].color=(ao,ao,ao,1);lo=min(lo,ao);hi=max(hi,ao);corners+=1
 o['contact_color']='12 hemisphere BVH rays,1.60m reach,neutral linear AO'
for m in bpy.data.materials:m.use_backface_culling=True
stats=audit();assert sum(v['triangles'] for v in stats.values())<=85000
result={'models':stats,'removedTinyDetails':len(removed),'contactMin':lo,'contactMax':hi,'cornerColors':corners,'materials':len(bpy.data.materials),'triangleTotal':sum(v['triangles'] for v in stats.values())}
