// Real WebGL race inspection. Software-renderer CPU timings are NOT LG Gram FPS.
// Usage: node t74-race-view.mjs [game.html] [--baseline]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
import { race76Physics, validateRace76 } from './race76-physics.mjs';

const file=process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME;
const baseline=process.argv.includes('--baseline'), label=baseline?'baseline75':'race76';
const captureOnly=process.argv.includes('--capture-only'),physicsOnly=process.argv.includes('--physics-only');
const out=path.resolve('artifacts/race76');fs.mkdirSync(out,{recursive:true});
const server=serve(20575,file);let browser;
try {
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{
    const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null;
    window.__realNow=real;window.__freeze=()=>{time=real();};
    window.__advance=ms=>{time+=ms;window.__loop73();};
    performance.now=()=>time===null?real():time;requestAnimationFrame=f=>time===null?raf(f):0;
    localStorage.setItem('sndOn','0');
  });
  await page.goto('http://127.0.0.1:20575/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});
  await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
  await page.evaluate(()=>{
    const W=window;document.getElementById('iName').value='경주 검수';document.getElementById('bSolo').click();
    W.__introDone();document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));
    W.__freeze();W.__DBG().noRender=true;
    const G=W.__G,P=W.__PL;G.phase='mini';G.host=false;G.paused=false;
    G.mini={k:0,st:'intro',seed:740021,sc:[0,0,0,0,0],rank:null};G.t=10;
    for(let i=0;i<20;i++){const id='race_friend_'+String(i).padStart(2,'0');
      G.players.set(id,{uid:id,x:0,y:W.__MINI().Y,z:0,tx:0,ty:W.__MINI().Y,tz:0,ry:Math.PI,g:i%5,n:'친구'+(i+1),mv:true,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});
      W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});}
    W.__miniEnter();G.mini.st='run';G.t=W.__MINI().RACE;W.__miniOnState();
    W.__camZoom(3.2);P.yaw=Math.PI;P.pitch=-.22;W.__XP.job=-1;W.__XP.jt=0;
    W.__crowdAt=(x,z,y)=>{let i=0;for(const q of G.players.values()){
      const qx=x+(i%5-2)*2.2,qz=z+3+Math.floor(i/5)*2.2;
      Object.assign(q,{x:qx,tx:qx,y,ty:y,z:qz,tz:qz,ry:Math.PI,mv:true});i++;}};
  });
  const results=physicsOnly?await page.evaluate(()=>({players:window.__G.players.size+1,graphics:{...window.__GFX},overflow:[],captures:[],colorAttributes:[],sections:window.__RACE_S.map(s=>s.n)})):await page.evaluate(()=>{
    const W=window,G=W.__G,P=W.__PL,R=W.__R,Y=W.__MINI().Y;
    const stages=[{name:'start',x:0,z:18,y:Y},{name:'middle',...(()=>{const p=W.__RACE_P().find(p=>p.cp===4);return{x:p.x,z:p.z,y:Y+p.y};})()},
      {name:'finish',...(()=>{const p=W.__RACE_P().find(p=>p.fin);return{x:p.x,z:p.z,y:Y+p.y};})()}];
    if(W.__race74)for(let sec=0;sec<7;sec++){
      const choices=W.__RACE_P().filter(p=>p.sec===sec&&!p.cp&&!p.fin),p=choices[Math.floor(choices.length/2)];
      stages.push({name:'section-'+(sec+1),x:p.x,z:p.z,y:W.__race74.surface(p,p.x,p.z),detail:true});
    }
    const captures=[],timing=[],overflow=[];
    for(const stage of stages){
      Object.assign(P,{x:stage.x,y:stage.y,z:stage.z,vx:0,vz:0,vy:0,ground:true,down:false,mv:false,yaw:Math.PI,pitch:-.22});
      W.__crowdAt(stage.x,stage.z,stage.y);
      if(stage.detail)for(const q of G.players.values()){const y=W.__raceTopAt(q.x,q.z);if(y>Y-10){q.y=y;q.ty=y;}}
      W.__MINE.fin=stage.name==='finish'?999:-1;
      for(let i=0;i<(stage.detail?45:150);i++){
        P.x=stage.x;P.y=stage.y;P.z=stage.z;P.vy=0;P.ground=true;
        const t=W.__realNow();W.__advance(1000/60);if(i>=30&&!stage.detail)timing.push(W.__realNow()-t);
      }
      if(stage.detail){R.info.autoReset=false;R.info.reset();W.__drawFrame();
        captures.push({name:'play-'+stage.name,png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length});}
      // Camera deliberately identical relative to the player for before/after art comparison.
      W.__cam.position.set(stage.x+8,stage.y+7,stage.z-12);W.__cam.lookAt(stage.x,stage.y+1,stage.z+15);
      R.info.autoReset=false;R.info.reset();W.__drawFrame();
      captures.push({name:stage.name,png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length,...W.__race74?{raceArt:{...W.__race74.art().stats}}:{}});
    }
    const longCourse=W.__RACE_Z_FIN>400;
    let oldZ,flags;
    if(longCourse&&W.__race74?.draw){const A=W.__race74.art();oldZ=P.z;flags=A.static.map(s=>s.always);
      // Debug overview only: remove distance culling for this one photograph.
      A.static.forEach(s=>s.always=true);P.z=NaN;W.__race74.draw();
      A.static.forEach(s=>{s.mesh.geometry.setDrawRange(0,Infinity);s.mesh.visible=true;});
    }
    W.__cam.position.set(longCourse?220:75,Y+(longCourse?210:125),longCourse?W.__RACE_Z_FIN*.45:155);
    W.__cam.lookAt(0,Y,longCourse?W.__RACE_Z_FIN*.5:185);R.info.reset();W.__drawFrame();
    captures.push({name:'overview',png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length});
    if(flags){P.z=oldZ;W.__race74.art().static.forEach((s,i)=>s.always=flags[i]);W.__race74.draw();}
    W.__scene.traverse(m=>{if(m.isInstancedMesh&&m.count>m.instanceMatrix.count)overflow.push({name:m.name,id:m.id,used:m.count,capacity:m.instanceMatrix.count});});
    timing.sort((a,b)=>a-b);
    const colorAttributes=W.__race74?[...['pad','padTrim','bar','ball','metal','cap','jump','rock'].filter(key=>W.__race74.art()[key]).map(key=>{const m=W.__race74.art()[key],c=m.geometry.attributes.color;return {key,vertexColors:m.material.vertexColors,valid:!!c&&c.count===m.geometry.attributes.position.count&&c.array.every(Number.isFinite)&&c.array.some(v=>v>0)};})]:[];
    return {seed:G.mini.seed,players:G.players.size+1,graphics:{...W.__GFX,width:R.domElement.width,height:R.domElement.height},cpuMs:{p50:timing[Math.floor(timing.length*.5)],p95:timing[Math.floor(timing.length*.95)],samples:timing.length},overflow,captures,colorAttributes,sections:W.__RACE_S.map(s=>s.n),platformCount:W.__RACE_P().length,renderer:R.getContext().getParameter(R.getContext().RENDERER)};
  });
  if(!baseline&&!physicsOnly)results.airCaptures=await page.evaluate(()=>{
    const W=window,A=W.__race74,P=W.__PL,G=W.__G,Y=W.__MINI().Y,pad=W.__RACE_P().find(p=>p.kind==='final'),shots=[];
    G.players.clear();W.__pcMap.clear();for(const k of Object.keys(W.__KEY))delete W.__KEY[k];W.__KEY.w=true;
    A.reset();const S=W.__RACE();S.t=0;S.on=true;S.fallT=S.hitCd=S.slipT=0;G.t=W.__MINI().RACE;W.__MINE.fin=-1;
    Object.assign(P,{x:pad.x,z:pad.z-6,y:Y+pad.y,vx:0,vz:0,vy:0,ground:true,down:false,jumps:0,flipT:99,yaw:Math.PI,pitch:-.22,_px:pad.x,_pz:pad.z-6});
    let air=false,landWait=-1;const got=new Set();
    const shot=name=>{W.__drawFrame();shots.push({name,png:W.__R.domElement.toDataURL('image/png'),y:P.y-Y,vy:P.vy,ground:P.ground,flight:A.state.flight,fov:W.__cam.fov,yaw:P.yaw,pitch:P.pitch});got.add(name);};
    for(let f=0;f<240;f++){
      G.t-=1/60;W.__advance(1000/60);
      if(A.state.pending&&!got.has('compression'))shot('compression');
      if(A.state.flight>.25&&P.vy>3&&!got.has('ascent'))shot('ascent');
      if(A.state.flight>.4&&Math.abs(P.vy)<.5&&!got.has('apex'))shot('apex');
      if(!P.ground&&A.state.flight>0)air=true;
      if(air&&P.ground&&landWait<0)landWait=3;
      if(landWait>=0&&--landWait===0){shot('landing');break;}
    }
    for(const k of Object.keys(W.__KEY))delete W.__KEY[k];return shots;
  });
  if(!baseline&&!captureOnly)results.physics=await page.evaluate(race76Physics);
  for(const c of results.captures){fs.writeFileSync(path.join(out,`${label}-${c.name}.png`),Buffer.from(c.png.split(',')[1],'base64'));delete c.png;}
  for(const c of results.airCaptures||[]){fs.writeFileSync(path.join(out,`${label}-air-${c.name}.png`),Buffer.from(c.png.split(',')[1],'base64'));delete c.png;}
  fs.writeFileSync(path.join(out,`${label}${captureOnly?'-captures':''}.json`),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
  assert.equal(results.players,21);assert.deepEqual(results.overflow,[]);assert.deepEqual(errors,[]);
  assert.equal(results.sections.length,7);assert.equal(results.graphics.pr,.85);
  assert.ok(results.colorAttributes.every(c=>!c.vertexColors||c.valid),'Dynamic geometry must supply colors to vertex-colored materials');
  assert.ok(results.captures.every(c=>!c.raceArt||(c.raceArt.materials<=3&&c.raceArt.textures<=2&&c.raceArt.visibleDraws<=12&&c.raceArt.overflow===0)),'Race art stays inside its material, texture and draw budgets');
  if(results.airCaptures){assert.deepEqual(results.airCaptures.map(c=>c.name),['compression','ascent','apex','landing']);
    assert.ok(results.airCaptures.every(c=>Number.isFinite(c.fov)&&c.fov<=76.01),'Spring speed FOV stays within six degrees without sprint or jump kick');}
  if(results.physics)validateRace76(results.physics);
  console.log(`PASS: ${label} 21 avatars, all sections present, bounded instance capacity, unchanged mid preset`);
} finally { await browser?.close();await new Promise(r=>server.close(r)); }
