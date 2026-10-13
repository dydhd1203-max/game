"""Portable asset packing, run locally on a downloaded exact hosted GLB revision.
blender -b --python 05_export_runtime.py -- downloaded.glb output.glb
Only joins static HERO meshes by shared material; keeps authored geometry and COLOR_0.
The original semantic scene remains editable in the hosted 3D Jutsu project.
"""
import bpy,sys,json,math,struct
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,out=args[:2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
heroes=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('HERO_')]
original_count=len(heroes)
for o in list(bpy.data.objects):
 if o not in heroes:bpy.data.objects.remove(o,do_unlink=True)
for o in heroes:
 mat=o.matrix_world.copy();o.parent=None;o.matrix_world=mat
buckets={}
for o in heroes:
 assert len(o.data.materials)==1,o.name
 buckets.setdefault(o.data.materials[0].name,[]).append(o)
for material,objects in buckets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name='HERO_batch_'+material
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 bpy.ops.object.origin_set(type='ORIGIN_CURSOR',center='MEDIAN')
 ob.data.materials[0].use_backface_culling=True
pts=[];triangles=0
for o in bpy.data.objects:
 if o.type=='MESH':
  o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles);pts.extend(o.matrix_world@v.co for v in o.data.vertices)
assert triangles<=45000,triangles
assert max((p.x*p.x+p.y*p.y)**.5 for p in pts)<=5.7
assert min(p.z for p in pts)>=-.05 and max(p.z for p in pts)<=9.8
# GLB exporter converts once from Blender Z-up to game Y-up, -Y to +Z front.
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=False,export_yup=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
# The hosted exporter reserves COLOR_0 for its white material input and exports
# the authored contact attribute as COLOR_1. Promote that attribute explicitly:
# the game and standard glTF viewers multiply baseColorFactor by COLOR_0 only.
data=Path(out).read_bytes();json_len=struct.unpack_from('<I',data,12)[0]
document=json.loads(data[20:20+json_len]);binary=data[28+json_len:]
contact_values=[]
for mesh in document['meshes']:
 for primitive in mesh['primitives']:
  attrs=primitive['attributes'];assert 'COLOR_1' in attrs,'Authored contact attribute missing'
  attrs['COLOR_0']=attrs.pop('COLOR_1')
  a=document['accessors'][attrs['COLOR_0']];v=document['bufferViews'][a['bufferView']]
  fmt,size,denom={5121:('B',1,255),5123:('H',2,65535),5126:('f',4,1)}[a['componentType']]
  width={'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',size*width)
  start=v.get('byteOffset',0)+a.get('byteOffset',0)
  for i in range(a['count']):
   contact_values.extend(c/(denom if a.get('normalized') else 1) for c in struct.unpack_from('<'+fmt*3,binary,start+i*stride))
assert 0<min(contact_values)<.9 and max(contact_values)<=1,'Contact shading must survive export'
encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
Path(out).write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
print(json.dumps({'contactMin':min(contact_values),'contactMax':max(contact_values)}))
print(json.dumps({'sourceSemanticMeshes':original_count,'gameMeshes':len(buckets),'triangles':triangles,'radius':max((p.x*p.x+p.y*p.y)**.5 for p in pts),'blenderMin':[min(p[i] for p in pts) for i in range(3)],'blenderMax':[max(p[i] for p in pts) for i in range(3)]}))
