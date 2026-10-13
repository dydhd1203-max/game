// Actual keyboard/mouse controls in the guarded hidden browser. No pose,
// position, camera or simulation state is changed through test hooks.
// PW_MODULE=/path/to/playwright/index.mjs PW_EXECUTABLE_PATH=/usr/bin/chromium node 시즌2/tests/motion-browser.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';
import {SEASON1_MOTION} from '../src/locomotion-season1.mjs';
import {SEASON1_CAMERA} from '../src/camera-season1.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const output=path.resolve(process.env.S2_MOTION_OUTPUT||'/tmp/season2-motion-review');
const entry=process.env.S2_MOTION_ENTRY||'시즌2/';
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.json':'application/json'};
const report={entry,environment:'guarded hidden Chromium, software WebGL, 1366×768, DPR 1',
  scope:'Actual entry, keyboard movement/jumps/sprint, mouse drag/aim, wheel and UI camera reset; read-only frame observation. Blur uses the browser window blur event without manipulating game state.',
  notMeasured:['real laptop FPS','21 physical networked clients','subjective animation quality'],
  loadedFiles:{},checks:[],screenshots:[],samples:[],errors:[]};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
    const data=await readFile(file);report.loadedFiles[url.pathname]=createHash('sha256').update(data).digest('hex');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
  } catch {res.writeHead(404).end('Not found');}
});
let browser,page;
const check=(name,details)=>{report.checks.push({name,...details===undefined?{}:{details}});console.log('PASS '+name);};

try {
  await mkdir(output,{recursive:true});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
  page.setDefaultTimeout(45000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404 (Not Found)'))report.errors.push(message.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/`+entry.split('/').map(encodeURIComponent).join('/')+'?test=1',{waitUntil:'networkidle'});
  await page.locator('#player-name').fill('모션 검수');
  await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.__S2?.getState()?.phase==='lobby');
  // Keep samples aligned to real rendered frames, including brief take/land
  // poses that can fall between asynchronous Playwright polling operations.
  await page.evaluate(()=>{
    window.__motionAudit={samples:[]};
    const observe=()=>{
      const api=window.__S2,s=api?.getState(),p=s&&Object.values(s.players)[0];
      if(p&&__motionAudit.samples.length<3000){
        const stats=api.scene.stats();
        __motionAudit.samples.push({time:s.time,phase:s.phase,player:{x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz,vy:p.vy,
          ground:p.ground,air:p.air,run:p.run,mv:p.mv,stamina:p.stamina,jumps:p.jumps,gp:p.gp,take:p.take,land:p.land,flip:p.flip,camDip:p.camDip,jumpSeq:p._jumpSeq},
          input:api.getInput(),view:{yaw:api.view.yaw,pitch:api.view.pitch,zoom:api.view.zoom,aim:api.view.aim},
          camera:stats.camera,calls:stats.calls,triangles:stats.triangles});
      }
      requestAnimationFrame(observe);
    };requestAnimationFrame(observe);
  });
  const frames=(count=2)=>page.evaluate(n=>new Promise(resolve=>{
    const frame=()=>{if(--n<=0)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);
  }),count);
  const sample=()=>page.evaluate(()=>__motionAudit.samples.at(-1));
  const mark=()=>page.evaluate(()=>__motionAudit.samples.length);
  const since=index=>page.evaluate(index=>__motionAudit.samples.slice(index),index);
  const simTime=async seconds=>{
    const until=await page.evaluate(seconds=>__S2.getState().time+seconds,seconds);
    await page.waitForFunction(until=>__S2.getState().time>=until,until);
  };
  const capture=async(name,settle=2)=>{
    if(settle)await frames(settle);
    const before=await sample();assert.ok(before.calls>0&&before.triangles>0,'Capture has rendered scenery');
    const file=path.join(output,name+'.png');await page.screenshot({path:file});
    report.screenshots.push({name,path:file,kind:'actual-input',before,after:await sample()});
  };
  const settle=async()=>{await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.ground&&Math.hypot(p.vx,p.vz)<.001;});await frames();};
  const canvasFocus=()=>page.locator('#game').focus();
  await frames();await capture('01-lobby-default');
  const lobbyBefore=await sample(),lobbyMark=await mark();
  await canvasFocus();await page.keyboard.down('KeyW');await simTime(.35);await page.keyboard.up('KeyW');await settle();
  const lobbyWalk=await since(lobbyMark),lobbyAfter=await sample();
  assert.ok(lobbyAfter.player.z<lobbyBefore.player.z-.5,'W walks forward in the actual lobby');
  assert.ok(lobbyWalk.some(s=>s.input.mz<0&&Math.abs(s.player.vz)>0&&Math.abs(s.player.vz)<SEASON1_MOTION.speed*.97),'Lobby movement accelerates');
  assert.ok(lobbyWalk.some(s=>s.input.mz===0&&Math.abs(s.player.vz)>.01),'Lobby movement decelerates after release');
  const lobbyJumpMark=await mark();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.vy<9;});
  await page.keyboard.press('Space');await simTime(.7);await settle();
  const lobbyJump=await since(lobbyJumpMark);
  assert.ok(lobbyJump.some(s=>s.player.air&&s.player.y>.5));
  assert.ok(lobbyJump.every(s=>s.player.jumps===0&&s.player.flip===0),'Lobby has the original single-jump restriction');
  check('대기실 실제 W 이동·가감속·단일 점프와 2단 점프 제한');

  await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');
  await settle();await capture('02-village-default-season1-camera');
  const baseline=await sample();
  assert.equal(baseline.view.zoom,SEASON1_CAMERA.zoom);assert.equal(baseline.camera.firstPerson,false);
  assert.ok(Math.abs(baseline.camera.distance-SEASON1_CAMERA.zoom)<.03,'Default camera uses the Season 1 3.2m boom');
  check('실제 마을 출발 위치에서 시즌1 기본 3.2m 카메라');

  await canvasFocus();const walkMark=await mark();
  await page.keyboard.down('KeyW');await simTime(.45);await page.keyboard.up('KeyW');await settle();
  const walk=await since(walkMark),moving=walk.filter(s=>s.input.mz<0&&s.player.mv);
  assert.ok(moving.length>=2);assert.ok(moving.some(s=>Math.abs(s.player.vz)>5.8));
  for(const s of moving){
    assert.ok(Math.abs(s.camera.x-s.player.x)<1e-6,'Camera horizontal anchor follows without lag');
    assert.ok(Math.abs(s.camera.z-s.player.z-Math.cos(s.view.pitch)*s.camera.distance)<1e-5,'Camera boom follows this frame’s position');
  }
  assert.ok((await sample()).player.z<baseline.player.z-1.5);
  check('마을 W 이동·정지와 지연 없는 수평 카메라 추적',{movingFrames:moving.length});

  const sprintMark=await mark(),staminaBefore=(await sample()).player.stamina;
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');await simTime(.55);
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await settle();
  const sprint=await since(sprintMark),running=sprint.filter(s=>s.player.run);
  assert.ok(running.some(s=>Math.abs(s.player.vz)>SEASON1_MOTION.speed*1.4));
  assert.ok(running.some(s=>s.player.stamina<staminaBefore-.1));assert.ok(running.some(s=>s.camera.fov>72));
  const depleted=(await sample()).player.stamina;await simTime(.5);
  assert.ok((await sample()).player.stamina>depleted);
  check('Shift 실제 달리기·기력 소모/회복·시야 확장');

  const jumpMark=await mark(),groundCamera=(await sample()).camera.y;
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.y>.5&&p.vy<9;});
  await capture('03-village-first-jump',0);
  // If screenshot readback outlasts a short first jump, start a fresh real jump
  // before the second press; no state/pose hook freezes a prettier frame.
  if((await sample()).player.ground){await page.keyboard.press('Space');await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.vy<9;});}
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.air&&p.jumps===1&&p.flip>0;});
  await capture('04-village-double-jump-flip',0);
  await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.ground&&p.land>0;});
  await capture('05-village-landing',0);await settle();
  const jumping=await since(jumpMark);
  assert.ok(jumping.some(s=>s.player.take>0));assert.ok(jumping.some(s=>s.player.flip>0));
  assert.ok(jumping.some(s=>s.player.land>0&&s.player.camDip>0));
  assert.ok(jumping.some(s=>s.camera.y>groundCamera+.6),'Camera follows the actual jump height');
  for(const s of jumping.filter(s=>s.player.air))assert.ok(Math.abs(s.camera.footAnchor-s.player.y)<=.220001,'Vertical camera lag is bounded by the original .22m limit');
  assert.ok(Math.abs((await sample()).player.y-SEASON1_MOTION.groundY)<1e-9);
  check('Space 실제 도약·2단 공중제비·착지 자세와 점프 높이를 따라가는 카메라');

  await page.mouse.move(683,430);const viewBefore=(await sample()).view;
  await page.mouse.down({button:'right'});await page.mouse.move(783,450,{steps:5});await page.mouse.up({button:'right'});await frames();
  const aimed=await sample();
  assert.ok(Math.abs(aimed.view.yaw-(viewBefore.yaw-100*SEASON1_CAMERA.mouseSensitivity))<1e-6);
  assert.ok(Math.abs(aimed.view.pitch-(viewBefore.pitch-20*SEASON1_CAMERA.mouseSensitivity))<1e-6);
  assert.equal(aimed.view.aim,true);await simTime(.3);
  assert.ok((await sample()).camera.aimBlend>.9);assert.ok((await sample()).camera.shoulder>.8);
  await capture('06-village-aim-shoulder');
  await page.mouse.click(783,450,{button:'right'});await frames();assert.equal((await sample()).view.aim,false);
  check('우클릭 드래그의 시즌1 마우스 감도와 조준 전환');

  await page.mouse.move(683,430);await page.mouse.wheel(0,-100);await frames();
  assert.ok(Math.abs((await sample()).view.zoom-2)<1e-8);
  await page.mouse.wheel(0,-100);await frames();
  const firstPerson=await sample();assert.equal(firstPerson.view.zoom,0);
  assert.equal(firstPerson.camera.firstPerson,true);assert.equal(firstPerson.camera.bodyHidden,true);
  await capture('07-village-first-person');
  await page.mouse.wheel(0,100);await frames();assert.equal((await sample()).view.zoom,1.6);
  await page.locator('#settings-toggle').click();await page.locator('#camera-reset').click();await page.locator('#settings-toggle').click();await frames();
  const restored=await sample();assert.equal(restored.view.zoom,3.2);assert.equal(restored.view.yaw,0);assert.equal(restored.view.pitch,-.22);assert.equal(restored.camera.firstPerson,false);
  check('휠 3인칭→1인칭·자기 몸 숨김·시점 초기화로 복원');

  await canvasFocus();await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.keyboard.down('Space');
  await simTime(.15);
  // A hidden browser cannot move the user's operating-system focus. Exercise
  // exactly the window event registered by the app; do not clear its state.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await simTime(.3);
  const blurred=await page.evaluate(()=>__S2.getInput());
  assert.ok(blurred.mx===0&&blurred.mz===0);assert.equal(blurred.sprint,false);assert.equal(blurred.jump,false);assert.equal(blurred.attack,false);assert.equal(blurred.aim,false);
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.keyboard.up('Space');await settle();
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null,'Guarded browser never captures the user cursor');
  check('창 blur 이벤트로 이동·달리기·점프 입력 해제와 커서 잠금 차단');
  await capture('08-village-restored-after-controls');
  assert.deepEqual(report.errors,[]);check('실제 입력 검수 중 브라우저 실행 오류 없음');
  report.result='passed';
} catch(error){report.result='failed';report.failure=error.stack||String(error);process.exitCode=1;console.error(report.failure);}
finally {
  if(page)try{report.samples=await page.evaluate(()=>window.__motionAudit?.samples||[]);}catch{}
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Report: '+path.join(output,'report.json'));
}
