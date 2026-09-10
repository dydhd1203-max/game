/* 19차 화면 확인 — 꽃밭 · 짝꿍 · 새 모자·옷
   ★ 코드가 맞아 보여도 화면은 다르다. 여기서 잡은 것들:
     - 꽃이 '탑' 처럼 서 있지 않나 (18차g에 산물에서 겪은 그 함정)
     - 짝꿍이 주인 몸 속에 파묻히지 않나
     - 새 모자·옷이 털 속에 묻히지 않나 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const PORT=+(process.argv[3]||19931), OUT=process.argv[4]||'/tmp/shot';
const srv=serve(PORT, process.argv[2]||GAME);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:1100,height:760}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
await pg.goto('http://127.0.0.1:'+PORT+'/',{waitUntil:'load',timeout:60000});
await pg.waitForFunction('window.__READY===true',{timeout:60000});

/* ① 시작 화면 — 짝꿍 고르는 칸이 생겼다. 미리보기에 짝꿍이 서 있나 */
await pg.evaluate(()=>{
  const clk=(id,i)=>document.querySelectorAll('#'+id+' button')[i].click();
  clk('hatPick', 11);            // 유니콘 뿔
  clk('cloPick', 9);             // 발레 치마
  clk('petPick', 6);             // 유니콘 짝꿍
});
await pg.waitForTimeout(1400);
await pg.screenshot({path:OUT+'/19-title.png'}); console.log('찍음 19-title');

await pg.fill('#iName','김하늘'); await pg.click('#bSolo'); await pg.waitForTimeout(2200);
await pg.evaluate(()=>document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on')));

/* 카메라는 PL 과 같이 옮겨야 한다 — updPlayer 가 되돌린다(README 16차).
   ★ 시선 방향은 (-sin yaw, -cos yaw) 다 (camera.rotation.set(pitch,yaw,0,'YXZ')).
     한 번 부호를 틀려서 엉뚱한 데를 찍었다. */
const lookAt = async (tx,tz, dist, ang, pitch)=> pg.evaluate(([tx,tz,dist,ang,pitch])=>{
  const PL=window.__PL;
  const px = tx - Math.sin(ang)*dist, pz = tz - Math.cos(ang)*dist;
  PL.x=px; PL.z=pz; PL.down=false;
  PL.yaw = Math.atan2(-(tx-px), -(tz-pz));
  PL.pitch = pitch;
}, [tx,tz,dist,ang,pitch]);

/* ② 꽃밭 — 마당에 한 무더기 심어 놓고 본다 */
const spots = await pg.evaluate(()=>{
  const W=window, G=W.__G;
  W.__base[G.me.g].w = 900; W.__recompute();
  /* 평평하고 빈 칸을 찾아 한 무더기 심는다 — 무작위 지형이라 자리를 '찾아' 쓴다 */
  const put=[];
  let cx=0, cz=0;
  outer:
  for(let r=13; r<=24; r++) for(let a=0; a<360; a+=6){
    const X=Math.round(Math.cos(a*Math.PI/180)*r), Z=Math.round(Math.sin(a*Math.PI/180)*r);
    /* 산·성문 쪽은 피한다 — 배경이 벽뿐이라 꽃이 안 보인다 */
    if(Math.max(Math.abs(X),Math.abs(Z)) > 26) continue;
    let free=0;
    for(let dx=-2; dx<=2; dx++) for(let dz=-2; dz<=2; dz++)
      if(!W.__grdCheck(X+dx, Z+dz)) free++;
    if(free >= 24){ cx=X; cz=Z; break outer; }
  }
  for(let dx=-2; dx<=2; dx++) for(let dz=-2; dz<=2; dz++){
    const X=cx+dx, Z=cz+dz;
    if(W.__grdCheck(X,Z)) continue;
    W.__PL.x=X+0.5; W.__PL.z=Z+0.5;
    W.__plantFlower(X,Z); put.push([X,Z]);
  }
  G.phase='day'; W.__gardenGrow(W.__GRD().BLOOM+1);
  return put;
});
console.log('심은 자리', spots.length);
if(spots.length){
  let sx=0, sz=0; for(const [x,z] of spots){ sx+=x+0.5; sz+=z+0.5; }
  const cx = sx/spots.length, cz = sz/spots.length;
  await lookAt(cx, cz, 5.0, 0.9, -0.34);
  await pg.waitForTimeout(900);
  await pg.screenshot({path:OUT+'/19-garden.png'}); console.log('찍음 19-garden');
  /* 가까이 — 꽃 한 송이의 생김새 */
  await lookAt(cx, cz, 2.1, 0.9, -0.50);
  await pg.waitForTimeout(900);
  await pg.screenshot({path:OUT+'/19-garden-near.png'}); console.log('찍음 19-garden-near');
  /* 새싹도 하나 본다 */
  await pg.evaluate(()=>{ window.__G.garden.forEach((f,i)=>{ if(i%2) f.b=0; }); });
  await pg.waitForTimeout(700);
  await pg.screenshot({path:OUT+'/19-garden-sprout.png'}); console.log('찍음 19-garden-sprout');
  await pg.evaluate(()=>{ window.__G.garden.forEach(f=>f.b=1); });
}

/* 친구들을 한 줄로 세우고 그 앞에서 본다 — 늘어놓는 자리는 지금 내가 선 곳 기준이다.
   ★ HUD 를 잠깐 끈다. 가운데 안내판이 얼굴을 가려서 세 번 헛수고했다(README 14차b). */
const lineUp = async (make, nm, dz, dist, pitch, pull)=>{
  const cz = await pg.evaluate(([mk, dz])=>{
    const W=window, G=W.__G, GY=W.__PL.y;
    G.players.clear(); W.__pcMap.clear();
    const bx = W.__PL.x, bz = W.__PL.z + dz;
    const looks = JSON.parse(mk);
    looks.forEach((L,i)=>{
      const k='q'+i;
      G.players.set(k, {uid:k, x:bx + (i-(looks.length-1)/2)*2.0, z:bz, y:GY,
        ry:Math.PI, n:'', g:i%5, hat:L[0], gls:L[1], clo:L[2], mv:false, ph:i*1.7, hp:100, down:false});
      W.__pcMap.set(k, {n:'', g:i%5, pet:L[3]||0});
    });
    document.getElementById('hud').style.opacity = '0';
    document.getElementById('stageTitle').classList.remove('on');
    return [bx, bz];
  }, [JSON.stringify(make), dz]);
  await lookAt(cz[0], cz[1], dist||7.0, Math.PI, pitch===undefined?-0.16:pitch);
  await pg.waitForTimeout(1600);
  /* 짝꿍은 주인 곁을 돈다 — 찍는 순간에는 카메라 쪽으로 끌어다 놓아야 다 보인다.
     (한 프레임에 목표 쪽으로 조금씩만 움직이므로 바로 찍으면 그 자리에 있다) */
  await pg.evaluate(()=>{
    const W=window, G=W.__G, m=W.__petAt();
    for(const [k,q] of G.players){ const s=m.get(k); if(s){ s.x=q.x; s.z=q.z+1.6; s.ry=Math.PI; } }
  });
  await pg.waitForTimeout(120);
  await pg.screenshot({path:OUT+'/'+nm+'.png'}); console.log('찍음', nm);
};

/* ③ 짝꿍 여섯 마리 */
await lineUp([[0,0,0,1],[0,0,0,2],[0,0,0,3],[0,0,0,4],[0,0,0,5],[0,0,0,6]], '19-pets', 0, 5.2, -0.13);

/* ④ 새 모자·옷 — 가까이서 봐야 유니콘 뿔·나비 핀이 보인다 */
await lineUp([[11,0,0],[12,0,0],[0,0,9],[0,0,10],[11,7,9]], '19-dress', 0, 5.6, -0.05);
await pg.evaluate(()=>{ document.getElementById('hud').style.opacity = ''; });

/* ⑤ 내 짝꿍 — 1인칭에서 정말 보이나. 이게 이 기능의 전부다. */
await pg.evaluate(()=>{
  const W=window, G=W.__G;
  G.players.clear(); W.__pcMap.clear();
  G.me.pet = 1; W.__setPet(1);
  W.__PL.pitch = 0;                      // 평소 걸어 다닐 때와 같은 시선으로 본다
});
/* ★ 짝꿍 자리는 updPets 가 처음 불릴 때 만들어진다 — 바로 집으려 하면 아직 없다.
   ★ 자리를 손으로 옮겨도 다음 프레임에 제 궤도로 끌려간다. 짝꿍을 붙잡는 대신
     **내가 짝꿍 쪽을 보게** 한다 — 실제로 놀 때와 똑같은 그림이 된다.
     (처음엔 짝꿍을 앞으로 끌어다 놓았는데, 한두 프레임 만에 옆으로 밀려나
      시야(가로 ±47°) 밖으로 나가 있었다. 재 보고 알았다: 앞으로 1.47칸 · 옆으로 1.7칸) */
await pg.waitForTimeout(2000);
/* 짝꿍이 제 궤도에 자리잡을 때까지 기다렸다가, 찍기 직전에 다시 바라본다.
   (검사용 브라우저는 프레임이 느려서 궤도에 붙는 데 시간이 더 걸린다) */
for(let i=0;i<3;i++){
  await pg.evaluate(()=>{
    const W=window, s=W.__petAt().get(W.__uid);
    if(!s) throw new Error('짝꿍 자리가 없다');
    W.__PL.yaw = Math.atan2(-(s.x - W.__PL.x), -(s.z - W.__PL.z));
    W.__PL.pitch = -0.12;
  });
  await pg.waitForTimeout(40);
}
await pg.screenshot({path:OUT+'/19-mypet.png'}); console.log('찍음 19-mypet');

/* ⑥ 씨앗을 심는 순간 — 경험치가 화면에 뜨나 */
await pg.evaluate(()=>{
  const W=window, G=W.__G;
  G.players.clear(); W.__pcMap.clear();
  W.__base[G.me.g].w = 900; W.__recompute();
  let sp=null;
  for(let r=11; r<=24 && !sp; r++) for(let a=0; a<360; a+=5){
    const X=Math.round(Math.cos(a*Math.PI/180)*r), Z=Math.round(Math.sin(a*Math.PI/180)*r);
    if(!W.__grdCheck(X,Z)){ sp=[X,Z]; break; }
  }
  /* ★ 시선은 (-sin yaw, -cos yaw) 다. 여기서 부호를 틀려서 심어 놓고
     **등 뒤를** 찍었다 — 초록 +6 이 화면에 없어서 한참 헤맸다. */
  const tx = sp[0]+0.5, tz = sp[1]+0.5;
  W.__PL.x = tx - 1.6; W.__PL.z = tz - 1.6;
  W.__PL.yaw = Math.atan2(-(tx - W.__PL.x), -(tz - W.__PL.z));
  W.__PL.pitch = -0.20;
  W.__plantFlower(sp[0], sp[1]);
  W.__selTool('plant'); W.__paintHUD();
});
await pg.waitForTimeout(350);
await pg.screenshot({path:OUT+'/19-plant-xp.png'}); console.log('찍음 19-plant-xp');

/* ⑤ 손에 든 도구 칸 — 꽃 심기 칸이 늘었다 */
await pg.evaluate(()=>{ window.__selTool('plant'); window.__paintHUD(); });
await pg.waitForTimeout(700);
await pg.screenshot({path:OUT+'/19-bar.png', clip:{x:0,y:600,width:1100,height:160}});
console.log('찍음 19-bar');

console.log(errs.length? '오류: '+errs.slice(0,3).join(' | ') : '오류 없음');
await b.close(); srv.close();
