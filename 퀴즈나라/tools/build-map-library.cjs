'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assets=path.resolve(__dirname,'../assets'),hub=path.join(assets,'library');
const definitions=[
  ['map','맵·환경','QPMapLibraryCatalog'],
  ['grass','풀·꽃·지형','QPGrassCatalog'],
  ['house','집·건물','QPHouseCatalog'],
  ['interface','기본 인터페이스','QPInterfaceLibraryCatalog'],
  ['button','버튼','QPButtonCatalog'],
  ['icon','아이콘','QPIconCatalog'],
  ['frame','창 테두리','QPFrameCatalog']
];
function generated(target,name,value,check){
  const data='/* Generated from catalog.json; original image files remain unchanged. */\nwindow.'+name+' = '+JSON.stringify(value,null,2).replace(/</g,'\\u003c')+';\n';
  if(check){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==data)throw new Error('Library preview is stale: run node tools/build-map-library.cjs ('+path.relative(assets,target)+')');}
  else fs.writeFileSync(target,data);
}
function verifyOriginal(folder,entry){
  if(!entry.imagePath||!entry.sha256)return;
  const file=path.resolve(folder,entry.imagePath);
  if(!file.startsWith(assets+path.sep))throw new Error('Library path leaves assets: '+entry.imagePath);
  const bytes=fs.readFileSync(file);
  if(entry.byteLength!==undefined&&bytes.length!==entry.byteLength)throw new Error('Original size mismatch: '+file);
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('Original hash mismatch: '+file);
}
function build(check=false){
  const libraries=[],entries=[],hashes=new Set();
  let originalEntries=0,storedImages=0;
  for(const [id,label,defaultVariable] of definitions){
    const folder=path.join(assets,id+'-library'),source=path.join(folder,'catalog.json');
    if(!fs.existsSync(source))continue;
    const catalog=JSON.parse(fs.readFileSync(source,'utf8'));
    const target=path.join(folder,'catalog-data.js');
    const assignment=fs.existsSync(target)&&fs.readFileSync(target,'utf8').match(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/);
    generated(target,assignment?assignment[1]:defaultVariable,catalog,check);
    const originals=catalog.referenceSheets||catalog.referenceScreens||[];
    for(const entry of originals){verifyOriginal(folder,entry);if(entry.sha256)hashes.add(entry.sha256);}
    if(catalog.archive?.imagePath)verifyOriginal(folder,catalog.archive);
    const count=catalog.archive?.regularImageFiles??originals.length;
    originalEntries+=count;storedImages+=originals.length;
    libraries.push({id,label,indexPath:'../'+id+'-library/index.html',originalName:catalog.archive?.originalName||label,sourceCount:count,storedCount:originals.length});
    for(const [origin,items] of [['user',originals],['project',catalog.projectAssets||[]]])for(const entry of items){
      entries.push({...entry,id:id+'/'+entry.id,library:id,libraryLabel:label,origin,
        imagePath:entry.imagePath?path.relative(hub,path.resolve(folder,entry.imagePath)).split(path.sep).join('/'):null,
        archivePath:catalog.archive?.imagePath?'../'+id+'-library/'+catalog.archive.imagePath:null});
    }
  }
  const catalog={schemaVersion:1,title:'퀴즈나라 전체 소재 보관함',status:{archives:libraries.length,originalEntries,storedImages,uniqueOriginalImages:hashes.size},libraries,entries};
  if(fs.existsSync(hub))generated(path.join(hub,'catalog-data.js'),'QPAssetLibraryCatalog',catalog,check);
  return {...catalog.status,entries:entries.length};
}
if(require.main===module)console.log(JSON.stringify(build(process.argv.includes('--check'))));
module.exports={build,definitions};
