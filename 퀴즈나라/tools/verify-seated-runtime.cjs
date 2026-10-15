'use strict';
// The drawn floor sit stays on screen while the avatar keeps moving:
//   node tools/verify-seated-runtime.cjs
// For the basic outfit and every item of assets/seated/items.json, each sex's
// front/right/left/back and skin tones 0 and 4, it mounts a foundation
// avatar, applies the floor sit, waits for the composed picture, applies
// three more breathing frames (reducedMotion off, as in the game) and checks
// that the near leg's painting still shows the composed picture (a data URL
// at the record's frame) and that the body stays hidden. Introduced
// 2026-10-15: the skin painter repainted the leg every frame, so the seated
// picture showed only until the next frame (the single-frame renders of
// tools/seated-render.cjs never saw it).
const Q=require('node:path').resolve(__dirname,'..'),H=require('./verify-harness.cjs'),M=require('./foundation-matrix.cjs'),fs=require('node:fs');
const items=JSON.parse(fs.readFileSync(Q+'/assets/seated/items.json','utf8'));
const cases=[];for(const sex of ['m','f'])for(const look of [null,...items.filter(i=>i.sex===sex)])for(const dir of ['front','right','left','back'])for(const tone of [0,4])
  cases.push({sex,dir,tone,name:look?look.item:'basic',items:look?{[look.slot]:look.item.split(':')[1]+':0'}:{}});
(async()=>{const browser=await H.launch({args:H.RASTER_ARGS});const server=await H.serve(H.fsTree(Q));const ctx=await browser.newContext();await H.isolate(ctx,{});const page=await ctx.newPage();let failed=0;
try{
 await page.goto(server.base+'index.html?demo=1&session=foundation-studio');await page.waitForFunction(()=>window.QPGame&&window.QPAvatarFoundation,null,{timeout:90000});
 await page.evaluate(()=>{QPGame.go('login');QPFoundationSkin.load();QPFoundationOutfit.load();});
 await page.waitForFunction(()=>QPFoundationSkin.atlas.ready&&QPFoundationOutfit.atlas.ready&&QPAvatar?.atlas.ready&&QPAvatarDirection?.atlas.ready&&QPAvatarDirection.atlas.backReady,null,{timeout:120000});
 for(const c of cases){
  const r=await page.evaluate(async({av,dir})=>{const api=QPAvatarFoundation,d=document.createElement('div');document.body.append(d);d.innerHTML=api.render(av,280);const svg=d.firstElementChild;
   const state=t=>({action:'floor-sit',seatMode:'floor',direction:dir,time:t,reducedMotion:false});api.apply(svg,state(0));
   const pic=()=>[...svg.querySelectorAll('[data-foundation-skin-paint="leg"]')].find(e=>e.style.visibility==='visible');
   for(let i=0;i<60&&!(pic()&&String(pic().getAttribute('href')).startsWith('data:'));i++)await new Promise(ok=>setTimeout(ok,50));
   const first=pic(),x0=first?.getAttribute('x');
   for(const t of [.4,.9,1.7]){api.apply(svg,state(t));await new Promise(ok=>requestAnimationFrame(()=>ok()));}
   await new Promise(ok=>setTimeout(ok,300));const e=pic(),body=svg.querySelector('[data-foundation-part="torso"]');
   const out={shown:Boolean(e),same:e===first&&e?.getAttribute('x')===x0,data:String(e?.getAttribute('href')).startsWith('data:'),bodyHidden:getComputedStyle(body).visibility==='hidden',x:e?.getAttribute('x'),x0};d.remove();return out;},{av:{...M.referenceAvatar(c.sex,c.tone),...c.items},dir:c.dir});
  const ok=r.shown&&r.same&&r.data&&r.bodyHidden;if(!ok){failed++;console.log('FAIL',c.sex,c.name,c.dir,'tone',c.tone,JSON.stringify(r));}
 }
 console.log(`${cases.length-failed}/${cases.length} seated views keep the drawn picture over later frames`);
}finally{await browser.close();await server.close();}process.exit(failed?1:0);})();
