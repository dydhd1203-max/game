// Sequential hidden-browser art review. Fixed 21-avatar budget cameras compare
// the real shipped78 and current source; merchant detail cameras are explicitly
// supplemental probes, and donut entry uses the normal player camera.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),baseline=process.argv[3];assert.ok(baseline,'Pass baseline78.html');
const out=path.resolve('artifacts/race79/world-art');fs.mkdirSync(out,{recursive:true});const errors=[],results=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 for(const [label,target]of [['before',baseline],['after',file]]){
  const server=serve(20579,path.resolve(target));let page;
  try{
   page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push({label,message:e.message}));
   page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|aMt 없는/i.test(m.text()))errors.push({label,message:m.text()});});
   await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   await page.addInitScript(()=>{
    const now=performance.now.bind(performance);let time=null,seed=79314;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    window.__realNow79=now;window.__freeze79=()=>{time=100000;};window.__advance79=ms=>{time+=ms;window.__loop73();};
    performance.now=()=>time===null?now():time;const raf=requestAnimationFrame.bind(window);window.__nativeRaf79=raf;requestAnimationFrame=f=>time===null?raf(f):0;
    localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','art79-review');
   });
   await page.goto('http://127.0.0.1:20579/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
   await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
   await page.evaluate(()=>{const W=window,G=W.__G;document.getElementById('iName').value='미술 검수';document.getElementById('bSolo').click();W.__introDone();
    document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freeze79();W.__DBG().noRender=true;G.phase='day';G.t=100000;G.paused=false;G.host=false;
    W.__XP.job=-1;W.__XP.jt=0;W.__setSky(0);W.__updSky(0,true);W.__step79=n=>{for(let i=0;i<n;i++)W.__advance79(1000/60);};
    for(let i=0;i<20;i++){const id='artfriend'+i,x=(i%5-2)*1.35,z=-1-Math.floor(i/5)*1.4;
     G.players.set(id,{uid:id,x,z,y:W.__GY,tx:x,tz:z,ty:W.__GY,ry:Math.PI,g:i%5,n:'친구'+(i+1),mv:false,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});
    }
   });
   const shots=[];
   const shot=async name=>{
    const data=await page.evaluate(name=>{const W=window,R=W.__R;W.__drawFrame();const lights=[];W.__scene.traverse(x=>{if(x.isLight)lights.push(x.type);});
     return {name,png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length,
      camera:{x:W.__cam.position.x,y:W.__cam.position.y,z:W.__cam.position.z,fov:W.__cam.fov},player:{x:W.__PL.x,y:W.__PL.y,z:W.__PL.z,ground:W.__PL.ground,vy:W.__PL.vy},quality:{...W.__GFX},players:W.__G.players.size+1,lights,
      race:W.__raceOn()?{...W.__race74.art().stats}:null,
      npc:W.__NPCS().map(n=>({type:n.kind||n.type,x:n.x,z:n.z})),
      banks:[...W.__banks].filter(([k])=>/shop|vet|forge/.test(k)).map(([k,b])=>({key:k,instances:b.ms.length,triangles:(b.geo.index?.count||b.geo.attributes.position.count)/3,material:b.mat.uuid}))};
    },name);
    fs.writeFileSync(path.join(out,`${label}-${name}.png`),Buffer.from(data.png.split(',')[1],'base64'));delete data.png;shots.push(data);console.log(`${label} ${name}: ${data.calls} calls ${data.triangles} triangles`);
   };
   await page.evaluate(()=>{const W=window,P=W.__PL;Object.assign(P,{x:0,z:-17,y:W.__GY,vx:0,vy:0,vz:0,ground:true,_px:0,_pz:-17,yaw:Math.PI,pitch:-.22});W.__step79(45);W.__cam.position.set(22,W.__GY+17,-25);W.__cam.lookAt(0,W.__GY+1,0);W.__cam.updateMatrixWorld(true);});
   await shot('village-budget');
   if(label==='after')for(const name of ['shop','vet','forge']){
    await page.evaluate(name=>{const W=window,P=W.__PL,n=name==='forge'?W.__FORGE():W.__SHOP(),a=n.a;
     let x=n.x,z=n.z;if(name==='vet'){const v=W.__NPCS()[2];x=v.x;z=v.z;}
     const d=name==='forge'?4.5:3.6,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
     Object.assign(P,{x:px,z:pz,y:W.__GY,vx:0,vy:0,vz:0,ground:true,_px:px,_pz:pz,yaw:Math.atan2(Math.cos(a),Math.sin(a)),pitch:-.02});W.__camZoom(1.4);W.__step79(70);
     W.__setSky(0);W.__updSky(0,true);
    },name);await shot(name+'-player');
    await page.evaluate(name=>{const W=window,n=name==='forge'?W.__FORGE():W.__SHOP(),a=n.a;let x=n.x,z=n.z;if(name==='vet'){const v=W.__NPCS()[2];x=v.x;z=v.z;}
     W.__cam.position.set(x+Math.cos(a)*3.4+Math.sin(a)*.45,W.__GY+1.65,z+Math.sin(a)*3.4-Math.cos(a)*.45);W.__cam.lookAt(x,W.__GY+1.4,z-.01);W.__cam.updateMatrixWorld(true);
    },name);await shot(name+'-detail');
   }
   await page.evaluate(()=>{const W=window,G=W.__G;G.phase='mini';G.t=180;G.mini={k:0,st:'intro',seed:740021,sc:[0,0,0,0,0],rank:null};W.__miniEnter();G.mini.st='run';G.t=180;W.__race74.reset();Object.assign(W.__RACE(),{t:0,on:true,fallT:0,hitCd:2,slipT:0});W.__MINE.cp=3;W.__MINE.fin=-1;
    const p=W.__RACE_P().find(p=>p.sec===2&&p.bounce),P=W.__PL,Y=W.__MINI().Y;W.__donut79=p;
    Object.assign(P,{x:p.x,z:p.z-p.d*.47,y:Y+p.y,vx:0,vy:0,vz:0,ground:true,jumps:0,_px:p.x,_pz:p.z-p.d*.47,yaw:Math.PI,pitch:-.22});W.__camZoom(3.2);
    let i=0;for(const q of G.players.values()){const x=p.x+(i%5-2)*1.3,z=p.z-p.d*.48-Math.floor(i/5)*1.4;i++;Object.assign(q,{x,tx:x,z,tz:z,y:Y+p.y,ty:Y+p.y});}
    W.__step79(55);
   });await shot('donut-player');
   await page.evaluate(()=>{const W=window,Y=W.__MINI().Y;W.__cam.position.set(20,Y+24,211);W.__cam.lookAt(-3,Y+2,260);W.__cam.updateMatrixWorld(true);});await shot('donut-budget');
   if(label==='after'){
    await page.evaluate(()=>{const W=window,P=W.__PL,p=W.__donut79,Y=W.__MINI().Y,j=W.__race74.jumpPose(p,W.__RACE().t);W.__race74.reset();W.__RACE().hitCd=0;
     Object.assign(P,{x:j.x,z:j.z,y:Y+p.y,vx:0,vy:0,vz:0,ground:true,jumps:0,_px:j.x,_pz:j.z,yaw:Math.PI,pitch:-.22});W.__step79(30);W.__KEY[' ']=true;W.__wantJump();W.__step79(1);W.__KEY[' ']=false;W.__step79(40);
     if(P.ground||P.y<Y+p.y+12)throw new Error('Donut flight capture must show an actual manual launch');
    });await shot('donut-flight');
    await page.evaluate(()=>{const W=window,p=W.__donut79,Y=W.__MINI().Y;W.__cam.position.set(p.x+1.9,Y+4,p.z-9.8);W.__cam.lookAt(p.x,Y+2,p.z);W.__cam.updateMatrixWorld(true);});await shot('donut-pastries-detail');
    await page.evaluate(()=>{const W=window,P=W.__PL,A=W.__race74,R=W.__RACE(),Y=W.__MINI().Y;A.reset();Object.assign(R,{t:2,hitCd:0,slipT:0,fallT:0});W.__MINE.cp=1;
     const h=W.__raceHazards(R.t).find(h=>h.k==='bar'),ca=Math.cos(h.ang),sa=Math.sin(h.ang),x=h.x+ca*7+sa*1.5,z=h.z-sa*7+ca*1.5;
     Object.assign(P,{x,z,y:Y,vx:0,vy:0,vz:0,ground:true,jumps:0,_px:x,_pz:z,yaw:Math.PI,pitch:-.18});W.__camZoom(3.2);A.state.prevTime=-999;
     A.after(1/120);if(P.ground||P.vy<10)throw new Error('Candy contact must throw the avatar');W.__step79(9);
     if(P.ground||P.y<Y+.5)throw new Error('Candy impact capture must remain airborne');
    });await shot('candy-impact');
   }
   results.push({label,shots});
  }finally{await page?.close();await new Promise(r=>server.close(r));}
 }
 const compared=['village-budget','donut-budget'].map(name=>{
  const before=results[0].shots.find(s=>s.name===name),after=results[1].shots.find(s=>s.name===name);
  assert.deepEqual(after.camera,before.camera);assert.deepEqual(after.quality,before.quality);assert.deepEqual(after.lights,before.lights);assert.equal(after.players,21);
  return {name,calls:[before.calls,after.calls],triangles:[before.triangles,after.triangles],memory:[before.memory,after.memory],race:[before.race,after.race]};
 });
 fs.writeFileSync(path.join(out,'view.json'),JSON.stringify({sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),baseline,results,compared,errors},null,2));assert.deepEqual(errors,[]);
 console.log(JSON.stringify(compared,null,2));console.log('PASS captured real geometry and fixed-quality 21-avatar budgets; PNG beauty requires direct inspection.');
}finally{await browser?.close();}
