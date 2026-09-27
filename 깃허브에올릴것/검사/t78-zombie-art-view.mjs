// Same current world/21 avatars/camera. Only zombie visual functions restore build76 in the control.
// Real player-camera captures plus an explicitly separate character-detail sheet. Not LG Gram FPS.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),baseline=path.resolve(process.argv[3]||'../../work/race76/baseline76.html');
const current=fs.readFileSync(file,'utf8'),old=fs.readFileSync(baseline,'utf8'),out=path.resolve('artifacts/zombie78');fs.mkdirSync(out,{recursive:true});
const fn=(s,n)=>{const i=s.indexOf('function '+n+'('),e=s.indexOf('\n}',i);assert.ok(i>=0&&e>i,n);return s.slice(i,e+2);};
let control=current;for(const n of ['zombieWoundSkin','zomSkin','drawWolves'])control=control.replace(fn(current,n),fn(old,n));
const style=s=>/const ZOMBIE_STYLE = \{[\s\S]*?\n\};/.exec(s)[0],eye=s=>s.slice(s.indexOf('eyeMat.onBeforeCompile ='),s.indexOf('const ZOMBIE_FANG_GEO='));
control=control.replace(style(current),style(old)).replace(eye(current),eye(old));
const files={before:path.join(out,'zombie76-control.html'),after:path.join(out,'zombie78-current.html')};fs.writeFileSync(files.before,control);fs.writeFileSync(files.after,current);
const results=[],errors=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 for(const label of ['before','after']){
  const server=serve(20580,files[label]);let page;
  try{
   page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>errors.push({label,message:e.message}));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push({label,message:m.text()});});
   await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   await page.addInitScript(()=>{const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null,seed=78137;
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};window.__realNow=real;window.__freeze=()=>{time=100000;};
    window.__advance=ms=>{time+=ms;window.__loop73();};performance.now=()=>time===null?real():time;requestAnimationFrame=f=>time===null?raf(f):0;
    localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','zombie78-review');});
   await page.goto('http://127.0.0.1:20580/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
   await page.evaluate(()=>{const W=window,G=W.__G;document.getElementById('iName').value='좀비 미술 검수';document.getElementById('bSolo').click();W.__introDone();
    document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));W.__freeze();W.__DBG().noRender=true;G.started=true;G.host=false;G.paused=false;G.phase='day';G.t=100000;W.__XP.job=-1;W.__XP.jt=0;
    for(let i=0;i<20;i++){const id='zombieFriend'+i,x=-6+(i%5)*2,z=6+Math.floor(i/5)*2;G.players.set(id,{uid:id,x,z,y:W.__GY,tx:x,tz:z,ty:W.__GY,ry:0,g:i%5,n:'친구'+(i+1),mv:false,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});}
    W.__z78Step=n=>{for(let i=0;i<n;i++)W.__advance(1000/60);};
   });
   const shots=[];
   for(const name of ['near-day','near-night','pursuit','crowd-92']){
    const shot=await page.evaluate(name=>{const W=window,P=W.__PL,G=W.__G,R=W.__R,T=W.__THREE,crowd=name==='crowd-92',pursuit=name==='pursuit',night=name!=='near-day';
     W.__DBG().noLogic=false;G.phase='day';G.wolves.length=0;W.__WOLF_DEAD.length=0;G.day=3;G.nk=name==='near-night'?3:5;
     const x=crowd?10:pursuit?11:11,z=crowd?30:pursuit?23:19;
     Object.assign(P,{x,z,y:W.__GY,vx:0,vz:0,vy:0,ground:true,down:false,mv:false,_px:x,_pz:z,yaw:0,pitch:crowd?-.22:0});W.__camZoom(crowd?8:pursuit?3.2:1.4);W.__z78Step(60);
     W.__setSky(night?1:0);W.__updSky(0,true);W.__DBG().noLogic=true;G.phase=night?'night':'day';
     const kinds=[0,1,2,8,9,10,11,12],n=crowd?92:pursuit?8:3,actors=[];
     for(let i=0;i<n;i++){const k=crowd||pursuit?kinds[i%8]:0,tx=crowd?3+(i%10)*1.5:pursuit?6+(i%4)*3:9+(i%3)*2,tz=crowd?6+Math.floor(i/10)*1.6:pursuit?12+Math.floor(i/4)*4:15;
      actors.push({k,id:3+i,ph:.31+i*.13,x:tx,z:tz,y:W.__GY,ry:0,hp:100,mx:100,mv:pursuit,atkT:0,hurt:0,shT:pursuit,poseChase:pursuit?1:0,posePreyWas:pursuit,gv:pursuit?4.8:0,lx:tx,lz:tz,gp:i*.83});}
     for(let f=0;f<60;f++){for(const w of actors)if(pursuit)w.z+=.016;W.__drawWolves(actors,4+f/60,1/60);}
     const meshes=W.__charMeshes()['좀비'],counts=meshes.map(m=>({count:m.count,capacity:m.instanceMatrix.count,triangles:(m.geometry.index?.count||m.geometry.attributes.position.count)/3}));
     const t=W.__realNow();for(let f=0;f<60;f++)W.__drawWolves(actors,5+f/60,1/60);const updateMs=(W.__realNow()-t)/60;
     W.__drawWolves(actors,6,1/60);W.__drawFrame();const png=R.domElement.toDataURL('image/png'),lights=[];W.__scene.traverse(o=>{if(o.isLight)lights.push(o.type);});
     return {name,png,players:G.players.size+1,zombies:actors.length,counts,updateMs,calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},quality:{...W.__GFX},lights,
      camera:{x:W.__cam.position.x,y:W.__cam.position.y,z:W.__cam.position.z,fov:W.__cam.fov},finite:meshes.every(m=>m.count<=m.instanceMatrix.count&&Array.from(m.instanceMatrix.array.slice(0,m.count*16)).every(Number.isFinite))};
    },name);
    fs.writeFileSync(path.join(out,`${label}-${name}.png`),Buffer.from(shot.png.split(',')[1],'base64'));delete shot.png;shots.push(shot);console.log(label+' '+name+' '+shot.calls+' calls / '+shot.triangles+' triangles');
   }
   // Auxiliary detail sheet uses the same actual geometry/materials, clearly separate from normal play evidence.
   const sheet=await page.evaluate(()=>{const W=window,T=W.__THREE,R=W.__R,cols=4,cell=320,size=1280,meshes=W.__charMeshes()['좀비'].slice(0,-4);
    W.__G.phase='day';W.__G.day=3;W.__setSky(0);W.__updSky(0,true);R.setPixelRatio(1);R.setSize(size,size,false);R.setRenderTarget(null);R.setScissorTest(false);R.setClearColor(0xdbe6e6,1);R.clear();R.setScissorTest(true);
    const cards=[...W.__WOLF_T.map((d,k)=>({k,nk:5,label:d.n})),...[0,3,7].map(nk=>({k:0,nk,label:['모자','붕대','망토'][[0,3,7].indexOf(nk)]}))],labels=[];
    cards.forEach((c,i)=>{W.__G.nk=c.nk;const def=W.__WOLF_T[c.k],a={k:c.k,id:3+i,ph:.31+i*.13,x:0,z:0,y:W.__GY,ry:0,hp:100,mx:100,mv:false,atkT:0,hurt:0,shT:false};W.__drawWolves([a],4,1/60);
     const sc=new T.Scene(),group=new T.Group();group.position.y=-W.__GY;sc.add(group);for(const m of meshes)if(m.count){const cp=m.clone();cp.instanceMatrix=m.instanceMatrix.clone();if(m.instanceColor)cp.instanceColor=m.instanceColor.clone();cp.frustumCulled=false;group.add(cp);}
     for(const l of W.__scene.children.filter(o=>o.isLight)){const cp=l.clone();cp.castShadow=false;sc.add(cp);if(cp.target)sc.add(cp.target);}
     const fill=new T.DirectionalLight(0xe8efff,.4);fill.position.set(-3,4,6);sc.add(fill);const scale=def.sc,span=1.70*scale,cam=new T.OrthographicCamera(-span/2,span/2,span/2,-span/2,.05,80),m=new T.Matrix4();W.__wolfMesh('head').getMatrixAt(0,m);const head=new T.Vector3().setFromMatrixPosition(m);cam.position.set(.9*scale,head.y-W.__GY+.12*scale,6*scale);cam.lookAt(0,head.y-W.__GY-.1*scale,0);
     const x=i%cols*cell,y=Math.floor(i/cols)*cell;R.setViewport(x+4,size-y-cell+24,cell-8,cell-28);R.setScissor(x+4,size-y-cell+24,cell-8,cell-28);R.render(sc,cam);labels.push({label:c.label,x,y:y+cell-18});});
    R.setScissorTest(false);const image=R.domElement.toDataURL('image/png');return {image,labels};
   });
   fs.writeFileSync(path.join(out,`${label}-detail-sheet.png`),Buffer.from(sheet.image.split(',')[1],'base64'));fs.writeFileSync(path.join(out,`${label}-detail-labels.json`),JSON.stringify(sheet.labels,null,2));
   results.push({label,shots});
  }finally{await page?.close();await new Promise(r=>server.close(r));}
 }
 fs.writeFileSync(path.join(out,'view-probe.json'),JSON.stringify({results,errors},null,2));
 const compared=results[0].shots.map((b,i)=>{const a=results[1].shots[i];assert.deepEqual(a.quality,b.quality);assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.lights,b.lights);assert.deepEqual(a.counts,b.counts,'Exactly the same zombie instances/triangles/capacities');assert.deepEqual(a.memory,b.memory,'No textures or geometries added');assert.ok(a.finite&&a.players===21);assert.ok(a.calls<=b.calls+2,'No new zombie draw banks; allow boundary shadow culling');return {name:a.name,calls:[b.calls,a.calls],triangles:[b.triangles,a.triangles],updateMs:[b.updateMs,a.updateMs],memory:[b.memory,a.memory]};});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'view.json'),JSON.stringify({sourceSha256:crypto.createHash('sha256').update(current).digest('hex'),baseline,control:'Same current world; only zombie visuals restored from build76',results,compared,errors,limitations:'CPU update timings are a short sample; software rendering is not LG Gram FPS. Auxiliary sheet adds a fill light only for inspection.'},null,2));console.log(JSON.stringify(compared,null,2));console.log('PASS zombie art, same 21-player quality and geometry budgets');
}finally{await browser?.close();}
