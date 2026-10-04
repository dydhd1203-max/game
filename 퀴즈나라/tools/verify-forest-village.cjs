'use strict';
// Current 100% original compositions. Art approval still requires opening captures.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/숲원본');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],realFirebase:false};let browser;
async function walk(p,q){assert(await p.evaluate(q=>QPGame.getVillage().moveTo(q.x,q.y),q));await p.waitForFunction(q=>{const s=QPGame.getVillage().getState();return !s.moving&&Math.hypot(s.x-q.x,s.y-q.y)<2;},q,{timeout:30000});}
(async()=>{
 browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1366,height:768}});await ctx.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app/,r=>r.fulfill({body:''}));
 const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});await p.goto(base+'?demo=1&session=forest-original-'+Date.now());await p.waitForFunction(()=>QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPAvatarDirection.atlas.backReady);
 const identity=await p.evaluate(()=>JSON.stringify(QPGame.getMe()));
 const geometry=await p.evaluate(()=>QPForestVillageScene.zones.map(zone=>{const s=QPForestVillageScene.get(zone),n=QPSchoolRoomWorld.createNavigation(s);return{zone,routes:s.reviewRoutes.map(r=>({id:r.id,legal:n.canStand(r.from.x,r.from.y)&&n.canStand(r.to.x,r.to.y),reachable:Boolean(n.route(r.from,r.to))})),portals:s.interactables.map(p=>({id:p.id,reachable:Boolean(n.route(s.spawn,p.approach)),arrival:n.canStand(p.arrival.x,p.arrival.y)}))};}));
 for(const g of geometry){assert(g.routes.every(r=>r.legal&&r.reachable),JSON.stringify(g));assert(g.portals.every(r=>r.reachable&&r.arrival),JSON.stringify(g));}report.checks.push({name:'all seven zones, routes and return arrivals',geometry});
 assert(await p.evaluate(()=>{const s=QPForestVillageScene.get();return !s.climbs?.length&&!s.brookReview&&!s.greatTree&&!s.parts.some(p=>/flower-home|bakery-home|plaza-tree|plaza-brook|garden-well/.test(p.asset))&&s.parts.filter(p=>p.role==='composition').length===1;}));
 await p.waitForFunction(()=>document.querySelector('[data-art="autumn-tree"]') instanceof HTMLCanvasElement);
 const cutout=await p.evaluate(()=>{const n=document.querySelector('[data-art="autumn-tree"]'),a=n.getContext('2d').getImageData(0,0,n.width,n.height).data;let visible=0,green=0;for(let i=0;i<a.length;i+=4)if(a[i+3]){visible++;if(a[i+1]>a[i]*1.015&&a[i+1]>a[i+2]*1.12)green++;}const old=new Uint8ClampedArray([130,185,97,255,233,141,50,255]);QPForestAdventure.autumnAlpha(old);return{visible,green,negativeControl:old[3]===0&&old[7]===255};});assert(cutout.visible>1000&&cutout.green===0&&cutout.negativeControl);report.checks.push({name:'transparent grass under orange canopy',...cutout});
 for(const zone of ['autumnpark','camp']){
  await p.evaluate(zone=>QPGame.go(zone,QPForestVillageScene.get(zone).spawn),zone);await p.waitForTimeout(700);
  const points=await p.evaluate(()=>QPGame.getVillage().scene.previewViews.slice(1).map(v=>v.spawn));
  for(const q of points)await walk(p,q);
  await p.locator('.school-room-world').focus();await p.keyboard.press('KeyC');assert.equal(await p.evaluate(()=>QPGame.getVillage().getState().pose),'sit-floor');await p.keyboard.press('KeyC');await p.locator('[data-gesture="wave"]').click();await p.waitForTimeout(160);await p.screenshot({path:path.join(out,zone+'-walk-sit-wave.png')});
  report.checks.push({name:zone+' real walk/C/wave',views:points.length});
 }
 const scenes=await p.evaluate(()=>QPForestVillageScene.zones.map(z=>({zone:z,views:QPForestVillageScene.get(z).previewViews})));
 for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await p.setViewportSize(size);for(const s of scenes)for(const v of s.views){await p.evaluate(({z,q})=>QPGame.go(z,q),{z:s.zone,q:v.spawn});await p.waitForTimeout(180);await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));await p.screenshot({path:path.join(out,s.zone+'-'+v.id+'-'+size.width+'.png')});}}
 assert.equal(await p.evaluate(()=>JSON.stringify(QPGame.getMe())),identity);assert.deepEqual(report.errors,[]);report.success=true;await browser.close();console.log('PASS registered original maps, 7 zone routes, canopy alpha, park walking/C/wave and two PC resolutions');
})().catch(async e=>{report.error=e.stack;console.error(e);await browser?.close();process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)));
