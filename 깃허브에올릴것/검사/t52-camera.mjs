// Jump framing uses the real physics and camera, at both 30 and 60 Hz.
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const port=+(process.argv[3]||8952), server=serve(port,process.argv[2]||GAME);
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1366,height:768}}), errors=[], checks=[];
page.on('pageerror',e=>errors.push(e.message));
const ok=(name,pass,value)=>checks.push({name,pass,value});
try {
  await page.goto(`http://127.0.0.1:${port}/?gfx=low`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__READY===true);
  await page.fill('#iName','카메라검사');
  await page.evaluate(()=>document.getElementById('bSolo').click());
  await page.waitForFunction(()=>window.__G.started);
  for(const [width,height] of [[1366,768],[1024,600],[820,1180]]){
    await page.setViewportSize({width,height});
    const runs=await page.evaluate(()=>{
      const W=window,P=W.__PL,G=W.__G,C=W.__cam,T=W.__THREE;
      G.paused=true; G.phase='day'; P.down=false; W.__setAim(false);
      document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
      // Find open level ground in this generated world instead of assuming a seed.
      let spot=null;
      outer:for(let x=-30;x<=30;x+=3)for(let z=-30;z<=30;z+=3){
        const y=W.__groundUnder(x,z,P.R);
        if(!Number.isFinite(y)||y>100||y<0)continue;
        if([[0,0],[2,0],[-2,0],[0,4],[0,-4]].every(([dx,dz])=>Math.abs(W.__groundUnder(x+dx,z+dz,P.R)-y)<0.01)){
          spot={x,z,y};break outer;
        }
      }
      if(!spot)throw new Error('No open camera test ground found');
      const out=[];
      for(const hz of [30,60]){
        Object.assign(P,spot,{vy:0,ground:true,jumps:0,yaw:0,pitch:-0.22,landT:0});
        W.__KEY.w=false; W.__KEY.shift=false; W.__kbReset();
        for(let i=0;i<hz;i++)W.__updPlayer(1/hz);
        const startY=C.position.y; let peak=0,minY=1,maxY=-1,maxLag=0;
        for(let i=0;i<hz*2;i++){
          if(i===0||i===Math.round(hz*0.18))W.__wantJump();
          W.__updPlayer(1/hz); C.updateMatrixWorld(true);
          peak=Math.max(peak,P.y-spot.y);
          maxLag=Math.max(maxLag,Math.abs(P.y-W.__camGY()));
          // Includes raised hands above the head, and feet below the body.
          for(const h of [0,1.48]){
            const q=new T.Vector3(P.x,P.y+h,P.z).project(C);
            minY=Math.min(minY,q.y); maxY=Math.max(maxY,q.y);
          }
        }
        out.push({hz,peak,minY,maxY,maxLag,landed:P.ground,returnY:Math.abs(C.position.y-startY)});
      }
      return out;
    });
    for(const r of runs){
      ok(`${width}×${height} ${r.hz}Hz 실제 2단 점프 머리·발이 화면 안`,r.peak>2&&r.minY>-.90&&r.maxY<.90,r);
      ok(`${width}×${height} ${r.hz}Hz 높이 추종·착지 복귀`,r.maxLag<=.221&&r.landed&&r.returnY<.04,r);
    }
  }
  const modes=await page.evaluate(()=>{
    const W=window,P=W.__PL,C=W.__cam;
    const step=()=>{for(let i=0;i<90;i++)W.__updPlayer(1/60);};
    W.__setAim(false);step();const normal=W.__camRig();
    W.__setAim(true);step();const aim=W.__camRig();
    W.__setAim(false);step();const back=W.__camRig();
    // Landing exactly on the minimum must remain third person.
    for(let i=0;i<20;i++)window.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,cancelable:true}));
    step();const first=!W.__tpvOn();
    window.dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true}));step();
    const minimum={...W.__camRig(),third:W.__tpvOn()};
    for(let i=0;i<20;i++)window.dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true}));
    step();const far=W.__camRig();
    // Actual trace, deliberately place one blocked grid column in its shoulder path.
    const grid=W.__terrH,size=Math.sqrt(grid.length),half=Math.floor(size/2),idx=26+half+(30+half)*size,old=grid[idx];
    grid[idx]=P.y+10;
    let wall;try{wall=W.__cameraClearance(25.5,P.y+1,30.5,2,0,0);}finally{grid[idx]=old;}
    const oldY=P.y;P.y+=30;P.ground=false;P.vy=0;W.__updPlayer(1/60);
    const teleLag=Math.abs(P.y-W.__camGY());P.y=oldY;
    return {normal,aim,back,first,minimum,far,wall,teleLag};
  });
  ok('평소 중앙·사격 어깨·해제 중앙',Math.abs(modes.normal.shoulder)<.001&&modes.aim.shoulder>.39&&Math.abs(modes.back.shoulder)<.001,modes);
  ok('휠 1인칭→최소 3인칭→최대 줌',modes.first&&modes.minimum.third&&modes.minimum.zoom===1.6&&modes.far.zoom===12.5,modes);
  ok('어깨 경로 벽 앞 여유 확보·강제 최소 거리 없음',modes.wall>0&&modes.wall<.4,modes.wall);
  ok('높이 순간이동 프레임에 즉시 추종',modes.teleLag<.001,modes.teleLag);
  const race=await page.evaluate(()=>{
    const W=window,P=W.__PL,G=W.__G,C=W.__cam,T=W.__THREE;
    W.__goMini(0);W.__raceBuild(8);W.__miniSet('run',90);G.t=90;
    const y=W.__MINI().Y;Object.assign(P,{x:0,z:22,y,vy:0,ground:true,jumps:0,yaw:Math.PI,pitch:-.22});
    W.__RACE().fallT=0;for(let i=0;i<60;i++)W.__updPlayer(1/60);
    let min=1,max=-1,peak=0;
    for(let i=0;i<120;i++){
      if(i===0||i===11)W.__wantJump();W.__updPlayer(1/60);C.updateMatrixWorld(true);
      peak=Math.max(peak,P.y-y);
      for(const h of [0,1.48]){const v=new T.Vector3(P.x,P.y+h,P.z).project(C);min=Math.min(min,v.y);max=Math.max(max,v.y);}
    }
    P.x=20;P.z=60;P.y=y+1.5;P.vy=0;P.ground=false;W.__updPlayer(1/60);
    return {min,max,peak,voidCameraY:C.position.y-y,lag:Math.abs(P.y-W.__camGY())};
  });
  ok('경주 2단 점프에서도 머리와 발이 화면 안',race.peak>2&&race.min>-.9&&race.max<.9,race);
  ok('경주 발판 사이 허공에서도 카메라 높이 유지',race.voidCameraY>1&&race.lag<=.221,race);
  ok('실행 오류 없음',errors.length===0,errors);
} finally {await browser.close();server.close();}
for(const c of checks)console.log(`${c.pass?'  OK  ':'FAIL  '}${c.name} — ${JSON.stringify(c.value)}`);
console.log(`${checks.length}항목 · 실패 ${checks.filter(c=>!c.pass).length}`);
process.exitCode=checks.every(c=>c.pass)?0:1;

