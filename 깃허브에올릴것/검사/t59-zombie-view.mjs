// Actual zombie animation states in one guarded, hidden browser. No OS input.
// Each row advances the same actor through prey discovery and its real attack
// cooldown, then copies the actual drawWolves instance matrices into the strip.
import fs from 'node:fs';import path from 'node:path';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const out=path.resolve('artifacts/59-zombie');fs.mkdirSync(out,{recursive:true});
const server=serve(8959,process.argv[2]||GAME),checks=[],errors=[];let browser;
const check=(name,pass,detail)=>{checks.push({name,pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
try{
 browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
 for(const quality of ['low','mid']){
  const page=await browser.newPage({viewport:{width:1536,height:1160}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader|GL_INVALID|compile/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:8959/?gfx='+quality,{waitUntil:'load',timeout:60000});await page.waitForFunction(()=>window.__READY===true,null,{timeout:60000});
  await page.evaluate(()=>{document.getElementById('iName').value='좀비 동작 검사';document.getElementById('bSolo').click();});await page.waitForFunction(()=>window.__G.started);
  for(const view of ['quarter','profile']){
  const report=await page.evaluate(view=>{
   const W=window,T=W.__THREE,R=W.__R,width=1536,height=1160,cols=6,cw=256,ch=264,top=75,meshes=W.__charMeshes()['좀비'];
   W.__DBG().noRender=true;W.__DBG().noLogic=true;W.__G.paused=true;W.__G.phase='night';W.__G.day=3;W.__G.nk=0;W.__setSky(1);W.__updSky(.001);
   document.querySelectorAll('body > :not(canvas)').forEach(e=>e.style.display='none');document.getElementById('zombieLabels')?.remove();document.getElementById('zombieSnapshot')?.remove();R.domElement.style.cssText='position:fixed;inset:0;display:block;z-index:100000;';R.setPixelRatio(1);R.setSize(width,height,false);R.setRenderTarget(null);R.setScissorTest(false);R.setClearColor(0xeaf0f3,1);R.clear();R.setScissorTest(true);
   const overlay=document.createElement('div');overlay.id='zombieLabels';overlay.style.cssText='position:fixed;inset:0;z-index:100002;font-family:Arial,"Noto Sans KR",sans-serif;color:#294d62;pointer-events:none;';document.body.appendChild(overlay);
   const label=(text,x,y,w,size=15)=>{const e=document.createElement('div');e.textContent=text;e.style.cssText=`position:absolute;left:${x}px;top:${y}px;width:${w}px;text-align:center;font-size:${size}px;font-weight:600;`;overlay.appendChild(e);};
   label('실제 좀비 동작 · '+(view==='profile'?'옆모습 · ':'')+'발견 → 몸을 낮춤 → 추격 → 공격 → 회복',15,17,width-30,23);
   const stages=['어슬렁','먹이 발견','추격 돌진','공격 준비','타격','회복'];stages.forEach((s,i)=>label(s,i*cw,52,cw));
   const kinds=[0,1,2,W.__WOLF_T.findIndex(d=>d.boss===1)],report=[],capacity=[];
   let spot;outer:for(let x=-24;x<=24;x+=3)for(let z=-24;z<=24;z+=3){const y=W.__groundUnder(x,z,.3);if(y>0&&y<80&&Math.abs(W.__groundUnder(x,z+6,.3)-y)<.01){spot={x,y,z};break outer;}}
   if(!spot)throw Error('No level ground');
   for(let row=0;row<kinds.length;row++){
    const k=kinds[row],def=W.__WOLF_T[k],s={k,id:2+row,ph:.3+row*.15,x:spot.x,y:spot.y,z:spot.z,ry:0,hp:100,mx:100,mv:false,atkT:0,hurt:0,shT:false},speed=Math.max(def.spd*1.3,4.6);let time=4;
    const step=(n,moving=false)=>{for(let j=0;j<n;j++){time+=1/60;if(moving)s.z+=speed/60;W.__drawWolves([s],time,1/60);}};
    for(let col=0;col<6;col++){
     if(col===0){step(12);}
     if(col===1){s.shT=true;s.mv=true;step(9,true);}
     if(col===2){step(40,true);}
     if(col===3){s.mv=false;s.atkT=0;step(15);s.poseAtkCd=def.cd;s.poseAtkT=def.cd*.10;s.atkT=def.cd*.06;step(1);}
     if(col===4){s.atkT=def.cd;step(1);}
     if(col===5){s.atkT=def.cd*.5;s.poseAtkT=def.cd*.55;step(1);}
     const scene=new T.Scene(),group=new T.Group();group.position.set(-s.x,-spot.y,-s.z);scene.add(group);let parts=0,finite=true;
     for(const mesh of meshes)if(mesh.count){const copy=mesh.clone();copy.instanceMatrix=mesh.instanceMatrix.clone();if(mesh.instanceColor)copy.instanceColor=mesh.instanceColor.clone();copy.frustumCulled=false;group.add(copy);parts+=mesh.count;finite&&=mesh.count<=mesh.instanceMatrix.count&&Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)).every(Number.isFinite);}
     for(const light of W.__scene.children.filter(o=>o.isLight)){const copy=light.clone();copy.castShadow=false;scene.add(copy);if(copy.target)scene.add(copy.target);}
     const floor=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshLambertMaterial({color:0xb9c9c3}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
     const sc=def.sc,span=2.5*sc,aspect=(cw-10)/(ch-32),camera=new T.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.05,80);camera.position.set((view==='profile'?6:3.5)*sc,2.05*sc,(view==='profile'?1.5:6)*sc);camera.lookAt(0,.94*sc,0);
     const x=col*cw,y=top+row*ch;R.setViewport(x+5,height-y-ch+27,cw-10,ch-32);R.setScissor(x+5,height-y-ch+27,cw-10,ch-32);R.render(scene,camera);floor.geometry.dispose();floor.material.dispose();
     label(def.n+(col===2?' · 몸 앞으로':''),x,y+ch-23,cw,14);report.push({kind:def.n,stage:stages[col],parts,finite,chase:+(s.poseChase||0).toFixed(3),alert:+(s.poseAlert||0).toFixed(3)});
    }
   }
   R.setScissorTest(false);const snapshot=document.createElement('img');snapshot.id='zombieSnapshot';snapshot.src=R.domElement.toDataURL();snapshot.style.cssText='position:fixed;inset:0;width:1536px;height:1160px;z-index:100001;';document.body.appendChild(snapshot);
   for(const k of kinds){const army=Array.from({length:92},(_,i)=>({k,id:i,x:spot.x+(i%12)*.05,y:spot.y,z:spot.z+Math.floor(i/12)*.05,ry:0,ph:i*.11,hp:100,mx:100,atkT:.9,poseAtkT:.05,poseAtkCd:.9,shT:true,mv:false}));W.__drawWolves(army,12,1/60);capacity.push({kind:W.__WOLF_T[k].n,parts:meshes.reduce((n,m)=>n+m.count,0),valid:meshes.every(m=>m.count<=m.instanceMatrix.count&&Array.from(m.instanceMatrix.array.slice(0,m.count*16)).every(Number.isFinite))});}
   return {report,capacity};
  },view);
  await page.evaluate(()=>document.getElementById('zombieSnapshot').decode());await page.screenshot({path:path.join(out,quality+'-threat-'+(view==='profile'?'profile':'strip')+'.png')});
  check(quality+' '+view+' four zombie types render all six real motion states',report.report.length===24&&report.report.every(r=>r.finite&&r.parts>20),{poses:report.report.length,parts:[...new Set(report.report.map(r=>r.parts))]});
  check(quality+' '+view+' maximum crowds fit live instance buffers',report.capacity.every(r=>r.valid),report.capacity);
  }
  // An additional close view uses the real daytime lamps plus a weak frontal
  // fill. This is an inspection studio, separate from the night-motion strips.
  await page.setViewportSize({width:1536,height:1536});
  const styles=await page.evaluate(()=>{
   // Style close-ups omit the last four effect-only meshes (heal/beam/dread/aura).
   const W=window,T=W.__THREE,R=W.__R,size=1536,cell=384,meshes=W.__charMeshes()['좀비'].slice(0,-4);
   W.__G.phase='day';W.__G.day=3;W.__setSky(0);W.__updSky(.001);
   document.querySelectorAll('body > :not(canvas)').forEach(e=>e.style.display='none');document.getElementById('zombieLabels')?.remove();document.getElementById('zombieSnapshot')?.remove();
   R.setPixelRatio(1);R.setSize(size,size,false);R.setRenderTarget(null);R.setScissorTest(false);R.setClearColor(0xf1f5f2,1);R.clear();R.setScissorTest(true);
   const labels=document.createElement('div');labels.id='zombieLabels';labels.style.cssText='position:fixed;inset:0;z-index:100002;color:#345463;font:500 17px Arial,"Noto Sans KR",sans-serif;pointer-events:none;';document.body.appendChild(labels);
   let spot;outer:for(let x=-24;x<=24;x+=3)for(let z=-24;z<=24;z+=3){const y=W.__groundUnder(x,z,.3);if(y>0&&y<80){spot={x,y,z};break outer;}}if(!spot)throw Error('No level ground');
   const cards=[...W.__WOLF_T.map((d,k)=>({k,nk:0,label:d.n})),...[3,5,7].map(nk=>({k:0,nk,label:['일반 좀비 · 붕대','일반 좀비 · 재킷','일반 좀비 · 망토'][[3,5,7].indexOf(nk)]}))],report=[];
   cards.forEach((card,i)=>{
    W.__G.nk=card.nk;const def=W.__WOLF_T[card.k],s={k:card.k,id:3+i,ph:.3,x:spot.x,y:spot.y,z:spot.z,ry:0,hp:100,mx:100,mv:false,atkT:0,hurt:0,shT:false};
    W.__drawWolves([s],4,1/60);const scene=new T.Scene(),group=new T.Group();group.position.set(-s.x,-spot.y,-s.z);scene.add(group);let parts=0,finite=true;
    for(const mesh of meshes)if(mesh.count){const copy=mesh.clone();copy.instanceMatrix=mesh.instanceMatrix.clone();if(mesh.instanceColor)copy.instanceColor=mesh.instanceColor.clone();copy.frustumCulled=false;group.add(copy);parts+=mesh.count;finite&&=mesh.count<=mesh.instanceMatrix.count&&Array.from(mesh.instanceMatrix.array.slice(0,mesh.count*16)).every(Number.isFinite);}
    for(const light of W.__scene.children.filter(o=>o.isLight)){const copy=light.clone();copy.castShadow=false;scene.add(copy);if(copy.target)scene.add(copy.target);}
    const fill=new T.DirectionalLight(0xfff4e5,.65);fill.position.set(-3,4,6);scene.add(fill);
    const sc=def.sc,matrix=new T.Matrix4();meshes[3].getMatrixAt(0,matrix);const head=new T.Vector3().setFromMatrixPosition(matrix).add(group.position),span=1.85*sc,aspect=(cell-16)/(cell-44),camera=new T.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.05,80);
    const angle=i%2?.54:.08,targetY=head.y-.08*sc;camera.position.set(Math.sin(angle)*7*sc,targetY+.32*sc,Math.cos(angle)*7*sc);camera.lookAt(0,targetY,0);
    const x=i%4*cell,y=Math.floor(i/4)*cell;R.setViewport(x+8,size-y-cell+36,cell-16,cell-44);R.setScissor(x+8,size-y-cell+36,cell-16,cell-44);R.render(scene,camera);
    const label=document.createElement('div');label.textContent=card.label;label.style.cssText=`position:absolute;left:${x}px;top:${y+cell-29}px;width:${cell}px;text-align:center;`;labels.appendChild(label);report.push({k:card.k,nk:card.nk,parts,finite});
   });
   R.setScissorTest(false);const snapshot=document.createElement('img');snapshot.id='zombieSnapshot';snapshot.src=R.domElement.toDataURL();snapshot.style.cssText='position:fixed;inset:0;width:1536px;height:1536px;z-index:100001;';document.body.appendChild(snapshot);return report;
  });
  await page.evaluate(()=>document.getElementById('zombieSnapshot').decode());await page.screenshot({path:path.join(out,quality+'-zombie-styles.png')});
  check(quality+' all thirteen styles and three uncovered heads render in close view',styles.length===16&&new Set(styles.map(s=>s.k)).size===13&&styles.every(s=>s.finite&&s.parts>20),{cards:styles.length,uncovered:styles.slice(-3).map(s=>s.nk)});
  await page.close();
 }
 check('No JavaScript or shader errors',errors.length===0,errors);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(checks,null,2));if(checks.some(c=>!c.pass))process.exitCode=1;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
