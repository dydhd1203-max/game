/* 27차 검사 — 로블록스 룩 캐릭터: 둥근 조각 · 무늬 없는 원색 · 화면에 모둠 색이 닿나
   ★ 26차 교실 실측이 "GPU 는 픽셀 쪽" 이라 텍스처를 읽지 않는 원색 재질로 바꿨고,
     선생님이 고른 로블록스 룩(매끈한 면·원색·둥근 모서리)의 1단계가 캐릭터다.
   ★ '켜졌나'(재질에 map 이 없나, 조각이 둥근가)로 끝내지 않는다. 25차에 그림자가 켜져 있었는데
     화면엔 없던 적이 있다. 그래서 사람 한 마리를 카메라 앞에 세우고 **화면 픽셀에서 모둠 색이 나오나** 본다.
   ★ 검사기(소프트웨어 렌더링)는 '예쁜가' 를 못 잰다. 그건 교실이 답한다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const FILE = process.argv[2] || GAME;
const PORT = +(process.argv[3] || 9290);
const srv = serve(PORT, FILE);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[], R=[];
const ok=(n,c,v)=>R.push([n,!!c,v===undefined?'':String(v)]);
const frames = (pg,n)=> pg.evaluate(n=> new Promise(res=>{
  let i=0; const stop=setTimeout(res, 20000);
  const t=()=>{ if(++i>=n){ clearTimeout(stop); return res(); } requestAnimationFrame(t); };
  requestAnimationFrame(t); }), n);

const pg = await b.newPage({viewport:{width:900,height:520}});
pg.on('pageerror', e=>errs.push(e.message));
await pg.goto('http://127.0.0.1:'+PORT+'/?gfx=high', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', null, {timeout:60000});

/* ═══════ ① 시작 화면 미리보기 — 게임과 같은 조각·재질이어야 한다 ═══════ */
{
  const r = await pg.evaluate(()=>{
    const P = window.__pvw(); if(!P) return null;
    const all = P.body.concat(P.deco);
    return {n:P.body.length, noMap: all.every(m=>!m.material.map),
            round: P.body.filter(m=>m.visible).every(m=>m.geometry.attributes.position.count > 24)};
  });
  ok('미리보기가 있다', !!r);
  ok('★ 미리보기 조각에 무늬(텍스처)가 없다', r && r.noMap);
  ok('★ 미리보기 조각이 둥글다 (꼭짓점이 상자 24개보다 많다)', r && r.round);
  ok('★ 미리보기 몸 조각 열세 개 — 몸통·머리·얼굴·위팔 둘·손목 둘·C자 손 둘·다리 둘',
     r && r.n === 13, r && r.n);
}

await pg.fill('#iName','검'); await pg.click('#bSolo');
await frames(pg, 8);
await pg.evaluate(()=>{ window.__introDone(); });
await frames(pg, 3);

/* ═══════ ② 조각과 재질 ═══════ */
{
  const r = await pg.evaluate(()=>{
    const G = window.__charMeshes(), out = {};
    for(const [nm, ms] of Object.entries(G)){
      const o = {noMap:true, round:true, icol:true, n:ms.length};
      for(const m of ms){
        if(m.material.map) o.noMap = false;
        if(!m.instanceColor) o.icol = false;
        const P = m.geometry.attributes.position, N = m.geometry.attributes.normal;
        if(!P || P.count <= 24) o.round = false;
        /* 둥글다 = 축에 안 붙은 법선이 있다 (상자는 법선이 전부 ±1 한 축이다) */
        let diag = false;
        for(let i=0;i<N.count;i++){ const x=Math.abs(N.getX(i)), y=Math.abs(N.getY(i)), z=Math.abs(N.getZ(i));
          if(Math.max(x,y,z) < 0.98){ diag = true; break; } }
        if(!diag) o.round = false;
      }
      out[nm] = o;
    }
    return out;
  });
  for(const nm of ['사람','좀비','농장','병사','상인']){
    const o = r[nm];
    ok(`${nm} 조각 ${o.n}벌 — 무늬(텍스처)가 없다`, o.noMap);
    ok(`${nm} 조각 — 둥글다 (꼭짓점 > 24 · 축에 안 붙은 법선)`, o.round);
  }
  ok('★ 다섯 무리 모두 인스턴스 색이 있다 (색은 조립 코드가 넘긴다 — 없으면 전부 흰 인형)',
     Object.values(r).every(o=>o.icol));
}

/* ═══════ ③ R6 팔·다리 + 화면에 모둠 색(셔츠)이 닿나 ═══════ */
{
  const r = await pg.evaluate(()=>{
    const W=window, T=W.__THREE, GY=W.__GY, cam=W.__cam, o={};
    const list=[{x:0,z:14,y:GY,ry:Math.PI,g:0,mv:false,ph:0},{x:2,z:14,y:GY,ry:Math.PI,g:1,mv:false,ph:1}];
    W.__drawSheep(list, 1.0, 40, s=>W.__GHEX[s.g], 0.70);
    const [body, head, arm, eye, nose, legs] = W.__Pmesh();
    o.사람 = body.count; o.팔 = arm.count; o.다리 = legs.count;
    /* 카메라를 사람 앞에 세우고 바로 그린다 — 다음 프레임엔 updPlayer 가 카메라를 되돌린다.
       ★ 49차e — **게임 고리를 세우고 두 번 그린다.** 44차 모션(smoothHead)은 앞 프레임 방향에서
         이어 도는 값이라 첫 그림은 사람이 아직 덜 돌아 있을 수 있고, 기계가 바쁘면 그 사이 게임이
         저 혼자 한 프레임을 더 돌아 사람을 제자리로 되돌려 놓는다. 그러면 몸통 대신 **풀밭**을 읽는다
         (전체 판에서 네 번에 한 번 빨개졌다 — 105,152,82 는 잔디색이다). */
    const wasPaused = W.__G.paused; W.__G.paused = true;
    cam.position.set(0, GY+0.9, 14+2.4); cam.lookAt(0, GY+0.5, 14); cam.updateMatrixWorld(true);
    W.__drawSheep(list, 1.0, 40, s=>W.__GHEX[s.g], 0.70);
    W.__drawFrame();
    cam.position.set(0, GY+0.9, 14+2.4); cam.lookAt(0, GY+0.5, 14); cam.updateMatrixWorld(true);
    W.__drawSheep(list, 1.0, 40, s=>W.__GHEX[s.g], 0.70);
    W.__drawFrame();
    W.__G.paused = wasPaused;
    const dm=W.__R.domElement, CW=dm.width, CH=dm.height;
    const cv=document.createElement('canvas'); cv.width=CW; cv.height=CH;
    const cx=cv.getContext('2d',{willReadFrequently:true}); cx.drawImage(dm,0,0);
    /* 51차 — 셔츠(몸통) 앞면 한가운데. R6 몸통은 앞뒤 0.48 이라 앞면이 f 0.24·0.7 = 0.17,
       높이는 몸통 가운데(u 0.76·0.7). 46차 사람은 (0.33, 0.28) 이었다 — 네발 몸통이 두 배 두꺼웠다. */
    const p = new T.Vector3(0, GY+0.76*0.7, 14+0.17).project(cam);
    const px = Math.round((p.x+1)/2*CW), py = Math.round((1-p.y)/2*CH);
    const S=5, d=cx.getImageData(px-S, py-S, S*2+1, S*2+1).data;
    const rs=[],gs=[],bs=[]; let nd=0, cnt=0;
    for(let i=0;i<d.length;i+=4){ rs.push(d[i]); gs.push(d[i+1]); bs.push(d[i+2]); }
    const med = a=>{ a=a.slice().sort((x,y)=>x-y); return a[a.length>>1]; };
    const rr=med(rs), gg=med(gs), bb=med(bs);
    const mx=Math.max(rr,gg,bb), mn=Math.min(rr,gg,bb);
    o.색 = [rr,gg,bb]; o.채도 = mx ? (mx-mn)/mx : 0;
    const hue = (r,g,b)=>{ const M=Math.max(r,g,b), m=Math.min(r,g,b), c=M-m; if(!c) return 0;
      let h = M===r ? ((g-b)/c)%6 : M===g ? (b-r)/c+2 : (r-g)/c+4; return ((h*60)+360)%360; };
    const want = new T.Color(W.__GHEX[0]);
    o.원하는색 = [Math.round(want.r*255), Math.round(want.g*255), Math.round(want.b*255)];
    let dh = Math.abs(hue(rr,gg,bb) - hue(o.원하는색[0],o.원하는색[1],o.원하는색[2])); if(dh>180) dh=360-dh;
    o.색상차 = dh;
    /* 매끈한가 — 창 안의 이웃 픽셀 차 평균 (텍스처 텍셀이면 경계마다 튄다) */
    const Wd=S*2+1; for(let y=0;y<Wd;y++) for(let x=1;x<Wd;x++){ const i=(y*Wd+x)*4, j=i-4;
      nd += Math.abs(d[i]-d[j])+Math.abs(d[i+1]-d[j+1])+Math.abs(d[i+2]-d[j+2]); cnt++; }
    o.이웃차 = nd/cnt/3;
    o.삼각형 = W.__R.info.render.triangles;
    return o;
  });
  ok('사람 2명 = 몸통 2', r.사람 === 2, r.사람);
  ok('★ 사람 2명 = 위팔·손목 8 · 다리 4 (C자 손은 별도 곡면 메시)',
     r.팔 === 8 && r.다리 === 4, '팔 '+r.팔+' 다리 '+r.다리);
  ok('★ 화면의 셔츠(몸통)가 모둠 색이다 (색상 30° 안, 채도 0.2 이상)', r.색상차 < 30 && r.채도 > 0.2,
     `화면 ${r.색}, 모둠 ${r.원하는색}, 색상차 ${r.색상차.toFixed(0)}°, 채도 ${r.채도.toFixed(2)}`);
  ok('★ 몸통 면이 매끈하다 (이웃 픽셀 차 < 6)', r.이웃차 < 6, r.이웃차.toFixed(2));
  ok('삼각형이 예산 안이다 (< 200만)', r.삼각형 < 2000000, r.삼각형);
}
/* 손의 빈 공간과 실제 작업/사격 자세를 잰다. 조각 수만 맞아도 손이 막히거나 가만히 있을 수 있다. */
{
  const r=await pg.evaluate(()=>{
    const W=window,T=W.__THREE,G=W.__G, oldStarted=G.started,oldAim=W.__aimMode(),oldWp=W.__KIT.wpn;
    G.started=false;
    const hands=W.__handMeshes(), m=new T.Matrix4(), p=new T.Vector3(), q=new T.Quaternion(), sc=new T.Vector3();
    const probe=(geo,x,y)=>{const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));
      mesh.updateMatrixWorld(); const ray=new T.Raycaster(new T.Vector3(x,y,2),new T.Vector3(0,0,-1));
      const hit=ray.intersectObject(mesh).length>0; mesh.material.dispose(); return hit; };
    const holes=hands.every(h=>!probe(h.geometry,0,0));
    const mouths=!probe(hands[0].geometry,-0.43,0)&&!probe(hands[1].geometry,0.43,0);
    const palms=probe(hands[0].geometry,0.40,0)&&probe(hands[1].geometry,-0.40,0);
    const f={x:0,y:3,z:0,ry:Math.PI,g:0,ph:0,wp:0,mv:false,down:false};
    const pose=()=>{W.__drawSheep([f],4,40,()=>0x55aaff,1);
      hands[0].getMatrixAt(0,m);m.decompose(p,q,sc);const hp=p.clone(),hq=q.clone();
      W.__Pmesh()[2].getMatrixAt(1,m);m.decompose(p,q,sc);const aligned=1-Math.abs(q.dot(hq))<0.00001;
      const gap=hp.distanceTo(p);W.__Pmesh()[0].getMatrixAt(0,m);const body=Array.from(m.elements);
      const gun=W.__gunMeshes()[0];gun.getMatrixAt(0,m);const tool=new T.Vector3().setFromMatrixPosition(m);
      return {hp:hp.toArray(),gap,aligned,body,tool:tool.toArray(),n:gun.count}; };
    f.air=true;f.vy=-3;const fall=pose();f.vy=4;const rise=pose();f.air=false;
    W.__setAim(false,true);W.__updHeld(0.016,true,0.28);
    Object.assign(f,{act:W.__meSheep().act,actP:W.__meSheep().actP,tool:'mine'}); const ready=pose();
    W.__updHeld(0.016,true,0.64);f.actP=W.__meSheep().actP;const hit=pose();
    W.__KIT.wpn=1;W.__setAim(true,true);W.__updHeld(0.016,false,0);
    f.act='';f.tool='';f.wp=W.__meSheep().wp;f.kick=0;const hold=pose();
    W.__gunRecoil(1);W.__updHeld(0.016,false,0);f.kick=W.__meSheep().kick;const fire=pose();
    const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
    W.__KIT.wpn=oldWp;W.__setAim(oldAim,true);G.started=oldStarted;
    return {holes,mouths,palms,fall,rise,ready,hit,hold,fire,
      handMove:distance(ready.hp,hit.hp),toolMove:distance(ready.tool,hit.tool),
      bodyMove:distance(ready.body,hit.body),kickMove:distance(hold.hp,fire.hp),wp:f.wp};
  });
  ok('★ C자 손 한가운데가 실제로 뚫려 있다 (중앙 광선이 통과)',r.holes);
  ok('★ C자 입은 양손 모두 몸 쪽으로 열리고 반대편 손바닥은 이어져 있다',r.mouths&&r.palms);
  ok('★ 낙하·만세에서 C자 손과 손목 회전이 일치하고 붙어 있다',
    r.fall.aligned&&r.rise.aligned&&r.fall.gap<0.13&&r.rise.gap<0.13,JSON.stringify([r.fall.gap,r.rise.gap]));
  ok('★ 실제 채집 진행률에 따라 손과 도구가 0.5칸 이상 휘둘러진다',
    r.handMove>0.5&&r.toolMove>0.5&&r.ready.n===3,`${r.handMove} / ${r.toolMove}`);
  ok('★ 채집 때 팔뿐 아니라 몸통도 힘을 싣는다',r.bodyMove>0.10,r.bodyMove);
  ok('★ 내 3인칭 무기가 연결되고 발사 반동이 손·어깨로 전달된다',r.wp===1&&r.fire.n===3&&r.kickMove>0.05,r.kickMove);
}
/* 실제 발사 → 즉시 작업 / 탄약 없는 돌 투척: 이전 장비 표시가 동작을 덮지 않아야 한다. */
await pg.evaluate(()=>{
  const W=window;W.__G.started=true;W.__G.paused=false;W.__G.phase='day';W.__PL.down=false;
  W.__setActing(false);W.__setThrow(false);
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
});
await pg.waitForFunction(()=>window.__throwCd()<=0);
const workAfterShot=await pg.evaluate(()=>{
  const W=window;W.__KIT.wpn=3;W.__KIT.ammo=20;W.__setAim(true,true);W.__fireWeapon();
  W.__setAim(false,true);W.__selTool('mine');W.__updHeld(0.016,true,0.4);
  const s=W.__meSheep();return {wp:s.wp,tool:s.tool,act:s.act,kick:s.kick};
});
ok('★ 발사 직후 채집하면 총 대신 작업 도구를 휘두른다',
  workAfterShot.wp===0&&workAfterShot.tool==='mine'&&workAfterShot.act==='mine'&&workAfterShot.kick===0,JSON.stringify(workAfterShot));
await pg.waitForFunction(()=>window.__throwCd()<=0);
const emptyAmmo=await pg.evaluate(()=>{
  const W=window;W.__KIT.wpn=3;W.__KIT.ammo=0;W.__setAim(true,true);W.__fireWeapon();W.__updHeld(0.016,false,0);
  const s=W.__meSheep();return {wp:s.wp,tool:s.tool,act:s.act};
});
ok('★ 탄약이 없어 돌을 던질 때 총·곡괭이가 손에 남지 않는다',
  emptyAmmo.wp===0&&emptyAmmo.tool===''&&emptyAmmo.act==='throw',JSON.stringify(emptyAmmo));
await pg.close();

console.log('');
let bad=0;
for(const [n,c,v] of R){ if(!c) bad++; console.log((c?'  OK  ':'FAIL  ')+n+(v?'   → '+v:'')); }
console.log('');
console.log(errs.length ? ('오류: '+errs.slice(0,5).join(' | ')) : '(오류 없음)');
console.log(bad ? (bad+'개 실패 / '+R.length+'항목') : (R.length+'항목 전부 통과'));
await b.close(); srv.close();
