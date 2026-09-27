// Actual browser regression: village NPCs and forge sparks are absent in the
// waiting room/sky games, visible in the story, and restored after returning.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),out='artifacts/race79/npc-cull';fs.mkdirSync(out,{recursive:true});
const server=serve(20580,file),errors=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const now=performance.now.bind(performance);let time=null,seed=79314;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  window.__freeze79=()=>{time=100000;};window.__advance79=ms=>{time+=ms;window.__loop73();};
  performance.now=()=>time===null?now():time;const raf=requestAnimationFrame.bind(window);requestAnimationFrame=f=>time===null?raf(f):0;
  localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','art79-review');
 });
 await page.goto('http://127.0.0.1:20580/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});
 await page.waitForFunction(()=>window.__READY,null,{timeout:240000});await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
 const result=await page.evaluate(()=>{const W=window,G=W.__G,P=W.__PL,N=Object.values(W.__NPC79);
  document.getElementById('iName').value='최적화 검수';document.getElementById('bSolo').click();W.__introDone();
  document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freeze79();W.__DBG().noRender=true;
  G.phase='day';G.t=100000;G.paused=false;G.host=false;W.__XP.job=-1;W.__XP.jt=0;W.__setSky(0);W.__updSky(0,true);
  const step=n=>{for(let i=0;i<n;i++)W.__advance79(1000/60);},state=()=>N.map(m=>({visible:m.visible,count:m.count}));
  for(let i=0;i<20;i++){const id='artfriend'+i,x=(i%5-2)*1.35,z=-1-Math.floor(i/5)*1.4;
   G.players.set(id,{uid:id,x,z,y:W.__GY,tx:x,tz:z,ty:W.__GY,ry:Math.PI,g:i%5,n:'친구'+(i+1),mv:false,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});}
  Object.assign(P,{x:0,z:-17,y:W.__GY,vx:0,vy:0,vz:0,ground:true,_px:0,_pz:-17,yaw:Math.PI,pitch:-.22});step(45);
  const villageCounts=N.map(m=>m.count),villageState=state();
  // Even if the avatar's X/Z lies beside the forge, a sky/lobby phase cannot emit sparks.
  const smith=W.__NPCS().find(n=>n.kind==='smith');P.x=smith.x;P.z=smith.z;
  W.__parts().forEach(p=>p.t=0);G.phase='lobby';W.__drawNPCs(300);const lobby=state(),lobbyParts=W.__parts().filter(p=>p.t>0).length;
  G.phase='intro';W.__drawNPCs(302);const story=state();
  G.phase='mini';G.mini={k:0,st:'intro',seed:740021,sc:[0,0,0,0,0],rank:null};W.__miniEnter();G.mini.st='run';G.t=180;
  W.__race74.reset();Object.assign(W.__RACE(),{t:0,on:true,fallT:0,hitCd:2,slipT:0});W.__MINE.cp=3;W.__MINE.fin=-1;
  const pad=W.__RACE_P().find(p=>p.sec===2&&p.bounce),Y=W.__MINI().Y;
  Object.assign(P,{x:pad.x,z:pad.z-pad.d*.47,y:Y+pad.y,vx:0,vy:0,vz:0,ground:true,jumps:0,_px:pad.x,_pz:pad.z-pad.d*.47,yaw:Math.PI,pitch:-.22});W.__camZoom(3.2);
  let i=0;for(const q of G.players.values()){const x=pad.x+(i%5-2)*1.3,z=pad.z-pad.d*.48-Math.floor(i/5)*1.4;i++;Object.assign(q,{x,tx:x,z,tz:z,y:Y+pad.y,ty:Y+pad.y});}
  step(55);W.__cam.position.set(20,Y+24,211);W.__cam.lookAt(-3,Y+2,260);W.__cam.updateMatrixWorld(true);
  W.__parts().forEach(p=>p.t=0);const px=P.x,pz=P.z;P.x=smith.x;P.z=smith.z;W.__drawNPCs(310);P.x=px;P.z=pz;
  const race=state(),raceParts=W.__parts().filter(p=>p.t>0).length;
  W.__drawFrame();const culled={calls:W.__R.info.render.calls,triangles:W.__R.info.render.triangles,memory:{...W.__R.info.memory},players:G.players.size+1,art:{...W.__race74.art().stats},png:W.__R.domElement.toDataURL('image/png')};
  // Same rendered frame, camera and quality; temporarily restoring only banks measures exact saved work.
  N.forEach((m,j)=>{m.visible=true;m.count=villageCounts[j];});W.__drawFrame();
  const uncullProbe={calls:W.__R.info.render.calls,triangles:W.__R.info.render.triangles};W.__drawNPCs(311);
  W.__miniExit();G.phase='day';G.mini=null;Object.assign(P,{x:0,z:-17,y:W.__GY,vx:0,vy:0,vz:0,ground:true,_px:0,_pz:-17});step(45);
  W.__cam.position.set(22,W.__GY+17,-25);W.__cam.lookAt(0,W.__GY+1,0);W.__cam.updateMatrixWorld(true);W.__drawFrame();
  const returned={state:state(),calls:W.__R.info.render.calls,triangles:W.__R.info.render.triangles,png:W.__R.domElement.toDataURL('image/png')};
  return {villageState,lobby,lobbyParts,story,race,raceParts,culled,uncullProbe,returned};
 });
 assert.equal(result.villageState.length,6);assert.ok(result.villageState.every(q=>q.visible&&q.count>0));
 assert.ok(result.lobby.every(q=>!q.visible&&q.count===0));assert.equal(result.lobbyParts,0);
 assert.ok(result.story.every(q=>q.visible&&q.count>0));assert.ok(result.race.every(q=>!q.visible&&q.count===0));assert.equal(result.raceParts,0);
 assert.deepEqual(result.returned.state,result.villageState);assert.ok(result.culled.calls<result.uncullProbe.calls);assert.ok(result.culled.triangles<result.uncullProbe.triangles);
 for(const [key,name]of [['culled','donut-budget'],['returned','village-return']]){fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(result[key].png.split(',')[1],'base64'));delete result[key].png;}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...result,errors},null,2));assert.deepEqual(errors,[]);
 console.log('PASS six banks hidden in lobby/races, no offscreen smith sparks, visible during story and restored after village return.');
 console.log(JSON.stringify({culled:result.culled,uncullProbe:result.uncullProbe,returned:result.returned},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
