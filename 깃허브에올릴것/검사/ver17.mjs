/* 시작 화면에 판 번호(패치 내용)가 **안** 보이나 — 51차c
   17차에는 "새 파일을 올렸는데 화면이 그대로면 잘못 보낸 건지 알 수 없다" 는 까닭으로
   시작 화면에 판 번호를 큼직하게 붙였다. 51차c 에 선생님이 "시작화면에 패치내용 안 나오게
   삭제해 줘" 라고 해서 **화면에서는 빼고 콘솔로만** 찍는다. 이 파일은 그 둘을 한 번에 본다:
     ① 시작 화면에 판 번호 문단이 없다   ② 콘솔에는 판 번호가 찍힌다 */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19860), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:900,height:820}});
const errs=[], logs=[];
pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='log') logs.push(m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.waitForTimeout(600);
const onScreen = await pg.evaluate(()=>{
  const e = document.getElementById('verTag') || document.querySelector('#intro .ver');
  return e ? {글자:e.textContent, 보임:e.offsetParent!==null} : null; });
const conVer = logs.find(t=>t.startsWith('좀비의 밤 — ')) || null;
console.log('시작 화면의 판 번호 =', JSON.stringify(onScreen), onScreen ? '← 남아 있다(빼야 한다)' : '← 없다 (좋다)');
console.log('콘솔의 판 번호     =', conVer ? conVer.slice(0, 90) + '…' : '없다 (있어야 한다)');
await pg.screenshot({path:OUT+'/ver-시작화면.png'});
console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
