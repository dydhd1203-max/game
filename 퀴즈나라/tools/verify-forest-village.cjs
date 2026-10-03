'use strict';
// Real isolated demo rendering/input plus the same navigation used by play.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/숲속마을');fs.mkdirSync(out,{recursive:true});
const session='forest-'+Date.now(),checks=[],errors=[],missing=[],screenshots=[];let browser,phase='startup';
const pass=(name,detail)=>{checks.push({name,detail});console.log('PASS '+name);};
async function room(p,zone){await p.waitForFunction(z=>document.querySelector('.school-room-host')?.dataset.zone===z,zone);}
async function api(p,fn,arg){return p.evaluate(({fn,arg})=>{const w=QPGame.getVillage()||QPGame.getPlayground()||QPGame.getCampus();return Function('w','arg','return ('+fn+')(w,arg)')(w,arg);},{fn:String(fn),arg});}
async function focus(p){await p.bringToFront();await p.locator('.school-room-world').focus();}
async function shot(p,name){await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await p.screenshot({path:path.join(out,name+'.png')});screenshots.push(name+'.png');}
async function walk(p,goal){
 assert(await api(p,(w,g)=>w.moveTo(g.x,g.y),goal),'Runtime click-navigation rejected legal destination');
 await p.waitForFunction(g=>{const w=QPGame.getVillage()||QPGame.getPlayground()||QPGame.getCampus(),s=w.getState();if(!w.canStand(s.x,s.y))throw Error('Walking left legal source terrain');return !s.moving&&Math.hypot(s.x-g.x,s.y-g.y)<2;},goal,{timeout:30000});
}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const context=await browser.newContext({viewport:{width:1366,height:768}});context.setDefaultTimeout(20000);
 await context.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* no real Firebase during review */',contentType:'text/javascript'}));
 async function open(user){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.stack));p.on('response',r=>{if(r.status()>=400)missing.push(r.url());});const u=new URL(base);u.searchParams.set('demo','1');u.searchParams.set('session',session);u.searchParams.set('user',user);await p.goto(u.href);await room(p,'village');await p.waitForFunction(()=>QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady&&QPAvatarDirection.atlas.backReady);return p;}
 const a=await open('마을하늘'),b=await open('마을민트');const identity=await a.evaluate(()=>JSON.stringify(QPGame.getMe()));
 const bid=await b.evaluate(()=>QPGame.getMe().k);await a.waitForFunction(id=>Boolean(document.querySelector('.sr-actor[data-uid="'+CSS.escape(id)+'"]')),bid);
 assert.equal(await a.locator('.sr-actor').count(),2);assert(await a.evaluate(()=>[...document.querySelectorAll('.sr-avatar>svg')].every(n=>Math.abs(+n.getAttribute('height')*56/+n.getAttribute('viewBox').split(/\s+/)[3]-96)<.01)));
 await focus(a);await a.keyboard.press('KeyF');assert.equal(await api(a,w=>w.getState().zone),'village');await a.keyboard.press('KeyC');await a.waitForFunction(()=>QPGame.getVillage().getState().pose==='sit-floor');await shot(a,'01-village-two-students-sitting');await a.keyboard.press('KeyC');
 await a.locator('[data-gesture="wave"]').click();await a.waitForFunction(()=>document.querySelector('.sr-actor.is-me svg')?.dataset.qpxGesture==='wave');await shot(a,'02-village-wave');
 pass('Fresh student entry is the village; two isolated demo students, 96px avatars, C sitting and wave button work; F away from portals is inert.');
 phase='navigation';
 const flowerReview=await a.evaluate(()=>QPForestVillageScene.zones.flatMap(z=>{const s=QPForestVillageScene.get(z);return s.parts.filter(p=>p.role==='flower').map(p=>{
  const contains=(pt,margin)=>pt.x>=p.x-margin&&pt.x<=p.x+p.width+margin&&pt.y>=p.y-margin&&pt.y<=p.y+p.height+margin;
  return {zone:z,id:p.id,asset:p.asset,bed:p.bed,clear:!contains(s.spawn,12)&&s.interactables.every(door=>!contains(door,door.radius)&&!contains(door.arrival,24))};
 });}));
 assert(flowerReview.length>0&&flowerReview.every(f=>f.clear),'Flower bed covers an entrance or arrival area');
 pass('Source flower beds leave spawn, F approaches and return landings clear.',flowerReview);
 const foregroundReview=await a.evaluate(()=>QPForestVillageScene.zones.flatMap(z=>{
  const scene=QPForestVillageScene.get(z),host=document.createElement('div');host.innerHTML=scene.markup;
  return scene.parts.filter(p=>p.role==='foreground').map(p=>{
   const node=host.querySelector('[data-art="'+p.id+'"]'),image=node.querySelector('image'),[x,y,w,h]=p.sourceRect;
   const registered=()=>Math.abs(parseFloat(node.style.left)-x*p.scale)<.001&&Math.abs(parseFloat(node.style.top)-y*p.scale)<.001&&Math.abs(parseFloat(node.style.width)-w*p.scale)<.001&&Math.abs(parseFloat(node.style.height)-h*p.scale)<.001&&Number(image.getAttribute('x'))===-x&&Number(image.getAttribute('y'))===-y&&Number(node.style.zIndex)===p.depth;
   const matches=registered(),original=node.style.left;node.style.left=(parseFloat(original)+2)+'px';const rejectsOffset=!registered();node.style.left=original;
   return {zone:z,id:p.id,matches,rejectsOffset};
  });
 }));
 assert(foregroundReview.length>=11&&foregroundReview.every(r=>r.matches&&r.rejectsOffset),'Foreground moved away from original source painting');
 const obstacleReview=await a.evaluate(()=>{const s=QPForestVillageScene.get('skyisland'),n=QPSchoolRoomWorld.createNavigation(s);return s.solids.filter(x=>x.id.startsWith('sky-gift-base-')).map(b=>({id:b.id,blocked:!n.canStand(b.x+b.width/2,b.y+b.height/2)}));});
 assert.equal(obstacleReview.length,6);assert(obstacleReview.every(r=>r.blocked));
 pass('Eleven source-aligned foregrounds reject a 2px shift; six gift-box ground faces block passage.',{foregroundReview,obstacleReview});

 const scenes=await a.evaluate(()=>QPForestVillageScene.zones.map(z=>{const s=QPForestVillageScene.get(z),nav=QPSchoolRoomWorld.createNavigation(s);const routes=s.reviewRoutes.map(r=>{const pts=nav.route(r.from,r.to);let prev=r.from;const legal=Boolean(pts)&&pts.every(p=>{const ok=nav.lineClear(prev,p);prev=p;return ok;});return {id:r.id,legal};});const portals=s.interactables.map(i=>({id:i.id,legal:nav.canStand(i.x,i.y)&&nav.canStand(i.arrival.x,i.arrival.y)}));return {zone:z,spawn:s.spawn,views:s.previewViews,routes,portals};}));
 assert(scenes.every(s=>s.routes.every(r=>r.legal)&&s.portals.every(p=>p.legal)));
 for(const scene of scenes){
  await a.evaluate(s=>QPGame.go(s.zone,s.spawn),scene);await room(a,scene.zone);await focus(a);
  const routes=await api(a,w=>w.scene.reviewRoutes);
  for(const route of routes){await a.evaluate(({zone,point})=>QPGame.go(zone,point),{zone:scene.zone,point:route.from});await focus(a);await walk(a,route.to);await shot(a,scene.zone+'-walk-'+route.id);}
  for(const v of scene.views){await a.evaluate(({zone,point})=>QPGame.go(zone,point),{zone:scene.zone,point:v.spawn});await shot(a,scene.zone+'-'+v.id);}
 }
 pass('All '+scenes.reduce((n,s)=>n+s.routes.length,0)+' required source-terrain routes animate through the production controller, with collision-checked segments and legal portal approaches.',scenes.map(s=>({zone:s.zone,routes:s.routes.length})));
 phase='portal round trips';
 for(const zone of ['village','forestgarden','treehouse','skyisland']){
  const portals=await a.evaluate(z=>QPForestVillageScene.get(z).interactables,zone);
  for(const portal of portals){
   await a.evaluate(({zone,point})=>QPGame.go(zone,point),{zone,point:portal.approach});await focus(a);await a.waitForTimeout(700);await a.keyboard.down('KeyF');await a.keyboard.down('KeyF');await a.keyboard.up('KeyF');await a.keyboard.press('KeyF');await room(a,portal.target);
   const destination=await api(a,(w,id)=>w.scene.interactables.find(i=>i.id===id),portal.targetDoor);assert(destination);
   const state=await api(a,w=>w.getState());assert(Math.hypot(state.x-destination.arrival.x,state.y-destination.arrival.y)<1);
   assert.equal(await a.evaluate(()=>JSON.stringify(QPGame.getMe())),identity);
   if(zone==='village')await b.waitForFunction(()=>document.querySelectorAll('.sr-actor').length===1);
   await shot(a,zone+'-portal-'+portal.id);
  }
 }
 // Existing playground side of the new path also needs a real return key.
 await a.evaluate(()=>QPGame.go('playground',QPPlaygroundScene.interactables.find(p=>p.target==='village').approach));await focus(a);await a.waitForTimeout(700);await a.keyboard.press('KeyF');await room(a,'village');
 await a.waitForFunction(id=>Boolean(document.querySelector('.sr-actor[data-uid="'+CSS.escape(id)+'"]')),bid);
 pass('Every village/garden/treehouse/sky portal and the playground return transfers by real F, keeps the account and prevents held-key bouncing; rosters separate and rejoin.');
 phase='running and camera';
 await a.evaluate(()=>QPGame.go('village',QPForestVillageScene.get().spawn));await focus(a);
 const before=await api(a,w=>w.getState());await a.keyboard.press('ArrowDown');await a.keyboard.down('ArrowDown');await a.waitForFunction(()=>QPGame.getVillage().getState().pose==='run');await a.waitForFunction(y=>QPGame.getVillage().getState().camera.y>y+10,before.camera.y,{timeout:5000});await a.keyboard.up('ArrowDown');const after=await api(a,w=>w.getState());assert(after.y>before.y+25);assert.notEqual(after.camera.y,before.camera.y);
 await shot(a,'village-double-tap-running');pass('A genuine direction-key double tap runs and the camera follows.');
 phase='wide views';
 await a.setViewportSize({width:1920,height:1080});
 for(const z of ['village','forestgarden','treehouse','skyisland']){await a.evaluate(z=>QPGame.go(z,QPForestVillageScene.get(z).spawn),z);await shot(a,z+'-1920');assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));}
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);pass('Four spaces load at both desktop sizes with no console errors, missing resources or page overflow.');
 const report={passed:checks.length,checks,screenshots,errors,missing,realFirebaseTested:false,physicalSchoolDevicesTested:false,base};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');await browser.close();
})().catch(async e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({phase,error:e.stack,checks,errors,missing},null,2));console.error(phase,e);await browser?.close();process.exitCode=1;});
