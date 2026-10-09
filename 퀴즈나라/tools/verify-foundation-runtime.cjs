'use strict';
// WP3 gate of stage 3: the data-driven garment runtime of the reference body
// (avatar-foundation-garments.js, -outfit.js, -skin.js, avatar-foundation.js,
// avatar-image.js), headless and ?demo=1 only (Firebase blocked).
//
//   node tools/verify-foundation-runtime.cjs            everything below, exit 1 on a failure
//   node tools/verify-foundation-runtime.cjs --only route,bundles,normal,studio,file
//   options: --base <rev> (routing baseline; default git merge-base HEAD origin/main),
//            --out <dir> (default 검증/옷런타임: report.json and the review images),
//            --image-source <file> (route: test this avatar-image.js instead; a negative control),
//            --overlay rel=file (browser parts: serve a scratch copy, e.g. avatar-foundation-outfit.js
//            with the garment id stripped from gk(): the studio checks must then fail)
//
//   route    avatar-image.js routing unit test: every assets/*.png key (plus synthetic
//            garment keys with '_') is loaded through the base commit's avatar-image.js and
//            through today's, on file:// and on an opaque hosted embed (SecurityError), in a
//            stubbed DOM. Every pre-existing key must route exactly as before; the only
//            intended changes are listed (the 4 legacy full-sheet garment layers leave the
//            allow-list, garment atlases and the clean body art join it).
//   bundles  the generated garment bundles fill ONE registry (QPAvatarGarmentFileData) in
//            any load order, never replace a key, and carry the PNG bytes.
//   normal   the students' path, ?demo=1 without avatar=foundation: no garment file, index,
//            garment bundle or foundation body art is requested.
//   studio   ?demo=1&session=foundation-studio (the studio runtime):
//            - basic outfit: ids/fallback/class attributes, 198/192 nodes in every motion;
//            - a registered test record (hue-rotated tee) renders other hrefs than the basic
//              (and its ids on every outfit node), the shorts/shoes unchanged;
//            - data path: records built from the legacy path's own metadata
//              (QPFoundationOutfit.legacyMetadata + raised art packed into the atlas) render
//              the same hrefs as the legacy basic over the motion sub-matrix;
//            - clean body art: a data-path top with bodyArt 'clean' shows other arm/neck
//              paintings (the rule-cleaned art) and loads the clean PNGs;
//            - fallback reasons: todo (top:hood:5), outfit (dress:7), class (a long-sleeve
//              record), error (atlas 404; also one failing while the avatar is pending),
//              candidate allowed in the studio; reasons are part of the template key;
//            - pending sets (REDTEAM): two held garment sets released in reverse order dress
//              only their own avatars (static strings and controller-mounted ones), never
//              undressed in between;
//            - the compat hold (QPFoundationOutfit.atlas.ready=false) keeps a new render
//              pending, true repaints it;
//            - a garment switch on a mounted svg equals a fresh render (outfit nodes + pixels).
//   file     file:// play of index.html?demo=1&avatar=foundation: dressed basic outfit,
//            wave (legacy underarm pixel reads) and side floor-sit without a SecurityError,
//            the three garment bundles loaded, no http request.
// Runtime about 1–2 minutes (4-CPU cloud container).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const H=require('./verify-harness.cjs');
const ROOT=path.resolve(__dirname,'..');
const a=H.args(),only=H.list(a.only,['route','bundles','normal','studio','file']),out=path.resolve(ROOT,a.out&&a.out!==true?a.out:'검증/옷런타임');
fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],failures:[]};
const ok=(name,detail)=>{report.checks.push({name,detail});console.log('ok   '+name+(detail?' — '+detail:''));};
const fail=(name,detail)=>{report.failures.push({name,detail});console.log('FAIL '+name+(detail?' — '+detail:''));};
const check=(cond,name,detail)=>cond?ok(name,detail):fail(name,detail);

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
    ['assets/sd-foundation-ref-arms-clean.png','clean body art joined the foundation bundle'],['assets/sd-foundation-ref-neck-clean.png','clean body art joined the foundation bundle']]);
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
function pageLib(){
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
  await page.waitForFunction(()=>window.QPGame&&window.QPFoundationOutfit?.atlas.ready&&window.QPFoundationSkin?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady&&window.QPAvatar?.atlas.ready,null,{timeout:120000});
  await page.evaluate(()=>QPGame.go('login'));await page.evaluate(pageLib);
  // 1. Basic outfit.
  const basic=await page.evaluate(()=>{const {mk,api,motions,garments}=__wp3,res={};
    for(const sex of ['m','f']){const svg=mk({sex,sk:0,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0',foundationOutfit:'basic'}),counts=new Set([svg.querySelectorAll('*').length]);
      const attrs={outfit:svg.dataset.foundationOutfit,garments:svg.dataset.foundationGarments,fallback:svg.dataset.foundationFallback,cls:svg.dataset.foundationClass,static:svg.dataset.foundationStatic};
      for(const m of motions){api.apply(svg,m);counts.add(svg.querySelectorAll('*').length);}
      res[sex]={attrs,counts:[...counts],garments:garments(svg)};api.destroy(svg);svg.parentNode.remove();}
    return res;});
  for(const sex of ['m','f']){const r=basic[sex],want=sex==='m'?198:192;
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
    const longTop=clone(G.get('top:tee','f').record);longTop.id='top:longtest';longTop.shape='longtest';longTop.class='top/long-sleeve';await G.register(longTop,{m:G.get('top:tee','m').image,f:G.get('top:tee','f').image}).catch(()=>{});
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
  check(fb.long.fallback==='top:class','fallback class: a long-sleeve record is not drawn by this runtime',JSON.stringify(fb.long));
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
async function fileTest(browser){
  const context=await browser.newContext({viewport:{width:1280,height:800}});const seen=[];
  await context.route('**/*',r=>{const u=new URL(r.request().url());seen.push(u.protocol+'//'+u.host+u.pathname);if(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:')return r.continue();if(u.hostname==='www.gstatic.com'&&u.pathname.includes('/firebasejs/'))return r.fulfill({contentType:'text/javascript',body:'/* isolated demo */'});if(/firebase/.test(u.hostname))report.errors.push('file: Firebase request');return r.fulfill({status:200,body:''});});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push('file: '+e.message));
  await page.goto('file://'+path.join(ROOT,'index.html')+'?demo=1&avatar=foundation&session=wp3-file');
  await page.waitForFunction(()=>window.QPGame?.getMe()&&window.QPFoundationGarments?.ready('starter')&&window.QPFoundationSkin?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady,null,{timeout:120000});
  const r=await page.evaluate(async()=>{const host=document.createElement('div');host.style.cssText='position:absolute;left:0;top:0;z-index:2147483647;background:#eef1f5;display:flex;gap:8px;padding:8px';document.body.append(host);const res={};
    for(const sex of ['m','f']){const d=document.createElement('div');d.innerHTML=avatarSVG(QPGame.newAvatar(sex),280,3);host.append(d);const svg=d.firstElementChild,api=QPAvatarFoundation;
      res[sex]={foundation:svg.dataset.qpFoundation==='1',static:svg.dataset.foundationStatic,garments:svg.dataset.foundationGarments,fallback:svg.dataset.foundationFallback,nodes:svg.querySelectorAll('*').length,hrefs:[...svg.querySelectorAll('image[data-outfit-part]')].map(e=>(e.getAttribute('href')||'').slice(0,22))};
      const w=document.createElement('div');w.innerHTML=avatarSVG(QPGame.newAvatar(sex),280,3);host.append(w);const live=w.firstElementChild;api.apply(live,{action:'idle',direction:'front',gesture:'wave',gestureProgress:.5,time:0,reducedMotion:true});res[sex].wave=live.querySelector('[data-outfit-part="underarm-line-1"]')?.getAttribute('d')?.length||0;
      const f=document.createElement('div');f.innerHTML=avatarSVG(QPGame.newAvatar(sex),280,3);host.append(f);const seat=f.firstElementChild;api.apply(seat,{action:'sit',seatMode:'floor',direction:'right',time:0,reducedMotion:true});res[sex].floor=(seat.querySelector('[data-outfit-part="shorts-hip"]')?.getAttribute('href')||'').slice(0,22);res[sex].floorNodes=seat.querySelectorAll('*').length;}
    return{res,registry:Object.keys(window.QPAvatarGarmentFileData||{}).sort()};});
  await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'file-play.png'),clip:{x:0,y:0,width:1280,height:420}});(report.images||=[]).push(path.join(out,'file-play.png'));
  // index.html's own Firebase SDK tags (stubbed here, as in every demo check) are the only remote URLs.
  const http=seen.filter(s=>/^https?:/.test(s)&&!s.startsWith('https://www.gstatic.com/firebasejs/'));
  for(const sex of ['m','f']){const x=r.res[sex],want=sex==='m'?198:192;
    check(x.foundation&&x.static==='idle-front'&&x.nodes===want&&x.hrefs.every(h=>h.startsWith('data:image/png')),'file:// '+sex+': the reference body in the basic outfit ('+x.nodes+' nodes, data-URL garment pictures)',JSON.stringify({garments:x.garments,fallback:x.fallback}));
    check(x.wave>0&&x.floor.startsWith('data:image/png')&&x.floorNodes===want,'file:// '+sex+': wave (underarm pixel reads) and side floor-sit draw without a SecurityError');}
  check(r.res.m.fallback==='bottom:todo'&&r.res.f.fallback==='','file:// new accounts: the boy\'s jeans:5 falls back to the basic shorts (todo), the girl wears her starter records',r.res.m.fallback+' / '+r.res.f.fallback);
  check(r.registry.length===6&&['top-tee','bottom-shorts','shoes-sneaker'].every(s=>seen.some(p=>p.endsWith('/assets/avatar-file-data-garment-'+s+'.js'))),'file:// the three garment bundles load side by side into one registry',r.registry.join(', '));
  check(http.length===0,'file:// no http request',http.join(', '));
  await context.close();
  // The students' page over file:// (normal URL): their art still comes from the
  // original bundles, and nothing of the reference body or its garments loads.
  {const ctx=await browser.newContext({viewport:{width:1280,height:800}}),files=[];
   await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.protocol==='file:'){files.push(u.pathname.split('/').pop());return r.continue();}if(u.protocol==='data:'||u.protocol==='blob:')return r.continue();return r.fulfill(u.hostname==='www.gstatic.com'?{contentType:'text/javascript',body:'/* isolated demo */'}:{status:200,body:''});});
   const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push('file student: '+e.message));
   await p.goto('file://'+path.join(ROOT,'index.html')+'?demo=1&session=wp3-file-student');
   await p.waitForFunction(()=>window.QPGame?.getMe()&&window.QPAvatar?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPShoes?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady,null,{timeout:120000});
   await p.evaluate(()=>QPGame.go('home'));await p.waitForSelector('#meStage .qp-pixel-avatar');await p.waitForTimeout(500);
   const st=await p.evaluate(()=>({visible:getComputedStyle(document.querySelector('#meStage .qp-pixel-avatar')).visibility,foundation:document.querySelectorAll('[data-qp-foundation]').length,bundle:Boolean(window.QPAvatarFileData)}));
   const bad=files.filter(f=>/sd-garment|avatar-file-data-garment|avatar-file-data-foundation|sd-foundation-ref-[a-z-]+\.png/.test(f));
   check(st.visible==='visible'&&st.bundle&&st.foundation===0&&bad.length===0,'file:// students\' page: their avatar from the original bundle, no reference-body or garment file',JSON.stringify({...st,bad}));
   await ctx.close();}
}

(async()=>{
  try{
    if(only.includes('route'))await routeTest();
    if(only.includes('bundles'))bundleTest();
    if(only.some(o=>['normal','studio','file'].includes(o))){
      const overlay={};for(const o of H.list(a.overlay,[])){const [rel,file]=o.split('=');overlay[rel]=path.resolve(file);}
      const server=await H.serve(H.fsTree(ROOT,overlay)),browser=await H.launch({args:H.RASTER_ARGS});
      try{if(only.includes('normal'))await normalTest(browser,server.base);if(only.includes('studio'))await studioTest(browser,server.base);if(only.includes('file'))await fileTest(browser);}
      finally{await browser.close();await server.close();}
    }
  }catch(e){fail('crash',e.stack||String(e));}
  report.errors=[...new Set(report.errors)];if(report.errors.length)fail('page errors',report.errors.join(' | '));
  report.success=report.failures.length===0;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
  console.log((report.success?'PASS':'FAIL')+': '+report.checks.length+' checks passed, '+report.failures.length+' failed; '+path.join(out,'report.json'));
  if(!report.success)process.exitCode=1;
})();
