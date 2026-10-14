"""Pack exact hosted GLB into five local-origin static game assets.
blender -b --python 05_export_runtime.py -- downloaded.glb assets-dir revision
No simplification. Semantic source remains editable in the hosted project.
"""
import bpy,sys,json,math,struct,hashlib
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source,outdir,revision=args[:3];outdir=Path(outdir);outdir.mkdir(parents=True,exist_ok=True)
OFFSETS={'wagon':(-8,-5),'market':(2,-5),'assembly':(11,-4),'smithYard':(-5,5),'supplyYard':(5,5)}
LIMITS={'wagon':(4.9,6.4,26000),'market':(4.5,4.9,22000),'assembly':(4.4,4,20000),'smithYard':(3.3,4.1,18000),'supplyYard':(3.2,3.9,18000)}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=source)
manifest={'name':'새벽 작업장 마을 — 생활 건물 다섯 채','source':'New hosted Higgsfield 3D Jutsu procedural scene, not a duplicate of the accepted workshop','projectId':'9874ebe5-dc9e-4c9c-b1dc-4ac21261971a','projectUrl':'https://higgsfield.ai/3d-jutsu/9874ebe5-dc9e-4c9c-b1dc-4ac21261971a','revision':int(revision),'operations':['village-01-distinct-landmark-shells','village-02-craft-and-stocked-interiors','village-03-portable-contact-shading','village-04-wagon-contact-fix','village-05-physical-hanging-supports'],'hostedExport':{'bytes':Path(source).stat().st_size,'sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest()},'models':{},'renderContract':{'opaque':True,'doubleSided':False,'sharedMaterialLimit':8,'textures':0,'animations':0,'lights':0,'cameras':0,'contactAttribute':'COLOR_0','up':'+Y','front':'+Z','groundY':0},'packing':'Only static HERO meshes joined by shared material; preview-grid offsets removed; authored AO promoted from hosted COLOR_1 to runtime COLOR_0. No runtime lighting/cameras or scene floor.'}
for key,(ox,oy) in OFFSETS.items():
 heroes=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('HERO_'+key+'_')];original_count=len(heroes);buckets={}
 for ob in heroes:
  mat=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=mat;assert len(ob.data.materials)==1,ob.name;buckets.setdefault(ob.data.materials[0].name,[]).append(ob)
 packed=[]
 for material,objects in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for ob in objects:ob.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name='HERO_'+key+'_batch_'+material
  ob.location-=Vector((ox,oy,0));bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR',center='MEDIAN');ob.data.materials[0].use_backface_culling=True;packed.append(ob)
 pts=[];triangles=0
 for ob in packed:ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles);pts.extend(ob.matrix_world@v.co for v in ob.data.vertices)
 radius=max(math.hypot(p.x,p.y) for p in pts);bounds={'min':[min(p.x for p in pts),min(p.z for p in pts),min(-p.y for p in pts)],'max':[max(p.x for p in pts),max(p.z for p in pts),max(-p.y for p in pts)],'xzRadius':radius}
 maxradius,maxheight,maxtris=LIMITS[key];assert radius<=maxradius and bounds['max'][1]<=maxheight and bounds['min'][1]>=-.05;assert triangles<=maxtris,(key,triangles)
 bpy.ops.object.select_all(action='DESELECT')
 for ob in packed:ob.select_set(True)
 path=outdir/('village-'+key+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
 data=path.read_bytes();json_len=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+json_len]);binary=data[28+json_len:];contact=[];normalerror=0;vertices=0
 def read_accessor(aid):
  a=doc['accessors'][aid];v=doc['bufferViews'][a['bufferView']];fmt,size,denom={5121:('B',1,255),5123:('H',2,65535),5126:('f',4,1)}[a['componentType']];width={'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',size*width);start=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [tuple(c/(denom if a.get('normalized') else 1) for c in struct.unpack_from('<'+fmt*width,binary,start+i*stride)) for i in range(a['count'])]
 for m in doc['meshes']:
  for p in m['primitives']:
   attrs=p['attributes'];assert 'COLOR_1' in attrs,'Hosted authored contact attribute missing';attrs['COLOR_0']=attrs.pop('COLOR_1');contact.extend(c[0] for c in read_accessor(attrs['COLOR_0']));normals=read_accessor(attrs['NORMAL']);vertices+=len(normals);normalerror=max(normalerror,max(abs(math.sqrt(sum(x*x for x in n))-1) for n in normals))
 assert 0<min(contact)<.9 and max(contact)<=1;assert normalerror<.00001
 assert not doc.get('textures') and not doc.get('images') and not doc.get('animations') and not doc.get('cameras')
 for mat in doc['materials']:assert not mat.get('doubleSided') and mat.get('alphaMode','OPAQUE')=='OPAQUE'
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
 manifest['models'][key]={'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceEditableMeshes':original_count,'runtimeMeshes':len(packed),'materials':[m['name'] for m in doc['materials']],'triangles':triangles,'vertices':vertices,'gameCoordinates':bounds,'contactMin':min(contact),'contactMax':max(contact),'maxNormalLengthError':normalerror}
manifest['triangleTotal']=sum(v['triangles'] for v in manifest['models'].values());assert manifest['triangleTotal']<=85000
(outdir/'village-buildings.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest,ensure_ascii=False))
