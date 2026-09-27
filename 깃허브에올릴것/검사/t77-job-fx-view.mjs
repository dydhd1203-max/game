// Real game avatar/FX rendering. Includes the actual race third-person camera and a diagnostic close view.
import fs from 'node:fs';import path from 'node:path';import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const finalOnly=process.argv.includes('--final');
const out=path.resolve(process.argv[3]||'artifacts/77-job-fx-view');fs.mkdirSync(out,{recursive:true});
const server=serve(0,process.argv[2]||GAME),results=[],images=[],errors=[];let browser,watchdog;
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
try{
 await new Promise(r=>server.once('listening',r));browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});watchdog=setTimeout(()=>void browser.close(),240000);
 const page=await browser.newPage({viewport:{width:1080,height:720}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|GL_INVALID/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),ids=new Set();
  window.requestAnimationFrame=cb=>{if(window.__fxFrozen)return 0;const id=raf(t=>{ids.delete(id);cb(t);});ids.add(id);return id;};
  window.__freezeFx=()=>{window.__fxFrozen=true;for(const id of ids)cancel(id);ids.clear();};localStorage.setItem('sndOn','0');});
 await page.goto(`http://127.0.0.1:${server.address().port}/?gfx=mid`,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>window.__READY===true,null,{timeout:120000});
 await page.evaluate(()=>{document.getElementById('iName').value='직업 효과 검사';document.getElementById('bSolo').click();});await page.waitForFunction(()=>window.__G.started);
 await page.evaluate(()=>{
  const W=window;W.__introDone?.();W.__freezeFx();W.__DBG().noLogic=true;W.__G.paused=false;W.__G.phase='day';W.__G.mini=null;W.__G.players.clear();W.__setAim(false);W.__clear();
  document.querySelectorAll('body > :not(canvas):not(#app)').forEach(e=>e.style.display='none');
  const label=document.createElement('div');label.id='fxLabel';label.style.cssText='position:fixed;left:18px;top:16px;padding:12px 18px;border-radius:14px;background:#fffbeded;color:#23424d;font:700 19px sans-serif;z-index:99999';document.body.append(label);
  let spot;outer:for(let z=-26;z<=18;z+=3)for(let x=-24;x<=24;x+=3){
   if(Math.hypot(x,z)<12)continue;const y=W.__groundUnder(x,z,.28);if(y!==W.__GY)continue;
   if((W.__NODES||[]).some(n=>n.alive!==false&&Math.hypot(n.x-x,n.z-z-3)<7))continue;
   if([[0,0],[2,0],[-2,0],[0,9],[0,-3],[2,5],[2,9],[-2,5]].every(([dx,dz])=>Math.abs(W.__groundUnder(x+dx,z+dz,.28)-y)<.05&&!W.__buildApi.canPlaceBuilding('wwall',Math.floor(x+dx),Math.floor(z+dz)))){spot={x,y,z};break outer;}
  }
  if(!spot)throw Error('No clear FX inspection path');
  const V=W.__fxView={spot,t:60,actor:null};W.__XP.jt=0;
  V.clear=()=>{const F=W.__wingFx();for(const p of [...F.marks,...F.sp,...F.fe])p.t=0;for(const p of F.job)p.t=-1;W.__wingFxTick(1/60);};
  V.make=(jb,jt,run)=>{V.clear();V.actor={...spot,ry:Math.PI,g:2,ph:0,wp:0,we:0,hat:0,gls:0,clo:0,jb,jt,run,air:false,down:false};return V.actor;};
  V.step=(dt=1/60,motion=true)=>{const s=V.actor;if(motion)s.z+=(s.run?5:2.6)*dt;V.t+=dt;
   W.__drawSheep([s],V.t,40,q=>W.__GHEX[q.g],W.__avatarRender().scale);W.__wingFxPeople([s],dt,V.t);W.__wingFxTick(dt);};
  V.render=(text,normal=false)=>{const s=V.actor;
   if(!normal){W.__cam.position.set(s.x+2.15,s.y+2.1,s.z-3.95);W.__cam.lookAt(s.x,s.y+.5,s.z-.2);W.__cam.updateMatrixWorld(true);}
   W.__setSky(0);W.__updSky(0,false);W.__R.shadowMap.needsUpdate=true;document.getElementById('fxLabel').textContent=text;W.__drawFrame();};
 });
 const capture=async(name,label)=>{const file=name+'.png';await page.screenshot({path:path.join(out,file)});images.push({file,label});};
 for(let jb=0;jb<3;jb++)for(const jt of finalOnly?[2]:[1,2]){
  const result=await page.evaluate(({jb,jt})=>{
   const W=window,V=W.__fxView,F=W.__wingFx();V.make(jb,jt,true);const before=F.markStats.steps;
   for(let i=0;i<110;i++)V.step();const base=F.markStats.steps;
   for(let i=0;i<90&&F.markStats.steps===base;i++)V.step();for(let i=0;i<7;i++)V.step();
   V.render(`${['황금 별','청록 기계선','민트 잎'][jb]} · ${jt}차 달리기 · 실제 발 접지/진단 시점`);
   return {steps:F.markStats.steps-before,live:F.marks.filter(p=>p.t>0).length,banks:F.markMeshes.filter(m=>m.visible).length,ring:W.__P_jobR().count,ringVisible:W.__P_jobR().visible,finite:F.markMeshes.every(m=>Array.from(m.instanceMatrix.array.slice(0,m.count*16)).every(Number.isFinite))};
  },{jb,jt});
  check(`Job ${jb} tier ${jt} running renders real foot FX without a following ring`,result.steps>2&&result.live>0&&result.banks===1&&result.finite&&result.ring===0&&!result.ringVisible,result);
  await capture(`job${jb}-tier${jt}-run`,`${jb}직업 ${jt}차 달리기`);
 }
 for(const jb of finalOnly?[1]:[0,1,2]){
  const idle=await page.evaluate(jb=>{const W=window,V=W.__fxView;V.make(jb,2,false);for(let i=0;i<60;i++)V.step(1/60,false);V.render(`${['황금 별','청록 기계선','민트 잎'][jb]} · 2차 서 있기 · 바닥 고리 없음`);
   return {ring:W.__P_jobR().count,visible:W.__P_jobR().visible,marks:W.__wingFx().marks.filter(p=>p.t>0).length};},jb);
  check(`Job ${jb} idle has no persistent ring or foot trail`,idle.ring===0&&!idle.visible&&idle.marks===0,idle);await capture(`job${jb}-tier2-idle`,'상시 고리 없는 대기');
 }
 if(!finalOnly){await page.evaluate(()=>{const V=window.__fxView;V.make(2,1,false);for(let i=0;i<140;i++)V.step();V.render('1차 탐험가 · 걷기는 작고 짧은 잎 흔적');});
 await capture('job2-tier1-walk','1차 걷기');}
 for(const event of finalOnly?[]:['takeoff','landing']){
  const detail=await page.evaluate(event=>{
   const W=window,V=W.__fxView,F=W.__wingFx();V.make(0,2,true);for(let i=0;i<40;i++)V.step();
   V.actor.air=true;V.actor.y=V.spot.y+.35;V.step(1/60,false);
   if(event==='landing'){for(let i=0;i<20;i++)V.step(1/60,false);V.actor.air=false;V.actor.y=V.spot.y;V.actor.land=.22;V.step(1/60,false);}
   for(let i=0;i<4;i++)V.step(1/60,false);V.render(event==='takeoff'?'도약 · 양발에서 작은 깃과 별':'착지 · 낮게 퍼지는 곡선과 직업 문양');
   return {...F.markStats,feathers:F.fe.filter(p=>p.t>0).length,sparks:F.sp.filter(p=>p.t>0).length};
  },event);
  check(event+' renders one transition',detail[event==='takeoff'?'takeoffs':'landings']>0,detail);await capture(event,event);
 }
 for(const jb of finalOnly?[0,2]:[0,1,2])for(const jt of finalOnly?[2]:[1,2])for(const age of finalOnly?[.62]:[.20,.62,1.05]){
  await page.evaluate(({jb,jt,age})=>{const W=window,V=W.__fxView,s=V.make(jb,jt,false);
   W.__jobUpFx(s.x,s.y,s.z,jb,jt,true);for(let i=0;i<Math.round(age*60);i++)V.step(1/60,false);
   V.render(`${['황금 별','청록 기계선','민트 잎'][jb]} · ${jt}차 전직 ${age.toFixed(2)}초`);
  },{jb,jt,age});await capture(`job${jb}-tier${jt}-promote-${Math.round(age*100)}`,`${jb}직업 ${jt}차 전직 ${age}s`);
 }
 // Twelve consecutive real motion samples can be played in the gallery, without a fabricated tween.
 if(!finalOnly)await page.evaluate(()=>{const V=window.__fxView;V.make(1,2,true);for(let i=0;i<60;i++)V.step();});
 for(let i=0;i<(finalOnly?0:12);i++){
  await page.evaluate(i=>{const V=window.__fxView;for(let k=0;k<5;k++)V.step();V.render(`2차 발명가 · 실제 연속 움직임 ${i+1}/12`);},i);
  await capture(`motion-${String(i).padStart(2,'0')}`,'연속 달리기');
 }
 if(finalOnly){
  const crowd=await page.evaluate(()=>{
   const W=window,V=W.__fxView,F=W.__wingFx();V.clear();
   const list=Array.from({length:21},(_,i)=>({...V.spot,x:V.spot.x+(i%7-3)*1.3,z:V.spot.z+Math.floor(i/7)*1.7,
    ry:Math.PI,g:i%5,ph:i*.08,wp:0,we:0,hat:0,gls:0,clo:0,jb:i%3,jt:2,run:true,air:false,down:false}));
   const before=F.markStats.steps;let maxMarks=0,maxBanks=0;
   for(let n=0;n<180;n++){V.t+=1/60;for(const s of list)s.z+=5/60;
    W.__drawSheep(list,V.t,40,s=>W.__GHEX[s.g],W.__avatarRender().scale);W.__wingFxPeople(list,1/60,V.t);W.__wingFxTick(1/60);
    maxMarks=Math.max(maxMarks,F.marks.filter(p=>p.t>0).length);maxBanks=Math.max(maxBanks,F.markMeshes.filter(m=>m.visible).length);
   }
   const s=list[10];W.__cam.position.set(s.x+5,s.y+6.4,s.z-11);W.__cam.lookAt(s.x,s.y+.4,s.z);W.__cam.updateMatrixWorld(true);
   document.getElementById('fxLabel').textContent='21명 실제 아바타 · 직업 발 효과 공유 풀 · 상시 고리 없음';W.__drawFrame();
   return {people:list.length,steps:F.markStats.steps-before,maxMarks,maxBanks,ring:W.__P_jobR().count,ringVisible:W.__P_jobR().visible,triangles:W.__R.info.render.triangles};
  });
  check('21 real promoted avatars keep foot FX bounded and following rings absent',crowd.people===21&&crowd.steps>21&&crowd.maxMarks<=96&&crowd.maxBanks<=3&&crowd.ring===0&&!crowd.ringVisible,crowd);
  await capture('21-promoted-running','21명 직업 발 효과');
 }
 const normal=await page.evaluate(()=>{
  const W=window,V=W.__fxView,P=W.__PL;V.clear();W.__goMini(0);W.__miniSet('run',180);W.__XP.job=1;W.__XP.jt=2;
  Object.assign(P,{x:0,y:W.__MINI_Y,z:-27,yaw:Math.PI,pitch:-.22,ground:true,down:false,vx:0,vz:0,_px:0,_pz:-27});
  W.__KEY.w=true;W.__KEY.shift=true;const s=W.__meSheep();delete s._wf;const before=W.__wingFx().markStats.steps;
  for(let i=0;i<85;i++){V.t+=1/60;W.__updPlayer(1/60);
   Object.assign(s,{x:P.x,y:P.y,z:P.z,ry:P.yaw,g:W.__G.me.g,air:!P.ground,down:P.down,jb:1,jt:2,run:true,mv:P.mv,gp:W.__gaitMe()});
   W.__drawSheep([s],V.t,40,q=>W.__GHEX[q.g],W.__avatarRender().scale);W.__wingFxPeople([s],1/60,V.t);W.__wingFxTick(1/60);
  }
  W.__KEY.w=W.__KEY.shift=false;V.actor=s;W.__loop73();W.__paintHUD();V.render('실제 기본 경주 카메라 · 내 3인칭 발 효과',true);
  return {third:W.__tpvOn(),steps:W.__wingFx().markStats.steps-before,marks:W.__wingFx().marks.filter(p=>p.t>0).length,position:[P.x,P.y,P.z],camera:W.__cam.position.toArray()};
 });
 check('Actual movement and default race camera show local third-person foot FX',normal.third&&normal.steps>1&&normal.marks>0,normal);await capture('default-third-person','실제 기본 경주 카메라');
 check('No page or shader errors',errors.length===0,errors);
}catch(e){check('Harness completed',false,{message:e.message,stack:e.stack});}
finally{clearTimeout(watchdog);await browser?.close();await new Promise(r=>server.close(r));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,images,errors},null,2));
 const motion=finalOnly?'':`<p>아래 연속 장면은 실제 5프레임 간격으로 렌더했습니다.</p><img id="motion" src="motion-00.png"><script>let i=0;setInterval(()=>document.getElementById('motion').src='motion-'+String(i++%12).padStart(2,'0')+'.png',84);</script>`;
 fs.writeFileSync(path.join(out,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>77차 직업 효과</title><style>body{background:#e9f0ef;color:#24434d;font:16px sans-serif;padding:20px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}figure{margin:0;background:white;padding:8px;border-radius:12px}img{width:100%}figcaption{padding:8px}#motion{max-width:800px}</style><h1>77차 직업 효과 실제 게임 검수</h1><p>직업 효과 진단 시점과 실제 경주 카메라. ${finalOnly?'상시 고리 제거 후 대표 장면을 재검증했습니다.':''}</p>${motion}<main>${images.map(s=>`<figure><img loading="lazy" src="${s.file}"><figcaption>${s.label}</figcaption></figure>`).join('')}</main>`);
}
console.log(`${results.filter(r=>r.pass).length}/${results.length} FX render checks passed; ${images.length} images in ${out}`);process.exitCode=results.some(r=>!r.pass)?1:0;
