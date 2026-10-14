// Short real-input capture supplements the main motion suite. The distributable
// is loaded from loopback then disconnected, with no pose/position changes or focus helpers.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '../../깃허브에올릴것/검사/pw.mjs';
const base=fileURLToPath(new URL('../',import.meta.url));
const bundle=path.join(base,'배포용/index.html');
const output=path.resolve(process.env.S2_SPRINT_OUTPUT||path.join(base,'검수/s2-007/motion'));
const report={scope:'Actual solo entry → village button → Shift+W; compiled HTML loaded on loopback then browser network disabled; no test state changes',
  sourceSHA256:createHash('sha256').update(await readFile(bundle)).digest('hex'),errors:[]};
let browser;
const html=await readFile(bundle);
const server=createServer((req,res)=>res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html));
try{
  await mkdir(output,{recursive:true});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
  page.setDefaultTimeout(45000);page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?test=1`,{waitUntil:'networkidle'});
  await page.context().setOffline(true);
  await page.locator('#player-name').fill('달리기 검수');
  await page.locator('input[name="mode"][value="solo"]').check();
  await page.locator('#entry-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.__S2?.getState().phase==='lobby');
  await page.locator('#start-game').click();await page.waitForFunction(()=>__S2.getState().phase==='village');
  await page.waitForFunction(()=>Math.abs(__S2.scene.stats().camera.distance-3.2)<.01);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'game');
  if(process.env.S2_SPRINT_HELP_SMOKE==='1'){
    await page.locator('#help-toggle').click();
    report.helpText=await page.locator('#help-panel').innerText();
    assert.ok(report.helpText.includes('마을·원정: Shift 달리기. Space를 떼었다 다시 누르면 2단 점프·공중제비. 대기실은 단일 점프만 가능해요.'));
    await page.screenshot({path:path.join(output,'00-final-help.png')});
    await page.locator('#help-toggle').click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'game','Closing final help returns movement focus');
    report.helpClosedWithGameFocus=true;
  }
  const sample=()=>page.evaluate(()=>{
    const p=Object.values(__S2.getState().players)[0],stats=__S2.scene.stats();
    return {player:{x:p.x,y:p.y,z:p.z,gp:p.gp,run:p.run,vx:p.vx,vz:p.vz,stamina:p.stamina},
      input:__S2.getInput(),motion:stats.motion,camera:stats.camera,calls:stats.calls,triangles:stats.triangles};
  });
  report.before=await sample();
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>{const p=Object.values(__S2.getState().players)[0];return p.run&&p.gp>.45&&Math.abs(p.vz)>8&&__S2.scene.stats().motion.live>0;});
  report.running=await sample();
  await page.screenshot({path:path.join(output,'09-village-shift-sprint.png')});
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
  assert.ok(report.running.player.run);assert.ok(report.running.motion.live>0&&report.running.motion.live<=64);
  assert.ok(report.running.camera.fov>70);assert.ok(report.running.calls>0);
  assert.deepEqual(report.errors,[]);report.result='passed';
  console.log('PASS offline compiled HTML: actual Shift running pose, dust and FOV capture');
}catch(error){report.result='failed';report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(output,'sprint-report.json'),JSON.stringify(report,null,2)+'\n');}
