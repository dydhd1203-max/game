// Hidden real-game hit/arrival/guest checks. Pose detail cameras are diagnostic,
// not presented as ordinary gameplay shots or measured hardware FPS.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),out=path.resolve('artifacts/race79/hit-feedback');fs.mkdirSync(out,{recursive:true});
const server=serve(20609,file),errors=[],checks=[],shots=[];let browser;
const check=(name,pass,data)=>{checks.push({name,pass:!!pass,data});console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(data??''));};
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const now=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null;
  window.__freezeHit79=()=>{time=100000;};window.__timeHit79=v=>{time=v*1000;};performance.now=()=>time===null?now():time;requestAnimationFrame=f=>time===null?raf(f):0;
  localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','hit79-review');});
 await page.goto('http://127.0.0.1:20609/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
 await page.evaluate(()=>{const W=window,G=W.__G;document.getElementById('iName').value='피격 검수';document.getElementById('bSolo').click();W.__introDone();document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));
  W.__freezeHit79();W.__DBG().noRender=true;W.__DBG().noSim=true;G.phase='night';G.t=100000;G.host=true;G.paused=false;
  W.__setSky(0);W.__updSky(0,true);W.__hitEvents79=[];window.__sfx=(k,a)=>W.__hitEvents79.push({k,a,t:performance.now()/1000});
  W.__fixtureHit79=(k=0)=>{G.wolves.length=0;W.__WOLF_DEAD.length=0;const P=W.__PL;Object.assign(P,{x:0,y:W.__GY,z:-16,yaw:-Math.PI/2,pitch:0,ground:true,vx:0,vy:0,vz:0});
   const w=W.__spawnWolf(k,0);Object.assign(w,{x:6,z:-16,y:W.__GY,ry:Math.PI,hp:1000,mx:1000,hurt:0,rise:0,riseK0:0,noChase:true,shT:false,mv:false,atkT:0});
   W.__setAim(true,true);W.__camZoom(0);W.__updPlayer(.001);W.__setCrit(0);W.__setThrowCd(0);W.__hitEvents79.length=0;W.__testWolf79=w;return w;};
 });
 const arrivals=await page.evaluate(()=>{const W=window,result=[];
  for(const [kind,wp,crit,hp]of [['stone',0,0,1000],['gun',3,0,1000],['critical',3,1,1000],['lethal',3,0,1]]){
   W.__timeHit79(110+result.length);const w=W.__fixtureHit79();w.hp=hp;W.__KIT.ownW[wp]=true;W.__KIT.ammo=999;W.__equipWeapon(wp);W.__setCrit(crit);W.__setThrowCd(0);
   const aimed=W.__aimWolf(W.__WEAPONS[wp])===w;W.__fireWeapon();const immediate={at:w.hitAt79,hp:w.hp,cues:W.__hitEvents79.map(x=>x.k)};
   if(wp===0){const stone=W.__hit79.stones.find(s=>s.on);if(!stone)throw Error('Actual stone shot must have an arrival callback');const d=stone.d;
    W.__timeHit79(110+result.length+d-.005);W.__hit79.upd(d-.005,110);const before=Number.isFinite(w.hitAt79);
    W.__timeHit79(110+result.length+d+.005);W.__hit79.upd(.01,110);result.push({kind,aimed,immediate,before,after:w.hitAt79,cues:W.__hitEvents79.map(x=>x.k),dead:w.hp<=0,d});
   }else{const bullet=W.__bullets().find(s=>s.on);if(bullet){const d=bullet.L/bullet.sp;W.__timeHit79(110+result.length+d+.005);W.__updBullets(d+.005,110);}
    result.push({kind,aimed,immediate,after:w.hitAt79,cues:W.__hitEvents79.map(x=>x.k),dead:w.hp<=0});}
  }return result;
 });
 check('Actual stone/gun/critical/lethal fireWeapon paths aim, apply damage and emit their arrival cue',arrivals.every(q=>q.aimed&&Number.isFinite(q.after)&&q.cues.includes(q.kind==='lethal'?'kill':q.kind==='critical'?'crit':'hit'))&&arrivals[3].dead,arrivals);
 check('Stone has no early hit pose/sound; the same frame as arrival produces both',!Number.isFinite(arrivals[0].immediate.at)&&!arrivals[0].immediate.cues.includes('hit')&&!arrivals[0].before&&arrivals[0].after>110);
 const guests=await page.evaluate(()=>{const W=window,G=W.__G;const w=W.__fixtureHit79();G.host=false;const id=w.id;
  const packet=hp=>({v:2,c:2000,w:[id,0,48,-128,314,hp,0,1000],s:[]});W.__timeHit79(120);W.__applySim(packet(900));const at=w.hitAt79;
  W.__timeHit79(120.1);W.__applySim(packet(900));const same=at===w.hitAt79;W.__timeHit79(125);W.__drawWolves(G.wolves,4,.016);
  return {at,same,hurt:w.hurt,glow:w.hitGlow79,recoil:w.kT,hp:w.hp};});
 check('Actual guest sync reacts once and returning after five hidden seconds is clean',guests.at===120&&guests.same&&guests.hurt===0&&guests.glow===0&&guests.recoil===0&&guests.hp===900,guests);
 await page.evaluate(()=>{const W=window;W.__G.host=false;
  // Finish the four previous weapon cases using their real effect lifetimes.
  for(let i=0;i<90;i++){W.__timeHit79(126+i/60);W.__loop73();}
  const w=W.__fixtureHit79();Object.assign(w,{x:22,z:-5,lx:22,lz:-5});W.__testWolf79=w;W.__timeHit79(129);
  W.__poseCamera79=()=>{const P=W.__PL;
   Object.assign(P,{x:22,z:-9.5,y:W.__GY,vx:0,vy:0,vz:0,ground:true,_px:22,_pz:-9.5,yaw:Math.PI,pitch:-.06});
   W.__setAim(false,true);W.__camZoom(0);W.__updPlayer(.016);W.__held.visible=false;W.__setGunT(0);
   // Refresh this immediately before every render. Any pending native game RAF
   // between evaluate calls may otherwise restore the old player's camera.
   W.__cam.position.set(22,W.__GY+1.65,-9.5);W.__cam.lookAt(22,W.__GY+1.04,-5);W.__cam.updateMatrixWorld(true);
  };W.__poseCamera79();
  // Compile/load geometry before comparing costs; request the same full shadow
  // pass in every capture instead of comparing one shadow update to cached frames.
  W.__R.shadowMap.autoUpdate=true;for(let i=0;i<3;i++){W.__drawWolves([w],4,.016);W.__R.shadowMap.needsUpdate=true;W.__drawFrame();}
 });
 for(const [name,age]of [['before',-1],['impact',.05],['recoil',.13],['recovered',.65]]){
  const r=await page.evaluate(({name,age})=>{const W=window,w=W.__testWolf79;if(name==='impact'){W.__timeHit79(130);W.__hit79.hit(w,0,1,false);}
   W.__timeHit79(age<0?129:130+age);W.__drawWolves([w],4,.016);W.__poseCamera79();W.__R.shadowMap.needsUpdate=true;W.__drawFrame();const m=W.__wolfMeshes().body,mat=W.__cam.matrixWorld.clone();m.getMatrixAt(0,mat);
   return {name,png:W.__R.domElement.toDataURL('image/png'),glow:w.hitGlow79,recoil:w.kT,hurt:w.hurt,x:w.x,z:w.z,hp:w.hp,body:mat.elements,camera:W.__cam.position.toArray(),calls:W.__R.info.render.calls,triangles:W.__R.info.render.triangles,memory:{...W.__R.info.memory}};
  },{name,age});fs.writeFileSync(path.join(out,'hit-'+name+'.png'),Buffer.from(r.png.split(',')[1],'base64'));delete r.png;shots.push(r);
 }
 check('Actual geometry visibly recoils, restores colour, and never changes zombie coordinates/HP',shots.every(s=>s.x===22&&s.z===-5&&s.hp===1000)&&shots[1].glow>0&&shots[2].glow===0&&shots[2].recoil>0&&shots[3].recoil===0&&shots[3].glow===0&&shots[1].body.some((v,i)=>Math.abs(v-shots[0].body[i])>.04),shots.map(({body,...s})=>s));
 check('Pose-only hit adds no render calls, triangles, geometry or texture',shots.every(s=>s.calls===shots[0].calls&&s.triangles===shots[0].triangles&&s.memory.geometries===shots[0].memory.geometries&&s.memory.textures===shots[0].memory.textures));
 check('Every pose capture is centered 4.5 metres from the target in the open yard',shots.every(s=>s.camera[0]===22&&s.camera[2]===-9.5));
 check('No actual page/WebGL runtime errors',errors.length===0,errors);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
fs.writeFileSync(path.join(out,'view.json'),JSON.stringify({checks,shots,errors},null,2));assert.ok(checks.every(q=>q.pass),'Hit feedback check failed');
