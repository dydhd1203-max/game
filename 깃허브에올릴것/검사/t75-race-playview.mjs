// Honest player-view regression for the empty starting plaza reported in 74.
// The first ten seconds use no camera overrides or player teleports after entry.
// Subsequent section/material probes explicitly teleport the player, then let
// the normal camera settle; they supplement the true start/run screenshots.
// Projected bounds are only a visibility
// precondition, not an occlusion/beauty metric; inspect the saved PNGs as well.
// node t75-race-playview.mjs [game.html] [--baseline | --hud-only]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';

const file=path.resolve(process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME);
const version=/const GAME_VER = '(\d+)/.exec(fs.readFileSync(file,'utf8'))?.[1]||'76';
const baseline=process.argv.includes('--baseline'),label=baseline?'baseline75':'race'+version;
const hudOnly=process.argv.includes('--hud-only');
assert.ok(!(baseline&&hudOnly),'HUD capture-only mode uses the current race');
const out=path.resolve('artifacts/race'+version);fs.mkdirSync(out,{recursive:true});
const server=serve(20576,file);let browser;
try {
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{
    const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null;
    window.__realNow=real;window.__captureRaf=raf;window.__freeze=()=>{time=real();};
    window.__advance=ms=>{time+=ms;window.__loop73();};
    performance.now=()=>time===null?real():time;
    requestAnimationFrame=f=>time===null?raf(f):0;
    localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','u75player');
    window.__raceTitleDraws75=new Map();
    const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...rest){
      if(this.font.includes('CloudRaceTitle'))window.__raceTitleDraws75.set(String(text),{
        text:String(text),font:this.font,loaded:document.fonts.check('48px CloudRaceTitle',String(text))});
      return fillText.call(this,text,...rest);
    };
  });
  await page.goto('http://127.0.0.1:20576/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});
  await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
  // External Google font requests are blocked above. The title face must come
  // from the bundled data URL and finish loading before the atlas is inspected.
  await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  await page.evaluate(()=>{
    const W=window,G=W.__G;
    document.getElementById('iName').value='출발 시점 검수';document.getElementById('bSolo').click();
    W.__introDone();document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));
    W.__freeze();W.__DBG().noRender=true;
    G.phase='mini';G.host=false;G.paused=false;G.t=10;
    G.mini={k:0,st:'intro',seed:740021,sc:[0,0,0,0,0],rank:null};
    for(let i=0;i<20;i++){
      const id='urace'+String(i).padStart(2,'0');
      G.players.set(id,{uid:id,x:0,y:W.__MINI().Y,z:0,tx:0,ty:W.__MINI().Y,tz:0,
        ry:Math.PI,g:i%5,n:'친구'+(i+1),mv:false,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});
      W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});
    }
    W.__miniEnter();W.__XP.job=-1;W.__XP.jt=0;
    // Remote test players occupy the normal 12-column/two-row starting grid.
    // The local player remains exactly where the actual seeded spawn put them.
    const P=W.__PL,slots=[];
    for(const z of W.__RACE_ROWZ)for(let i=0;i<12;i++){
      const x=(i-5.5)*3;if(Math.hypot(x-P.x,z-P.z)>.5)slots.push({x,z});
    }
    let i=0;for(const q of G.players.values()){
      const s=slots[i++];Object.assign(q,{x:s.x,tx:s.x,y:P.y,ty:P.y,z:s.z,tz:s.z});
    }
    for(let f=0;f<90;f++)W.__advance(1000/60);
  });
  const result=hudOnly?JSON.parse(fs.readFileSync(path.join(out,`${label}-playview.json`),'utf8')):await page.evaluate(()=>{
    const W=window,G=W.__G,P=W.__PL,R=W.__R,C=W.__cam,KEY=W.__KEY,Y=W.__MINI().Y;
    const captures=[],timings=[],events=[],overflow=[],capsules=[],toys=[],donuts=[],jumpMarks=[],cameraChecks=[],donutShapes=new Map();
    const cameraCheck=name=>{if(!W.__raceCameraBlocked)return;const cam=W.__cam.position,haz=W.__raceHazards(W.__RACE().t);
      cameraChecks.push({name,distance:W.__camRig().distance,inside:haz.filter(h=>W.__raceCameraBlocked(h,cam.x,cam.y-Y,cam.z,.08)).map(h=>h.id),
        floors:W.__raceCameraFloorBlocked?W.__RACE_P().filter(p=>W.__raceCameraFloorBlocked(p,cam.x,cam.y,cam.z,.18)).map(p=>p.id):[]});};
    const energyRead=()=>{W.__paintMini();const board=document.getElementById('raceBoard76'),bar=document.getElementById('r76EnergyBar'),fill=document.getElementById('r76EnergyFill');
      const box=bar?.getBoundingClientRect(),style=bar?getComputedStyle(bar):null;
      return {visible:!!(board?.classList.contains('on')&&box?.width>0&&box?.height>0&&style?.visibility!=='hidden'),
        value:bar?Number(bar.getAttribute('aria-valuenow')):null,fill:fill?parseFloat(fill.style.width):null,stamina:W.__stamina(),
        rank:document.getElementById('r76Rank')?.textContent,time:document.getElementById('r76Time')?.textContent,
        label:document.getElementById('r76EnergyNum')?.textContent};};
    const start={x:P.x,y:P.y,z:P.z,yaw:P.yaw,pitch:P.pitch};
    const allHazards=W.__raceHazards(W.__RACE().t);
    const kinds=[...new Set(allHazards.map(h=>h.k))];
    // Conservative screen-space bounds from actual hazard positions and the
    // actual player camera. No test-only camera is allowed to make them visible.
    const projectedHazards=()=>W.__raceHazards(W.__RACE().t).flatMap(h=>{
      let ex=h.r,ey=h.r,ez=h.r;
      if(h.k==='bar'){
        const half=Math.max(0,h.len/2-h.r);
        ex=Math.abs(Math.cos(h.ang))*half+h.r;ez=Math.abs(Math.sin(h.ang))*half+h.r;
      }else if(h.k==='punch')ey=(h.h||h.r*2)/2;
      const center=C.position.clone().set(h.x,Y+h.y,h.z).applyMatrix4(C.matrixWorldInverse);
      if(center.z>=-C.near||Math.abs(h.z-P.z)>125)return [];
      const points=[];
      for(const dx of [-ex,ex])for(const dy of [-ey,ey])for(const dz of [-ez,ez]){
        points.push(C.position.clone().set(h.x+dx,Y+h.y+dy,h.z+dz).project(C));
      }
      const raw={xmin:Math.min(...points.map(v=>v.x)),xmax:Math.max(...points.map(v=>v.x)),
        ymin:Math.min(...points.map(v=>v.y)),ymax:Math.max(...points.map(v=>v.y))};
      const xmin=Math.max(-1,raw.xmin),xmax=Math.min(1,raw.xmax);
      const ymin=Math.max(-1,raw.ymin),ymax=Math.min(1,raw.ymax);
      const width=Math.max(0,xmax-xmin)*innerWidth/2,height=Math.max(0,ymax-ymin)*innerHeight/2;
      return width>=6&&height>=6?[{id:h.id,kind:h.k,width:+width.toFixed(1),height:+height.toFixed(1),
        fullyInFrame:raw.xmin>=-1&&raw.xmax<=1&&raw.ymin>=-1&&raw.ymax<=1,
        distance:+Math.hypot(h.x-P.x,h.z-P.z).toFixed(1)}]:[];
    });
    const verifyInstances=name=>{
      W.__scene.traverse(m=>{if(m.isInstancedMesh&&m.count>m.instanceMatrix.count)
        overflow.push({shot:name,name:m.name,id:m.id,used:m.count,capacity:m.instanceMatrix.count});});
      // Compare real rendered round endcaps against the full vertical capsule.
      // A shaft alone can pass collision tests yet leave a visibly chopped top.
      const art=W.__race74.art(),caps=[art.cap,art.ball].filter(Boolean),mat=C.matrixWorld.clone();
      if(W.__race74.jumpPose)for(const pad of W.__RACE_P().filter(p=>p.bounce?.manual&&Math.abs(p.z-P.z)<=125)){
        const jump=W.__race74.jumpPose(pad,W.__RACE().t),land=W.__race74.landingPose(pad,W.__RACE().t);
        const has=(mesh,xy)=>{for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,mat);const e=mat.elements;
          if(Math.hypot(e[12]-xy.x,e[14]-xy.z)<.015)return true;}return false;};
        if(art.donut){const pose=W.__race74.pose(pad,W.__RACE().t);let perimeter=false;
          for(let i=0;i<art.padTrim.count;i++){art.padTrim.getMatrixAt(i,mat);const e=mat.elements;
            if(Math.hypot(e[12]-pose.x,e[14]-pose.z)<.015&&Math.abs(Math.hypot(e[0],e[1],e[2])-pad.w/2)<.015&&Math.abs(Math.hypot(e[8],e[9],e[10])-pad.d/2)<.015)perimeter=true;}
          jumpMarks.push({shot:name,pad:pad.id,wholePad:true,roundPlatform:pad.shape==='round',
            entranceInstruction:has(art.jump,{x:pose.x,z:pose.z-pad.d*.405}),perimeter,exclusiveZone:pad.bounce.zone!==undefined});
        }else jumpMarks.push({shot:name,pad:pad.id,launch:has(art.jump,jump),landing:has(art.padTrim,land),radius:pad.bounce.zone});
      }
      for(const h of W.__raceHazards(W.__RACE().t).filter(h=>h.k==='punch'&&h.toy77!==undefined&&Math.abs(h.z-P.z)<=120)){
        const target=Y+h.y+h.h/2;let top=null;
        if(h.toy77<3){const mesh=art.toys[h.toy77];mesh.geometry.computeBoundingBox();
          for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,mat);const e=mat.elements;
            if(Math.hypot(e[12]-h.x,e[14]-h.z)<.025){top=e[13]+mesh.geometry.boundingBox.max.y*Math.hypot(e[4],e[5],e[6]);break;}}
        }else for(const s of art.static){const p=s.mesh.geometry.attributes.position;
          for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-h.x)<h.r+.03&&Math.abs(p.getZ(i)-h.z)<h.r&&Math.abs(p.getY(i)-target)<.015){top=p.getY(i);break;}
          if(top!==null)break;
        }
        toys.push({shot:name,id:h.id,form:h.toy77,renderedTop:top,colliderTop:target,aligned:top!==null&&Math.abs(top-target)<.03});
      }
      // Donut obstacles no longer have capsule shafts/endcaps. Verify the actual
      // flavor bank, ring opening, physical torus envelope and instance transform.
      for(const h of W.__raceHazards(W.__RACE().t).filter(h=>h.donut79&&Math.abs(h.z-P.z)<=125)){
        const flavor=h.flavor79,mesh=art.donut?.[flavor];let aligned=false,index=-1,shape=null;
        if(mesh){
          if(!donutShapes.has(mesh.geometry.uuid)){const p=mesh.geometry.attributes.position;let minHole=Infinity,maxShell=0,finite=true;
            for(let v=0;v<p.count;v++){const x=p.getX(v),y=p.getY(v),z=p.getZ(v),rho=Math.hypot(x,y);minHole=Math.min(minHole,rho);maxShell=Math.max(maxShell,Math.hypot(rho-.66,z));finite&&=Number.isFinite(rho+z);}
            donutShapes.set(mesh.geometry.uuid,{minHole,maxShell,finite,triangles:(mesh.geometry.index?.count||p.count)/3});}
          shape=donutShapes.get(mesh.geometry.uuid);
          for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,mat);const e=mat.elements;
            if(Math.hypot(e[12]-h.x,e[13]-Y-h.y,e[14]-h.z)>.025)continue;
            index=i;const expect=C.matrixWorld.clone().makeRotationFromEuler(C.rotation.clone().set(0,h.ry||0,h.rz||0,'YXZ'));
            expect.scale(C.position.clone().set(h.r,h.r,h.r));expect.setPosition(h.x,Y+h.y,h.z);
            aligned=e.every((v,j)=>Math.abs(v-expect.elements[j])<.00005)&&Math.abs(h.h-2*h.r)<.00001;break;
          }
        }
        donuts.push({shot:name,id:h.id,flavor,index,aligned,shape});
      }
      for(const h of W.__raceHazards(W.__RACE().t).filter(h=>h.k==='punch'&&!h.donut79&&h.toy77===undefined&&Math.abs(h.z-P.z)<=125)){
        const target=Y+h.y+Math.max(0,h.h/2-h.r);let top=null;
        for(const ball of caps)for(let i=0;i<ball.count;i++){
          ball.getMatrixAt(i,mat);const e=mat.elements,sy=Math.hypot(e[4],e[5],e[6]);
          if(Math.hypot(e[12]-h.x,e[13]-target,e[14]-h.z)<.025&&Math.abs(sy-h.r)<.025){top=e[13]+sy;break;}}
        capsules.push({shot:name,id:h.id,renderedTop:top,colliderTop:Y+h.y+h.h/2,
          aligned:top!==null&&Math.abs(top-(Y+h.y+h.h/2))<.03});
      }
    };
    const shot=(name,kind='actual-run',extra={})=>{
      R.info.autoReset=false;R.info.reset();W.__drawFrame();
      captures.push({name,kind,...extra,png:R.domElement.toDataURL('image/png'),player:{x:P.x,y:P.y,z:P.z,yaw:P.yaw,pitch:P.pitch},
        camera:{x:C.position.x,y:C.position.y,z:C.position.z,fov:C.fov},potentiallyVisibleHazards:projectedHazards(),
        calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},
        programs:R.info.programs.length,raceArt:{...W.__race74.art().stats},energy:energyRead()});
      verifyInstances(name);cameraCheck(name);
    };
    shot('start-default-camera-21');
    G.mini.st='run';G.t=W.__MINI().RACE;W.__miniOnState();
    let previousHit=0,previousFalling=false,maxViewChange=0;
    for(let f=1;f<=600;f++){
      // Only ordinary keys: move towards the visible center line, then forward.
      // No obstacle-aware path and no immunity. Hits/falls are recorded honestly.
      for(const k of Object.keys(KEY))delete KEY[k];KEY.w=true;
      if(P.x<-.35)KEY.a=true;else if(P.x>.35)KEY.d=true;
      G.t-=1/60;const t=W.__realNow();W.__advance(1000/60);
      if(f>30)timings.push(W.__realNow()-t);
      const S=W.__RACE();
      if(S.hitCd>previousHit+.05)events.push({kind:'hit',seconds:f/60,x:P.x,z:P.z});
      if(S.fallT>0&&!previousFalling)events.push({kind:'fall',seconds:f/60,x:P.x,z:P.z});
      previousHit=S.hitCd;previousFalling=S.fallT>0;
      maxViewChange=Math.max(maxViewChange,Math.abs(P.yaw-start.yaw),Math.abs(P.pitch-start.pitch));
      if([120,300,600].includes(f))shot('run-'+f/60+'s-default-camera-21');
    }
    for(const k of Object.keys(KEY))delete KEY[k];
    const progress=P.z-start.z;
    // Supplemental captures are deliberately labeled as waypoint probes. They
    // cannot replace the unmodified start and ten-second real movement above.
    const settlePlayer=(x,z,y)=>{
      W.__race74.reset();const S=W.__RACE();S.fallT=S.hitCd=S.slipT=0;
      G.mini.st='intro';G.t=10;W.__MINE.fin=-1;
      Object.assign(P,{x,z,y,vx:0,vz:0,vy:0,ground:true,down:false,mv:false,jumps:0,_px:x,_pz:z});
      for(let f=0;f<60;f++)W.__advance(1000/60);
    };
    for(let section=0;section<7;section++){
      const cp=W.__RACE_P().find(p=>p.cp===section+1),y=W.__race74.surface(cp,cp.x,cp.z);
      let i=0;const slots=[];
      for(let row=-1;row<=1;row++)for(let col=-3;col<=3;col++){
        if(row||col)slots.push({x:cp.x+col*4.2,z:cp.z+row*3.6});
      }
      for(const q of G.players.values()){
        const s=slots[i++];Object.assign(q,{x:s.x,tx:s.x,y,ty:y,z:s.z,tz:s.z,mv:false});
      }
      settlePlayer(cp.x,cp.z,y);
      shot('section-probe-'+String(section+1).padStart(2,'0')+'-default-camera-21','section-waypoint',
        {section:section+1,sectionName:W.__RACE_S[section].n});
    }
    // Stand beside the first padded capsule to inspect vinyl, rubber bands and
    // its metal base at ordinary play scale. Friends remain at the last CP.
    const firstPunch=W.__raceHazards(W.__RACE().t).find(h=>h.k==='punch'&&h.toy77===undefined&&h.z<15);
    if(firstPunch){
      // The requested giant is eight metres tall. Step back on the actual
      // floor while retaining the ordinary camera; never crop its top.
      const back=Math.max(3,firstPunch.h*1.7);
      settlePlayer(firstPunch.x+3,firstPunch.z-back,W.__raceTopAt(firstPunch.x+3,firstPunch.z-back));
      shot('material-probe-first-punch-default-camera','material-waypoint',{target:firstPunch.id});
    }
    // Full-energy display is part of the race interface. Exercise real sprint
    // consumption/recovery, rather than forcing the fill or the resource value.
    const energy=[];
    if(document.getElementById('raceBoard76')){
      const cp=W.__RACE_P().find(p=>p.cp===1);settlePlayer(cp.x,cp.z,Y+cp.y);
      G.mini.st='run';G.t=W.__MINI().RACE;W.__setStamina(1);
      for(let f=0;f<20;f++)W.__advance(1000/60);energy.push({phase:'full',...energyRead()});
      KEY.w=KEY.shift=true;
      for(let f=0;f<60;f++){G.t-=1/60;W.__advance(1000/60);}energy.push({phase:'running',...energyRead()});
      for(const k of Object.keys(KEY))delete KEY[k];
      for(let f=0;f<Math.ceil(W.__SPRINT.rest*60)+30;f++){G.t-=1/60;W.__advance(1000/60);}
      energy.push({phase:'recovered',...energyRead()});W.__drawFrame();cameraCheck('post-sprint-hud');
    }
    // Distance is measured from the actual seeded starting slot, not the first
    // checkpoint or the artificial comparison camera used by the older test.
    const earlyHazard=allHazards.filter(h=>h.z>=start.z).sort((a,b)=>a.z-b.z)[0];
    timings.sort((a,b)=>a-b);
    const hazardsBySection=W.__RACE_S.map((s,i)=>{const pads=W.__RACE_P().filter(p=>p.sec===i&&!p.cp&&!p.fin);
      return {section:i+1,name:s.n,count:allHazards.filter(h=>Number.isInteger(h.sec)?h.sec===i:h.z>=s.z0&&h.z<=s.z1).length,
        manualPads:pads.filter(p=>p.bounce?.manual).length,movingPads:pads.filter(p=>p.mv).length,
        incline:pads.some(p=>p.yEnd>p.y),slide:pads.some(p=>p.shape==='slide'),final:pads.some(p=>p.kind==='final')};});
    const font={faces:[...document.fonts].filter(f=>f.family.replaceAll('"','')==='CloudRaceTitle')
      .map(f=>({family:f.family,status:f.status})),draws:[...W.__raceTitleDraws75.values()],externalFontsBlocked:true};
    return {fileVersion:document.title,seed:G.mini.seed,players:G.players.size+1,viewport:{width:innerWidth,height:innerHeight},
      start,captures,events,progress,maxViewChange,pointerLocked:!!document.pointerLockElement,font,capsules,toys,donuts,jumpMarks,energy,cameraChecks,
      hazards:{count:allHazards.length,kinds,firstDistance:earlyHazard?earlyHazard.z-start.z:null,bySection:hazardsBySection},
      graphics:{...W.__GFX,width:R.domElement.width,height:R.domElement.height},
      noRenderCpuMs:{p50:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)],samples:timings.length},
      overflow,renderer:R.getContext().getParameter(R.getContext().RENDERER)};
  });
  if(!baseline){
    if(hudOnly)await page.evaluate(()=>{const W=window,P=W.__PL,G=W.__G,cp=W.__RACE_P().find(p=>p.cp===1);
      W.__race74.reset();Object.assign(W.__RACE(),{t:0,on:true,fallT:0,hitCd:0,slipT:0});
      G.mini.st='run';G.t=W.__MINI().RACE;W.__MINE.cp=1;W.__MINE.fin=-1;W.__setStamina(1);
      Object.assign(P,{x:cp.x,z:cp.z,y:W.__MINI().Y+cp.y,vx:0,vz:0,vy:0,ground:true,down:false,jumps:0,_px:cp.x,_pz:cp.z});
      for(let i=0;i<60;i++)W.__advance(1000/60);});
    // A resize event can clear the WebGL buffer after setViewportSize resolves.
    // Wait for the renderer's actual size, then use native RAF while the game
    // clock stays frozen. Inspect the saved screenshot itself, not a separate
    // canvas export, so a blank compositor frame can never pass as evidence.
    const fullFrame=async name=>{
      await page.waitForFunction(()=>{const c=window.__R.domElement;
        return c.clientWidth===innerWidth&&c.clientHeight===innerHeight;},null,{polling:50});
      await page.evaluate(()=>new Promise(resolve=>{let frames=0;window.__captureDrawing=true;
        const draw=()=>{if(!window.__captureDrawing)return;window.__paintMini();window.__drawFrame();
          if(++frames===2)resolve();window.__captureRaf(draw);};window.__captureRaf(draw);}));
      let png,probe;
      try{
        png=await page.screenshot({animations:'disabled'});
        probe=await page.evaluate(src=>new Promise((resolve,reject)=>{const img=new Image();
          img.onerror=()=>reject(new Error('Could not decode the saved screenshot'));
          img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=96;
            const ctx=c.getContext('2d');ctx.drawImage(img,img.width*.25,img.height*.3,img.width*.5,img.height*.5,0,0,96,96);
            const pixels=ctx.getImageData(0,0,96,96).data,counts=new Map();
            for(let i=0;i<pixels.length;i+=4){const key=(pixels[i]>>3)*1024+(pixels[i+1]>>3)*32+(pixels[i+2]>>3);counts.set(key,(counts.get(key)||0)+1);}
            resolve({colors:counts.size,dominantFraction:Math.max(...counts.values())/(96*96)});};img.src=src;
        }),`data:image/png;base64,${png.toString('base64')}`);
      }finally{await page.evaluate(()=>{window.__captureDrawing=false;});}
      assert.ok(probe.colors>=32&&probe.dominantFraction<.97,`${name}: screenshot must include a rendered game scene, not a blank resized canvas (${JSON.stringify(probe)})`);
      fs.writeFileSync(path.join(out,`${label}-${name}.png`),png);return probe;
    };
    // Performance diagnostics are a test overlay, not game UI. Hide only that
    // overlay so full-page captures can actually show the race scoreboard.
    await page.evaluate(()=>{for(const e of document.body.children)if(e.style.zIndex==='99999'&&e.style.whiteSpace==='pre'&&e.style.pointerEvents==='none')e.style.display='none';});
    result.hudLayouts=[];
    for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:480,height:900}]){
      await page.setViewportSize(viewport);
      await page.evaluate(()=>{window.__paintMini();window.__drawFrame();});
      result.hudLayouts.push(await page.evaluate(()=>{const e=document.getElementById('raceBoard76'),r=e.getBoundingClientRect();
        return {width:innerWidth,height:innerHeight,visible:e.classList.contains('on'),x:r.x,y:r.y,right:r.right,bottom:r.bottom,
          scroll:e.scrollWidth,client:e.clientWidth,total:document.getElementById('r76Total')?.textContent,
          energy:document.getElementById('r76EnergyBar')?.getAttribute('aria-valuenow')};}));
      result.hudLayouts.at(-1).sceneProbe=await fullFrame(`hud-${viewport.width}`);
    }
    await page.setViewportSize({width:1366,height:768});
    result.donutShots=[];
    await page.evaluate(()=>{const W=window,P=W.__PL,G=W.__G,pad=W.__RACE_P().find(p=>p.bounce?.manual);
      const next=W.__RACE_P().find(p=>p.bounce?.manual&&p.z>pad.z),jump=W.__race74.jumpPose(pad,0),land=W.__race74.landingPose(next,0);
      W.__donutCaptureDestination={id:next.id,x:land.x,z:land.z};
      W.__race74.reset();Object.assign(W.__RACE(),{t:0,on:true,fallT:0,hitCd:0,slipT:0});G.mini.st='run';G.t=W.__MINI().RACE;W.__MINE.cp=3;W.__MINE.fin=-1;
      for(const k of Object.keys(W.__KEY))delete W.__KEY[k];
      Object.assign(P,{x:jump.x,z:jump.z,y:W.__MINI().Y+pad.y,vx:0,vz:0,vy:0,ground:true,down:false,jumps:0,yaw:Math.PI,pitch:-.22,_px:jump.x,_pz:jump.z});
      for(let i=0;i<12;i++)W.__advance(1000/60);W.__KEY.w=true;W.__KEY[' ']=true;W.__wantJump();});
    for(const phase of ['apex','landing']){
      const sample=await page.evaluate(phase=>{const W=window,P=W.__PL;let found=false;
        for(let i=0;i<180;i++){const wasAir=!P.ground,oldVy=P.vy;
          if(W.__race74.state.flightKind==='manual'){
            const target=W.__donutCaptureDestination.x-P.vx*.25;W.__KEY.w=false;
            W.__KEY.a=P.x<target-.18;W.__KEY.d=P.x>target+.18;
          }
          W.__G.t-=1/60;W.__advance(1000/60);
          if(phase==='apex'&&W.__race74.state.flight>0&&oldVy>0&&P.vy<=0){found=true;break;}
          if(phase==='landing'&&wasAir&&P.ground){found=W.__race74.under()?.id===W.__donutCaptureDestination.id;break;}}
        W.__paintMini();W.__drawFrame();return {phase,found,x:P.x,z:P.z,height:P.y-W.__MINI().Y,vy:P.vy,ground:P.ground,
          landingPad:W.__race74.under()?.id,expectedPad:W.__donutCaptureDestination.id,
          stage:document.getElementById('r76Stage')?.textContent,energy:document.getElementById('r76EnergyBar')?.getAttribute('aria-valuenow')};},phase);
      sample.sceneProbe=await fullFrame(`donut-${phase}-hud`);result.donutShots.push(sample);
    }
  }
  for(const c of result.captures)if(c.png){fs.writeFileSync(path.join(out,`${label}-${c.name}.png`),Buffer.from(c.png.split(',')[1],'base64'));delete c.png;}
  if(hudOnly)result.hudRecapturedAt=new Date().toISOString();
  fs.writeFileSync(path.join(out,`${label}-playview.json`),JSON.stringify({...result,errors},null,2));
  console.log(JSON.stringify({...result,errors},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(result.overflow,[]);
  if(!baseline)assert.ok(result.donutShots?.length===2&&result.donutShots.every(s=>s.found),
    'Capture the actual buoyant apex and steered landing on the next donut, never a checkpoint respawn');
  assert.equal(result.players,21);assert.equal(result.pointerLocked,false);
  assert.equal(result.graphics.pr,.85);assert.equal(result.graphics.shadow,2048);
  assert.equal(result.graphics.aa,2);assert.equal(result.graphics.shHz,0);
  assert.ok(result.maxViewChange<1e-8,'Ordinary obstacle movement must preserve the chosen view direction');
  assert.ok(result.captures.every(c=>c.raceArt.materials<=3&&c.raceArt.textures<=2&&c.raceArt.visibleDraws<=15&&c.raceArt.overflow===0),
    'Detailed race scenery retains the shared-material/draw/capacity budget');
  if(!baseline){
    if(!hudOnly)assert.ok(result.cameraChecks.length>=13&&result.cameraChecks.every(q=>q.inside.length===0&&q.floors.length===0),
      'Every actual captured camera, including the post-sprint giant-bumper regression, stays outside the visible obstacle volume');
    assert.ok(result.hazards.count>=80&&result.hazards.count<=128,'The seven distinct challenges retain a bounded total obstacle pool');
    assert.ok(result.hazards.kinds.length>=2,'The course includes at least two different real obstacle motions');
    assert.ok(result.hazards.firstDistance>0&&result.hazards.firstDistance<=35,'The first obstacle is within the first 35 m of the actual spawn');
    assert.ok(result.captures[0].potentiallyVisibleHazards.length>0,'At least one nearby obstacle occupies the actual starting camera view');
    assert.ok(result.events.some(e=>e.kind==='hit'),'A naive ten-second forward run must encounter a real obstacle; it must not be scenery only');
    const sections=result.hazards.bySection;
    assert.ok(sections[0].count>=26&&sections[1].count>=5&&sections[2].manualPads===4&&sections[3].incline&&sections[3].count>0&&
      sections[4].movingPads>=7&&sections[5].slide&&sections[6].final,
      'Every named section exposes its intended physical challenge: punch bags, sweeps, Space donuts, uphill rocks, moving gaps, steep slide, and final launch');
    assert.equal(result.captures.filter(c=>c.kind==='section-waypoint').length,7,'Save all seven section entry views through the ordinary player camera');
    assert.ok(result.font.faces.some(f=>f.status==='loaded'),'The bundled rounded title font loads with external font requests blocked');
    assert.ok(result.hazards.bySection.every(s=>result.font.draws.some(d=>d.text===s.name&&d.loaded&&d.font.includes('CloudRaceTitle'))),
      'Every section title was actually painted with the loaded bundled face');
    assert.ok(result.capsules.length>0&&result.capsules.every(c=>c.aligned),'Rendered padded capsule endcaps match their full collider height in all captured sections');
    if(Number(version)>=79)assert.ok(result.donuts?.length>=48&&new Set(result.donuts.map(d=>d.flavor)).size===3&&result.donuts.every(d=>
      d.aligned&&d.index>=0&&d.shape?.finite&&d.shape.minHole>.30&&d.shape.maxShell<.401&&d.shape.triangles<3000),
      'Every captured donut uses its actual flavor bank and torus transform, retains a real hole, and stays within its 3,000-triangle envelope');
    if(result.toys?.length)assert.ok(result.toys.every(c=>c.aligned)&&new Set(result.toys.map(c=>c.form)).size===5,
      'Three entrance toys and both baked candy-border silhouettes occupy their actual collision height');
    if(result.jumpMarks?.length)assert.ok(result.jumpMarks.every(m=>m.wholePad?
      m.roundPlatform&&m.entranceInstruction&&m.perimeter&&!m.exclusiveZone:m.launch&&m.landing&&m.radius===2.5),
      'Whole-pad spring islands retain their entrance instructions and full perimeter; older releases retain their matching restricted markers');
    const detail=result.captures.find(c=>c.kind==='material-waypoint');
    assert.ok(detail?.potentiallyVisibleHazards.some(h=>h.id===detail.target&&h.fullyInFrame),
      'The ordinary-camera material detail includes the complete first punch capsule without clipping its top');
    assert.ok(result.captures.filter(c=>c.kind==='actual-run'&&c.name.startsWith('run-')).every(c=>c.energy.visible),
      'Race energy stays visible during ordinary movement even without sprint input');
    assert.equal(result.energy.length,3,'Exercise the full, consumed and recovered race-energy display');
    assert.ok(result.energy.every(e=>e.visible&&Math.abs(e.value-e.stamina*100)<=1&&Math.abs(e.fill-e.stamina*100)<=1),
      'Visible race energy matches the real stamina in both accessible value and fill width');
    assert.ok(result.energy[0].value===100&&result.energy[1].value<90&&result.energy[2].value===100,
      'A real sprint drains race energy, and stopping restores it while keeping the bar visible');
    assert.ok(result.hudLayouts.length===3&&result.hudLayouts.every(v=>v.visible&&v.x>=0&&v.y>=0&&v.right<=v.width+1&&v.bottom<v.height&&v.scroll<=v.client+1&&/21/.test(v.total)),
      'The scoreboard fits 1920, 1366 and 480 pixel layouts and counts all 21 classmates');
    assert.ok(result.donutShots.length===2&&result.donutShots.every(v=>v.found)&&result.donutShots[0].height>22&&result.donutShots[1].ground,
      'Full-page ordinary-camera screenshots show the actual high donut apex and its next landing with the scoreboard');
  }
  console.log(`PASS: ${label} actual start/player camera, 21 avatars, visible obstacle bounds, actual encounters, unchanged mid quality`);
} finally {await browser?.close();await new Promise(r=>server.close(r));}
