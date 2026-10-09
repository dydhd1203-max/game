'use strict';
/* Garment records ↔ shop catalogue (stage 3, WP2). Headless, ?demo=1 only,
   Firebase stubbed and every remote host blocked; nothing is written to a
   database or to the served tree.

     node tools/verify-garment-catalog.cjs                 own static server on a free port
     node tools/verify-garment-catalog.cjs --url http://127.0.0.1:4193/
     node tools/verify-garment-catalog.cjs --runtime-loaded   from WP3 on: index.html may load the garment files
     node tools/verify-garment-catalog.cjs --self-test     + negative controls (mutated catalogue inputs, a 1 px
                                                            atlas shift, a page that loads the garment index)

   Static (node):
     - every record validates (tools/garment/schema.cjs, frozen-body context, atlas files) and the
       index is fresh (tools/garment/build-index.cjs --check); pack-basic.py --check;
     - every packed region decodes RGBA-equal to the full legacy layer at the same rect (node PNG
       decoder, independent of the Python packer), gutters empty, PNG chunks IHDR/IDAT/IEND only;
     - until WP3: no runtime file (deployment list) names a garment file.
   Browser (?demo=1):
     - the demo page and the ?avatar=foundation page request no sd-garment-, sd-garments-index or garment bundle file;
     - each catalogue key (sex, cat, shape) is on that sex's shelf (publicItems), and the record's
       item, ci, name and colour equal QPGame.getCatalog().curatedItem(cat,shape,sex) for BOTH sexes;
       the record's display colour equals curatedItem.color for girls and, for boys,
       QPClothes.colorFor(cat,shape,'m',color) and QPClothes.maleColors (male cross-check);
     - the starter mapping: free (price 0, owned through STARTER) and on the shelf;
     - loading the index and all data files at once (and twice, and with a runtime define() hook)
       fills window.QPFoundationGarmentRecords with one key per record, deep-equal to node's read;
     - each region drawn from the atlas through QPAvatarImage (the runtime crop path) equals the same
       rect drawn from the full layer, and the sheet rebuilt from the atlases equals the sheet
       composited from the legacy layers (saved for viewing).
   Output: 검증/옷/목록/ (report.json, rebuilt-sheet.png). */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const H=require('./verify-harness.cjs'),S=require('./garment/schema.cjs'),buildIndex=require('./garment/build-index.cjs');
const root=path.resolve(__dirname,'..'),argv=H.args(),out=path.resolve(argv.out||process.env.QUIZ_VERIFICATION_OUTPUT||path.join(root,'검증','옷','목록'));
const GARMENT_URL=/\/assets\/(sd-garment-|sd-garments-index|avatar-file-data-garment-)/;
const LAYER={shirt:'assets/sd-foundation-ref-shirt.png',sleeves:'assets/sd-foundation-ref-sleeves.png',shorts:'assets/sd-foundation-ref-shorts.png',shoes:'assets/sd-foundation-ref-shoes.png'};
const checks=[],report={checks,coverage:{},blocked:[],errors:[]};
const ok=(label,detail)=>{checks.push(detail?label+': '+detail:label);console.log('  ok   '+label+(detail?': '+detail:''));};

// Every atlas region of a record as {sex, view, part, layer, rect, at}.
function regions(r){
  const list=[];
  for(const [sex,S_] of Object.entries(r.sexes))for(const view of ['front','right','back']){const F=S_.figures[view];
    if(F.top){list.push({sex,view,part:'torso',layer:'shirt',rect:F.top.torso.rect,at:F.top.torso.at});F.top.sleeves.forEach((s,i)=>list.push({sex,view,part:'sleeve'+i,layer:'sleeves',rect:s.rect,at:s.at}));}
    if(F.bottom)list.push({sex,view,part:'bottom',layer:'shorts',rect:F.bottom.rect,at:F.bottom.at});
    if(F.shoes)F.shoes.forEach((s,i)=>list.push({sex,view,part:'shoe'+i,layer:'shoes',rect:s.rect,at:s.at}));}
  return list;
}

function staticChecks(){
  const index=buildIndex(true);ok('index fresh and every record valid','tools/garment/build-index.cjs --check');
  const records=Object.fromEntries(Object.entries(index.records).map(([id,e])=>[id,S.readDataFile(path.join(root,e.files.data)).record]));
  const context=S.loadContext(root);
  for(const r of Object.values(records)){assert.deepEqual(S.validate(r,{context,root,builder:false}),[],r.id);}
  ok('schema + semantic checks',Object.keys(records).join(', ')+' (LEGACY, SEAT, CUFF, BOX, ANCHOR, ATLAS, ATLAS_FILE …)');
  const py=execFileSync('python3',['tools/garment/pack-basic.py','--check'],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}).toString().trim().split('\n').pop();
  ok('pack-basic.py --check',py);
  // Lossless, decoded in node.
  const layers=Object.fromEntries(Object.entries(LAYER).map(([k,f])=>[k,H.png.decode(fs.readFileSync(path.join(root,f)))]));
  let n=0;
  for(const r of Object.values(records)){
    for(const [sex,entry] of Object.entries(r.sexes)){
      const buf=fs.readFileSync(path.join(root,entry.atlas)),info=S.pngInfo(buf);
      assert(S.chunksOk(info),entry.atlas+' chunks '+info?.chunks);
      const atlas=H.png.decode(buf),used=new Uint8Array(atlas.width*atlas.height);
      for(const g of regions(r).filter(g=>g.sex===sex)){
        const a=H.png.crop(atlas,g.at[0],g.at[1],g.rect[2],g.rect[3]).data,b=H.png.crop(layers[g.layer],...g.rect).data;
        assert(a.equals(b),r.id+' '+sex+' '+g.view+' '+g.part+': atlas crop differs from '+LAYER[g.layer]+' at '+g.rect);n++;
        for(let y=g.at[1];y<g.at[1]+g.rect[3];y++)used.fill(1,y*atlas.width+g.at[0],y*atlas.width+g.at[0]+g.rect[2]);}
      for(let i=0;i<used.length;i++)if(!used[i])assert.equal(atlas.data.readUInt32BE(i*4),0,entry.atlas+': gutter pixel '+i+' not empty');
    }
  }
  ok('lossless (node decoder)',n+' regions RGBA-equal to the full-layer crops; gutters empty; IHDR/IDAT/IEND only');
  // Not loaded by any runtime file yet.
  const runtime=require('./deployment-files.cjs').filter(f=>/\.(html|js|css)$/.test(f));
  const naming=runtime.filter(f=>/sd-garment|QPFoundationGarment/.test(fs.readFileSync(path.join(root,f),'utf8')));
  if(argv['runtime-loaded'])ok('runtime files naming garment files (allowed with --runtime-loaded)',naming.join(', ')||'none');
  else{assert.deepEqual(naming,[],'A runtime file loads garment data before WP3: '+naming.join(', '));
    assert(!runtime.some(f=>/sd-garment/.test(f)),'deployment-files.cjs lists a garment file before WP3');
    ok('index.html and the '+runtime.length+' runtime files do not name sd-garment*/QPFoundationGarment*');}
  return{index,records};
}

// In the demo page: the catalogue checks (also run on mutated inputs by --self-test).
const CATALOGUE=({index,records})=>{
  const C=QPGame.getCatalog(),problems=[],rows=[];
  const shelf=(cat,sex)=>C.publicItems(cat,sex).map(it=>it.id);
  for(const [key,id] of Object.entries(index.catalogue)){
    const [sex,cat,shape]=key.split(':'),r=records[id],e=r.catalog[sex],it=C.curatedItem(cat,shape,sex);
    if(!it){problems.push(key+': not sold to '+sex);continue;}
    if(!shelf(cat,sex).includes(it.id))problems.push(key+': '+it.id+' is not on the '+sex+' shelf');
    if(r.id!==cat+':'+shape)problems.push(key+': record '+r.id);
    for(const [field,got,want] of [['item',e.item,it.id],['ci',e.ci,it.ci],['name',e.name,it.name],['colour',e.colour,it.color]])if(got!==want)problems.push(key+': '+field+' '+JSON.stringify(got)+' ≠ curatedItem '+JSON.stringify(want));
    const painted=QPClothes.colorFor(cat,shape,sex,it.color),male=QPClothes.maleColors[cat]?.[shape];
    if(sex==='m'){if(e.display!==painted)problems.push(key+': display '+e.display+' ≠ QPClothes.colorFor '+painted);if(male&&male!==e.display)problems.push(key+': display ≠ maleColors '+male);}
    else if(e.display!==it.color||painted!==it.color)problems.push(key+': display '+e.display+' ≠ curatedItem.color '+it.color);
    for(const legacy of e.legacyIds)if(!C.ITEMS[legacy])problems.push(key+': legacy id '+legacy+' unknown');
    rows.push({key,id,item:it.id,name:it.name,colour:it.color,display:e.display,price:it.price});
  }
  const starter={};
  for(const sex of ['m','f']){starter[sex]={};for(const slot of ['top','bottom','shoes']){
    const item=index.starterItems[sex][slot],[cat,shape]=item.split(':'),it=C.curatedItem(cat,shape,sex);
    if(!it||it.id!==item){problems.push('starter '+sex+' '+slot+': '+item+' is not the shelf item ('+(it&&it.id)+')');continue;}
    if(it.price!==0||!C.hasStyle(item,{},true))problems.push('starter '+sex+' '+slot+': '+item+' is not free for a new account');
    if(index.starter[sex][slot]!==index.catalogue[sex+':'+cat+':'+shape])problems.push('starter '+sex+' '+slot+': record mismatch');
    starter[sex][slot]={item,record:index.starter[sex][slot],inStarterList:C.STARTER.includes(item),price:it.price};}}
  const coverage={};
  for(const sex of ['m','f'])for(const cat of ['top','bottom','outfit','shoes'])coverage[sex+':'+cat]=C.publicItems(cat,sex).map(it=>it.shape+'→'+(index.catalogue[sex+':'+cat+':'+it.shape]||'todo'));
  const defaults={m:QPGame.newAvatar('m'),f:QPGame.newAvatar('f')};
  return{problems,rows,starter,coverage,defaults:{m:{top:defaults.m.top,bottom:defaults.m.bottom,shoes:defaults.m.shoes},f:{top:defaults.f.top,bottom:defaults.f.bottom,shoes:defaults.f.shoes}}};
};

// In the demo page: each region through QPAvatarImage, atlas vs full layer, and the rebuilt sheet.
const CROPS=async({list,LAYER})=>{
  const images=new Map(),img=u=>{if(!images.has(u))images.set(u,QPAvatarImage.load(new URL(u,document.baseURI).href));return images.get(u);};
  const pixels=async(u,r)=>{const c=document.createElement('canvas');c.width=r[2];c.height=r[3];const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(await img(u),r[0],r[1],r[2],r[3],0,0,r[2],r[3]);return x.getImageData(0,0,r[2],r[3]).data;};
  const bad=[];
  for(const g of list){const a=await pixels(g.atlas,[g.at[0],g.at[1],g.rect[2],g.rect[3]]),b=await pixels(g.layerFile,g.rect);let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;if(diff)bad.push(g.id+' '+g.sex+' '+g.view+' '+g.part+': '+diff);}
  // Rebuild the sheet from the atlases (records only) and from the layers clipped to the same rects.
  const order=['shorts','shoes','shirt','sleeves'],sheet=()=>{const c=document.createElement('canvas');c.width=1448;c.height=1086;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#eef0f3';x.fillRect(0,0,1448,1086);return[c,x];};
  const [ra,xa]=sheet(),[rb,xb]=sheet();
  for(const layer of order)for(const g of list.filter(g=>g.layer===layer)){
    xa.drawImage(await img(g.atlas),g.at[0],g.at[1],g.rect[2],g.rect[3],g.rect[0],g.rect[1],g.rect[2],g.rect[3]);
    xb.save();xb.beginPath();xb.rect(...g.rect);xb.clip();xb.drawImage(await img(LAYER[g.layer]),0,0);xb.restore();}
  const da=xa.getImageData(0,0,1448,1086).data,db=xb.getImageData(0,0,1448,1086).data;let sheetDiff=0;for(let i=0;i<da.length;i++)if(da[i]!==db[i])sheetDiff++;
  return{bad,sheetDiff,count:list.length,png:ra.toDataURL('image/png')};
};

// --self-test: each control must be caught by the same page functions.
async function selfTest(browser,page,index,records,list){
  const thaw=x=>JSON.parse(JSON.stringify(x)),caught=[];
  const control=async(label,mutate,expect)=>{const i=thaw(index),r=thaw(records);mutate(i,r);const res=await page.evaluate(CATALOGUE,{index:i,records:r});
    assert(res.problems.some(p=>p.includes(expect)),'self-test control not caught: '+label+' (problems: '+(res.problems.join('; ')||'none')+')');caught.push(label);};
  await control('boy tee catalogue colour set to the painted colour',(i,r)=>{r['top:tee'].catalog.m.colour='#507c59';},'colour');
  await control('boy tee display without the male override',(i,r)=>{r['top:tee'].catalog.m.display='#5aa8ff';},'QPClothes.colorFor');
  await control('girl shorts display drifts to the art colour',(i,r)=>{r['bottom:shorts'].catalog.f.display='#80bce0';},'curatedItem.color');
  await control('girl top sells the boy colour',(i,r)=>{r['top:tee'].catalog.f.item='top:tee:5';r['top:tee'].catalog.f.ci=5;},'item');
  await control('shoe name drifts',(i,r)=>{r['shoes:sneaker'].catalog.m.name='신발';},'name');
  await control('a shape the boys cannot buy',(i,r)=>{i.catalogue['m:bottom:skirt']='bottom:shorts';},'not sold to m');
  await control('a key mapped to another shape',(i,r)=>{i.catalogue['m:bottom:jeans']='bottom:shorts';},'record bottom:shorts');
  await control('starter item not the shelf colour',(i,r)=>{i.starterItems.f.bottom='bottom:shorts:9';},'is not the shelf item');
  await control('starter item that costs gold',(i,r)=>{i.starterItems.m.top='top:hood:5';},'not free');
  const shifted=await page.evaluate(CROPS,{list:[{...list[0],at:[list[0].at[0]+1,list[0].at[1]]}],LAYER});
  assert(shifted.bad.length===1&&shifted.sheetDiff>0,'self-test: a region read 1 px off was not caught');caught.push('atlas region read 1 px off');
  // A page that loads the index must show up in the network check.
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),overlay=path.join(out,'self-test-index.html');
  fs.writeFileSync(overlay,html.replace('</body>','<script src="assets/sd-garments-index.js"></script></body>'));
  const server=await H.serve(H.fsTree(root,{'index.html':overlay})),context=await browser.newContext(),seen=[];
  try{await H.isolate(context,{});context.on('request',q=>seen.push(new URL(q.url()).pathname));const p=await context.newPage();
    await p.goto(new URL('index.html?demo=1&session=garment-catalog-self-test',server.base).href);await p.waitForFunction(()=>window.QPGame?.getCatalog,null,{timeout:30000});
    assert(seen.some(x=>GARMENT_URL.test(x)),'self-test: a page loading the garment index was not seen');
    assert(/sd-garment|QPFoundationGarment/.test(fs.readFileSync(overlay,'utf8')),'self-test: static scan');caught.push('a page that loads sd-garments-index.js');
  }finally{await context.close();await server.close();fs.rmSync(overlay,{force:true});}
  ok('self-test',caught.length+' controls caught: '+caught.join('; '));
}

async function browserChecks(index,records){
  const server=argv.url?null:await H.serve(H.fsTree(root)),base=argv.url||server.base;
  const browser=await H.launch({args:H.RASTER_ARGS});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:800}});
    await H.isolate(context,report);
    const requests=[];context.on('request',q=>requests.push(new URL(q.url()).pathname));
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
    const settle=async()=>{try{await page.waitForLoadState('networkidle',{timeout:15000});}catch{}};
    // 1. The foundation demo page: no garment file yet.
    await page.goto(new URL('index.html?demo=1&avatar=foundation&session=garment-catalog-foundation',base).href);
    await page.waitForFunction(()=>window.QPGame?.getCatalog&&window.QPFoundationOutfit?.atlas.ready,null,{timeout:30000});await settle();
    // 2. The normal demo page (students' path).
    await page.goto(new URL('index.html?demo=1&session=garment-catalog',base).href);
    await page.waitForFunction(()=>window.QPGame?.getCatalog&&window.QPClothes?.colorFor,null,{timeout:30000});await settle();
    const garmentRequests=requests.filter(p=>GARMENT_URL.test(p));
    report.requests=requests.length;report.garmentRequests=garmentRequests;
    if(argv['runtime-loaded'])ok('garment requests on the demo pages (allowed)',garmentRequests.length+'');
    else{assert.deepEqual(garmentRequests,[],'The demo pages requested garment files before WP3');ok('?demo=1 and ?demo=1&avatar=foundation request no garment file',requests.length+' requests');}

    // 3. Catalogue: shelf, item, colours, starter, coverage.
    const cat=await page.evaluate(CATALOGUE,{index,records});
    report.catalogue=cat.rows;report.starter=cat.starter;report.coverage=cat.coverage;report.defaults=cat.defaults;
    assert.deepEqual(cat.problems,[],'Catalogue mismatch:\n  '+cat.problems.join('\n  '));
    for(const row of cat.rows)ok('shelf '+row.key,row.item+' '+row.name+' colour '+row.colour+' display '+row.display+' price '+row.price);
    for(const sex of ['m','f'])ok('starter '+sex,Object.entries(cat.starter[sex]).map(([slot,s])=>s.item+'→'+s.record+(s.inStarterList?'':' (owned through STARTER prefix)')).join(', '));
    ok('new-account defaults today (unchanged; boys keep jeans:5 until the stage-5 switch)','m '+JSON.stringify(cat.defaults.m)+', f '+JSON.stringify(cat.defaults.f));
    const todo=Object.entries(cat.coverage).map(([k,v])=>k+' '+v.filter(s=>s.endsWith('todo')).length+'/'+v.length+' todo').join('; ');
    ok('coverage (fallback todo for the rest)',todo);

    // 4. Registry: all files at once, twice, then with a runtime define() hook.
    const files=['assets/sd-garments-index.js',...Object.values(index.records).map(e=>e.files.data)];
    const load=list=>Promise.all(list.map(f=>page.addScriptTag({url:new URL(f,base).href})));
    await load(files);await load(files.slice(1).reverse());
    await page.evaluate(()=>{window.__defined=[];window.QPFoundationGarments={define:r=>window.__defined.push(r.id)};});
    await load(files.slice(1));
    const reg=await page.evaluate(()=>({ids:Object.keys(window.QPFoundationGarmentRecords||{}).sort(),proto:Object.getPrototypeOf(window.QPFoundationGarmentRecords),
      frozen:Object.values(window.QPFoundationGarmentRecords).every(r=>Object.isFrozen(r)&&Object.isFrozen(r.sexes)),records:JSON.parse(JSON.stringify(window.QPFoundationGarmentRecords)),
      index:JSON.parse(JSON.stringify(window.QPFoundationGarmentIndex)),defined:window.__defined.slice().sort()}));
    assert.deepEqual(reg.ids,Object.keys(index.records).sort(),'registry keys');assert.equal(reg.proto,null);assert(reg.frozen,'records frozen');
    assert.deepEqual(reg.records,JSON.parse(JSON.stringify(records)),'browser records differ from node');assert.deepEqual(reg.index,JSON.parse(JSON.stringify(index)),'browser index differs');
    assert.deepEqual(reg.defined,Object.keys(index.records).sort(),'define() hook');
    ok('registry',files.length+' scripts loaded concurrently, again in reverse order, again with a define() hook: one key per record ('+reg.ids.join(', ')+'), frozen, equal to node, define() called once per record');

    // 5. Runtime crop path and the rebuilt sheet.
    const list=Object.values(records).flatMap(r=>regions(r).map(g=>({...g,id:r.id,atlas:r.sexes[g.sex].atlas,layerFile:LAYER[g.layer]})));
    const result=await page.evaluate(CROPS,{list,LAYER});
    assert.deepEqual(result.bad,[],'runtime crop path differs');assert.equal(result.sheetDiff,0,'rebuilt sheet differs');
    fs.writeFileSync(path.join(out,'rebuilt-sheet.png'),Buffer.from(result.png.split(',')[1],'base64'));
    ok('runtime crop path',result.count+' regions drawn from the atlases through QPAvatarImage equal the full-layer rects; the sheet rebuilt from the records equals the layer composite (0 differing bytes) → '+path.relative(root,path.join(out,'rebuilt-sheet.png')));
    assert.deepEqual(report.errors,[],'page errors / Firebase requests');
    ok('no page error, no Firebase request','blocked remote hosts: '+(report.blocked.length?[...new Set(report.blocked)].join(', '):'none'));
    if(argv['self-test'])await selfTest(browser,page,index,records,list);
    await context.close();
  }finally{await browser.close();if(server)await server.close();}
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  console.log('verify-garment-catalog (stage 3, WP2)');
  try{
    const {index,records}=staticChecks();
    await browserChecks(index,records);
    report.ok=true;console.log('verify-garment-catalog: PASS ('+checks.length+' checks)');
  }catch(error){report.ok=false;report.failure=error.message;console.error('verify-garment-catalog: FAIL\n'+error.message);process.exitCode=1;}
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
})();
