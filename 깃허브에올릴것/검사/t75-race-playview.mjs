// Honest player-view regression for the empty starting plaza reported in 74.
// The first ten seconds use no camera overrides or player teleports after entry.
// Subsequent section/material probes explicitly teleport the player, then let
// the normal camera settle; they supplement the true start/run screenshots.
// Projected bounds are only a visibility
// precondition, not an occlusion/beauty metric; inspect the saved PNGs as well.
// node t75-race-playview.mjs [game.html] [--baseline]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';

const file=path.resolve(process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME);
const baseline=process.argv.includes('--baseline'),label=baseline?'baseline74':'race75';
const out=path.resolve('artifacts/race75');fs.mkdirSync(out,{recursive:true});
const server=serve(20576,file);let browser;
try {
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{
    const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null;
    window.__realNow=real;window.__freeze=()=>{time=real();};
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
  const result=await page.evaluate(()=>{
    const W=window,G=W.__G,P=W.__PL,R=W.__R,C=W.__cam,KEY=W.__KEY,Y=W.__MINI().Y;
    const captures=[],timings=[],events=[],overflow=[],capsules=[];
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
      const ball=W.__race74.art().ball,mat=C.matrixWorld.clone();
      for(const h of W.__raceHazards(W.__RACE().t).filter(h=>h.k==='punch'&&Math.abs(h.z-P.z)<=125)){
        const target=Y+h.y+Math.max(0,h.h/2-h.r);let top=null;
        for(let i=0;i<ball.count;i++){
          ball.getMatrixAt(i,mat);const e=mat.elements,sy=Math.hypot(e[4],e[5],e[6]);
          if(Math.hypot(e[12]-h.x,e[13]-target,e[14]-h.z)<.025&&Math.abs(sy-h.r)<.025){top=e[13]+sy;break;}
        }
        capsules.push({shot:name,id:h.id,renderedTop:top,colliderTop:Y+h.y+h.h/2,
          aligned:top!==null&&Math.abs(top-(Y+h.y+h.h/2))<.03});
      }
    };
    const shot=(name,kind='actual-run',extra={})=>{
      R.info.autoReset=false;R.info.reset();W.__drawFrame();
      captures.push({name,kind,...extra,png:R.domElement.toDataURL('image/png'),player:{x:P.x,y:P.y,z:P.z,yaw:P.yaw,pitch:P.pitch},
        camera:{x:C.position.x,y:C.position.y,z:C.position.z,fov:C.fov},potentiallyVisibleHazards:projectedHazards(),
        calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},
        programs:R.info.programs.length,raceArt:{...W.__race74.art().stats}});
      verifyInstances(name);
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
    const firstPunch=W.__raceHazards(W.__RACE().t).find(h=>h.k==='punch'&&Math.abs(h.x)<2&&h.z<15);
    if(firstPunch){
      settlePlayer(3,0,W.__raceTopAt(3,0));
      shot('material-probe-first-punch-default-camera','material-waypoint',{target:firstPunch.id});
    }
    // Distance is measured from the actual seeded starting slot, not the first
    // checkpoint or the artificial comparison camera used by the older test.
    const earlyHazard=allHazards.filter(h=>h.z>=start.z).sort((a,b)=>a.z-b.z)[0];
    timings.sort((a,b)=>a-b);
    const hazardsBySection=W.__RACE_S.map((s,i)=>({section:i+1,name:s.n,
      count:allHazards.filter(h=>Number.isInteger(h.sec)?h.sec===i:h.z>=s.z0&&h.z<=s.z1).length}));
    const font={faces:[...document.fonts].filter(f=>f.family.replaceAll('"','')==='CloudRaceTitle')
      .map(f=>({family:f.family,status:f.status})),draws:[...W.__raceTitleDraws75.values()],externalFontsBlocked:true};
    return {fileVersion:document.title,seed:G.mini.seed,players:G.players.size+1,viewport:{width:innerWidth,height:innerHeight},
      start,captures,events,progress,maxViewChange,pointerLocked:!!document.pointerLockElement,font,capsules,
      hazards:{count:allHazards.length,kinds,firstDistance:earlyHazard?earlyHazard.z-start.z:null,bySection:hazardsBySection},
      graphics:{...W.__GFX,width:R.domElement.width,height:R.domElement.height},
      noRenderCpuMs:{p50:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)],samples:timings.length},
      overflow,renderer:R.getContext().getParameter(R.getContext().RENDERER)};
  });
  for(const c of result.captures){fs.writeFileSync(path.join(out,`${label}-${c.name}.png`),Buffer.from(c.png.split(',')[1],'base64'));delete c.png;}
  fs.writeFileSync(path.join(out,`${label}-playview.json`),JSON.stringify({...result,errors},null,2));
  console.log(JSON.stringify({...result,errors},null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(result.overflow,[]);
  assert.equal(result.players,21);assert.equal(result.pointerLocked,false);
  assert.equal(result.graphics.pr,.85);assert.equal(result.graphics.shadow,2048);
  assert.equal(result.graphics.aa,2);assert.equal(result.graphics.shHz,0);
  assert.ok(result.maxViewChange<1e-8,'Ordinary obstacle movement must preserve the chosen view direction');
  assert.ok(result.captures.every(c=>c.raceArt.materials<=3&&c.raceArt.textures<=2&&c.raceArt.visibleDraws<=12&&c.raceArt.overflow===0),
    'Detailed race scenery retains the shared-material/draw/capacity budget');
  if(!baseline){
    assert.ok(result.hazards.count>=12&&result.hazards.count<=64,'The long obstacle course needs repeated real challenges, inside the 64-obstacle budget');
    assert.ok(result.hazards.kinds.length>=2,'The course includes at least two different real obstacle motions');
    assert.ok(result.hazards.firstDistance>0&&result.hazards.firstDistance<=35,'The first obstacle is within the first 35 m of the actual spawn');
    assert.ok(result.captures[0].potentiallyVisibleHazards.length>0,'At least one nearby obstacle occupies the actual starting camera view');
    assert.ok(result.events.some(e=>e.kind==='hit'),'A naive ten-second forward run must encounter a real obstacle; it must not be scenery only');
    assert.ok(result.hazards.bySection.every(s=>s.count>0),'Every named section includes a real colliding obstacle');
    assert.equal(result.captures.filter(c=>c.kind==='section-waypoint').length,7,'Save all seven section entry views through the ordinary player camera');
    assert.ok(result.font.faces.some(f=>f.status==='loaded'),'The bundled rounded title font loads with external font requests blocked');
    assert.ok(result.hazards.bySection.every(s=>result.font.draws.some(d=>d.text===s.name&&d.loaded&&d.font.includes('CloudRaceTitle'))),
      'Every section title was actually painted with the loaded bundled face');
    assert.ok(result.capsules.length>0&&result.capsules.every(c=>c.aligned),'Rendered padded capsule endcaps match their full collider height in all captured sections');
    const detail=result.captures.find(c=>c.kind==='material-waypoint');
    assert.ok(detail?.potentiallyVisibleHazards.some(h=>h.id===detail.target&&h.fullyInFrame),
      'The ordinary-camera material detail includes the complete first punch capsule without clipping its top');
  }
  console.log(`PASS: ${label} actual start/player camera, 21 avatars, visible obstacle bounds, actual encounters, unchanged mid quality`);
} finally {await browser?.close();await new Promise(r=>server.close(r));}
