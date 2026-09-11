/* 총기 반동을 재는 것 (23차) — 계산하지 말고 **게임 함수를 그대로 굴려서** 잰다.
   ★ 20차 줄넘기에서 종이 위 포물선으로 잡았다가 틀렸다. 반동도 같은 종류다.
   무기마다: 한 발 쏘면 몇 도 들리나 · 되돌아오는 데 몇 초 · 드르륵 갈기면 어디까지 솟나. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const srv = serve(+(process.argv[3]||16900), process.argv[2] || GAME);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1000,height:700}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+(+(process.argv[3]||16900))+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});
await pg.fill('#iName','측정'); await pg.click('#bSolo'); await pg.waitForTimeout(1400);
console.log(await pg.evaluate(()=>{
  const W=window, DEG=180/Math.PI, L=[];
  const R = W.__RECOIL();
  L.push('반동 상수 — 한 발 최대 올림 ' + (R.up*DEG).toFixed(2) + '° (kick 1.0 기준) · '
       + '좌우 ±' + (R.side*DEG).toFixed(2) + '° · 천장 ' + (R.max*DEG).toFixed(1) + '°');
  L.push('  되돌아오기: 쏘는 중 ' + R.slow + '/초 · 손 떼면 ' + R.back + '/초 (' + R.hold + '초 뒤부터)');
  L.push('');
  L.push('무기            kick  한 발   0.2초 뒤  0.5초 뒤   드르륵 3초(누르고 있기)');
  for(let i=0;i<W.__WEAPONS.length;i++){
    const Wp = W.__WEAPONS[i];
    if(!Wp.kick) continue;
    /* ★ 맨손 돌(0번)은 총이 아니라 반동이 안 붙는다 — 표에는 상수가 주는 값만 적어 둔다 */
    /* ── 한 발 ── */
    W.__recoilReset(); W.__fireRecoil(Wp.kick);
    const one = W.__aimKick()*DEG;
    for(let t=0;t<0.2;t+=1/60) W.__recoilTick(1/60);
    const after02 = W.__aimKick()*DEG;
    for(let t=0.2;t<0.5;t+=1/60) W.__recoilTick(1/60);
    const after05 = W.__aimKick()*DEG;
    /* ── 3초 동안 쿨다운마다 계속 쏘기 (연발총이면 드르륵) ── */
    W.__recoilReset();
    let cd = 0, peak = 0, shots = 0;
    for(let t=0; t<3; t+=1/60){
      cd -= 1/60;
      if(cd <= 0){ W.__fireRecoil(Wp.kick); cd = Wp.cd; shots++; }
      W.__recoilTick(1/60);
      peak = Math.max(peak, W.__aimKick()*DEG);
    }
    L.push(Wp.n.padEnd(12,'　').slice(0,12) + String(Wp.kick).padStart(6)
      + one.toFixed(2).padStart(7) + '°'
      + after02.toFixed(2).padStart(9) + '°'
      + after05.toFixed(2).padStart(9) + '°'
      + ('  ' + shots + '발 → 최고 ' + peak.toFixed(2) + '°'));
  }
  /* ── 이만큼 들리면 몇 칸을 빗나가나 ── */
  L.push('');
  L.push('들린 각도가 거리에서 몇 칸 위로 빗나가나 (조준 너그러움 aimR 과 견줘 본다)');
  for(const deg of [0.5, 1.0, 2.0, 4.0]){
    const r = deg/DEG;
    L.push('  ' + deg.toFixed(1) + '° → 10칸에서 ' + (Math.tan(r)*10).toFixed(2) + '칸 · '
         + '20칸에서 ' + (Math.tan(r)*20).toFixed(2) + '칸');
  }
  L.push('  (늑대 조준 너그러움: 돌 2.6칸 · 소총 1.5칸 + 거리×0.05)');
  /* ★ 진짜 물어야 할 것 — "이래도 3학년이 맞힐 수 있나".
     12칸 앞 늑대를 계속 갈겼을 때 솟은 각도가 그 무기의 조준 너그러움을 넘는지 본다. */
  L.push('');
  L.push('12칸 앞 늑대를 계속 갈겼을 때 — 솟은 만큼 빗나가나 (넘으면 안 맞는다)');
  for(let i=0;i<W.__WEAPONS.length;i++){
    const Wp = W.__WEAPONS[i]; if(!Wp.kick) continue;
    W.__recoilReset();
    let cd=0, peak=0;
    for(let t=0;t<4;t+=1/60){ cd-=1/60; if(cd<=0){ W.__fireRecoil(Wp.kick); cd=Wp.cd; }
      W.__recoilTick(1/60); peak=Math.max(peak, W.__aimKick()); }
    const off = Math.tan(peak)*12, tol = Wp.aimR + 12*0.05;
    L.push('  ' + Wp.n.padEnd(12,'　').slice(0,12)
      + ' 솟음 ' + (peak*DEG).toFixed(2) + '° → ' + off.toFixed(2) + '칸 빗나감'
      + ' · 너그러움 ' + tol.toFixed(2) + '칸 → ' + (off < tol ? '아직 맞는다' : '빗나간다')
      + ' (여유 ' + (100 - off/tol*100).toFixed(0) + '%)');
  }
  return L.join('\n');
}));
console.log(errs.length?('오류: '+errs.join(' | ')):'(오류 없음)');
await b.close(); srv.close();
