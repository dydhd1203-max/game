// Actual game DOM/WebGL, one hidden browser. No mouse or keyboard automation.
import fs from 'node:fs';import path from 'node:path';import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const out=path.resolve('artifacts/56-build-view');fs.mkdirSync(out,{recursive:true});
const server=serve(8956,process.argv[2]||GAME),browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const watchdog=setTimeout(()=>browser.close().finally(()=>server.close()),150000),results=[],errors=[];
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(detail===undefined?'':' '+JSON.stringify(detail)));};
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8956/?gfx=low',{waitUntil:'load'});await page.waitForFunction(()=>window.__READY===true);
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}#stageTitle,#toast,#feed{visibility:hidden!important}'});
 await page.evaluate(()=>{document.getElementById('iName').value='건설검사';document.getElementById('bSolo').click();});await page.waitForFunction(()=>window.__G.started);
 const play=await page.evaluate(()=>{
  const W=window,G=W.__G,P=W.__PL,A=W.__buildApi,U=W.__buildUi;W.__DBG().noLogic=true;G.phase='day';G.paused=false;
  W.__base.forEach(r=>{r.w=10000;r.s=10000;r.o=10000;});W.__recompute();W.__setAim(false);W.__clear();
  let cell;outer:for(let x=-28;x<28;x+=3)for(let z=-28;z<28;z+=3)if(!A.canPlaceBuilding('arrow',x,z)&&!A.canPlaceBuilding('swall',x+4,z)){cell=[x,z];break outer;}
  if(!cell)throw Error('No construction ground');const [x,z]=cell;
  Object.assign(P,{x:x+.5,z:z+5,y:W.__GY,down:false,ground:true});
  W.__cam.position.set(P.x,P.y+P.EYE,P.z);W.__cam.lookAt(x+.5,W.__GY,z+.5);W.__cam.updateMatrixWorld(true);
  W.__selectBuild('arrow');W.__setActing(true);W.__doAction(.05);let plan=[...W.__BUILD_PLANS.values()][0];
  const placed=!!plan;W.__setActing(false);W.__doAction(.05);
  if(!plan)throw Error('Actual action did not create blueprint');
  W.__cam.lookAt(plan.x+.5,W.__GY,plan.z+.5);W.__cam.updateMatrixWorld(true);
  W.__setActing(true);for(let i=0;i<150;i++){W.__doAction(.05);A.hostBuildTick(.05);}W.__setActing(false);W.__doAction(.01);
  const o=W.__STRU.get(plan.id),completed=!!o,workCleared=!W.__work();if(!o)throw Error('Shared action did not finish blueprint');
  const before={lv:o.lv,hp:o.hp};W.__up(o);const level2=o.lv===2;W.__up(o);
  const branchOpened=document.getElementById('buildAssistBranchPop').classList.contains('on');
  const branchButtons=[...document.querySelectorAll('#buildAssistBranchPop button')];
  const pick=branchButtons.find(b=>b.textContent.includes('저격'));if(!pick)throw Error('Missing sniper button');pick.click();
  const branchApplied=o.lv===3&&o.branch==='sniper';
  W.__selectTool('up');U.buildAssistTick();W.__rebuild();A.drawBuildPlans();W.__render();
  return {cell,placed,completed,workCleared,level2,branchOpened,branchApplied,before,after:{lv:o.lv,branch:o.branch},count:W.__STRU.size};
 });
 check('Real doAction creates and completes a shared blueprint',play.placed&&play.completed&&play.workCleared,play);
 check('Actual upgrade menu button applies level-three specialization',play.level2&&play.branchOpened&&play.branchApplied);
 const recoil=await page.evaluate(()=>{
  const W=window,o=[...W.__STRU.values()].find(o=>o.branch==='sniper'),T=W.__THREE;
  const capture=i=>{const m=new T.Matrix4();W.__struMeshes.get(o._rk[i]).getMatrixAt(o._ri[i],m);return m;};
  const gun=o?._gunParts?.[0];if(gun===undefined)return {tagged:false};
  const wall=o._rk.findIndex((_,i)=>!o._gunParts.includes(i)),before=capture(wall);
  o.gunYaw=Math.PI/2;o.gunKick=1;W.__tickBuildingGuns(0);const firing=capture(gun),bodyStable=before.equals(capture(wall));
  for(let i=0;i<60;i++)W.__tickBuildingGuns(1/60);const rested=capture(gun);
  const a=new T.Vector3().setFromMatrixPosition(firing),b=new T.Vector3().setFromMatrixPosition(rested);
  return {tagged:true,bodyStable,returned:o.gunKick===0,distance:a.distanceTo(b),turned:Math.abs(firing.elements[2])>0};
 });
 check('Sniper weapon turns and recoils while its building stays still',recoil.tagged&&recoil.bodyStable&&recoil.returned&&recoil.turned&&Math.abs(recoil.distance-.18)<1e-4,recoil);
 const wallLine=await page.evaluate(()=>{
  const W=window,P=W.__PL,U=W.__buildUi,G=W.__G;document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
  let ground;outer:for(let a=-28;a<25;a++)for(let b=-28;b<25;b++){
    let free=true;for(let dx=0;dx<4;dx++)for(let dz=0;dz<6;dz++)if(W.__buildApi.canPlaceBuilding('swall',a+dx,b+dz))free=false;
    if(free){ground=[a+.5,b+.5];break outer;}
  }
  if(!ground)throw Error('No clear wall-row fixture');
  const [x,z]=ground;Object.assign(P,{x,z:z+5});W.__cam.position.set(P.x,P.y+P.EYE,P.z);
  const look=(a,b)=>{W.__cam.lookAt(a,W.__GY,b);W.__cam.updateMatrixWorld(true);};
  W.__selectBuild('swall');U.toggleBuildLine();look(x,z);W.__setActing(true);W.__doAction(.01);W.__setActing(false);W.__doAction(.01);
  look(x+3,z);W.__setActing(true);W.__doAction(.01);W.__setActing(false);W.__doAction(.01);
  const plans=[...W.__BUILD_PLANS.values()].filter(p=>p.t==='swall');const p=plans[0];
  if(p){look(p.x+.5,p.z+.5);W.__setActing(true);W.__doAction(.05);}
  const canHelp=W.__work()?.kind==='coop';W.__setActing(false);W.__doAction(.01);
  return {count:plans.length,canHelp,adjacent:plans.slice(1).every((p,i)=>Math.abs(p.x-plans[i].x)+Math.abs(p.z-plans[i].z)===1)};
 });
 check('Two wall endpoints reserve an adjacent row and return to shared work',wallLine.count>=2&&wallLine.count<=12&&wallLine.canHelp&&wallLine.adjacent,wallLine);
 for(const [width,height]of [[1366,600],[1024,600],[800,600],[360,640]]){
  await page.setViewportSize({width,height});
  const layout=await page.evaluate(async()=>{
   const W=window,G=W.__G,P=W.__PL,U=W.__buildUi;document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));G.phase='day';G.paused=false;G.day=4;
   W.__selectBuild('pulse');W.__doAction(.01);U.buildAssistTick();await new Promise(r=>requestAnimationFrame(r));
   const dock=document.getElementById('buildAssistDock').getBoundingClientRect(),bar=document.getElementById('dock').getBoundingClientRect();
   const commands=[...document.querySelectorAll('#bar .slot')],last=commands.at(-1)?.getBoundingClientRect();
   return {dock:{top:dock.top,bottom:dock.bottom,left:dock.left,right:dock.right},barTop:bar.top,overflow:document.documentElement.scrollWidth>innerWidth,pulse:commands.length===6,lastInside:last&&last.left>=0&&last.right<=innerWidth};
  });
  check(`${width}x${height} construction dock clears hotbar`,layout.dock.bottom<=layout.barTop&&layout.dock.top>=0&&!layout.overflow&&layout.pulse&&layout.lastInside,layout);
  await page.screenshot({path:path.join(out,`placement-${width}.png`)});
  for(const type of ['arrow','ice','style']){
   const fit=await page.evaluate(async type=>{
    document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
    if(type==='style')window.__buildUi.openBuildAssistStyles();else window.__buildUi.chooseBuildBranch({id:'preview',t:type,lv:2},()=>{});
    window.__buildUi.buildAssistTick();
    await Promise.all([...document.querySelectorAll('.pop.on .buildAssistArt img')].map(im=>im.decode().catch(()=>{})));
    await new Promise(r=>requestAnimationFrame(r));
    const pop=document.querySelector('.pop.on'),panel=pop.querySelector('.panel')||pop.firstElementChild;
    const pr=panel.getBoundingClientRect(),buttons=[...panel.querySelectorAll('button')];
    const uncut=buttons.every(b=>b.clientHeight>=b.scrollHeight-1);
    buttons.at(-1)?.scrollIntoView({block:'nearest'});const last=buttons.at(-1)?.getBoundingClientRect();
    const art=[...pop.querySelectorAll('.buildAssistArt img')];
    return {open:!!pop,panel:{left:pr.left,right:pr.right,top:pr.top,bottom:pr.bottom},uncut,reachable:!!last&&last.top>=0&&last.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,realModels:art.length>0&&art.every(im=>im.naturalWidth>=192)};
   },type);
   check(`${width}x${height} ${type} choices readable and reachable`,fit.open&&fit.uncut&&fit.reachable&&!fit.overflow&&fit.panel.left>=0&&fit.panel.right<=width&&fit.realModels,fit);
   await page.screenshot({path:path.join(out,`${type}-${width}.png`)});
  }
 }
 const visual=await page.evaluate(()=>{
  const W=window,G=W.__G,A=W.__buildApi;document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));G.day=4;G.phase='day';G.paused=false;
  W.__clear();W.__BUILD_PLANS.clear();const ground=[];
  for(let x=-25;x<=25;x+=4)for(let z=-25;z<=25;z+=4)if(!A.canPlaceBuilding('barr',x,z))ground.push([x,z]);
  const types=['wwall','swall','arrow','arrow','ice','ice','barr','pulse'],branches=['','','rapid','sniper','blizzard','frost','',''];
  const valid=ground.slice(0,8);valid.forEach(([x,z],i)=>A.applyNetworkBuilding('gallery'+i,{t:types[i],x,z,g:0,n:'모둠',by:G.me.uid,lv:5,hp:W.__bs(types[i],'hp',5),branch:branches[i],born:Date.now()}));
  A.setFortStyle(3);W.__rebuild();const o=[...W.__STRU.values()][3];Object.assign(W.__PL,{x:o.x,z:o.z+8,y:W.__GY,down:false});
  W.__cam.position.set(o.x+8,W.__GY+9,o.z+10);W.__cam.lookAt(o.x,W.__GY+1,o.z);W.__cam.updateMatrixWorld(true);W.__selectTool('up');W.__buildUi.buildAssistTick();W.__render();
  return {buildings:W.__STRU.size,instances:W.__struLastN(),capacities:W.__scene.children.filter(m=>m.isInstancedMesh).every(m=>m.count<=m.instanceMatrix.count)};
 });
 await page.setViewportSize({width:1366,height:768});await page.screenshot({path:path.join(out,'fort-in-game.png')});
 check('Actual scene renders new buildings within instance capacity',visual.buildings===8&&visual.instances>0&&visual.capacities,visual);
 check('No page errors',errors.length===0,errors);
}finally{clearTimeout(watchdog);await browser.close();await new Promise(r=>server.close(r));}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(`${results.filter(r=>r.pass).length}/${results.length} building render checks passed.`);process.exitCode=results.some(r=>!r.pass)?1:0;
