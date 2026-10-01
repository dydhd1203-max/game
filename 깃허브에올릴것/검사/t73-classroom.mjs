// Current game functions in a hidden browser. No real Firebase, no OS cursor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const file=process.argv[2]||GAME,srv=serve(20573,file);
let browser;
try{
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{
    const now=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null;
    window.__freeze=()=>{time=now();};window.__frames=[];window.__clock=ms=>{time+=ms;window.__frames.length=0;window.__loop73();};
    performance.now=()=>time===null?now():time;requestAnimationFrame=f=>{if(time===null)return raf(f);window.__frames.push(f);return 1;};
    localStorage.setItem('sndOn','0');
  });
  await page.goto('http://127.0.0.1:20573/?gfx=mid',{timeout:240000,waitUntil:'load'});
  await page.waitForFunction(()=>window.__READY===true,null,{timeout:240000});
  await page.evaluate(()=>{document.getElementById('iName').value='검사';document.getElementById('bSolo').click();
    window.__introDone?.();document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));window.__DBG().noRender=true;window.__freeze();});
  await page.waitForTimeout(100);
  const result=await page.evaluate(()=>{
    const W=window,A=W.__session73,G=W.__G,P=W.__PL,K=W.__KIT,X=W.__XP;
    const results={};
    if(!A)return {baseline:true};
    G.phase='night';G.wolves=[{id:73001,k:0,x:10,z:10,y:W.__GY,ry:0,hp:1000,mx:1000,mv:false}];
    const packet=A.packSim();G.host=false;A.applySim(packet);
    results.hp={hp:G.wolves[0].hp,mx:G.wolves[0].mx,stride:packet.w.length};
    G.host=true;A.hostHits('clientA',{g:0,n:'A',hq:[[1,73001,150,1,null,G.day]]});
    results.firstHit={hp:G.wolves[0].hp,credit:A.state().combatTotals.get('clientA')[1]};
    A.hostHits('clientA',{g:0,n:'A',hq:[[1,73001,150,1,null,G.day],[2,73001,850,1,null,G.day]]});
    A.hostHits('clientB',{g:0,n:'B',hq:[[1,73001,850,1,null,G.day]]});
    results.kill={a:A.state().combatTotals.get('clientA')[1],b:A.state().combatTotals.get('clientB')[1],hp:G.wolves[0].hp};
    // 21 requests share one purse, including replay of every accepted request.
    G.phase='day';G.players.clear();W.__pcMap.clear();A.setPC({g:0});
    for(const b of W.__base)Object.assign(b,{w:100,s:100,o:10,eg:0,mk:0,pk:0});W.__recompute();
    for(let i=0;i<21;i++)W.__pcMap.set('child'+i,{g:0});
    for(let i=0;i<21;i++){const c={kind:'ammo',gld:8,g:0,lv:1,seq:100+i,sid:G.sid};A.hostPurchase('child'+i,c);A.hostPurchase('child'+i,c);}
    results.purchase={accepted:[...A.state().marketReceipts.values()].filter(r=>r.ok).length,gold:G.res[0].g};
    // Same-room reload keeps private progress; a new sid never restores the old lesson.
    G.room='TEST73';G.host=false;A.checkpointRestore();K.ownW[3]=true;K.wpn=3;K.ammo=79;K.enh[3]=4;X.lv=16;X.job=0;X.jt=1;
    const expected={ammo:K.ammo,lv:X.lv,job:X.job,enh:K.enh[3]};A.checkpointSave();K.ammo=0;K.ownW[3]=false;X.lv=1;X.job=-1;K.enh[3]=0;
    const restored=A.checkpointRestore();results.rejoin={restored,expected,actual:{ammo:K.ammo,lv:X.lv,job:X.job,enh:K.enh[3]}};
    G.sid++;results.newLesson=A.checkpointRestore();G.room='';
    // Actual frame loop: 10 real frames/sec must report 10, and day clock loses 4 seconds.
    G.host=true;G.phase='day';G.t=100;G.wolves=[];G.paused=false;W.__clock(0);const t0=G.t;
    for(let i=0;i<40;i++)W.__clock(100);
    results.clock={elapsed:t0-G.t,fps:A.state().fpsVal};
    // Repeated no-render frames cannot accumulate thousands of upload ranges.
    const meshes=[];W.__scene.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});
    results.ranges=Math.max(0,...W.__P_handM().map(m=>m.instanceMatrix.updateRanges.length));
    // Moving through every spiral floor seam: auto first-person stays in the well, yaw never changes.
    const camera=[];W.__camZoom(3.2);
    for(let si=0;si<W.__SPIRALS.length;si++){
      const S=W.__SPIRALS[si],r=(S.a+S.b)/2;let uncovered=0,oldUncovered=0,maxYaw=0,flips=0,last=null;
      for(let j=300;j>=1;j--){const u=j/300*S.turns*Math.PI*2,th=S.th0+u;
        const y=S.y0+u/(2*Math.PI)*S.Ht,x=S.cx+Math.cos(th)*r,z=S.cz+Math.sin(th)*r;
        Object.assign(P,{x,z,y,ground:true,vy:0,vx:0,vz:0,yaw:0.7,pitch:-0.2,_px:undefined,down:false});
        for(let k=0;k<2;k++)W.__updPlayer(1/60);
        if(y<S.y0+S.Ht*S.turns-0.4 && !W.__camCov(x,z,y))uncovered++;
        if(y<S.y0+S.Ht*S.turns-0.4 && !(W.__covAt(x,z,y) && W.__ceilingOver(x,z,.05,y)<y+30))oldUncovered++;
        maxYaw=Math.max(maxYaw,Math.abs(P.yaw-0.7));
        const back=W.__camRig().distance;if(last!==null && back!==null && Math.abs(back-last)>1)flips++;last=back;
      }
      camera.push({si,uncovered,oldUncovered,maxYaw,flips});
    }
    results.camera=camera;results.graphics={...W.__GFX,pixelRatio:W.__R.getPixelRatio()};
    return results;
  });
  console.log(JSON.stringify(result,null,2));
  fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/t73-classroom.json',JSON.stringify(result,null,2));
  assert.deepEqual(result.hp,{hp:1000,mx:1000,stride:8});
  assert.deepEqual(result.firstHit,{hp:850,credit:0});
  assert.ok(result.kill.a>0 && result.kill.b===0 && result.kill.hp===0);
  assert.deepEqual(result.purchase,{accepted:1,gold:2});
  assert.ok(result.rejoin.restored);assert.deepEqual(result.rejoin.actual,result.rejoin.expected);assert.equal(result.newLesson,false);
  assert.ok(Math.abs(result.clock.elapsed-4)<1e-6);assert.equal(result.clock.fps,10);
  assert.ok(result.ranges<=1);assert.ok(result.camera.length>=8 && result.camera.every(r=>r.uncovered===0 && r.maxYaw===0));
  assert.equal(result.graphics.pr,0.85);assert.equal(result.graphics.shadow,0);   // 83차 — 실시간 그림자는 모든 화질에서 끈다(발밑 동그란 그림자)
  assert.equal(result.graphics.aa,2);
  assert.deepEqual(errors,[]);console.log('PASS: classroom health, 21 purchases, reconnect, real clock, bounded uploads, spiral view, unchanged graphics');
}finally{await browser?.close();await new Promise(r=>srv.close(r));}
