/* 마지막 밤(15일차) 만 여러 배수로 쓸어 본다.
   인자: <파일> <포트> <총 쏘는 아이 수> <무기번호> <hpMul 목록> */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const FILE=process.argv[2], PORT=+process.argv[3];
const SHOOT=+(process.argv[4]||0), WPN=+(process.argv[5]||3);
const MULS=(process.argv[6]||'2.0').split(',').map(Number);
const FIX=+(process.argv[8]||0);   // 밤에 수리하는 아이 수
const HIT=+(process.argv[9]||1);   // 아이가 겨눠서 맞히는 비율 (FPS 조준)
const DAYS=(process.argv[7]||'12,15').split(',').map(Number);
const TOW=(process.argv[10]||'many');   // 'old'=예전 개수 제한 / 'many'=제한 푼 뒤
const ATK=+(process.argv[11]||1);       // 스텟(사격 솜씨)으로 오른 공격 배수
const LV=+(process.argv[12]!==undefined?process.argv[12]:6);  // 0 = 섞인 등급(mix)        // 방어선 등급 (교실에서 실제로 나올 법한 값)
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:900,height:600}});
const errs=[]; pg.on('pageerror', e=> errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','t'); await pg.click('#bSolo'); await pg.waitForTimeout(800);
const rows = await pg.evaluate(([SHOOT,WPN,MULS,DAYS,FIX,HIT,TOW,ATK,LV])=>{
  const W=window, G=W.__G, out=[];
  G.started=false; if(W.__PL) W.__PL.down=true;
  /* ★ 'mix' = 교실에서 실제로 나오는 모습 — 몇 채만 Lv6 이고 나머지는 아래 등급이다.
     자재가 한정돼 있어서 전부 Lv6 이 되는 일은 없다. */
  const MIXLV=[6,6,5,5,4,4,4,3,3,3,2,2,2,2,2,2,2];
  const build=(lv)=>{
    W.__clear();
    for(let g=0; g<5; g++){ const d=W.__DIRS[g]; G.me.g=g; G.res[g]={w:999999,s:999999,g:999999};
      for(let pp=-8; pp<=8; pp+=0.5){
        const x=Math.round(d.dx*42 - d.dz*pp), z=Math.round(d.dz*42 + d.dx*pp);
        if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
          const o=[...W.__STRU.values()].pop();
          const L2 = lv>0 ? lv : 4;              // 벽은 mix 여도 Lv4 로 본다
          o.lv=L2; o.mx=W.__bs('swall','hp',L2); o.hp=o.mx; } }
      /* ★ 12차에서 탑·배럭 개수 제한을 없앴다. 'many' 는 그 뒤 교실에서 실제로 나올 법한 수
         (화살탑 9 · 얼음탑 5 · 배럭 3). 'old' 는 예전 제한(6/3/2) 그대로다. */
      const TSET = TOW==='old'
        ? [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],['arrow',26,0],['arrow',39,0],
           ['ice',33,-5],['ice',33,5],['ice',28,0],['barr',24,-3],['barr',24,3]]
        : [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],['arrow',26,0],['arrow',39,0],
           ['arrow',29,-6],['arrow',29,6],['arrow',34,0],
           ['ice',33,-5],['ice',33,5],['ice',28,0],['ice',38,-3],['ice',38,3],
           ['barr',24,-3],['barr',24,3],['barr',22,0]];
      TSET.forEach(([t,rr,pp], ti)=>{
        const x=Math.round(d.dx*rr - d.dz*pp), z=Math.round(d.dz*rr + d.dx*pp);
        if(W.__canPlace(t,x,z)===null){ W.__place(t,x,z);
          const o=[...W.__STRU.values()].pop();
          const L2 = lv>0 ? lv : MIXLV[Math.min(MIXLV.length-1, ti)];
          o.lv=L2; o.mx=W.__bs(t,'hp',L2); o.hp=o.mx; } }); }
    G.me.g=0; W.__rebuild();
  };
  const Wp = W.__WEAPONS[WPN];
  const mkKids=()=>{ const k=[];
    for(let i=0;i<SHOOT;i++){ const d=W.__DIRS[i%5], off=((i/5|0)-1)*3;
      k.push({x:d.dx*38-d.dz*off, z:d.dz*38+d.dx*off, cd:Math.random()*Wp.cd, boss:(i%2)===0}); }
    return k; };
  for(const mul of MULS){
    W.__BAL.hpMul = mul;
    for(const day of DAYS){
      let win=0, note='';
      for(let run=0; run<5; run++){
        build(LV);
        G.day=day; G.crystal=G.set.crystalMax; G.wolves.length=0; G.soldiers.length=0;
        W.__goNight();
        const dayMul = 1 + 0.14*(day-1), kids = mkKids();
        const steps=Math.ceil(G.set.nightSec*20);
        for(let i=0;i<steps;i++){
          W.__step(1,1/20);
          for(const k of kids){ k.cd -= 0.05; if(k.cd>0) continue;
            let best=null, bd=Wp.rng*Wp.rng;
            if(k.boss){ for(const w of G.wolves){ if(w.k<3) continue;
              const dx=w.x-k.x, dz=w.z-k.z, d2=dx*dx+dz*dz; if(d2<bd){ bd=d2; best=w; } } }
            if(!best){ bd=Wp.rng*Wp.rng;
              for(const w of G.wolves){ const dx=w.x-k.x, dz=w.z-k.z, d2=dx*dx+dz*dz;
                if(d2<bd){ bd=d2; best=w; } } }
            if(!best){ k.cd=0.2; continue; }
            k.cd=Wp.cd;
            if(Math.random() > HIT) continue;      // 겨냥이 빗나갔다
            best.hp -= Math.round(Wp.dmg*dayMul*ATK*(Math.random()<0.14?2:1));
          }
          /* ★ 절반은 위험한 입구로 달려간다.
             게임이 "🚨 3모둠 쪽에 늑대 6마리! 가까운 친구들 도와주러 가요" 라고
             직접 알려 주기 때문에, 실제 교실에서는 다들 그쪽으로 몰린다.
             제자리에 못 박아 두면 집중 입구가 뚫리는 걸 아무도 못 막는 것으로 잰다. */
          if(i % 100 === 0){
            const cnt = [0,0,0,0,0];
            for(const w of G.wolves){ const a=Math.atan2(w.z,w.x);
              let bg=0, bd2=9; for(let g=0;g<5;g++){
                let dd2=Math.abs(((a-W.__DIRS[g].a+Math.PI*3)%(Math.PI*2))-Math.PI);
                if(dd2<bd2){ bd2=dd2; bg=g; } }
              cnt[bg]++; }
            let hot=0; for(let g=1;g<5;g++) if(cnt[g]>cnt[hot]) hot=g;
            const dh = W.__DIRS[hot];
            kids.forEach((k,ki)=>{ if(ki%2) return;          // 절반만 이동
              const off=((ki/2|0)-2)*3;
              k.x = dh.dx*38 - dh.dz*off; k.z = dh.dz*38 + dh.dx*off; });
          }
          /* ★ 밤에 애들이 수리한다 — 수리 한 번 2.5초, 한 번에 최대 체력의 40%가 찬다.
             이걸 안 넣으면 탑이 부서진 채로 밤이 끝나서, 실제보다 훨씬 어렵게 나온다. */
          if(FIX && i % 50 === 0){
            const hurt = [...W.__STRU.values()].filter(o=>o.hp < o.mx*0.98)
                          .sort((a,b)=> a.hp/a.mx - b.hp/b.mx);
            for(let f=0; f<FIX && f<hurt.length; f++){
              const o = hurt[f]; o.hp = Math.min(o.mx, o.hp + o.mx*0.40);
            }
          }
          if(G.phase!=='night') break;
        }
        if(G.crystal > 0) win++;
        note += ' ' + Math.round(G.crystal);
      }
      out.push(`hpMul ${mul.toFixed(2)} · ${day}일차 · 탑 ${TOW} ${LV>0?'Lv'+LV:'등급섞임'} · 공격×${ATK} · 명중률 ${Math.round(HIT*100)}%`
        + ` · 건물 ${W.__STRU.size}채 → 5판 중 ${win}판 버팀 (남은 수정${note})`);
    }
  }
  return out;
}, [SHOOT,WPN,MULS,DAYS,FIX,HIT,TOW,ATK,LV]);
console.log(rows.join('\n'));
if(errs.length) console.log('ERR: '+errs.slice(0,3).join(' | '));
await b.close(); srv.close();
