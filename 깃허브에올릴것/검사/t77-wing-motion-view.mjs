// Actual game wing shader/matrices with a fixed diagnostic camera. No OS input.
import fs from 'node:fs';import path from 'node:path';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const finalOnly=process.argv.includes('--final');
const out=path.resolve(process.argv[3]||'artifacts/77-wing-motion');fs.mkdirSync(out,{recursive:true});
const server=serve(0,process.argv[2]||GAME),results=[],images=[],errors=[];let browser;
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
try{
 await new Promise(r=>server.once('listening',r));browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:960,height:680}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GL_INVALID/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),ids=new Set();
  window.requestAnimationFrame=cb=>{if(window.__wingFrozen)return 0;const id=raf(t=>{ids.delete(id);cb(t);});ids.add(id);return id;};
  window.__freezeWing=()=>{window.__wingFrozen=true;for(const id of ids)cancel(id);ids.clear();};localStorage.setItem('sndOn','0');});
 await page.goto(`http://127.0.0.1:${server.address().port}/?gfx=mid`,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__READY===true,null,{timeout:120000});
 await page.evaluate(()=>{document.getElementById('iName').value='날개 모션 검사';document.getElementById('bSolo').click();});
 await page.waitForFunction(()=>window.__G.started);
 await page.evaluate(()=>{
  const W=window;W.__introDone();W.__freezeWing();W.__DBG().noLogic=true;W.__G.paused=false;W.__G.phase='day';W.__G.mini=null;W.__G.players.clear();W.__setAim(false);W.__clear();
  document.querySelectorAll('body > :not(canvas):not(#app)').forEach(e=>e.style.display='none');
  const label=document.createElement('div');label.id='wingLabel';label.style.cssText='position:fixed;left:18px;top:16px;padding:12px 18px;border-radius:14px;background:#fffbeded;color:#23424d;font:700 19px sans-serif;z-index:99999';document.body.append(label);
  let spot;outer:for(let z=-27;z<=27;z+=3)for(let x=-27;x<=27;x+=3){if(Math.hypot(x,z)<12)continue;const y=W.__groundUnder(x,z,.28);
   if(y!==W.__GY)continue;if((W.__NODES||[]).some(n=>n.alive!==false&&Math.hypot(n.x-x,n.z-z)<4.5))continue;
   if([[0,0],[3,0],[-3,0],[0,3],[0,-3]].every(([dx,dz])=>Math.abs(W.__groundUnder(x+dx,z+dz,.28)-y)<.05)){spot={x,y,z};break outer;}}
  if(!spot)throw Error('No unobstructed wing inspection position');
  W.__wingView={spot,actor:{...spot,ry:Math.PI,g:2,ph:0,wp:0,we:0,hat:0,clo:0,gls:0,jb:0,jt:1,me:true,mv:false,air:true,vy:1}};
  W.__setSky(0);W.__updSky(0,false);W.__R.shadowMap.needsUpdate=true;
 });
 const samples=[];for(const tier of [1,2])for(const cycle of [0,.2,.4,.57,.72,.9])samples.push({tier,cycle,name:`tier${tier}-flap-${Math.round(cycle*100).toString().padStart(2,'0')}`,label:`${tier}차 날개 · 날갯짓 ${Math.round(cycle*100)}%`,state:'flap'});
 for(const state of ['idle','sprint','takeoff','landing','bank-left','bank-right','aim','down'])samples.push({tier:2,cycle:.2,name:`tier2-${state}`,label:`2차 날개 · ${state}`,state});
 for(const sample of samples.filter(s=>!finalOnly||['tier2-flap-20','tier2-flap-72','tier2-bank-left'].includes(s.name))){
  const r=await page.evaluate(sample=>{
   const W=window,V=W.__wingView,A=V.actor,S=V.spot,t=(40+sample.cycle)/1.75,air=!['idle','sprint','landing','aim','down'].includes(sample.state);
   Object.assign(A,{...S,y:S.y+(air?2.4:0),ry:Math.PI,jt:sample.tier,air,glide:sample.state.startsWith('bank'),run:sample.state==='sprint',mv:sample.state==='sprint',aim:sample.state==='aim',down:sample.state==='down',take:sample.state==='takeoff'?.12:0,land:sample.state==='landing'?.22:0});
   for(let i=0;i<60;i++){
    const u=i/60;A.ry=Math.PI+(sample.state==='bank-left'?-1:sample.state==='bank-right'?1:0)*u*.9;
    if(A.run)A.x=S.x+(u-.5)*2;
    W.__drawSheep([A],t-(59-i)/60,40,s=>W.__GHEX[s.g],W.__avatarRender().scale);
   }
   // Follow the actor's heading so left/right bank can be compared at the same angle.
   const yaw=A.ry-Math.PI,dx=2.3*Math.cos(yaw)-4.8*Math.sin(yaw),dz=-2.3*Math.sin(yaw)-4.8*Math.cos(yaw);
   W.__cam.position.set(A.x+dx,A.y+2.4,A.z+dz);W.__cam.lookAt(A.x,A.y+.85,A.z);W.__cam.updateMatrixWorld(true);
   document.getElementById('wingLabel').textContent=sample.label+' · 실제 게임 렌더 / 모션 진단';W.__drawFrame();
   const mesh=W.__P_wing()[sample.tier-1],f=mesh.geometry.attributes.wflex.array,m=new W.__THREE.Matrix4(),mat=[];
   for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);mat.push(...m.elements);}
   return {count:mesh.count,flex:Array.from(f.slice(0,8)),finite:mat.every(Number.isFinite),triangles:W.__R.info.render.triangles,tip:A.wtip?Array.from(A.wtip):null,shaderPrograms:W.__R.info.programs?.length,ring:W.__P_jobR().count,ringVisible:W.__P_jobR().visible};
  },sample);
  check(sample.name+' renders both real shader-deformed wings without a following ring',r.count===2&&r.finite&&r.triangles>1000&&r.flex.every(Number.isFinite)&&r.ring===0&&!r.ringVisible,r);
  const file=sample.name+'.png';await page.screenshot({path:path.join(out,file)});images.push({...sample,file});
 }
 check('Actual WebGL scene has no page/shader errors',errors.length===0,errors);
}catch(e){check('Harness completed',false,{message:e.message,stack:e.stack});}
finally{await browser?.close();await new Promise(r=>server.close(r));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,images,errors},null,2));
 fs.writeFileSync(path.join(out,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>날개 모션 검수</title><style>body{background:#e9f0ef;color:#24434d;font:16px sans-serif;padding:20px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}figure{margin:0;background:white;padding:8px;border-radius:12px}img{width:100%}figcaption{padding:8px}</style><h1>77차 실제 날개 모션</h1><p>실제 게임 기하와 관절 셰이더. 고정 진단 카메라에서 날갯짓 한 주기 및 상태 전이를 확인합니다.</p><main>${images.map(s=>`<figure><img src="${s.file}"><figcaption>${s.label}</figcaption></figure>`).join('')}</main>`);
}
console.log(`${results.filter(r=>r.pass).length}/${results.length} wing render checks passed; ${images.length} images in ${out}`);process.exitCode=results.some(r=>!r.pass)?1:0;
