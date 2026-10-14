// Actual entry/WASD/camera captures; boss warning is a labelled state fixture.
// This records visual output and work submitted, not laptop FPS or eye comfort.
// S2_COMFORT_ROOT=/tmp/frozen-repo S2_COMFORT_BASELINE=1 captures old output.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';
import {SEASON1_CAMERA} from '../src/camera-season1.mjs';

const root=path.resolve(process.env.S2_COMFORT_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const out=path.resolve(process.env.S2_COMFORT_OUTPUT||'/tmp/s2-007-comfort');
const entry=process.env.S2_COMFORT_ENTRY||'시즌2/';
const baseline=process.env.S2_COMFORT_BASELINE==='1';
const report={baseline,environment:'Guarded hidden Chromium / SwiftShader / 1366×768 / DPR1',
  scope:'Real lobby entry, village spawn, WASD approach and right-drag workshop view; real forest departure; labelled synthetic boss warning. No HUD hiding or quality reduction.',
  notMeasured:['physical laptop FPS','21 networked devices','subjective eye comfort'],
  metrics:'Screenshot luminance uses linear sRGB Rec.709. World metrics exclude the recorded main HUD panel, note and help rectangles; small corner icon buttons remain. Means/bright-area shares describe output, not a medical or subjective comfort score. HUD contrast uses computed foreground/background over both black and white for any residual transparency.',
  sourceHashes:{},checks:[],screenshots:[],movement:[],errors:[]};
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
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
  const frames=(n=4)=>page.evaluate(n=>new Promise(resolve=>{const tick=()=>{if(--n<=0)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);}),n);
  const player=()=>page.evaluate(()=>{const p=Object.values(__S2.getState().players)[0];return {x:p.x,y:p.y,z:p.z,vx:p.vx,vz:p.vz};});
  const settle=async()=>{await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return Math.hypot(p.vx,p.vz)<.001;});await frames(12);};
  const capture=async(name,kind='actual-input')=>{
    await frames();const stats=await page.evaluate(()=>__S2.scene.stats());
    assert.ok(stats.calls>0&&stats.triangles>0,'Rendered world is nonempty');
    assert.equal(stats.pixelRatio,.85,'Drawing scale stays at Season 1 default');assert.equal(stats.aaSamples,4,'Native MSAA stays enabled');
    if(!baseline){assert.equal(stats.graphics.toneMapping,'AgX');assert.equal(stats.graphics.exposure,1.28);assert.equal(stats.graphics.antialias,true);}
    const file=path.join(out,name+'.png'),png=await page.screenshot({path:file});
    const metrics=await page.evaluate(async base64=>{
      const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
      const rects=[...document.querySelectorAll('#ui .panel,#ui .boss-panel,#ui .bottom-help,#ui .toast,#ui .notice,#ui .teacher-bar')].filter(visible).map(el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
      const linear=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
      const lut=Array.from({length:256},(_,v)=>linear(v)),luminance=c=>.2126*linear(c[0])+.7152*linear(c[1])+.0722*linear(c[2]);
      const totals={full:{pixels:0,sum:0,bright:0,nearWhite:0},world:{pixels:0,sum:0,bright:0,nearWhite:0},skyBand:{pixels:0,sum:0,bright:0,nearWhite:0}};
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const i=(y*canvas.width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],lum=.2126*lut[r]+.7152*lut[g]+.0722*lut[b];
        const hud=rects.some(rect=>x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h);
        for(const key of ['full',...(!hud?['world',...(y<220?['skyBand']:[])]:[])]){
          const t=totals[key];t.pixels++;t.sum+=lum;if(lum>.75)t.bright++;if(r>245&&g>245&&b>245)t.nearWhite++;
        }
      }
      const summaries=Object.fromEntries(Object.entries(totals).map(([key,t])=>[key,{pixels:t.pixels,meanLinearLuminance:t.sum/t.pixels,brightAreaShare:t.bright/t.pixels,nearWhiteShare:t.nearWhite/t.pixels}]));
      const rgba=str=>{const v=str.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];return [v[0],v[1],v[2],v[3]??1];};
      const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3]));
      const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const text=[];
      for(const selector of ['.phase-heading h1','.goal','.health-name','.health-detail','.boss-phase','#start-game','#depart-game']){
        const el=document.querySelector(selector);if(!el||!visible(el))continue;
        const s=getComputedStyle(el),layers=[];let node=el;
        while(node&&node.id!=='ui'){layers.unshift(rgba(getComputedStyle(node).backgroundColor));node=node.parentElement;}
        const backgrounds=[[0,0,0],[255,255,255]].map(base=>layers.reduce((bg,layer)=>over(layer,bg),base));
        const foreground=rgba(s.color),ratios=backgrounds.map(bg=>contrast(over(foreground,bg),bg));
        text.push({selector,text:el.textContent.trim(),foreground:s.color,backgrounds,minimumContrast:Math.min(...ratios),fontSize:s.fontSize});
      }
      return {...summaries,hudRects:rects,text};
    },png.toString('base64'));
    for(const entry of metrics.text)if(!baseline&&['.phase-heading h1','.goal','.health-name','.boss-phase'].includes(entry.selector))assert.ok(entry.minimumContrast>=4.5,`${entry.selector} contrast ${entry.minimumContrast} >=4.5`);
    report.screenshots.push({name,kind,path:file,player:await player(),stats,metrics});
  };
  const walk=async(axis,target)=>{
    const before=await player(),direction=Math.sign(target-before[axis]);if(Math.abs(target-before[axis])<.2)return;
    const key=axis==='x'?(direction<0?'KeyA':'KeyD'):(direction<0?'KeyW':'KeyS');await page.locator('#game').focus();await page.keyboard.down(key);
    try{await page.waitForFunction(({axis,target,direction})=>direction*(Object.values(__S2.getState().players)[0][axis]-target)>=-.15,{axis,target,direction});}
    finally{await page.keyboard.up(key);}await settle();report.movement.push({key,axis,target,before,after:await player()});
  };
  const look=async yaw=>{
    const current=await page.evaluate(()=>__S2.view.yaw),dx=-(yaw-current)/SEASON1_CAMERA.mouseSensitivity;
    await page.mouse.move(1050,460);await page.mouse.down({button:'right'});
    try{await page.mouse.move(1050+dx,460,{steps:8});}finally{await page.mouse.up({button:'right'});}await frames();
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/`+entry.split('/').map(encodeURIComponent).join('/')+'?test=1',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await __S2.scene.ready;});
  await page.locator('#player-name').fill('화면 검수');await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();await page.waitForFunction(()=>__S2.getState().phase==='lobby');await settle();
  await capture('01-lobby-default');
  await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');await settle();
  await capture('02-village-default-spawn');
  assert.equal(await page.evaluate(()=>__S2.view.zoom),3.2);check('실제 대기실·마을 기본 시점, 동일 해상도·MSAA');
  await walk('z',16);await walk('x',-5.2);await walk('z',14);await look(.65);await capture('03-workshop-front-default-pitch');
  await look(0);assert.equal(await page.evaluate(()=>document.pointerLockElement),null);check('실제 WASD 접근·우클릭 시점, 커서 잠금 없음');
  await page.locator('#depart-game').click();await page.waitForFunction(()=>__S2.getState().phase==='forest');await settle();
  await capture('04-forest-actual-departure');check('실제 출격 후 숲·HUD 가독성');
  await page.evaluate(()=>{
    __S2.setManual(true);const s=__S2.getState(),p=Object.values(s.players)[0];Object.assign(p,{x:0,y:.08,z:-103,yaw:0,hp:100,vx:0,vz:0});
    Object.assign(s,{phase:'boss',stage:2,beacon:true,paused:false,events:[],enemies:[],towers:[]});
    s.boss={id:'boss',x:0,z:-115,yaw:0,hp:900,maxHp:1200,phase:'warn',timer:1.2,dx:0,dz:1,chargeLength:18,chargeWidth:5.2};
  });
  await frames(30);await capture('05-boss-warning-fixture','supplementary synthetic boss-warning fixture');
  assert.ok(await page.locator('#boss-panel').isVisible());assert.match(await page.locator('#boss-phase').textContent(),/돌진 예고/);
  check('보조 보스 경고 장면·위험 안내 표시, 핵심 HUD 글자 대비',report.screenshots.at(-1).metrics.text);
  assert.deepEqual(report.errors,[]);check('브라우저 실행 오류 없음');report.result='passed';
}catch(error){report.result='failed';report.failure=error.stack||String(error);console.error(report.failure);process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await mkdir(out,{recursive:true});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Report: '+path.join(out,'report.json'));}
