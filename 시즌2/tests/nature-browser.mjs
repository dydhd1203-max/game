// Actual entry/WASD/right-drag nature review. No teleport, actor edits, camera
// enlargement, hidden HUD or simulation pause is used for the art screenshots.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';

const root=path.resolve(process.env.S2_NATURE_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const out=path.resolve(process.env.S2_NATURE_OUTPUT||'/tmp/s2-009-nature');
const entry=process.env.S2_NATURE_ENTRY||'시즌2/';
const {walkable,RELEASE,BUILD}=await import(pathToFileURL(path.join(root,'시즌2/src/content.mjs')).href);
const {SEASON1_CAMERA}=await import(pathToFileURL(path.join(root,'시즌2/src/camera-season1.mjs')).href);
const report={entry,release:RELEASE,build:BUILD,environment:'Guarded hidden Chromium / SwiftShader / 1366×768 / DPR1',
  scope:'Actual lobby entry/start, WASD village north approach, actual forest departure, walk to forest left edge and first left rock; real right-drag views. The simulation and combat continue normally. No overhead, teleport, modified actors, hidden HUD or lowered render quality.',
  requirements:['Replace round ball-like tree crowns with readable branching/foliage forms','Break repeated small pebble/ball lines into natural edge planting','Remove detached green rock lids and integrate rock surface vegetation'],
  notMeasured:['physical laptop FPS','21 real connected devices','subjective audio quality'],
  sourceHashes:{},checks:[],screenshots:[],movement:[],errors:[]};
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
    const data=await readFile(file);report.sourceHashes[url.pathname]=createHash('sha256').update(data).digest('hex');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
});
let browser;
const check=(name,details)=>{report.checks.push({name,...details===undefined?{}:{details}});console.log('PASS '+name);};
try{
  await mkdir(out,{recursive:true});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',res=>{if(res.status()>=400&&!res.url().endsWith('favicon.ico'))report.errors.push('HTTP '+res.status()+' '+res.url());});
  const frames=(n=3)=>page.evaluate(n=>new Promise(resolve=>{const tick=()=>{if(--n<=0)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);}),n);
  const player=()=>page.evaluate(()=>{const p=Object.values(__S2.getState().players)[0];return {x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz,hp:p.hp};});
  const settle=async()=>{await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return Math.hypot(p.vx,p.vz)<.001;});await frames(5);};
  const capture=async name=>{
    await frames();const stats=await page.evaluate(()=>__S2.scene.stats()),position=await player();
    assert.ok(stats.calls>0&&stats.triangles>0,'Rendered world is nonempty');
    assert.equal(stats.pixelRatio,.85,'Season 1 drawing scale stays enabled');assert.equal(stats.aaSamples,4,'Native MSAA stays enabled');
    assert.equal(stats.graphics.toneMapping,'AgX');assert.equal(stats.graphics.exposure,1.28);
    assert.equal(stats.camera.bodyHidden,false,'Actual third-person body remains visible');assert.ok(position.hp>0,'The actual actor is alive');
    const file=path.join(out,name+'.png');await page.screenshot({path:file});
    report.screenshots.push({name,kind:'actual-input',path:file,player:position,view:await page.evaluate(()=>({...__S2.view})),stats,phase:await page.evaluate(()=>__S2.getState().phase)});
    console.log('CAPTURE '+name);
  };
  const walk=async(axis,target)=>{
    assert.ok(Math.abs(await page.evaluate(()=>__S2.view.yaw))<.003,'Walking uses restored north-facing camera');
    const before=await player(),direction=Math.sign(target-before[axis]);if(Math.abs(target-before[axis])<.2)return;
    const key=axis==='x'?(direction<0?'KeyA':'KeyD'):(direction<0?'KeyW':'KeyS');
    await page.locator('#game').focus();await page.keyboard.down(key);
    try{await page.waitForFunction(({axis,target,direction})=>direction*(Object.values(__S2.getState().players)[0][axis]-target)>=-.15,{axis,target,direction});}
    finally{await page.keyboard.up(key);}await settle();const after=await player();
    assert.ok(walkable(after.x,after.z,.65),'Actual walking remains outside solid scenery');
    assert.ok(after.hp>0,'Actual walking finishes alive');report.movement.push({key,axis,target,before,after});
  };
  const look=async(yaw,pitch=SEASON1_CAMERA.pitch)=>{
    const current=await page.evaluate(()=>({yaw:__S2.view.yaw,pitch:__S2.view.pitch}));
    const dx=-(yaw-current.yaw)/SEASON1_CAMERA.mouseSensitivity,dy=-(pitch-current.pitch)/SEASON1_CAMERA.mouseSensitivity;
    await page.mouse.move(1000,460);await page.mouse.down({button:'right'});
    try{await page.mouse.move(1000+dx,460+dy,{steps:8});}finally{await page.mouse.up({button:'right'});}await frames(5);
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/`+entry.split('/').map(encodeURIComponent).join('/')+'?test=1',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await __S2.scene.ready;});
  await page.locator('#player-name').fill('자연물 검수');await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();await page.waitForFunction(()=>__S2.getState().phase==='lobby');
  await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');await settle();
  await capture('01-village-spawn');assert.equal(await page.evaluate(()=>__S2.view.zoom),3.2);
  check('실제 입장·마을 출발·시즌1 3.2m 카메라와 화질 유지');
  await walk('x',0);await walk('z',-6);await look(.55);await capture('02-village-north-trees');await look(0);
  await page.locator('#depart-game').click();await page.waitForFunction(()=>__S2.getState().phase==='forest');await settle();
  await capture('03-forest-entry');check('실제 WASD 북쪽 이동·숲 출격');
  await walk('x',-16.5);await walk('z',-21);await look(Math.PI/2);await capture('04-forest-left-trees-and-edge');await look(0);
  await walk('z',-40.4);await look(-.8,.08);await capture('05-first-rock-surface');
  check('숲 가장자리·첫 바위 실제 접근과 우클릭 시점; 몸체·화질 유지');
  assert.equal(await page.evaluate(()=>document.pointerLockElement),null);check('커서 잠금 없음');
  assert.deepEqual(report.errors,[]);check('브라우저 실행·자산 오류 없음');report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack||String(error);console.error(report.failure);process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Report: '+path.join(out,'report.json'));}
