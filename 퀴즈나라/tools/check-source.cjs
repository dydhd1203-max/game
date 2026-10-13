const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=require('./deployment-files.cjs');
require('./build-avatar-file-data.cjs')(true);
require('./build-map-library.cjs').build(true);
// Garment records (stage 3): every record valid against tools/garment/schema.json
// (with the frozen body), the index fresh; their file:// bundles are checked above.
require('./garment/build-index.cjs')(true);
// The frozen reference body (tools/garment/frozen/frozen-body.json, written by
// make-frozen.py; full check: python3 tools/garment/verify-body-freeze.py):
// body art, legacy basic layers, clean art and frozen artifacts byte-equal,
// and SPEC/SPEC_F as recorded. A change needs --allow-body-change and the user's approval.
{
  const crypto=require('node:crypto'),frozen=JSON.parse(fs.readFileSync(path.join(root,'tools/garment/frozen/frozen-body.json'),'utf8'));
  for(const group of ['files','legacyBasic','artifacts'])for(const [file,sha] of Object.entries(frozen[group]))
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),sha,'Frozen body changed: '+file+' (tools/garment/frozen/frozen-body.json '+group+')');
  const api=require('../avatar-foundation.js');
  for(const [name,sex] of [['SPEC','m'],['SPEC_F','f']])assert.deepEqual(JSON.parse(JSON.stringify(api.specFor(sex))),frozen.spec[name],'Frozen body changed: avatar-foundation.js '+name);
  // The clean neck's rects at runtime (avatar-foundation-skin.js CLEAN_NECK) are the frozen ones.
  const zones=JSON.parse(fs.readFileSync(path.join(root,'tools/garment/frozen/zones.json'),'utf8')),skin=fs.readFileSync(path.join(root,'avatar-foundation-skin.js'),'utf8');
  const literal=skin.match(/const CLEAN_NECK=(\{[^;]*\});/);assert(literal,'avatar-foundation-skin.js CLEAN_NECK not found');
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext('('+literal[1]+')'))),zones.clean.neckRects,'avatar-foundation-skin.js CLEAN_NECK differs from tools/garment/frozen/zones.json clean.neckRects');
  console.log('Frozen reference body: '+Object.keys({...frozen.files,...frozen.legacyBasic,...frozen.artifacts}).length+' files and SPEC/SPEC_F unchanged; clean neck rects match');
}
// Foundation CSS and the keyframes foundation scripts write use only the qpf-
// prefix, so they can never restyle or re-time the students' avatar (qpx-);
// tools/verify-student-avatar-unchanged.cjs checks the full rule.
for(const file of fs.readdirSync(root).filter(f=>/^avatar-foundation[^/]*\.(css|js)$/.test(f))){
  const text=fs.readFileSync(path.join(root,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  for(const m of text.matchAll(/@keyframes\s+([\w-]+)/g))assert(m[1].startsWith('qpf-'),file+': @keyframes '+m[1]+' must use the qpf- prefix');
  if(file.endsWith('.css'))for(const m of text.matchAll(/(?:^|[\s,}>+~(])\.(-?[_a-zA-Z][\w-]*)/g))assert(/^(qpf-|qp-foundation-avatar$|qpx-head$|qpx-back-hair$)/.test(m[1]),file+': class .'+m[1]+' must use the qpf- prefix');
}
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
