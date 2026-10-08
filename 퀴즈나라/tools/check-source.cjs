const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=require('./deployment-files.cjs');
require('./build-avatar-file-data.cjs')(true);
require('./build-map-library.cjs').build(true);
for(const file of files){
  assert(fs.statSync(path.join(root,file)).isFile(),'Required quiz file is missing: '+file);
}
// A stylesheet can load correctly while its local artwork is absent from the
// release folder. Include every concrete local url() dependency in the list.
const runtimeFiles=new Set(files.map(file=>file.split(path.sep).join('/')));
for(const file of files.filter(file=>file.endsWith('.css'))){
  const css=fs.readFileSync(path.join(root,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  for(const match of css.matchAll(/url\(\s*['"]?([^'"()\s]+)['"]?\s*\)/gi)){
    // Decode first: an encoded fragment such as url(%23n) inside a data URI
    // is an SVG reference, not a file.
    const url=decodeURIComponent(match[1]);if(/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url))continue;
    const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),decodeURIComponent(url.split(/[?#]/)[0])));
    assert(runtimeFiles.has(dependency),'Stylesheet artwork missing from deployment-files.cjs: '+file+' → '+dependency);
  }
}
const libraries=require('./build-map-library.cjs').definitions.map(([id])=>'assets/'+id+'-library');
for(const entry of ['index.html','assets/library/index.html',...libraries.map(folder=>folder+'/index.html')]){
  const html=fs.readFileSync(path.join(root,entry),'utf8');
  let count=0;
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!/\bsrc\s*=/.test(match[1])){new vm.Script(match[2],{filename:entry+':inline'+(++count)});}
  }
  console.log(entry+': '+count+' inline scripts parse successfully');
}
for(const file of files.filter(file=>file.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
for(const file of ['assets/library/catalog-data.js',...libraries.map(folder=>folder+'/catalog-data.js')])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
console.log('Avatar and isolated preview scripts parse successfully');
console.log('Quiz folder contains all '+files.length+' required runtime, artwork, font and hosting files');
