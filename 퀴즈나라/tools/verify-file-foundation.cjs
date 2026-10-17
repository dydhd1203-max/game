'use strict';
// file:// check of the reference body (stage 3, verification G): the demo
// opened straight from disk, no server, no network.
//
//   node tools/verify-file-foundation.cjs [--out 검증/옷파일]
//   (tools/verify-foundation-garments.cjs --only file runs the same checks)
//
//   index.html?demo=1&avatar=foundation from disk:
//   - every garment record of the index renders for each of its sexes
//     (its id on the outfit nodes, no fallback), the basic outfit with the
//     node table's counts (tools/foundation-matrix.cjs);
//   - wave (the legacy path reads the shirt's pixels: shirtSide) and the
//     side floor-sit (the lap shoe is painted into the shorts) draw without a
//     SecurityError;
//   - every garment picture href is a data URL (bundle bytes, not files);
//   - every head and hair picture href is local: a data URL or a file next to index.html, never
//     http(s) (plan G 'hair hrefs are local files'; today's heads are the stage-2 paintings, H3
//     brings the converted hair layers through the same check);
//   - the starter set's three garment bundles are requested together and
//     load concurrently into one registry (QPAvatarGarmentFileData);
//   - no http(s) request at all (the Firebase SDK tags are stubbed);
//   - the students' page from disk (normal URL) still uses the original
//     bundles and loads nothing of the reference body or its garments.
//   avatar-standard.html from disk: the studio is HOSTED ONLY (Chrome gives
//   every file:// document an opaque origin, so the page cannot reach its
//   runtime frame; REDTEAM): it shows its Korean note and loads no runtime.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const H=require('./verify-harness.cjs'),M=require('./foundation-matrix.cjs');
const ROOT=path.resolve(__dirname,'..');

// Records every bundle script the page appends (start, load) before any page script runs.
const BUNDLE_LOG=`(()=>{window.__bundleLog=[];const add=Node.prototype.appendChild;Node.prototype.appendChild=function(n){if(n&&n.tagName==='SCRIPT'&&/avatar-file-data-garment-/.test(n.src||'')){const row={src:n.src.split('/').pop(),start:performance.now(),end:null,ok:null};window.__bundleLog.push(row);n.addEventListener('load',()=>{row.end=performance.now();row.ok=true;});n.addEventListener('error',()=>{row.end=performance.now();row.ok=false;});}return add.call(this,n);};})();`;
function fileRoute(context,seen,report){
  return context.route('**/*',r=>{const u=new URL(r.request().url());seen.push(u.protocol+'//'+u.host+u.pathname);
    if(u.protocol==='file:'||u.protocol==='data:'||u.protocol==='blob:')return r.continue();
    if(u.hostname==='www.gstatic.com'&&u.pathname.includes('/firebasejs/'))return r.fulfill({contentType:'text/javascript',body:'/* isolated demo */'});
    if(/firebase/.test(u.hostname))report.errors.push('file: Firebase request '+u.href);return r.fulfill({status:200,body:''});});
}
async function run(browser,{report,check,out}){
  // ---------------------------------------------------------------- the demo from disk
  const context=await browser.newContext({viewport:{width:1280,height:800}}),seen=[];await fileRoute(context,seen,report);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push('file: '+e.message));await page.addInitScript(BUNDLE_LOG);
  await page.goto(pathToFileURL(path.join(ROOT,'index.html')).href+'?demo=1&avatar=foundation&session=wp7-file');
  await page.waitForFunction(()=>window.QPGame?.getMe()&&window.QPFoundationGarments?.ready('starter')&&window.QPFoundationSkin?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady&&window.QPFoundationHead?.atlas.ready,null,{timeout:120000});
  const r=await page.evaluate(async()=>{const host=document.createElement('div');host.style.cssText='position:absolute;left:0;top:0;z-index:2147483647;background:#eef1f5;display:flex;flex-wrap:wrap;gap:8px;padding:8px;width:1260px';document.body.append(host);const res={},api=QPAvatarFoundation,G=QPFoundationGarments;
    const add=html=>{const d=document.createElement('div');d.innerHTML=html;host.append(d);return d.firstElementChild;};
    const frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
    for(const sex of ['m','f']){const svg=add(avatarSVG(QPGame.newAvatar(sex),280,3));
      res[sex]={foundation:svg.dataset.qpFoundation==='1',static:svg.dataset.foundationStatic,garments:svg.dataset.foundationGarments,fallback:svg.dataset.foundationFallback,cls:svg.dataset.foundationClass,nodes:svg.querySelectorAll('*').length,hrefs:[...svg.querySelectorAll('image[data-outfit-part]')].map(e=>(e.getAttribute('href')||'').slice(0,22))};
      // Head and hair pictures (the head group and the back hair layer), with their href kinds.
      res[sex].heads=[...svg.querySelectorAll('[data-foundation-head] image,[data-foundation-back-hair] image')].map(e=>e.getAttribute('href')||e.getAttribute('xlink:href')||'').map(h=>h.startsWith('data:')?'data':/^https?:/i.test(h)?'http '+h:new URL(h,location.href).protocol==='file:'?'file':'other '+h);
      const live=add(avatarSVG(QPGame.newAvatar(sex),280,3));api.apply(live,{action:'idle',direction:'front',gesture:'wave',gestureProgress:.5,time:0,reducedMotion:true});res[sex].wave=live.querySelector('[data-outfit-part="underarm-line-1"]')?.getAttribute('d')?.length||0;
      const seat=add(avatarSVG(QPGame.newAvatar(sex),280,3));api.apply(seat,{action:'sit',seatMode:'floor',direction:'right',time:0,reducedMotion:true});res[sex].floor=(seat.querySelector('[data-outfit-part="shorts-hip"]')?.getAttribute('href')||'').slice(0,22);res[sex].floorNodes=seat.querySelectorAll('*').length;res[sex].lap=Boolean(api.inspect(seat)?.legs.some(l=>l.seatShoe?.lap));}
    // Every record of the index, per sex it has, in its slot of the starter set.
    const records=[];for(const [id,e] of Object.entries(QPFoundationGarmentIndex.records))for(const sex of e.sexes){const svg=add(QPAvatarFoundation.render({sex,sk:2,hair:sex==='m'?'short:1':'bob:1',expression:'bright:0',foundationGarments:{[e.slot]:id}},120));
      for(let i=0;i<40&&svg.dataset.foundationStatic==='pending';i++)await frame();api.apply(svg,{action:'walk',direction:'left',phase:.3,time:0,reducedMotion:true});
      const parts=[...svg.querySelectorAll('[data-outfit-part]')],own=parts.filter(p=>/^(shirt|underarm|sleeve)/.test(p.dataset.outfitPart)?e.slot==='top':p.dataset.outfitPart==='shorts-hip'?e.slot==='bottom':/^shoe/.test(p.dataset.outfitPart)?e.slot==='shoes':false);
      records.push({id,sex,slot:e.slot,static:svg.dataset.foundationStatic||'',fallback:svg.dataset.foundationFallback,own:own.length,ownIds:[...new Set(own.map(p=>p.dataset.outfitGarment))],dataHrefs:[...svg.querySelectorAll('image[data-outfit-part]')].every(im=>!im.getAttribute('href')||im.getAttribute('href').startsWith('data:image/'))});}
    return{res,records,registry:Object.keys(window.QPAvatarGarmentFileData||{}).sort(),bundles:window.__bundleLog,index:Object.values(QPFoundationGarmentIndex.records).map(e=>e.files.bundle.split('/').pop()),starter:[...new Set(Object.values(QPFoundationGarmentIndex.starter).flatMap(s=>Object.values(s)))].map(id=>QPFoundationGarmentIndex.records[id].files.bundle.split('/').pop())};});
  await page.waitForTimeout(300);fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'file-play.png'),clip:{x:0,y:0,width:1280,height:780}});(report.images||=[]).push(path.join(out,'file-play.png'));
  const http=seen.filter(s=>/^https?:/.test(s)&&!s.startsWith('https://www.gstatic.com/firebasejs/'));
  for(const sex of ['m','f']){const x=r.res[sex],want=M.expectedNodes(x.cls,sex);
    check(x.foundation&&x.static==='idle-front'&&x.nodes===want&&x.hrefs.length>0&&x.hrefs.every(h=>h.startsWith('data:image/png')),'file:// '+sex+': the reference body dressed ('+x.nodes+' nodes = node table '+want+', data-URL garment pictures)',JSON.stringify({garments:x.garments,fallback:x.fallback,cls:x.cls}));
    const kinds=x.heads.reduce((o,k)=>{const t=k.split(' ')[0];o[t]=(o[t]||0)+1;return o;},{});
    check(x.heads.length>0&&x.heads.every(k=>k==='data'||k==='file'),'file:// '+sex+': head and hair pictures are local ('+JSON.stringify(kinds)+'; no http)',JSON.stringify(x.heads.filter(k=>k!=='data'&&k!=='file').slice(0,4)));
    check(x.wave>0&&x.floor.startsWith('data:image/png')&&x.floorNodes===want&&x.lap,'file:// '+sex+': wave (legacy shirtSide pixel reads) and side floor-sit with the lap shoe draw without a SecurityError');}
  check(r.res.m.fallback==='bottom:todo'&&r.res.f.fallback==='','file:// new accounts: the boy\'s jeans:5 falls back to the basic shorts (todo), the girl wears her starter records',r.res.m.fallback+' / '+r.res.f.fallback);
  const badRecords=r.records.filter(x=>x.static||x.fallback||!x.own||x.ownIds.join()!==x.id||!x.dataHrefs);
  check(r.records.length>=6&&!badRecords.length,'file:// every index record renders for each of its sexes ('+r.records.length+' record×sex, own parts carry the id, data-URL hrefs)',JSON.stringify(badRecords.slice(0,4)));
  // The starter set's bundles load together; another record's bundle loads
  // on demand when an avatar wears it (the shop pilot top:shirt).
  const all=r.bundles||[],b=all.filter(x=>r.starter.some(s=>String(x.src).endsWith(s))),ends=b.map(x=>x.end).filter(v=>v!=null),concurrent=b.length>=3&&all.every(x=>x.ok)&&Math.max(...b.map(x=>x.start))<Math.min(...ends);
  check(concurrent,'file:// '+b.length+' starter garment bundles requested together and loading concurrently (every start before the first load); '+(all.length-b.length)+' more on demand',JSON.stringify(b.map(x=>[x.src,+x.start.toFixed(1),x.end&&+x.end.toFixed(1)])));
  check(r.registry.length===r.index.length*2&&r.index.every(s=>seen.some(p=>p.endsWith('/assets/'+s))),'file:// the garment bundles fill one registry ('+r.registry.length+' atlas keys)',r.registry.join(', '));
  check(http.length===0,'file:// no http request',http.join(', '));
  await context.close();
  // ------------------------------------------------- the students' page from disk
  {const ctx=await browser.newContext({viewport:{width:1280,height:800}}),files=[];
   await ctx.route('**/*',q=>{const u=new URL(q.request().url());if(u.protocol==='file:'){files.push(u.pathname.split('/').pop());return q.continue();}if(u.protocol==='data:'||u.protocol==='blob:')return q.continue();return q.fulfill(u.hostname==='www.gstatic.com'?{contentType:'text/javascript',body:'/* isolated demo */'}:{status:200,body:''});});
   const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push('file student: '+e.message));
   await p.goto(pathToFileURL(path.join(ROOT,'index.html')).href+'?demo=1&session=wp7-file-student');
   await p.waitForFunction(()=>window.QPGame?.getMe()&&window.QPAvatar?.atlas.ready&&window.QPClothes?.atlas.ready&&window.QPShoes?.atlas.ready&&window.QPAvatarDirection?.atlas.backReady,null,{timeout:120000});
   await p.evaluate(()=>QPGame.go('home'));await p.waitForSelector('#meStage .qp-pixel-avatar');await p.waitForTimeout(500);
   const st=await p.evaluate(()=>({visible:getComputedStyle(document.querySelector('#meStage .qp-pixel-avatar')).visibility,foundation:document.querySelectorAll('[data-qp-foundation]').length,bundle:Boolean(window.QPAvatarFileData)}));
   const bad=files.filter(f=>/sd-garment|avatar-file-data-garment|avatar-file-data-foundation|sd-foundation-ref-[a-z-]+\.png/.test(f));
   check(st.visible==='visible'&&st.bundle&&st.foundation===0&&bad.length===0,'file:// students\' page: their avatar from the original bundle, no reference-body or garment file',JSON.stringify({...st,bad}));
   await ctx.close();}
  // ------------------------------------------------------ the studio from disk
  {const ctx=await browser.newContext({viewport:{width:1100,height:900}}),seenS=[];await fileRoute(ctx,seenS,report);
   const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
   await p.goto(pathToFileURL(path.join(ROOT,'avatar-standard.html')).href);await p.waitForSelector('#file-note',{state:'visible',timeout:15000}).catch(()=>{});await p.waitForTimeout(600);
   const st=await p.evaluate(()=>({note:!document.getElementById('file-note').hidden,text:document.getElementById('file-note').textContent,frame:document.getElementById('runtime').getAttribute('src'),studio:Boolean(window.QPFoundationStudio),error:document.getElementById('error').hidden?'':document.getElementById('error').textContent,status:document.getElementById('status').textContent}));
   await p.screenshot({path:path.join(out,'studio-file-note.png')});report.images.push(path.join(out,'studio-file-note.png'));
   check(st.note&&/미리보기 서버/.test(st.text)&&!st.frame&&!st.studio&&!st.error&&errs.length===0&&!seenS.some(s=>/\/index\.html$/.test(s)),'studio from file:// is hosted-only: it shows the Korean note and loads no runtime frame (Chrome opaque file:// origins)',JSON.stringify({...st,text:st.text.slice(0,40),errs}));
   await ctx.close();}
}
module.exports={run};

if(require.main===module)(async()=>{
  const a=H.args(),out=path.resolve(ROOT,a.out&&a.out!==true?a.out:'검증/옷파일');fs.mkdirSync(out,{recursive:true});
  const report={checks:[],errors:[],failures:[],images:[]};
  const check=(cond,name,detail)=>{(cond?report.checks:report.failures).push({name,detail});console.log((cond?'ok   ':'FAIL ')+name+(detail&&!cond?' — '+detail:''));};
  const browser=await H.launch({args:H.RASTER_ARGS});
  try{await run(browser,{report,check,out});}catch(e){check(false,'crash',e.stack||String(e));}finally{await browser.close();}
  report.errors=[...new Set(report.errors)];if(report.errors.length)check(false,'page errors',report.errors.join(' | '));
  report.success=report.failures.length===0;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));
  console.log((report.success?'PASS':'FAIL')+': '+report.checks.length+' checks passed, '+report.failures.length+' failed; '+path.join(out,'report.json'));
  if(!report.success)process.exitCode=1;
})();
