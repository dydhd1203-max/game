// Real spawn/movement screenshots plus explicitly synthetic boss pose fixtures.
// Uses the guarded hidden browser; this is not a measurement of laptop FPS.
// PW_MODULE=/path/to/playwright/index.mjs PW_EXECUTABLE_PATH=/usr/bin/chromium node 시즌2/tests/art-browser.mjs
// S2_ART_VILLAGE_ONLY=1 rechecks a village refinement without repeating boss fixtures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';
import {VILLAGE_SITES} from '../src/content.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const output=path.resolve(process.env.S2_ART_OUTPUT||'/tmp/season2-art-review');
const entry=process.env.S2_ART_ENTRY||'시즌2/';
const villageOnly=process.env.S2_ART_VILLAGE_ONLY==='1';
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
    const data=await readFile(file);
    report.loadedFiles[url.pathname]=createHash('sha256').update(data).digest('hex');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
});
const report={entry,villageOnly,environment:'hidden Chromium, software WebGL, 1366×768, DPR 1',
  scope:villageOnly?'Village-only verification using actual entry, spawn, keyboard and wheel input. Boss and scene-transition checks are not repeated.':'Village screenshots use actual entry, spawn, keyboard and wheel input. Boss poses and repeated transitions are supplementary synthetic fixtures.',
  notMeasured:['real laptop FPS','21 physical networked clients','subjective sound quality'],loadedFiles:{},checks:[],screenshots:[],movement:[],errors:[]};
let browser;
const check=name=>{report.checks.push(name);console.log('PASS '+name);};

try{
  await mkdir(output,{recursive:true});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
  page.setDefaultTimeout(30000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404 (Not Found)'))report.errors.push(message.text());});
  const frames=(n=5)=>page.evaluate(n=>new Promise(resolve=>{const frame=()=>{if(--n<=0)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);}),n);
  const player=()=>page.evaluate(()=>{const p=Object.values(__S2.getState().players)[0];return {x:p.x,z:p.z,hp:p.hp};});
  const phase=name=>page.waitForFunction(value=>window.__S2?.getState()?.phase===value,name);
  const capture=async(name,kind='actual-play')=>{
    await frames();
    const stats=await page.evaluate(()=>__S2.scene.stats());
    assert.ok(stats.calls>0&&stats.triangles>0,'Screenshot includes a rendered world');
    for(const value of Object.values(stats))assert.ok(typeof value!=='number'||Number.isFinite(value),'Renderer values are finite');
    const filename=path.join(output,name+'.png');await page.screenshot({path:filename});
    report.screenshots.push({name,path:filename,kind,player:await player(),stats});
  };
  // Default camera yaw faces north. No test hook changes the player or camera in this walk.
  const walkAxis=async(axis,target)=>{
    const before=await player(),direction=Math.sign(target-before[axis]);
    if(Math.abs(target-before[axis])<.2)return;
    const key=axis==='x'?(direction<0?'KeyA':'KeyD'):(direction<0?'KeyW':'KeyS');
    await page.locator('#game').focus();await page.keyboard.down(key);
    try{
      await page.waitForFunction(({axis,target,direction})=>{
        const p=Object.values(__S2.getState().players)[0];return direction*(p[axis]-target)>=-.15;
      },{axis,target,direction},{timeout:45000});
    }finally{await page.keyboard.up(key);}
    const after=await player();report.movement.push({key,axis,target,before,after});
    assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.15,'Real movement reached the next view');
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/`+entry.split('/').map(encodeURIComponent).join('/')+'?test=1',{waitUntil:'networkidle'});
  await page.locator('#player-name').fill('마을 검수');
  await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();await phase('lobby');
  await capture('01-lobby-default');
  await page.locator('#start-game').click();await phase('village');
  await capture('02-village-default-spawn');
  check('대기실에서 실제 시작한 기본 카메라·출발 위치·HUD');

  // Exercise the normal disclosure; never hide HUD through CSS for a prettier capture.
  const details=page.locator('#village-panel details');
  assert.equal(await details.getAttribute('open'),null,'Village note starts compact');
  await details.locator('summary').click();
  assert.notEqual(await details.getAttribute('open'),null,'User can expand the note');
  await details.locator('summary').click();
  assert.equal(await details.getAttribute('open'),null,'User can collapse the note again');
  assert.ok(await page.locator('#depart-game').isVisible(),'Depart stays accessible');
  check('마을 안내는 기본 접힘; 실제 펼치기·접기 후 출격 버튼 유지');
  for(const [name,siteKey]of [['assembly','assembly'],['supply-canopy','market']]){
    const site=VILLAGE_SITES[siteKey],side=Math.sign(site.x);
    await walkAxis('x',0);await walkAxis('z',site.z);
    await walkAxis('x',site.x-side*(site.r+1.5));
    // Walk into the visible outer boundary of the scenery; do not teleport to
    // claim a collision test. Art and physics share the same exported sites.
    const before=await player(),until=await page.evaluate(()=>__S2.getState().time+1.2);
    const key=side<0?'KeyA':'KeyD';await page.locator('#game').focus();await page.keyboard.down(key);
    try{await page.waitForFunction(until=>__S2.getState().time>=until,until,{timeout:30000});}
    finally{await page.keyboard.up(key);}
    const after=await player(),distance=Math.hypot(after.x-site.x,after.z-site.z);
    assert.ok(distance>=site.r+.6&&distance<=site.r+1,'Player stops at the visible scenery perimeter');
    report.movement.push({collision:name,before,after,distanceFromCenter:distance});
    await capture(`03-${name}-visible-collision-real-walk`);
  }
  check('실제 걸어서 집결지·천막의 보이는 외곽 경계와 충돌 확인');
  await walkAxis('x',0);
  await walkAxis('z',16);await walkAxis('x',-8);
  await page.mouse.move(683,440);await page.mouse.wheel(0,-550);await frames();
  await capture('04-workshop-nearby-real-walk');
  await page.mouse.wheel(0,550);await frames();
  await walkAxis('x',8);
  await page.mouse.wheel(0,-550);await frames();
  await capture('05-caravan-nearby-real-walk');
  await page.mouse.wheel(0,550);await frames();
  await walkAxis('x',0);await walkAxis('z',2);
  await capture('06-village-north-exit-real-walk');
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
  check('WASD로 광장 좌우 작업장과 중앙 출구에 도달; 사용자 커서 잠금 없음');

  if(!villageOnly){
  await page.locator('#depart-game').click();await phase('forest');
  await capture('07-forest-entry-default');
  check('실제 출격 후 숲 입구 화면');
  const saved=await page.evaluate(()=>{__S2.setManual(true);return structuredClone(__S2.getState());});
  await page.evaluate(()=>{
    const s=__S2.getState(),p=Object.values(s.players)[0];
    Object.assign(p,{x:0,z:-103,yaw:0,hp:100});
    Object.assign(s,{phase:'boss',stage:2,beacon:true,paused:false,events:[],enemies:[],towers:[]});
    s.boss={id:'boss',x:0,z:-115,yaw:0,hp:900,maxHp:1200,phase:'warn',timer:1.2,dx:0,dz:1,chargeLength:18,chargeWidth:5.2};
  });
  for(const [pose,timer]of [['warn',1.2],['charge',.4],['recover',1.4]]){
    await page.evaluate(({pose,timer})=>Object.assign(__S2.getState().boss,{phase:pose,timer}),{pose,timer});
    await capture(`08-boar-${pose}-fixture`,'synthetic-pose');
  }
  check('보조 보스 fixture: 돌진 예고·돌진·경직 세 자세의 유효한 실제 렌더');
  await page.evaluate(()=>Object.assign(__S2.getState().boss,{phase:'warn',timer:1.2}));
  await page.mouse.move(683,420);await page.mouse.down({button:'right'});
  try{await page.mouse.move(803,420,{steps:6});}finally{await page.mouse.up({button:'right'});}
  await capture('09-boar-angled-normal-camera-fixture','synthetic-pose, actual camera drag');
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
  check('보조 보스 fixture에서 실제 우클릭 드래그 시점 확인');

  // Warm every relevant pose/phase, then ensure repeating those states does not leak assets.
  const transition=async()=>{
    for(const next of ['village','forest','boss']){
      await page.evaluate(next=>{const s=__S2.getState(),p=Object.values(s.players)[0];s.phase=next;p.x=0;p.z=next==='village'?25:next==='forest'?-15:-103;},next);
      await frames(2);
    }
  };
  await transition();
  const before=await page.evaluate(()=>__S2.scene.stats());
  for(let i=0;i<5;i++)await transition();
  const after=await page.evaluate(()=>__S2.scene.stats());
  report.repeatedTransitions={before,after,cycles:5};
  assert.equal(after.geometries,before.geometries,'Repeated scene changes must not accumulate geometries');
  assert.equal(after.textures,before.textures,'Repeated scene changes must not accumulate textures');
  check('마을·숲·보스 5회 반복 전환 후 지오메트리·텍스처 누적 없음');
  await page.evaluate(saved=>{__S2.setState(saved);__S2.setManual(false);},saved);
  }
  assert.deepEqual(report.errors,[],'Browser errors');check('브라우저 실행 오류 없음');
  report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack||String(error);process.exitCode=1;console.error(report.failure);}
finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Report: '+path.join(output,'report.json'));
}
