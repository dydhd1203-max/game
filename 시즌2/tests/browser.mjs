// Hidden-browser integration and visual evidence. Never measures real-device FPS.
// PW_MODULE=/path/to/playwright/index.mjs PW_EXECUTABLE_PATH=/usr/bin/chromium node 시즌2/tests/browser.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.resolve(process.env.S2_BROWSER_OUTPUT || '/tmp/season2-browser');
const entry = process.env.S2_BROWSER_ENTRY || '시즌2/';
const mime = {'.html':'text/html; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8'};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) {res.writeHead(403).end(); return;}
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control':'no-store'}).end(data);
  } catch {res.writeHead(404).end('Not found');}
});

let browser;
const report = {
  build:'s2-003', environment:'hidden Chromium; software WebGL; 1280×800; DPR 1',
  scope:'UI entry and movement are real input. Stress/boss images use explicitly synthetic fixtures.',
  notMeasured:['21 physical clients', 'real LG gram FPS', 'sound quality by listening'],
  checks:[], screenshots:[], renderer:{}, errors:[]
};
const check = name => {report.checks.push(name); console.log('PASS ' + name);};

try {
  await mkdir(output, {recursive:true});
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
  const address = server.address();
  const url = process.env.S2_BROWSER_FILE ? pathToFileURL(path.join(root,entry)).href+'?test=1' : `http://127.0.0.1:${address.port}/` + entry.split('/').map(encodeURIComponent).join('/') + '?test=1';
  report.entry=entry;
  browser = await chromium.launch({args:['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1280,height:800}, deviceScaleFactor:1});
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if(message.type() === 'error' && !message.text().includes('404 (Not Found)')) report.errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem('nightRec102','season1-checkpoint-sentinel');
    localStorage.setItem('gfxPick','season1-graphics-sentinel');
    window.__audioContexts = [];
    if(window.AudioContext) window.AudioContext = new Proxy(window.AudioContext, {
      construct(Type, args) {const context = new Type(...args); window.__audioContexts.push(context); return context;}
    });
  });
  const frames = (count=3) => page.evaluate(n => new Promise(resolve => {
    function frame(){if(--n <= 0) resolve(); else requestAnimationFrame(frame);}
    requestAnimationFrame(frame);
  }), count);
  async function capture(name){
    await frames();
    const filename = path.join(output, name + '.png');
    await page.screenshot({path:filename});
    report.screenshots.push(filename);
  }
  const phase = expected => page.waitForFunction(value => window.__S2?.getState()?.phase === value, expected);
  await page.goto(url, {waitUntil:'networkidle'});
  await page.locator('#entry-form').waitFor();
  await capture('01-entry');
  await page.locator('#player-name').fill('검수 대원');
  await page.locator('#entry-hat').selectOption('16');
  await page.locator('#entry-face').selectOption('11');
  await page.locator('#entry-clothes').selectOption('13');
  await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();
  await phase('lobby');
  assert.deepEqual(await page.evaluate(()=>{const p=Object.values(window.__S2.getState().players)[0];return [p.hat,p.face,p.clothes];}),[16,11,13]);
  await page.locator('#lobby-hat').selectOption('9');
  await page.locator('#lobby-face').selectOption('8');
  await page.locator('#lobby-clothes').selectOption('2');
  await page.waitForFunction(()=>{const p=Object.values(window.__S2.getState().players)[0];return p.hat===9&&p.face===8&&p.clothes===2;});
  check('시즌1 원본 모자·얼굴·의상 ID의 입장 및 대기실 변경');
  await capture('02-lobby-default-camera');
  check('실제 입장 양식 → 혼자 연습 대기실');

  const before = await page.evaluate(() => {
    const p = Object.values(window.__S2.getState().players)[0]; return {x:p.x,z:p.z};
  });
  await page.locator('#game').click({position:{x:600,y:400}});
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(origin => {
      const p=Object.values(window.__S2.getState().players)[0];
      return Math.hypot(p.x-origin.x,p.z-origin.z) > .5;
    }, before);
  } finally {await page.keyboard.up('KeyW');}
  assert.equal(await page.evaluate(() => document.pointerLockElement === null), true);
  check('W 키가 실제 캐릭터 위치를 이동; 운영체제 커서 잠금 없음');

  await page.locator('#start-game').click();
  await phase('village');
  await capture('03-village-default-camera');
  check('교사 시작 → 안전한 정박 마을');
  await page.locator('#save-button').click();
  const checkpoint = await page.evaluate(() => {
    const key=Object.keys(localStorage).find(k=>k.startsWith('zns2:checkpoint:'));
    return JSON.parse(localStorage.getItem(key));
  });
  assert.equal(checkpoint.season,2);
  assert.equal(checkpoint.state.phase,'village');
  const savedPlayer = Object.values(checkpoint.state.players)[0];
  await page.locator('#game').click({position:{x:650,y:440}});
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(origin => {
      const p=Object.values(window.__S2.getState().players)[0];
      return Math.hypot(p.x-origin.x,p.z-origin.z)>.5;
    },savedPlayer);
  } finally {await page.keyboard.up('KeyW');}
  await page.locator('#load-button').click();
  await page.waitForFunction(origin => {
    const p=Object.values(window.__S2.getState().players)[0];
    return Math.hypot(p.x-origin.x,p.z-origin.z)<.001;
  },savedPlayer);
  check('실제 저장 → 키보드 이동 → 불러오기: 마을 체크포인트 위치 복구');
  // Load a real serialized legacy checkpoint through the public button. The
  // smith yard occupies this formerly clear position; resources/cosmetics stay.
  await page.evaluate(() => {
    const key=Object.keys(localStorage).find(k=>k.startsWith('zns2:checkpoint:'));
    const legacy=JSON.parse(localStorage.getItem(key));
    legacy.version=legacy.state.version='s2-002';legacy.state.supplies=913;
    Object.assign(Object.values(legacy.state.players)[0],{x:-11,z:18});
    localStorage.setItem(key,JSON.stringify(legacy));
  });
  await page.locator('#load-button').click();
  await page.waitForFunction(() => __S2.getState().version==='s2-003'&&__S2.getState().supplies===913);
  const migrated=await page.evaluate(()=>{const s=__S2.getState(),p=Object.values(s.players)[0];return {x:p.x,z:p.z,cosmetics:[p.hat,p.face,p.clothes]};});
  assert.ok(Math.abs(migrated.x)<5&&migrated.z===25,'Legacy building overlap returns to the clear plaza');
  assert.deepEqual(migrated.cosmetics,[9,8,2]);
  check('s2-002 저장을 불러오기 버튼으로 변환; 새 작업마당 겹침 해소·보급·꾸미기 보존');
  const contexts = await page.evaluate(() => window.__audioContexts.map(context => context.state));
  assert.ok(contexts.includes('running'), '입장 클릭 뒤 AudioContext가 재생 가능해야 한다');
  check('사용자 입장 동작 후 실제 Web Audio 잠금 해제');

  // Sliders are exercised as user-facing controls, then checked against the actual audio object.
  await page.locator('#settings-toggle').click();
  for (const [kind,value] of [['bgm',17],['sfx',31]]) {
    const slider = page.locator(`#${kind}-volume`);
    await slider.evaluate((node, v) => {node.value=String(v); node.dispatchEvent(new Event('input',{bubbles:true}));}, value);
  }
  const volumes = await page.evaluate(() => window.__S2.audio.getVolumes());
  assert.equal(volumes.bgm, 17); assert.equal(volumes.sfx, 31);
  check('배경음·효과음 개별 슬라이더가 실제 오디오 음량에 반영');
  await page.locator('#settings-toggle').click();
  await page.locator('#depart-game').click();
  await phase('forest');
  await capture('04-forest-entry-default-camera');
  report.renderer.forestEntry = await page.evaluate(() => window.__S2.scene.stats());
  check('출격 → 숲 입구와 전투 UI');

  // Synthetic scenery states below are supplementary visual/load fixtures, not a claimed playthrough.
  const saved = await page.evaluate(() => {
    window.__S2.setManual(true);
    return structuredClone(window.__S2.getState());
  });
  await page.evaluate(() => {
    const api=window.__S2, s=api.getState(), local=Object.values(s.players)[0];
    s.phase='forest';s.stage=1;s.beacon=true;s.paused=false;s.events=[];
    local.x=0;local.z=-57;local.yaw=0;
    s.towers=[
      {id:'visual-arrow',type:'arrow',team:0,x:-5,z:-66,hp:180,maxHp:180,state:'deployed',carrier:null,progress:0},
      {id:'visual-ice',type:'ice',team:0,x:5,z:-66,hp:160,maxHp:160,state:'deployed',carrier:null,progress:0}
    ];
    s.enemies=[{id:'visual-zombie',kind:'zombie',x:0,z:-73,yaw:Math.PI,hp:65,maxHp:65,frost:2}];
  });
  await capture('05-beacon-towers-fixture');
  report.renderer.towers = await page.evaluate(() => window.__S2.scene.stats());

  await page.evaluate(() => {
    const s=window.__S2.getState(), local=Object.values(s.players)[0];
    local.x=0;local.z=-103;s.phase='boss';s.stage=2;s.enemies=[];
    s.towers[0].x=-14;s.towers[0].z=-111;s.towers[1].x=14;s.towers[1].z=-111;
    s.boss={id:'boss',x:0,z:-115,yaw:0,hp:900,maxHp:1200,phase:'warn',timer:1.2,dx:0,dz:1};
  });
  await capture('06-boss-warning-fixture');
  report.renderer.boss = await page.evaluate(() => window.__S2.scene.stats());
  check('보조 fixture: 봉화·서로 다른 두 타워·보스 돌진 예고 렌더');

  await page.evaluate(() => {
    const api=window.__S2,s=api.getState(),local=Object.values(s.players)[0];
    s.phase='forest';s.stage=2;s.boss=null;s.events=[];local.x=0;local.z=-59;
    for(let i=1;i<21;i++) {
      api.sim.addPlayer(s,{id:`stress-${i}`,name:`대원 ${i+1}`,team:i%5,hat:i%3});
      const p=s.players[`stress-${i}`];p.x=(i%7-3)*2;p.z=-64-Math.floor(i/7)*2;
    }
    s.towers=Array.from({length:30},(_,i)=>({id:`stress-tower-${i}`,type:i%2?'ice':'arrow',team:i%5,
      x:(i%6-2.5)*4,z:-73-Math.floor(i/6)*4,hp:180,maxHp:180,state:'deployed',carrier:null,progress:0}));
    s.enemies=Array.from({length:40},(_,i)=>({id:`stress-enemy-${i}`,kind:i%6?'zombie':'brute',
      x:(i%8-3.5)*2,z:-75-Math.floor(i/8)*3,yaw:Math.PI,hp:65,maxHp:65,frost:i%3?0:2}));
  });
  await frames(5);
  const stressStart = await page.evaluate(() => window.__S2.scene.stats());
  await capture('07-stress-21-players-30-towers-40-enemies-fixture');
  await frames(20);
  const stressEnd = await page.evaluate(() => window.__S2.scene.stats());
  for(const key of ['calls','triangles','geometries','textures']) assert.ok(Number.isFinite(stressEnd[key]), '유효한 renderer '+key);
  assert.ok(stressEnd.calls>0 && stressEnd.triangles>0, '빈 장면을 성능 검수로 세지 않음');
  assert.equal(stressEnd.geometries,stressStart.geometries,'안정된 부하에서 지오메트리 누적 없음');
  assert.equal(stressEnd.textures,stressStart.textures,'안정된 부하에서 텍스처 누적 없음');
  report.renderer.syntheticStress={players:21,towers:30,enemies:40,before:stressStart,after:stressEnd};
  check('21명·30탑·적 40 synthetic 부하: 실제 렌더 통계, 안정 구간 자산 누적 없음');
  await page.evaluate(state => {window.__S2.setState(state);window.__S2.setManual(false);},saved);
  await frames();
  const audioStats = await page.evaluate(() => window.__S2.audio.stats());
  assert.ok(audioStats.tracks <= 2, '장면 전환에서 음악 트랙 수 제한 유지');
  assert.ok(audioStats.cleanupChains <= 64, '오디오 종료 대기열 제한 유지');
  report.audio=audioStats;
  check('마을·숲·보스 장면 전환에서 오디오 트랙·정리 대기열 상한 유지');
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('nightRec102'),localStorage.getItem('gfxPick')]),
    ['season1-checkpoint-sentinel','season1-graphics-sentinel']);
  check('시즌1 저장·그래픽 설정 sentinel 보존');
  assert.deepEqual(report.errors, [], '브라우저 실행 오류');
  check('페이지 실행 오류 없음');
  report.result='passed';
} catch(error) {
  report.result='failed';report.failure=error.stack || String(error);process.exitCode=1;
  console.error(report.failure);
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
  await mkdir(output,{recursive:true});
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Report: '+path.join(output,'report.json'));
}
