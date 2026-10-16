'use strict';
// Shared library of the stage-3 garment verification kit (WP7):
// tools/verify-foundation-garments.cjs, tools/inspect-foundation-garments.cjs,
// tools/verify-file-foundation.cjs. Headless only, ?demo=1 only (Firebase
// stubbed), never moves a mouse; nothing here writes into the served tree.
//
//   const L=require('./foundation-garment-lib.cjs');
//   L.loadRecordDir(dir)             synthetic/pipeline records from disk: sd-garment-<stem>.js data
//                                    files or *.json records + their atlases, validated, the atlas
//                                    files checked as found; → {dir,records:[{file,kind,record,atlases:
//                                    {m,f} data URLs,atlasFiles,issues,cloth}],skipped:[{file,reason}]}
//   L.recordsOption(arg)             --records <dir>: loadRecordDir + one printed line per file;
//                                    → {…, valid, invalid}
//   L.ALIASES                        in-page alias records (hue-rotated copies of the basic pieces)
//   L.openRuntime(browser,base,report,{query,viewport})   the studio runtime page, art loaded
//   L.install(page)                  injects pageLib (window.__fg)
//   L.registerAll(page,{aliases,records})  registers aliases (+ --records) in the studio session
//   L.registerInStudio(page,{aliases,records})  the same through the studio page's api.registerGarment
//   L.capture(page,shape,file)       screenshot of the grid's area → decoded RGBA
//   L.skinPalette()                  the frozen body paintings' skin colours (untinted sheet skin)
//   L.clothColours(record,sex,extra) a record's cloth colours: catalogue (display, colour) + extra
//                                    (a --records entry's .cloth[sex], from the build's 만들기.json)
//   page side (window.__fg): grid/mode/regions/cellPoses (screens), sleeveBox/overlap/collarMargin/
//     underarmEnds/sleeveEdges (record limits), dataTwin/sleeveMutation (control records)
//   L.writeOverlayIndex(dir,specs)   a scratch garment index + record files to serve over the tree
//                                    (candidate / 404 / delayed-atlas controls)
//   L.stripKeyOverlay(dir)           avatar-foundation-outfit.js with the garment id stripped from gk()
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const H=require('./verify-harness.cjs'),M=require('./foundation-matrix.cjs');
const ROOT=path.resolve(__dirname,'..');
const S=require('./garment/schema.cjs');
const MAGENTA=[255,0,255];

// ------------------------------------------------------------- records on disk
// A directory of records (WP8 synthetic pipeline records, WP10 real-sheet
// build in 검증/옷/<stem>/). Record files, in either format:
//   - sd-garment-<cat>-<shape>.js   the pipeline's data file (tools/garment/build-garment.py; read in
//                                   a sandbox by schema.cjs readDataFile, as the repo's own records);
//   - *.json                        a plain garment record (schema 1, id cat:shape).
// The atlases lie next to the record file: the record's own path under the directory
// (sexes.<sex>.atlas, e.g. assets/sd-garment-<stem>-<sex>.png), its basename, <stem>-<sex>.png or
// sd-garment-<stem>-<sex>.png. Each record is validated with tools/garment/schema.cjs (structure,
// frozen body, legacy rules, the atlas file NAME the record will have in assets/), and its atlas
// checks run against the file FOUND here: sha256, PNG chunks (IHDR, IDAT…, IEND), 8-bit RGBA, the
// record's size. Its id must be new (not an index record) and unique in the directory.
// Every other file is reported: a JSON that is not a record (the build's 만들기.json, 보고.json),
// an image that is no record's atlas, any other file.
// The build's sidecar 만들기.json (tools/garment/build-garment.py: product "<id>:<colour index>",
// colour {"<sex>-<view>": {mainLab}, "colour-<sex>": {display}}) gives that record its measured
// cloth colours (.cloth {sex: [[r,g,b]…]}, CIELAB D65 → sRGB) for the skin probes; the schema has no
// field for them (checks is closed), and a sidecar of another layout is only reported.
//   → {dir, records:[{file,kind,record,atlases:{sex:data URL},atlasFiles:{sex:name},issues,cloth}],
//      skipped:[{file,reason}]}; a record is valid when issues is empty.
const RECORD_KEYS=['schema','id','cat','shape','slot','class','sexes'];
const DATA_FILE_RE=/^sd-garment-([a-z]+)-([a-z0-9_]+)\.js$/;
function loadRecordDir(dir){
  dir=path.resolve(String(dir));
  if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())throw Error('--records: no such directory '+dir);
  const context=S.loadContext(ROOT),indexIds=new Set(Object.keys(S.readIndex(ROOT).records||{}));
  const records=[],skipped=[],used=new Set(),names=fs.readdirSync(dir).sort();
  for(const name of names){
    const full=path.join(dir,name);
    if(fs.statSync(full).isDirectory()){if(name!=='assets')skipped.push({file:name+'/',reason:'a directory (only assets/ is searched, for atlases)'});continue;}
    let record,kind;const issues=[],atlases={},atlasFiles={};
    if(name.endsWith('.json')){
      let value;try{value=JSON.parse(fs.readFileSync(full,'utf8'));}catch(e){records.push({file:name,kind:'json',record:null,atlases,atlasFiles,issues:[{code:'JSON',path:'$',message:'not JSON: '+e.message}]});continue;}
      const keys=value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value):[];
      // the inspect tool's own report (written next to the records by default) has an id but is no record
      if(value&&value.kind==='inspect-report'){skipped.push({file:name,reason:'the report of tools/inspect-foundation-garments.cjs'});continue;}
      if(!RECORD_KEYS.some(k=>keys.includes(k))){skipped.push({file:name,reason:'JSON without any garment-record field ('+RECORD_KEYS.join(', ')+'); keys: '+(keys.slice(0,8).join(', ')||typeof value)});continue;}
      record=value;kind='json';
    }else if(name.endsWith('.js')){
      if(!DATA_FILE_RE.test(name)){skipped.push({file:name,reason:'a script that is not a garment data file (sd-garment-<cat>-<shape>.js)'});continue;}
      kind='data';try{record=S.readDataFile(full).record;}catch(e){records.push({file:name,kind,record:null,atlases,atlasFiles,issues:[{code:'DATA_FILE',path:'$',message:e.message}]});continue;}
      const m=DATA_FILE_RE.exec(name);if(record&&record.id!==m[1]+':'+m[2])issues.push({code:'FILES',path:'$.id',message:'the data file '+name+' registers '+record.id+', not '+m[1]+':'+m[2]});
    }else continue;  // images and other files are reported below, once the atlases are claimed
    if(!record||typeof record!=='object'||Array.isArray(record)){records.push({file:name,kind,record:null,atlases,atlasFiles,issues:[{code:'SCHEMA',path:'$',message:'not an object'}]});continue;}
    try{for(const i of S.validate(record,{context,root:null,builder:false})||[])issues.push(i);}catch(e){issues.push({code:'VALIDATOR',path:'$',message:e.message});}
    const idOk=S.ID_RE.test(String(record.id||''));
    if(!idOk&&!issues.some(i=>i.path==='$.id'||/missing id/.test(i.message)))issues.push({code:'ID',path:'$.id','message':'no valid id (cat:shape): '+JSON.stringify(record.id)});
    if(idOk&&indexIds.has(record.id))issues.push({code:'ID_TAKEN',path:'$.id',message:record.id+' is an index record (assets/sd-garments-index.js); a --records record needs a new id'});
    if(idOk&&records.some(r=>r.record&&r.record.id===record.id))issues.push({code:'DUPLICATE',path:'$.id',message:record.id+' also comes from '+records.find(r=>r.record&&r.record.id===record.id).file});
    const sexes=record.sexes&&typeof record.sexes==='object'?record.sexes:{};
    if(idOk)for(const [sex,X] of Object.entries(sexes)){
      const stem=S.stem(record.id),own=typeof X?.atlas==='string'?X.atlas:null;
      const candidates=[...new Set([own&&!path.isAbsolute(own)&&!own.split(/[\\/]/).includes('..')?own:null,own&&path.basename(own),stem+'-'+sex+'.png','sd-garment-'+stem+'-'+sex+'.png'].filter(Boolean))];
      const rel=candidates.find(c=>fs.existsSync(path.join(dir,c))&&fs.statSync(path.join(dir,c)).isFile());
      if(!rel){issues.push({code:'ATLAS_MISSING',path:'$.sexes.'+sex+'.atlas',message:sex+' atlas not found next to '+name+' (tried '+candidates.join(', ')+')'});continue;}
      const buf=fs.readFileSync(path.join(dir,rel)),info=S.pngInfo(buf),at='$.sexes.'+sex;used.add(rel.split(/[\\/]/)[0]==='assets'?'assets/':rel);
      if(X.sha256!==S.sha256(buf))issues.push({code:'ATLAS_FILE',path:at+'.sha256',message:rel+' sha256 '+S.sha256(buf).slice(0,12)+'… differs from the record ('+String(X.sha256).slice(0,12)+'…)'});
      if(!S.chunksOk(info))issues.push({code:'ATLAS_FILE',path:at+'.atlas',message:rel+' must carry only IHDR, IDAT…, IEND (got '+(info?info.chunks.join(','):'not a PNG')+')'});
      else if(info.ihdr.depth!==8||info.ihdr.colour!==6||info.ihdr.interlace!==0||!Array.isArray(X.size)||info.ihdr.width!==X.size[0]||info.ihdr.height!==X.size[1])issues.push({code:'ATLAS_FILE',path:at+'.size',message:rel+' must be 8-bit RGBA, not interlaced, '+(Array.isArray(X.size)?X.size.join('x'):'?')+' (got '+info.ihdr.width+'x'+info.ihdr.height+', depth '+info.ihdr.depth+', colour '+info.ihdr.colour+')'});
      atlases[sex]='data:image/png;base64,'+buf.toString('base64');atlasFiles[sex]=rel;
    }
    records.push({file:name,kind,record,atlases,atlasFiles,issues,cloth:{}});
  }
  // The build sidecar's measured colours, for the record it names.
  for(const s of skipped){if(!s.file.endsWith('.json'))continue;
    let v;try{v=JSON.parse(fs.readFileSync(path.join(dir,s.file),'utf8'));}catch{continue;}
    const product=typeof v?.product==='string'?v.product:'',colour=v&&typeof v.colour==='object'&&!Array.isArray(v.colour)?v.colour:null;if(!product||!colour)continue;
    const rec=records.find(r=>r.record&&typeof r.record.id==='string'&&(product===r.record.id||product.startsWith(r.record.id+':')));if(!rec)continue;
    const got={};for(const [k,e] of Object.entries(colour)){const m=/^(?:colour-)?([mf])(?:-[a-z]+)?$/.exec(k);if(!m||!e||typeof e!=='object')continue;
      const rgb=Array.isArray(e.mainLab)&&e.mainLab.length===3&&e.mainLab.every(Number.isFinite)?labToRgb(e.mainLab):null;if(rgb)(got[m[1]]||=[]).push(rgb);
      const hex=typeof e.display==='string'&&/^#[0-9a-f]{6}$/i.test(e.display)?[1,3,5].map(i=>parseInt(e.display.slice(i,i+2),16)):null;if(hex)(got[m[1]]||=[]).push(hex);}
    if(Object.keys(got).length){rec.cloth=got;s.reason='the build sidecar of '+rec.record.id+' (product '+product+'): its measured cloth colours are read for the skin probes ('+Object.entries(got).map(([x,l])=>x+' '+l.length).join(', ')+')';}}
  for(const name of names){const full=path.join(dir,name);if(fs.statSync(full).isDirectory()){if(name==='assets'&&!used.has('assets/'))skipped.push({file:'assets/',reason:'holds no record\'s atlas'});continue;}if(used.has(name)||name.endsWith('.json')||DATA_FILE_RE.test(name)||(name.endsWith('.js')&&skipped.some(s=>s.file===name)))continue;
    skipped.push({file:name,reason:name.endsWith('.png')?'an image that is no record\'s atlas':'not a record file (*.json or sd-garment-<cat>-<shape>.js)'});}
  return{dir,records,skipped};
}
// The --records option of the kit's tools: loads the directory, prints one line per file (record
// ok / INVALID with its issues / skipped with the reason) and returns {dir,records,skipped,valid,invalid}.
// A directory without any record file is an error (exit through the caller), never a silent pass.
// The option may repeat (--records a --records b): the directories are merged, file names keep their
// directory, and an id that two directories define is a DUPLICATE in the second.
function recordsOption(arg,{log=console.log}={}){
  if(!arg)return{dir:null,records:[],skipped:[],valid:[],invalid:[]};
  const dirs=[].concat(arg);if(dirs.some(d=>d===true||!String(d).trim()))throw Error('--records needs a directory');
  let r;if(dirs.length===1)r=loadRecordDir(dirs[0]);
  else{const all=dirs.map(d=>loadRecordDir(d)),seen=new Map();r={dir:all.map(x=>x.dir).join(' + '),records:[],skipped:[]};
    for(const x of all){const tag=path.basename(x.dir)+'/';
      for(const rec of x.records){const id=rec.record&&rec.record.id;if(id&&seen.has(id)&&!rec.issues.some(i=>i.code==='DUPLICATE'))rec.issues.push({code:'DUPLICATE',path:'$.id',message:id+' also comes from '+seen.get(id)});if(id&&!seen.has(id))seen.set(id,tag+rec.file);r.records.push({...rec,file:tag+rec.file});}
      for(const s of x.skipped)r.skipped.push({...s,file:tag+s.file});}}
  const valid=r.records.filter(x=>x.record&&!x.issues.length),invalid=r.records.filter(x=>!x.record||x.issues.length);
  log('--records '+r.dir+': '+r.records.length+' record file(s), '+valid.length+' valid, '+invalid.length+' invalid; '+r.skipped.length+' other file(s) skipped');
  for(const x of r.records){const id=x.record&&x.record.id?x.record.id:'(no id)';
    if(!x.issues.length)log('  ok       '+x.file+'  '+id+' ('+x.record.class+', '+x.record.status+(x.record.legacy?', legacy':'')+'; atlases '+Object.entries(x.atlasFiles).map(([s,f])=>s+'='+f).join(' ')+')');
    else{log('  INVALID  '+x.file+'  '+id+': '+x.issues.length+' issue(s)');for(const i of x.issues.slice(0,12))log('           '+i.code+' '+(i.path||'')+': '+i.message);if(x.issues.length>12)log('           … '+(x.issues.length-12)+' more');}}
  for(const s of r.skipped)log('  skipped  '+s.file+': '+s.reason);
  return{...r,valid,invalid};
}

// In-page alias records: a copy of a loaded record under a new id, its atlas
// passed through a canvas filter (legacy path, own id: every key must carry it).
const ALIASES=Object.freeze([
  {id:'top:teehue',from:'top:tee',filter:'hue-rotate(150deg)'},
  {id:'bottom:shortshue',from:'bottom:shorts',filter:'hue-rotate(110deg) saturate(1.4)'},
  {id:'shoes:sneakerhue',from:'shoes:sneaker',filter:'sepia(1) hue-rotate(170deg) saturate(5) brightness(.8)'}
].map(Object.freeze));

// ------------------------------------------------------------------ page side
function pageLib(cfg){
  const api=window.QPAvatarFoundation,G=window.QPFoundationGarments,O=window.QPFoundationOutfit,Sk=window.QPFoundationSkin;
  const cyrb=s=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);};
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  const clone=x=>JSON.parse(JSON.stringify(x));
  let host=document.getElementById('fg-host');
  if(!host){
    const style=document.createElement('style');style.textContent=`
      #fg-host{position:absolute;left:0;top:0;z-index:2147483647;display:grid;margin:0;padding:0;background:var(--fg-bg,#dfe6ee)}
      #fg-host,#fg-host *{animation:none!important;transition:none!important}
      #fg-host .fg-cell{position:relative;overflow:hidden}
      #fg-host .fg-cell>svg{position:absolute}
      #fg-host .fg-label{font:600 12px/1.25 sans-serif;color:#25313d;display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre;background:#f4f6f8}
      #fg-host.fg-headless [data-foundation-head],#fg-host.fg-headless [data-foundation-back-hair]{display:none!important}
      #fg-host.fg-garment svg *:not(defs):not(defs *),#fg-host.fg-sleeves svg *:not(defs):not(defs *),#fg-host.fg-bottom svg *:not(defs):not(defs *){visibility:hidden!important}
      #fg-host.fg-garment svg [data-outfit-part],#fg-host.fg-garment svg [data-outfit-part] *{visibility:visible!important}
      #fg-host.fg-top svg *:not(defs):not(defs *),#fg-host.fg-shoes svg *:not(defs):not(defs *){visibility:hidden!important}
      #fg-host.fg-sleeves svg [data-outfit-part^="sleeve-"]{visibility:visible!important}
      #fg-host.fg-bottom svg [data-outfit-part="shorts-hip"]{visibility:visible!important}
      #fg-host.fg-top svg [data-outfit-part^="shirt"],#fg-host.fg-top svg [data-outfit-part^="underarm"],#fg-host.fg-top svg [data-outfit-part^="sleeve-"]{visibility:visible!important}
      #fg-host.fg-shoes svg [data-outfit-part^="shoe-"]{visibility:visible!important}
      #fg-host.fg-noshadow .qpx-contact-shadow{display:none!important}`;
    document.head.append(style);host=document.createElement('div');host.id='fg-host';document.body.append(host);
  }
  const clear=()=>{for(const svg of host.querySelectorAll('svg[data-qp-foundation]'))api.destroy(svg);host.replaceChildren();host.className='';};
  async function settle(root){
    const hrefs=new Set();for(const im of root.querySelectorAll('image'))hrefs.add(im.getAttribute('href'));
    await Promise.all([...hrefs].filter(Boolean).map(h=>{const i=new Image();i.src=h;return i.decode().catch(()=>{});}));
    await frame();await frame();
  }
  // apply() adds each seated avatar's breathing offset (render serial); removed so a sample shows its own time.
  const offset=svg=>(Number(String(svg.dataset.foundationId).slice(4))||0)*1.37%3.3;
  const posed=(svg,state)=>state&&(state.action==='sit'||state.action==='floor-sit')?{...state,time:state.time-offset(svg)}:state;
  const mk=(av,size=280,parent=host)=>{const d=document.createElement('div');d.innerHTML=api.render(av,size);parent.append(d);return d.firstElementChild;};
  // Per-render ids (qpf-N) normalised: two avatars are compared.
  const outfitSig=svg=>[...svg.querySelectorAll('[data-outfit-part]')].map(e=>[e.dataset.outfitPart,e.getAttribute('href')?cyrb(e.getAttribute('href')):null,...['x','y','width','height','d','fill','stroke','clip-path'].map(k=>e.getAttribute(k)?.replace(/qpf-\d+/g,'qpf-X')??null),e.style.display,e.closest('[data-outfit-owner]')?.getAttribute('transform')||null,(()=>{const id=(e.getAttribute('clip-path')||'').match(/#([^)]+)/)?.[1],c=id&&svg.querySelector('[id="'+id+'"] path');return c?c.getAttribute('d'):null;})()]);
  const skinSig=svg=>[...svg.querySelectorAll('[data-foundation-skin-paint]')].map(e=>[e.dataset.foundationSkinPaint,cyrb(e.getAttribute('href')||''),e.getAttribute('x'),e.getAttribute('y'),e.getAttribute('width'),e.getAttribute('height')]);
  const garmentsOf=svg=>[...new Set([...svg.querySelectorAll('[data-outfit-part]')].map(e=>e.dataset.outfitGarment))];
  const norm=svg=>{const c=svg.cloneNode(true);c.removeAttribute('data-foundation-static');c.removeAttribute('data-foundation-static-defs');return c.outerHTML.split(svg.dataset.foundationId).join('qpf-X');};
  const normSorted=s=>{const c=s.cloneNode(true);const walk=e=>{const a=[...e.attributes].map(x=>[x.name,x.value.replace(/qpf-\d+/g,'qpf-X')]).sort();for(const [k] of a)e.removeAttribute(k);for(const [k,v] of a)e.setAttribute(k,v);for(const k of e.children)walk(k);};walk(c);return c.outerHTML;};
  const geometry=svg=>JSON.stringify([...svg.querySelector('[data-foundation-body]').querySelectorAll('*')].map(n=>[n.tagName,n.getAttribute('d'),n.getAttribute('transform'),n.style.display,n.style.opacity]));
  const nonFinite=svg=>[...svg.querySelectorAll('*')].some(e=>[...e.attributes].some(a=>!/href$/.test(a.name)&&/NaN|Infinity/.test(a.value)));
  const paintMisses=()=>Sk.paintStats().kinds.reduce((s,k)=>s+k.misses,0);
  // Which slot owns an outfit part.
  // arm-sleeve-*: a long sleeve's strip and folded forearm; feet-*: the bare feet under an open shoe.
  const slotOfPart=part=>/^(shirt|underarm|sleeve|arm-sleeve)/.test(part)?'top':part==='shorts-hip'?'bottom':/^(shoe|feet)/.test(part)?'shoes':null;
  // The records this page knows: the index's plus registered ones (with their source).
  const known=new Map();
  function recordList(){
    const out=[];for(const [id,e] of Object.entries(window.QPFoundationGarmentIndex?.records||{}))out.push({id,slot:e.slot,class:e.class,status:e.status,legacy:Boolean(e.legacy),sexes:[...e.sexes].sort(),source:'index'});
    for(const [id,r] of known)out.push({id,slot:r.slot,class:r.class,status:r.status,legacy:Boolean(r.legacy),sexes:Object.keys(r.sexes).sort(),source:r.source,from:r.from||null});
    return out;
  }
  const filtered=(img,filter)=>{const c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;const x=c.getContext('2d');if(filter)x.filter=filter;x.drawImage(img,0,0);return c;};
  async function registerAliases(specs){
    const res={};
    for(const s of specs){const src={m:G.get(s.from,'m'),f:G.get(s.from,'f')};if(!src.m&&!src.f){res[s.id]='source '+s.from+' not loaded';continue;}
      const r=clone((src.m||src.f).record);r.id=s.id;r.shape=s.id.split(':')[1];const images={};for(const sex of Object.keys(r.sexes))if(src[sex])images[sex]=filtered(src[sex].image,s.filter);
      res[s.id]=await G.register(r,images);known.set(s.id,{...r,source:'alias',from:s.from});}
    return res;
  }
  async function registerRecords(list){const res={};for(const {record,atlases} of list){try{res[record.id]=await G.register(record,atlases);known.set(record.id,{...clone(record),source:'records'});}catch(e){res[record.id]='error: '+e.message;}}return res;}
  // Control records (registered, kept out of the manifest list):
  //  - dataTwin: a pipeline-path (legacy:false) copy of a legacy top, its
  //    metadata in record form from the legacy path itself
  //    (QPFoundationOutfit.legacyMetadata; raised art packed under the atlas),
  //    with a chosen sleeve box: 'legacy' keeps [-4,-4,8,8], 'fit' encloses
  //    every opaque sleeve pixel (hanging and raised art) plus .25 u;
  //  - sleeve mutations of a legacy top: 'gap' clears each sleeve from 10
  //    sheet rows above its cuff down (a sleeve that ends short of the cuff
  //    line the arm is clipped at: a hole between sleeve and arm), 'crown'
  //    moves each front/back sleeve 40 sheet px toward the neck and 20 px up
  //    (sleeve cloth where a puff crown would swing into the neck and collar).
  const controls=new Map();
  async function dataTwin(fromId,id,{box='legacy'}={}){
    const src={m:G.get(fromId,'m'),f:G.get(fromId,'f')},r=clone((src.m||src.f).record);r.id=id;r.shape=id.split(':')[1];r.legacy=false;r.legacyComputed=[];r.bodyArt=r.bodyArt||'legacy';const images={};
    for(const sex of Object.keys(r.sexes)){const g=src[sex],meta=O.legacyMetadata(fromId,sex),W=g.image.naturalWidth||g.image.width,Hh=g.image.naturalHeight||g.image.height;let y=Hh+2,width=W;const placed=[];
      for(const view of ['front','back'])(meta.views[view].raised||[]).forEach((c,i)=>{placed.push({view,i,c,at:[2,y]});y+=c.height+2;width=Math.max(width,c.width+4);});
      const atlas=document.createElement('canvas');atlas.width=width;atlas.height=y;const x=atlas.getContext('2d');x.drawImage(g.image,0,0);for(const p of placed)x.drawImage(p.c,...p.at);images[sex]=atlas;
      const S=r.sexes[sex];for(const [view,f] of Object.entries(S.figures)){const v=meta.views[view];f.top.underarm=v.underarm||null;f.top.sleeves.forEach((s,i)=>{s.opening=[[0,s.cuff],[0,s.cuff]];s.raisedAt=placed.find(p=>p.view===view&&p.i===i)?.at||null;});f.top.hem=[];f.top.collar=[];}
      S.size=[width,y];}
    const reg=await G.register(r,images);
    if(box==='fit'){// the twin is loaded now: measure its art in the sleeve frame (sleeveBox with a zero box) and widen
      for(const sex of Object.keys(r.sexes)){const rows=sleeveBoxOf(G.get(id,sex),sex,[0,0,0,0],true);for(const [view,f] of Object.entries(r.sexes[sex].figures))f.top.sleeves.forEach((s,i)=>{const e=rows.filter(b=>b.view===view&&b.sleeve===i).map(b=>b.extent);const x0=Math.min(...e.map(v=>v[0])),y0=Math.min(...e.map(v=>v[1])),x1=Math.max(...e.map(v=>v[2])),y1=Math.max(...e.map(v=>v[3]));s.box=[x0-.25,y0-.25,x1-x0+.5,y1-y0+.5].map(v=>Math.round(v*1000)/1000);});}
      const fitted=clone(r);fitted.id=id+'fit';fitted.shape=fitted.id.split(':')[1];const res=await G.register(fitted,images);controls.set(fitted.id,{...fitted,source:'control',from:fromId});return{id:fitted.id,states:res,box:Object.fromEntries(Object.keys(r.sexes).map(sex=>[sex,fitted.sexes[sex].figures.front.top.sleeves.map(s=>s.box)]))};}
    controls.set(id,{...r,source:'control',from:fromId});return{id,states:reg};
  }
  async function sleeveMutation(fromId,id,kind){
    const src={m:G.get(fromId,'m'),f:G.get(fromId,'f')},r=clone((src.m||src.f).record);r.id=id;r.shape=id.split(':')[1];const images={};
    for(const sex of Object.keys(r.sexes)){const g=src[sex],c=filtered(g.image),x=c.getContext('2d');
      for(const [view,f] of Object.entries(r.sexes[sex].figures)){const F=R.figures[sex+'-'+view];for(const s of f.top.sleeves){
        if(kind==='gap'){const top=Math.max(0,F.cuff_top-10-s.rect[1]);if(top<s.rect[3])x.clearRect(s.at[0],s.at[1]+top,s.rect[2],s.rect[3]-top);}
        else if(kind==='crown'&&view!=='right'){const i=f.top.sleeves.indexOf(s),inward=(s.rect[0]+s.rect[2]/2<F.neck[0]?1:-1)*40;s.rect=[s.rect[0]+inward,s.rect[1]-20,s.rect[2],s.rect[3]];if(i<0)throw Error('crown: sleeve not found');}}}
      images[sex]=c;}
    const res=await G.register(r,images);controls.set(id,{...r,source:'control',from:fromId});return{id,states:res};
  }
  // The outfit a record is tested in: the sex's starter set with the record in its slot.
  function outfitFor(id,sex){const set=Object.fromEntries(G.SLOTS.map((slot,i)=>[slot,G.starter(sex)[i]]));if(id){const e=recordList().find(r=>r.id===id)||controls.get(id);if(e)set[e.slot]=id;}return set;}
  // ------------------------------------------------------------ grids
  let cellsNow=[];
  // cells: [{av,state,size,label?}] laid out in `cols` columns of cellW x cellH.
  async function grid({cells,cols,cellW,cellH,bg,top,labelW,labels}){
    clear();if(bg)host.style.setProperty('--fg-bg',bg);else host.style.removeProperty('--fg-bg');
    host.style.gridTemplateColumns=(labelW?labelW+'px ':'')+`repeat(${cols},${cellW}px)`;host.style.gridAutoRows=cellH+'px';cellsNow=[];
    const out=[];
    cells.forEach((c,i)=>{
      if(labelW&&i%cols===0){const l=document.createElement('div');l.className='fg-label';l.textContent=labels?.[Math.floor(i/cols)]||'';host.append(l);}
      const cell=document.createElement('div');cell.className='fg-cell';cell.style.width=cellW+'px';cell.style.height=cellH+'px';host.append(cell);
      if(!c){cellsNow.push(null);out.push(null);return;}
      const size=c.size||280,w=size*32/56,h=size*62/56;cell.innerHTML=api.render(c.av,size);const svg=cell.firstElementChild;svg.style.left=Math.round((cellW-w)/2+(c.dx||0))+'px';svg.style.top=Math.round(top!=null?top:(cellH-h)*.45)+'px';
      if(c.state)api.apply(svg,posed(svg,c.state));
      cellsNow.push({svg,c});out.push({static:svg.dataset.foundationStatic||'',garments:svg.dataset.foundationGarments||'',fallback:svg.dataset.foundationFallback||'',nodes:svg.querySelectorAll('*').length,cls:svg.dataset.foundationClass||''});
    });
    await settle(host);
    const rects=[...host.querySelectorAll('.fg-cell')].map(e=>{const r=e.getBoundingClientRect();return[Math.round(r.left+scrollX),Math.round(r.top+scrollY),Math.round(r.width),Math.round(r.height)];});
    const box=host.getBoundingClientRect();return{info:out,rects,width:Math.ceil(box.width),height:Math.ceil(box.height)};
  }
  async function mode(name){host.className=name||'';await frame();await frame();}
  // Region masks of the current grid, drawn in screen pixels on one canvas:
  // R = upper-arm capsule core (shoulder–elbow: where the sleeve, its cuff and
  // the arm's skin clip meet; the forearm and hand are body art, and a
  // foreshortened forearm is narrower than its radius), G = thigh capsule core
  // (hip–knee: the shorts' openings), B = head/neck capsule (the neck column
  // from the collar up). Cores are `core` of the painted radii, so the limb's
  // own soft edge never counts.
  function regions({width,height,core=.55}){
    const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.globalCompositeOperation='lighter';x.lineCap='round';x.lineJoin='round';
    const map=(m,p)=>[m.a*p[0]+m.c*p[1]+m.e+scrollX,m.b*p[0]+m.d*p[1]+m.f+scrollY],scale=m=>Math.sqrt(Math.abs(m.a*m.d-m.b*m.c));
    // Flat (butt) ends at the limb's root and tip, round inner joints: a round
    // cap at the shoulder or hip would reach past the body's outline.
    const tube=(m,pts,radii,colour)=>{x.strokeStyle=x.fillStyle=colour;x.lineCap='butt';for(let k=0;k<pts.length-1;k++){const a=map(m,pts[k]),b=map(m,pts[k+1]),r=Math.min(radii[k],radii[k+1])*core*scale(m);x.lineWidth=2*r;x.beginPath();x.moveTo(...a);x.lineTo(...b);x.stroke();if(k){x.beginPath();x.arc(a[0],a[1],r,0,Math.PI*2);x.fill();}}};
    for(const cell of cellsNow){if(!cell)continue;const {svg}=cell,rig=api.prepare(svg),pose=api.inspect(svg);if(!rig||!pose)continue;
      // Each limb from part of the way down its first bone (the joint itself lies on the body's
      // outline): the arm from .35 (a swung or raised sleeve cap turns its top corner across a
      // capsule that starts nearer the shoulder; the cuff seam lies at .59–.62 of the upper arm,
      // measured on the basic), the thigh from .2.
      const from=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
      pose.arms.forEach((arm,i)=>tube(rig.arms[i].parent.getScreenCTM(),[from(arm.shoulder,arm.elbow,.35),arm.elbow],api.armRadii,'rgb(255,0,0)'));
      pose.legs.forEach((leg,i)=>tube(rig.legs[i].parent.getScreenCTM(),[from(leg.root,leg.knee,.2),leg.knee],api.legRadii,'rgb(0,255,0)'));
      // Head/neck capsule (CAP_HIGH): the neck column from just below the collar point up past the
      // chin (torso space, radius 1.5 u; 1 u before 2026-10-13 caught too little of the crown control): where a puff sleeve's crown would swing into the
      // neck, collar and chin. Not the hair's sides (a raised arm passes beside them by design).
      {const m=rig.parts.torso.getScreenCTM(),collar=api.specFor(svg.dataset.qpxSex).collar,r=1.5/core;tube(m,[[16,collar+.3],[16,collar-2.2]],[r,r],'rgb(0,0,255)');}
    }
    // The waist band where the top's hem meets the bottom (pelvis space): nothing but those two may show there.
    const wc=document.createElement('canvas');wc.width=width;wc.height=height;const wx=wc.getContext('2d');wx.fillStyle='rgb(255,255,255)';
    for(const cell of cellsNow){if(!cell)continue;const {svg}=cell,rig=api.prepare(svg),pose=api.inspect(svg);if(!rig||!pose)continue;const S=api.specFor(svg.dataset.qpxSex),m=rig.parts.pelvis.getScreenCTM(),half=pose.profile?.9:1.7;
      const q=[[16-half,S.waist-1.1],[16+half,S.waist-1.1],[16+half,S.waist+.5],[16-half,S.waist+.5]].map(p=>map(m,p));wx.beginPath();q.forEach((p,i)=>i?wx.lineTo(...p):wx.moveTo(...p));wx.closePath();wx.fill();}
    return{limbs:c.toDataURL('image/png'),waist:wc.toDataURL('image/png')};
  }
  // Per cell: what was posed (arm lifts, raised arms, view) for the probes.
  function cellPoses(){return cellsNow.map(cell=>{if(!cell)return null;const p=api.inspect(cell.svg);return p?{view:p.profile?'profile':p.back?'back':'front',lift:p.arms.map(a=>a.lift||0),action:p.action,gesture:p.gesture||'',floor:p.floor,desk:p.desk}:null;});}
  // ------------------------------------------------------------ record geometry
  const decoded=new Map();
  async function pixelsOf(url){if(decoded.has(url))return decoded.get(url);const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const d={w:c.width,h:c.height,data:x.getImageData(0,0,c.width,c.height).data};decoded.set(url,d);if(decoded.size>400)decoded.delete(decoded.keys().next().value);return d;}
  const imageData=img=>{const c=filtered(img);return{w:c.width,h:c.height,data:c.getContext('2d').getImageData(0,0,c.width,c.height).data};};
  const R=window.QPFoundationReferenceData,VIEWS={front:'Front',right:'Profile',back:'Back'};
  const rig=(sex,view)=>api.rigFor(sex,view==='right'?'profile':view);
  // Static record limits from the atlas pixels in sheet space (sleeve box,
  // top × bottom overlap). The record must be loaded for the sex.
  // A sleeve pixel's place in the sleeve frame is the runtime's own mesh at
  // rest (avatar-foundation-outfit.js sleeveTexture: q = rotate(px - shoulder)·k).
  function sleeveBoxOf(g,sex,override,extent){
    const out=[],img=imageData(g.image);
    for(const [view,fig] of Object.entries(g.figures)){const F=R.figures[sex+'-'+view],S=rig(sex,view),profile=view==='right';
      (fig.top?.sleeves||[]).forEach((s,i)=>{const restAngle=profile?-Math.atan2(...S.profileSwing):Math.atan2(S.elbow[i][1]-S.shoulder[i][1],S.elbow[i][0]-S.shoulder[i][0])-Math.PI/2,box=override||(g.legacy?[-4,-4,8,8]:s.box),sh=F.joints.shoulder[i];
        for(const [what,at] of [['sleeve',s.at],...(s.raisedAt?[['raised',s.raisedAt]]:[])]){let opaque=0,outside=0,far=0;const ext=[Infinity,Infinity,-Infinity,-Infinity];
          for(let y=0;y<s.rect[3];y++)for(let x=0;x<s.rect[2];x++){const a=img.data[((at[1]+y)*img.w+at[0]+x)*4+3];if(a<=128)continue;opaque++;
            const vx=(s.rect[0]+x+.5-sh[0])*F.k,vy=(s.rect[1]+y+.5-sh[1])*F.k,c=Math.cos(-restAngle),sn=Math.sin(-restAngle),q=[vx*c-vy*sn,vx*sn+vy*c];
            ext[0]=Math.min(ext[0],q[0]);ext[1]=Math.min(ext[1],q[1]);ext[2]=Math.max(ext[2],q[0]);ext[3]=Math.max(ext[3],q[1]);
            const d=Math.max(box[0]-q[0],q[0]-(box[0]+box[2]),box[1]-q[1],q[1]-(box[1]+box[3]));if(d>0){outside++;far=Math.max(far,d);}}
          out.push({view,sleeve:i,what,box,opaque,outside,farthest:+far.toFixed(3),...(extent?{extent:ext}:{})});}});}
    return out;
  }
  function sleeveBox(id,sex){const g=G.get(id,sex);return g?sleeveBoxOf(g,sex):null;}
  // Top over bottom, per view, on the frozen hem columns not covered by the
  // hanging arm (tools/garment/frozen/zones.json figures[].hem.columns
  // [x, hem, shortsTop, armed]): the top's hem row against the bottom's drawn
  // top (a pipeline bottom is drawn up to the waist cover line W; its
  // waistTop, else its first opaque row) and the frozen rule hem >= W + .24 u
  // (W = the bottom's own top - waistCoverOffsetPx), all in body units.
  function overlap(topId,bottomId,sex,zones){
    const t=G.get(topId,sex),b=G.get(bottomId,sex);if(!t||!b)return null;const ti=imageData(t.image),bi=imageData(b.image),out=[];
    for(const view of Object.keys(t.figures)){const tp=t.figures[view].top?.torso,bp=b.figures[view]?.bottom,Z=zones[sex+'-'+view];if(!tp||!bp||!Z)continue;const F=R.figures[sex+'-'+view];
      const col=(img,part,X,dir)=>{const x=X-part.rect[0];if(x<0||x>=part.rect[2])return null;for(let k=0;k<part.rect[3];k++){const y=dir>0?k:part.rect[3]-1-k;if(img.data[((part.at[1]+y)*img.w+part.at[0]+x)*4+3]>128)return part.rect[1]+y;}return null;};
      let drawn=Infinity,rule=Infinity,at=null,n=0;
      for(const [X,,,armed] of Z.columns){if(armed)continue;const hem=col(ti,tp,X,-1),own=col(bi,bp,X,1);if(hem==null||own==null)continue;n++;
        const top=!b.legacy&&Number.isFinite(bp.waistTop)?Math.min(bp.waistTop,own):own,d=(hem+1-top)*F.k,r=(hem-(own-Z.waistCoverOffsetPx))*F.k;if(d<drawn)drawn=d;if(r<rule){rule=r;at=X;}}
      out.push({view,drawn:n?+drawn.toFixed(3):null,rule:n?+rule.toFixed(3):null,atColumn:at,columns:n,legacyBottom:Boolean(b.legacy)});}
    return out;
  }
  // Female collar–front-hair margin (head-view units): the front hair clip's
  // lower boundary (FRONT_HAIR_CLIP, live: the nod's bow moves it) against the
  // shirt torso's top edge, over the columns where both exist; front view.
  const JAW=[12.35,19.85];
  async function collarMargin(svg){
    const fid=svg.dataset.foundationId,clip=svg.querySelector('[id="'+fid+'-head-front"] path'),user=[...svg.querySelectorAll('[clip-path]')].find(e=>e.getAttribute('clip-path')==='url(#'+fid+'-head-front)');
    const shirt=svg.querySelector('[data-outfit-part="shirt-torso"]');if(!clip||!user||!shirt)return{found:false,why:!clip?'no front hair clip':!user?'no clipped head':'no shirt'};
    const pts=[...clip.getAttribute('d').matchAll(/([MLHVZ])([^MLHVZ]*)/g)].reduce((acc,[,c,a])=>{const v=a.trim().split(/[ ,]+/).filter(Boolean).map(Number);const last=acc.at(-1)||[0,0];if(c==='M'||c==='L')acc.push([v[0],v[1]]);else if(c==='H')acc.push([v[0],last[1]]);else if(c==='V')acc.push([last[0],v[0]]);return acc;},[]).filter(p=>p[1]>20).sort((a,b)=>a[0]-b[0]);
    const clipY=x=>{for(let k=0;k<pts.length-1;k++)if(x>=pts[k][0]&&x<=pts[k+1][0]){const t=(x-pts[k][0])/((pts[k+1][0]-pts[k][0])||1);return pts[k][1]+(pts[k+1][1]-pts[k][1])*t;}return null;};
    const px=await pixelsOf(shirt.getAttribute('href')),X=+shirt.getAttribute('x'),Y=+shirt.getAttribute('y'),W=+shirt.getAttribute('width'),Hh=+shirt.getAttribute('height');
    // Only the columns outside the jaw (avatar-foundation.js bowFace JAW 12.35…19.85): there the
    // boundary keeps its place on the body over the collar and shoulders; over the jaw it follows
    // the face (the approved nod lowers the face over the collar; that is not hair over cloth).
    // While the front bow is on (nod), the hair below the brow is the face band's <use> copy of
    // the head view (its own warp); the clip then lives in that copy's space.
    const face=svg.querySelector('[data-foundation-bow="face"]'),use=face?.querySelector('use'),view=user.closest('[data-foundation-head-view]');
    let clipCTM=user.getCTM();if(face&&face.style.display!=='none'&&use&&view)clipCTM=use.getCTM().multiply(view.parentNode.getCTM().inverse()).multiply(user.getCTM());
    // Margins are measured in the head group's own (head-native) units: the boundary and the
    // shirt's top edge both mapped there, so the face band's vertical warp does not scale them.
    const head=svg.querySelector('[data-foundation-head]'),toHead=head.getCTM().inverse(),clipToHead=toHead.multiply(clipCTM),shirtToHead=toHead.multiply(shirt.getCTM()),toClip=clipCTM.inverse().multiply(shirt.getCTM());
    const hb=pts.map(([x,y])=>{const q=new DOMPoint(x,y).matrixTransform(clipToHead);return[q.x,q.y];}).sort((a,b)=>a[0]-b[0]);
    const headY=x=>{for(let k=0;k<hb.length-1;k++)if(x>=hb[k][0]&&x<=hb[k+1][0]){const t=(x-hb[k][0])/((hb[k+1][0]-hb[k][0])||1);return hb[k][1]+(hb[k+1][1]-hb[k][1])*t;}return null;};
    let min=Infinity,at=null,n=0,jaw=Infinity;
    for(let i=0;i<px.w;i++){let j=0;while(j<px.h&&px.data[(j*px.w+i)*4+3]<=128)j++;if(j>=px.h)continue;const pt=new DOMPoint(X+(i+.5)/px.w*W,Y+j/px.h*Hh),c=pt.matrixTransform(toClip),h=pt.matrixTransform(shirtToHead),cy=headY(h.x);if(cy==null||clipY(c.x)==null)continue;const m=h.y-cy;
      if(c.x>JAW[0]&&c.x<JAW[1]){jaw=Math.min(jaw,m);continue;}n++;if(m<min){min=m;at=+c.x.toFixed(2);}}
    return{found:n>0,margin:n?+min.toFixed(3):null,atX:at,columns:n,overJaw:Number.isFinite(jaw)?+jaw.toFixed(3):null};
  }
  // The underarm line's end along the raised arm (torso space), and the cuff it must stay within.
  function underarmEnds(svg){
    const pose=api.inspect(svg),fit=O.inspect(svg),[a,b,c,d,tx,ty]=pose.torso,det=a*d-b*c,unmap=q=>[(d*(q[0]-tx)-c*(q[1]-ty))/det,(-b*(q[0]-tx)+a*(q[1]-ty))/det],out=[];
    for(const i of [0,1]){const line=svg.querySelector('[data-outfit-part="underarm-line-'+i+'"]');if(!line||line.style.display==='none'||!line.getAttribute('d'))continue;
      const pts=line.getAttribute('d').replace(/[MQ]/g,'L').split('L').filter(t=>t.trim()).map(t=>t.trim().split(/\s+/).map(Number)),arm=pose.arms[i],S=unmap(arm.shoulder),e=unmap(arm.elbow),l=Math.hypot(e[0]-S[0],e[1]-S[1]),end=pts[pts.length-1];
      out.push({arm:i,along:+(((end[0]-S[0])*(e[0]-S[0])+(end[1]-S[1])*(e[1]-S[1]))/l).toFixed(3),cuff:+fit.sleeves[i].cuff.toFixed(3)});}
    return out;
  }
  // Distinct sleeve pictures of the samples so far, with opaque pixels on their border (clipped by the box).
  const sleeveBorder=new Map();
  async function sleeveEdges(svg){for(const i of [0,1]){const e=svg.querySelector('[data-outfit-part="sleeve-'+i+'"]'),h=e?.getAttribute('href');if(!h||sleeveBorder.has(h))continue;const p=await pixelsOf(h);let n=0;for(let x=0;x<p.w;x++)for(const y of [0,p.h-1])if(p.data[(y*p.w+x)*4+3]>128)n++;for(let y=1;y<p.h-1;y++)for(const x of [0,p.w-1])if(p.data[(y*p.w+x)*4+3]>128)n++;sleeveBorder.set(h,{garment:e.dataset.outfitGarment,border:n,w:p.w,h:p.h});}}
  window.__fg={api,G,O,Sk,host,cyrb,frame,clone,settle,posed,mk,outfitSig,skinSig,garmentsOf,norm,normSorted,geometry,nonFinite,paintMisses,slotOfPart,recordList,registerAliases,registerRecords,dataTwin,sleeveMutation,controls,outfitFor,grid,mode,regions,cellPoses,clear,pixelsOf,sleeveBox,overlap,collarMargin,underarmEnds,sleeveEdges,sleeveBorder,known,filtered,cells:()=>cellsNow};
}

// ------------------------------------------------------------------ node side
async function openRuntime(browser,base,report,{query='demo=1&session=foundation-studio',viewport={width:1400,height:1000},waitStarter=true,route}={}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'no-preference'});await H.isolate(context,report);if(route)await route(context);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(query+': '+e.message));
  await page.goto(new URL('index.html?'+query,base).href);
  await page.waitForFunction(()=>window.QPGame&&window.QPAvatarFoundation,null,{timeout:90000});
  await page.evaluate(()=>{QPGame.go('login');window.QPFoundationSkin?.load();window.QPFoundationOutfit?.load();});
  if(waitStarter)await page.waitForFunction(()=>window.QPFoundationOutfit?.atlas.ready&&window.QPFoundationSkin?.atlas.ready&&window.QPAvatar?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady,null,{timeout:120000,polling:100});
  return{context,page};
}
async function install(page,cfg={}){await page.evaluate(pageLib,cfg);}
async function registerAll(page,{aliases=ALIASES,records=[]}={}){
  const a=await page.evaluate(specs=>__fg.registerAliases(specs),aliases.map(x=>({...x})));
  const r=records.length?await page.evaluate(list=>__fg.registerRecords(list),records.map(x=>({record:x.record,atlases:x.atlases}))):{};
  return{aliases:a,records:r};
}
// In the studio page (avatar-standard.html, hosted): the alias records and --records records go in
// through the studio's own api.registerGarment(record, atlases) (the path WP10 uses). Aliases are made
// from the loaded source record's atlas through a canvas filter. → {id: {m,f} load states | 'error: …'}.
async function registerInStudio(page,{aliases=ALIASES,records=[]}={}){
  return page.evaluate(async({aliases,records})=>{const S=window.QPFoundationStudio,G=S.runtime.QPFoundationGarments,res={};
    for(const s of aliases){try{const src={m:G.get(s.from,'m'),f:G.get(s.from,'f')},base=src.m||src.f;if(!base)throw Error('source '+s.from+' not loaded');
      const r=JSON.parse(JSON.stringify(base.record));r.id=s.id;r.shape=s.id.split(':')[1];const atlases={};
      for(const sex of Object.keys(r.sexes))if(src[sex]){const img=src[sex].image,c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;const x=c.getContext('2d');x.filter=s.filter;x.drawImage(img,0,0);atlases[sex]=c.toDataURL('image/png');}
      res[s.id]=await S.registerGarment(JSON.stringify(r),atlases);}catch(e){res[s.id]='error: '+e.message;}}
    for(const {record,atlases} of records){try{res[record.id]=await S.registerGarment(JSON.stringify(record),atlases);}catch(e){res[record.id]='error: '+e.message;}}
    return res;},{aliases:aliases.map(x=>({...x})),records:records.map(x=>({record:x.record,atlases:x.atlases}))});
}
async function capture(page,shape,file){
  await page.setViewportSize({width:Math.max(200,shape.width),height:Math.max(200,shape.height)});
  const buf=await page.screenshot({clip:{x:0,y:0,width:shape.width,height:shape.height},animations:'disabled',caret:'hide'});
  if(file){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buf);}return H.png.decode(buf);
}
const dataUrlPng=u=>H.png.decode(Buffer.from(u.split(',')[1],'base64'));
const px=(img,x,y)=>{const i=(y*img.width+x)*4;return[img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]];};
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const isMagenta=(p,t=80)=>dist(p,MAGENTA)<t;
// The untinted sheet skin: colours of the frozen body paintings (arms, legs,
// neck; line art excluded: lum > 60, so shaded skin counts), quantised to
// bins of 8 and kept while they cover 99% of the pixels. Measured: the basic
// outfit's cream trims fall in the same bins (distance 0), so this palette
// alone cannot tell light skin from cream cloth; the probes use it only as a
// guard next to the tone-0 continuity test (verify-foundation-garments skinPart).
let skinCache=null;
function skinPalette(){
  if(skinCache)return skinCache;const bins=new Map();let total=0;
  for(const f of ['sd-foundation-ref-arms.png','sd-foundation-ref-legs.png','sd-foundation-ref-neck.png']){const img=H.png.decode(fs.readFileSync(path.join(ROOT,'assets',f)));
    for(let i=0;i<img.data.length;i+=4){if(img.data[i+3]<250)continue;const c=[img.data[i],img.data[i+1],img.data[i+2]];if(.3*c[0]+.59*c[1]+.11*c[2]<=60)continue;const k=c.map(v=>v>>3).join(',');bins.set(k,(bins.get(k)||0)+1);total++;}}
  const sorted=[...bins].sort((a,b)=>b[1]-a[1]);let acc=0;const pal=[];for(const [k,n] of sorted){if(acc/total>.99)break;acc+=n;pal.push(k.split(',').map(v=>Number(v)*8+4));}
  return skinCache=pal;
}
// The cloth colours of a record (per sex): its catalogue colours (display, colour; the only
// colours the schema carries; checks is a closed object) plus extra ones the caller passes: a
// --records entry's .cloth[sex], measured by the build (만들기.json, loadRecordDir), as [r,g,b] or
// '#rrggbb'. Not the atlas's own dominant colours: the basic's cream trims and its baked skin share
// bins (measured), so an atlas palette would excuse the very band the probes look for.
function clothColours(record,sex,extra=[]){
  const hex=h=>/^#[0-9a-f]{6}$/i.test(h||'')?[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)):null,out=[];
  for(const h of [record.catalog?.[sex]?.display,record.catalog?.[sex]?.colour,...[].concat(extra||[])]){
    if(typeof h==='string'&&hex(h))out.push(hex(h));else if(Array.isArray(h)&&h.length===3&&h.every(Number.isFinite))out.push(h.map(v=>Math.max(0,Math.min(255,Math.round(v)))));}
  return out;
}
// CIELAB (D65) → sRGB 0..255 (the build's mainLab).
function labToRgb([Lv,a,b]){
  const fy=(Lv+16)/116,fx=fy+a/500,fz=fy-b/200,inv=t=>t**3>.008856?t**3:(t-16/116)/7.787;
  const X=.95047*inv(fx),Y=1*inv(fy),Z=1.08883*inv(fz);
  const lin=[3.2406*X-1.5372*Y-.4986*Z,-.9689*X+1.8758*Y+.0415*Z,.0557*X-.2040*Y+1.0570*Z];
  return lin.map(c=>{c=Math.max(0,Math.min(1,c));return Math.round(255*(c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055));});
}
// Scratch garment index + record data files, served over the tree (overlay):
// specs [{id, from, status?, atlas: 'copy'|'missing'}] (from = a record id in the index).
function writeOverlayIndex(dir,specs){
  fs.mkdirSync(path.join(dir,'assets'),{recursive:true});const overlay={};
  const sandbox={};sandbox.window=sandbox;sandbox.globalThis=sandbox;vm.runInNewContext(fs.readFileSync(path.join(ROOT,'assets/sd-garments-index.js'),'utf8'),sandbox);
  const index=JSON.parse(JSON.stringify(sandbox.QPFoundationGarmentIndex));
  for(const s of specs){
    const from=S.readRecord(path.join(ROOT,index.records[s.from].files.data)),r=JSON.parse(JSON.stringify(from)),stem=S.stem(s.id);
    r.id=s.id;r.shape=s.id.split(':')[1];if(s.status)r.status=s.status;
    for(const sex of Object.keys(r.sexes)){const atlas='assets/sd-garment-'+stem+'-'+sex+'.png';r.sexes[sex].atlas=atlas;if(s.atlas!=='missing')overlay[atlas]=path.join(ROOT,from.sexes[sex].atlas);}
    const data='assets/sd-garment-'+stem+'.js',file=path.join(dir,data);
    fs.writeFileSync(file,'/* scratch record (tools/verify-foundation-garments.cjs control), never deployed */\n(function(root){const record='+JSON.stringify(r)+';const records=root.QPFoundationGarmentRecords||(root.QPFoundationGarmentRecords=Object.create(null));records[record.id]=record;if(root.QPFoundationGarments&&typeof root.QPFoundationGarments.define==="function")root.QPFoundationGarments.define(record);})(window);\n');
    overlay[data]=file;index.records[s.id]={...index.records[s.from],status:r.status,sexes:Object.keys(r.sexes).sort(),files:{data,...Object.fromEntries(Object.keys(r.sexes).map(sex=>[sex,r.sexes[sex].atlas])),bundle:'assets/avatar-file-data-garment-'+stem+'.js'}};
  }
  const idx=path.join(dir,'assets/sd-garments-index.js');fs.writeFileSync(idx,'/* scratch index (verify-foundation-garments control) */\n(function(root){root.QPFoundationGarmentIndex='+JSON.stringify(index)+';})(typeof window==="undefined"?globalThis:window);\n');
  overlay['assets/sd-garments-index.js']=idx;return overlay;
}
// avatar-foundation-outfit.js with the garment id stripped from the one key builder.
function stripKeyOverlay(dir){
  const src=fs.readFileSync(path.join(ROOT,'avatar-foundation-outfit.js'),'utf8'),from="const gk=(gid,...k)=>[gid,...k].join(':');",to="const gk=(gid,...k)=>k.join(':');";
  if(!src.includes(from))throw Error('stripKeyOverlay: gk() not found as expected in avatar-foundation-outfit.js');
  fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'avatar-foundation-outfit.gk-stripped.js');fs.writeFileSync(file,src.replace(from,to));return{'avatar-foundation-outfit.js':file};
}
// A labelled RGBA sheet from decoded images: rows of tiles with an optional zoom (nearest).
function compose(tiles,{cols,pad=4,bg=[238,241,245,255]}){
  const w=Math.max(...tiles.map(t=>t.width)),h=Math.max(...tiles.map(t=>t.height)),rows=Math.ceil(tiles.length/cols),W=cols*(w+pad)+pad,Hh=rows*(h+pad)+pad,data=Buffer.alloc(W*Hh*4);
  for(let i=0;i<W*Hh;i++)data.set(bg,i*4);
  tiles.forEach((t,k)=>{const ox=pad+(k%cols)*(w+pad),oy=pad+Math.floor(k/cols)*(h+pad);for(let y=0;y<t.height;y++)t.data.copy(data,((oy+y)*W+ox)*4,y*t.width*4,(y+1)*t.width*4);});
  return{width:W,height:Hh,data};
}
function zoom(img,f){const W=img.width*f,Hh=img.height*f,data=Buffer.alloc(W*Hh*4);for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const s=((Math.floor(y/f))*img.width+Math.floor(x/f))*4;data[(y*W+x)*4]=img.data[s];data[(y*W+x)*4+1]=img.data[s+1];data[(y*W+x)*4+2]=img.data[s+2];data[(y*W+x)*4+3]=img.data[s+3];}return{width:W,height:Hh,data};}
module.exports={ROOT,MAGENTA,ALIASES,loadRecordDir,recordsOption,pageLib,openRuntime,install,registerAll,registerInStudio,capture,dataUrlPng,px,dist,isMagenta,skinPalette,clothColours,labToRgb,writeOverlayIndex,stripKeyOverlay,compose,zoom,M,H,S};
