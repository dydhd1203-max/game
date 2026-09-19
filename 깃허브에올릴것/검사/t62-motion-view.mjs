// Continuous real WebGL frames at the game's .7 scale. Original instance meshes,
// materials, lights and drawFrame pipeline are used; no cloned gallery materials.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const out=path.resolve('artifacts/62-motion');fs.mkdirSync(out,{recursive:true});
const server=serve(8962,process.argv[2]||GAME),errors=[],reports=[];let browser;
const check=(name,ok,detail)=>{reports.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(detail));};
try{
 browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
 for(const quality of ['low','high']){
  const page=await browser.newPage({viewport:{width:720,height:600}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader|GL_INVALID|compile/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:8962/?gfx='+quality);
  await page.waitForFunction(()=>window.__READY);
  await page.evaluate(()=>{document.getElementById('iName').value='연속 동작 검사';document.getElementById('bSolo').click();});
  await page.waitForFunction(()=>window.__G.started);
  const local=await page.evaluate(()=>{
   const W=window,T=W.__THREE,R=W.__R,S=W.__scene,P=W.__PL,G=W.__G;
   G.paused=true;G.mini=null;G.players.clear();Object.assign(W.__DBG(),{noLogic:true,noInst:true,noRender:true});
   // Exercise the real local player movement/gait path, then compare the remote
   // gait clock over those same positions. This catches differing local cadence.
   const clocks=[];W.__XP.job=-1;W.__XP.jt=0;
   for(const run of [false,true]){
    W.__kbReset();Object.assign(W.__KEY,{d:true,shift:run});
    Object.assign(P,{x:0,z:0,y:W.__groundUnder(0,0,P.R),yaw:0,pitch:0,vx:0,vz:0,vy:0,ground:true,down:false,_px:undefined,_pz:undefined});
    const remote={x:P.x,z:P.z,run},g=W.__sheepGait(remote,0),begin=W.__gaitMe();
    let distance=0,last=P.x;
    for(let i=1;i<=60;i++){
     W.__updPlayer(1/60);distance+=Math.abs(P.x-last);last=P.x;
     remote.x=P.x;remote.z=P.z;remote.air=!P.ground;W.__sheepGait(remote,i/60);
    }
    clocks.push({run,distance,local:(W.__gaitMe()-begin)/(2*Math.PI),remote:g.gp/(2*Math.PI)});
   }
   W.__kbReset();
   const keep=new Set([...W.__charMeshes().사람,...W.__gunMeshes(),...W.__P_wing(),...W.__P_wingG()]);
   S.children.forEach(o=>{if(!keep.has(o)&&!o.isLight)o.visible=false;});S.fog=null;S.background=new T.Color(0xe4ebe6);
   document.querySelectorAll('body > :not(canvas)').forEach(e=>e.style.display='none');
   R.domElement.style.cssText='position:fixed;inset:0;display:block';R.setPixelRatio(1);R.setSize(720,600,false);
   W.__motionShots=[];return {clocks,scale:W.__avatarRender().scale,shadow:R.shadowMap.enabled};
  });
  check(quality+' actual local and remote movement use a bounded cadence',local.clocks.every(c=>c.distance>2&&c.local>.5&&c.local<=2.01&&Math.abs(c.local-c.remote)<.08),local);
  const frames=await page.evaluate(()=>{
   const W=window,T=W.__THREE,C=W.__cam,R=W.__R,scale=W.__avatarRender().scale;
   let count=0,finite=true;const outfits=[];
   const canvas=document.createElement('canvas');canvas.width=720;canvas.height=600;const ctx=canvas.getContext('2d',{willReadFrequently:true});
   for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++){
    let minPixels=Infinity,maxPixels=0;
    const s={x:0,y:9,z:0,ry:Math.PI,me:true,ph:0,mv:true,run:true,jb,jt,hat:0,clo:0,gls:0,wp:0};
    for(let frame=0;frame<72;frame++){
     const t=frame/30,angle=frame<24?Math.PI/2:frame<48?Math.PI/4:-Math.PI/2;
     s.x+=Math.sin(angle)*8/30;s.z+=Math.cos(angle)*8/30;
     W.__drawSheep([s],t,40,()=>0x68acbb,scale);
     C.position.set(s.x+1.8,s.y+1.55,s.z+2.3);C.lookAt(s.x,s.y+.65,s.z);C.updateMatrixWorld(true);W.__drawFrame();count++;
     const m=new T.Matrix4();for(const mesh of W.__Pmesh())for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);finite&&=m.elements.every(Number.isFinite);}
     // Sample real rendered visibility every sixth frame, including direction switches.
     if(frame%6===0){
      ctx.drawImage(R.domElement,0,0);const p=ctx.getImageData(0,0,720,600).data,b=[p[0],p[1],p[2]];let pixels=0;
      for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-b[0])+Math.abs(p[i+1]-b[1])+Math.abs(p[i+2]-b[2])>24)pixels++;
      minPixels=Math.min(minPixels,pixels);maxPixels=Math.max(maxPixels,pixels);
     }
     if([18,36,60].includes(frame))W.__motionShots.push({label:`직업 ${jb+1} · ${jt}차 · ${frame===18?'옆걸음':frame===36?'사선 달리기':'반대 방향 전환'}`,src:R.domElement.toDataURL()});
    }
    outfits.push({jb,jt,minPixels,maxPixels});
   }
   return {count,finite,outfits,contextLost:R.getContext().isContextLost()};
  });
  // Compare within each outfit: the second-tier aura adds a large white ring.
  check(quality+' all six job outfits stay visible throughout direction changes',frames.finite&&!frames.contextLost&&frames.outfits.every(o=>o.minPixels>5000&&o.maxPixels/o.minPixels<1.6),frames);
  await page.evaluate(async()=>{
   const panel=document.createElement('div');panel.style.cssText='position:absolute;inset:0;z-index:100100;display:grid;grid-template-columns:repeat(3,1fr);background:#e4ebe6';
   for(const shot of window.__motionShots){const card=document.createElement('div'),label=document.createElement('div'),im=document.createElement('img');
    card.style.cssText='position:relative';im.src=shot.src;im.style.cssText='display:block;width:100%';label.textContent=shot.label;
    label.style.cssText='position:absolute;top:12px;left:12px;color:#29435a;font:16px Arial';card.append(im,label);panel.append(card);}
   document.body.append(panel);await Promise.all([...panel.querySelectorAll('img')].map(im=>im.decode()));
  });
  await page.setViewportSize({width:1200,height:2000});
  await page.screenshot({path:path.join(out,quality+'-continuous.png'),fullPage:true});
  await page.close();
 }
 check('Continuous WebGL sequence has no JavaScript or shader errors',errors.length===0,errors);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(reports,null,2));
 console.log(`${reports.filter(r=>r.ok).length}/${reports.length} continuous WebGL checks passed.`);
 process.exitCode=reports.every(r=>r.ok)?0:1;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
