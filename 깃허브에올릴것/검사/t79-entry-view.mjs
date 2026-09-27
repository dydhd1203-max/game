// Actual entry/wardrobe UI, one hidden browser; production network is never used.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const dir='artifacts/entry79';fs.mkdirSync(dir,{recursive:true});
const server=serve(20589,process.argv[2]||GAME);let browser;const errors=[],results={};
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{
  const now=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let t=null;
  window.__freeze79=()=>{t=now();};window.__step79=ms=>{t+=ms;window.__loop73();};
  performance.now=()=>t===null?now():t;requestAnimationFrame=f=>t===null?raf(f):1;
  localStorage.setItem('sndOn','0');
 });
 await page.goto('http://127.0.0.1:20589/?gfx=mid',{timeout:240000,waitUntil:'load'});
 await page.waitForFunction(()=>window.__READY===true,null,{timeout:240000});
 await page.evaluate(()=>__freeze79());
 const inspect=()=>page.evaluate(()=>{
  const ids=['iName','iRoom','grpPick','bJoin','bMake','bSolo'],rect=id=>{const a=document.getElementById(id).getBoundingClientRect();return {x:a.x,y:a.y,w:a.width,h:a.height,b:a.bottom,r:a.right};};
  return {width:innerWidth,height:innerHeight,entry:ids.map(id=>({id,...rect(id)})),hasCosmetics:!!document.querySelector('#title #dressPick'),preview:!!__pvw(),entryOverflow:document.getElementById('title').scrollWidth>innerWidth,settings:document.getElementById('entrySettings79').open};
 });
 results.desktop=await inspect();assert.equal(results.desktop.hasCosmetics,false);assert.equal(results.desktop.preview,false);assert.equal(results.desktop.entryOverflow,false);
 for(const e of results.desktop.entry)assert.ok(e.y>=0&&e.b<=768&&e.w>0,e.id+' fits initial viewport');
 await page.screenshot({path:dir+'/entry-desktop.png'});
 await page.evaluate(()=>document.getElementById('entrySettings79').open=true);
 await page.locator('#sndRowT').scrollIntoViewIfNeeded();assert.ok(await page.locator('[data-snd=bgm]').first().isVisible());
 results.settingsHeight=await page.locator('#entrySettings79').evaluate(e=>e.getBoundingClientRect().height);assert.ok(results.settingsHeight<250,'expanded controls stay compact');await page.screenshot({path:dir+'/entry-settings.png'});
 await page.evaluate(()=>document.getElementById('entrySettings79').open=false);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);results.phone=await inspect();assert.equal(results.phone.entryOverflow,false);
 for(const e of results.phone.entry)assert.ok(e.x>=0&&e.r<=390&&e.w>0,e.id+' fits phone width');
 await page.screenshot({path:dir+'/entry-phone.png'});
 await page.setViewportSize({width:320,height:568});await page.locator('#bJoin').scrollIntoViewIfNeeded();results.small=await inspect();assert.equal(results.small.entryOverflow,false);assert.ok(await page.locator('#bJoin').isVisible());
 await page.evaluate(()=>document.getElementById('entrySettings79').open=true);await page.locator('#sndRowT').scrollIntoViewIfNeeded();assert.ok(await page.locator('[data-snd=sfx]').first().isVisible());
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{document.getElementById('iName').value='하늘';document.querySelectorAll('#grpPick button')[2].click();document.getElementById('bSolo').click();__step79(16.67);document.getElementById('lobbyDress78').click();__step79(16.67);});
 results.open=await page.evaluate(()=>{
  const P=__pvw();window.__wardrobeRef79=P;
  const worldFace=P.body[2].getWorldPosition(new __THREE.Vector3()),worldHead=P.body[1].getWorldPosition(new __THREE.Vector3());
  const dot=worldFace.clone().sub(worldHead).dot(P.cam.position.clone().sub(worldHead));
  return {phase:__G.phase,pvw:!!P,frontDot:dot,group:__G.me.g,canvasInModal:!!document.querySelector('#popLobby78 #pvw'),choices:document.querySelectorAll('#popLobby78 #dressPick .grp button').length,frame:P.r.info.render.frame};
 });
 assert.equal(results.open.phase,'lobby');assert.ok(results.open.pvw&&results.open.canvasInModal);assert.ok(results.open.frontDot>0);assert.equal(results.open.group,2);
 await page.screenshot({path:dir+'/wardrobe-desktop.png'});
 results.change=await page.evaluate(()=>{for(const id of ['hatPick','glsPick','cloPick','skinPick'])document.querySelectorAll('#'+id+' button')[1].click();__step79(16.67);const P=__pvw();return {packet:__lobby78.pack(),deco:P.deco.filter(m=>m.visible).length,skin:P.body[1].material.color.getHex(),headVisible:P.body[1].visible};});
 assert.ok(results.change.deco>0&&results.change.headVisible);assert.equal(results.change.packet.ht,9);assert.equal(results.change.packet.gl,8);assert.equal(results.change.packet.cl,2);assert.equal(results.change.packet.sk,1);
 await page.screenshot({path:dir+'/wardrobe-dressed.png'});
 results.reuse=await page.evaluate(()=>{
  const P=__pvw(),close=document.querySelector('[data-close=popLobby78]');close.click();const first=P.r.info.render.frame;
  __DBG().noRender=true;for(let i=0;i<60;i++)__step79(16.67);const hidden=P.r.info.render.frame;
  for(let i=0;i<8;i++){document.getElementById('lobbyDress78').click();__step79(16.67);close.click();}
  const reused=__pvw()===window.__wardrobeRef79;
  __DBG().noRender=false;document.getElementById('lobbyDress78').click();__step79(16.67);
  return {sameRenderer:reused,closedFrames:hidden-first,openFrames:P.r.info.render.frame-hidden,contexts:document.querySelectorAll('#popLobby78 canvas').length};
 });
 assert.equal(results.reuse.sameRenderer,true);assert.equal(results.reuse.closedFrames,0);assert.ok(results.reuse.openFrames>0);assert.equal(results.reuse.contexts,1);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__step79(16.67));await page.screenshot({path:dir+'/wardrobe-phone.png'});
 const phoneModal=await page.evaluate(()=>{const p=document.querySelector('#popLobby78 .panel'),b=document.querySelector('[data-close=popLobby78]').getBoundingClientRect();return {overflow:p.scrollWidth>p.clientWidth,closeBottom:b.bottom,closeTop:b.top};});assert.equal(phoneModal.overflow,false);assert.ok(phoneModal.closeTop>=0&&phoneModal.closeBottom<=844);results.phoneModal=phoneModal;
 await page.locator('#cloPick button').last().scrollIntoViewIfNeeded();
 results.scrolledPreview=await page.locator('#pvw').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom};});assert.ok(results.scrolledPreview.top>=0&&results.scrolledPreview.bottom<844,'front preview stays visible while selecting lower clothes');await page.screenshot({path:dir+'/wardrobe-phone-scroll.png'});
 results.teacherGuard=await page.evaluate(()=>{
  document.querySelector('[data-close=popLobby78]').click();__G.host=false;__lobby78.enter();const hidden=document.getElementById('lobbyStart78').hidden,guest=__lobby78.start();
  __G.host=true;__lobby78.enter();const host=__lobby78.start();__step79(16.67);const closed=!document.getElementById('popLobby78').classList.contains('on'),frame=__pvw().r.info.render.frame;for(let i=0;i<20;i++)__step79(16.67);
  document.getElementById('lobbyDress78').click();return {hidden,guest,host,phase:__G.phase,closed,blocked:!document.getElementById('popLobby78').classList.contains('on'),dress:__lobby78.dress('hat',0),storyFrames:__pvw().r.info.render.frame-frame};
 });
 assert.deepEqual(results.teacherGuard,{hidden:true,guest:false,host:true,phase:'intro',closed:true,blocked:true,dress:false,storyFrames:0});
 results.errors=errors;assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));console.log('PASS entry79: desktop/phone, complete front wardrobe, network packet, renderer reuse/sleep and teacher-only start');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
