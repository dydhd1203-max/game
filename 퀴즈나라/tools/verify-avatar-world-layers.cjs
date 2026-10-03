'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/아바타맵레이어');fs.mkdirSync(out,{recursive:true});const b=await chromium.launch();
 try{
  const p=await b.newPage({viewport:{width:1366,height:768}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app/,r=>r.fulfill({body:''}));
  await p.goto((process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/')+'?demo=1&session=world-layers');
  await p.waitForFunction(()=>QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPEffects.atlas.ready&&QPPets.atlas.ready);
  const original=await p.evaluate(()=>JSON.stringify(QPGame.getMe()));
  await p.evaluate(async()=>{await QPGame.getVillagePresence().disconnect();QPGame.getVillage().setPresence(null);});
  const layers=await p.evaluate(()=>{const art=document.querySelector('.sr-actor.is-me .sr-avatar'),body=art.firstElementChild,overlay=art.querySelector('.sr-avatar-ambient');return {count:art.children.length,bodyHasRig:!!body.querySelector('.qpx-body'),petOnlyInOverlay:!body.querySelector('.qpx-pet')&&!!overlay.querySelector('.qpx-pet'),effectOnlyInOverlay:!body.querySelector('[data-qpx-effect]')&&!!overlay.querySelector('[data-qpx-effect]'),sameViewport:body.getAttribute('viewBox')===overlay.getAttribute('viewBox')&&body.getAttribute('width')===overlay.getAttribute('width')&&body.getAttribute('height')===overlay.getAttribute('height')};});
  assert.equal(layers.count,2);for(const [key,value]of Object.entries(layers))if(key!=='count')assert(value,key);
  await p.evaluate(()=>QPGame.getVillage().setPaused(true));await p.waitForTimeout(80);
  const paused=await p.locator('.sr-actor.is-me .sr-avatar').evaluate(art=>[...art.querySelectorAll('.qpx-blink-closed,.qpx-pet,.qp-effect-wing')].every(n=>getComputedStyle(n).animationPlayState==='paused'));assert(paused);
  await p.evaluate(()=>QPGame.getVillage().setPaused(false));await p.waitForTimeout(80);
  assert(await p.locator('.sr-actor.is-me .qpx-pet').evaluate(n=>getComputedStyle(n).animationPlayState==='running'));
  await p.evaluate(()=>{const w=QPGame.getVillage();w.setPlayers([{uid:'offscreen-fixture',name:'멀리 있는 친구',avatar:QPGame.getMe().av,zone:'village',x:850,y:1670,pose:'walk',moving:true,direction:'right'}]);});
  await p.waitForFunction(()=>{const n=document.querySelector('[data-uid="offscreen-fixture"]');return n?.hidden&&n.querySelector('.sr-avatar').classList.contains('sr-motion-paused')});
  await p.evaluate(()=>{const w=QPGame.getVillage(),s=w.getState();w.setPlayers([{uid:'offscreen-fixture',name:'가까이 온 친구',avatar:QPGame.getMe().av,zone:'village',x:s.x+75,y:s.y,pose:'walk',moving:true,direction:'right'}]);});
  await p.waitForFunction(()=>{const n=document.querySelector('[data-uid="offscreen-fixture"]');return n&&!n.hidden&&n.querySelector('svg').dataset.qpxView==='profile'&&n.querySelector('svg').dataset.qpxPose==='walk'&&!n.querySelector('.sr-avatar').classList.contains('sr-motion-paused')});
  await p.screenshot({path:path.join(out,'returned-friend.png')});
  await p.evaluate(()=>document.getElementById('modal').classList.add('on'));await p.waitForTimeout(80);assert(await p.evaluate(()=>QPGame.getVillage().getState().paused));
  assert(await p.locator('.sr-actor.is-me .qp-effect-wing').first().evaluate(n=>getComputedStyle(n).animationPlayState==='paused'));
  await p.evaluate(()=>document.getElementById('modal').classList.remove('on'));await p.waitForTimeout(80);assert(!await p.evaluate(()=>QPGame.getVillage().getState().paused));
  await p.evaluate(()=>{const w=QPGame.getVillage();w.setAvatar({...QPGame.getMe().av,sex:'m',top:'tee:3',bottom:'shorts:5',outfit:'',hair:'short:1'});});
  assert.equal(await p.locator('.sr-actor.is-me .sr-avatar>svg').count(),2);
  assert.equal(await p.locator('.sr-actor.is-me .qpx-pet').count(),1);
  assert.equal(await p.locator('.sr-actor.is-me [data-qpx-effect]').count(),1);
  assert.equal(await p.evaluate(()=>JSON.stringify(QPGame.getMe())),original);
  await p.evaluate(()=>QPGame.go('school'));assert.equal(await p.locator('.sr-avatar-ambient').count(),0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({layers,paused,offscreenReturn:true,modalResume:true,wardrobeRebuild:true,accountUnchanged:true,cleanup:true,errors},null,2));
  console.log('PASS independent body/pet/effect layers, pause/resume, offscreen return, changed outfit, account preservation and scene cleanup.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
