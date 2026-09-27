// Targeted wall diagnostics in the real game scene, not normal player-camera acceptance.
// Uses real host placement/completion/upgrade/move and the game's rendering geometry.
// Hidden browser + pointer-lock protection come exclusively from pw.mjs. No mouse control.
// Run: node t76-wall-view.mjs [source HTML] [output directory]
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';

const out=path.resolve(process.argv[3]||'artifacts/76-wall-view');
fs.mkdirSync(out,{recursive:true});
const results=[],captures=[],errors=[],expectedQuarter=[2,1,0,0,3];
const check=(name,pass,detail)=>{
  results.push({name,pass:!!pass,detail});
  console.log(`${pass?'PASS':'FAIL'} ${name}${detail===undefined?'':' '+JSON.stringify(detail)}`);
};
const server=serve(0,process.argv[2]||GAME);
let browser,watchdog;
try{
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const port=server.address().port;
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
  watchdog=setTimeout(()=>void browser.close(),240000);
  const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  page.setDefaultTimeout(30000);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/WebGL|shader|GL_INVALID/.test(message.text()))errors.push(message.text());});
  // Stop the game's RAF after entry. noRender alone clears the canvas each RAF.
  await page.addInitScript(()=>{
    const native=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Set();
    window.requestAnimationFrame=callback=>{
      if(window.__wallViewFrozen)return 0;
      const id=native(time=>{pending.delete(id);callback(time);});pending.add(id);return id;
    };
    window.__freezeWallView=()=>{window.__wallViewFrozen=true;for(const id of pending)cancel(id);pending.clear();};
  });
  await page.goto(`http://127.0.0.1:${port}/?gfx=mid`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__READY===true);
  await page.evaluate(()=>{document.getElementById('iName').value='벽 방향 검수';document.getElementById('bSolo').click();});
  await page.waitForFunction(()=>window.__G.started&&window.__wall76);
  await page.evaluate(()=>{
    const W=window,G=W.__G;
    W.__introDone(); // Leave the real waiting room before world-building fixtures.
    W.__freezeWallView();W.__DBG().noLogic=true;G.phase='day';G.paused=false;G.day=1;
    W.__base.forEach(r=>{r.w=100000;r.s=100000;r.o=100000;});W.__recompute();
    W.__setAim(false);W.__clear();W.__buildApi.clearBuildCoop();W.__selectTool('mine');
    document.querySelectorAll('.pop').forEach(element=>element.classList.remove('on'));
    const label=document.createElement('div');label.id='wallViewLabel';document.body.append(label);
    // Diagnostic state lives only in this test page. It is never saved into source HTML.
    W.__wallView={seq:0,fixture:null};
    W.__wallView.command=command=>W.__buildApi.handleBuildCommand(W.__uid,{...command,seq:`wall76_${++W.__wallView.seq}`});
    W.__wallView.aim=(x,z,g)=>{
      const d=W.__DIRS[g],cx=x+.5,cz=z+.5;
      Object.assign(W.__PL,{x:cx+d.dx*3,z:cz+d.dz*3,y:W.__GY,down:false,ground:true,mv:false});
      W.__cam.position.set(cx+d.dx*3.7-d.dz*.4,W.__GY+2.55,cz+d.dz*3.7+d.dx*.4);
      W.__cam.lookAt(cx,W.__GY+1,cz);W.__cam.updateMatrixWorld(true);
      W.__setSky(0);W.__updSky(0,false);W.__R.shadowMap.needsUpdate=true;
    };
    W.__wallView.render=label=>{
      document.getElementById('wallViewLabel').textContent=label+' · 실제 게임 기하 / 진단 카메라';
      W.__rebuild();W.__buildApi.drawBuildPlans();W.__drawFrame();
    };
    W.__wallView.measure=o=>{
      const T=W.__THREE,blocks=W.__blocks(o.t,o.lv,o.branch,W.__buildApi.fortStyleOf(o.g));
      const actual=new T.Matrix4(),expected=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),e=new T.Euler();
      const d=W.__DIRS[W.__wall76.sector(o.x,o.z)];let matrixError=0,minT=Infinity,maxT=-Infinity,minN=Infinity,maxN=-Infinity,minY=Infinity,maxY=-Infinity;
      blocks.forEach((b,i)=>{
        const mesh=W.__struMeshes.get(o._rk[i]);mesh.getMatrixAt(o._ri[i],actual);
        const pose=W.__wall76.partPose(o,b);p.set(...pose.slice(0,3));q.setFromEuler(e.set(0,pose[3],pose[4],'YXZ'));
        s.set(b[4]??1,b[5]??1,b[6]??1);expected.compose(p,q,s);
        for(let j=0;j<16;j++)matrixError=Math.max(matrixError,Math.abs(actual.elements[j]-expected.elements[j]));
        mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
        const vertices=mesh.geometry.attributes.position;
        for(let j=0;j<vertices.count;j++){p.fromBufferAttribute(vertices,j).applyMatrix4(actual);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
          p.set(x,y,z).applyMatrix4(actual);const t=-p.x*d.dz+p.z*d.dx,n=p.x*d.dx+p.z*d.dz;
          minT=Math.min(minT,t);maxT=Math.max(maxT,t);minN=Math.min(minN,n);maxN=Math.max(maxN,n);
        }
      });
      return {r:o.r,lv:o.lv,x:o.x,z:o.z,parts:blocks.length,matrixError,frontWidth:maxT-minT,depth:maxN-minN,
        meshTop:maxY-W.__GY,meshBottom:minY-W.__GY,statHeight:W.__bs(o.t,'hi',o.lv),collisionHeight:W.__bldH[(o.x+W.__HW)+(o.z+W.__HW)*Math.sqrt(W.__bldH.length)]-W.__GY,
        packedR:W.__buildApi.packBuilding(o).r};
    };
  });
  await page.addStyleTag({content:`
    *,*::before,*::after{animation:none!important;transition:none!important}
    body> :not(canvas):not(#app):not(#wallViewLabel){visibility:hidden!important}
    #wallViewLabel{position:fixed;left:14px;top:14px;max-width:900px;z-index:99999;padding:12px 16px;border:2px solid #468882;border-radius:12px;background:#fff8e8;color:#163f4b;font:600 18px/1.4 sans-serif;box-shadow:0 3px 0 #326a75;pointer-events:none}
  `});
  for(let g=0;g<5;g++)for(const t of ['wwall','swall']){
    const label=`${g+1}모둠 ${t==='wwall'?'나무벽':'돌벽'}`,stem=`g${g+1}-${t}`;
    const fixture=await page.evaluate(({g,t})=>{
      const W=window,V=W.__wallView,A=W.__buildApi;
      W.__wall76.ghost().visible=false;W.__clear();A.clearBuildCoop();W.__G.me.g=g;
      let cell=null;
      outer:for(const radial of [38,37,39,36,40,35,41,34,42,33,43,32,44,31,30])for(const lateral of [-3,3,-2,2,-1,1,0]){
        const x=Math.floor(W.__gX(g,radial,lateral)),z=Math.floor(W.__gZ(g,radial,lateral));
        if(W.__wall76.sector(x,z)===g&&!A.canPlaceBuilding(t,x,z)){cell=[x,z];break outer;}
      }
      if(!cell)throw Error(`No legal wall fixture for group ${g+1}`);
      const [x,z]=cell,r=W.__wall76.quarter(t,x,z);V.fixture={g,t,x,z,r};V.aim(x,z,g);
      W.__wall76.setGhost(t,1,'',A.fortStyleOf(g),r);
      const ghost=W.__wall76.ghost();ghost.position.set(x,W.__GY,z);ghost.visible=true;ghost.updateMatrixWorld(true);
      W.__wall76.fill(1);
      const blocks=W.__blocks(t,1,'',A.fortStyleOf(g)),parts=ghost.children.filter(m=>m.isMesh);
      let poseError=0;
      parts.forEach((m,i)=>{
        const expected=W.__wall76.partPose({t,x,z,r},blocks[i]),p=new W.__THREE.Vector3();m.getWorldPosition(p);
        poseError=Math.max(poseError,Math.hypot(p.x-expected[0],p.y-expected[1],p.z-expected[2]),Math.abs(m.rotation.y-expected[3]));
      });
      V.render(`${g+1}모둠 ${t==='wwall'?'나무벽':'돌벽'} · 설치 미리보기 · r=${r}`);
      return {...V.fixture,parts:parts.length,blockCount:blocks.length,poseError,allVisible:parts.every(m=>m.visible),finiteBottoms:parts.every(m=>Number.isFinite(m.userData.buildBottom))};
    },{g,t});
    check(`${label} default faces its actual gate`,fixture.r===expectedQuarter[g],fixture);
    check(`${label} preview matches the building pose`,fixture.parts===fixture.blockCount&&fixture.poseError<1e-8,fixture.poseError);
    check(`${label} actual ghostFill fully reveals curved geometry`,fixture.allVisible&&fixture.finiteBottoms,{allVisible:fixture.allVisible,finiteBottoms:fixture.finiteBottoms});
    const capture=async(stage)=>{
      const name=`${stem}-${stage}.png`;await page.screenshot({path:path.join(out,name)});captures.push({g:g+1,t,stage,file:name});
    };
    await capture('01-preview');
    const plan=await page.evaluate(()=>{
      const W=window,V=W.__wallView,F=V.fixture;W.__wall76.ghost().visible=false;
      V.command({kind:'plan',t:F.t,cells:[[F.x,F.z]]});const p=[...W.__BUILD_PLANS.values()][0];
      if(!p)throw Error('The real host did not accept the wall plan');V.fixture.id=p.id;
      p.prog=.5;V.render(`${F.g+1}모둠 ${F.t==='wwall'?'나무벽':'돌벽'} · 공동 설계도 50% · r=${p.r}`);
      const T=W.__THREE,blocks=W.__blocks(p.t,1,'',W.__buildApi.fortStyleOf(p.g)),matrix=new T.Matrix4();
      const candidates=W.__scene.children.filter(m=>m.isInstancedMesh&&m.count===blocks.length+2&&m.material.opacity===.42);
      const mesh=candidates.find(m=>{m.getMatrixAt(0,matrix);const pose=W.__wall76.partPose(p,blocks[0]);return Math.hypot(matrix.elements[12]-pose[0],matrix.elements[13]-pose[1],matrix.elements[14]-pose[2])<1e-4;});
      if(!mesh)throw Error('Could not identify actual blueprint instance buffer');
      const background=new T.Matrix4(),fill=new T.Matrix4();mesh.getMatrixAt(blocks.length,background);mesh.getMatrixAt(blocks.length+1,fill);
      const d=W.__DIRS[F.g],axis=new T.Vector3().setFromMatrixColumn(background,0).normalize(),fillAxis=new T.Vector3().setFromMatrixColumn(fill,0).normalize();
      const center=new T.Vector3().setFromMatrixPosition(fill).applyMatrix4(background.clone().invert());
      const width=new T.Vector3().setFromMatrixColumn(fill,0).length()/new T.Vector3().setFromMatrixColumn(background,0).length();
      return {r:p.r,x:p.x,z:p.z,progress:{acrossGate:Math.abs(axis.x*d.dx+axis.z*d.dz)<1e-6,sameDirection:axis.dot(fillAxis)>.99999,center:center.toArray(),width}};
    });
    check(`${label} host stores the preview direction in its plan`,plan.r===fixture.r,plan);
    check(`${label} progress bar faces the gate and fills from its left`,plan.progress.acrossGate&&plan.progress.sameDirection&&Math.abs(plan.progress.center[0]+.25)<1e-5&&Math.abs(plan.progress.width-.5)<1e-5,plan.progress);
    await capture('02-blueprint');
    const completed=await page.evaluate(()=>{
      const W=window,V=W.__wallView,F=V.fixture,p=W.__BUILD_PLANS.get(F.id);
      if(!W.__buildApi.finishBuildPlan(p))throw Error('Actual completion failed');
      V.render(`${F.g+1}모둠 ${F.t==='wwall'?'나무벽':'돌벽'} · 완성 1단계`);
      return V.measure(W.__STRU.get(F.id));
    });
    check(`${label} completed renderer and serialized direction match`,completed.r===fixture.r&&completed.packedR===fixture.r&&completed.matrixError<1e-5,completed);
    check(`${label} completed real vertices and collision share the twenty-percent taller height`,Math.abs(completed.meshTop-1.68)<.002&&Math.abs(completed.collisionHeight-1.68)<.00001&&completed.statHeight===1.68&&completed.meshBottom>=-.064&&completed.meshBottom<=.001,completed);
    await capture('03-completed');
    const upgraded=await page.evaluate(()=>{
      const W=window,V=W.__wallView,F=V.fixture,o=W.__STRU.get(F.id);W.__up(o);
      V.render(`${F.g+1}모둠 ${F.t==='wwall'?'나무벽':'돌벽'} · 실제 강화 2단계`);return V.measure(o);
    });
    check(`${label} real upgrade preserves its direction`,upgraded.lv===2&&upgraded.r===fixture.r&&upgraded.matrixError<1e-5,upgraded);
    check(`${label} real upgrade preserves the taller grounded mesh and collision`,Math.abs(upgraded.meshTop-completed.meshTop)<.00001&&Math.abs(upgraded.meshBottom-completed.meshBottom)<.00001&&Math.abs(upgraded.collisionHeight-1.68)<.00001);
    await capture('04-upgraded');
    const moved=await page.evaluate(()=>{
      const W=window,V=W.__wallView,F=V.fixture,A=W.__buildApi,o=W.__STRU.get(F.id),d=W.__DIRS[F.g];let target;
      for(const offset of [2,-2,3,-3,1,-1]){
        const x=o.x+d.dx*offset,z=o.z+d.dz*offset;
        if(W.__wall76.sector(x,z)===F.g&&!A.canPlaceBuilding(o.t,x,z,o.id)){target=[x,z];break;}
      }
      if(!target)throw Error('No nearby legal move target');
      V.command({kind:'move',id:o.id,x:target[0],z:target[1]});const current=W.__STRU.get(F.id);
      V.aim(current.x,current.z,F.g);V.render(`${F.g+1}모둠 ${F.t==='wwall'?'나무벽':'돌벽'} · 실제 옮기기 후`);
      return {...V.measure(current),requested:target,moved:current.x===target[0]&&current.z===target[1]};
    });
    check(`${label} actual move preserves direction and updates renderer`,moved.moved&&moved.r===fixture.r&&moved.matrixError<1e-5,moved);
    check(`${label} actual move carries its taller collision and exact base height`,Math.abs(moved.meshTop-completed.meshTop)<.00001&&Math.abs(moved.meshBottom-completed.meshBottom)<.00001&&Math.abs(moved.collisionHeight-1.68)<.00001);
    await capture('05-moved');
    const restored=await page.evaluate(()=>{
      const W=window,V=W.__wallView,F=V.fixture,A=W.__buildApi,o=W.__STRU.get(F.id),pack=A.packBuilding(o);
      W.__del(o.id);A.applyNetworkBuilding(F.id,pack);W.__rebuild();const explicit=V.measure(W.__STRU.get(F.id));
      W.__del(F.id);delete pack.r;pack.g=(F.g+2)%5;A.applyNetworkBuilding(F.id,pack);W.__rebuild();const legacy=V.measure(W.__STRU.get(F.id));
      return {explicit,legacy,owner:pack.g,actualSector:W.__wall76.sector(pack.x,pack.z)};
    });
    check(`${label} network restore and legacy records use actual location`,restored.explicit.r===fixture.r&&restored.legacy.r===fixture.r&&restored.actualSector===g&&restored.owner!==g,restored);
  }
  // Both drawn-row axes are exercised through the host, not just the orientation helper.
  const rows=await page.evaluate(()=>{
    const W=window,V=W.__wallView,A=W.__buildApi,result=[];
    for(const t of ['wwall','swall'])for(const axis of [0,1]){
      W.__clear();A.clearBuildCoop();W.__G.me.g=0;let cells;
      outer:for(let x=-28;x<=28;x++)for(let z=-28;z<=28;z++){
        const candidate=Array.from({length:3},(_,i)=>[x+(axis===0?i:0),z+(axis===1?i:0)]);
        if(candidate.every(([a,b])=>!A.canPlaceBuilding(t,a,b))){cells=candidate;break outer;}
      }
      if(!cells)throw Error('No legal three-cell wall row');
      Object.assign(W.__PL,{x:cells[1][0]+.5,z:cells[1][1]+.5,down:false});
      V.command({kind:'plan',t,cells});const plans=[...W.__BUILD_PLANS.values()];
      result.push({t,axis,count:plans.length,r:plans.map(p=>p.r),cells,parallel:plans.length===3&&plans.every(p=>p.r%2===axis)});
    }
    return result;
  });
  for(const row of rows)check(`${row.t} ${row.axis?'Z':'X'} row follows the drawn line`,row.parallel,row);
  check('No page or WebGL errors',errors.length===0,errors);
}catch(error){
  check('Harness completed',false,{message:error.message,stack:error.stack});
}finally{
  clearTimeout(watchdog);
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({source:path.resolve(process.argv[2]||GAME),results,captures,errors},null,2));
  const rows=captures.map(c=>`<figure><figcaption>${c.g}모둠 · ${c.t} · ${c.stage}</figcaption><a href="${c.file}"><img loading="lazy" src="${c.file}" alt="${c.g}모둠 ${c.t} ${c.stage}"></a></figure>`).join('\n');
  fs.writeFileSync(path.join(out,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>76차 벽 방향 진단</title><style>body{margin:24px;background:#e6edf0;color:#153b45;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:16px}figure{margin:0;background:white;padding:8px;border-radius:10px}img{width:100%}figcaption{padding:8px}</style><h1>벽 방향 진단 — 실제 게임 렌더</h1><p>성문 바깥 방향에서 본 진단 카메라입니다. 일반 플레이 시점 검수를 대체하지 않습니다. 4모둠 유지, 2·5모둠 정면 방향, 미리보기부터 이동까지 비교합니다.</p><main>${rows}</main>`);
}
console.log(`${results.filter(result=>result.pass).length}/${results.length} wall checks passed; ${captures.length} screenshots in ${out}`);
process.exitCode=results.some(result=>!result.pass)?1:0;
