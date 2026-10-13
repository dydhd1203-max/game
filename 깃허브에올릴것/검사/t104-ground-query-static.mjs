// Execute the actual collision/ground queries against the preserved 103 source.
// No browser, network, graphics settings, or classroom-FPS assertions.
// node t104-ground-query-static.mjs [game.html] [--baseline old.html] [--bench]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {GAME} from './gamefile.mjs';

const args=process.argv.slice(2);let file=GAME,baselineFile,bench=false;
for(let i=0;i<args.length;i++){
 if(args[i]==='--baseline'){assert.ok(args[i+1]&&!args[i+1].startsWith('--'),'--baseline needs a file');baselineFile=args[++i];}
 else if(args[i]==='--bench')bench=true;
 else if(!args[i].startsWith('--'))file=args[i];else throw Error('Unknown option '+args[i]);
}
function extract(source,name){
 const start=source.indexOf('function '+name+'(');assert.ok(start>=0,'Missing function '+name);
 let depth=0,quote='',comment='',escape=false,opened=false;
 for(let i=start;i<source.length;i++){const c=source[i],n=source[i+1];
  if(comment==='line'){if(c==='\n')comment='';continue;}if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
  if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote='';continue;}
  if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
  if(c==='{'){depth++;opened=true;}else if(c==='}'&&--depth===0&&opened)return source.slice(start,i+1);
 }
 throw Error('Unterminated function '+name);
}
// Verbatim solidTop/blockedAt/groundUnder from baseline-103.html (05f3fec).
// This historical source is not a rewritten expected-value implementation.
const REFERENCE_SOURCE = "function solidTop(x,z){\r\n  if(!inW(x,z)) return 999;\r\n  const i = gi(x,z); const t = Math.max(terrH[i], bldH[i]);\r\n  return t < -900 ? 999 : t;\r\n}\nfunction blockedAt(x, z, r){\r\n  for(const [ox,oz] of [[-r,-r],[r,-r],[-r,r],[r,r],[0,0]]){\r\n    const cx = Math.floor(x+ox), cz = Math.floor(z+oz);\r\n    if(solidTop(cx, cz) > GY+1 || (inW(cx, cz) && CASTLE[gi(cx, cz)] >= CK.SOLID)) return true;   // 67차 — 성곽 칸(바닥 GY 인 복도·방·문 포함)은 좀비·병사에게 벽\r\n  }\r\n  return false;\r\n}\nfunction groundUnder(x,z,R,y,mv){\r\n  /* ★ 하늘 섬은 격자에 없다 — 미니게임 동안은 섬 바닥이 곧 땅이다.\r\n     (92차 — 서바이벌 지형(SURV 표)은 뺐다. 경주는 발판 높이만 땅이다.) */\r\n  if(miniOn()){\r\n    if(raceOn() && RACE_P.length){ let m = -999;                       // 37차 — 경주: 발판 높이만 땅이다\r\n      for(const [ox,oz] of [[-R,-R],[R,-R],[-R,R],[R,R],[0,0]]) m = Math.max(m, raceTopAt(x+ox, z+oz));\r\n      return m; }\r\n    return MINI_Y;\r\n  }\r\n  let m = -999;\r\n  for(const [ox,oz] of [[-R,-R],[R,-R],[-R,R],[R,R],[0,0]]){\r\n    const px = x+ox, pz = z+oz, cx = Math.floor(px), cz = Math.floor(pz);\r\n    let h = solidTop(cx, cz);\r\n    if(inW(cx,cz)){ const ii = gi(cx,cz), k = stairOf[ii];\r\n      if(k >= 1000) h = spiralH(k - 1000, px, pz, y === undefined ? SPIRALS[k - 1000].y0 : y);   // 67차 — 나선: 발 높이로 바퀴를 고른다\r\n      else if(k >= 0) h = stairH(k, px, pz);    // 66차 — 성문 계단은 반 칸 디딤의 정확한 높이\r\n      else if(CASTLE[ii] === CK.GALW){          // 70차 2회차 — 회랑 마을 쪽 끝은 칸 톱니가 아니라 참 얼굴(e 49.0): 그 안쪽은 둘레길(GY), 49.0~49.45 는 낮은 턱(윗면 8.32)\r\n        const e = (Math.abs(px) + Math.abs(pz))*CHAM;\r\n        if(e < CW.IN) h = GY;\r\n        else if(e < CW.GAL_CURB_E1){ h = GY + CW.WALK + CW.CURB; if(mv && y !== undefined && PL.ground && y > GY + CW.WALK - 0.05 && y < h - 0.1) h = y + STEP + 0.1; } } }   // 회랑 바닥에 선 몸(발이 턱 밑)에겐 벽 — 걸어서는 안 넘고 뛰면 넘는다\r\n    if(h > m) m = h;\r\n  }\r\n  /* 66차 — 성문 상자(성벽 길 다리·흉벽). 발 높이 y 를 아는 부름(사람 몸)에서만 본다:\r\n     윗면이 발 + STEP 안이면 딛고 서고, 몸(1.4)에 걸리면 그 윗면을 돌려줘 막고, 머리 위(통로에서 본 다리 밑)면 없는 셈. */\r\n  if(y !== undefined){\r\n    for(let bx=Math.floor((x-R)/4); bx<=Math.floor((x+R)/4); bx++) for(let bz=Math.floor((z-R)/4); bz<=Math.floor((z+R)/4); bz++){\r\n      const a = gboxGrid.get(gboxKey(bx,bz)); if(!a) continue;\r\n      for(let i=0;i<a.length;i++){ const b = a[i];\r\n        if(b.off || x+R <= b.x0 || x-R >= b.x1 || z+R <= b.z0 || z-R >= b.z1 || b.y1 <= m) continue;   // 67차 — off = 내가 연 비밀 문\r\n        /* 67차 — 지붕(ROOF)은 딛지 않는다: 착지 부름에선 없는 셈(위에서 떨어져도 지붕을 지나 밑 바닥으로 — 들썩임 없음),\r\n           수평 이동 부름(mv)에선 몸 세로 범위와 겹칠 때만 벽 */\r\n        if(b.k === GK.ROOF){ if(mv && b.y0 < y + 1.4 && b.y1 > y) m = b.y1; continue; }\r\n        if(b.curb && mv && PL.ground && y > b.y0 - 0.05 && y < b.y1 - 0.1){ if(y + STEP + 0.1 > m) m = y + STEP + 0.1; continue; }   // 70차 2회차 — 성벽 길 낮은 턱: 성벽 길 바닥에 선 몸의 수평 이동엔 벽(공중·턱 위 몸은 보통 바닥 · 밑 둘레길 몸은 보통 벽)\r\n        if(b.y1 <= y + STEP + 0.001 || b.y0 < y + 1.4){\r\n          /* 70차 — 올라설 윗면 위에 머리(1.4)가 안 들어가면(지도 방 선반 1.8 · 천장 3.0 — 그 자리 몸 둘레 천장으로 잰다 · 올라서는 프레임에만) 딛지 않고 벽으로 친다 — 뛰어 올라서면 머리가 천장 속에 박혀 굳었다 */\r\n          if(b.y1 > y + 0.05 && b.y1 <= y + STEP + 0.001 && ceilingOver(x, z, R, b.y1) < b.y1 + 1.4){ if(y + STEP + 0.1 > m) m = y + STEP + 0.1; continue; }\r\n          m = b.y1; } }\r\n    }\r\n  }\r\n\r\n  for(let i=0;i<SOLID.length;i++){ const s2 = SOLID[i]; if(s2.top <= m) continue;\r\n    const dx = x - s2.x, dz = z - s2.z, rr = s2.r + R*0.5; if(dx*dx + dz*dz < rr*rr) m = s2.top; }\r\n  return m;\r\n}";
const source=fs.readFileSync(file,'utf8'),reference=baselineFile?fs.readFileSync(baselineFile,'utf8'):REFERENCE_SOURCE;
const names=['solidTop','blockedAt','groundUnder'];
function compile(src){const parts=names.map(n=>extract(src,n));
 return new Function('S',`'use strict';
 const {inW,gi,terrH,bldH,GY,CK,CASTLE,miniOn,raceOn,RACE_P,raceTopAt,MINI_Y,stairOf,spiralH,SPIRALS,stairH,CHAM,CW,PL,STEP,gboxGrid,gboxKey,GK,ceilingOver,SOLID}=S;
 ${parts[0].replace('function solidTop(', 'function rawSolidTop(')}
 const solidTop=S.wrap('solidTop',rawSolidTop);
 ${parts.slice(1).join('\n')}
 return {blockedAt,groundUnder};`);
}
const oldFactory=compile(reference),newFactory=compile(source);
const SIZE=65,HALF=32,cell=(x,z)=>(x+HALF)*SIZE+z+HALF;
function world(cfg={},tracing=true){
 const trace=[],wrap=(name,f)=>tracing?function(...a){trace.push([name,...a]);return f(...a);}:f;
 const S={GY:10,CK:{SOLID:4,GALW:3},CW:{IN:5,GAL_CURB_E1:6,WALK:2,CURB:.4},CHAM:1,STEP:.3,GK:{ROOF:'roof'},MINI_Y:77,
  PL:{ground:cfg.grounded!==false},RACE_P:cfg.pads===false?[]:[{}],SPIRALS:[{y0:14},{y0:18}],SOLID:cfg.solids||[],wrap,
  terrH:new Float64Array(SIZE*SIZE).fill(cfg.height??10),bldH:new Float64Array(SIZE*SIZE).fill(-999),
  stairOf:new Int32Array(SIZE*SIZE).fill(cfg.stair??-1),CASTLE:new Uint8Array(SIZE*SIZE).fill(cfg.castle??0)};
 const limit=cfg.limit??HALF;
 S.inW=wrap('inW',(x,z)=>x>=-limit&&x<=limit&&z>=-limit&&z<=limit);
 S.gi=wrap('gi',cell);
 for(const q of cfg.cells||[]){const i=cell(q.x,q.z);if(q.h!==undefined)S.terrH[i]=q.h;if(q.b!==undefined)S.bldH[i]=q.b;if(q.k!==undefined)S.stairOf[i]=q.k;if(q.c!==undefined)S.CASTLE[i]=q.c;}
 S.miniOn=wrap('miniOn',()=>!!cfg.mini);S.raceOn=wrap('raceOn',()=>!!cfg.race);
 S.raceTopAt=wrap('raceTopAt',(x,z)=>cfg.raceVoid?-999:90+x*3-z*2);
 S.stairH=wrap('stairH',(k,x,z)=>20+k+x*.5-z*.25);
 S.spiralH=wrap('spiralH',(k,x,z,y)=>y+.2+k+x*.01-z*.02);
 S.gboxKey=wrap('gboxKey',(x,z)=>x+','+z);
 const grid=new Map();for(const entry of cfg.buckets||[])grid.set(entry[0],entry[1]);
 for(const b of cfg.boxes||[]){const key=(b.bucket||[0,0]).join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);}
 S.gboxGrid=tracing?{get:wrap('gboxGet',key=>grid.get(key))}:grid;
 S.ceilingOver=wrap('ceilingOver',()=>cfg.ceiling??999);
 return {S,trace};
}
let cases=0;const covered=new Set();
function parity(name,cfg,method,args,expected,inspect){
 const A=world(cfg),B=world(cfg),a=oldFactory(A.S)[method](...args),b=newFactory(B.S)[method](...args);
 assert.equal(b,a,name+': result');assert.deepEqual(B.trace,A.trace,name+': dependency call order and exact coordinates');
 if(expected!==undefined)assert.ok(Math.abs(b-expected)<1e-10||b===expected,name+': expected '+expected+', received '+b);
 inspect?.(b,B.trace,B.S);covered.add(name);cases++;return B.trace;
}
const positions=(x,z,r)=>[[-r,-r],[r,-r],[-r,r],[r,r],[0,0]].map(([a,b])=>[x+a,z+b]);
const samples=t=>t.filter(a=>a[0]==='solidTop').map(a=>a.slice(1));
const pointCells=[[-1,-1],[1,-1],[-1,1],[1,1],[0,0]];
for(const [x,z,r] of [[.5,.5,.6],[-.5,-.5,.6],[0,0,0],[-0,-0,0],[0,-0,-0],[2,3,-.4],[-1,-1,.5],[31.9,31.9,.01]]){
 parity('blocked five samples '+[x,z,r],{},'blockedAt',[x,z,r],false,(_,t)=>assert.deepEqual(samples(t),positions(x,z,r).map(p=>p.map(Math.floor))));
}
for(let i=0;i<5;i++)for(const kind of ['terrain','castle']){
 const [x,z]=pointCells[i],cfg={cells:[{x,z,...(kind==='terrain'?{h:12}:{c:4})}]};
 parity('blocked short circuit '+kind+' at '+i,cfg,'blockedAt',[.5,.5,.6],true,(_,t)=>assert.equal(samples(t).length,i+1));
}
parity('blocked exact height is walkable',{height:11},'blockedAt',[0,0,.4],false);
parity('blocked building top',{cells:[{x:0,z:0,b:12}]},'blockedAt',[0,0,0],true);
parity('blocked world boundary',{limit:1},'blockedAt',[-.9,0,.2],true);
parity('blocked missing terrain is solid',{height:-999},'blockedAt',[0,0,0],true);

for(const cfg of [{mini:true},{mini:true,race:true,pads:false}])parity('mini fallback '+JSON.stringify(cfg),cfg,'groundUnder',[0,0,.4,10,true],77);
for(const [x,z,r] of [[.5,-.5,.4],[-2,-3,0],[-2.2,3.1,-.4]]){
 const pts=positions(x,z,r),trace=parity('race samples '+[x,z,r],{mini:true,race:true},'groundUnder',[x,z,r,10,true],Math.max(...pts.map(([a,b])=>90+a*3-b*2)));
 assert.deepEqual(trace.filter(a=>a[0]==='raceTopAt').map(a=>a.slice(1)),pts);
 assert.equal(samples(trace).length,0);
}
parity('race void',{mini:true,race:true,raceVoid:true},'groundUnder',[0,0,.4],-999);
for(let i=0;i<5;i++){
 const [x,z]=pointCells[i];parity('terrain maximum sample '+i,{cells:[{x,z,h:10+i+1}]},'groundUnder',[.5,.5,.6],11+i);
}
parity('ground world boundary',{limit:1},'groundUnder',[-.9,0,.2],999);
parity('ground negative floor',{cells:[{x:-2,z:-2,h:17}]},'groundUnder',[-1.5,-1.5,.2],17);
parity('ground zero radius',{},'groundUnder',[0,0,0],10,(_,t)=>assert.equal(samples(t).length,5));
parity('ground negative zero radius',{},'groundUnder',[-0,0,-0],10,(_,t)=>assert.equal(samples(t).length,5));
parity('ground staircase',{stair:2},'groundUnder',[1.5,-1.5,.4],undefined,(_,t)=>assert.equal(t.filter(a=>a[0]==='stairH').length,5));
for(const y of [undefined,10,18])parity('ground spiral y '+y,{stair:1001},'groundUnder',[1,-1,.2,y],undefined,(_,t)=>{
 const a=t.filter(a=>a[0]==='spiralH');assert.equal(a.length,5);assert.ok(a.every(q=>q[1]===1&&q[4]===(y===undefined?18:y)));
});
const gal={castle:3,height:14};
parity('GALW inner face',gal,'groundUnder',[4,0,0,12,true],10);
parity('GALW curb normal',gal,'groundUnder',[5.4,0,0,12.2,false],12.4);
parity('GALW curb movement',gal,'groundUnder',[5.4,0,0,12.2,true],12.6);
parity('GALW airborne curb',{...gal,grounded:false},'groundUnder',[5.4,0,0,12.2,true],12.4);
parity('GALW unspecified height',gal,'groundUnder',[5.4,0,0],12.4);
parity('GALW below curb',gal,'groundUnder',[5.4,0,0,11.9,true],12.4);
parity('GALW atop curb',gal,'groundUnder',[5.4,0,0,12.4,true],12.4);
parity('GALW outer face',gal,'groundUnder',[6,0,0,12.2,true],14);

const box=(extra={})=>({x0:0,x1:2,z0:0,z1:2,y0:10,y1:10.2,...extra});
const ground=(name,boxes,args=[1,1,.3,10,false],expected=10,cfg={})=>parity(name,{...cfg,boxes},'groundUnder',args,expected);
ground('gbox omitted without feet height',[box()],[1,1,.3],10);
ground('gbox normal step',[box()],undefined,10.2);
ground('gbox off door',[box({off:true})]);
ground('gbox below sampled terrain',[box({y1:10})]);
for(const [side,change] of [['east',{x0:1.3}],['west',{x1:.7}],['south',{z0:1.3}],['north',{z1:.7}]])ground('gbox touching '+side,[box(change)]);
ground('gbox body wall',[box({y0:10.5,y1:14})],undefined,14);
ground('gbox overhead clearance',[box({y0:11.4,y1:14})]);
ground('gbox exact step epsilon',[box({y1:10.301})],undefined,10.301);
ground('gbox blocked ceiling',[box()],undefined,10.4,{ceiling:11.5});
ground('gbox exact head clearance',[box()],undefined,10.2,{ceiling:11.6});
ground('gbox no ascent ceiling probe',[box({y1:10.04})],undefined,10.04,{ceiling:10});
ground('roof falling is ignored',[box({k:'roof',y0:10.5,y1:14})]);
ground('roof movement blocks',[box({k:'roof',y0:10.5,y1:14})],[1,1,.3,10,true],14);
ground('roof above body ignored',[box({k:'roof',y0:11.4,y1:14})],[1,1,.3,10,true]);
ground('roof below feet ignored',[box({k:'roof',y0:10.5,y1:12})],[1,1,.3,12,true]);
ground('curb movement blocks',[box({curb:true,y1:10.4})],[1,1,.3,10.1,true],10.5);
ground('curb landing normal',[box({curb:true,y1:10.4})],[1,1,.3,10.1,false],10.4);
ground('curb airborne normal',[box({curb:true,y1:10.4})],[1,1,.3,10.1,true],10.4,{grounded:false});
ground('curb below floor normal',[box({curb:true,y0:11,y1:11.4})],[1,1,.3,10,true],11.4);
ground('curb atop normal',[box({curb:true,y1:10.4})],[1,1,.3,10.4,true],10.4);
ground('curb never lowers prior maximum',[box({y1:12}),box({curb:true,y1:13})],[1,1,.3,10.1,true],12);
const buckets=[];for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)buckets.push([x+','+z,[]]);
parity('bucket traversal across zero and four',{buckets},'groundUnder',[0,0,4.1,10],10,(_,t)=>{
 const keys=t.filter(a=>a[0]==='gboxKey').map(a=>a.slice(1)),want=[];for(let x=-2;x<=1;x++)for(let z=-2;z<=1;z++)want.push([x,z]);assert.deepEqual(keys,want);
});
ground('box scan preserves increasing maxima',[box({y1:10.1}),box({y1:10.2}),box({y1:10.15})],undefined,10.2);
parity('solid circle lower top ignored',{solids:[{x:0,z:0,r:2,top:9}]},'groundUnder',[0,0,.4,10],10);
parity('solid circle radius includes half body',{solids:[{x:0,z:0,r:1,top:14}]},'groundUnder',[1.1,0,.4,10],14);
parity('solid circle strict edge',{solids:[{x:0,z:0,r:1,top:14}]},'groundUnder',[1.25,0,.5,10],10);
parity('solid circle max wins',{solids:[{x:0,z:0,r:2,top:12},{x:0,z:0,r:2,top:13},{x:0,z:0,r:2,top:11}]},'groundUnder',[0,0,.4,10],13);

// Seeded mixed fixtures include integer boundaries and deliberately reversed radii.
let seed=104103;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let round=0;round<32;round++){
 const cells=[];for(let x=-6;x<=6;x++)for(let z=-6;z<=6;z++){const k=Math.floor(rnd()*12);cells.push({x,z,h:9+rnd()*5,c:k===0?4:k===1?3:0,k:k===2?1:k===3?1000:-1});}
 const cfg={cells,grounded:round%2===0,ceiling:round%3?999:11.5,solids:[{x:rnd()*4-2,z:rnd()*4-2,r:.5+rnd(),top:12+rnd()}],boxes:[box({y1:10.2+round%4})]};
 for(let i=0;i<12;i++){const x=i%3===0?Math.floor(rnd()*10)-5:rnd()*10-5,z=i%4===0?-0:rnd()*10-5,r=[0,.28,.6,-.28][i%4],y=i%3===0?undefined:9+rnd()*6;
  parity('mixed blocked '+round+'/'+i,cfg,'blockedAt',[x,z,r]);parity('mixed ground '+round+'/'+i,cfg,'groundUnder',[x,z,r,y,i%2===0]);
 }
}
console.log(`PASS: ${cases} actual-source ground/collision queries match values, dependency order and coordinates; terrain, short circuits, race, stairs, spirals, GALW, gboxes, roofs, curbs, ceilings and solid circles exercised.`);

if(bench){
 // Timing excludes fixture construction, assertions and trace allocation. Keep
 // both implementations live and alternate order; publish every paired round.
 const scenarios=[
  {name:'blocked open',method:'blockedAt',cfg:{},args:[.5,.5,.6]},
  {name:'blocked early wall',method:'blockedAt',cfg:{height:12},args:[.5,.5,.6]},
  {name:'ground terrain',method:'groundUnder',cfg:{},args:[.5,.5,.6]},
  {name:'ground race',method:'groundUnder',cfg:{mini:true,race:true},args:[.5,.5,.6]},
  {name:'ground spiral',method:'groundUnder',cfg:{stair:1000},args:[.5,.5,.6,14]},
  {name:'ground boxes',method:'groundUnder',cfg:{boxes:[box()],ceiling:11.5},args:[1,1,.3,10,true]}
 ];
 const median=a=>a.slice().sort((a,b)=>a-b)[Math.floor(a.length/2)];
 for(const q of scenarios){const old=oldFactory(world(q.cfg,false).S)[q.method],now=newFactory(world(q.cfg,false).S)[q.method];
  const run=(f,n)=>{let sum=0;const t=performance.now();for(let i=0;i<n;i++)sum+=Number(f(...q.args));const ms=performance.now()-t;return {ms,sum};};
  for(let warm=0;warm<4;warm++){run(old,10000);run(now,10000);}
  let n=20000;while(n<640000&&run(old,n).ms<25)n*=2;
  const rounds=[];for(let r=0;r<7;r++){let a,b;if(r%2){b=run(now,n);a=run(old,n);}else{a=run(old,n);b=run(now,n);}assert.equal(b.sum,a.sum,q.name+' benchmark checksum');rounds.push({oldUs:a.ms*1000/n,newUs:b.ms*1000/n});}
  console.log(JSON.stringify({benchmark:q.name,queriesPerRound:n,rounds,medianOldUs:median(rounds.map(r=>r.oldUs)),medianNewUs:median(rounds.map(r=>r.newUs)),medianPairedRatio:median(rounds.map(r=>r.newUs/r.oldUs))}));
 }
 console.log('CPU microbench only: fixture terrain/helpers, current Node/V8, no rendering, GPU, network latency or classroom FPS measured.');
}
