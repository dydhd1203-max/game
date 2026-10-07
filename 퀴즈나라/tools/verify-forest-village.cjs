'use strict';
// Current 100% original compositions. Art approval still requires opening captures.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/숲원본');fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],realFirebase:false};let browser;
async function walk(p,q){assert(await p.evaluate(q=>QPGame.getVillage().moveTo(q.x,q.y),q));await p.waitForFunction(q=>{const s=QPGame.getVillage().getState();return !s.moving&&Math.hypot(s.x-q.x,s.y-q.y)<2;},q,{timeout:30000});}
(async()=>{
 browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1366,height:768}});await ctx.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app/,r=>r.fulfill({body:''}));
 const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});// QUIZ_AVATAR_MODE=foundation walks the same routes and ladders with the reference body.
 const foundation=process.env.QUIZ_AVATAR_MODE==='foundation';report.avatarMode=foundation?'foundation':'wardrobe';
 await p.goto(base+'?demo=1'+(foundation?'&avatar=foundation':'')+'&session=forest-original-'+Date.now());await p.waitForFunction(f=>QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPAvatarDirection.atlas.backReady&&(!f||window.QPFoundationOutfit?.atlas.ready&&window.QPFoundationSkin?.atlas.ready),foundation);
 const identity=await p.evaluate(()=>JSON.stringify(QPGame.getMe()));
 // Ground and each raised deck/lookout are separate levels joined only by the
 // painted ladders. Routes, doors and arrivals are checked on their own level.
 const geometry=await p.evaluate(()=>QPForestVillageScene.zones.map(zone=>{
  const s=QPForestVillageScene.get(zone),navs=new Map(),nav=h=>{h=Number(h)||0;if(!navs.has(h))navs.set(h,QPSchoolRoomWorld.createNavigation(s,{height:h,step:h?6:12}));return navs.get(h);};
  const reached=new Map([[0,[s.spawn]]]),queue=[0];
  while(queue.length){const h=queue.shift();for(const c of s.climbs||[])for(const points of [c.points,[...c.points].reverse()]){const from=points[0],to=points[points.length-1];if(from.height!==h||reached.has(to.height))continue;if(reached.get(h).some(q=>nav(h).route(q,from))){reached.set(to.height,[to]);queue.push(to.height);}}}
  const reach=(q,h)=>(reached.get(Number(h)||0)||[]).some(start=>Boolean(nav(h).route(start,q)));
  return{zone,levels:[...reached.keys()],
   routes:s.reviewRoutes.map(r=>({id:r.id,legal:(Number(r.from.height)||0)===(Number(r.to.height)||0)&&nav(r.from.height).canStand(r.from.x,r.from.y)&&nav(r.to.height).canStand(r.to.x,r.to.y),reachable:reach(r.from,r.from.height)&&Boolean(nav(r.from.height).route(r.from,r.to))})),
   portals:s.interactables.map(p=>({id:p.id,height:p.height||0,reachable:reach(p.approach,p.height),arrival:nav(p.arrival.height).canStand(p.arrival.x,p.arrival.y)})),
   ladders:(s.climbs||[]).map(c=>({id:c.id,ends:c.points.every(q=>nav(q.height).canStand(q.x,q.y)),reached:c.points.every(q=>reached.has(q.height))})),
   levelCount:(s.levels||[]).length};
 }));
 for(const g of geometry){assert(g.routes.every(r=>r.legal&&r.reachable),JSON.stringify(g));assert(g.portals.every(r=>r.reachable&&r.arrival),JSON.stringify(g));assert(g.ladders.every(l=>l.ends&&l.reached),JSON.stringify(g));assert.equal(g.levels.length,g.levelCount+1,'every raised level is reached by a ladder: '+JSON.stringify(g));}
 const ladderZones=Object.fromEntries(geometry.map(g=>[g.zone,g.ladders.length]));assert(ladderZones.treehouse>=1&&ladderZones.skyisland>=4,'painted ladders are climbs: '+JSON.stringify(ladderZones));
 report.checks.push({name:'all seven zones, routes, ladder levels and return arrivals',geometry});
 assert(await p.evaluate(()=>{const s=QPForestVillageScene.get();return !s.climbs?.length&&!s.brookReview&&!s.greatTree&&!s.parts.some(p=>/flower-home|bakery-home|plaza-tree|plaza-brook|garden-well/.test(p.asset))&&s.parts.filter(p=>p.role==='composition').length===1;}));
 assert(await p.evaluate(()=>!document.querySelector('[data-art="autumn-tree"]')&&QPMapAvatarDisplay.forScene(QPGame.getVillage().scene).trees.length>0));
 report.checks.push({name:'Original map tree pixels preserved; shared translucent avatar policy loaded'});
 for(const zone of ['autumnpark','camp']){
  await p.evaluate(zone=>QPGame.go(zone,QPForestVillageScene.get(zone).spawn),zone);await p.waitForTimeout(700);
  const points=await p.evaluate(()=>QPGame.getVillage().scene.previewViews.slice(1).map(v=>v.spawn));
  for(const q of points)await walk(p,q);
  await p.locator('.school-room-world').focus();await p.keyboard.press('KeyC');assert.equal(await p.evaluate(()=>QPGame.getVillage().getState().pose),'sit-floor');await p.keyboard.press('KeyC');await p.locator('[data-gesture="wave"]').click();await p.waitForTimeout(160);await p.screenshot({path:path.join(out,zone+'-walk-sit-wave.png')});
  report.checks.push({name:zone+' real walk/C/wave',views:points.length});
 }
 // Real keyboard on the painted ladders: walk to the foot, hold ↑, stop on
 // release, climb on to the deck, use a raised door, come back down with ↓.
 const live=()=>p.evaluate(()=>{const w=QPGame.getVillage(),s=w.getState();return{zone:w.scene.zone,x:s.x,y:s.y,height:s.height,pose:s.pose,climbing:s.climbing,nearest:s.nearest?.type||null,view:document.querySelector('.sr-actor.is-me svg:not(.sr-avatar-ambient)')?.dataset.qpxView||null};});
 async function climb(key,done){await p.locator('.school-room-world').focus();await p.keyboard.down(key);await p.waitForFunction(done,null,{timeout:20000});await p.keyboard.up(key);await p.waitForTimeout(300);return live();}
 await p.evaluate(()=>QPGame.go('treehouse',QPForestVillageScene.get('treehouse').spawn));await p.waitForFunction(()=>QPGame.getVillage()?.scene.zone==='treehouse');await p.waitForTimeout(700);
 const trunk=await p.evaluate(()=>QPForestVillageScene.get('treehouse').climbs[0]),deck=trunk.points[1].height;
 await walk(p,trunk.points[0]);assert.equal((await live()).nearest,'climb','ladder foot offers the climb');
 await p.locator('.school-room-world').focus();await p.keyboard.down('ArrowUp');await p.waitForFunction(()=>QPGame.getVillage().getState().climbing);await p.waitForTimeout(650);await p.keyboard.up('ArrowUp');
 const paused=await live();await p.waitForTimeout(400);const still=await live();
 assert(paused.pose==='climb'&&paused.height>0&&paused.height<deck&&paused.view==='back','climbing faces the ladder: '+JSON.stringify(paused));
 if(foundation)assert(await p.evaluate(()=>Boolean(document.querySelector('.sr-actor.is-me [data-qp-foundation]'))),'reference body climbs in foundation mode');assert.equal(still.height,paused.height,'releasing ↑ stops on the ladder');
 await p.screenshot({path:path.join(out,'treehouse-ladder-climbing.png')});
 const top=await climb('ArrowUp',()=>!QPGame.getVillage().getState().climbing);assert(top.height===deck&&top.pose==='idle',JSON.stringify(top));
 const skyDoor=await p.evaluate(()=>QPForestVillageScene.get('treehouse').interactables.find(i=>i.target==='skyisland'));
 assert(await p.evaluate(q=>QPGame.getVillage().moveTo(q.x,q.y),skyDoor.approach));await p.waitForFunction(()=>QPGame.getVillage()?.scene.zone==='skyisland',null,{timeout:30000});await p.waitForTimeout(900);
 const arrived=await live();assert.equal(arrived.height,0,'sky arrival on the island ground');
 const east=await p.evaluate(()=>QPForestVillageScene.get('skyisland').climbs.find(c=>c.id==='sky-east-ladder'));
 await walk(p,east.points[0]);const lookout=await climb('ArrowUp',()=>!QPGame.getVillage().getState().climbing&&QPGame.getVillage().getState().height>0);assert.equal(lookout.height,east.points[1].height);
 await p.screenshot({path:path.join(out,'sky-east-lookout.png')});
 const down=await climb('ArrowDown',()=>!QPGame.getVillage().getState().climbing&&QPGame.getVillage().getState().height===0);assert.equal(down.height,0);
 const back=await p.evaluate(()=>QPForestVillageScene.get('skyisland').climbs.find(c=>c.id==='sky-return-ladder'));
 await walk(p,back.points[0]);await p.locator('.school-room-world').focus();await p.keyboard.down('ArrowDown');await p.waitForFunction(()=>QPGame.getVillage()?.scene.zone==='treehouse',null,{timeout:20000});await p.keyboard.up('ArrowDown');await p.waitForTimeout(700);
 const home=await live();assert.equal(home.height,deck,'the return ladder arrives on the moon deck');
 report.checks.push({name:'painted ladders: treehouse trunk, sky east lookout and return ladder by keyboard',paused,top,arrived,lookout,home});
 const scenes=await p.evaluate(()=>QPForestVillageScene.zones.map(z=>({zone:z,views:QPForestVillageScene.get(z).previewViews})));
 for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await p.setViewportSize(size);for(const s of scenes)for(const v of s.views){await p.evaluate(({z,q})=>QPGame.go(z,q),{z:s.zone,q:v.spawn});await p.waitForTimeout(180);await p.evaluate(()=>Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode().catch(()=>{}))));await p.screenshot({path:path.join(out,s.zone+'-'+v.id+'-'+size.width+'.png')});}}
 assert.equal(await p.evaluate(()=>JSON.stringify(QPGame.getMe())),identity);assert.deepEqual(report.errors,[]);report.success=true;await browser.close();console.log('PASS registered original maps, 7 zone routes, shared tree visibility, park walking/C/wave and two PC resolutions');
})().catch(async e=>{report.error=e.stack;console.error(e);await browser?.close();process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)));
