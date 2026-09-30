// 81차 실제 브라우저 검사 — 그림자 판 순서(SHO)와 진단 Shift+9 되돌리기.
// ① 같은 상태의 프레임을 순서 끔/켬으로 그려 그림자 지도(2048² RGBA 읽기)와 화면이 바이트까지 같다 — 마을 첫 자리 · 성벽 위 · 밤(좀비).
//    그리는 것(물체 모음)은 같고 순서만 바뀐다. 그림자 판 순서는 같은 깊이가 생길 수 있는 짝(상자가 닿는 짝)을 안 바꾸므로 같아야 한다.
// ② 진단 Shift+9: 워밍업·스윕이 끝나면 그림자 갱신·켬·해상도·손 조명·결·작은 것 그림자·DBG 가 처음 값 그대로(80차까지는 워밍업이
//    그림자 지도를 멈춰 버렸다), '그림자 다시그리기 멈춤' 창에서만 그림자 지도가 멈춘다.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),out='artifacts/t81-shadow';fs.mkdirSync(out,{recursive:true});
const PORT=+(process.env.T81_SHADOW_PORT||20681);
const server=serve(PORT,file),errors=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const now=performance.now.bind(performance);let time=null,seed=81081;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  window.__freeze81=()=>{time=100000;};window.__advance81=ms=>{time+=ms;window.__loop73();};
  performance.now=()=>time===null?now():time;const raf=requestAnimationFrame.bind(window);requestAnimationFrame=f=>time===null?raf(f):0;
  localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','t81-shadow');localStorage.removeItem('gfxPick');
 });
 await page.goto(`http://127.0.0.1:${PORT}/?gfx=mid&diag=1`,{waitUntil:'load',timeout:400000});
 await page.waitForFunction(()=>window.__READY,null,{timeout:400000,polling:500});
 const res=await page.evaluate(()=>{const W=window,R=W.__R,G=W.__G,P=W.__PL,S=W.__SHO,D=W.__DBG(),GY=W.__GY;
  document.getElementById('iName').value='그림자 순서';document.getElementById('bSolo').click();W.__introDone();
  document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freeze81();
  G.phase='day';G.t=100000;G.paused=false;G.host=true;W.__setSky(0);W.__updSky(0,false);
  const step=n=>{D.noRender=true;for(let i=0;i<n;i++)W.__advance81(1000/60);D.noRender=false;};
  const readSM=()=>{const rt=W.__sun.shadow.map,w=rt.width,h=rt.height,a=new Uint8Array(w*h*4);R.readRenderTargetPixels(rt,0,0,w,h,a);return a;};
  const readMain=()=>{const gl=R.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  const diff=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;return n;};
  let rec=null;const rbd=R.renderBufferDirect;R.renderBufferDirect=function(c,s,g,m,o,gr){if(rec&&s===null)rec.push(o.id);return rbd.apply(this,arguments);};
  const view=name=>{
   S.on=false;rec=[];W.__drawFrame();const offO=rec,sm0=readSM(),m0=readMain();
   S.on=true;rec=[];W.__drawFrame();const onO=rec,sm1=readSM(),m1=readMain();
   S.on=false;rec=null;W.__drawFrame();const m2=readMain();S.on=true;
   const a=[...offO].sort((x,y)=>x-y).join(),b=[...onO].sort((x,y)=>x-y).join();
   let moved=0;for(let i=0;i<offO.length;i++)if(offO[i]!==onO[i])moved++;
   return {name,smDiff:diff(sm0,sm1),mainDiff:diff(m0,m1),redrawNoise:diff(m0,m2),draws:offO.length,sameSet:a===b,moved,builds:S.builds,png:R.domElement.toDataURL('image/png')};
  };
  const views=[];
  W.__camZoom(0);Object.assign(P,{x:0,y:GY,z:18,vx:0,vy:0,vz:0,ground:true,yaw:0,pitch:-.06,_px:undefined});step(40);views.push(view('village'));
  Object.assign(P,{x:20,y:GY+8,z:-51.8,vx:0,vy:0,vz:0,ground:true,yaw:-Math.PI/2,pitch:-.05,_px:undefined});step(40);views.push(view('wall'));
  const Dg=W.__DIRS[0],dx=Dg.dx,dz=Dg.dz,px=-dz,pz=dx;G.day=8;G.phase='night';G.t=9999;W.__setSky(1);W.__updSky(0,true);
  for(let i=0;i<40;i++){const r=18+(i%9)*3,off=((i*7)%11-5)*2;W.__spawnWolf(i%3,0,dx*r+px*off,dz*r+pz*off);}
  Object.assign(P,{x:dx*10,y:GY,z:dz*10,vx:0,vy:0,vz:0,ground:true,yaw:Math.atan2(-dx,-dz),pitch:-.08,_px:undefined});step(30);views.push(view('night'));
  G.phase='day';G.wolves.length=0;W.__setSky(0);W.__updSky(0,false);
  Object.assign(P,{x:0,y:GY,z:18,vx:0,vy:0,vz:0,ground:true,yaw:0,pitch:-.06,_px:undefined});step(10);
  // ② 진단 되돌리기
  const hl=W.__heldLight,cam=W.__cam;
  const snap=()=>JSON.stringify({au:R.shadowMap.autoUpdate,en:R.shadowMap.enabled,pr:R.getPixelRatio(),hl:hl.parent?hl.parent.uuid:null,
   grain:W.__GRAIN_MATS.filter(m=>m.userData.grainU).map(m=>m.userData.grainU.value),
   small:W.__SCULL.list.filter(c=>W.__NO_CAST.has(c.key)&&c.cast).length,dbg:D});
  const s0=snap();W.__startSweep();const s1=snap();const win={};let g=0;
  while(W.__sweepState().sweep&&g<5000){W.__sweepTick(.25);g++;const sw=W.__sweepState().sweep;if(!sw)break;
   const k=sw.wins.length;if(win[k]===undefined&&!sw.settling)win[k]={au:R.shadowMap.autoUpdate,frz:D.shFreeze,hl:hl.parent===cam,s:snap()};}
  const s2=snap(),names=W.CASE_NAMES,fi=names.indexOf('그림자 다시그리기 멈춤'),hi=names.indexOf('손 조명 켬');
  const baseSame=Object.keys(win).filter(k=>+k%2===0).every(k=>win[k].s===s0);
  const others=Object.keys(win).filter(k=>+k%2===1&&((+k-1)>>1)!==fi&&((+k-1)>>1)!==names.indexOf('그림자 끔')).every(k=>win[k].au===true);
  return {views,diag:{s0,s1,s2,warmSame:s0===s1,endSame:s0===s2,baseSame,freezeWin:win[2*fi+1],heldWin:win[2*hi+1],others,rows:W.__sweepState().sweepOut?W.__sweepState().sweepOut.rows.length:0,names}};
 });
 for(const v of res.views){fs.writeFileSync(path.join(out,v.name+'.png'),Buffer.from(v.png.split(',')[1],'base64'));delete v.png;}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...res,errors},null,2));
 for(const v of res.views){
  assert.ok(v.draws>0,v.name+': 그림자 판에 그린 것이 있다');
  assert.ok(v.sameSet,v.name+': 순서만 바뀌고 그린 것 모음은 같다');
  assert.equal(v.smDiff,0,v.name+': 그림자 지도 바이트가 같다');
  assert.ok(v.mainDiff===0||v.mainDiff<=v.redrawNoise,v.name+': 화면이 같다 (다시 그리기 흔들림 '+v.redrawNoise+'px 이내)');
 }
 assert.ok(res.views[0].moved>0,'마을 첫 자리에서 그림자 판 순서가 실제로 바뀐다');
 const d=res.diag;
 assert.ok(d.names.includes('그림자 다시그리기 멈춤')&&!d.names.includes('그림자 매 프레임'),'진단 줄 이름');
 assert.ok(d.warmSame,'Shift+9 워밍업 뒤 모든 스위치가 처음 값 그대로');
 assert.ok(d.endSame,'스윕이 끝난 뒤 모든 스위치가 처음 값 그대로');
 assert.ok(d.baseSame,'기준 창은 모두 처음 상태에서 잰다');
 assert.ok(d.freezeWin&&d.freezeWin.au===false&&d.freezeWin.frz===true,'멈춤 창에서만 그림자 지도가 멈춘다');
 assert.ok(d.others,'다른 항목 창에서는 그림자 지도가 매 프레임 그려진다');
 assert.ok(d.heldWin&&d.heldWin.hl===true,'손 조명 창에서는 손 조명이 켜진다');
 assert.equal(d.rows,d.names.length,'표 줄 수');
 assert.deepEqual(errors,[]);
 console.log('PASS shadow order: '+res.views.map(v=>v.name+' '+v.draws+' draws / '+v.moved+' moved / sm '+v.smDiff+' / main '+v.mainDiff).join(' · ')+' · diag sweep restores every toggle.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
