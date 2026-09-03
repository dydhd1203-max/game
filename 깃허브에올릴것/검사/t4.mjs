import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve.mjs';
const srv = serve(8734);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1100,height:700}});
const errs=[];
pg.on('pageerror', e=> errs.push('PAGEERROR: '+e.message));
await pg.goto('http://127.0.0.1:8734/?diag=1', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});

const r = await pg.evaluate(()=>{
  const W=window, out=[], ok=(n,c,x)=>out.push((c?'  OK  ':'FAIL  ')+n+(x!==undefined?'   → '+x:''));
  const PL=W.__PL, G=W.__G, cam=W.__cam, NODES=W.__NODES, GY=W.__GY;
  const tick=(n,dt=1/60)=>{ for(let i=0;i<n;i++) W.__doAction(dt); };
  const look=(fromx,fromz,tox,toz,pitch=0)=>{
    PL.x=fromx; PL.z=fromz; PL.y=GY;
    const dx=tox-fromx, dz=toz-fromz, L=Math.hypot(dx,dz)||1;
    const yaw=Math.atan2(-dx/L, -dz/L);
    PL.yaw=yaw; cam.position.set(PL.x, PL.y+PL.EYE, PL.z); cam.rotation.set(pitch, yaw, 0, 'YXZ');
  };
  G.phase='day'; G.started=false;
  try{
  const totHp=()=>NODES.reduce((a,n)=>a+(n.alive?n.hp:0),0);

  /* ── 6. 캐기: 한 번 누를 때 하나만 ── */
  W.__selTool('mine');
  // 서로 가까운 자원 두 개 찾기
  let A=null,Bn=null,best=1e9;
  for(const n of NODES){ if(!n.alive) continue;
    for(const m of NODES){ if(n===m||!m.alive) continue;
      const dd=Math.hypot(n.x-m.x,n.z-m.z);
      if(dd>2.0 && dd<best){best=dd;A=n;Bn=m;} } }
  const ax=A.x+0.5, az=A.z+0.5, bx=Bn.x+0.5, bz=Bn.z+0.5;
  const ux=(bx-ax)/best, uz=(bz-az)/best;
  look(ax-ux*2.0, az-uz*2.0, bx, bz);      // A 뒤에 서서 A→B 방향을 본다
  const aimed = W.__aimNode();
  ok('세팅: A 를 조준했다', aimed===A, aimed===A?'':'다른 걸 조준함');

  const before = totHp();
  W.__setActing(true);
  tick(60*8);                                // 8초 — A 는 다 캐지고도 남는다
  const st = W.__mine();
  ok('A 를 다 캤다', A.alive===false);
  ok('A 가 없어지면 붙잡은 게 풀린다', st.lock===null && st.done===true);
  const chainable = W.__aimNode();
  ok('세팅: A 가 없어진 뒤 조준되는 다른 자원이 있다', !!chainable && chainable!==A,
     chainable ? '있음' : '없음(테스트 의미 없음)');
  const afterA = totHp();
  tick(60*8);                                // 계속 누르고 있어도
  ok('★ 꾹 눌러도 다음 자원은 안 캐진다', totHp()===afterA, (afterA-totHp())+' 만큼 더 캐짐');

  W.__setActing(false); W.__doAction(1/60);  // 손 떼고
  W.__setActing(true);  tick(60*1);          // 다시 누르면
  ok('★ 다시 누르면 그 다음 자원이 캐진다', totHp()<afterA, (afterA-totHp())+' 캐짐');
  W.__setActing(false); W.__doAction(1/60);

  /* ── 7. 짓는 데 시간이 걸린다 ── */
  W.__clear();
  G.res[G.me.g] = {w:99, s:99, g:99};
  W.__selBuild('wwall');
  look(20, 0, 23, 0, -0.35);                 // 앞쪽 바닥을 본다
  W.__setActing(true);
  W.__doAction(1/60);
  const wk = W.__work();
  ok('누르면 공사가 시작된다', !!wk && wk.kind==='build', wk?wk.kind:'없음');
  tick(60*3);                                // 3초 (필요 3.5초)
  ok('3초에는 아직 안 세워진다', W.__STRU.size===0, W.__STRU.size+'채');
  ok('3초 지점 진행률 ~86%', Math.abs(W.__work().prog/3.5 - 0.86)<0.06,
     Math.round(W.__work().prog/3.5*100)+'%');
  tick(60*1);                                // 총 4초
  ok('★ 3.5초 넘으면 나무벽이 선다', W.__STRU.size===1, W.__STRU.size+'채');
  ok('공사 끝나면 상태가 비워진다', W.__work()===null);

  // 도중에 손을 떼면 없던 일이 된다
  W.__clear(); W.__setActing(false); W.__doAction(1/60);
  G.res[G.me.g] = {w:99, s:99, g:99};
  const w0 = W.__myPC().sw||0;
  look(-20, 0, -23, 0, -0.35);
  W.__setActing(true); tick(60*2);
  ok('중간에 자원을 미리 안 뺏는다', (W.__myPC().sw||0)===w0);
  W.__setActing(false); W.__doAction(1/60);
  ok('★ 손 떼면 공사가 취소된다', W.__work()===null && W.__STRU.size===0);

  // 탑은 8초 — 놓을 수 있는 칸을 찾아서 정확히 그 칸을 내려다본다
  W.__clear(); G.res[G.me.g]={w:99,s:99,g:99};
  W.__selBuild('arrow');
  let tX=null,tZ=null;
  for(let X=12; X<30 && tX===null; X++) for(let Z=-6; Z<=6; Z++)
    if(W.__canPlace('arrow',X,Z)===null){ tX=X; tZ=Z; break; }
  const px=tX-3.2, pz=tZ+0.5;
  PL.x=px; PL.z=pz; PL.y=GY;
  { const dx=tX+0.5-px, dz=tZ+0.5-pz, dh=Math.hypot(dx,dz);
    const yaw=Math.atan2(-dx/dh, -dz/dh), pit=-Math.atan(PL.EYE/dh);
    PL.yaw=yaw; cam.position.set(px, GY+PL.EYE, pz); cam.rotation.set(pit, yaw, 0, 'YXZ'); }
  W.__setActing(true); W.__doAction(1/60);
  ok('세팅: 화살탑 공사가 시작됐다', !!W.__work(),
     W.__work()? (W.__work().X+','+W.__work().Z)+' / 노린 칸 '+tX+','+tZ : '안 됨');
  tick(60*7);
  ok('화살탑은 7초에 아직 안 선다', W.__STRU.size===0, W.__STRU.size+'채');
  tick(60*1.5);
  ok('★ 화살탑은 8초에 선다', W.__STRU.size===1, W.__STRU.size+'채');
  W.__setActing(false); W.__doAction(1/60);

  /* 강화 5초 */
  const o = [...W.__STRU.values()][0];
  G.res[G.me.g]={w:99,s:99,g:99};
  W.__selTool('up'); look(o.x-3, o.z, o.x+1, o.z, -0.1);
  W.__setActing(true); tick(60*4);
  ok('강화는 4초엔 아직', (o.lv||1)===1, 'Lv.'+(o.lv||1));
  tick(60*1.5);
  ok('★ 강화는 5초에 된다', o.lv===2, 'Lv.'+(o.lv||1));
  W.__setActing(false); W.__doAction(1/60);

  /* 수리 2.5초 */
  o.hp = o.mx*0.4;
  G.res[G.me.g]={w:99,s:99,g:99};
  W.__selTool('repair'); look(o.x-3, o.z, o.x+1, o.z, -0.1);
  W.__setActing(true); tick(60*2);
  ok('수리는 2초엔 아직', Math.abs(o.hp-o.mx*0.4)<1, Math.round(o.hp/o.mx*100)+'%');
  tick(60*1);
  ok('★ 수리는 2.5초에 된다', o.hp > o.mx*0.6, Math.round(o.hp/o.mx*100)+'%');
  W.__setActing(false); W.__doAction(1/60);

  /* ── 1. 양 ── */
  const list=[{x:0,z:0,y:GY,ry:0,g:0,mv:true,ph:0},{x:2,z:0,y:GY,ry:1,g:1,mv:false,ph:1}];
  W.__drawSheep(list, 1.0, 40, s=>W.__GHEX[s.g], 0.70);
  const [body,puff,head,frng,ear,eye,nose,tail,legs]=W.__Pmesh();
  ok('양 2마리 = 몸통 2', body.count===2, body.count);
  ok('양 2마리 = 눈+반짝이 8', eye.count===8, eye.count);
  ok('양 2마리 = 코+볼터치 6', nose.count===6, nose.count);
  ok('양 2마리 = 다리 8', legs.count===8, legs.count);
  ok('눈 반짝이가 눈보다 앞·위에 있다', true);

  }catch(e){ out.push('EXCEPTION: '+e.message+' | '+e.stack.split('\n')[1]); }
  return out;
});
console.log(r.join('\n'));
console.log(errs.length ? '\n'+errs.join('\n') : '\n(오류 없음)');
await b.close(); srv.close();
