'use strict';
// Renders one cross-legged (floor-sit) foundation avatar at 640 px on white
// for tools/verify-seated-art.py: node tools/seated-render.cjs <sex> <direction> <out.png> ['{"top":"hood:5"}']
// Prints the leg group's screen matrix (body units -> png pixels).
const Q=require('node:path').resolve(__dirname,'..'),H=require('./verify-harness.cjs'),M=require('./foundation-matrix.cjs');
(async()=>{const [sex,dir,out,items]=process.argv.slice(2);const browser=await H.launch({args:H.RASTER_ARGS});const server=await H.serve(H.fsTree(Q));const ctx=await browser.newContext();await H.isolate(ctx,{});const page=await ctx.newPage();
try{
 await page.goto(server.base+'index.html?demo=1&session=foundation-studio');await page.waitForFunction(()=>window.QPGame&&window.QPAvatarFoundation,null,{timeout:90000});
 await page.evaluate(()=>{QPGame.go('login');QPFoundationSkin.load();QPFoundationOutfit.load();});
 await page.waitForFunction(()=>QPFoundationSkin.atlas.ready&&QPFoundationOutfit.atlas.ready&&QPAvatar?.atlas.ready&&QPAvatarDirection?.atlas.ready&&QPAvatarDirection.atlas.backReady,null,{timeout:120000});
 const ctm=await page.evaluate(({av,dir})=>{const api=QPAvatarFoundation,d=document.createElement('div');d.id='seated-render';d.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#fff';document.body.append(d);d.innerHTML=api.render(av,640);const svg=d.firstElementChild;
  api.apply(svg,{action:'floor-sit',seatMode:'floor',direction:dir,time:0,reducedMotion:true});const m=svg.querySelector('[data-foundation-part="near-leg"]').getCTM();return[m.a,m.b,m.c,m.d,m.e,m.f];},{av:{...M.referenceAvatar(sex,0),...(items?JSON.parse(items):{})},dir});
 // The game applies a pose every frame: shoot after a later frame, not the
 // first one (a single-frame render hid a repaint that dropped the seated
 // picture from the second frame on, 2026-10-15).
 await page.waitForTimeout(800);await page.evaluate(dir=>QPAvatarFoundation.apply(document.querySelector('#seated-render svg'),{action:'floor-sit',seatMode:'floor',direction:dir,time:0,reducedMotion:true}),dir);
 await page.waitForTimeout(300);await page.locator('#seated-render svg').screenshot({path:out});console.log(JSON.stringify({ctm}));
}finally{await browser.close();await server.close();}})();
