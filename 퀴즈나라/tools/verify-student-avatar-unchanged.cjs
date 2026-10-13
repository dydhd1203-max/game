'use strict';
// Students-unchanged guard — stage 3, WP0 (plan, verification H). Until stage 5
// the students keep today's avatar: every stage-3 path runs only behind
// ?demo=1&avatar=foundation or the studio. This guard compares the working
// tree with the merge-base of the branch and origin/main (read from git
// objects, the same bytes as a fresh worktree of that commit):
//   1. strings   QPAvatar.render for both sexes × every sold item once, legacy ids, demo
//                bots, the 24 painted hair keys + old aliases × skins 0/4 × lod 2/3 ×
//                46/120/280 px; avatarSVG for raw (un-normalised) legacy avatars; shop
//                thumbs; QPAvatarDirection profile/back headMarkup. sha256 per string,
//                per-call serial ids and time phases (--qpx-phase, --qp-effect-phase: page
//                clock at render time) normalised; the old renderer's blink cycle is
//                seeded from the avatar, so it is compared as is.
//   2. screens   normal-URL ?demo=1 village, shop, campus and ranking, 1366×768, one fresh
//                page per screen: one set with prefers-reduced-motion, one without (the
//                REDTEAM blink-collision case). Math.random is seeded, the page clock frozen,
//                every CSS/Web animation set to the same time (loop phase offsets zeroed),
//                committed and cancelled. Hidden: the demo toolbar (demo only), the map under
//                the ranking overlay (shot on its own as village), and in the motion set the
//                world-life ambient layers (they integrate their own frame time).
//                Pixel-identical; no [data-qp-foundation] node.
//   3. network   the request log of (2): no file the base does not have, except an explicit
//                allow-list of new foundation scripts; never a garment/hair atlas, bundle or
//                foundation body art. Existing files requested by one side only are timing
//                (recorded as timingOnly).
//   4. files     sha256 of the protected student files (avatar-pixel.js, avatar-direction.js,
//                avatar-clothes.js, avatar-shoes.js, avatar-poses.js, assets/avatar-file-data.js,
//                assets/sd-heads*.png, sd-clothes*.png, sd-tops*.png).
//   5. css       foundation CSS uses only the qpf- prefix: every @keyframes and class it
//                defines is qpf- (or the .qp-foundation-avatar scope), every selector is scoped
//                to foundation avatars, and qpx- appears only in the scoped legacy rules the
//                base already has (they switch the old head's animation off inside a
//                foundation avatar). The same keyframe rule for CSS written by foundation JS.
//
// Usage (from 퀴즈나라/, headless, demo only, Firebase blocked):
//   node tools/verify-student-avatar-unchanged.cjs                 full guard, exit 1 on any difference
//   node tools/verify-student-avatar-unchanged.cjs --only strings,files,css   a subset
//   node tools/verify-student-avatar-unchanged.cjs --self-test     scratch mutations must be flagged
// Options: --base <rev> (default: git merge-base HEAD origin/main), --base-dir <dir> (an existing
//   worktree's 퀴즈나라 instead of git objects), --out <dir> (default 검증/기준선/student),
//   --overlay rel=file (serve a scratch copy for the current side), --screens village,shop,…,
//   --pixel-noise (allow raster noise of at most 3 levels in 1500 px; see NOISE)
// Environment: QUIZ_BROWSER_EXECUTABLE. Runtime about 3.5 minutes for the full guard (strings
//   ~40 s, screens ~150 s on the 4-CPU cloud container); --self-test about 2.5 minutes.
// Self-test (scratch copies served through the overlay, never written to the tree): one colour
//   in avatar-pixel.js, one byte of assets/sd-heads-female.png, and foundation CSS redefining
//   qpx-blink-half (also shot, so the screens must catch the students' eyelids).
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const H=require('./verify-harness.cjs'),M=require('./foundation-matrix.cjs');
const ROOT=path.resolve(__dirname,'..');
// New URLs a student page may request after stage 3 (plan, runtime: one inert script tag; H3's
// head module). Anything else new is a failure. Add here only with a plan change.
const ALLOW_NEW=['/avatar-foundation-garments.js','/avatar-foundation-head.js'];
// Never on a student page: garment/hair atlases and bundles, foundation body art.
const FORBIDDEN=[/\/assets\/sd-garment/,/\/assets\/sd-garments-index/,/\/assets\/sd-hair/,/\/assets\/avatar-file-data-garment/,/\/assets\/avatar-file-data-foundation/,/\/assets\/sd-foundation-ref-[a-z]+\.png/];
const PROTECTED=[/^avatar-pixel\.js$/,/^avatar-direction\.js$/,/^avatar-clothes\.js$/,/^avatar-shoes\.js$/,/^avatar-poses\.js$/,/^assets\/avatar-file-data\.js$/,/^assets\/sd-heads[^/]*\.png$/,/^assets\/sd-clothes[^/]*\.png$/,/^assets\/sd-tops[^/]*\.png$/];
const SCREENS=['village','shop','campus','ranking'];
const CLOCK=Date.parse('2026-10-09T09:00:00+09:00'),FROZEN_MS=1e7,ANIMATION_MS=1234;

// ------------------------------------------------------------------- trees
function repoInfo(root){
  const top=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root}).toString().trim(),prefix=path.relative(top,root).split(path.sep).join('/');
  return{top,prefix};
}
function baseTree(a,root){
  if(a['base-dir'])return H.fsTree(path.resolve(a['base-dir']));
  const {top,prefix}=repoInfo(root);let rev=a.base&&a.base!==true?a.base:null;
  if(!rev){for(const ref of ['origin/main','main']){try{rev=execFileSync('git',['merge-base','HEAD',ref],{cwd:top}).toString().trim();break;}catch{}}}
  if(!rev)throw Error('no merge-base with origin/main or main; pass --base <rev>');
  return H.gitTree(top,rev,prefix);
}
async function listFiles(tree){
  if(tree.kind==='fs'){const out=[];const walk=d=>{for(const e of fs.readdirSync(path.join(tree.root,d),{withFileTypes:true})){const rel=d?d+'/'+e.name:e.name;if(e.isDirectory()){if(!['검증','배포용','node_modules'].includes(rel))walk(rel);}else out.push(rel);}};walk('');return out;}
  // -z: no quoting of the Korean folder name.
  return execFileSync('git',['ls-tree','-r','-z','--name-only',tree.sha,'--',tree.prefix],{cwd:tree.repo,maxBuffer:64<<20}).toString('utf8').split('\0').filter(Boolean).map(f=>f.slice(tree.prefix.length));
}
async function protectedHashes(tree){
  const files=(await listFiles(tree)).filter(f=>PROTECTED.some(r=>r.test(f)));for(const rel of Object.keys(tree.overlay||{}))if(PROTECTED.some(r=>r.test(rel))&&!files.includes(rel))files.push(rel);
  const out={};for(const f of files.sort())out[f]=H.sha256(await tree.read(f));return out;
}

// --------------------------------------------------------------- css guard
function cssRules(css){
  css=css.replace(/\/\*[\s\S]*?\*\//g,'');const rules=[],keyframes=[];let i=0;
  function block(start){let depth=0;for(let j=start;j<css.length;j++){if(css[j]==='{')depth++;else if(css[j]==='}'&&--depth===0)return j;}return css.length;}
  (function parse(from,to){i=from;while(i<to){const open=css.indexOf('{',i);if(open<0||open>=to)break;const head=css.slice(i,open).trim(),close=block(open);
    if(/^@keyframes/i.test(head))keyframes.push(head.replace(/^@keyframes\s+/i,'').trim());
    else if(/^@(media|supports|layer|container)/i.test(head)){parse(open+1,close);}
    else if(!head.startsWith('@'))rules.push({selector:head.replace(/\s+/g,' '),body:css.slice(open+1,close).replace(/\s+/g,' ').trim()});
    i=close+1;}})(0,css.length);
  return{rules,keyframes};
}
function cssGuard(cur,base){
  const problems=[],legacy=new Set();
  for(const {file,text} of base.css){for(const r of cssRules(text).rules)if(/qpx-/.test(r.selector+r.body))legacy.add(file+'|'+r.selector+'|'+r.body);}
  for(const {file,text} of cur.css){
    const {rules,keyframes}=cssRules(text);
    for(const k of keyframes)if(!k.startsWith('qpf-'))problems.push(file+': @keyframes '+k+' must use the qpf- prefix');
    for(const r of rules){
      for(const sel of r.selector.split(',').map(s=>s.trim())){
        const scope=sel.search(/\.qp-foundation-avatar\b|\[data-qp-foundation|\.qpf-/);if(scope<0)problems.push(file+': selector not scoped to foundation avatars (.qp-foundation-avatar, [data-qp-foundation] or a .qpf- class): '+sel);
        for(const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)){const name=m[1];if(name==='qp-foundation-avatar'||name.startsWith('qpf-'))continue;
          if(name.startsWith('qpx-')){if(scope<0||m.index<scope)problems.push(file+': qpx- class outside a foundation scope: '+sel);continue;}
          problems.push(file+': class .'+name+' must use the qpf- prefix: '+sel);}
      }
      for(const m of r.body.matchAll(/animation(?:-name)?\s*:\s*([^;!]+)/g))for(const name of m[1].split(',').map(s=>s.trim().split(/\s+/).find(t=>/^[a-z_-][\w-]*$/i.test(t)&&!/^(none|infinite|linear|ease(-in|-out|-in-out)?|alternate|reverse|forwards|backwards|both|running|paused|normal|step-start|step-end|initial|inherit|unset)$/i.test(t))).filter(Boolean))
        if(!name.startsWith('qpf-'))problems.push(file+': animation '+name+' must be a qpf- keyframe: '+r.selector);
      if(/qpx-/.test(r.selector+r.body)&&!legacy.has(file+'|'+r.selector+'|'+r.body))problems.push(file+': new or changed rule mentions qpx- (only the base\'s scoped legacy rules may): '+r.selector+' {'+r.body+'}');
    }
  }
  for(const {file,text} of cur.js)for(const m of text.matchAll(/@keyframes\s+([\w-]+)/g))if(!m[1].startsWith('qpf-'))problems.push(file+': @keyframes '+m[1]+' written by foundation JS must use the qpf- prefix');
  return problems;
}
async function foundationSources(tree){
  const files=(await listFiles(tree)).filter(f=>/^avatar-foundation[^/]*\.(css|js)$/.test(f));const css=[],js=[];
  for(const f of files){const text=(await tree.read(f)).toString('utf8');(f.endsWith('.css')?css:js).push({file:f,text});}return{css,js};
}

// ----------------------------------------------------------------- browser
async function openGame(browser,base,{reduced,report,requests}){
  const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference'});
  await H.isolate(context,report);
  // Deterministic Math.random (village tips, demo keys…) and a page clock that
  // starts at a fixed date and can be frozen (Playwright's page.clock lost its
  // paused time between contexts in this build, so the page gets its own):
  // performance.now(), Date and every rAF timestamp read the frozen time.
  await context.addInitScript(start=>{
    let s=0x2f6b1d3c;Math.random=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
    // Unfreezing continues from the frozen time (never backwards: loops integrate dt).
    const real=performance.now.bind(performance),RealDate=Date,raf=window.requestAnimationFrame.bind(window);let frozen=null,offset=0;const now=()=>frozen??real()+offset;
    performance.now=now;
    window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super(start+now());}static now(){return start+now();}};
    window.requestAnimationFrame=cb=>raf(t=>cb(frozen??t+offset));
    Object.defineProperty(window,'__qpFreeze',{value:t=>{if(t==null){if(frozen!=null)offset=frozen-real();frozen=null;}else frozen=t;}});
  },CLOCK);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  if(requests)page.on('request',r=>{const u=new URL(r.url());if(['http:','https:'].includes(u.protocol))requests.add((u.hostname==='127.0.0.1'?'':u.origin)+decodeURIComponent(u.pathname)+u.search);});
  await page.goto(new URL('index.html?demo=1&session=student-guard',base).href);
  // Ready (effects and pets too: the shop's worn list adds the angel thumb, with new
  // animations, when the effect art arrives), or an art error (a damaged atlas never becomes
  // ready): fail fast with the reason.
  await page.waitForFunction(()=>{const art=[window.QPAvatar,window.QPClothes,window.QPShoes,window.QPAvatarDirection,window.QPEffects,window.QPPets].map(m=>m?.atlas).filter(Boolean);if(art.some(a=>a.error||a.normalizationError))return true;return window.QPGame?.getMe()&&window.QPAvatar?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPShoes?.atlas.ready&&window.QPAvatarDirection?.atlas.ready&&window.QPAvatarDirection.atlas.backReady&&(!window.QPEffects||window.QPEffects.atlas.ready)&&(!window.QPPets||window.QPPets.atlas.ready);},null,{timeout:120000,polling:100});
  const artError=await page.evaluate(()=>[window.QPAvatar,window.QPClothes,window.QPShoes,window.QPAvatarDirection,window.QPEffects,window.QPPets].map(m=>m?.atlas).filter(Boolean).map(a=>a.error||a.normalizationError).filter(Boolean).join('; '));
  if(artError){await context.close();throw Error('avatar art failed to load: '+artError);}
  await page.evaluate(()=>document.fonts.ready);
  return{context,page};
}

// Strings of the old renderer (run in the page; returns {key: sha256}).
async function rendererStrings(page,hairs){
  return page.evaluate(async hairs=>{
    const G=QPGame,C=G.getCatalog(),A=window.QPAvatar,out={},norm=s=>s.replace(/qpdir-\d+/g,'qpdir-X').replace(/qpf-\d+/g,'qpf-X').replace(/(--[\w-]*phase)\s*:\s*-?[\d.e-]+m?s/g,'$1:N').replace(/animation-delay:\s*-?[\d.]+m?s/g,'animation-delay:N');
    const enc=new TextEncoder(),sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(norm(s))))].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);
    const put=async(key,s)=>{out[key]=typeof s==='string'?await sha(s):'type:'+typeof s;};
    const with_=(av,it)=>{const a={...av};if(it.cat==='outfit'){a.outfit=it.shape+':'+it.ci;Object.assign(a,C.OUTFIT_PARTS[it.shape][a.sex]);}else a[it.cat]=it.shape+':'+it.ci;return a;};
    for(const sex of ['m','f']){
      const base=G.avatarForSex(G.newAvatar(sex));await put('base/'+sex,A.render(base,120,2));
      // Every sold item once (worn on the starter avatar), and its shop thumb.
      for(const c of C.CATS)for(const it of C.publicItems(c.k,sex)){await put('item/'+sex+'/'+it.id,A.render(with_(base,it),120,2));await put('thumb/'+sex+'/'+it.id,A.thumb(it.cat,it.shape,it.ci,75,sex));}
      // Painted hair keys and old aliases × skins × lod × sizes.
      for(const h of [...hairs[sex],...hairs.aliases])for(const sk of [0,4])for(const lod of [2,3])for(const size of [46,120,280]){await put('hair/'+sex+'/'+h+'/sk'+sk+'/lod'+lod+'/'+size,A.render({...base,hair:h+':1',sk},size,lod));}
      // Profile and back heads of the direction rig.
      for(const h of [...hairs[sex],...hairs.aliases])for(const sk of [0,4]){const raw=new DOMParser().parseFromString(A.render({...base,hair:h+':1',sk,top:'',bottom:'',shoes:''},280,3),'image/svg+xml').documentElement;for(const view of ['profile','back'])await put('head/'+sex+'/'+h+'/sk'+sk+'/'+view,window.QPAvatarDirection.headMarkup(raw,view));}
    }
    // Legacy ids and raw saved avatars (ranking, fashion and quiz cards pass them un-normalised).
    const legacy=[{sex:'f',hair:'long:9',top:'dress:4'},{sex:'m',hair:'short:1',top:'shirt:10',bottom:'jeans:11',expression:'sparkle:0'},{sex:'f',hair:'twin:6',top:'hood:6',expression:'happy:0'},{sex:'m',hair:'buzz:3',top:'tee:1',bottom:'shorts:2'},{sex:'f',hair:'wave:4',top:'tee:7',bottom:'skirt:3',hat:'cap:1'},{sex:'m',hair:'mohawk:2',top:'hanbok:5',bottom:'track:9',outfit:'hanbok:5'},{sex:'f',top:'overall:5',bottom:'',outfit:'overall:5'}];
    for(const [i,raw] of legacy.entries()){const av=Object.assign(G.newAvatar(raw.sex),raw);await put('legacy/'+i+'/render',A.render(av,120,2));await put('legacy/'+i+'/avatarSVG',window.avatarSVG(av,120,2));await put('legacy/'+i+'/avatarSVG-40',window.avatarSVG(av,40,1));}
    // Demo bots (demo.js) and the demo student.
    const bots=[{sex:'f',hair:'long:9',top:'dress:4',expression:'bright:0'},{sex:'m',hair:'short:1',top:'shirt:10',bottom:'jeans:11',expression:'sparkle:0'},{sex:'f',hair:'twin:6',top:'hood:6',expression:'happy:0'}];
    for(const [i,b] of bots.entries()){const av=Object.assign(G.newAvatar(b.sex),b,{sk:0,bottom:b.bottom||'skirt:7',shoes:'sneaker:8',pet:'',bg:'',frame:''});await put('bot/'+i,window.avatarSVG(av,120,3));}
    await put('me/'+G.getMe().k,window.avatarSVG(G.getMe().av,280,3));
    return out;
  },hairs);
}

// Screens at a fixed time: settle, freeze the page clock, pause every animation, shoot.
// World-life ambient art (lamp flicker, swaying flower/grass/water canvases, embers, moles)
// integrates its own elapsed time frame by frame, so its picture depends on how many frames
// ran: hidden in the motion set (in the reduced set it is static and stays in the picture).
const AMBIENT_HIDE='[data-life],.wl-patch,.wl-lamplight,.wl-window-light,.wl-embers,.wl-mole{visibility:hidden!important}';
// The demo toolbar exists only on ?demo=1 (never on the students' site); its soft shadow over
// the shop panel was the other raster-noise spot.
const DEMO_HIDE='.qp-demo-toolbar{display:none!important}';
async function shootScreens(page,screens,dir,tag,{hideAmbient}={}){
  const out={};await page.addStyleTag({content:DEMO_HIDE+(hideAmbient?AMBIENT_HIDE:'')});
  for(const [index,screen] of screens.entries()){
    await page.evaluate(()=>{window.closeModal?.();});
    // Ranking is a modal over the village (already shot on its own). The live map under the
    // translucent overlay rasterised the avatar one or two levels differently between runs,
    // so the map is hidden behind the ranking list.
    if(screen==='ranking'){await page.evaluate(()=>QPGame.go('village'));await page.waitForTimeout(800);await page.evaluate(()=>{window.showRank();const s=document.createElement('style');s.id='qp-guard-ranking';s.textContent='.school-room-host{visibility:hidden!important}';document.head.append(s);});}
    else await page.evaluate(s=>QPGame.go(s),screen);
    await page.waitForTimeout(1500);await page.waitForLoadState('networkidle').catch(()=>{});
    // decode() of a lazy image that never loads would wait forever: loaded images only, bounded.
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.race([Promise.all([...document.images].filter(i=>i.complete&&i.naturalWidth).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,3000))]);});
    // Freeze page time (beyond any real time, so the next frame steps forward once and
    // later frames do not move), let the loops draw at that time, then pause every CSS/Web
    // animation at the same active time (a phase-shifted animation-delay is undone).
    await page.evaluate(t=>window.__qpFreeze(t),FROZEN_MS+index*100000);await page.waitForTimeout(400);
    // A looping animation's delay is a phase offset, often from the clock at render time
    // (--qp-effect-phase): it is set to 0 so every loop shows its keyframes at exactly
    // ANIMATION_MS (offsetting by a fractional delay left float residue in the progress and
    // moved a few pixels by one level). A finite animation keeps its delay, in whole ms.
    // The frame is then committed as inline style and the animation cancelled: a paused
    // animated layer kept whatever raster scale it last had, and a 40 px list avatar differed
    // by up to 2 levels between runs; committed static styles rasterise at their own scale.
    // Repeated until no animation is left: a list re-rendered after the first pass (the shop's
    // worn-item thumbs) starts new ones.
    for(let pass=0;pass<6;pass++){
      const left=await page.evaluate(ms=>{const all=document.getAnimations();for(const a of all){a.pause();if(!a.effect)continue;const loop=a.effect.getComputedTiming().iterations===Infinity,delay=loop?0:Math.round(Number(a.effect.getTiming().delay)||0);a.effect.updateTiming({delay});a.currentTime=Math.max(0,ms+delay);try{a.commitStyles();a.cancel();}catch{}}return all.length;},ANIMATION_MS);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.waitForTimeout(150);
      if(!left||!(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)))break;
    }
    const buf=await page.screenshot({animations:'allow',caret:'hide'}),foundation=await page.evaluate(()=>document.querySelectorAll('[data-qp-foundation]').length);
    const file=path.join(dir,tag+'-'+screen+'.png');fs.writeFileSync(file,buf);process.stderr.write('  '+tag+' '+screen+'\n');
    const img=H.png.decode(buf);out[screen]={sha:H.png.hashRect(img,0,0,img.width,img.height),file,foundationNodes:foundation};
    await page.evaluate(()=>{window.__qpFreeze(null);for(const a of document.getAnimations())a.play();document.getElementById('qp-guard-ranking')?.remove();});
  }
  return out;
}
function screenDiff(a,b,file){
  const A=H.png.decode(fs.readFileSync(a)),B=H.png.decode(fs.readFileSync(b));if(A.width!==B.width||A.height!==B.height)return{pixels:-1,maxDelta:255};
  let n=0,max=0;const out={width:A.width,height:A.height,data:Buffer.from(A.data)};
  for(let i=0;i<A.data.length;i+=4){const d=Math.max(Math.abs(A.data[i]-B.data[i]),Math.abs(A.data[i+1]-B.data[i+1]),Math.abs(A.data[i+2]-B.data[i+2]));if(d){n++;max=Math.max(max,d);out.data[i]=255;out.data[i+1]=0;out.data[i+2]=255;}else{out.data[i]=out.data[i]*.35+165;out.data[i+1]=out.data[i+1]*.35+165;out.data[i+2]=out.data[i+2]*.35+165;}}
  if(n)fs.writeFileSync(file,H.png.encode(out));return{pixels:n,maxDelta:max,diff:n?file:null};
}
// Screens must be pixel-identical. --pixel-noise allows raster noise for another machine or
// browser build: every differing pixel within 3 levels and at most 1500 pixels (0.14 % of the
// screen). (Before the ranking map was hidden, the same tree shot twice differed by 1–3 levels
// in 23–415 avatar pixels under the translucent overlay; with it hidden, strict runs agree.)
// The old-renderer strings and protected hashes are exact either way.
const NOISE={levels:3,pixels:1500};

// One side (base or current): strings, screens, network.
async function side(browser,tree,label,opts){
  const server=await H.serve(tree),report={errors:[],blocked:[]},result={label:tree.label};
  try{try{
    if(opts.only.has('strings')){const {context,page}=await openGame(browser,server.base,{reduced:true,report});result.strings=await rendererStrings(page,{m:M.HAIRSTYLES.m,f:M.HAIRSTYLES.f,aliases:M.HAIR_ALIASES});await context.close();}
    if(opts.only.has('screens')){
      result.screens={};const requests=new Set();
      // One fresh page per screen: the image decode cache then starts empty for every shot
      // (a 40 px list avatar drawn after three map screens differed by 1–2 levels in 15 px).
      for(const set of ['reduced','paused']){result.screens[set]={};for(const screen of opts.screens){const {context,page}=await openGame(browser,server.base,{reduced:set==='reduced',report,requests});Object.assign(result.screens[set],await shootScreens(page,[screen],opts.shots,label+'-'+set,{hideAmbient:set==='paused'}));await context.close();}}
      result.network=[...requests].sort();
    }
  }catch(e){result.fatal=label+' page: '+String(e.message||e).split('\n')[0];}}finally{await server.close();}
  result.errors=[...new Set(report.errors)];result.blocked=[...new Set(report.blocked)];return result;
}

async function guard(opts){
  const t0=Date.now(),res={tool:'verify-student-avatar-unchanged',created:new Date().toISOString(),checks:{},failures:[]};
  const cur=H.fsTree(opts.root,opts.overlay),base=opts.baseTree;res.current=cur.label;res.base=base.label;
  if(opts.only.has('files')){const a=await protectedHashes(base),b=await protectedHashes(cur),diff=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(f=>a[f]!==b[f]);
    res.checks.files={count:Object.keys(b).length,hashes:b,changed:diff};if(diff.length)res.failures.push('protected student files changed: '+diff.join(', '));if(Object.keys(b).length<14)res.failures.push('protected file list too short ('+Object.keys(b).length+')');}
  if(opts.only.has('css')){const problems=cssGuard(await foundationSources(cur),await foundationSources(base));res.checks.css={problems};if(problems.length)res.failures.push(...problems.map(p=>'css: '+p));}
  if(opts.only.has('strings')||opts.only.has('screens')){
    const browser=await H.launch();
    try{
      const b=await side(browser,base,'base',opts),c=await side(browser,cur,'current',opts);
      for(const [name,s] of [['base',b],['current',c]])if(s.errors.length)res.failures.push(name+' page errors: '+s.errors.slice(0,5).join(' | '));
      for(const s of [b,c])if(s.fatal)res.failures.push('page did not load: '+s.fatal);
      if(b.fatal||c.fatal){res.seconds=Math.round((Date.now()-t0)/1000);res.success=false;return res;}
      if(c.strings){const keys=[...new Set([...Object.keys(b.strings),...Object.keys(c.strings)])].sort(),diff=keys.filter(k=>b.strings[k]!==c.strings[k]);
        res.checks.strings={count:Object.keys(c.strings).length,digest:H.sha256(JSON.stringify(c.strings)),changed:diff.slice(0,40),changedCount:diff.length};
        if(diff.length)res.failures.push(diff.length+' old-renderer strings differ from the base (first: '+diff.slice(0,5).join(', ')+')');}
      if(c.screens){res.checks.screens={};
        for(const set of Object.keys(c.screens))for(const screen of Object.keys(c.screens[set])){const x=b.screens[set][screen],y=c.screens[set][screen],d=x.sha===y.sha?{pixels:0}:screenDiff(x.file,y.file,y.file.replace(/\.png$/,'-diff.png'));
          const noise=x.sha!==y.sha&&opts.pixelNoise&&d.pixels>0&&d.pixels<=NOISE.pixels&&d.maxDelta<=NOISE.levels;
          res.checks.screens[set+'/'+screen]={sha:y.sha,base:x.sha,identical:x.sha===y.sha,noise,differentPixels:d.pixels,maxDelta:d.maxDelta??0,diff:d.diff||null,foundationNodes:y.foundationNodes};
          if(x.sha!==y.sha&&!noise)res.failures.push('screen '+set+'/'+screen+' differs from the base ('+d.pixels+' px, up to '+d.maxDelta+' levels, '+d.diff+')');
          if(y.foundationNodes)res.failures.push('screen '+set+'/'+screen+' shows '+y.foundationNodes+' [data-qp-foundation] nodes');}
        // A request for a file the base tree does not have is new (a failure unless allow-listed).
        // A request for an existing file that only one side made is timing (a stylesheet's
        // overridden body background, /assets/candy-sky.svg, is fetched only when that sheet
        // applies before the next one loads): recorded, not failed. Forbidden URLs always fail.
        const added=c.network.filter(u=>!b.network.includes(u)),removed=b.network.filter(u=>!c.network.includes(u)),forbidden=c.network.filter(u=>FORBIDDEN.some(r=>r.test(u))),newFiles=[],timing=[];
        for(const u of added){const local=u.startsWith('/')?u.split('?')[0]:null;if(ALLOW_NEW.includes(local))continue;(local&&await opts.baseTree.read(local)?timing:newFiles).push(u);}
        // The digest covers code requests (scripts, stylesheets, pages), which do not depend on timing.
        res.checks.network={requests:c.network.length,digest:H.sha256(JSON.stringify(c.network.filter(u=>/\.(js|css|html)(\?|$)/.test(u)))),added,removed,timingOnly:[...timing,...removed],allowNew:ALLOW_NEW,forbidden,log:c.network};
        if(newFiles.length)res.failures.push('new student requests: '+newFiles.join(', '));if(forbidden.length)res.failures.push('forbidden requests on the normal URL: '+forbidden.join(', '));
        res.checks.blocked={base:b.blocked,current:c.blocked};}
    }finally{await browser.close();}
  }
  res.seconds=Math.round((Date.now()-t0)/1000);res.success=!res.failures.length;
  // Digest of everything measured on the current tree (two runs must agree).
  res.digest=H.sha256(JSON.stringify({files:res.checks.files?.hashes,strings:res.checks.strings?.digest,screens:res.checks.screens&&Object.fromEntries(Object.entries(res.checks.screens).map(([k,v])=>[k,v.sha])),network:res.checks.network?.digest}));
  return res;
}

// --------------------------------------------------------------- self-test
// Scratch copies only, served through the overlay; the tree is never edited.
async function selfTest(opts){
  // Scratch copies and screenshots stay in self-test/ (the guard's own screens are untouched).
  const dir=path.join(opts.out,'self-test'),shots=path.join(dir,'screens');fs.mkdirSync(shots,{recursive:true});const runs=[];
  const pixel=fs.readFileSync(path.join(opts.root,'avatar-pixel.js'),'utf8'),from="const INK='#493638'";if(pixel.split(from).length!==2)throw Error('avatar-pixel.js anchor not found once');
  fs.writeFileSync(path.join(dir,'avatar-pixel.js'),pixel.replace(from,"const INK='#6a3638'"));
  const heads=fs.readFileSync(path.join(opts.root,'assets/sd-heads-female.png')),at=Math.floor(heads.length/2);heads[at]^=0x01;fs.writeFileSync(path.join(dir,'sd-heads-female.png'),heads);
  const css=fs.readFileSync(path.join(opts.root,'avatar-foundation.css'),'utf8');fs.writeFileSync(path.join(dir,'avatar-foundation.css'),css+'\n@keyframes qpx-blink-half{0%,100%{opacity:1}}\n.qpx-blink-half{opacity:1!important}\n');
  // Each case runs the static checks and the strings; the CSS case also shoots the village
  // (both motion sets) to show the screens catch it. (The INK colour is in 888 of the 1185
  // strings but in no village pixel: pet eyes and expression strokes under the painted head.)
  // --full: every check and screen for every case.
  const statics=['files','css','strings'],cases=[
    {name:'one colour in avatar-pixel.js (INK outline #493638 → #6a3638)',overlay:{'avatar-pixel.js':path.join(dir,'avatar-pixel.js')},only:statics,expect:['protected student files changed','old-renderer strings differ']},
    {name:'one byte of assets/sd-heads-female.png (byte '+at+' xor 1)',overlay:{'assets/sd-heads-female.png':path.join(dir,'sd-heads-female.png')},only:statics,expect:['protected student files changed']},
    {name:'foundation CSS defining qpx-blink-half keyframes and an unscoped .qpx-blink-half rule (students\' eyelids)',overlay:{'avatar-foundation.css':path.join(dir,'avatar-foundation.css')},only:[...statics,'screens'],screens:['village'],expect:['css:','screen reduced/village','screen paused/village']}
  ];
  for(const c of cases){const only=new Set(opts.full?[...statics,'screens']:c.only),screens=opts.full?opts.screens:c.screens||[];
    const r=await guard({...opts,only,screens,overlay:c.overlay,shots}),caught=c.expect.filter(e=>r.failures.some(f=>f.includes(e)));
    runs.push({name:c.name,checks:[...only],screens,flagged:!r.success,expected:c.expect,caught,failures:r.failures.map(f=>f.slice(0,300)),seconds:r.seconds});}
  return{success:runs.every(r=>r.flagged&&r.caught.length===r.expected.length),runs};
}

(async()=>{
  const a=H.args(),root=a.root?path.resolve(a.root):ROOT,out=a.out&&a.out!==true?path.resolve(a.out):path.join(root,'검증/기준선/student');
  const overlay={};for(const o of H.list(a.overlay,[])){const [rel,file]=o.split('=');overlay[rel]=path.resolve(file);}
  const shots=path.join(out,'screens');fs.mkdirSync(shots,{recursive:true});
  const opts={root,out,overlay,shots,baseTree:baseTree(a,root),only:new Set(H.list(a.only,['files','css','strings','screens'])),screens:H.list(a.screens,SCREENS),full:Boolean(a.full),pixelNoise:Boolean(a['pixel-noise'])};
  try{
    const res=a['self-test']?await selfTest(opts):await guard(opts);
    const file=path.join(out,a['self-test']?'self-test.json':'report.json');fs.writeFileSync(file,JSON.stringify(res,null,1)+'\n');
    const brief=a['self-test']?res:{success:res.success,failures:res.failures,base:res.base,current:res.current,seconds:res.seconds,digest:res.digest,
      files:res.checks.files&&{count:res.checks.files.count,changed:res.checks.files.changed},css:res.checks.css,strings:res.checks.strings&&{count:res.checks.strings.count,changedCount:res.checks.strings.changedCount,digest:res.checks.strings.digest},
      screens:res.checks.screens&&Object.fromEntries(Object.entries(res.checks.screens).map(([k,v])=>[k,v.identical?'identical':(v.noise?'raster noise: ':'')+v.differentPixels+' px, up to '+v.maxDelta+' levels'])),network:res.checks.network&&{requests:res.checks.network.requests,added:res.checks.network.added,removed:res.checks.network.removed,timingOnly:res.checks.network.timingOnly,forbidden:res.checks.network.forbidden},report:file};
    console.log(JSON.stringify(brief,null,1));if(!res.success)process.exitCode=1;
  }finally{opts.baseTree.close?.();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
