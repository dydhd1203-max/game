// 84차 실제 브라우저 검사 — 먼 좀비 조각을 성긴 짝 모양으로(LOD).
// ① 짝마다 원래 모양과의 실제 하우스도르프 거리(단위 상자 · 두 방향)를 다시 재서 ZLOD_ERR 이하인지 — 오차 표가 모양보다 작으면 문턱이 거짓이 된다.
//    짝은 삼각형이 적고, 상처 셰이더가 읽는 zwk 를 같은 값으로 갖고, 같은 재질·같은 정원이다.
// ② 검사·도입 배우처럼 cull 없이 부르면 짝은 0(예전 그대로) · 본 루프(cull)로 부르면 원래+짝 = 예전 조각 수(하나도 잃지 않음).
// ③ 짝으로 간 조각은 모두 '실측 오차 × 그 자리 화면 배율 ≤ 0.5px' · 가까운 좀비의 머리·몸통은 원래 모양(눈·갈비 같은 작은 조각은 가까워도 0.5px 안이면 짝).
// ④ 진단 줄: 좀비 안 그림(전부 0) · 단순화 끔(짝 0) · 1px(짝이 더 많다).
import assert from 'node:assert/strict';import path from 'node:path';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),PORT=+(process.env.T84_ZLOD_PORT||20684);
const server=serve(PORT,file),errors=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const now=performance.now.bind(performance);let time=null;
  window.__freeze84=()=>{time=100000;};window.__advance84=ms=>{time+=ms;window.__loop73();};
  performance.now=()=>time===null?now():time;const raf=requestAnimationFrame.bind(window);requestAnimationFrame=f=>time===null?raf(f):0;
  localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','t84-zlod');});
 await page.goto(`http://127.0.0.1:${PORT}/?gfx=mid&diag=1`,{waitUntil:'load',timeout:400000});
 await page.waitForFunction(()=>window.__READY,null,{timeout:400000,polling:500});
 const res=await page.evaluate(()=>{const W=window,G=W.__G,P=W.__PL,GY=W.__GY,D=W.__DIRS[0],DBG=W.__DBG(),PAIRS=W.__ZLOD_PAIRS,ERR=W.__ZLOD_ERR;
  document.getElementById('iName').value='좀비 단순화';document.getElementById('bSolo').click();W.__introDone();
  document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freeze84();
  // ① 모양
  const tris=g=>{const p=g.attributes.position.array,ix=g.index.array,t=[];for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;t.push([p[a],p[a+1],p[a+2],p[b],p[b+1],p[b+2],p[c],p[c+1],p[c+2]]);}return t;};
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=v=>Math.hypot(v[0],v[1],v[2]);
  const ptTri=(p,t)=>{const a=[t[0],t[1],t[2]],b=[t[3],t[4],t[5]],c=[t[6],t[7],t[8]],ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return len(ap);
   const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return len(bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return len(sub(p,[a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v]));}
   const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return len(cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return len(sub(p,[a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w]));}
   const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)),bc=sub(c,b);return len(sub(p,[b[0]+bc[0]*w,b[1]+bc[1]*w,b[2]+bc[2]*w]));}
   const den=1/(va+vb+vc),v=vb*den,w=vc*den;return len(sub(p,[a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w]));};
  const one=(gA,gB)=>{const tb=tris(gB),pts=[],pa=gA.attributes.position.array;for(let i=0;i<pa.length;i+=3)pts.push([pa[i],pa[i+1],pa[i+2]]);
   for(const t of tris(gA)){pts.push([(t[0]+t[3]+t[6])/3,(t[1]+t[4]+t[7])/3,(t[2]+t[5]+t[8])/3]);pts.push([(t[0]+t[3])/2,(t[1]+t[4])/2,(t[2]+t[5])/2]);}
   let m=0;for(const p of pts){let d=1e9;for(const t of tb){const x=ptTri(p,t);if(x<d)d=x;}if(d>m)m=d;}return m;};
  const shapes=PAIRS.map(([m,t,e])=>{const zw=(g,i)=>g.attributes.zwk.array[i];
   return {hiTri:m.geometry.index.count/3,loTri:t.geometry.index.count/3,H:Math.max(one(m.geometry,t.geometry),one(t.geometry,m.geometry)),e,
    zwk:!!t.geometry.attributes.zwk===!!m.geometry.attributes.zwk&&(!m.geometry.attributes.zwk||zw(t.geometry,0)===zw(m.geometry,0)),sameMat:t.material===m.material,cap:t.count_max===m.count_max,color:!!t.instanceColor===!!m.instanceColor};});
  // 장면: 밤, 성문 0 바깥을 보는 아이, 좀비 6~60 거리
  G.phase='night';G.day=3;G.t=9999;G.host=true;G.paused=false;G.wolves.length=0;W.__setSky(1);W.__updSky(0,true);
  Object.assign(P,{x:D.dx*10,y:GY,z:D.dz*10,yaw:Math.atan2(-D.dx,-D.dz),pitch:-.08,vx:0,vy:0,vz:0,ground:true});W.__camZoom(0);
  const dists=[2,6,9,13,18,24,30,38,46,55,60,22,27,34,42,50];
  dists.forEach((r,i)=>W.__spawnWolf(i%3,0,D.dx*(10+r)+(-D.dz)*((i%5)-2)*1.5,D.dz*(10+r)+D.dx*((i%5)-2)*1.5));
  for(const w of G.wolves)w.rise=0;
  for(let f=0;f<20;f++)W.__advance84(1000/60);
  const H=PAIRS.map((p,i)=>shapes[i].H);
  const snap=()=>PAIRS.map(([m,t])=>[m.count,t.count]);
  // ② cull 없이(검사·배우 경로)
  W.__drawWolves(G.wolves,200,0);const plain=snap();
  // 본 루프 경로
  W.__drawWolves(G.wolves,200,0,true);const lod=snap();
  // ③ 짝 조각의 화면 오차 · 가까운 좀비
  const cam=W.__cam;cam.updateMatrixWorld();const e=cam.matrixWorld.elements,R=W.__R,K=R.domElement.height/(2*Math.tan(cam.fov*Math.PI/360))*(cam.zoom||1);
  let worstLo=0,nearLo=0;const near=G.wolves.filter(w=>Math.hypot(w.x-e[12],w.z-e[14])<6.5);   // 카메라에서 6.5 안
  PAIRS.forEach(([m,t,,all],pi)=>{const A=t.instanceMatrix.array;for(let i=0;i<t.count;i++){const o=i*16,sx=Math.hypot(A[o],A[o+1],A[o+2]),sy=Math.hypot(A[o+4],A[o+5],A[o+6]),sz=Math.hypot(A[o+8],A[o+9],A[o+10]);
    const dep=(A[o+12]-e[12])*-e[8]+(A[o+13]-e[13])*-e[9]+(A[o+14]-e[14])*-e[10]-.5*Math.max(sx,sy,sz),px=H[pi]*(all?Math.max(sx,sy,sz):Math.max(sx,sz))*K/Math.max(dep,1e-6);
    worstLo=Math.max(worstLo,px);if(pi<2)for(const w of near)if(Math.hypot(A[o+12]-w.x,A[o+14]-w.z)<1.2)nearLo++;}});   // 머리·몸통
  // ④ 진단 줄
  DBG.noZombie=true;W.__drawWolves(G.wolves,200,0,true);const hidden=W.__ZLOD_ALL.every(m=>m.count===0)&&PAIRS.every(([,t])=>t.count===0);DBG.noZombie=false;
  DBG.zlodOff=true;W.__drawWolves(G.wolves,200,0,true);const off=snap();DBG.zlodOff=false;
  DBG.zlodPx=1;W.__drawWolves(G.wolves,200,0,true);const px1=snap();DBG.zlodPx=0;
  const sum=(s,k)=>s.reduce((a,x)=>a+x[k],0);
  return {shapes,plain,lod,off,px1,worstLo,nearLo,nearN:near.length,hidden,lodLo:sum(lod,1),px1Lo:sum(px1,1),wolves:G.wolves.length,ERR,px:W.__ZLOD.px};});   // 96차 — 문턱(px)을 게임에서 읽는다(0.5 → 1)
 const bad=res.shapes.map((s,i)=>({i,...s})).filter(s=>!(s.H<=s.e&&s.loTri<s.hiTri&&s.zwk&&s.sameMat&&s.cap&&s.color));
 console.log(JSON.stringify({bad,shapes:res.shapes.map(s=>`${s.hiTri}/${s.loTri} H${s.H.toFixed(3)}≤${s.e}`),wolves:res.wolves,lodLo:res.lodLo,px1Lo:res.px1Lo,worstLo:+res.worstLo.toFixed(3),nearLo:res.nearLo,nearN:res.nearN,errors}));
 assert.deepEqual(errors,[]);
 assert.equal(bad.length,0,'Every coarse twin stays within its measured outline error, has fewer triangles, keeps zwk/material/capacity/colour');
 assert.ok(res.plain.every(([,lo])=>lo===0),'drawWolves without the game-loop cull flag draws no coarse twins (tests and intro actors unchanged)');
 assert.ok(res.lod.every(([hi,lo],i)=>hi+lo===res.plain[i][0]),'Game-loop LOD keeps every zombie piece (original + twin = previous count)');
 assert.ok(res.lodLo>0&&res.worstLo<=res.px+1e-6,'Pieces moved to coarse twins move their outline by at most ZLOD.px ('+res.px+' px, 96차: 1) at their screen depth');
 assert.ok(res.nearN>0&&res.nearLo===0,'Zombies close to the camera keep full-detail head and torso');
 assert.ok(res.hidden,'Diagnostic "좀비 안 그림" hides every zombie piece');
 assert.ok(res.off.every(([,lo],i)=>lo===0&&res.off[i][0]===res.plain[i][0]),'Diagnostic "좀비 단순화 끔" restores the full-detail draw');
 assert.ok(res.px1Lo>res.lodLo,'Diagnostic 1px threshold moves more pieces to twins');
 console.log('PASS: zombie LOD twins within measured error, no lost pieces, near zombies full detail, diagnostics');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
