'use strict';
// R0 render signature of the foundation (기준 캐릭터) runtime — stage 3, WP0.
// The identity gate for packaging work (WP3, WP9, every lock handover): the
// basic outfit must render exactly as before over the whole motion matrix.
//
// Usage (from 퀴즈나라/, headless, ?demo=1 only, Firebase blocked):
//   node tools/foundation-signature.cjs --out 검증/기준선/r0-full.json      record a baseline
//   node tools/foundation-signature.cjs --compare 검증/기준선/r0-full.json  exit 1 on any difference
//   node tools/foundation-signature.cjs --mode garment --out …            head/hair excluded (from H3 on)
//   node tools/foundation-signature.cjs --self-test                       scratch mutations must be reported
//   node tools/foundation-signature.cjs --head-sheets                     before-sheets of the 24 heads
// Options:
//   --mode full|garment   full (default, the WP3/WP9 gate): whole-svg node signature, full-avatar pixels
//                         and garment-only pixels. garment (R0 from H3 on, when heads change by design):
//                         the head and back hair (and their clip definitions) are left out of the node
//                         signature and hidden in both screenshots (headless + garment-only); node
//                         counts use NODE_TABLE 'body' (149 for the basic outfit, every head).
//   --sexes m,f --sizes 280,120 --tones 0,4   a subset (a gate run uses the defaults: 2376 samples)
//   --root <dir>          tree to serve (default: this 퀴즈나라); --overlay rel=file serves a scratch copy
//   --av '<json>'         extra avatar fields for render() (e.g. garment ids once records exist)
//   --images <dir>        keep the batch screenshots (contact sheets) for viewing and pixel diffs;
//   --baseline-images <dir>  with --compare: the baseline's --images, so mismatching samples get
//                         baseline | current | difference crops in 검증/기준선/r0-diff/
//   --ignore-attr a,b     more attributes to leave out; --strict-labels keeps the internal labels
//   --hide '<selector>'   (garment mode) more nodes to hide, e.g. a future hair-back layer
//   --full                (self-test) run the mutations on the whole matrix instead of 120 px / tone 0
// Environment: QUIZ_BROWSER_EXECUTABLE (the same binary for baseline and compare; it is recorded).
//   The browser runs with one software raster thread (verify-harness RASTER_ARGS): with parallel
//   raster, 16 of 2376 samples differed by one colour level in 1–7 pixels between two runs.
// Runtime: about 2.5 minutes for the full matrix (4-CPU cloud container, software rendering);
//   --self-test about 3 minutes (4 runs at 120 px / tone 0), 10 with --full.
//
// Per sample (sex × size × tone × [static | direction × motion × step]):
//   nodes   element count below <svg> (garment mode: without head/back hair/their defs)
//   dom     hash of the normalised DOM: attributes sorted, render ids qpf-N → qpf-X, long values
//           (data URLs) hashed, blink/phase delays normalised, renamed attributes mapped (below)
//   outfit  hash of the ordered outfit nodes: part, tag, href hash, x/y/w/h, transform, d, fill,
//           stroke, visibility, owner group transform/display, parent part, sibling index, screen
//           matrix (getCTM), clip path d/transform, plus the body part order and the outfit clips
//   walk    dom + outfit of ONE avatar applying the whole matrix in order (history-dependent paths)
//   px      sha of the avatar's pixels (full mode: whole avatar; garment mode: head hidden)
//   gpx     sha of the garment-only pixels (every node but [data-outfit-part] hidden)
// Fresh samples are separate avatars rendered into one grid per (sex,size,tone,direction) and
// captured in one screenshot; CSS animations are off inside the grid (blink normalised).
// Renamed attributes allowed to differ (plan, verification A): data-foundation-outfit 'dressed'
// reads as 'basic'; data-foundation-garments, data-foundation-fallback, data-foundation-class,
// data-outfit-garment are ignored. Internal cache labels data-outfit-source and data-sleeve-art
// are ignored unless --strict-labels.
// Node table: tools/foundation-matrix.cjs NODE_TABLE; every sample must match it (198 m / 192 f).
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const M=require('./foundation-matrix.cjs'),H=require('./verify-harness.cjs');
const ROOT=path.resolve(__dirname,'..');
const RENAMED=['data-foundation-garments','data-foundation-fallback','data-foundation-class','data-outfit-garment'];
const LABELS=['data-outfit-source','data-sleeve-art'];
const BG='#dfe6ee';

// ---------------------------------------------------------------- page side
// Injected once; everything it measures stays in the page except hashes.
function pageLib(cfg){
  const api=window.QPAvatarFoundation,garment=cfg.mode==='garment',ignore=new Set(cfg.ignore);
  const HEAD_DEF=/-head-front$|-hair-behind$|-head-only-|-bow-(crown|face)$/;
  const headNode=el=>el.matches('[data-foundation-head],[data-foundation-back-hair]')||el.parentElement?.tagName==='defs'&&HEAD_DEF.test(el.id||'')||(cfg.hide&&el.matches(cfg.hide));
  // cyrb53 twice (two seeds): 106 bits.
  const cyrb=(s,seed)=>{let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);};
  const hash=s=>cyrb(s,1)+'.'+cyrb(s,7);
  const memo=new Map(),long=v=>{let h=memo.get(v);if(h===undefined){h='#'+hash(v)+':'+v.length;memo.set(v,h);}return h;};
  const norm=v=>v.length>256?long(v):v.replace(/qpf-\d+/g,'qpf-X').replace(/(--qpx-blink-cycle|animation-delay|--[\w-]*phase)\s*:\s*-?[\d.e-]+m?s/g,'$1:N');
  const value=(name,v)=>name==='data-foundation-outfit'&&v==='dressed'?'basic':norm(v);
  function dom(svg){
    const parts=[];let nodes=0;
    (function walk(el){for(const c of el.children){if(garment&&headNode(c))continue;nodes++;const attrs=[...c.attributes].filter(a=>!ignore.has(a.name)).map(a=>a.name+'='+value(a.name,a.value)).sort();parts.push('<'+c.tagName+' '+attrs.join(' ')+'>');walk(c);parts.push('</>');}})(svg);
    const root=[...svg.attributes].filter(a=>!ignore.has(a.name)).map(a=>a.name+'='+value(a.name,a.value)).sort().join(' ');
    return{nodes,dom:hash(root+parts.join(''))};
  }
  const r4=x=>Math.round(x*1e4)/1e4,attr=(e,k)=>{const v=e.getAttribute(k);return v==null?null:norm(v);};
  function outfit(svg){
    const recs=[[...svg.querySelectorAll('[data-foundation-part]')].map(p=>(p.closest('[data-foundation-front-hand]')?'^':'')+p.dataset.foundationPart).join()];
    for(const e of svg.querySelectorAll('[data-outfit-part]')){
      const owner=e.closest('[data-outfit-owner]'),part=e.closest('[data-foundation-part]'),ref=(e.getAttribute('clip-path')||'').match(/#([^)]+)/)?.[1],clip=ref?svg.querySelector('[id="'+ref+'"] path'):null,m=e.getCTM();
      recs.push([e.dataset.outfitPart,e.tagName,...['href','x','y','width','height','transform','d','fill','stroke','stroke-width','clip-path','style'].map(k=>attr(e,k)),e.checkVisibility({visibilityProperty:true}),
        owner?[owner.dataset.outfitOwner,attr(owner,'transform'),attr(owner,'style')]:null,part?part.dataset.foundationPart:null,[...e.parentNode.children].indexOf(e),clip?[attr(clip,'d'),attr(clip,'transform')]:null,m?[m.a,m.b,m.c,m.d,m.e,m.f].map(r4):null]);
    }
    for(const c of svg.querySelectorAll('[data-outfit-defs] clipPath'))recs.push(['clip',norm(c.id),...[...c.children].map(p=>[attr(p,'d'),attr(p,'transform')])]);
    const text=JSON.stringify(recs);return{outfit:hash(text),detail:text};
  }
  const classOf=svg=>svg.dataset.foundationClass||(svg.dataset.foundationOutfit==='body'?'none|none|none':'short-sleeve|shorts|low');
  // apply() adds each seated avatar's own breathing offset (render serial,
  // avatar-foundation.js breathOffset); it is removed so the sample's time is
  // what shows, whatever the order of renders.
  const offset=svg=>(Number(String(svg.dataset.foundationId).slice(4))||0)*1.37%3.3;
  const posed=(svg,state)=>state.action==='sit'||state.action==='floor-sit'?{...state,time:state.time-offset(svg)}:state;
  function sign(svg,detail){const d=dom(svg),o=outfit(svg);return{nodes:d.nodes,total:svg.querySelectorAll('*').length,dom:d.dom,outfit:o.outfit,cls:classOf(svg),detail:detail?o.detail:undefined};}
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  async function settle(root){
    const hrefs=new Set();for(const im of root.querySelectorAll('image'))hrefs.add(im.getAttribute('href'));
    await Promise.all([...hrefs].filter(Boolean).map(h=>{const i=new Image();i.src=h;return i.decode().catch(()=>{});}));
    for(const im of root.querySelectorAll('image'))if(im.decode)await im.decode?.().catch(()=>{});
    await frame();await frame();
  }
  let host=document.getElementById('r0-host');
  if(!host){
    const style=document.createElement('style');style.textContent=`
      #r0-host{position:absolute;left:0;top:0;z-index:2147483647;display:grid;background:${cfg.bg};margin:0;padding:0}
      #r0-host,#r0-host *{animation:none!important;transition:none!important}
      #r0-host .r0-cell{position:relative;overflow:hidden}
      #r0-host .r0-cell>svg{position:absolute}
      #r0-host.r0-headless [data-foundation-head],#r0-host.r0-headless [data-foundation-back-hair]${cfg.hide?','+cfg.hide.split(',').map(s=>'#r0-host.r0-headless '+s).join(','):''}{display:none!important}
      #r0-host.r0-garment svg *:not(defs):not(defs *){visibility:hidden!important}
      #r0-host.r0-garment svg [data-outfit-part],#r0-host.r0-garment svg [data-outfit-part] *{visibility:visible!important}
      #r0-host .r0-label{font:600 13px/1.2 sans-serif;color:#25313d;display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre}`;
    document.head.append(style);host=document.createElement('div');host.id='r0-host';document.body.append(host);
  }
  const clear=()=>{for(const svg of host.querySelectorAll('svg[data-qp-foundation]'))api.destroy(svg);host.replaceChildren();host.className='';};
  window.__r0={
    // One grid of fresh avatars: [{key,state|null}] → signatures + cell rects.
    async grid({av,size,cells,cols,detail}){
      clear();const w=size*32/56,h=size*62/56,cw=Math.ceil(w*1.7),ch=Math.ceil(h*1.3);host.style.gridTemplateColumns=`repeat(${cols},${cw}px)`;host.style.gridAutoRows=ch+'px';
      const res=[];
      for(const c of cells){
        const cell=document.createElement('div');cell.className='r0-cell';cell.style.width=cw+'px';cell.style.height=ch+'px';host.append(cell);
        cell.innerHTML=api.render(av,size);const svg=cell.firstElementChild;svg.style.left=((cw-w)/2)+'px';svg.style.top=Math.round(h*.18)+'px';
        if(svg.dataset.foundationStatic==='pending')throw Error('render is still pending (art not ready): '+c.key);
        if(c.state)api.apply(svg,posed(svg,c.state));
        res.push({key:c.key,...sign(svg,detail)});
      }
      await settle(host);
      const rects=[...host.children].map(e=>{const r=e.getBoundingClientRect();return[Math.round(r.left+scrollX),Math.round(r.top+scrollY),Math.round(r.width),Math.round(r.height)];});
      const box=host.getBoundingClientRect();return{res,rects,width:Math.ceil(box.width),height:Math.ceil(box.height)};
    },
    async mode(name){host.className=name;await frame();await frame();},
    // One avatar walking through every state in order.
    walk({av,size,cells}){
      const holder=document.createElement('div');holder.style.cssText='position:absolute;left:-6000px;top:0';document.body.append(holder);
      holder.innerHTML=api.render(av,size);const svg=holder.firstElementChild,res=[];
      for(const c of cells){if(c.state)api.apply(svg,posed(svg,c.state));const s=sign(svg,false);res.push({key:c.key,nodes:s.nodes,total:s.total,dom:s.dom,outfit:s.outfit});}
      api.destroy(svg);holder.remove();return res;
    },
    // Labelled sheet: rows of [label, avatars…]; each avatar {av,state} cropped to its top `crop` px.
    async sheet({size,rows,header,crop,cellW}){
      clear();const w=size*32/56,h=size*62/56,cw=cellW||Math.ceil(w*1.15),labelW=110;host.style.gridTemplateColumns=`${labelW}px repeat(${header.length},${cw}px)`;host.style.gridAutoRows='auto';
      const add=(text,height)=>{const d=document.createElement('div');d.className='r0-label';d.textContent=text;d.style.height=height+'px';host.append(d);};
      add('',34);for(const t of header)add(t,34);
      for(const row of rows){add(row.label,crop);for(const item of row.items){const cell=document.createElement('div');cell.className='r0-cell';cell.style.width=cw+'px';cell.style.height=crop+'px';host.append(cell);cell.innerHTML=api.render(item.av,size);const svg=cell.firstElementChild;svg.style.left=((cw-w)/2)+'px';svg.style.top=(item.top||0)+'px';if(item.state)api.apply(svg,item.state);}}
      await settle(host);const box=host.getBoundingClientRect();return{width:Math.ceil(box.width),height:Math.ceil(box.height)};
    },
    clear
  };
}

// ------------------------------------------------------------------ helpers
async function openRuntime(browser,base,report){
  const context=await browser.newContext({viewport:{width:1400,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
  await H.isolate(context,report);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  // The studio's runtime URL (avatar-standard.html iframe): demo, studio session.
  await page.goto(new URL('index.html?demo=1&session=foundation-studio',base).href);
  await page.waitForFunction(()=>window.QPGame&&window.QPAvatarFoundation,null,{timeout:90000});
  await page.evaluate(()=>{QPGame.go('login');window.QPFoundationSkin?.load();window.QPFoundationOutfit?.load();});
  await page.waitForFunction(()=>{const ok=m=>!m||m.atlas?.ready||Boolean(m.atlas?.error);return ok(window.QPFoundationSkin)&&ok(window.QPFoundationOutfit)&&window.QPAvatar?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPShoes?.atlas.ready&&window.QPAvatarDirection?.atlas.ready&&window.QPAvatarDirection.atlas.backReady;},null,{timeout:120000,polling:100});
  const errors=await page.evaluate(()=>[window.QPFoundationSkin?.atlas?.error,window.QPFoundationOutfit?.atlas?.error].filter(Boolean));
  if(errors.length)throw Error('foundation art failed to load: '+errors.join('; '));
  return{context,page,version:browser.version()};
}
const COLS=10;
async function capture(page,shape,file){
  await page.setViewportSize({width:Math.max(200,shape.width),height:Math.max(200,shape.height)});
  const buf=await page.screenshot({clip:{x:0,y:0,width:shape.width,height:shape.height},animations:'disabled',caret:'hide'});
  if(file)fs.writeFileSync(file,buf);return H.png.decode(buf);
}

// One full signature run. Returns {meta, samples:{key:{…}}, details:{key:outfitText}}.
async function run(opts){
  const report={errors:[],blocked:[]},tree=H.fsTree(opts.root||ROOT,opts.overlay||{}),server=await H.serve(tree);
  const browser=opts.browser||await H.launch({args:H.RASTER_ARGS});const t0=Date.now();
  let ctx;
  try{
    ctx=await openRuntime(browser,server.base,report);const {page}=ctx;
    const mode=opts.mode||'full',ignore=[...RENAMED,...(opts.strictLabels?[]:LABELS),...(opts.ignore||[])];
    await page.evaluate(pageLib,{mode,ignore,hide:opts.hide||'',bg:BG});
    const samples={},details={},walk={},sexes=opts.sexes||M.SEXES,sizes=opts.sizes||M.SIZES,tones=opts.tones||M.TONES,motions=M.motions();
    if(opts.images)fs.mkdirSync(opts.images,{recursive:true});
    for(const sex of sexes)for(const size of sizes)for(const tone of tones){
      const avatar=M.avatarKey(sex,size,tone),av=M.referenceAvatar(sex,tone,opts.av||{});
      // History: one avatar through the static render and every pose in order.
      const order=[{key:avatar+'/'+M.STATIC,state:null},...motions.map(m=>({key:avatar+'/'+m.id,state:m.state}))];
      for(const w of await page.evaluate(spec=>window.__r0.walk(spec),{av,size,cells:order}))walk[w.key]=w;
      for(const direction of M.DIRECTIONS){
        const cells=[...(direction==='front'?[{key:avatar+'/'+M.STATIC,state:null}]:[]),...motions.filter(m=>m.direction===direction).map(m=>({key:avatar+'/'+m.id,state:m.state}))];
        const g=await page.evaluate(spec=>window.__r0.grid(spec),{av,size,cells,cols:COLS,detail:true});
        const tag=avatar.replace(/\//g,'-')+'-'+direction;
        await page.evaluate(m=>window.__r0.mode(m),mode==='garment'?'r0-headless':'');
        const full=await capture(page,g,opts.images&&path.join(opts.images,tag+'.png'));
        await page.evaluate(m=>window.__r0.mode(m),'r0-garment'+(mode==='garment'?' r0-headless':''));
        const garmentOnly=await capture(page,g,opts.images&&path.join(opts.images,tag+'-garment.png'));
        g.res.forEach((s,i)=>{const [x,y,w,h]=g.rects[i];const ww=walk[s.key];
          details[s.key]=s.detail;samples[s.key]={nodes:s.nodes,total:s.total,cls:s.cls,dom:s.dom,outfit:s.outfit,walk:ww?[ww.total,ww.nodes,ww.dom,ww.outfit].join('|'):null,px:H.png.hashRect(full,x,y,w,h),gpx:H.png.hashRect(garmentOnly,x,y,w,h),rect:[x,y,w,h],sheet:tag};});
      }
      process.stderr.write('  '+avatar+' '+((Date.now()-t0)/1000).toFixed(0)+'s\n');
    }
    await page.evaluate(()=>window.__r0.clear());
    const meta={tool:'foundation-signature',version:1,mode,created:new Date().toISOString(),tree:tree.label,git:gitInfo(opts.root||ROOT),browser:ctx.version,executable:H.browserExecutable()||'playwright default',browserArgs:process.env.QUIZ_BROWSER_ARGS||H.RASTER_ARGS.join(' '),
      matrix:{sexes,sizes,tones,directions:M.DIRECTIONS,actions:M.ACTIONS,frames:M.FRAMES,gestures:M.GESTURES,gestureSteps:M.GESTURE_STEPS,perAvatar:1+motions.length},
      av:opts.av||{},ignored:ignore,renamed:{'data-foundation-outfit':{dressed:'basic'}},seconds:Math.round((Date.now()-t0)/1000),errors:report.errors,blocked:[...new Set(report.blocked)]};
    return{meta,samples,details};
  }finally{await ctx?.context.close();if(!opts.browser)await browser.close();await server.close();}
}
function gitInfo(root){try{const {execFileSync}=require('node:child_process');const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();const dirty=execFileSync('git',['status','--porcelain','--','.'],{cwd:root}).toString().trim().split('\n').filter(Boolean).length;return{head,dirtyFiles:dirty};}catch{return null;}}

// Node table: every sample's count equals the table row of its class signature.
function nodeTable(sig){
  const mode=sig.meta.mode,field=mode==='garment'?'nodes':'total',measured={},violations=[];
  // Only the reference heads are in the 'total' column (another head has its own clip count).
  const otherHead=mode!=='garment'&&sig.meta.av&&'hair' in sig.meta.av;
  for(const [key,s] of Object.entries(sig.samples)){const sex=key[0],n=s[field];
    (measured[s.cls]??={m:new Set(),f:new Set()})[sex].add(n);
    const want=M.expectedNodes(s.cls,sex,mode);
    if(want===undefined)violations.push({key,cls:s.cls,nodes:n,expected:'no NODE_TABLE row for this class signature'});
    else if(!otherHead&&n!==want)violations.push({key,cls:s.cls,nodes:n,expected:want});
    // The walking avatar (history) keeps the fresh avatar's node set.
    const walked=s.walk?Number(s.walk.split('|')[mode==='garment'?1:0]):n;if(walked!==n)violations.push({key,walker:walked,fresh:n});
  }
  return{measured:Object.fromEntries(Object.entries(measured).map(([k,v])=>[k,{m:[...v.m],f:[...v.f]}])),violations:violations.slice(0,50),violationCount:violations.length};
}

function compare(base,cur){
  const components=['nodes','total','cls','dom','outfit','walk','px','gpx'],diff={},examples=[];let count=0;
  const keys=new Set([...Object.keys(base.samples),...Object.keys(cur.samples)]);
  for(const key of keys){const a=base.samples[key],b=cur.samples[key];
    if(!a||!b){count++;(diff.missing??=[]).push(key);continue;}
    const bad=components.filter(c=>String(a[c])!==String(b[c]));if(!bad.length)continue;count++;for(const c of bad)(diff[c]??=[]).push(key);if(examples.length<25)examples.push({key,differs:bad});}
  const notes=[];
  if(base.meta.mode!==cur.meta.mode)notes.push('mode differs: '+base.meta.mode+' vs '+cur.meta.mode);
  if(base.meta.browser!==cur.meta.browser||base.meta.executable!==cur.meta.executable||base.meta.browserArgs!==cur.meta.browserArgs)notes.push('browser differs: '+base.meta.browser+' '+base.meta.executable+' vs '+cur.meta.browser+' '+cur.meta.executable+' (pixels are only comparable on one binary)');
  return{identical:count===0,differingSamples:count,byComponent:Object.fromEntries(Object.entries(diff).map(([k,v])=>[k,{count:v.length,first:v.slice(0,8)}])),examples,notes};
}
// First differing outfit record of one sample (needs both detail files).
function explain(baseDetails,curDetails,key){
  const a=JSON.parse(baseDetails[key]||'[]'),b=JSON.parse(curDetails[key]||'[]');
  for(let i=0;i<Math.max(a.length,b.length);i++)if(JSON.stringify(a[i])!==JSON.stringify(b[i]))return{index:i,baseline:a[i],current:b[i]};
  return null;
}
function save(file,sig){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const {details,...main}=sig;main.digest=H.sha256(JSON.stringify(main.samples));
  fs.writeFileSync(file,JSON.stringify(main,null,0).replace(/"(\w\/\d+\/t\d\/[^"]+)":/g,'\n"$1":')+'\n');
  fs.writeFileSync(file.replace(/\.json$/,'')+'.detail.json.gz',zlib.gzipSync(JSON.stringify(details)));
  return main.digest;
}
function load(file){const sig=JSON.parse(fs.readFileSync(file,'utf8'));const d=file.replace(/\.json$/,'')+'.detail.json.gz';sig.details=fs.existsSync(d)?JSON.parse(zlib.gunzipSync(fs.readFileSync(d))):{};return sig;}
// Side-by-side crops (baseline | current | difference) of the first pixel mismatches.
function diffImages(baseDir,curDir,base,cur,keys,outDir){
  if(!baseDir||!curDir||!fs.existsSync(baseDir))return[];const made=[];fs.mkdirSync(outDir,{recursive:true});const cache={};
  const sheet=(dir,tag,suffix)=>{const f=path.join(dir,tag+suffix+'.png');return cache[f]??=fs.existsSync(f)?H.png.decode(fs.readFileSync(f)):null;};
  for(const key of keys.slice(0,12)){const a=base.samples[key],b=cur.samples[key];if(!a||!b)continue;
    for(const [field,suffix] of [['px',''],['gpx','-garment']]){if(a[field]===b[field])continue;const A=sheet(baseDir,a.sheet,suffix),B=sheet(curDir,b.sheet,suffix);if(!A||!B)continue;
      const [x,y,w,h]=b.rect,ca=H.png.crop(A,...a.rect),cb=H.png.crop(B,x,y,w,h),out={width:w*3+8,height:h,data:Buffer.alloc((w*3+8)*h*4,255)};
      for(let r=0;r<h;r++)for(let c=0;c<w;c++){const i=(r*w+c)*4;for(let k=0;k<3;k++){out.data[(r*out.width+c)*4+k]=ca.data[i+k];out.data[(r*out.width+w+4+c)*4+k]=cb.data[i+k];}
        const d=Math.max(...[0,1,2].map(k=>Math.abs(ca.data[i+k]-cb.data[i+k])));const o=(r*out.width+2*w+8+c)*4;out.data[o]=d?255:ca.data[i]*.3+170;out.data[o+1]=d?0:ca.data[i+1]*.3+170;out.data[o+2]=d?0:ca.data[i+2]*.3+170;}
      const f=path.join(outDir,key.replace(/\//g,'_')+suffix+'.png');fs.writeFileSync(f,H.png.encode(out));made.push(f);}}
  return made;
}

// ---------------------------------------------------------------- self-test
// Scratch copies only (served through the overlay); the tree is never edited.
const MUTATIONS=[
  {name:'SEAT row +1 (m-front cut 451 → 452)',file:'avatar-foundation-outfit.js',from:"'m-front':{cut:451,",to:"'m-front':{cut:452,",expect:['outfit','px','gpx']},
  {name:'sleeve pin constant (pin falls off over 2.2 → 2.3 units of the sleeve)',file:'avatar-foundation-outfit.js',from:'along=smooth(clamp((q[1]+.2)/2.2,0,1))',to:'along=smooth(clamp((q[1]+.2)/2.3,0,1))',expect:['outfit','px','gpx']}
];
async function selfTest(opts,outDir){
  const scope=opts.full?{}:{sizes:[120],tones:[0]},browser=await H.launch({args:H.RASTER_ARGS}),result={scope:opts.full?'full matrix':'120 px, tone 0, both sexes (every direction, action, gesture)',runs:[]};
  try{
    const a=await run({...opts,...scope,browser}),b=await run({...opts,...scope,browser});
    const same=compare(a,b);result.runs.push({name:'unchanged tree, two runs',identical:same.identical,differingSamples:same.differingSamples,seconds:[a.meta.seconds,b.meta.seconds],digest:[H.sha256(JSON.stringify(a.samples)),H.sha256(JSON.stringify(b.samples))]});
    for(const m of MUTATIONS){
      const src=fs.readFileSync(path.join(opts.root||ROOT,m.file),'utf8');assert.equal(src.split(m.from).length,2,'mutation anchor must occur exactly once: '+m.from);
      const scratch=path.join(outDir,'self-test',m.file);fs.mkdirSync(path.dirname(scratch),{recursive:true});fs.writeFileSync(scratch,src.replace(m.from,m.to));
      const c=await run({...opts,...scope,browser,overlay:{[m.file]:scratch}}),cmp=compare(a,c);
      const caught=m.expect.filter(k=>cmp.byComponent[k]?.count);
      result.runs.push({name:m.name,reported:!cmp.identical,differingSamples:cmp.differingSamples,byComponent:Object.fromEntries(Object.entries(cmp.byComponent).map(([k,v])=>[k,v.count])),first:cmp.examples.slice(0,4),explain:cmp.examples[0]?explain(a.details,c.details,cmp.examples[0].key):null,expectedComponentsCaught:caught});
    }
  }finally{await browser.close();}
  result.success=result.runs[0].identical&&result.runs.slice(1).every((r,i)=>r.reported&&r.expectedComponentsCaught.length===MUTATIONS[i].expect.length);
  return result;
}

// ------------------------------------------------------------- head sheets
// Before-sheets of the current ?avatar=foundation heads: 24 paintings × 4
// directions × tones 0/4 at 280 px (idle, time 0), one sheet per sex, top of
// the avatar (head, neck, collar, shoulders).
async function headSheets(opts,dir){
  const report={errors:[],blocked:[]},server=await H.serve(H.fsTree(opts.root||ROOT,opts.overlay||{})),browser=await H.launch({args:H.RASTER_ARGS});const files=[];
  try{
    const {page,context}=await openRuntime(browser,server.base,report);
    await page.evaluate(pageLib,{mode:'full',ignore:[],hide:'',bg:'#eef1f5'});fs.mkdirSync(dir,{recursive:true});
    const size=280,names={front:'앞',right:'오른쪽',left:'왼쪽',back:'뒤'};
    for(const sex of M.SEXES){
      const header=[];for(const tone of [0,4])for(const d of M.DIRECTIONS)header.push(names[d]+' · 피부 '+tone);
      const rows=M.HAIRSTYLES[sex].map(h=>({label:h+':1\n'+(sex==='m'?'남':'여')+(M.SOLD_HAIR[sex].includes(h)?'':'\n(판매 안 함)'),items:[0,4].flatMap(tone=>M.DIRECTIONS.map(direction=>({av:{sex,sk:tone,hair:h+':1',expression:'bright:0',foundationOutfit:'basic'},state:{action:'idle',direction,time:0,reducedMotion:false},top:40})))}));
      const shape=await page.evaluate(spec=>window.__r0.sheet(spec),{size,rows,header,crop:240,cellW:170});
      const file=path.join(dir,'heads-'+sex+'-280.png');await capture(page,shape,file);files.push(file);
    }
    await page.evaluate(()=>window.__r0.clear());await context.close();
  }finally{await browser.close();await server.close();}
  return{files,errors:report.errors};
}

// --------------------------------------------------------------------- main
(async()=>{
  const a=H.args(),root=a.root?path.resolve(a.root):ROOT,out=path.resolve(root,'검증/기준선');
  const overlay={};for(const o of H.list(a.overlay,[])){const [rel,file]=o.split('=');overlay[rel]=path.resolve(file);}
  const opts={root,overlay,mode:a.mode==='garment'?'garment':'full',sexes:H.list(a.sexes),sizes:H.list(a.sizes)?.map(Number),tones:H.list(a.tones)?.map(Number),
    av:a.av?JSON.parse(a.av):undefined,ignore:H.list(a['ignore-attr'],[]),strictLabels:Boolean(a['strict-labels']),hide:a.hide&&a.hide!==true?a.hide:'',full:Boolean(a.full),images:a.images&&a.images!==true?path.resolve(a.images):a.images===true?path.join(out,'r0-images'):undefined};
  if(a['head-sheets']){const r=await headSheets(opts,a['head-sheets']===true?path.join(out,'heads'):path.resolve(a['head-sheets']));console.log(JSON.stringify(r,null,1));if(r.errors.length)process.exitCode=1;return;}
  if(a['self-test']){const r=await selfTest(opts,out);const f=path.join(out,'r0-self-test.json');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(f,JSON.stringify(r,null,1));console.log(JSON.stringify(r,null,1));if(!r.success)process.exitCode=1;return;}
  const sig=await run(opts);const table=nodeTable(sig);sig.meta.nodeTable={expected:M.NODE_TABLE,...table};
  const summary={mode:sig.meta.mode,samples:Object.keys(sig.samples).length,seconds:sig.meta.seconds,nodeTable:table,errors:sig.meta.errors,blocked:sig.meta.blocked};
  let failed=table.violationCount>0||sig.meta.errors.length>0;
  if(a.out||!a.compare){const file=a.out&&a.out!==true?path.resolve(a.out):path.join(out,'r0-'+sig.meta.mode+'.json');summary.digest=save(file,sig);summary.file=file;}
  if(a.compare){const base=load(path.resolve(a.compare)),cmp=compare(base,sig);summary.compare={baseline:path.resolve(a.compare),...cmp};
    if(!cmp.identical){const outfitKeys=cmp.byComponent.outfit?.first||[];summary.compare.explain=outfitKeys.slice(0,3).map(k=>({key:k,...explain(base.details,sig.details,k)}));
      const pxKeys=[...new Set([...(cmp.byComponent.px?.first||[]),...(cmp.byComponent.gpx?.first||[])])];summary.compare.diffImages=diffImages(a['baseline-images']?path.resolve(a['baseline-images']):null,opts.images,base,sig,pxKeys,path.join(out,'r0-diff'));
      failed=true;}}
  console.log(JSON.stringify(summary,null,1));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
