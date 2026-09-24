// CPU-only audit of actual zombie attachment matrices. No browser or UI.
import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
const harness=fs.readFileSync(path.join(here,'t54-zombie-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const results=[];'));
const A=new Function('source','THREE','vm',load+'\nreturn A;')(source,THREE,vm);
const checks=[];
const check=(name,pass,detail)=>{checks.push(!!pass);console.log((pass?'PASS ':'FAIL ')+name+' '+JSON.stringify(detail));};
const actor=(k,extra={})=>({k,x:0,y:0,z:0,ry:0,id:2,ph:.3,hp:40,mx:40,mv:false,atkT:0,hurt:0,...extra});
function snapshot(k,extra){A.drawWolves([actor(k,extra)],4,.016);
 return Object.fromEntries(Object.entries(A.meshes).map(([name,mesh])=>[name,Array.from({length:mesh.count},(_,i)=>{const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);return m;})]));}
const cases=[{},
 {atkT:.07,poseAtkT:.10,poseAtkCd:.85},
 {atkT:.85,poseAtkT:.1,poseAtkCd:.85},
 {mv:true,gv:6,lx:0,lz:-.10,gp:1.2,shT:true,poseChase:1,posePreyWas:true},
 {ry:1.2,mv:true,gv:6,lx:-.10,lz:0,gp:2.1,shT:true,poseChase:1,posePreyWas:true}];
const localPosition=(p,name,i)=>new THREE.Vector3().setFromMatrixPosition(p[name][i]).applyMatrix4(p.W_body[0].clone().invert());
function audit(name,k,mesh,indices){const poses=cases.map(c=>snapshot(k,c)),baseline=poses[0];let localDrift=0;
 for(const p of poses.slice(1))for(const i of indices)localDrift=Math.max(localDrift,localPosition(p,mesh,i).distanceTo(localPosition(baseline,mesh,i)));
 check(name,localDrift<1e-5,{localDrift,instances:indices.length,poses:poses.length});}
audit('Torn shirt hem keeps its torso-local mounting point',0,'W_chest',[0]);
audit('Collar keeps its torso-local mounting point',0,'W_ruff',[0]);
audit('Belt keeps its torso-local mounting point',0,'W_belly',[0]);
audit('Hungry zombie ribs move with the leaning torso',8,'W_rib',[2,3,4,5]);
// Armor order: four shin plates, then 11 torso plates, then 6 shoulder plates (66차 ZARM 2차 — 위팔 틀로 옮겼다, 아래에서 따로 잰다), then helmet.
audit('Armored chest, back, skirt and neck pieces share the torso frame',9,'W_plate',Array.from({length:11},(_,i)=>i+4));
audit('Overalls and straps use the same torso frame as the shirt',2,'W_costume',[3,4,5,6]);
audit('Healer back gem stays mounted while its own shape rotates',10,'W_gem',[0]);
// 66차 ZARM — 선생님: "좀비 몸하고 팔이 분리돼 있어, 자연스럽게 이어 줘".
// 13종 × 여러 자세(서기·걷기·발견 노려봄·쫓아 뻗기/기기·네 발·공격 준비(팔 번쩍)·덮침·기어오름·경련·쓰러짐·누움)에서
// ① 위팔(소매) 윗끝이 몸통 **안**(실제 몸통 기하 단면 속 — 틈 0) ② 아래팔 축이 위팔 축과 팔꿈치에서 만나고(축 사이 거리) 아래팔 윗끝이 소매 속
// ③ 아래팔 아랫끝이 손바닥 속(손목) 인지 실제 행렬로 잰다.
{const tg=A.ZGEO.torso.attributes.position,seg=16,rows=[];
 for(let r=0;(r+1)*seg<=tg.count-2;r++){let w=0,f=0,b=0,y=0;for(let i=0;i<seg;i++){const j=r*seg+i;w=Math.max(w,Math.abs(tg.getX(j)));f=Math.max(f,tg.getZ(j));b=Math.max(b,-tg.getZ(j));y+=tg.getY(j)/seg;}rows.push([y,w,f,b]);}
 const depth=v=>{if(v.y<rows[0][0]||v.y>rows[rows.length-1][0])return -1;let k=0;while(k<rows.length-2&&rows[k+1][0]<v.y)k++;
  const a=rows[k],b=rows[k+1],q=(v.y-a[0])/((b[0]-a[0])||1),w=a[1]+(b[1]-a[1])*q,fz=v.z>=0?a[2]+(b[2]-a[2])*q:a[3]+(b[3]-a[3])*q,pw=v.z>=0?.62:.86;
  return 1-Math.pow(Math.pow(Math.abs(v.x)/w,2/pw)+Math.pow(Math.abs(v.z)/fz,2/pw),pw/2);};
 const M=(n,i)=>{const m=new THREE.Matrix4();A.meshes[n].getMatrixAt(i,m);return m;},P=(m,y)=>new THREE.Vector3(0,y,0).applyMatrix4(m);
 const run=(w,n,mv)=>{let t=4;for(let i=0;i<n;i++){t+=1/60;if(mv)w.z+=mv/60;A.drawWolves([w],t,1/60);}};
 const poses={
  서기:k=>run(actor(k),20),
  걷기:k=>run(actor(k,{mv:true,id:5}),70,A.WOLF_T[k].spd),
  노려봄:k=>{const w=actor(k,{mv:true,id:5});run(w,40,A.WOLF_T[k].spd);w.shT=true;run(w,9,4.6);},
  쫓기뻗기:k=>run(actor(k,{mv:true,id:5,shT:true}),70,Math.max(A.WOLF_T[k].spd*1.3,4.6)),
  공격준비:k=>A.drawWolves([actor(k,{atkT:.07,poseAtkT:.10,poseAtkCd:.85})],4,.016),
  덮침:k=>A.drawWolves([actor(k,{atkT:.85,poseAtkT:.1,poseAtkCd:.85})],4,.016),
  기어오름:k=>run(actor(k,{rise:A.ZOMBIE_RISE_T}),12),
  경련:k=>{const w=actor(k,{id:1,ph:.1});run(w,100);},
  쓰러짐:k=>run(actor(k,{dead:.30}),1),
  누움:k=>{A.WOLF_DEAD.length=0;const w=actor(k,{id:7});run(w,10);w.dead=.55;w.mv=false;A.WOLF_DEAD.push(w);let t=5;for(let i=0;i<48;i++){t+=1/60;A.drawWolves([],t,1/60);}A.WOLF_DEAD.length=0;}};
 const axisGap=(a0,a1,b0,b1)=>{const u=a1.clone().sub(a0),v=b1.clone().sub(b0),n=u.clone().cross(v);if(n.length()<1e-9)return 0;return Math.abs(b0.clone().sub(a0).dot(n.normalize()));};
 let shoulder=Infinity,elbowAxis=0,elbowIn=true,wristIn=true,worst=null;
 for(let k=0;k<13;k++)for(const [pn,f] of Object.entries(poses)){f(k);const inv=M('W_body',0).clone().invert();
  for(let a=0;a<2;a++){const sl=M('W_sleeve',a),fa=M('W_legs',a),pw=M('W_paw',a);
   const d=depth(P(sl,.5).applyMatrix4(inv));if(d<shoulder){shoulder=d;worst=k+':'+pn;}
   elbowAxis=Math.max(elbowAxis,axisGap(P(sl,.5),P(sl,-.5),P(fa,.5),P(fa,-.5))/A.WOLF_T[k].sc);
   const e=P(fa,.5).applyMatrix4(sl.clone().invert());elbowIn&&=Math.hypot(e.x,e.z)<.30&&Math.abs(e.y)<.5;
   const r=P(fa,-.5).applyMatrix4(pw.clone().invert());wristIn&&=Math.abs(r.x)<.5&&Math.abs(r.y)<.5&&Math.abs(r.z)<.5;}}
 check('Upper-arm sleeves start inside the torso (no gap at the shoulder) for all 13 kinds in every pose',shoulder>0.02,{minDepth:+shoulder.toFixed(3),at:worst,poses:Object.keys(poses).length});
 check('Elbows and wrists stay joined: forearm meets the upper-arm axis, its ends sit inside the sleeve and the palm',elbowAxis<1e-3&&elbowIn&&wristIn,{elbowAxisGap:+elbowAxis.toFixed(5),elbowIn,wristIn});
 // 66차 ZARM 심사 — 어깨를 안으로 들이자 **내린 팔**이 허벅지 속을 지나갔다(서기 0.58·걷기 0.97, 고치기 전 0).
 // 13종 × 서기·걷기·쫓기에서 아래팔·손바닥 꼭짓점을 허벅지(W_legs 2·3) 국소 좌표로 옮겨 허벅지 단면 속 깊이(반지름 대비)를 잰다.
 {const lg=A.ZGEO.limb.attributes.position,pg=A.ZGEO.palm.attributes.position,sg=12,lr=[];
  for(let r=0;(r+1)*sg<=lg.count-2;r++){let w=0,y=0;for(let i=0;i<sg;i++){const j=r*sg+i;w=Math.max(w,Math.abs(lg.getX(j)),Math.abs(lg.getZ(j)));y+=lg.getY(j)/sg;}lr.push([y,w]);}
  const inThigh=v=>{if(v.y<lr[0][0]||v.y>lr[lr.length-1][0])return 0;let k=0;while(k<lr.length-2&&lr[k+1][0]<v.y)k++;const a=lr[k],b=lr[k+1],q=(v.y-a[0])/((b[0]-a[0])||1),w=a[1]+(b[1]-a[1])*q*.95;return Math.max(0,1-Math.hypot(v.x,v.z)/w);};
  const tp={서기:k=>{const w=actor(k);return [w,0];},걷기:k=>[actor(k,{mv:true,id:5}),A.WOLF_T[k].spd],쫓기:k=>[actor(k,{mv:true,id:5,shT:true}),Math.max(A.WOLF_T[k].spd*1.3,4.6)]};
  let deep=0,at=null;const v=new THREE.Vector3();
  for(let k=0;k<13;k++)for(const [pn,f] of Object.entries(tp)){const [w,mv]=f(k);let t=4;
   for(let fr=0;fr<90;fr++){t+=1/60;if(mv)w.z+=mv/60;A.drawWolves([w],t,1/60);if(fr<30||fr%2)continue;
    for(let l=2;l<4;l++){const inv=M('W_legs',l).clone().invert();
     for(const [mesh,idx,g] of [['W_legs',0,lg],['W_legs',1,lg],['W_paw',0,pg],['W_paw',1,pg]]){const m=M(mesh,idx);
      for(let j=0;j<g.count;j++){const d=inThigh(v.set(g.getX(j),g.getY(j),g.getZ(j)).applyMatrix4(m).applyMatrix4(inv));if(d>deep){deep=d;at=k+':'+pn+':'+mesh+idx;}}}}}}
  check('Hanging and swinging forearms and palms pass beside the thighs, not through them (13 kinds × stand/walk/chase)',deep<0.1,{maxDepth:+deep.toFixed(3),at});}
 // 66차 ZARM 2차 심사 — 보스 견장이 몸통 틀에 박혀 팔이 안으로 들어온 뒤 몸통 밖 허공에 뜬 공이 됐다(불꽃·지옥·눈보라).
 // 이제 위팔(소매) 틀의 자식: ① 모든 자세에서 소매 틀 안 자리·방향이 그대로(팔과 같이 움직인다) ② 소매 윗끝이 견장 속에 들고
 // 견장 안쪽 아래 끝이 몸통 속에 묻힌다(떠 있지 않다) ③ 서기·걷기·쫓기에서 머리(두개골 꼭짓점)를 뚫지 않고 윗면이 눈보다 낮다(귀마개 아님).
 {const ZEP=Function('return '+source.match(/const ZEP = (\{[^}]*\})/)[1])();
  const sk=A.ZGEO.skull.attributes.position,v=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(),c=new THREE.Vector3();
  const pads=k=>{const sc=A.WOLF_T[k].sc,out=[];for(let i=0;i<A.meshes.W_costume.count;i++){M('W_costume',i).decompose(c,q,s);
   if(Math.abs(s.x/sc-ZEP.w)<.003&&Math.abs(s.y/sc-ZEP.h)<.003&&Math.abs(s.z/sc-ZEP.d)<.003)out.push(M('W_costume',i));}return out;};
  let drift=0,count=true,sleeveIn=true,buried=Infinity,skullHit=0,aboveEye=-Infinity,at=null;
  for(let k=0;k<13;k++){if(!(A.WOLF_T[k].boss>0))continue;const sc=A.WOLF_T[k].sc;let base=null;
   for(const [pn,f] of Object.entries(poses)){f(k);const pd=pads(k);if(pd.length!==2){count=false;at=k+':'+pn+':pads='+pd.length;continue;}
    const rel=pd.map((m,a)=>{const sl=M('W_sleeve',a),o=P(sl,.5),sq=new THREE.Quaternion(),ss=new THREE.Vector3();sl.decompose(new THREE.Vector3(),sq,ss);return new THREE.Matrix4().compose(o,sq,new THREE.Vector3(1,1,1)).invert().multiply(m);});if(!base)base=rel;
    for(let a=0;a<2;a++)drift=Math.max(drift,...rel[a].elements.map((e,j)=>Math.abs(e-base[a].elements[j])));
    const inv=M('W_body',0).clone().invert();
    for(let a=0;a<2;a++){const pinv=pd[a].clone().invert(),si=a?-1:1;
     const t=P(M('W_sleeve',a),.5).applyMatrix4(pinv);sleeveIn&&=Math.abs(t.x)<.5&&Math.abs(t.y)<.5&&Math.abs(t.z)<.5;
     // 견장 안쪽(몸통 쪽) 아래 모서리 — 견장 국소 x 는 +si 가 바깥
     const d=depth(new THREE.Vector3(-si*.42,-.30,0).applyMatrix4(pd[a]).applyMatrix4(inv));if(d<buried){buried=d;at=k+':'+pn;}}
    if(pn==='서기'||pn==='걷기'||pn==='쫓기뻗기'){const hm=M('W_head',0),ey=new THREE.Vector3().setFromMatrixPosition(M('W_eyes',0)).y;
     for(let a=0;a<2;a++){const pinv=pd[a].clone().invert();
      for(let j=0;j<sk.count;j++){v.fromBufferAttribute(sk,j).applyMatrix4(hm).applyMatrix4(pinv);if(Math.abs(v.x)<.45&&Math.abs(v.y)<.45&&Math.abs(v.z)<.45)skullHit++;}
      if(pn!=='쫓기뻗기'){const cy=new THREE.Vector3().setFromMatrixPosition(pd[a]).y;aboveEye=Math.max(aboveEye,(cy-ey)/sc);}}}}}
  check('Boss shoulder pads are children of the upper arm: same sleeve-local transform in every pose (5 bosses × 10 poses)',count&&drift<1e-5,{maxLocalDrift:+drift.toExponential(2),at:count?null:at});
  check('Boss shoulder pads cover the sleeve top and their inner lower edge sinks into the torso (not floating)',sleeveIn&&buried>0.02,{sleeveTopInsidePad:sleeveIn,minTorsoDepth:+buried.toFixed(3),at});
  check('Boss shoulder pads clear the skull (stand/walk/chase) and sit below eye level with arms down (not ear-muffs)',skullHit===0&&aboveEye<-.03,{skullVerticesInsidePad:skullHit,padCenterMinusEyeY:+aboveEye.toFixed(3)});}
 // 66차 ZARM 2차 심사 — 갑옷 어깨판이 몸통 틀에 박혀 팔을 번쩍 들면 위팔이 가슴판 뒤로 숨고 소매 끝 고리만 남았다.
 // 이제 위팔 틀(ZAF)에 얹혀 모든 자세에서 어깨 관절과 소매 윗끝이 무쇠 테(어깨판 첫 조각) 속에 든다 — 팔이 늘 판 밑에서 나온다.
 {let inside=true,worst=-Infinity,at=null;
  for(const [pn,f] of Object.entries(poses)){f(9);const sc=A.WOLF_T[9].sc;
   for(let a=0;a<2;a++){const plate=M('W_plate',15+a*3),pinv=plate.clone().invert(),sl=M('W_sleeve',a);
    for(const y of [.5,.35]){const t=P(sl,y).applyMatrix4(pinv),m=Math.max(Math.abs(t.x),Math.abs(t.y),Math.abs(t.z));if(m>worst){worst=m;at=pn+':'+a+':'+y;}inside&&=m<.5;}}}
  check('Armored pauldrons ride the upper arm: shoulder joint and sleeve top stay inside the pauldron rim in all 10 poses',inside,{maxNormalized:+worst.toFixed(3),at});}
 // 66차 ZARM 2차 심사 — 붕대 팔찌가 팔뚝보다 30% 굵은 헐거운 흰 통이라 가는 팔이 그 속에 떠 보였다.
 // 붕대 띠 안쪽 면이 아래팔 겉면에서 반지름 +15% 안에 붙어 있고(떠 있지 않고), 팔뚝을 뚫지 않는다(−5% 까지) — 서기·걷기·쫓기·공격 준비.
 {const rags=A.ZOMBIE_NIGHT.indexOf('rags'),lg=A.ZGEO.limb.attributes.position,wg=A.meshes.W_wrap.geometry.attributes.position,sg=12,lr=[];
  for(let r=0;(r+1)*sg<=lg.count-2;r++){let w=0,y=0;for(let i=0;i<sg;i++){const j=r*sg+i;w=Math.max(w,Math.hypot(lg.getX(j),lg.getZ(j)));y+=lg.getY(j)/sg;}lr.push([y,w]);}
  const rad=y=>{let k=0;while(k<lr.length-2&&lr[k+1][0]<y)k++;const a=lr[k],b=lr[k+1];return a[1]+(b[1]-a[1])*(y-a[0])/((b[0]-a[0])||1);};
  let lo=Infinity,hi=0,n=0;A.G.nk=rags;const vv=new THREE.Vector3();
  for(const pn of ['서기','걷기','쫓기뻗기','공격준비']){poses[pn](0);const wi=A.meshes.W_wrap.count-1,wm=M('W_wrap',wi),inv=M('W_legs',0).clone().invert();
   for(let j=0;j<wg.count;j++){vv.fromBufferAttribute(wg,j);if(Math.hypot(vv.x,vv.z)>.47)continue;   // 안쪽 면 꼭짓점만
    vv.applyMatrix4(wm).applyMatrix4(inv);const r=Math.hypot(vv.x,vv.z)/rad(vv.y);lo=Math.min(lo,r);hi=Math.max(hi,r);n++;}}
  A.G.nk=0;
  check('Bandage bracelet hugs the forearm: inner face within +15% of the forearm surface and not cutting into it',n>0&&lo>.95&&hi<1.15,{innerVertices:n,minRatio:+lo.toFixed(3),maxRatio:+hi.toFixed(3)});}
}
console.log(`${checks.filter(Boolean).length}/${checks.length} zombie attachment checks passed.`);
process.exitCode=checks.every(Boolean)?0:1;
