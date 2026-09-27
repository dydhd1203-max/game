// Real game tower-only control vs current. Both worlds use the same 77 code,
// seed, 21 avatars and normal player camera; only tower changes are restored.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),baseline=process.argv[3];assert.ok(baseline,'Pass saved baseline76.html');
const current=fs.readFileSync(file,'utf8'),old=fs.readFileSync(baseline,'utf8'),final=process.argv.includes('--final'),out=path.resolve('artifacts/tower77');fs.mkdirSync(out,{recursive:true});
const fn=(s,n)=>{const i=s.indexOf('function '+n+'('),e=s.indexOf('\n}',i);assert.ok(i>=0&&e>i,n);return s.slice(i,e+2);};
let control=current;for(const n of ['blocksOfRaw','buildingGunMuzzle','towerAttack','towerFxShot','updOrbs'])control=control.replace(fn(current,n),fn(old,n));
const files={before:path.join(out,'tower76-control.html'),after:path.join(out,'tower77-current.html')};fs.writeFileSync(files.before,final?old:control);fs.writeFileSync(files.after,current);
const budget=process.argv.includes('--budget'),art=process.argv.includes('--art'),arrowDetail=process.argv.includes('--arrow'),detail=process.argv.includes('--detail')||arrowDetail||art||budget,results=[],errors=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 for(const label of detail?['after']:['before','after']){
  const server=serve(20578,files[label]);let page;
  try{
   page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push({label,message:e.message}));
   page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push({label,message:m.text()});});
   await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   await page.addInitScript(()=>{const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null,seed=77137;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    window.__realNow=real;window.__freeze=()=>{time=100000;};window.__advance=ms=>{time+=ms;window.__loop73();};performance.now=()=>time===null?real():time;requestAnimationFrame=f=>time===null?raf(f):0;
    localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','tower77-review');});
   await page.goto('http://127.0.0.1:20578/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
   await page.evaluate(()=>{const W=window,G=W.__G;document.getElementById('iName').value='포탑 검수';document.getElementById('bSolo').click();W.__introDone();
    document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freeze();W.__DBG().noRender=true;G.phase='day';G.t=100000;G.paused=false;G.host=false;
    W.__XP.job=-1;W.__XP.jt=0;W.__setSky(0);W.__updSky(0,true);
    for(let i=0;i<20;i++){const id='towerfriend'+i,x=1+(i%5)*2,z=5+Math.floor(i/5)*2;G.players.set(id,{uid:id,x,z,y:W.__GY,tx:x,tz:z,ty:W.__GY,ry:0,g:i%5,n:'친구'+(i+1),mv:false,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});}
    W.__towerStep=frames=>{for(let i=0;i<frames;i++)W.__advance(1000/60);};
   });
   const shots=[];
   for(const name of budget?['mixed','arrow','stress']:art?['ice-close','arrow','ice-far','arrow-far']:arrowDetail?['arrow']:detail?['ice-blizzard','ice-frost','arrow']:final?['mixed','ice-close','ice-blizzard','arrow','pulse','stress']:['mixed','ice-close','ice-blizzard','ice-frost','arrow','pulse','stress']){
    await page.evaluate(({name,art})=>{const W=window,G=W.__G,P=W.__PL;W.__towerStep(90);G.wolves.length=0;W.__STRU.clear();
     const cards=name==='mixed'?['arrow','ice','pulse'].map((t,i)=>({t,x:6+i*4,z:14,lv:1,g:0})):
      name==='stress'?Array.from({length:21},(_,i)=>({t:['arrow','ice','pulse'][i%3],x:2+i%7*3,z:14+Math.floor(i/7)*3,lv:i%7+1,g:i%5})):
      [{t:name.startsWith('arrow')?'arrow':name==='pulse'?'pulse':'ice',lv:name==='ice-blizzard'||name==='ice-frost'?7:1,x:10,z:14,g:0,branch:name==='ice-blizzard'?'blizzard':name==='ice-frost'?'frost':''}];
     for(const [i,c] of cards.entries()){const o={id:'tower'+i,...c,hp:100,mx:100,n:''};W.__STRU.set(o.id,o);if(art){o.testTarget={x:c.x+1,z:c.z+7,y:W.__GY,hp:9999};continue;}W.__spawnWolf(0,0,c.x+1,c.z+7);const w=G.wolves.at(-1);Object.assign(w,{x:c.x+1,z:c.z+7,y:W.__GY,hp:9999,mx:9999,spd:0,mv:false});o.testTarget=w;}
     W.__rebuild();W.__testTowers=[...W.__STRU.values()];
     // Stand on the target-facing side; this ordinary player view sees each real muzzle and the approaching shot.
     const far=name.endsWith('-far'),high=name==='ice-blizzard'||name==='ice-frost',x=far?17:name==='arrow'?15:name==='stress'?11:name==='mixed'?11:12,z=far?25.4:name==='arrow'?19:name==='stress'?29:name==='mixed'?23:high?20:18;
     Object.assign(P,{x,z,y:W.__GY,vx:0,vz:0,vy:0,ground:true,down:false,mv:false,_px:x,_pz:z,yaw:name==='mixed'||name==='stress'?0:Math.atan2(x-11,z-15),pitch:name==='stress'?-.25:name==='mixed'?-.10:.04});
     W.__camZoom(name==='stress'?8:name==='mixed'?3.2:1.4);W.__towerStep(60);W.__setSky(0);W.__updSky(0,true);
    },{name,art});
    for(const phase of budget?['firing']:art?['idle']:final?['idle','firing']:['idle','firing','impact']){
     const shot=await page.evaluate(({name,phase,detail,final,budget})=>{const W=window,R=W.__R,T=W.__THREE;
      if(phase==='firing'){for(const o of W.__testTowers)W.__towerFx.attack(o,o.testTarget,false);W.__towerStep(detail&&!budget?2:6);}
      if(phase==='impact')W.__towerStep(40);
      const banks=[];for(const [key,m]of W.__struMeshes){if(!m.count)continue;banks.push({key,count:m.count,triangles:(m.geometry.index?.count||m.geometry.attributes.position.count)/3,vertexColors:m.material.vertexColors,transparent:m.material.transparent,map:!!m.material.map,texture:m.material.map?{id:m.material.map.uuid,width:m.material.map.image.width,height:m.material.map.image.height,kind:m.material.map.userData.kind,anisotropy:m.material.map.anisotropy,minFilter:m.material.map.minFilter}:null});}
      const pools=Object.fromEntries(Object.entries({ice:W.__fx().ice,arrow:W.__fx().arrow,balls:W.__towerFx.balls(),chips:W.__towerFx.chips(),shells:W.__towerFx.shells()}).map(([key,m])=>[key,{visible:m.visible,capacity:m.instanceMatrix.count,count:m.count}]));
      const lights=[];W.__scene.traverse(x=>{if(x.isLight)lights.push(x.type);});
      let timing=null;if((final?name==='stress':name==='mixed'||name==='stress')&&phase==='firing'){
       const submit=[],wall=[],gl=R.getContext(),warm=final?2:8,frames=final?10:28;for(let i=0;i<frames;i++){const t=W.__realNow();W.__drawFrame();const s=W.__realNow();gl.finish();const e=W.__realNow();if(i>=warm){submit.push(s-t);wall.push(e-t);}}
       const metric=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],min:a[0],max:a.at(-1)};};timing={samples:submit.length,submissionMs:metric(submit),renderAndFinishMs:metric(wall),renderer:gl.getParameter(gl.RENDERER)};
      }
      W.__drawFrame();const png=R.domElement.toDataURL('image/png');
      return {name,phase,png,calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length,
       quality:{...W.__GFX},players:W.__G.players.size+1,banks,pools,lights,timing,camera:{x:W.__cam.position.x,y:W.__cam.position.y,z:W.__cam.position.z,fov:W.__cam.fov},
       towers:W.__testTowers.map(o=>({t:o.t,lv:o.lv,branch:o.branch||'',gunParts:o._gunParts.length,muzzle:W.__towerFx.muzzle(o),kick:o.gunKick||0}))};
     },{name,phase,detail,final,budget});
     fs.writeFileSync(path.join(out,`${label}-${name}-${phase}.png`),Buffer.from(shot.png.split(',')[1],'base64'));delete shot.png;shots.push(shot);
     console.log(`${label} ${name} ${phase}: ${shot.calls} calls, ${shot.triangles} tris`);
    }
   }
   results.push({label,shots});
  }finally{await page?.close();await new Promise(r=>server.close(r));}
 }
 if(detail){assert.deepEqual(errors,[]);if(budget)for(const q of results[0].shots){const roofs=q.banks.filter(b=>b.key.includes('towerRoof'));assert.ok(roofs.length>0&&roofs.every(b=>!/[RL]$/.test(b.key)),'Roof halves share a canonical per-team bank');assert.equal(q.players,21);}
  fs.writeFileSync(path.join(out,budget?'view-budget.json':art?'view-art.json':arrowDetail?'view-arrow-detail.json':'view-detail.json'),JSON.stringify({results,errors},null,2));console.log(budget?'PASS 21-player tower budget capture and shared roof banks':'PASS tower full-height detail captures');}
 else {
 fs.writeFileSync(path.join(out,'view-probe.json'),JSON.stringify({results,errors},null,2));
 const compared=results[0].shots.map((before,i)=>{const after=results[1].shots[i];assert.deepEqual(after.quality,before.quality,'Full quality unchanged');assert.equal(after.players,21);
  assert.deepEqual(after.camera,before.camera,'Same normal player camera');assert.deepEqual(after.lights,before.lights,'No new lights');assert.ok(after.memory.textures<=before.memory.textures+1,'At most one new shared frost texture');
  for(const k of Object.keys(after.pools))assert.equal(after.pools[k].capacity,before.pools[k].capacity,'No new particle/projectile capacity');
  const extra=after.name==='stress'?10:after.name==='ice-blizzard'||after.name==='ice-frost'?2:0;
  assert.ok(after.calls<=before.calls+extra,'At most one extra crystal bank per visible team including shadow draw');
  if(after.name.startsWith('ice')||after.name==='stress')assert.ok(after.triangles<before.triangles,'Crystal geometry must reduce actual rendered triangles');
  const frostBanks=after.banks.filter(b=>b.texture?.kind==='towerFrost77');assert.ok(new Set(frostBanks.map(b=>b.texture.id)).size<=1,'All ice surfaces share one texture');
  for(const b of frostBanks)assert.ok(b.vertexColors&&!b.transparent&&b.texture.width===256&&b.texture.height===256&&b.texture.anisotropy===4,'One opaque mipmapped frost atlas');
  if(after.phase==='firing'&&['arrow','ice-close','pulse'].includes(after.name))assert.ok(after.pools[after.name==='ice-close'?'ice':after.name==='pulse'?'shells':'arrow'].visible,'Actual attack projectile is rendered');
  if(after.name==='arrow')assert.equal(after.towers[0].gunParts,6,'Basic bow exposes its stock, limbs and two taut strings');
  return {name:after.name,phase:after.phase,calls:[before.calls,after.calls],triangles:[before.triangles,after.triangles],memory:[before.memory,after.memory]};});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'view.json'),JSON.stringify({sourceSha256:crypto.createHash('sha256').update(current).digest('hex'),baseline,control:final?'Actual full saved build 76 versus current, identical controlled player/tower/camera fixture':'Current source, only tower functions restored from saved build 76',results,compared,errors},null,2));
 console.log(JSON.stringify({compared,errors},null,2));console.log('PASS actual 21-player tower scenes, fixed quality, lights, textures and bounded effects');
 }
}finally{await browser?.close();}
