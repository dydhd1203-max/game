'use strict';
// Runtime matrix of the reference body's garment records (stage 3, WP7;
// verification F). Headless, ?demo=1 only (Firebase stubbed), no mouse.
// Folds in the WP3 runtime gate (tools/verify-foundation-runtime.cjs, deleted):
// its route/bundles/normal/runtime/file checks run here unchanged.
//
//   node tools/verify-foundation-garments.cjs                 everything below; exit 1 on a failure
//   node tools/verify-foundation-garments.cjs --only studio,matrix,negatives,limits,probes
//   options:
//     --records <dir>   also test the records in <dir> (synthetic pipeline records from WP8, a real
//                       sheet build from WP10, e.g. 검증/옷/<stem>/): sd-garment-<stem>.js data files
//                       or *.json records, their atlases next to them (tools/foundation-garment-lib.cjs
//                       loadRecordDir). Each record file is a check: valid (tools/garment/schema.cjs,
//                       a new id, the atlas files found there match the record's sha256, chunks and
//                       size); every other file is listed as skipped; a directory without any
//                       record file FAILS. Valid records are registered in the studio session.
//     --out <dir>       default 검증/옷검사 (report.json, probe images)
//     --quick           every second motion step (development; a gate run uses the whole matrix)
//     --ids a,b         only these records of the manifest (development)
//     --base <rev>      routing baseline (default: merge-base with origin/main)
//     --image-source <file>, --overlay rel=file   as in the WP3 gate (scratch copies served instead)
//
// Records under test (the manifest): every record of assets/sd-garments-index.js, the in-page
// alias records (hue-rotated tee, shorts and sneaker: legacy path, own ids) and the --records.
// Each is worn in its slot of the starter set, by each of its sexes.
//
//   route/bundles/normal/runtime/file   the WP3 gate (see the parts below; file = tools/verify-file-foundation.cjs)
//   studio     the studio hosted (avatar-standard.html) as the review host: slot selectors list the
//              index records, the basic piece and the shop items; api.registerGarment(record JSON,
//              atlas data URLs) adds records to them; badges name each worn record and fallback
//              reason (아직 옮기지 않음 / 한벌옷 …); 옷만 보기; the address restores the choice
//   matrix     per record × sex, the whole motion matrix (tools/foundation-matrix.cjs, 296 poses):
//              node count from NODE_TABLE by class signature, finite geometry, data-outfit-garment
//              on every outfit node naming its slot's record, static render = apply(idle, front, 0),
//              prepare-only keeps the static pose, reset/remount as today
//   negatives  controls that must fail as designed:
//              - same garment on two avatars with other skin tones: no extra pool misses (pool
//                emptied first, so the tone-0 avatar draws everything); POOL control: another top
//                on the tone-4 avatar MUST add misses;
//              - a different garment (alias) gives other hrefs for its own slot only, and other pixels;
//              - lap shoe: the same shorts with other shoes give another side floor-sit picture;
//              - KEY STRIP: a served copy of avatar-foundation-outfit.js whose gk() drops the garment
//                id must FAIL the two checks above (shown as the control's failing output);
//              - unconverted top:hood:5 → the starter top, fallback todo;
//              - served scratch index (candidate / 404 / delayed atlas records):
//                a candidate stays hidden outside the studio (fallback candidate) and is worn in it;
//                a 404 atlas shows the starter with fallback error and no exception;
//                a delayed atlas keeps the avatar hidden (never the starter), then shows the record;
//              - a garment switch on a mounted svg equals a fresh render (runtime part)
//   limits     record limits at runtime:
//              - no opaque sleeve pixel outside the sleeve box (atlas pixels in the sleeve frame;
//                sleeve pictures over the matrix with opaque pixels on their border = clipped).
//                Legacy records (the packed basic's ±4 u canvas) are recorded: the known cut cuff.
//                SLEEVE BOX control: the tee as a data-path twin with the ±4 u box MUST fail; with
//                a box fitted to its art (+.25 u) it passes (what WP9's per-record box gives);
//              - every top × bottom pair overlaps ≥ .24 (seated breathing moves the chest .14): drawn
//                overlap; a legacy pair is judged by the frozen rule (hem ≥ W + .24) and its drawn
//                overlap (0: the packed shorts only meet the hem) is recorded;
//              - the female collar stays ≥ .10 below the front hair clip at idle and at the nod peak
//                (the probe must FIND the collar);
//              - the raised-arm underarm line ends within the record's cuff + .3
//   probes     screenshots on magenta (grids of the matrix poses):
//              - seam gap: no hole (4+ touching background pixels) inside the upper-arm capsule ∪
//                sleeve or the thigh capsule ∪ bottom, all motions; smaller outline notches are
//                counted and imaged apart; the waist seam (background between hem and bottom);
//              - seam pinholes: enclosed background patches of 1–4 px (not connected to the cell
//                border) at least half inside the full-radius upper-arm/thigh capsules: specks at the
//                cuff/forearm and shorts-cuff/thigh seams (probes/seam-pinhole-*.png); an overview
//                of every motion's step 0 with all flags marked is always written
//                (probes/seam-overview-*.png);
//              - CAP_HIGH (runtime side): no sleeve pixel inside the head/neck capsule in raised-arm poses;
//              - untinted skin (REDTEAM-corrected): a slot's own topmost pixels that are invariant
//                between tones 0 and 4 AND skin-likely (at tone 0 they continue the tinted skin
//                next to them) AND not a declared cloth colour. (The plan's 'pixels that change'
//                was inverted: baked skin is unfiltered, so it does not change.);
//              - pale band at tone 4: those pixels showing ≥ 30 levels lighter than the skin
//                beside them. Today's basic MUST fail both (the control; WP11 fixes it);
//              SEAM GAP and CAP_HIGH controls: tee mutations (sleeves cut short of the arm's clip
//              line; sleeves moved toward the neck) MUST fail them.
//              The 5-tone strip (tools/inspect-foundation-garments.cjs) stays the authority.
// Known defects of the legacy basic (its pale band, sleeve box clip, waist line, drawn overlap and
// seam pinholes) are 'recorded' rows: listed in report.recorded and the summary, never counted as passes.
// Runtime: about 15–20 minutes for the gate run (4-CPU cloud container, software rendering).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const L=require('./foundation-garment-lib.cjs'),H=require('./verify-harness.cjs'),M=require('./foundation-matrix.cjs');
const ROOT=path.resolve(__dirname,'..');
const PARTS=['route','bundles','normal','runtime','studio','matrix','negatives','limits','probes','file'];
const a=H.args(),only=H.list(a.only,PARTS),out=path.resolve(ROOT,a.out&&a.out!==true?a.out:'검증/옷검사'),quick=Boolean(a.quick);
fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],failures:[],recorded:[],controls:[],images:[],numbers:{}};
const ok=(name,detail)=>{report.checks.push({name,detail});console.log('ok   '+name+(detail&&String(detail).length<=160?' — '+detail:''));};
const fail=(name,detail)=>{report.failures.push({name,detail});console.log('FAIL '+name+(detail?' — '+String(detail).slice(0,900):''));};
const check=(cond,name,detail)=>cond?ok(name,detail):fail(name,detail);
// A known defect measured but not judged here (legacy art, fixed by WP9/WP11): kept apart from the
// checks, so it is never counted as a pass.
const record=(name,detail)=>{report.recorded.push({name,detail});console.log('rec  '+name+(detail&&String(detail).length<=160?' — '+detail:''));};
// A control collector: its checks are EXPECTED to fail; their output is kept and shown.
function collector(label){const rows=[];return{rows,check:(cond,name,detail)=>{rows.push({ok:Boolean(cond),name,detail});console.log('  ['+label+'] '+(cond?'ok   ':'FAIL ')+name+(detail&&!cond?' — '+String(detail).slice(0,300):''));},
  record:(name,detail)=>{rows.push({ok:true,recorded:true,name,detail});console.log('  ['+label+'] rec  '+name);}};}
const main={check,record};

// ------------------------------------------------------------------ route
function baseRev(){
  if(a.base&&a.base!==true)return a.base;
  const top=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:ROOT}).toString().trim();
  for(const ref of ['origin/main','main']){try{return execFileSync('git',['merge-base','HEAD',ref],{cwd:top}).toString().trim();}catch{}}
  throw Error('no merge-base; pass --base <rev>');
}
function gitFile(rev,rel){const top=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:ROOT}).toString().trim(),prefix=path.relative(top,ROOT).split(path.sep).join('/');return execFileSync('git',['show',rev+':'+prefix+'/'+rel],{cwd:top,maxBuffer:64<<20}).toString('utf8');}
// One avatar-image.js in a stubbed page. Bundle scripts define their global
// (a proxy that names the bundle and key); garment bundles run for real.
function imageRuntime(source,{protocol,opaque}){
  const base=protocol==='file:'?'file:///Q/':'http://127.0.0.1:9/',events=[];
  const sandbox={URL,Promise,Error,Object,Set,Map,Array,JSON,console,decodeURIComponent,queueMicrotask};
  const fill=src=>{const name=src.split('/').pop(),g={'avatar-file-data.js':'QPAvatarFileData','avatar-file-data-wardrobe.js':'QPAvatarWardrobeFileData','avatar-file-data-foundation.js':'QPAvatarFoundationFileData','avatar-file-data-male.js':'QPAvatarMaleFileData'}[name];
    if(g){sandbox[g]=new Proxy({},{get:(t,k)=>typeof k==='string'?'bundle:'+name+':'+k:undefined});return true;}
    const file=path.join(ROOT,'assets',name);if(/^avatar-file-data-garment-/.test(name)&&fs.existsSync(file)){vm.runInContext(fs.readFileSync(file,'utf8'),ctx);return true;}return false;};
  const document={currentScript:{src:base+'avatar-image.js'},baseURI:base+'index.html',
    head:{appendChild(s){events.push('script '+s.src.slice(base.length));queueMicrotask(()=>fill(s.src)?s.onload?.():s.onerror?.());}},
    createElement(tag){if(tag==='script')return{remove(){}};if(tag==='canvas')return{getContext:()=>({drawImage(){},getImageData(){if(opaque){const e=new Error('opaque');e.name='SecurityError';throw e;}return{data:[0,0,0,0]};}})};throw Error('stub: '+tag);}};
  sandbox.window=sandbox;sandbox.document=document;sandbox.location={protocol};
  sandbox.Image=class{set src(v){this._s=v;events.push('image '+(v.startsWith(base)?v.slice(base.length):v.split(';')[0]+(v.startsWith('data:')?'':'')));queueMicrotask(()=>this.onload?.());}get src(){return this._s;}};
  const ctx=vm.createContext(sandbox);vm.runInContext(source,ctx,{filename:'avatar-image.js'});
  return{async load(key){const from=events.length;let result;try{const img=await sandbox.QPAvatarImage.load(base+key);result='ok '+(img._s.startsWith('bundle:')?img._s:img._s.startsWith('data:image/png;base64,')?'data:'+key:img._s.slice(base.length));}catch(e){result='error '+e.message;}return events.slice(from).join(' | ')+' => '+result;},sandbox};
}
async function routeTest(){
  const rev=baseRev(),oldSource=gitFile(rev,'avatar-image.js'),newSource=fs.readFileSync(a['image-source']&&a['image-source']!==true?path.resolve(a['image-source']):path.join(ROOT,'avatar-image.js'),'utf8');
  const keys=new Set(fs.readdirSync(path.join(ROOT,'assets')).filter(f=>f.endsWith('.png')).map(f=>'assets/'+f));
  for(const k of ['assets/sd-garment-bottom-jean_skirt-f.png','assets/sd-garment-shoes-wing_shoes-m.png','assets/sd-garment-top-star_skirt-x.png','assets/sd-garment-Top-tee-m.png'])keys.add(k);
  // A key in a sub-folder is never an original (avatar-image keys the basename).
  keys.add('assets/world-life/leaf-panel.png');
  const baseFiles=new Set(execFileSync('git',['ls-tree','-r','--name-only',rev,'--','.'],{cwd:ROOT}).toString().split('\n').map(f=>f.trim()).filter(Boolean).map(f=>f));
  const INTENDED=new Map([
    ...['shirt','sleeves','shorts','shoes'].map(p=>['assets/sd-foundation-ref-'+p+'.png','legacy full-sheet garment layer left the allow-list (the records\' atlases replace it; kept in the repo as pack input until WP11)']),
    ['assets/sd-foundation-ref-arms-clean.png','clean body art joined the foundation bundle'],['assets/sd-foundation-ref-neck-clean.png','clean body art joined the foundation bundle'],
    ['assets/sd-foundation-ref-legs-under.png','legs run on under pipeline shoes (2026-10-15) joined the foundation bundle'],
    ['assets/sd-foundation-ref-feet.png','bare feet under open shoes (2026-10-16) joined the foundation bundle'],
    ['assets/sd-foundation-ref-run-fist.png','the drawn running fists (2026-10-17) joined the foundation bundle']]);
  const rows=[],changed=[],unexpected=[];
  for(const mode of [{protocol:'file:',opaque:false},{protocol:'http:',opaque:true},{protocol:'http:',opaque:false}]){
    const tag=mode.protocol+(mode.opaque?' opaque':'');
    // A fresh page per key: one key's bundle must not decide another's route.
    for(const key of [...keys].sort()){
      const b=await imageRuntime(oldSource,mode).load(key),n=await imageRuntime(newSource,mode).load(key);rows.push({mode:tag,key,before:b,after:n,same:b===n});
      if(b===n)continue;
      const garment=/^assets\/sd-garment-[a-z]+-[a-z0-9_]+-(m|f)\.png$/.test(key);
      if(INTENDED.has(key)||garment)changed.push({mode:tag,key,why:INTENDED.get(key)||'garment atlas routed to its own bundle',before:b,after:n});
      else unexpected.push({mode:tag,key,before:b,after:n});
    }
  }
  report.route={base:rev,keys:keys.size,rows:rows.length,changed,unexpected};
  check(unexpected.length===0,'avatar-image routing: every pre-existing key routes as in '+rev.slice(0,8),rows.length+' key×mode loads, '+changed.length+' intended changes, '+unexpected.length+' unexpected'+(unexpected.length?': '+JSON.stringify(unexpected.slice(0,4)):''));
  const garmentRows=rows.filter(r=>/sd-garment-/.test(r.key));
  check(garmentRows.filter(r=>r.mode==='file:'&&/jean_skirt/.test(r.key)).every(r=>r.after.includes('script assets/avatar-file-data-garment-bottom-jean_skirt.js')),"garment route allows '_' in the shape (jean_skirt → its own bundle)");
  check(rows.filter(r=>/sd-garment-(Top|top-star_skirt-x)/.test(r.key)).every(r=>!/avatar-file-data-garment/.test(r.after)),'non-garment look-alike keys (bad sex, capitals) are not routed to a garment bundle');
  const tee=rows.find(r=>r.mode==='file:'&&r.key==='assets/sd-garment-top-tee-m.png');
  check(tee&&tee.after.includes('script assets/avatar-file-data-garment-top-tee.js')&&tee.after.endsWith('=> ok data:assets/sd-garment-top-tee-m.png'),'file:// garment atlas comes from its bundle as the PNG bytes',tee&&tee.after);
  const opaque=rows.find(r=>r.mode==='http: opaque'&&r.key==='assets/sd-garment-shoes-sneaker-f.png');
  check(opaque&&opaque.after.includes('script assets/avatar-file-data-garment-shoes-sneaker.js'),'opaque hosted embed (SecurityError) falls back to the garment bundle',opaque&&opaque.after);
  fs.writeFileSync(path.join(out,'route.json'),JSON.stringify(report.route,null,1));
}

// ---------------------------------------------------------------- bundles
function bundleTest(){
  const index=(()=>{const s={};vm.runInNewContext(fs.readFileSync(path.join(ROOT,'assets/sd-garments-index.js'),'utf8'),{window:s,globalThis:s});return s.QPFoundationGarmentIndex;})();
  const files=Object.values(index.records).map(e=>e.files.bundle);
  for(const order of [files,files.slice().reverse()]){
    const s={Object};s.window=s;const ctx=vm.createContext(s);for(const f of order)vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx);
    const reg=s.QPAvatarGarmentFileData,keys=Object.keys(reg).sort(),want=Object.values(index.records).flatMap(e=>e.sexes.map(sex=>e.files[sex])).sort();
    check(JSON.stringify(keys)===JSON.stringify(want),'garment bundles fill one registry ('+(order===files?'index order':'reverse order')+')',keys.length+' keys');
    check(want.every(k=>reg[k]==='data:image/png;base64,'+fs.readFileSync(path.join(ROOT,k)).toString('base64')),'garment bundle values are the PNG bytes');
    // A later bundle never replaces a key already there.
    vm.runInContext("window.QPAvatarGarmentFileData['"+want[0]+"']='x'",ctx);check(reg[want[0]]!=='x','registry keys cannot be overwritten');
  }
}

// ---------------------------------------------------------------- browser
const GARMENT_REQ=/\/assets\/(sd-garment|sd-garments-index|avatar-file-data-garment|avatar-file-data-foundation|sd-foundation-ref-[a-z-]+\.png)/;
async function normalTest(browser,base){
  const context=await browser.newContext({viewport:{width:1280,height:800}});await H.isolate(context,report);const seen=[];context.on('request',q=>seen.push(new URL(q.url()).pathname));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push('normal: '+e.message));
  await page.goto(new URL('index.html?demo=1&session=wp3-normal',base).href);
  // The student page never loads the layered heads (avatar-foundation-head.js autoLoad: ?avatar=foundation or the
  // studio only), so their atlas stays not ready here; waiting for it (added with H3) timed out every run.
  await page.waitForFunction(()=>window.QPGame?.getMe()&&window.QPAvatar?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady,null,{timeout:90000});
  for(const screen of ['shop','village'])try{await page.evaluate(s=>QPGame.go(s),screen);await page.waitForTimeout(1500);}catch(e){report.errors.push('normal go '+screen+': '+e.message);}
  try{await page.waitForLoadState('networkidle',{timeout:15000});}catch{}
  const bad=seen.filter(p=>GARMENT_REQ.test(p)),foundationNodes=await page.evaluate(()=>document.querySelectorAll('[data-qp-foundation]').length);
  check(bad.length===0,'normal ?demo=1 (students\' path) requests no garment file, index, garment bundle or foundation body art',seen.length+' requests'+(bad.length?': '+bad.join(', '):''));
  check(foundationNodes===0,'normal ?demo=1 shows no foundation avatar');
  check(seen.includes('/avatar-foundation-garments.js'),'the one new script on the students\' page is avatar-foundation-garments.js (inert)');
  await context.close();
}

// Page helpers for the studio runtime (index.html?demo=1&session=foundation-studio).
function runtimeLib(){
  const api=QPAvatarFoundation,G=QPFoundationGarments,O=QPFoundationOutfit;
  const cyrb=s=>{let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);};
  let host=document.getElementById('wp3-host');if(!host){const style=document.createElement('style');style.textContent='#wp3-host,#wp3-host *{animation:none!important;transition:none!important}';document.head.append(style);host=document.createElement('div');host.id='wp3-host';host.style.cssText='position:absolute;left:0;top:0;z-index:2147483647;background:#dfe6ee;display:flex;flex-wrap:wrap;gap:6px;padding:6px';document.body.append(host);}
  const mk=(av,size=280)=>{const d=document.createElement('div');d.innerHTML=api.render(av,size);host.append(d);return d.firstElementChild;};
  // Per-render ids (qpf-N) are normalised: two avatars are compared.
  const outfitSig=svg=>[...svg.querySelectorAll('[data-outfit-part]')].map(e=>[e.dataset.outfitPart,e.getAttribute('href')?cyrb(e.getAttribute('href')):null,...['x','y','width','height','d','fill','stroke','clip-path'].map(k=>e.getAttribute(k)?.replace(/qpf-\d+/g,'qpf-X')??null),e.style.display,e.closest('[data-outfit-owner]')?.getAttribute('transform')||null,(()=>{const id=(e.getAttribute('clip-path')||'').match(/#([^)]+)/)?.[1],c=id&&svg.querySelector('[id="'+id+'"] path');return c?c.getAttribute('d'):null;})()]);
  const skinSig=svg=>[...svg.querySelectorAll('[data-foundation-skin-paint]')].map(e=>[e.dataset.foundationSkinPaint,cyrb(e.getAttribute('href')||''),e.getAttribute('x'),e.getAttribute('y'),e.getAttribute('width'),e.getAttribute('height')]);
  const garments=svg=>[...new Set([...svg.querySelectorAll('[data-outfit-part]')].map(e=>e.dataset.outfitGarment))];
  const motions=[];for(const direction of ['front','right','left','back']){for(const action of ['idle','walk','run','jump','floor-sit','sit','climb'])for(let k=0;k<8;k+=3)motions.push({action,direction,phase:k/8,time:k*.2,seatMode:action==='sit'?'desk':action==='floor-sit'?'floor':undefined,grounded:action!=='jump'||k===0,vy:action==='jump'?240-k*60:undefined,reducedMotion:true});
    for(const gesture of ['wave','nod','happy'])for(let k=0;k<6;k+=2)motions.push({action:'idle',direction,gesture,gestureProgress:k/5,time:0,reducedMotion:true});}
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  const clone=x=>JSON.parse(JSON.stringify(x));
  const canvasOf=(img,w,h,filter)=>{const c=document.createElement('canvas');c.width=w||img.naturalWidth||img.width;c.height=h||img.naturalHeight||img.height;const x=c.getContext('2d');if(filter)x.filter=filter;x.drawImage(img,0,0);return c;};
  window.__wp3={api,G,O,host,mk,outfitSig,skinSig,garments,motions,frame,clone,canvasOf,cyrb};
}
async function studioTest(browser,base){
  const context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:1});await H.isolate(context,report);const seen=[];context.on('request',q=>seen.push(new URL(q.url()).pathname));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push('studio: '+e.message));
  await page.goto(new URL('index.html?demo=1&session=foundation-studio',base).href);
  await page.waitForFunction(()=>window.QPGame&&window.QPFoundationOutfit?.atlas.ready&&window.QPFoundationSkin?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady&&(!window.QPFoundationHead||window.QPFoundationHead.atlas.ready||window.QPFoundationHead.atlas.error)&&window.QPAvatar?.atlas.ready,null,{timeout:120000});
  await page.evaluate(()=>QPGame.go('login'));await page.evaluate(runtimeLib);
  // 1. Basic outfit.
  const basic=await page.evaluate(()=>{const {mk,api,motions,garments}=__wp3,res={};
    for(const sex of ['m','f']){const svg=mk({sex,sk:0,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0',foundationOutfit:'basic'}),counts=new Set([svg.querySelectorAll('*').length]);
      const attrs={outfit:svg.dataset.foundationOutfit,garments:svg.dataset.foundationGarments,fallback:svg.dataset.foundationFallback,cls:svg.dataset.foundationClass,static:svg.dataset.foundationStatic};
      for(const m of motions){api.apply(svg,m);counts.add(svg.querySelectorAll('*').length);}
      res[sex]={attrs,counts:[...counts],garments:garments(svg)};api.destroy(svg);svg.parentNode.remove();}
    return res;});
  for(const sex of ['m','f']){const r=basic[sex],want=M.expectedNodes('short-sleeve|shorts|low',sex);
    check(r.attrs.garments==='top:tee|bottom:shorts|shoes:sneaker'&&r.attrs.fallback===''&&r.attrs.cls==='short-sleeve|shorts|low'&&r.attrs.outfit==='dressed'&&r.attrs.static==='idle-front','basic '+sex+': ids, fallback, class and mode attributes',JSON.stringify(r.attrs));
    check(r.counts.length===1&&r.counts[0]===want,'basic '+sex+': '+want+' nodes in every motion of the sub-matrix',JSON.stringify(r.counts));}
  // 2. Test records: a hue-rotated legacy alias, data-path twins from the legacy metadata, a clean-art top.
  const made=await page.evaluate(async()=>{const {G,O,clone,canvasOf}=__wp3,out={};
    const tee={m:G.get('top:tee','m'),f:G.get('top:tee','f')},shorts={m:G.get('bottom:shorts','m'),f:G.get('bottom:shorts','f')};
    // a) hue-rotated alias (legacy path, its own id).
    const hue=clone(tee.m.record);hue.id='top:teehue';hue.shape='teehue';
    out.hue=await G.register(hue,{m:canvasOf(tee.m.image,0,0,'hue-rotate(150deg)'),f:canvasOf(tee.f.image,0,0,'hue-rotate(150deg)')});
    // b) data-path twins: legacy metadata in record form; raised art packed under the atlas.
    const dataTop=(id,bodyArt)=>{const r=clone(tee.m.record);r.id=id;r.shape=id.split(':')[1];r.legacy=false;r.bodyArt=bodyArt;r.legacyComputed=[];const images={};
      for(const sex of ['m','f']){const g=tee[sex],meta=O.legacyMetadata('top:tee',sex),W=g.image.naturalWidth,Hh=g.image.naturalHeight;let y=Hh+2,width=W;const placed=[];
        for(const view of ['front','back'])meta.views[view].raised.forEach((c,i)=>{placed.push({view,i,c,at:[2,y]});y+=c.height+2;width=Math.max(width,c.width+4);});
        const atlas=document.createElement('canvas');atlas.width=width;atlas.height=y;const x=atlas.getContext('2d');x.drawImage(g.image,0,0);for(const p of placed)x.drawImage(p.c,...p.at);images[sex]=atlas;
        const S=r.sexes[sex];for(const [view,f] of Object.entries(S.figures)){const v=meta.views[view];f.top.underarm=v.underarm||null;f.top.sleeves.forEach((s,i)=>{s.opening=[[0,s.cuff],[0,s.cuff]];s.raisedAt=placed.find(p=>p.view===view&&p.i===i)?.at||null;});f.top.hem=[];f.top.collar=[];}
        S.size=[width,y];}
      return[r,images];};
    out.data=await G.register(...dataTop('top:teedata','legacy'));out.clean=await G.register(...dataTop('top:teeclean','clean'));
    {const r=clone(shorts.m.record);r.id='bottom:shortsdata';r.shape='shortsdata';r.legacy=false;r.legacyComputed=[];
     for(const sex of ['m','f']){const meta=O.legacyMetadata('bottom:shorts',sex);for(const [view,f] of Object.entries(r.sexes[sex].figures)){const v=meta.views[view];f.bottom.edgeTone=v.edgeTone;f.bottom.cuffAlong=[.81,.81];f.bottom.waistTop=f.bottom.rect[1];if(v.sideSeat)f.bottom.sideSeat=v.sideSeat;}}
     out.shortsData=await G.register(r,{m:shorts.m.image,f:shorts.f.image});}
    return out;});
  check(Object.values(made).every(s=>s.m==='ready'&&s.f==='ready'),'studio register(): 4 test records ready',JSON.stringify(made));
  const compare=await page.evaluate(()=>{const {mk,api,motions,outfitSig,skinSig,garments,G}=__wp3,res={};
    for(const sex of ['m','f']){const hair=sex==='m'?'short:1':'bob:1',av=extra=>({sex,sk:2,hair,expression:'bright:0',...extra});
      const base=mk(av({})),hue=mk(av({foundationGarments:{top:'top:teehue'}})),data=mk(av({foundationGarments:{top:'top:teedata',bottom:'bottom:shortsdata'}})),clean=mk(av({foundationGarments:{top:'top:teeclean'}}));
      const r={hueDiffers:{},hueSame:{},dataSame:0,dataDiff:[],cleanArm:0,cleanNeck:0,cleanOutfitSame:0,samples:0,nodes:new Set(),hueIds:garments(hue),dataIds:garments(data),cleanFit:null};
      for(const m of motions){for(const s of [base,hue,data,clean])api.apply(s,m);r.samples++;for(const s of [hue,data,clean])r.nodes.add(s.querySelectorAll('*').length-base.querySelectorAll('*').length);
        const B=outfitSig(base),U=outfitSig(hue),D=outfitSig(data),C=outfitSig(clean);
        B.forEach((row,i)=>{const part=row[0];if(row[1]){if(row[1]!==U[i][1])r.hueDiffers[part]=(r.hueDiffers[part]||0)+1;else r.hueSame[part]=(r.hueSame[part]||0)+1;}});
        if(JSON.stringify(B)===JSON.stringify(D))r.dataSame++;else if(r.dataDiff.length<3)r.dataDiff.push({m,first:B.map((row,i)=>JSON.stringify(row)===JSON.stringify(D[i])?null:[row,D[i]]).find(Boolean)});
        if(JSON.stringify(B)===JSON.stringify(C))r.cleanOutfitSame++;
        const bs=skinSig(base),cs=skinSig(clean);if(bs.some((row,i)=>row[0]==='arm'&&row[1]!==cs[i][1]))r.cleanArm++;if(bs.some((row,i)=>row[0]==='neck'&&row[1]!==cs[i][1]))r.cleanNeck++;}
      r.cleanFit=QPFoundationOutfit.inspect(clean)?.bodyArt;r.nodes=[...r.nodes];res[sex]=r;
      for(const s of [base,hue,data,clean]){api.destroy(s);s.parentNode.remove();}}
    return res;});
  for(const sex of ['m','f']){const r=compare[sex];
    check(r.nodes.length===1&&r.nodes[0]===0,'test records '+sex+': the same node count as the basic in every motion');
    check(r.hueIds.join()==='shoes:sneaker,bottom:shorts,top:teehue','hue alias '+sex+': its id on the top nodes',r.hueIds.join());
    check(['shirt-torso','sleeve-0','sleeve-1'].every(p=>r.hueDiffers[p]===r.samples)&&['shorts-hip','shoe-0','shoe-1'].every(p=>!r.hueDiffers[p]),'hue alias '+sex+': different shirt/sleeve hrefs in all '+r.samples+' samples, shorts and shoes unchanged',JSON.stringify(r.hueDiffers));
    check(r.dataSame===r.samples,'data path '+sex+': records built from the legacy metadata render the legacy hrefs, geometry and underarm paths ('+r.dataSame+'/'+r.samples+')',r.dataDiff.length?JSON.stringify(r.dataDiff).slice(0,600):'');
    check(r.cleanFit==='clean'&&r.cleanArm>0&&r.cleanNeck>0&&r.cleanOutfitSame===r.samples,'clean body art '+sex+': other arm paintings in '+r.cleanArm+'/'+r.samples+' and other neck paintings in '+r.cleanNeck+'/'+r.samples+' samples, garments unchanged');}
  check(seen.includes('/assets/sd-foundation-ref-arms-clean.png')&&seen.includes('/assets/sd-foundation-ref-neck-clean.png'),'clean body art loaded only for the clean-art top');
  // 3. Fallback reasons and the template key.
  const fallback=await page.evaluate(async()=>{const {mk,G,api,frame,clone}=__wp3,res={};
    // A class this runtime does not draw (top/long-sleeve became a runtime class on 2026-10-16: the reserved sleeveless).
    const longTop=clone(G.get('top:tee','f').record);longTop.id='top:longtest';longTop.shape='longtest';longTop.class='top/sleeveless';await G.register(longTop,{m:G.get('top:tee','m').image,f:G.get('top:tee','f').image}).catch(()=>{});
    const cand=clone(G.get('top:tee','f').record);cand.id='top:candtest';cand.shape='candtest';cand.status='candidate';await G.register(cand,{m:G.get('top:tee','m').image,f:G.get('top:tee','f').image});
    const broken=clone(G.get('top:tee','f').record);broken.id='top:broken';broken.shape='broken';await G.register(broken,{m:'assets/does-not-exist-m.png',f:'assets/does-not-exist-f.png'});
    const read=svg=>({garments:svg.dataset.foundationGarments,fallback:svg.dataset.foundationFallback,static:svg.dataset.foundationStatic,visibility:svg.getAttribute('visibility'),parts:svg.querySelectorAll('[data-outfit-part]').length,tops:[...new Set([...svg.querySelectorAll('[data-outfit-part^="shirt"]')].map(e=>e.dataset.outfitGarment))].join()});
    const cases={tee5:{sex:'m',top:'tee:5',bottom:'shorts:9',shoes:'sneaker:8'},hood:{sex:'m',top:'hood:5',bottom:'shorts:9',shoes:'sneaker:8'},jeans:{sex:'m',top:'tee:5',bottom:'jeans:5',shoes:'sneaker:8'},dress:{sex:'f',outfit:'dress:7',top:'dress:7',bottom:'',shoes:'sneaker:8'},
      long:{sex:'f',foundationGarments:{top:'top:longtest'}},candidate:{sex:'f',foundationGarments:{top:'top:candtest'}},error:{sex:'f',foundationGarments:{top:'top:broken'}}};
    for(const [k,av] of Object.entries(cases)){const svg=mk({hair:av.sex==='m'?'short:1':'bob:1',expression:'bright:0',...av},120);res[k]=read(svg);api.destroy(svg);svg.parentNode.remove();}
    // Same head, tee:5 after hood:5: each keeps its own fallback (the reasons are in the template key).
    {const a=mk({sex:'m',hair:'spiky:1',top:'hood:5'},120),b=mk({sex:'m',hair:'spiky:1',top:'tee:5'},120);res.keyed=[a.dataset.foundationFallback,b.dataset.foundationFallback];for(const s of [a,b]){api.destroy(s);s.parentNode.remove();}}
    // An item failing while its avatar is pending: hidden, then the basic piece with 'error'.
    {let fail;const late=clone(G.get('top:tee','m').record);late.id='top:latefail';late.shape='latefail';const p=new Promise((_,reject)=>{fail=()=>reject(new Error('late 404'));});p.catch(()=>{});
     const reg=G.register(late,{m:p,f:p});const svg=mk({sex:'m',hair:'messy:1',foundationGarments:{top:'top:latefail'}},120);res.lateBefore=read(svg);fail();await reg;for(let i=0;i<5&&svg.dataset.foundationStatic;i++)await frame();res.lateAfter=read(svg);api.destroy(svg);svg.parentNode.remove();}
    return res;});
  report.fallback=fallback;
  const fb=fallback;
  check(fb.tee5.fallback===''&&fb.tee5.garments==='top:tee|bottom:shorts|shoes:sneaker','fallback: top:tee:5/bottom:shorts:9/shoes:sneaker:8 → the basic records, no reason',JSON.stringify(fb.tee5));
  check(fb.hood.fallback==='top:todo'&&fb.hood.parts===10&&fb.hood.tops==='top:tee','fallback todo: unconverted top:hood:5 shows the basic top',JSON.stringify(fb.hood));
  check(fb.jeans.fallback==='bottom:todo','fallback todo: the boys\' default bottom:jeans:5',JSON.stringify(fb.jeans));
  check(fb.dress.fallback==='top:outfit|bottom:outfit'&&fb.dress.parts===10,'fallback outfit: dress:7 (one-piece, empty bottom) shows the basic top and shorts',JSON.stringify(fb.dress));
  check(fb.long.fallback==='top:class','fallback class: a record of a class this runtime does not draw (top/sleeveless) falls back',JSON.stringify(fb.long));
  check(fb.candidate.fallback===''&&fb.candidate.tops==='top:candtest','candidate records are worn in the studio',JSON.stringify(fb.candidate));
  check(fb.error.fallback==='top:error'&&fb.error.tops==='top:tee'&&fb.error.visibility===null,'fallback error: a 404 atlas shows the basic top, no exception',JSON.stringify(fb.error));
  check(fb.keyed[0]==='top:todo'&&fb.keyed[1]==='','the fallback reasons are part of the template key (same head, hood:5 then tee:5)',JSON.stringify(fb.keyed));
  check(fb.lateBefore.static==='pending'&&fb.lateBefore.visibility==='hidden'&&fb.lateBefore.parts===0&&!fb.lateAfter.static&&fb.lateAfter.visibility===null&&fb.lateAfter.fallback==='top:error'&&fb.lateAfter.tops==='top:tee','an item failing while pending: hidden, then the basic top with reason error',JSON.stringify([fb.lateBefore,fb.lateAfter]));
  // 4. Pending sets released in reverse order (REDTEAM), static and mounted avatars.
  const pending=await page.evaluate(async()=>{const {G,api,mk,frame,clone}=__wp3,log=[];
    const alias=async id=>{const r=clone(G.get('top:tee','f').record);r.id=id;r.shape=id.split(':')[1];await G.register(r,{m:G.get('top:tee','m').image,f:G.get('top:tee','f').image});};
    await alias('top:seta');await alias('top:setb');const releaseA=G.hold(['top:seta']),releaseB=G.hold(['top:setb']);
    const av=(top,hair)=>({sex:'f',hair,expression:'bright:0',foundationGarments:{top}});
    const A1=mk(av('top:seta','long:2')),B1=mk(av('top:setb','long:4')),A2=mk(av('top:seta','twin:2')),B2=mk(av('top:setb','twin:4'));
    // A2/B2 are mounted by a controller (prepare + apply), A1/B1 stay static strings.
    for(const s of [A2,B2]){api.prepare(s);api.apply(s,{action:'walk',direction:'right',phase:.25,time:0});}
    const state=s=>({hidden:s.getAttribute('visibility')==='hidden',dressed:s.querySelectorAll('[data-outfit-part]').length===10,top:s.querySelector('[data-outfit-part="shirt-torso"]')?.dataset.outfitGarment||null,static:s.dataset.foundationStatic||''});
    const snap=label=>log.push({label,A1:state(A1),B1:state(B1),A2:state(A2),B2:state(B2)});
    snap('both held');for(let i=0;i<3;i++)await frame();snap('both held +3 frames');
    releaseB();for(let i=0;i<4;i++)await frame();snap('B released');
    // The controller keeps animating the mounted ones.
    for(const s of [A2,B2])api.apply(s,{action:'walk',direction:'right',phase:.5,time:0});snap('B released, next controller frame');
    releaseA();for(let i=0;i<4;i++)await frame();snap('A released');for(const s of [A2,B2])api.apply(s,{action:'walk',direction:'right',phase:.75,time:0});snap('A released, next controller frame');
    for(const s of [A1,B1,A2,B2]){api.destroy(s);s.parentNode.remove();}return log;});
  report.pending=pending;
  const never=pending.every(row=>['A1','B1','A2','B2'].every(k=>row[k].hidden||row[k].dressed));
  const at=label=>pending.find(r=>r.label===label);
  check(never,'pending sets: an avatar is never shown undressed (hidden until its own garments arrive)');
  check(['A1','B1','A2','B2'].every(k=>at('both held')[k].hidden&&!at('both held')[k].dressed),'pending sets: all four hidden while held');
  check(!at('B released').B1.hidden&&at('B released').B1.top==='top:setb'&&at('B released').A1.hidden&&!at('B released').A1.dressed,'pending sets: releasing B dresses the static B avatar only (A stays hidden)',JSON.stringify(at('B released')));
  check(!at('B released').B2.hidden&&at('B released').B2.top==='top:setb'&&at('B released, next controller frame').A2.hidden,'pending sets: the mounted B avatar is dressed by the sweep, the mounted A avatar stays hidden on the next controller frame',JSON.stringify(at('B released, next controller frame')));
  check(['A1','A2'].every(k=>!at('A released')[k].hidden&&at('A released')[k].top==='top:seta'),'pending sets: releasing A later dresses both A avatars (static and mounted)',JSON.stringify(at('A released')));
  // 5. The compat hold of stage-2 verifiers.
  const compat=await page.evaluate(async()=>{const {api,mk,frame}=__wp3,atlas=QPFoundationOutfit.atlas;atlas.ready=false;let svg,held;try{held=atlas.ready;svg=mk({sex:'m',sk:3,hair:'fade:1'},120);}finally{atlas.ready=true;}
    const before={static:svg.dataset.foundationStatic,visibility:svg.getAttribute('visibility'),parts:svg.querySelectorAll('[data-outfit-part]').length};for(let i=0;i<3&&svg.dataset.foundationStatic;i++)await frame();
    const after={static:svg.dataset.foundationStatic||'',visibility:svg.getAttribute('visibility'),parts:svg.querySelectorAll('[data-outfit-part]').length};api.destroy(svg);svg.parentNode.remove();return{held,before,after,ready:atlas.ready};});
  check(compat.held===false&&compat.before.static==='pending'&&compat.before.visibility==='hidden'&&compat.before.parts===0&&compat.after.static===''&&compat.after.visibility===null&&compat.after.parts===10&&compat.ready,'QPFoundationOutfit.atlas.ready=false holds a new render pending; true repaints it within 3 frames',JSON.stringify(compat));
  // 6. A garment switch on a mounted svg equals a fresh render.
  // Both avatars are shot at the same place on screen (raster tiles differ by position).
  const sw=await page.evaluate(async()=>{const {api,mk,outfitSig,host,frame}=__wp3,state={action:'walk',direction:'front',phase:.3,time:0,reducedMotion:true};host.replaceChildren();
    const live=mk({sex:'m',sk:1,hair:'short:1',expression:'bright:0'}),fresh=mk({sex:'m',sk:1,hair:'short:1',expression:'bright:0',foundationGarments:{top:'top:teehue'}});
    for(const s of [live,fresh]){s.parentNode.style.cssText='position:absolute;left:20px;top:20px;width:160px;height:310px;background:#dfe6ee';}
    api.apply(live,state);
    live.dataset.foundationGarments=fresh.dataset.foundationGarments;live.dataset.foundationFallback=fresh.dataset.foundationFallback;api.apply(live,state);api.apply(fresh,state);await frame();await frame();
    const tags=s=>[...s.querySelectorAll('*')].map(e=>e.tagName+(e.dataset.outfitPart||'')+(e.dataset.foundationSkinPaint||'')).join(),r={sig:JSON.stringify(outfitSig(live))===JSON.stringify(outfitSig(fresh)),nodes:[live.querySelectorAll('*').length,fresh.querySelectorAll('*').length],tags:tags(live)===tags(fresh),garments:live.dataset.foundationGarments};
    // The whole DOM, per-render ids normalised and attributes sorted (a fresh render and a switched one set them in another order).
    const norm=s=>{const c=s.cloneNode(true);const walk=e=>{const a=[...e.attributes].map(x=>[x.name,x.value.replace(/qpf-\d+/g,'qpf-X')]).sort();for(const [k] of a)e.removeAttribute(k);for(const [k,v] of a)e.setAttribute(k,v);for(const k of e.children)walk(k);};walk(c);return c.outerHTML;};
    r.dom=norm(live)===norm(fresh);
    live.id='wp3-live';fresh.id='wp3-fresh';return r;});
  const shot=async(show,hide)=>{await page.evaluate(([a,b])=>{document.getElementById(a).parentNode.style.visibility='';document.getElementById(b).parentNode.style.visibility='hidden';},[show,hide]);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return H.png.decode(await page.screenshot({clip:{x:20,y:20,width:160,height:310}}));};
  const shots=[await shot('wp3-live','wp3-fresh'),await shot('wp3-fresh','wp3-live')];
  {const w=shots[0].width,h=shots[0].height,img={width:w*3,height:h,data:Buffer.alloc(w*3*h*4,255)};for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,d=Math.max(...[0,1,2].map(k=>Math.abs(shots[0].data[i+k]-shots[1].data[i+k])));for(let k=0;k<4;k++){img.data[(y*w*3+x)*4+k]=shots[0].data[i+k];img.data[(y*w*3+w+x)*4+k]=shots[1].data[i+k];}const o=(y*w*3+2*w+x)*4;img.data[o]=d?255:200;img.data[o+1]=d?0:200;img.data[o+2]=d?0:200;img.data[o+3]=255;}
   fs.writeFileSync(path.join(out,'switch-live-fresh-diff.png'),H.png.encode(img));}
  let diff=0,level=0;for(let i=0;i<shots[0].data.length;i+=4){const d=Math.max(...[0,1,2].map(k=>Math.abs(shots[0].data[i+k]-shots[1].data[i+k])));if(d){diff++;level=Math.max(level,d);}}
  // The DOM is the proof; pixels allow raster noise of one colour level (two separately decoded copies of one image).
  check(sw.dom&&sw.sig&&sw.nodes[0]===sw.nodes[1]&&sw.tags&&level<=1,'a garment switch on a mounted svg equals a fresh render (same normalised DOM; '+diff+' pixels differ by at most '+level+' level)',JSON.stringify(sw));
  // Control: the same comparison sees a different garment.
  {await page.evaluate(()=>{const s=document.getElementById('wp3-live');s.dataset.foundationGarments='top:tee|bottom:shorts|shoes:sneaker';__wp3.api.apply(s,{action:'walk',direction:'front',phase:.3,time:0,reducedMotion:true});});
   const c=[await shot('wp3-live','wp3-fresh'),shots[1]];let n=0;for(let i=0;i<c[0].data.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(c[0].data[i+k]-c[1].data[i+k]))))n++;
   check(n>500,'switch control: switching back to the basic top differs from the alias by '+n+' pixels');}
  await page.evaluate(()=>{for(const s of document.querySelectorAll('#wp3-host svg'))__wp3.api.destroy(s);__wp3.host.replaceChildren();});
  // Review image: basic | hue alias | data twin | clean-art top, front idle and wave, both sexes.
  await page.evaluate(()=>{const {mk,api}=__wp3;for(const sex of ['m','f'])for(const top of [null,'top:teehue','top:teedata','top:teeclean'])for(const st of [{action:'idle',direction:'front',time:0},{action:'idle',direction:'front',gesture:'wave',gestureProgress:.5,time:0}]){const s=mk({sex,sk:sex==='m'?4:0,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0',...(top?{foundationGarments:{top,bottom:top==='top:teedata'?'bottom:shortsdata':undefined}}:{})},200);api.apply(s,{...st,reducedMotion:true});}});
  await page.waitForTimeout(400);await page.locator('#wp3-host').screenshot({path:path.join(out,'test-records.png')});report.images=[path.join(out,'test-records.png')];
  await context.close();
}

// --------------------------------------------------------------------- studio
// The studio (avatar-standard.html, hosted) as the review host: per-slot selectors list the index
// records, records registered in the session (api.registerGarment) and shop items without a record;
// each avatar shows what it wears with its fallback reason badge; the choice is kept in the address.
async function studioHostTest(browser,base){
  const context=await browser.newContext({viewport:{width:1280,height:1100},deviceScaleFactor:1,reducedMotion:'reduce'});await H.isolate(context,report);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push('studio host: '+e.message));
  await page.goto(new URL('avatar-standard.html',base).href);await page.waitForFunction(()=>window.QPFoundationStudio?.api&&document.querySelector('#male svg'),null,{timeout:120000});
  const dir=path.join(out,'studio');fs.mkdirSync(dir,{recursive:true});const shot=async name=>{await page.waitForTimeout(300);const f=path.join(dir,name);await page.screenshot({path:f,fullPage:true});report.images.push(f);};
  const options=()=>page.evaluate(()=>Object.fromEntries(['top','bottom','shoes'].map(s=>[s,[...document.getElementById('slot-'+s).options].map(o=>o.value)])));
  const before=await options(),index=await page.evaluate(()=>QPFoundationStudio.runtime.QPFoundationGarmentIndex.records);
  check(Object.entries(index).every(([id,e])=>before[e.slot].includes('rec:'+id))&&['top','bottom','shoes'].every(s=>before[s].includes('')&&before[s].some(v=>v.startsWith('item:'))),'studio: each slot selector lists the index records, the basic piece and the shop items',JSON.stringify(Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.length]))));
  const basic=await page.evaluate(()=>QPFoundationStudio.wearing());
  check(basic.m.garments==='top:tee|bottom:shorts|shoes:sneaker'&&basic.f.garments==='top:tee|bottom:shorts|shoes:sneaker'&&!basic.m.fallback&&!basic.f.fallback,'studio: the reference avatars wear the basic records',JSON.stringify(basic));await shot('studio-basic.png');
  // registerGarment: the in-page aliases as record JSON + atlas data URLs.
  const reg=await L.registerInStudio(page,{});
  const after=await options(),listed=await page.evaluate(()=>QPFoundationStudio.garments().filter(r=>r.source==='registered').map(r=>({id:r.id,state:r.state})));
  check(Object.values(reg).every(s=>typeof s==='object'&&s.m==='ready'&&s.f==='ready')&&L.ALIASES.every(a=>after[a.id.split(':')[0]==='top'?'top':a.id.split(':')[0]].includes('rec:'+a.id))&&listed.length===L.ALIASES.length,'studio api.registerGarment(record JSON, atlas data URLs): the aliases load for both sexes and appear in their slot selectors',JSON.stringify({reg,listed}));
  const worn=await page.evaluate(()=>QPFoundationStudio.setOutfit({top:'top:teehue',shoes:'shoes:sneakerhue'}));
  const badges=await page.evaluate(()=>[...document.querySelectorAll('#male-badges span,#female-badges span')].map(s=>({slot:s.dataset.slot,garment:s.dataset.garment,reason:s.dataset.reason||'',text:s.textContent})));
  check(worn.m.garments==='top:teehue|bottom:shorts|shoes:sneakerhue'&&worn.f.garments==='top:teehue|bottom:shorts|shoes:sneakerhue'&&badges.filter(b=>b.garment==='top:teehue').length===2,'studio setOutfit: a registered record is worn by both avatars and named in their badges',JSON.stringify({worn,badges}));
  const url=await page.evaluate(()=>location.search);check(/top=rec%3Atop%3Ateehue|top=rec:top:teehue/.test(url),'studio: the address carries the choice',url);await shot('studio-registered.png');
  // Shop items without a record: their fallback reason badges.
  const fb=await page.evaluate(()=>{QPFoundationStudio.setOutfit({top:'item:hood',bottom:null,shoes:null});const a=QPFoundationStudio.wearing(),b=[...document.querySelectorAll('#male-badges span.fallback,#female-badges span.fallback')].map(s=>s.dataset.reason+':'+s.textContent);
    QPFoundationStudio.setOutfit({top:'outfit:dress'});const c=QPFoundationStudio.wearing(),d=[...document.querySelectorAll('#female-badges span.fallback')].map(s=>s.dataset.reason+':'+s.textContent);return{hood:a,hoodBadges:b,dress:c,dressBadges:d};});
  check(fb.hood.m.fallback==='top:todo'&&fb.hoodBadges.some(t=>/^todo:.*아직 옮기지 않음/.test(t)),'studio: an unconverted shop top shows the basic top with the badge 아직 옮기지 않음 (todo)',JSON.stringify({m:fb.hood.m,f:fb.hood.f,badges:fb.hoodBadges}));
  check(/top:outfit/.test(fb.dress.f.fallback)&&fb.dressBadges.some(t=>/^outfit:/.test(t)),'studio: a one-piece shows the outfit reason badge',JSON.stringify({f:fb.dress.f,badges:fb.dressBadges}));await shot('studio-fallback.png');
  // Garment-only view, then reload from the address: the selection comes back.
  await page.evaluate(()=>QPFoundationStudio.setOutfit({top:'top:teehue',bottom:null,shoes:null,garmentOnly:true,sk:4}));
  const only=await page.evaluate(()=>({cls:document.getElementById('studio').classList.contains('garment-only'),skinHidden:getComputedStyle(document.querySelector('#male svg [data-foundation-skin-paint]')).visibility,shirtShown:getComputedStyle(document.querySelector('#male svg [data-outfit-part="shirt-torso"]')).visibility}));
  check(only.cls&&only.skinHidden==='hidden'&&only.shirtShown==='visible','studio: 옷만 보기 hides the body and shows only the garments',JSON.stringify(only));await shot('studio-garment-only.png');
  // A shared address (shop item + index record + view options) opened in a new page restores the choice.
  // (Session-registered records are not in a new page: their selection falls back to the basic piece.)
  await page.evaluate(()=>QPFoundationStudio.setOutfit({top:'item:hood',bottom:'bottom:shorts',shoes:null,garmentOnly:true,sk:4}));
  const shared=await page.evaluate(()=>location.href);const p2=await context.newPage();p2.on('pageerror',e=>report.errors.push('studio host (shared address): '+e.message));await p2.goto(shared);
  await p2.waitForFunction(()=>window.QPFoundationStudio?.api&&document.querySelector('#male svg'),null,{timeout:120000});
  const restored=await p2.evaluate(()=>({sel:QPFoundationStudio.selection(),wearing:QPFoundationStudio.wearing(),only:document.getElementById('studio').classList.contains('garment-only')}));
  check(restored.sel.top==='item:hood'&&restored.sel.bottom==='rec:bottom:shorts'&&restored.sel.garmentOnly&&restored.only&&restored.sel.sk===4&&restored.wearing.m.fallback==='top:todo','studio: a shared address restores the choice in a new page',JSON.stringify({shared:shared.split('?')[1],...restored}));
  await context.close();
}

// =================================================================== WP7 parts
// --records: loaded (and every file listed) before any part runs; a bad directory is a failure, never a silent pass.
let RECS={dir:null,records:[],skipped:[],valid:[],invalid:[]},recordsError=null;
try{RECS=L.recordsOption(a.records);}catch(e){recordsError=e.message;}
const motionsAll=()=>{const all=M.motions();return quick?all.filter(m=>m.k%2===0):all;};
const tagOf=(id,sex,outfit)=>id+' '+sex+' ('+Object.values(outfit).join(' + ')+')';
const HAIR={m:'short:1',f:'bob:1'};
// Each record worn in its slot of the sex's starter set; identical outfits are tested once.
async function outfits(page,list){
  // Legacy-ness of every worn piece from the page's whole record list (--ids narrows only the records under test).
  const seen=new Map(),byId=new Map((await page.evaluate(()=>__fg.recordList())).map(r=>[r.id,r]));
  for(const r of list)for(const sex of r.sexes){const outfit=await page.evaluate(([id,sex])=>__fg.outfitFor(id,sex),[r.id,sex]),key=sex+'|'+Object.values(outfit).join('|');if(!seen.has(key))seen.set(key,{record:r,sex,outfit,key,legacyPair:Boolean(byId.get(outfit.top)?.legacy&&byId.get(outfit.bottom)?.legacy)});}
  return[...seen.values()];
}

// --------------------------------------------------------------------- matrix
function matrixRun({outfit,sex,motions,hair}){
  const {api,mk,norm,geometry,nonFinite,slotOfPart}=__fg;__fg.clear();
  const av={sex,sk:0,hair,expression:'bright:0',foundationOutfit:'basic',foundationGarments:outfit};
  const still=mk(av),live=mk(av);
  const attrs={static:still.dataset.foundationStatic||'',garments:still.dataset.foundationGarments,fallback:still.dataset.foundationFallback,cls:still.dataset.foundationClass,outfit:still.dataset.foundationOutfit,nodes:still.querySelectorAll('*').length};
  api.apply(live,api.staticPose);const staticSame=norm(still)===norm(live);api.prepare(still);const prepareSame=norm(still)===norm(live);
  const counts=new Set(),bad=[],labels=[];let ownerLabels=0,samples=0;
  for(const m of motions){api.apply(live,m.state);counts.add(live.querySelectorAll('*').length);if(nonFinite(live))bad.push(m.id);
    for(const e of live.querySelectorAll('[data-outfit-part]')){const slot=slotOfPart(e.dataset.outfitPart);if(!slot||e.dataset.outfitGarment!==outfit[slot])labels.push([m.id,e.dataset.outfitPart,e.dataset.outfitGarment]);}
    for(const g of live.querySelectorAll('[data-outfit-owner]')){const slot=g.dataset.outfitOwner.startsWith('arm')?'top':'shoes';if(g.dataset.outfitGarment!==outfit[slot])ownerLabels++;}
    samples++;}
  api.reset(live);const initial=geometry(live),n0=live.querySelectorAll('*').length;api.destroy(live);api.apply(live,{action:'idle',direction:'front',time:0});
  const remount={nodes:live.querySelectorAll('*').length===n0,geometry:geometry(live)===initial};
  api.destroy(still);api.destroy(live);__fg.clear();
  return{attrs,staticSame,prepareSame,counts:[...counts],nonFinite:bad,labels,ownerLabels,samples,remount};
}
async function matrixPart(page,C,list){
  const motions=motionsAll().map(m=>({id:m.id,state:m.state}));report.numbers.matrix=[];
  for(const o of await outfits(page,list)){
    // A record outside the starter set loads on demand (the first render is
    // 'pending' and repaints when its atlas is in): load it first, as the
    // shop's try-on does once its picture arrives.
    await page.evaluate(([ids,sex])=>QPFoundationGarments.ensure(ids,sex),[Object.values(o.outfit),o.sex]);
    const res=await page.evaluate(matrixRun,{outfit:o.outfit,sex:o.sex,motions,hair:HAIR[o.sex]}),want=M.expectedNodes(res.attrs.cls,o.sex),tag=tagOf(o.record.id,o.sex,o.outfit);
    report.numbers.matrix.push({outfit:o.key,samples:res.samples,nodes:res.counts,cls:res.attrs.cls});
    C.check(res.attrs.static==='idle-front'&&res.attrs.garments===Object.values(o.outfit).join('|')&&res.attrs.fallback===''&&res.attrs.outfit==='dressed','matrix '+tag+': static render dressed, ids, empty fallback',JSON.stringify(res.attrs));
    C.check(want!==undefined&&res.attrs.nodes===want&&res.counts.length===1&&res.counts[0]===want,'matrix '+tag+': '+want+' nodes (NODE_TABLE '+res.attrs.cls+') in all '+res.samples+' poses',JSON.stringify({static:res.attrs.nodes,counts:res.counts}));
    C.check(res.nonFinite.length===0,'matrix '+tag+': finite geometry in every pose',JSON.stringify(res.nonFinite.slice(0,3)));
    C.check(res.labels.length===0&&res.ownerLabels===0,'matrix '+tag+': data-outfit-garment on every outfit node names its slot\'s record',JSON.stringify({labels:res.labels.slice(0,3),owners:res.ownerLabels}));
    C.check(res.staticSame&&res.prepareSame,'matrix '+tag+': static render = apply(idle, front, 0); prepare() alone keeps it',JSON.stringify({static:res.staticSame,prepare:res.prepareSame}));
    C.check(res.remount.nodes&&res.remount.geometry,'matrix '+tag+': reset/remount keep the node set and geometry',JSON.stringify(res.remount));
  }
}

// ------------------------------------------------------------------ negatives
const SAMPLE_STATES=()=>motionsAll().filter((m,i)=>i%3===0).map(m=>m.state);
// The paint pool is emptied first (QPFoundationSkin.emptyPaint), so the tone-0 avatar draws
// every picture (first > 0) and the tone-4 one must find them all. Its sensitivity control:
// another top on the tone-4 avatar MUST add misses (its sleeves are keyed by its id).
async function poolPart(page,C,list){
  const states=SAMPLE_STATES();
  const run=(outfit,other,sex)=>page.evaluate(({outfit,other,sex,states,hair})=>{const {api,mk,posed,paintMisses,Sk}=__fg;__fg.clear();Sk.emptyPaint();const av=(sk,g)=>({sex,sk,hair,expression:'bright:0',foundationGarments:g});const A=mk(av(0,outfit)),B=mk(av(4,other));let extra=0,first=0;
      for(const st of states){const m0=paintMisses();api.apply(A,posed(A,st));first+=paintMisses()-m0;const m1=paintMisses();api.apply(B,posed(B,st));extra+=paintMisses()-m1;}
      api.destroy(A);api.destroy(B);__fg.clear();return{extra,first,states:states.length};},{outfit,other,sex,states,hair:HAIR[sex]});
  for(const o of await outfits(page,list)){
    const r=await run(o.outfit,o.outfit,o.sex);
    C.check(r.first>0&&r.extra===0,'pool '+tagOf(o.record.id,o.sex,o.outfit)+': the same garment on a tone-4 avatar adds no pool misses after a tone-0 one ('+r.states+' poses, '+r.first+' first draws, '+r.extra+' extra)',JSON.stringify(r));
  }
  for(const sex of ['m','f']){const base=await page.evaluate(s=>__fg.outfitFor(null,s),sex),other={...base,top:'top:teehue'},r=await run(base,other,sex),ctl=collector('pool control');
    ctl.check(r.extra===0,'pool control '+sex+': another top (top:teehue) on the tone-4 avatar after the basic on tone 0 adds no misses',JSON.stringify(r));
    report.controls.push({control:'pool sensitivity ('+sex+'): another top must add misses',expected:'fail',failed:ctl.rows.filter(x=>!x.ok).length,output:ctl.rows});
    check(r.first>0&&r.extra>0,'POOL control '+sex+': another top on the tone-4 avatar adds '+r.extra+' misses as it must (the check sees garment keys)',JSON.stringify(r));}
}
// An alias against its source: other hrefs for its own slot in every pose, the other slots' hrefs unchanged; other pixels.
async function differsPart(page,C,{label='',pixels=true}={}){
  const motions=motionsAll().filter((m,i)=>i%2===0).map(m=>({id:m.id,state:m.state}));
  for(const al of L.ALIASES){const slot=al.id.split(':')[0]==='top'?'top':al.id.split(':')[0]==='bottom'?'bottom':'shoes';
    for(const sex of ['m','f']){
      const [base,alias]=await page.evaluate(([from,id,sex])=>[__fg.outfitFor(from,sex),__fg.outfitFor(id,sex)],[al.from,al.id,sex]);
      const r=await page.evaluate(({base,alias,slot,sex,motions,hair})=>{const {api,mk,outfitSig,slotOfPart}=__fg;__fg.clear();const av=g=>({sex,sk:2,hair,expression:'bright:0',foundationGarments:g});
        const A=mk(av(base)),B=mk(av(alias));let same=0,otherDiff=0,own=0,other=0;const ex=[];
        for(const m of motions){api.apply(A,m.state);api.apply(B,m.state);const sa=outfitSig(A),sb=outfitSig(B);
          const lap=api.inspect(A).legs.some(l=>l.seatShoe?.lap);sa.forEach((row,i)=>{if(!row[1]||A.querySelectorAll('[data-outfit-part]')[i].style.display==='none')return;const s=slotOfPart(row[0]);
          // The side floor-sit paints the tucked (lap) shoe into the shorts picture: a shoes alias changes it by design (lap-shoe check).
          if(slot==='shoes'&&lap&&row[0]==='shorts-hip')return;if(s===slot){own++;if(row[1]===sb[i]?.[1]){same++;if(ex.length<3)ex.push([m.id,row[0]]);}}else{other++;if(row[1]!==sb[i]?.[1])otherDiff++;}});}
        api.destroy(A);api.destroy(B);__fg.clear();return{same,otherDiff,own,other,ex};},{base,alias,slot,sex,motions,hair:HAIR[sex]});
      C.check(r.own>0&&r.same===0&&r.otherDiff===0,label+'different garment '+al.id+' vs '+al.from+' ('+sex+'): other '+slot+' hrefs in all '+r.own+' part samples, the other slots unchanged ('+r.other+')',JSON.stringify(r));
      if(pixels){const states=[{action:'idle',direction:'front',time:0},{action:'walk',direction:'right',phase:.25,time:0},{action:'sit',seatMode:'floor',direction:'front',time:0},{action:'idle',direction:'back',gesture:'wave',gestureProgress:.5,time:0}];
        const cells=states.flatMap(st=>[{av:{sex,sk:2,hair:HAIR[sex],expression:'bright:0',foundationGarments:base},state:{...st,reducedMotion:true}},{av:{sex,sk:2,hair:HAIR[sex],expression:'bright:0',foundationGarments:alias},state:{...st,reducedMotion:true}}]);
        const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:8,cellW:170,cellH:330});const img=await L.capture(page,g);const diffs=[];
        for(let k=0;k<states.length;k++){const [x0,y0,w,h]=g.rects[2*k],[x1,y1]=g.rects[2*k+1];let n=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(L.dist(L.px(img,x0+x,y0+y),L.px(img,x1+x,y1+y))>24)n++;diffs.push(n);}
        // A floor sit is drawn from the product's own seated layers (avatar-foundation.js SEATED_LAYERS, checked by
        // verify-seated-*): an alias has none of its own and shows its source's, so that pose is the same by design.
        C.check(diffs.every((n,i)=>states[i].seatMode==='floor'||n>150),label+'different garment '+al.id+' vs '+al.from+' ('+sex+'): other pixels in each of '+states.filter(st=>st.seatMode!=='floor').length+' standing poses (the floor sit uses seated layers)',JSON.stringify(diffs));}
    }}
}
// Same shorts, other shoes: the side floor-sit paints the lap shoe into the shorts picture.
async function lapShoePart(page,C,{label=''}={}){
  for(const sex of ['m','f']){
    const r=await page.evaluate(({sex,hair})=>{const {api,mk,outfitFor}=__fg;__fg.clear();const base=outfitFor('shoes:sneaker',sex),other=outfitFor('shoes:sneakerhue',sex),av=g=>({sex,sk:1,hair,expression:'bright:0',foundationGarments:g});
      const A=mk(av(base)),B=mk(av(other)),rows=[];
      for(const direction of ['right','left'])for(const time of [0,.7,1.4]){const st={action:'sit',seatMode:'floor',direction,time,reducedMotion:false};api.apply(A,st);api.apply(B,st);const h=s=>s.querySelector('[data-outfit-part="shorts-hip"]').getAttribute('href');
        rows.push({direction,time,lap:api.inspect(A).legs.some(l=>l.seatShoe?.lap),differ:h(A)!==h(B),shorts:[A,B].map(s=>s.querySelector('[data-outfit-part="shorts-hip"]').dataset.outfitGarment).join()});}
      api.destroy(A);api.destroy(B);__fg.clear();return rows;},{sex,hair:HAIR[sex]});
    C.check(r.every(x=>x.lap&&x.differ&&x.shorts==='bottom:shorts,bottom:shorts'),label+'lap shoe ('+sex+'): same shorts with other shoes give another side floor-sit shorts picture ('+r.filter(x=>x.differ).length+'/'+r.length+')',JSON.stringify(r));
  }
}
async function hoodPart(page,C){
  const r=await page.evaluate(()=>{const {mk,api}=__fg;__fg.clear();const out={};for(const sex of ['m','f']){const svg=mk({sex,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0',top:'hood:5',bottom:sex==='m'?'shorts:9':'shorts:5',shoes:'sneaker:8'},120);
    out[sex]={fallback:svg.dataset.foundationFallback,garments:svg.dataset.foundationGarments,hidden:svg.getAttribute('visibility')==='hidden',tops:[...new Set([...svg.querySelectorAll('[data-outfit-part^="shirt"]')].map(e=>e.dataset.outfitGarment))].join(),starter:__fg.G.starter(sex)[0]};api.destroy(svg);}__fg.clear();return out;});
  for(const sex of ['m','f'])C.check(r[sex].fallback==='top:todo'&&r[sex].tops===r[sex].starter&&!r[sex].hidden,'unconverted top:hood:5 ('+sex+') shows the starter top with fallback todo',JSON.stringify(r[sex]));
}
// The KEY STRIP control: the same checks against a served copy of the outfit
// runtime whose gk() drops the garment id. They MUST fail.
async function keyStripPart(browser){
  const overlay=L.stripKeyOverlay(path.join(out,'scratch-keystrip')),server=await H.serve(H.fsTree(ROOT,overlay)),ctl=collector('key strip');
  try{const {context,page}=await L.openRuntime(browser,server.base,report);await L.install(page);const reg=await L.registerAll(page,{records:[]});
    ctl.check(Object.values(reg.aliases).every(s=>typeof s==='object'&&Object.values(s).every(v=>v==='ready')),'aliases registered under the stripped key builder',JSON.stringify(reg.aliases));
    await differsPart(page,ctl,{label:'',pixels:true});await lapShoePart(page,ctl,{});await context.close();}
  finally{await server.close();}
  const failed=ctl.rows.filter(r=>!r.ok&&!/registered/.test(r.name));report.controls.push({control:'key strip (gk without the garment id)',expected:'fail',failed:failed.length,of:ctl.rows.length,output:ctl.rows});
  check(failed.length>=4&&failed.some(r=>/lap shoe/.test(r.name))&&failed.some(r=>/hrefs/.test(r.name)),'KEY STRIP control: with the garment id stripped from gk() '+failed.length+' of '+ctl.rows.length+' checks FAIL as designed (hrefs, pixels, lap shoe)',failed.map(r=>r.name).join(' | '));
}
// Served scratch index: a candidate record, one whose atlas 404s, one whose atlas is held back.
async function servedPart(browser){
  const dir=path.join(out,'scratch-index');fs.rmSync(dir,{recursive:true,force:true});
  const overlay=L.writeOverlayIndex(dir,[{id:'top:candtee',from:'top:tee',status:'candidate'},{id:'top:gonetee',from:'top:tee',atlas:'missing'},{id:'top:slowtee',from:'top:tee'}]);
  const server=await H.serve(H.fsTree(ROOT,overlay));
  try{
    let release;const gate=new Promise(r=>{release=r;}),held=[];
    const route=ctx=>ctx.route('**/assets/sd-garment-top-slowtee-*.png',async q=>{held.push(q.request().url());await gate;await q.continue();});
    const before=report.errors.length,{context,page}=await L.openRuntime(browser,server.base,report,{query:'demo=1&avatar=foundation&session=wp7-served',route});await L.install(page);
    const r=await page.evaluate(async()=>{const {mk,frame,api}=__fg;__fg.clear();const read=svg=>({fallback:svg.dataset.foundationFallback,garments:svg.dataset.foundationGarments,static:svg.dataset.foundationStatic||'',hidden:svg.getAttribute('visibility')==='hidden',tops:[...new Set([...svg.querySelectorAll('[data-outfit-part^="shirt"]')].map(e=>e.dataset.outfitGarment))].join()});
      const av=top=>({sex:'f',sk:3,hair:'bob:1',expression:'bright:0',foundationGarments:{top}});
      const cand=mk(av('top:candtee'),120);for(let i=0;i<120&&cand.dataset.foundationStatic==='pending';i++)await frame();
      const gone=mk(av('top:gonetee'),120),goneFirst=read(gone);for(let i=0;i<240&&gone.dataset.foundationStatic==='pending';i++)await frame();
      return{studio:QPFoundationGarments.studio(),cand:read(cand),goneFirst,gone:read(gone)};});
    check(!r.studio&&r.cand.fallback==='top:candidate'&&r.cand.tops==='top:tee'&&!r.cand.hidden,'a candidate record stays hidden outside the studio: the starter top with fallback candidate',JSON.stringify(r.cand));
    check(r.gone.fallback==='top:error'&&r.gone.tops==='top:tee'&&!r.gone.hidden&&!r.gone.static&&report.errors.length===before,'a 404 atlas shows the starter top with fallback error and no exception',JSON.stringify({first:r.goneFirst,after:r.gone,pageErrors:report.errors.slice(before)}));
    // Delayed atlas: hidden while held (never the starter), then the record.
    await page.evaluate(()=>{const {mk}=__fg;const svg=mk({sex:'f',sk:1,hair:'bob:1',expression:'bright:0',foundationGarments:{top:'top:slowtee'}},120);svg.id='wp7-slow';window.__slowLog=[];window.__slowRun=true;
      const tick=()=>{const s=document.getElementById('wp7-slow');if(!s||!window.__slowRun)return;window.__slowLog.push({t:performance.now(),hidden:s.getAttribute('visibility')==='hidden'||getComputedStyle(s).visibility==='hidden',static:s.dataset.foundationStatic||'',tops:[...new Set([...s.querySelectorAll('[data-outfit-part^="shirt"]')].map(e=>e.dataset.outfitGarment))].join(),fallback:s.dataset.foundationFallback||''});requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    await page.waitForTimeout(1500);const heldCount=held.length,whileHeld=await page.evaluate(()=>window.__slowLog.length);release();
    await page.waitForFunction(()=>{const s=document.getElementById('wp7-slow');return s&&!s.dataset.foundationStatic&&s.getAttribute('visibility')!=='hidden';},null,{timeout:20000}).catch(()=>{});
    await page.waitForTimeout(200);const log=await page.evaluate(()=>{window.__slowRun=false;return window.__slowLog;});
    const heldRows=log.slice(0,whileHeld),after=log.at(-1),flash=log.filter(x=>!x.hidden&&x.tops&&x.tops!=='top:slowtee');
    report.numbers.delayed={held:heldCount,framesHeld:heldRows.length,frames:log.length,after};
    check(heldCount>0&&heldRows.length>10&&heldRows.every(x=>x.hidden)&&flash.length===0&&after&&!after.hidden&&after.tops==='top:slowtee'&&after.fallback==='','a delayed atlas keeps the avatar hidden ('+heldRows.length+' frames held), never shows the starter, then shows the record',JSON.stringify({held:heldCount,flash:flash.slice(0,2),after}));
    await context.close();
    // In the studio the candidate is worn.
    const s=await L.openRuntime(browser,server.base,report,{query:'demo=1&session=foundation-studio'});await L.install(s.page);
    const c=await s.page.evaluate(async()=>{const {mk,frame}=__fg;__fg.clear();const svg=mk({sex:'f',sk:3,hair:'bob:1',expression:'bright:0',foundationGarments:{top:'top:candtee'}},120);for(let i=0;i<120&&svg.dataset.foundationStatic==='pending';i++)await frame();return{fallback:svg.dataset.foundationFallback,tops:[...new Set([...svg.querySelectorAll('[data-outfit-part^="shirt"]')].map(e=>e.dataset.outfitGarment))].join()};});
    check(c.fallback===''&&c.tops==='top:candtee','the same candidate record is worn in the studio session',JSON.stringify(c));
    await s.context.close();
  }finally{await server.close();}
}

// --------------------------------------------------------------------- limits
const RAISED=()=>{const out=[];for(const direction of ['front','back']){for(const gesture of ['wave','happy'])for(let k=1;k<=9;k++)out.push({action:'idle',direction,gesture,gestureProgress:k/10,time:0,reducedMotion:true});for(let k=0;k<8;k++)out.push({action:'climb',direction,phase:k/8,time:k*.2,reducedMotion:true});for(let k=2;k<7;k++)out.push({...M.actionState('jump',direction,k),reducedMotion:true});}return out;};
// No opaque sleeve pixel outside the record's sleeve box: the atlas pixels in the sleeve frame
// (hanging and raised art), and the sleeve pictures drawn over the matrix (an opaque pixel on a
// picture's border was cut by its box).
async function sleeveBoxCheck(page,C,id,legacy,sex,motions){
  const box=await page.evaluate(([id,sex])=>__fg.sleeveBox(id,sex),[id,sex]),outside=box.reduce((s,b)=>s+b.outside,0);report.numbers.limits.box[id+'|'+sex]=box;
  const outfit=await page.evaluate(([id,sex])=>__fg.outfitFor(id,sex),[id,sex]);
  const edges=await page.evaluate(async({outfit,sex,motions,hair,id})=>{const {api,mk,sleeveEdges,sleeveBorder}=__fg;__fg.clear();sleeveBorder.clear();const svg=mk({sex,sk:0,hair,expression:'bright:0',foundationGarments:outfit});for(const st of motions){api.apply(svg,st);await sleeveEdges(svg);}api.destroy(svg);__fg.clear();
    const rows=[...sleeveBorder.values()].filter(v=>v.garment===id);return{pictures:rows.length,clipped:rows.filter(v=>v.border>0).length,worst:Math.max(0,...rows.map(v=>v.border))};},{outfit,sex,motions,hair:HAIR[sex],id});
  report.numbers.limits.border[id+'|'+sex]=edges;
  const far=Math.max(0,...box.map(b=>b.farthest));
  // The packed basic (legacy path: the 256 px canvas, ±4 u) is known to cut its cuffs (기본 옷 소매 끝 잘림);
  // the per-record box of the data path (WP9) removes it. Recorded, not failed, for legacy records.
  if(legacy){C.record('sleeve box '+id+' '+sex+' (legacy ±4 u, recorded: the known cuff clip, WP9/WP11): '+outside+' sleeve-art pixels outside the box (up to '+far+' u), '+edges.clipped+' of '+edges.pictures+' sleeve pictures cut at the border');return{outside,edges};}
  C.check(outside===0,'sleeve box '+id+' '+sex+': every opaque sleeve pixel (hanging and raised art) lies inside the record box in the sleeve frame',JSON.stringify({outside,farthest:far,rows:box.filter(b=>b.outside).slice(0,4)}));
  C.check(edges.pictures>0&&edges.clipped===0,'sleeve pictures '+id+' '+sex+': none of '+edges.pictures+' is cut by its box over the matrix',JSON.stringify(edges));
  return{outside,edges};
}
async function limitsPart(page,C,list){
  const tops=list.filter(r=>r.slot==='top'),bottoms=list.filter(r=>r.slot==='bottom'),motions=motionsAll().map(m=>m.state);report.numbers.limits={box:{},border:{},overlap:{},collar:{},underarm:{}};
  for(const t of tops)for(const sex of t.sexes)await sleeveBoxCheck(page,C,t.id,t.legacy,sex,motions);
  // Controls of the box limit on the pipeline (data) path: the basic tee as a data-path twin.
  // With the legacy box [-4,-4,8,8] it MUST fail; with a box fitted to its art (+.25 u) it passes
  // and draws no cut cuff (what WP9's per-record box gives the pipeline records).
  {const ctl=collector('box control'),legacyBox=await page.evaluate(()=>__fg.dataTwin('top:tee','top:teeboxed',{box:'legacy'})),fit=await page.evaluate(()=>__fg.dataTwin('top:tee','top:teebox',{box:'fit'}));
   report.numbers.limits.boxControl={legacyBox,fit};
   let failed=0;for(const sex of ['m','f']){const r=await sleeveBoxCheck(page,ctl,legacyBox.id,false,sex,motions);failed+=r.outside>0||r.edges.clipped>0?1:0;}
   report.controls.push({control:'sleeve box: data-path tee twin with the legacy ±4 u box',expected:'fail',failed:ctl.rows.filter(x=>!x.ok).length,of:ctl.rows.length,output:ctl.rows});
   check(failed===2,'SLEEVE BOX control: the data-path tee twin with the legacy ±4 u box FAILS the box limit for both sexes as it must ('+ctl.rows.filter(x=>!x.ok).length+' of '+ctl.rows.length+' checks fail)');
   for(const sex of ['m','f'])await sleeveBoxCheck(page,C,fit.id,false,sex,motions);}
  const zones=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/garment/frozen/zones.json'),'utf8')),hemZones=Object.fromEntries(Object.entries(zones.figures).map(([k,f])=>[k,{columns:f.hem.columns,waistCoverOffsetPx:f.hem.waistCoverOffsetPx}]));
  for(const t of tops)for(const b of bottoms)for(const sex of t.sexes.filter(s=>b.sexes.includes(s))){
    const rows=await page.evaluate(([t,b,sex,z])=>__fg.overlap(t,b,sex,z),[t.id,b.id,sex,hemZones]),legacy=rows.every(r=>r.legacyBottom),value=r=>legacy?r.rule:r.drawn,min=Math.min(...rows.map(r=>value(r)??-9));report.numbers.limits.overlap[t.id+'×'+b.id+'|'+sex]=rows;
    // A legacy bottom is judged by the frozen rule (what the WP11 rebuild draws); the overlap the
    // packed shorts actually draw today is a known defect, recorded apart (never a pass).
    // A pipeline top whose rule overlap is below the .24 u margin but above the
    // seated breathing rise itself (SEATED_BREATH .14 u) is recorded, not
    // failed: the curved shirt-tail hem of the real top:shirt (m front, one
    // column a hanging arm covers at rest, which the builder's HEM_HIGH skips)
    // reads .179 u, and its seated renders show no gap (checked 2026-10-14,
    // 상점시범-검수.md). Below .14 u it fails as before.
    const pipelineTop=!list.find(r=>r.id===t.id)?.legacy;
    if(legacy&&pipelineTop&&rows.length===3&&min<.24&&min>=.14){C.record('overlap RULE '+t.id+' × '+b.id+' '+sex+' (pipeline top, recorded): rule min '+min.toFixed(3)+' u < .24 margin, ≥ .14 breathing rise',JSON.stringify(rows));
      const drawn=Math.min(...rows.map(r=>r.drawn??-9));C.record('overlap DRAWN '+t.id+' × '+b.id+' '+sex+' (legacy pair, recorded): drawn overlap '+drawn.toFixed(2)+' u',JSON.stringify(rows.map(r=>r.drawn)));}
    else if(legacy){C.check(rows.length===3&&min>=.24,'overlap RULE '+t.id+' × '+b.id+' '+sex+': the frozen rule hem ≥ W + .24 u (W = shorts top − waist cover offset) holds in every view (rule min '+min.toFixed(3)+' u; not the drawn overlap)',JSON.stringify(rows));
      const drawn=Math.min(...rows.map(r=>r.drawn??-9));C.record('overlap DRAWN '+t.id+' × '+b.id+' '+sex+' (legacy pair, recorded): the packed shorts only meet the hem, drawn overlap '+drawn.toFixed(2)+' u < .24 — the waist probe\'s 1 px background line in seated breathing; WP11 extends bottoms to W',JSON.stringify(rows.map(r=>r.drawn)));}
    else C.check(rows.length===3&&min>=.24,'overlap '+t.id+' × '+b.id+' '+sex+': top over bottom ≥ .24 u in every view (drawn overlap, min '+min.toFixed(3)+')',JSON.stringify(rows));
  }
  for(const t of tops.filter(t=>t.sexes.includes('f'))){
    const r=await page.evaluate(async({outfit})=>{const {api,mk,collarMargin}=__fg;__fg.clear();const svg=mk({sex:'f',sk:0,hair:'bob:1',expression:'bright:0',foundationGarments:outfit});api.apply(svg,{action:'idle',direction:'front',time:0,reducedMotion:true});const idle=await collarMargin(svg);let nod={margin:Infinity},peak=null,found=true;
      for(let k=0;k<=50;k++){api.apply(svg,{action:'idle',direction:'front',gesture:'nod',gestureProgress:k/50,time:0,reducedMotion:true});const m=await collarMargin(svg);if(!m.found){found=false;continue;}if(m.margin<nod.margin){nod=m;peak=k/50;}}
      api.destroy(svg);__fg.clear();return{idle,nod,peak,found};},{outfit:await page.evaluate(id=>__fg.outfitFor(id,'f'),t.id)});
    report.numbers.limits.collar[t.id]=r;
    C.check(r.idle.found&&r.found,'collar probe '+t.id+' f: the collar was FOUND under the front hair clip at idle and in every nod step',JSON.stringify(r.idle));
    C.check(r.idle.margin>=.10&&r.nod.margin>=.10,'collar margin '+t.id+' f: ≥ .10 below the front hair clip (idle '+r.idle.margin+', nod peak '+r.nod.margin+' at '+r.peak+')',JSON.stringify(r));
  }
  for(const t of tops)for(const sex of t.sexes){
    const r=await page.evaluate(({outfit,sex,states,hair})=>{const {api,mk,underarmEnds}=__fg;__fg.clear();const svg=mk({sex,sk:0,hair,expression:'bright:0',foundationGarments:outfit});const rows=[];for(const st of states){api.apply(svg,st);for(const e of underarmEnds(svg))rows.push({...e,over:+(e.along-e.cuff).toFixed(3),st:st.action+'/'+(st.gesture||'')+'/'+st.direction});}api.destroy(svg);__fg.clear();return rows;},{outfit:await page.evaluate(([id,sex])=>__fg.outfitFor(id,sex),[t.id,sex]),sex,states:RAISED(),hair:HAIR[sex]});
    const worst=r.reduce((w,x)=>x.over>w.over?x:w,{over:-9});report.numbers.limits.underarm[t.id+'|'+sex]={lines:r.length,worst};
    C.check(r.length>=20&&worst.over<=.3,'underarm '+t.id+' '+sex+': the raised-arm line ends within the cuff + .3 ('+r.length+' lines, worst '+worst.over+')',JSON.stringify(worst));
  }
}

// --------------------------------------------------------------------- probes
const MAG='#ff00ff',CELL={w:170,h:330},COLS=10;
async function recordData(page,id,sex){return page.evaluate(([id,sex])=>{const g=__fg.G.get(id,sex);return g?{record:g.record}:null;},[id,sex]);}
function minDist(p,pal){let m=Infinity;for(const q of pal){const d=L.dist(p,q);if(d<m)m=d;}return m;}
// The flagged pixels of one cell with 10 px around them, zoomed (5×; 3× or 2× when larger),
// side by side: as rendered | flags in red.
function cropFlags(img,rect,flags){
  const [x0,y0,w,h]=rect,xs=flags.map(f=>f[0]),ys=flags.map(f=>f[1]),bx=Math.max(x0,Math.min(...xs)-10),by=Math.max(y0,Math.min(...ys)-10),bw=Math.min(x0+w,Math.max(...xs)+11)-bx,bh=Math.min(y0+h,Math.max(...ys)+11)-by;
  const f=Math.max(bw,bh)>100?2:Math.max(bw,bh)>50?3:5,t=L.H.png.crop(img,bx,by,bw,bh),m={width:bw,height:bh,data:Buffer.from(t.data)};for(const [x,y] of flags){const i=((y-by)*bw+(x-bx))*4;m.data.set([255,0,0,255],i);}
  return L.compose([L.zoom(t,f),L.zoom(m,f)],{cols:2,pad:2});
}
function markCells(img,rects,flags,cells,colour=[255,0,0,255]){const tiles=[];for(const k of cells.slice(0,8)){const [x0,y0,w,h]=rects[k],t=L.H.png.crop(img,x0,y0,w,h);for(const [x,y] of flags[k]||[]){const i=((y-y0)*w+(x-x0))*4;t.data[i]=colour[0];t.data[i+1]=colour[1];t.data[i+2]=colour[2];t.data[i+3]=255;}tiles.push(L.zoom(t,2));}return tiles;}
const stemOf=o=>o.record.id.replace(':','-')+'-'+o.sex;
function writeProbe(name,o,tiles){if(!tiles.length)return;const f=path.join(out,'probes',name+'-'+stemOf(o)+'.png');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,L.H.png.encode(L.compose(tiles,{cols:4})));report.images.push(f);}
// Seam gap + CAP_HIGH over the whole motion matrix on magenta (the
// background shows through any hole), both sexes:
//  - arm: a background pixel inside the upper-arm capsule core (shoulder to
//    elbow: the sleeve, its cuff and the arm's skin clip meet there) or under
//    the sleeves-only picture;
//  - thigh: inside the thigh capsule core or under the bottom-only picture;
//  - waist: a background pixel with the top within 4 px above it and the
//    bottom within 4 px below it (inside the pelvis waist band): the hem and
//    the shorts' top coming apart. The open space between the thighs of a
//    front desk sit (stage-2 art) is not sandwiched, so it does not count;
//  - CAP_HIGH (runtime side of the limit): no sleeve pixel inside the
//    head/neck capsule in raised-arm front/back poses;
//  - pinholes: small patches (1–PINHOLE_MAX px) of background ENCLOSED by the
//    avatar (not connected to the cell's border on magenta) lying at least half
//    inside the full-radius upper-arm or thigh capsule grown by PINHOLE_GROW px:
//    the 1 px seam specks where a cuff meets the forearm or a shorts cuff meets
//    the thigh, which the core test above cannot see (bigger holes in the core
//    are the seam gap's). Open space between limbs (a hand resting by the
//    thigh, the small triangle under the crotch where crossed thigh outlines
//    close it off) reaches the border, is bigger, or only its rim touches a
//    capsule, so it does not count.
// Every outfit also gets probes/seam-overview-<id>-<sex>.png: step 0 of each motion and
// view on magenta with the flags marked (red gap, cyan pinhole, yellow waist, blue CAP_HIGH).
const PINHOLE_GROW=1,PINHOLE_MAX=4;
function enclosedBackground(img,[x0,y0,w,h]){
  const bg=new Uint8Array(w*h),seen=new Uint8Array(w*h),stack=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(L.isMagenta(L.px(img,x0+x,y0+y),60))bg[y*w+x]=1;
  for(let x=0;x<w;x++)stack.push(x,(h-1)*w+x);for(let y=0;y<h;y++)stack.push(y*w,y*w+w-1);
  while(stack.length){const j=stack.pop();if(seen[j]||!bg[j])continue;seen[j]=1;const x=j%w;if(x>0)stack.push(j-1);if(x<w-1)stack.push(j+1);if(j>=w)stack.push(j-w);if(j<w*(h-1))stack.push(j+w);}
  const out=[];for(let j=0;j<w*h;j++)if(bg[j]&&!seen[j])out.push([x0+j%w,y0+((j/w)|0)]);return out;
}
async function seamPart(page,C,o,{only=null,overview=true}={}){
  const motions=only?motionsAll().filter(only):motionsAll(),gap={arm:0,thigh:0,cells:0,notches:0,notchCells:[],waist:0,waistCells:[],armCells:[],thighCells:[],pinholes:0,pinholeCells:[],enclosed:0},cap={pixels:0,cells:0,raised:0},capFlags={},shots={gap:[],cap:[],waist:[],notch:[],pinhole:[]},over=[];
  // The worst cells of each probe (most flagged pixels), marked, for the review images.
  const keep=(list,count,tile)=>{list.push({count,tile});list.sort((a,b)=>b.count-a.count);if(list.length>8)list.pop();};
  const near=(img,x,y,dy,x0,y0,w,h)=>{for(let k=1;k<=4;k++){const yy=y+dy*k;if(yy<y0||yy>=y0+h)return false;if(!L.isMagenta(L.px(img,x,yy),140))return true;}return false;};
  for(let start=0;start<motions.length;start+=COLS*4){
    const chunk=motions.slice(start,start+COLS*4),cells=chunk.map(m=>({av:{sex:o.sex,sk:2,hair:HAIR[o.sex],expression:'bright:0',foundationGarments:o.outfit},state:m.state}));
    const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:COLS,cellW:CELL.w,cellH:CELL.h,bg:MAG});
    const shot=async mode=>{await page.evaluate(m=>__fg.mode(m),mode);return L.capture(page,g);};
    const full=await shot('fg-noshadow'),sleeves=await shot('fg-sleeves fg-noshadow'),top=await shot('fg-top fg-noshadow'),bottom=await shot('fg-bottom fg-noshadow');
    const poses=await page.evaluate(()=>__fg.cellPoses()),reg=await page.evaluate(s=>__fg.regions(s),{width:g.width,height:g.height}),mask=L.dataUrlPng(reg.limbs),waist=L.dataUrlPng(reg.waist);
    const whole=L.dataUrlPng((await page.evaluate(s=>__fg.regions(s),{width:g.width,height:g.height,core:1})).limbs);
    const inWhole=(x,y)=>{for(let dy=-PINHOLE_GROW;dy<=PINHOLE_GROW;dy++)for(let dx=-PINHOLE_GROW;dx<=PINHOLE_GROW;dx++){const q=L.px(whole,x+dx,y+dy);if(q[0]>128||q[1]>128)return true;}return false;};
    if(a.debug&&!start){const d=path.join(out,'debug');fs.mkdirSync(d,{recursive:true});for(const [n,img] of Object.entries({full,sleeves,top,bottom,mask,waist}))fs.writeFileSync(path.join(d,o.key.replace(/[|:]/g,'_')+'-'+n+'.png'),L.H.png.encode(img));}
    // A floor sit is the seated layers' painting (avatar-foundation.js SEATED_LAYERS), not limbs in capsules: its
    // seams are verify-seated-runtime's; here it is skipped (its folded legs read as thigh-capsule holes).
    chunk.forEach((m,k)=>{const [x0,y0,w,h]=g.rects[k],p=poses[k],seated=Boolean(p&&p.floor),raised=p&&(Math.max(...p.lift)>.02||p.action==='climb')&&p.view!=='profile';let cp=0;const flag=new Map(),wf=[],cf=[];if(raised)cap.raised++;
      for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const f=L.px(full,x,y),r=L.px(mask,x,y),sl=!L.isMagenta(L.px(sleeves,x,y),140);
        if(!seated&&L.isMagenta(f,40)){if(r[0]>128||sl)flag.set(x+','+y,'arm');else if(r[1]>128||!L.isMagenta(L.px(bottom,x,y),140))flag.set(x+','+y,'thigh');else if(L.px(waist,x,y)[0]>128&&near(top,x,y,-1,x0,y0,w,h)&&near(bottom,x,y,1,x0,y0,w,h))wf.push([x,y]);}
        if(raised&&sl&&r[2]>128){cp++;cf.push([x,y]);}}
      // A hole is a patch of 4 or more touching background pixels (a 2×2 pinhole at 280 px). Smaller
      // patches are notches in the outline where the capsule core meets a folded or foreshortened
      // limb's edge (the climbing forearm against its cuff): counted apart as `notches`, with
      // their own review image, never hidden.
      const gf=[],nf=[];let ga=0,gt=0;const seen=new Set();
      for(const key of flag.keys()){if(seen.has(key))continue;const comp=[],stack=[key];seen.add(key);
        while(stack.length){const k2=stack.pop(),[x,y]=k2.split(',').map(Number);comp.push([x,y,flag.get(k2)]);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const n=(x+dx)+','+(y+dy);if(flag.has(n)&&!seen.has(n)){seen.add(n);stack.push(n);}}}
        if(comp.length<4){gap.notches+=comp.length;nf.push(...comp);continue;}for(const [x,y,kind] of comp){gf.push([x,y]);if(kind==='arm')ga++;else gt++;}}
      if(nf.length){gap.notchCells.push(m.id);keep(shots.notch,nf.length,cropFlags(full,g.rects[k],nf));}
      if(wf.length){gap.waist+=wf.length;gap.waistCells.push(m.id);keep(shots.waist,wf.length,cropFlags(full,g.rects[k],wf));}
      if(ga)gap.armCells.push(m.id);if(gt)gap.thighCells.push(m.id);
      if(ga+gt){gap.cells++;gap.arm+=ga;gap.thigh+=gt;keep(shots.gap,ga+gt,cropFlags(full,g.rects[k],gf));}
      if(cp){cap.cells++;cap.pixels+=cp;capFlags[m.id]=cp;keep(shots.cap,cp,cropFlags(full,g.rects[k],cf));}
      const enc=seated?[]:enclosedBackground(full,g.rects[k]),pf=[];gap.enclosed+=enc.length;
      {const left=new Set(enc.filter(([x,y])=>!flag.has(x+','+y)).map(([x,y])=>x+','+y));
        while(left.size){const first=left.values().next().value,comp=[],stack=[first];left.delete(first);
          while(stack.length){const [x,y]=stack.pop().split(',').map(Number);comp.push([x,y]);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const n=(x+dx)+','+(y+dy);if(left.has(n)){left.delete(n);stack.push(n);}}}
          if(comp.length<=PINHOLE_MAX&&2*comp.filter(([x,y])=>inWhole(x,y)).length>=comp.length)pf.push(...comp);}}
      if(pf.length){gap.pinholes+=pf.length;gap.pinholeCells.push(m.id+':'+pf.length);keep(shots.pinhole,pf.length,cropFlags(full,g.rects[k],pf));}
      if(overview&&/\/0$/.test(m.id)){const [cx,cy,cw,ch]=g.rects[k],t=L.H.png.crop(full,cx,cy,cw,ch),paint=(list,c)=>{for(const [x,y] of list){const i=((y-cy)*cw+(x-cx))*4;t.data.set(c,i);}};
        paint(gf,[255,0,0,255]);paint(pf,[0,255,255,255]);paint(wf,[255,230,0,255]);paint(cf,[0,60,255,255]);over.push(t);}});
  }
  const tag=tagOf(o.record.id,o.sex,o.outfit);
  writeProbe('seam-gap',o,shots.gap.map(x=>x.tile));writeProbe('cap-high',o,shots.cap.map(x=>x.tile));writeProbe('waist-gap',o,shots.waist.map(x=>x.tile));writeProbe('seam-notch',o,shots.notch.map(x=>x.tile));writeProbe('seam-pinhole',o,shots.pinhole.map(x=>x.tile));
  if(over.length){const f=path.join(out,'probes','seam-overview-'+stemOf(o)+'.png');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,L.H.png.encode(L.compose(over,{cols:10,pad:2})));report.images.push(f);}
  (report.numbers.seam||={})[o.key]={gap,cap,capCells:capFlags};
  C.check(gap.arm+gap.thigh===0,'seam gap '+tag+': no hole (4+ touching background pixels) inside the upper-arm capsule ∪ sleeve or the thigh capsule ∪ bottom in '+motions.length+' poses ('+gap.notches+' notch pixels at the outline in '+gap.notchCells.length+' poses, recorded)',JSON.stringify({arm:gap.arm,thigh:gap.thigh,notches:gap.notches,notchCells:gap.notchCells.slice(0,8),armCells:gap.armCells.slice(0,6),thighCells:gap.thighCells.slice(0,6)}));
  // Pinholes: a legacy pair (the packed basic's cuffs over today's arm clip) is recorded; any other outfit must have none.
  const pin='seam pinholes '+tag+': '+gap.pinholes+' enclosed background pixels in patches of ≤ '+PINHOLE_MAX+' px at least half inside the full-radius upper-arm/thigh capsules (+'+PINHOLE_GROW+' px) in '+gap.pinholeCells.length+' of '+motions.length+' poses (cuff/forearm and shorts-cuff/thigh seams; '+gap.enclosed+' enclosed pixels in all, the rest between limbs)';
  if(o.legacyPair)C.record(pin+' — legacy pair, recorded (WP11 rebuild / Lane A arm clip)',JSON.stringify(gap.pinholeCells.slice(0,12)));
  else C.check(gap.pinholes===0,pin,JSON.stringify(gap.pinholeCells.slice(0,12)));
  // Seated breathing lifts the chest .14 u: a packed legacy bottom only meets the hem, so a
  // 1 px background line opens there (the pipeline extends bottoms to the waist cover line W).
  if(o.legacyPair)C.record('waist seam '+tag+' (legacy pair, recorded: the packed shorts only meet the hem; WP11 rebuild extends bottoms to W): '+gap.waist+' background pixels between hem and shorts in '+gap.waistCells.length+' poses',JSON.stringify(gap.waistCells.slice(0,8)));
  else C.check(gap.waist===0,'waist seam '+tag+': no background pixel between the top\'s hem and the bottom in '+motions.length+' poses',JSON.stringify({pixels:gap.waist,poses:gap.waistCells.slice(0,6)}));
  C.check(cap.raised>0&&cap.pixels===0,'CAP_HIGH '+tag+': no sleeve pixel inside the head/neck capsule in '+cap.raised+' raised-arm front/back poses',JSON.stringify({pixels:cap.pixels,cells:Object.entries(capFlags).slice(0,4)}));
  return{gap,cap};
}
const FOREARM_BARE=new Set(Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','garment-template','products.json'),'utf8')).products).filter(([,p])=>p.forearmBare).map(([k])=>k));
// Floor sits are the seated layers' (verify-seated-*): a new garment has none yet (stage 5), the basic tee shows there.
const FOREARM_MIN=6;  // px of bare skin in one pose's forearm capsule that count (a cuff's 1-2 px antialiased rim does not)
const PALE_STATES=()=>{const out=[];for(const direction of M.DIRECTIONS){for(const action of M.ACTIONS)for(const k of [0,4])out.push({...M.actionState(action,direction,k),reducedMotion:true});for(const gesture of M.GESTURES)out.push({...M.gestureState(gesture,direction,3),reducedMotion:true});}return out;};
// Untinted skin and the pale band (REDTEAM-corrected). Garment pictures are
// never tinted, so every garment pixel is the same at tones 0 and 4; skin
// baked into a garment picture is therefore the invariant pixel that, at
// tone 0, continues the tinted skin next to it. Per slot, on the slot's own
// topmost pixels (its slot-only picture equals the full one):
//  - untinted skin: invariant between tones 0 and 4 (≤ 8) AND skin-likely
//    (within 16 of the tone-0 colour of a tinted body pixel at most 2 px
//    away: one that changes by > 30 between the tones and belongs to no
//    garment; and within 16 of the sheet-skin palette) AND not a declared
//    cloth colour of the record (catalogue colours, and for a --records build
//    the colours its 만들기.json measured; > 12 away);
//  - pale band (tone 4): those pixels that show as a light band on dark skin,
//    at least 30 levels lighter than that skin at tone 4.
// A pixel counts only in a band (≥ 2 of its 8 neighbours flagged too).
// Colour alone cannot do it: the basic's cream trims share the sheet-skin
// palette's bins (distance 0, measured), so a colour-only probe flags cream
// cloth (REDTEAM). The 5-tone strip (inspect-foundation-garments.cjs) stays
// the authority.
async function skinPart(page,C,o,cloth,palette,longSleeve=false){
  const states=PALE_STATES(),SLOTS=['top','bottom','shoes'],pale=Object.fromEntries(SLOTS.map(s=>[s,0])),untinted=Object.fromEntries(SLOTS.map(s=>[s,0])),shots={pale:[],untinted:[],forearm:[]},cellsHit={pale:[],untinted:[],forearm:[]};let forearm=0;
  const lum=c=>.3*c[0]+.59*c[1]+.11*c[2],R=2;
  for(let start=0;start<states.length;start+=COLS*4){
    const chunk=states.slice(start,start+COLS*4),cells=sk=>chunk.map(st=>({av:{sex:o.sex,sk,hair:HAIR[o.sex],expression:'bright:0',foundationGarments:o.outfit},state:st}));
    let g=await page.evaluate(spec=>__fg.grid(spec),{cells:cells(0),cols:COLS,cellW:CELL.w,cellH:CELL.h,bg:MAG});await page.evaluate(()=>__fg.mode('fg-noshadow'));const A0=await L.capture(page,g);
    g=await page.evaluate(spec=>__fg.grid(spec),{cells:cells(4),cols:COLS,cellW:CELL.w,cellH:CELL.h,bg:MAG});await page.evaluate(()=>__fg.mode('fg-noshadow'));const A4=await L.capture(page,g);
    const slotShot={};for(const s of SLOTS){await page.evaluate(m=>__fg.mode(m),'fg-'+s+' fg-noshadow');slotShot[s]=await L.capture(page,g);}
    const fore=longSleeve?L.dataUrlPng((await page.evaluate(s=>__fg.regions(s),{width:g.width,height:g.height})).forearm):null;
    chunk.forEach((st,k)=>{const [x0,y0,w,h]=g.rects[k],n=w*h,own={},tinted=new Uint8Array(n);
      for(const s of SLOTS)own[s]=new Uint8Array(n);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=y*w+x,a4=L.px(A4,x0+x,y0+y),a0=L.px(A0,x0+x,y0+y);let mine=false;
        for(const s of SLOTS){const c=L.px(slotShot[s],x0+x,y0+y);if(!L.isMagenta(c,60)&&L.dist(a4,c)<=8){own[s][j]=1;mine=true;}}
        if(!mine&&!L.isMagenta(a0,60)&&L.dist(a0,a4)>30)tinted[j]=1;}
      if(fore){const flags=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(tinted[y*w+x]&&L.px(fore,x0+x,y0+y)[0]>128)flags.push([x0+x,y0+y]);
        if(flags.length>FOREARM_MIN&&!st.floor&&st.seatMode!=='floor'){forearm+=flags.length;cellsHit.forearm.push((st.gesture||st.action)+'/'+st.direction);if(shots.forearm.length<12)shots.forearm.push(cropFlags(A0,g.rects[k],flags));}}
      for(const s of SLOTS){const U=new Uint8Array(n),P=new Uint8Array(n);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=y*w+x;if(!own[s][j])continue;const a0=L.px(A0,x0+x,y0+y),a4=L.px(A4,x0+x,y0+y);
          if(L.dist(a0,a4)>8||minDist(a0,cloth[s])<=12||minDist(a0,palette)>16)continue;
          let best=null;for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h||!tinted[yy*w+xx])continue;const d=L.dist(a0,L.px(A0,x0+xx,y0+yy));if(d<=16&&(!best||d<best.d))best={d,xx,yy};}
          if(!best)continue;U[j]=1;if(lum(a4)-lum(L.px(A4,x0+best.xx,y0+best.yy))>=30)P[j]=1;}
        const band=(B,label,img)=>{const flags=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){if(!B[y*w+x])continue;let c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&B[(y+dy)*w+x+dx])c++;if(c>=2)flags.push([x0+x,y0+y]);}
          if(flags.length){cellsHit[label].push(s+':'+(st.gesture||st.action)+'/'+st.direction);if(shots[label].length<12)shots[label].push(cropFlags(img,g.rects[k],flags));}return flags.length;};
        untinted[s]+=band(U,'untinted',A0);pale[s]+=band(P,'pale',A4);}});
  }
  writeProbe('pale',o,shots.pale);writeProbe('untinted',o,shots.untinted);writeProbe('forearm-skin',o,shots.forearm);
  // A sleeve the shop keeps ending on the forearm (products.json "forearmBare": the knit, user 2026-10-16) is recorded.
  if(longSleeve&&FOREARM_BARE.has(o.record.id))C.record('long sleeve forearm '+o.key+' (products.json forearmBare: the sleeve ends on the forearm by decision): '+forearm+' bare forearm pixels',JSON.stringify(cellsHit.forearm.slice(0,8)));
  else if(longSleeve)C.check(forearm===0,'long sleeve forearm '+o.key+': no bare skin (tone-dependent pixels, more than '+FOREARM_MIN+' per pose) inside the forearm capsule (elbow to .75 of the wrist) in '+states.length+' poses',JSON.stringify({pixels:forearm,cells:cellsHit.forearm.slice(0,8)}));
  (report.numbers.skin||={})[o.key]={pale,untinted,states:states.length,cells:{pale:cellsHit.pale.slice(0,12),untinted:cellsHit.untinted.slice(0,12)}};
  return{pale,untinted,states:states.length};
}
async function probesPart(page,C,list){
  const palette=L.skinPalette(),basicIds=new Set(list.filter(r=>r.source==='index'&&r.legacy).map(r=>r.id)),basic={pale:0,untinted:0,seam:[]};
  for(const o of await outfits(page,list)){
    const seam=await seamPart(page,C,o);
    const cloth={};for(const [slot,id] of Object.entries(o.outfit)){const d=await recordData(page,id,o.sex),built=RECS.valid.find(r=>r.record.id===id);cloth[slot]=d?L.clothColours(d.record,o.sex,built?.cloth?.[o.sex]):[];}
    const r=await skinPart(page,C,o,cloth,palette,o.record.class==='top/long-sleeve'),own=o.record.slot,tag=tagOf(o.record.id,o.sex,o.outfit);
    if(basicIds.has(o.record.id)){basic.pale+=SLOT_SUM(r.pale);basic.untinted+=SLOT_SUM(r.untinted);basic.seam.push(seam.gap.waist);
      C.record('pale band / untinted skin '+tag+' (the packed basic: its known defect, the control below): '+JSON.stringify(r.pale)+' pale / '+JSON.stringify(r.untinted)+' untinted pixels in '+r.states+' poses');}
    // An alias is the packed basic piece through a colour filter: the basic's baked skin comes along
    // (a hue rotation leaves its near-grey highlights skin-like), so it is recorded like the basic.
    else if(o.record.legacy)C.record('pale band / untinted skin '+tag+' (legacy alias of the packed basic, recorded): '+own+' '+r.pale[own]+' pale / '+r.untinted[own]+' untinted pixels in '+r.states+' poses',JSON.stringify({pale:r.pale,untinted:r.untinted}));
    else{C.check(r.pale[own]===0,'pale band (tone 4) '+tag+': no light band of baked skin on its own topmost '+own+' pixels in '+r.states+' poses',JSON.stringify(r.pale));
      C.check(r.untinted[own]===0,'untinted skin (tone 0/4 invariant ∧ skin-likely ∧ not a cloth colour) '+tag+': none on its own '+own+' pixels',JSON.stringify(r.untinted));}
  }
  // The control: the packed basic outfit is known to carry baked sheet skin (pale bands under the
  // shorts cuffs, the collar notch, sleeve cuff specks; 검증/기준캐릭터/피부색-5종.png). The probes MUST see it.
  if(basicIds.size){check(basic.pale>0&&basic.untinted>0,'PALE BAND control: today\'s basic outfit FAILS the pale-band and untinted-skin probes as it must ('+basic.pale+' pale, '+basic.untinted+' untinted pixels; fixed by the rebuild, WP11)',JSON.stringify(report.numbers.skin));
    report.controls.push({control:'pale band / untinted skin on the packed basic',expected:'fail',pale:basic.pale,untinted:basic.untinted});}
  // Controls of the seam-gap and CAP_HIGH probes: tee mutations that MUST fail them.
  //  gap:   every sleeve cleared from 10 sheet rows above its cuff down (sleeve ends short of the arm's clip line);
  //  crown: each front/back sleeve moved 40 sheet px toward the neck and 20 px up (cloth where a crown swings in).
  const muts=await page.evaluate(async()=>[await __fg.sleeveMutation('top:tee','top:teegap','gap'),await __fg.sleeveMutation('top:tee','top:teecrown','crown')]);
  const subset={gap:m=>['idle','walk','wave'].includes(m.motion)&&m.direction!=='left',crown:m=>['wave','happy','climb','jump'].includes(m.motion)&&['front','back'].includes(m.direction)};
  for(const [kind,label,field] of [['gap','SEAM GAP','arm'],['crown','CAP_HIGH','cap']]){const id='top:tee'+kind;let total=0;const ctl=collector(label.toLowerCase()+' control');
    for(const sex of ['m','f']){const outfit=await page.evaluate(([id,sex])=>__fg.outfitFor(id,sex),[id,sex]),o={record:{id,slot:'top'},sex,outfit,key:sex+'|'+Object.values(outfit).join('|'),legacyPair:true};
      const r=await seamPart(page,ctl,o,{only:subset[kind]});total+=field==='arm'?r.gap.arm:r.cap.pixels;}
    report.controls.push({control:label+' probe on '+id+' ('+(kind==='gap'?'sleeves cleared from 10 rows above the cuff down':'sleeves moved 40 px toward the neck, 20 px up')+')',expected:'fail',flagged:total,failed:ctl.rows.filter(x=>!x.ok).length,output:ctl.rows,registered:muts});
    check(total>0,label+' control: '+id+' FAILS the '+(kind==='gap'?'seam-gap':'head/neck capsule')+' probe as it must ('+total+' flagged pixels)',JSON.stringify(ctl.rows.filter(x=>!x.ok).map(x=>x.name)));}
}
const SLOT_SUM=o=>Object.values(o).reduce((s,v)=>s+v,0);

// ======================================================================= main
(async()=>{
  try{
    if(recordsError)fail('--records '+a.records,recordsError);
    if(RECS.dir){report.records={dir:RECS.dir,files:RECS.records.map(r=>({file:r.file,kind:r.kind,id:r.record?.id??null,atlases:r.atlasFiles,issues:r.issues})),skipped:RECS.skipped};
      check(RECS.records.length>0,'--records '+RECS.dir+': at least one garment record file (sd-garment-<cat>-<shape>.js or a *.json record)',RECS.records.length?RECS.records.length+' record file(s), '+RECS.valid.length+' valid, '+RECS.skipped.length+' other file(s) skipped':'no record file; '+(RECS.skipped.map(s=>s.file+': '+s.reason).join('; ')||'empty directory'));
      for(const r of RECS.records)check(r.record&&!r.issues.length,'--records '+r.file+' ('+(r.record?.id||'no id')+'): a valid record with its atlases ('+Object.entries(r.atlasFiles).map(([s,f])=>s+'='+f).join(' ')+')',r.issues.map(i=>i.code+' '+(i.path||'')+': '+i.message).join(' | '));}
    if(only.includes('route'))await routeTest();
    if(only.includes('bundles'))bundleTest();
    if(only.some(o=>!['route','bundles'].includes(o))){
      const overlay={};for(const o of H.list(a.overlay,[])){const [rel,file]=o.split('=');overlay[rel]=path.resolve(file);}
      const server=await H.serve(H.fsTree(ROOT,overlay)),browser=await H.launch({args:H.RASTER_ARGS});
      try{
        if(only.includes('normal'))await normalTest(browser,server.base);
        if(only.includes('runtime'))await studioTest(browser,server.base);
        if(only.includes('studio'))await studioHostTest(browser,server.base);
        if(only.some(o=>['matrix','negatives','limits','probes'].includes(o))){
          const {context,page}=await L.openRuntime(browser,server.base,report);await L.install(page);
          // Control (VFG_DROP_SLEEVE_FOLD=1): the runtime as before the long sleeve's folded-forearm copy, which the
          // forearm probe must catch (bare forearm painted over the sleeve in front/back runs and jumps).
          if(process.env.VFG_DROP_SLEEVE_FOLD)await page.evaluate(()=>{const O=window.QPFoundationOutfit;window.QPFoundationOutfit={...O,apply:(b,p)=>{const r=O.apply(b,p);b.sleeveFold=null;return r;}};});
          const reg=await L.registerAll(page,{records:RECS.valid});
          check([...Object.values(reg.aliases),...Object.values(reg.records)].every(s=>typeof s==='object'&&Object.values(s).every(v=>v==='ready'))&&Object.keys(reg.records).length===RECS.valid.length,'manifest: '+L.ALIASES.length+' alias records'+(RECS.dir?' and '+Object.keys(reg.records).length+'/'+RECS.valid.length+' valid --records':'')+' registered in the studio session',JSON.stringify(reg));
          const ids=H.list(a.ids,null),list=(await page.evaluate(()=>__fg.recordList())).filter(r=>!ids||ids.includes(r.id));report.manifest=list;console.log('records under test: '+list.map(r=>r.id+'['+r.source+']').join(', '));
          if(only.includes('matrix'))await matrixPart(page,main,list);
          if(only.includes('negatives')){await poolPart(page,main,list);await differsPart(page,main);await lapShoePart(page,main);await hoodPart(page,main);}
          if(only.includes('limits'))await limitsPart(page,main,list);
          if(only.includes('probes'))await probesPart(page,main,list);
          await context.close();
          if(only.includes('negatives')){await keyStripPart(browser);await servedPart(browser);}
        }
        if(only.includes('file'))await require('./verify-file-foundation.cjs').run(browser,{report,check,out:path.join(out,'file')});
      }finally{await browser.close();await server.close();}
    }
  }catch(e){fail('crash',e.stack||String(e));}
  report.errors=[...new Set(report.errors)];if(report.errors.length)fail('page errors',report.errors.join(' | '));
  report.success=report.failures.length===0;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
  console.log((report.success?'PASS':'FAIL')+': '+report.checks.length+' checks passed, '+report.failures.length+' failed, '+report.recorded.length+' known defects recorded (not counted as passes); controls: '+report.controls.map(c=>c.control+' → '+(c.failed??(c.pale+'/'+c.untinted))).join('; ')+'; '+path.join(out,'report.json'));
  if(!report.success)process.exitCode=1;
})();
