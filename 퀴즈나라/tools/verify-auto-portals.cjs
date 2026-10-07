'use strict';
// Exercise actual walking and room lifecycle, not direct calls to onPortal.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/',out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/자동출입구');
fs.mkdirSync(out,{recursive:true});let browser;const report={checks:[],errors:[],realFirebase:false};
async function room(p,z){await p.waitForFunction(z=>document.querySelector('.school-room-host')?.dataset.zone===z,z);}
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
 const p=await browser.newPage({viewport:{width:1366,height:768}});p.setDefaultTimeout(18000);
 p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 await p.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app/,r=>r.fulfill({body:''}));
 await p.goto(base+'?demo=1&session=auto-portal-'+Date.now());
 await p.waitForFunction(()=>window.QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready);
 const identity=await p.evaluate(()=>JSON.stringify(QPGame.getMe()));
 // A door at the end of a painted ladder (the sky island's way down) is
 // reached by climbing; it has no level floor to walk away and back on.
 const cases=await p.evaluate(()=>[...QPForestVillageScene.zones.map(z=>QPForestVillageScene.get(z)),{...QPSchoolRoomScene,zone:"campus"},QPPlaygroundScene].flatMap(scene=>(scene.interactables||[]).filter(p=>p.target).map(p=>{
  const at=p.approach||p,level=p.height||0;let ladder=null;
  for(const c of scene.climbs||[])for(const points of [c.points,[...c.points].reverse()]){const end=points[points.length-1],start=points[0];if(level&&end.height===level&&start.height!==level&&Math.hypot(end.x-at.x,end.y-at.y)<=(p.radius||65))ladder={id:c.id,away:start.height>level?'ArrowUp':'ArrowDown',toward:start.height>level?'ArrowDown':'ArrowUp',otherHeight:start.height};}
  return{zone:scene.zone,portal:p,ladder};})));
 const world=()=>QPGame.getVillage()||QPGame.getCampus()||QPGame.getPlayground();
 for(const {zone,portal,ladder}of cases){
  // A refresh/arrival already on the threshold must remain safe indefinitely.
  // A door on a raised deck/lookout is entered on that level.
  await p.evaluate(({zone,point})=>QPGame.go(zone,point),{zone,point:{...(portal.approach||portal),height:portal.height||0}});await room(p,zone);await p.waitForTimeout(750);
  assert.equal(await p.locator('.school-room-host').getAttribute('data-zone'),zone);
  await p.locator('.school-room-world').focus();await p.keyboard.press('KeyF');await p.waitForTimeout(90);await room(p,zone);
  if(ladder){
   await p.keyboard.down(ladder.away);await p.waitForFunction(h=>{const s=(QPGame.getVillage()||QPGame.getCampus()||QPGame.getPlayground()).getState();return !s.climbing&&s.height===h;},ladder.otherHeight);await p.keyboard.up(ladder.away);await p.waitForTimeout(300);
   assert.equal(await p.locator('.school-room-host').getAttribute('data-zone'),zone,'climbing away keeps the room '+portal.id);
   await p.screenshot({path:path.join(out,portal.id+'-approach.png')});
   await p.keyboard.down(ladder.toward);await room(p,portal.target);await p.keyboard.up(ladder.toward);await p.waitForTimeout(850);
   assert.equal(await p.locator('.school-room-host').getAttribute('data-zone'),portal.target,'No automatic bounce '+portal.id);
   assert.equal(await p.evaluate(()=>JSON.stringify(QPGame.getMe())),identity);
   report.checks.push({id:portal.id,from:zone,to:portal.target,arrivalLatched:true,ladderTriggered:ladder.id});console.log('PASS '+portal.id+' (ladder)');
   continue;
  }
  const start=await p.evaluate(id=>{const w=QPGame.getVillage()||QPGame.getCampus()||QPGame.getPlayground(),p=w.scene.interactables.find(p=>p.id===id),center=p.approach||p;
   for(let radius=54;radius<=90;radius+=12)for(let i=0;i<16;i++){const q={x:center.x+Math.cos(i*Math.PI/8)*radius,y:center.y+Math.sin(i*Math.PI/8)*radius};if(w.nav.canStand(q.x,q.y)&&w.nav.lineClear(center,q))return q;}return null;
  },portal.id);assert(start,'Accessible threshold exit '+portal.id);
  assert(await p.evaluate(q=>(QPGame.getVillage()||QPGame.getCampus()||QPGame.getPlayground()).moveTo(q.x,q.y),start));
  await p.waitForFunction(q=>{const s=(QPGame.getVillage()||QPGame.getCampus()||QPGame.getPlayground()).getState();return !s.moving&&Math.hypot(s.x-q.x,s.y-q.y)<1;},start);
  await p.screenshot({path:path.join(out,portal.id+'-approach.png')});
  assert(await p.evaluate(q=>(QPGame.getVillage()||QPGame.getCampus()||QPGame.getPlayground()).moveTo(q.x,q.y),portal.approach||portal));
  await room(p,portal.target);await p.waitForTimeout(850);assert.equal(await p.locator('.school-room-host').getAttribute('data-zone'),portal.target,'No automatic bounce '+portal.id);
  assert.equal(await p.evaluate(()=>JSON.stringify(QPGame.getMe())),identity);
  assert(!await p.locator('.sr-door-hint').evaluateAll(ns=>ns.some(n=>/F/.test(n.textContent+' '+n.getAttribute('aria-label')))));
  report.checks.push({id:portal.id,from:zone,to:portal.target,arrivalLatched:true,walkTriggered:true});console.log('PASS '+portal.id);
 }
 // Physical arrow key input must trigger the same crossing; F remains unrelated.
 await p.evaluate(()=>QPGame.go('campus',{x:2122,y:362}));await room(p,'campus');await p.waitForTimeout(700);await p.locator('.school-room-world').focus();await p.keyboard.down('ArrowUp');await room(p,'playground');await p.keyboard.up('ArrowUp');await p.waitForTimeout(800);await room(p,'playground');
 report.checks.push({id:'held-arrow-crossing',passed:true});
 await p.evaluate(()=>QPGame.go('playground',QPPlaygroundScene.interactables.find(p=>p.target==='village').arrival));await room(p,'playground');
 assert.equal(await p.locator('[data-art="school-village-gate"] text').textContent(),'삼은초등학교');await p.screenshot({path:path.join(out,'school-gate.png')});
 assert.deepEqual(report.errors,[]);report.success=true;
 await browser.close();
})().catch(async e=>{report.error=e.stack;console.error(e);await browser?.close();process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)));
