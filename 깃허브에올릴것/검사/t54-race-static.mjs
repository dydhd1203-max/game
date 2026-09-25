/* Node-only race QA: source-extracted course, collision, hazards, rendering and
   actual updPlayer movement prefix. No browser, display, pointer or network. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const out=path.resolve(process.argv[3]||path.join(here,'../../artifacts/54-race'));
const source=fs.readFileSync(file,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
function end(st,func=false){let b=0,p=0,r=0,q='',co='',esc=false,opened=false;
  for(let i=st;i<source.length;i++){const c=source[i],n=source[i+1];
    if(co==='line'){if(c==='\n')co='';continue;}if(co==='block'){if(c==='*'&&n==='/'){co='';i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q='';continue;}
    if(c==='/'&&n==='/'){co='line';i++;continue;}if(c==='/'&&n==='*'){co='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{'){b++;opened=true;}else if(c==='}')b--;
    else if(c==='(')p++;else if(c===')')p--;else if(c==='[')r++;else if(c===']')r--;
    if(!b&&!p&&!r&&((func&&opened)||(!func&&c===';')))return i+1;
  }throw Error('Unterminated '+source.slice(st,st+80));}
function decl(n){const m=new RegExp('(?:const|let)\\s+'+n+'\\s*=').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));}
function fn(n){const s=source.indexOf('function '+n+'(');if(s<0)throw Error(n);return source.slice(s,end(s,true));}
const fixtures=`
const MINI_Y=100, MINI_R=34, MINI_PADZ=-19, PL={R:.3}, G={players:new Map(),mini:{seed:1,st:'run'}}, MINE={cp:0};
let uid='kid00',KEY={},mvx=0,mvz=0,wantJump=false,camDip=0,gaitMe=0,sprinting=false,raceTestSprint=1;
const miniOn=()=>true,raceOn=()=>true,raceHold=()=>false,solidHit=()=>false,sheepBump=()=>{},
  spdMul=()=>1,sprintMul=()=>raceTestSprint,jobTier=()=>0,burst=()=>{},fovPunch=()=>{},rampSeen=true,window={},
  JOB_SPD=[1],XP={jt:0},touchJumpHeld=false,GY=0;
// 67차 성곽 — updPlayer 앞부분의 새 부름은 모두 if(!miniOn()) 안이라 경주에선 안 불린다. 이름만 있게 둔다(ReferenceError 방지)
const ceilingOver=()=>1e9,spiralAssist=()=>0,spiralPost=()=>{},doorFunnel=()=>0,galleryYaw=()=>{},galleryClamp=()=>{},
  castleRescue=()=>{},covAt=()=>false,CROOF=new Uint8Array(1),SPA={vx:0,vz:0};
let lookIdleT=0;
const R_trim={instanceMatrix:{},rows:[]},R_plat={instanceMatrix:{},rows:[],count:0},
  R_rock={instanceMatrix:{},rows:[]},R_hazB={instanceMatrix:{},rows:[]},landShow=()=>{};
function setIR(m,i,x,y,z,ry,rx,sx,sy,sz,col){m.rows[i]={x,y,z,ry,rx,sx,sy,sz,col};}
function setIR3(m,i,x,y,z,ry,rx,rz,sx,sy,sz,col){setIR(m,i,x,y,z,ry,rx,sx,sy,sz,col);m.rows[i].rz=rz;}
`;
let move=fn('updPlayer');move=move.slice(0,move.indexOf('  recoilTick(dt);'))+'\n}';
// HAZR_MAX 는 적지 않는다 — HAZB_MAX 와 한 문장(`const HAZB_MAX = 32, HAZR_MAX = 24;`)이라 같이 딸려 온다.
// 이름을 따로 적으면 `const HAZR_MAX` 라는 글자가 없어 decl() 이 Error 를 던진다.
// RACE_STAMP 는 HAZ 보다 먼저 적는다 — HAZ 가 `stamp:RACE_STAMP` 로 그것을 읽는다.
const declarations=['RACE_X','RACE_S','RACE_Z_FIN','RACE_RAINBOW_DZ','STAMP_DZ','RACE_STAMP','RACE_ROWZ','RACE_P','RACE','FADE_T','ROCK','HAZ',
  'HAZB_MAX',
  'STEP','GRAV','GRAV_V','gravNow','jumpNow','jump2Now','RACE_SPD','SPRINT','ACC_UP','JOB_JMP','GLIDE_T','GLIDE_VY','STRIDE_WALK'];
const functions=['mulberry','furLight','raceBuild','raceOff','raceAlive','raceTopAt','raceUnder','raceSlotXZ',
  'raceCheckpointXZ','rockU','raceRocks','stampY','raceHazards','raceSphereHit','raceDrawTrim','raceDraw','groundUnder','sheepGaitStep'];
const code=[fixtures,...declarations.map(decl),...functions.map(fn),move,`globalThis.A={RACE,RACE_P,RACE_S,RACE_Z_FIN,RACE_RAINBOW_DZ,RACE_X,PL,G,MINE,R_trim,R_plat,R_rock,R_hazB,
  raceBuild,raceOff,raceAlive,raceTopAt,raceUnder,raceCheckpointXZ,raceRocks,raceHazards,raceSphereHit,raceDraw,groundUnder,ROCK,HAZ,STAMP_DZ,RACE_STAMP,stampY,HAZB_MAX,SPD,RACE_SPD,
  spawn(id){uid=id;return raceSlotXZ();}, cp(id,p){uid=id;return raceCheckpointXZ(p);},
  reset(x,z,y,run=false,moving=false){raceTestSprint=run?SPRINT.mul:1;RACE.slipT=0;Object.assign(PL,{x,z,y,vy:0,yaw:Math.PI,ground:true,jumps:0,vx:0,vz:moving?SPD*RACE_SPD*raceTestSprint:0,_px:undefined,_pz:undefined,down:false});KEY={w:true};},
  tick(jump=false,dt=1/120){wantJump=jump;updPlayer(dt);RACE.t+=dt;}
};`].join('\n');
const ctx=vm.createContext({THREE,console});new vm.Script(code).runInContext(ctx,{timeout:10000});
const A=ctx.A,results=[];
function check(n,p,d){results.push({name:n,pass:!!p,detail:d});console.log((p?'OK   ':'FAIL ')+n+(d===undefined?'':' '+JSON.stringify(d)));}
const seeds=Array.from({length:90},(_,i)=>i*7919+13);
let minWidth=Infinity,maxTrim=0,det=true,finite=true,coll=true,movement=true,variants=new Set();
for(const seed of seeds){A.raceBuild(seed);const old=JSON.stringify(A.RACE_P);A.raceBuild(seed);det&&=old===JSON.stringify(A.RACE_P);variants.add(A.RACE.vars.join(''));
  for(const p of A.RACE_P){finite&&=['x','z','w','d','y','h'].every(k=>Number.isFinite(p[k]));
    if(!['block','fin','cp'].includes(p.kind))minWidth=Math.min(minWidth,p.w);
    if(!p.blink){const x=p.x+A.raceOff(p,3);coll&&=A.raceTopAt(x,p.z,3)>=100+p.y-.001;}
    if(p.mv)movement&&=Math.abs(A.raceOff(p,3))<=p.mv.amp+.001&&p.mv.amp>=4;
  }
  A.RACE.t=7;A.raceDraw(7);maxTrim=Math.max(maxTrim,A.R_trim.count);
  finite&&=[A.R_trim,A.R_plat,A.R_rock,A.R_hazB].every(m=>m.rows.slice(0,m.count).every(r=>Object.values(r).every(Number.isFinite)));
}
check('Same seed produces identical widened course',det,{seeds:seeds.length,variants:variants.size});
check('All traversable obstacle platforms are at least 9.6 wide',minWidth>=9.6,{minWidth});
check('Platform collision follows actual expanded geometry',coll);
check('Moving platforms scale sideways within their bounds',movement);
check('Actual render transforms are finite and trim bank has room',finite&&maxTrim<1400,{maxTrim,capacity:1400});
// 63차 — 구간이 일곱이 됐다(쿵쿵 도장이 무지개와 계단 사이에 들어갔다). 312 라는 숫자 대신
// "골인선은 마지막 구간 끝 2칸 뒤" 라는 뜻을 적어 둔다 — 다음에 구간을 더 넣어도 안 고쳐도 된다.
A.raceBuild(4821);check('Six rainbow platforms keep room for real jump gaps before the next section',A.RACE_S.length===7&&A.RACE_Z_FIN===A.RACE_S.at(-1).z1+2&&A.RACE_P.filter(p=>p.kind==='rainbow').length===6&&A.RACE_S[5].z0>A.RACE_P.filter(p=>p.kind==='rainbow').at(-1).z+4);
const ids=Array.from({length:21},(_,i)=>'kid'+String(i).padStart(2,'0'));A.G.players=new Map(ids.map(id=>[id,{}]));
const slots=ids.map(id=>A.spawn(id));
const minDist=ps=>Math.min(...ps.flatMap((p,i)=>ps.slice(i+1).map(q=>Math.hypot(p[0]-q[0],p[1]-q[1]))));
check('21 starters have distinct, safe island slots',minDist(slots)>1.2&&slots.every(([x,z])=>A.raceTopAt(x,z,0)===100),{minDistance:minDist(slots)});
let cps=true,cpDist=Infinity;
for(const p of A.RACE_P.filter(p=>p.cp)){const points=ids.map(id=>A.cp(id,p));cpDist=Math.min(cpDist,minDist(points.map(q=>[q.x,q.z])));
  cps&&=points.every(q=>Math.abs(q.x-p.x)<p.w/2-.5&&Math.abs(q.z-p.z)<p.d/2-.3);}
check('Checkpoint respawns distribute 21 players across two safe rows',cps&&cpDist>1.2,{minDistance:cpDist});
const hazards=JSON.stringify(A.raceHazards(22).concat(A.raceRocks(22)));
check('Hazards remain deterministic and stair balls use extended final section',hazards===JSON.stringify(A.raceHazards(22).concat(A.raceRocks(22)))&&A.raceHazards(22).filter(p=>p.k==='ball').every(p=>p.z>=254));
// Run the unmodified movement/collision prefix from the game, including acceleration,
// gravity, jump input, double-jump gates and landing. Only sound/camera/world UI are fixtures.
const rainbow=A.RACE_P.filter(p=>p.kind==='rainbow');const hops=[];
for(let i=0;i<rainbow.length-1;i++){const p=rainbow[i],next=rainbow[i+1];A.reset(0,p.z+p.d/2-.7,100+p.y);A.RACE.t=0;
  let landed=false,peak=0;
  for(let f=0;f<180;f++){A.tick(f===0);peak=Math.max(peak,A.PL.y-100-p.y);
    if(f>8&&A.PL.ground&&A.PL.z>next.z-next.d/2-.3){landed=true;break;}if(A.PL.y<96)break;}
  hops.push({edge:i,landed,z:A.PL.z,peak});}
check('Every new rainbow gap lands using actual one-jump player physics',hops.every(h=>h.landed),hops);
const gapRuns=[];
for(const fps of [30,60,120])for(let i=0;i<rainbow.length-1;i++)for(const run of [false,true]){
  const p=rainbow[i],next=rainbow[i+1];A.reset(0,p.z+p.d/2-.7,100+p.y,run,true);A.RACE.t=0;
  let crossed=false;
  for(let f=0;f<fps*2;f++){A.tick(false,1/fps);if(A.PL.ground&&A.PL.z>next.z-next.d/2+.1){crossed=true;break;}if(A.PL.y<96)break;}
  gapRuns.push({fps,edge:i,run,crossed});
}
check('All rainbow gaps require a jump even when already walking or sprinting',gapRuns.every(r=>!r.crossed),{cases:gapRuns.length,failed:gapRuns.filter(r=>r.crossed)});
check('Every gap contains unsupported space even with player-radius ground samples',rainbow.slice(0,-1).every((p,i)=>{
  const next=rainbow[i+1],mid=(p.z+p.d/2+next.z-next.d/2)/2;return A.groundUnder(0,mid,A.PL.R)<-900;
}));
const jumpRuns=[];
for(const fps of [30,60,120])for(let i=0;i<rainbow.length-1;i++)for(const takeoff of [.45,.7,1.0]){
  const p=rainbow[i],next=rainbow[i+1];A.reset(0,p.z+p.d/2-takeoff,100+p.y);A.RACE.t=0;let landed=false;
  for(let f=0;f<fps*2;f++){A.tick(f===0,1/fps);if(f>3&&A.PL.ground&&A.PL.z>next.z-next.d/2-.3){landed=true;break;}if(A.PL.y<96)break;}
  jumpRuns.push({fps,edge:i,takeoff,landed});
}
check('Single unsprinted jumps land across a useful takeoff window at 30/60/120 FPS',jumpRuns.every(r=>r.landed),{cases:jumpRuns.length,failed:jumpRuns.filter(r=>!r.landed)});
check('Rolling rocks and stair balls have doubled radii and travel speed',A.ROCK.r===2.3&&A.ROCK.spd===17&&A.HAZ.ball.r===1.6&&A.HAZ.ball.spd===15);
check('Pendulums have doubled radius and angular speed with ground clearance',A.HAZ.pend.r===2.4&&A.HAZ.pend.per===.91&&Math.abs(A.HAZ.pend.top-A.HAZ.pend.len-A.HAZ.pend.r-.2)<1e-9);
const e=.00001,seedPhase=(A.RACE.seed%1000)/1000,period=A.HAZ.pend.per,tPeak=period*(1-(1.3+seedPhase*6.28)/(Math.PI*2));
const pa=A.raceHazards(tPeak-e).find(h=>h.id==='p1'),pb=A.raceHazards(tPeak+e).find(h=>h.id==='p1');
const pendSpeed=Math.abs(pb.x-pa.x)/(2*e),oldPeak=6.2*.44*Math.PI*2/1.82;
check('Actual pendulum motion reaches twice its former linear speed',Math.abs(pendSpeed/oldPeak-2)<.00001,{pendSpeed,ratio:pendSpeed/oldPeak});
let drawMatch=true,hitEdges=true,rockVelocity=[],ballVelocity=[],spawnSafe=true,dodgeSafe=true;
for(let t=0;t<=40;t+=.05){
  const rolling=A.raceRocks(t),haz=A.raceHazards(t),spheres=rolling.concat(haz.filter(h=>h.k==='ball'||h.k==='pend'));
  A.RACE.t=t;A.raceDraw(t);
  drawMatch&&=spheres.length===A.R_rock.count&&spheres.every((h,i)=>{const p=A.R_rock.rows[i];return Math.abs(p.x-h.x)<1e-9&&Math.abs(p.z-h.z)<1e-9&&Math.abs(p.y-100-h.y)<1e-9&&[p.sx,p.sy,p.sz].every(v=>Math.abs(v-h.r*2)<1e-9);});
  for(const h of spheres){
    Object.assign(A.PL,{x:h.x+h.r+A.PL.R-.001,z:h.z,y:100+h.y-.8});hitEdges&&=A.raceSphereHit(h);
    A.PL.x+=.002;hitEdges&&=!A.raceSphereHit(h);
    Object.assign(A.PL,{x:h.x,z:h.z,y:100+h.y+h.r+.001});hitEdges&&=!A.raceSphereHit(h);
    A.PL.y-=.002;hitEdges&&=A.raceSphereHit(h);
  }
  for(const h of rolling.concat(haz.filter(h=>h.k==='ball'))){
    const after=(h.k==='rock'?A.raceRocks(t+.01):A.raceHazards(t+.01)).find(q=>q.id===h.id);
    if(after&&(h.k!=='rock'||h.tt>1.25))(h.k==='rock'?rockVelocity:ballVelocity).push((h.z-after.z)/.01);
    for(const p of A.RACE_P.filter(p=>p.cp))for(const id of ids){const q=A.cp(id,p);Object.assign(A.PL,{x:q.x,z:q.z,y:100+q.y});spawnSafe&&=!A.raceSphereHit(h);}
    const supports=A.RACE_P.filter(p=>['log','stair'].includes(p.kind)&&Math.abs(p.z-h.z)<=p.d/2);
    for(const p of supports){const cx=p.x+A.raceOff(p,t),edge=p.w/2-A.PL.R-.15;dodgeSafe&&=Math.max(Math.abs(cx-edge-h.x),Math.abs(cx+edge-h.x))>h.r+A.PL.R+.25;}
  }
}
check('Every sphere render uses the same center and doubled radius as collision',drawMatch);
check('Actual sphere/capsule collision matches visible side and vertical boundaries',hitEdges);
check('Actual rolling functions move at the doubled configured speeds',rockVelocity.length>20&&ballVelocity.length>20&&rockVelocity.every(v=>Math.abs(v-17)<1e-8)&&ballVelocity.every(v=>Math.abs(v-15)<1e-8),{rockSamples:rockVelocity.length,ballSamples:ballVelocity.length});
check('Rolling hazards never engulf any of the 21 checkpoint respawn positions',spawnSafe);
check('Widened log and stair platforms retain practical side space to dodge',dodgeSafe);
// Actual static race art construction, with bpush as a matrix recorder. Material
// and box-geometry fixtures isolate this from unrelated village texture loading.
const art=source.slice(source.indexOf('  const Rp = h =>'),source.indexOf('  /* 네 귀퉁이 등불 */',source.indexOf('  const Rp = h =>')));
// 63차 — 도장 구간의 바닥 표적·안내 기둥이 STAMP_DZ 와 RACE_STAMP 를 읽는다. 모래상자에도 넣어 준다.
// ★ 여기에 넣어 주는 것만으로는 부족하다 — 모래상자는 전부 전역으로 꽂아 주므로 선언 **순서**가
//   안 보인다. 실제 게임에서의 순서는 바로 아래 'declared before buildMiniIsle()' 검사가 본다.
const artCtx=vm.createContext({THREE,console,RACE_S:A.RACE_S,RACE_Z_FIN:A.RACE_Z_FIN,RACE_RAINBOW_DZ:A.RACE_RAINBOW_DZ,RACE_Y_FIN:8.1,MINI_Y:100,MINI_R:34,MINI_PADZ:-19,STAMP_DZ:A.STAMP_DZ,RACE_STAMP:A.RACE_STAMP});
new vm.Script(`const MAT={},WMAT={},EMITC={},gMark=new THREE.BoxGeometry(),gEdge=gMark,gGlow=gMark,WGEO=gMark,TRUNKG=new THREE.CylinderGeometry(.5,.5,1,8),CONEG=new THREE.ConeGeometry(.5,1,8),miParts={race:[]},rows=[],TQ=2.6,nq=14;
function bpush(key,geo,mat,x,y,z,ry=0,sx=1,sy=1,sz=1,rz=0,col=0){rows.push({key,x,y,z,ry,sx,sy,sz,rz,col});return rows.length-1;}
${fn('furLight')}
function buildArt(){${art}}buildArt();globalThis.rows=rows;`).runInContext(artCtx,{timeout:10000});
check('Actual race scenery builds with finite instance transforms',artCtx.rows.every(p=>['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(p[k]))),{instances:artCtx.rows.length});
/* ★ 63차 — 로드 순서. 이 미술은 buildMiniIsle() 안에 있고 그건 모듈 맨 위에서 **로드 즉시** 돈다.
   여기서 읽는 상수가 파일 뒤쪽에 const 로 선언돼 있으면 TDZ 로 걸려
   "Cannot access 'X' before initialization" 한 줄에 모듈 전체가 죽고 화면이 하얗게 된다.
   node --check 는 문법만 보고, 위 모래상자는 필요한 이름을 전부 전역으로 꽂아 주므로 둘 다 이걸 못 잡는다.
   실제로 '쿵쿵 도장' 의 STAMP_DZ 를 HAZ 옆(파일 아래쪽)에 두었다가 게임이 안 떴다 — 그래서 이 검사를 둔다.
   대문자 상수 이름만 본다(이 저장소의 상수 규칙). 선언을 못 찾은 이름은 건너뛴다(거짓 경보 방지). */
{
  const callAt=source.indexOf('\nbuildMiniIsle();');
  /* 주석은 먼저 걷어낸다. 안 그러면 주석에 적힌 이름까지 '읽는다' 고 센다 —
     실제로 5422줄의 "// BALL 은 이 아래에서 정의된다" 한 줄 때문에 BALL 이 걸렸다.
     (그 주석 자체가, 예전에 누군가 같은 함정을 만나 남긴 메모다.)
     문자열 안의 // 까지 지워질 수 있지만, 그러면 이름을 **덜** 보게 될 뿐이라 거짓 경보는 안 난다. */
  const code=art.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' ');
  const names=[...new Set(code.match(/\b[A-Z][A-Z0-9_]{2,}\b/g)||[])];
  const late=names.filter(n=>{const m=new RegExp('(?:^|\\n)\\s*(?:const|let)\\s+'+n+'\\s*=').exec(source);return m&&m.index>callAt;});
  check('Race scenery only reads constants declared before buildMiniIsle() runs',callAt>0&&late.length===0,{callAt,late});
}
check('Street buildings lie outside expanded track',artCtx.rows.filter(r=>r.z>60&&r.z<280&&r.key==='miMark'&&r.sx===11.8).every(r=>Math.abs(r.x)-r.sx/2>26));
// 무지개 구간의 깃대는 발판마다 양옆에 선다. 간격이 갈라지면 뒤쪽 발판 옆이 텅 빈다.
{
  const rainbow=A.RACE_P.filter(p=>p.kind==='rainbow').map(p=>p.z).sort((a,b)=>a-b);
  const poles=artCtx.rows.filter(r=>Math.abs(Math.abs(r.x)-19)<1e-9);
  const missing=rainbow.filter(z=>!poles.some(r=>Math.abs(r.z-z)<1e-6));
  check('Every rainbow platform keeps its flag poles beside it',rainbow.length===6&&missing.length===0,
    {platforms:rainbow,missing});
}
// 장애물이 판 위를 실제로 쓸고 지나가는지 — 넓힌 뒤 진자는 허공만 휘젓고(0%),
// 막대는 32칸 판 중 7칸(22%)만 덮어 그냥 걸어서 지나갈 수 있었다.
{
  const cover=(seeds)=>{
    const worst={pend:101,bar:101},where={};
    for(const seed of seeds){
      A.raceBuild(seed);
      const span={};
      for(let i=0;i<180;i++) for(const h of A.raceHazards(i*0.041)){
        if(h.k==='ball') continue;
        const reach=h.k==='bar'?h.len/2:(h.r||0);
        const e=span[h.id]||(span[h.id]={k:h.k,z:h.z,min:Infinity,max:-Infinity});
        e.min=Math.min(e.min,h.x-reach); e.max=Math.max(e.max,h.x+reach);
      }
      for(const [id,e] of Object.entries(span)){
        const segs=A.RACE_P.filter(p=>Math.abs(p.z-e.z)<=p.d/2+1).map(p=>[p.x-p.w/2,p.x+p.w/2]);
        if(!segs.length) continue;
        const total=segs.reduce((s,[a,b])=>s+(b-a),0);
        const cov=segs.reduce((s,[a,b])=>s+Math.max(0,Math.min(e.max,b)-Math.max(e.min,a)),0);
        const pct=cov/total*100;
        if(pct<worst[e.k]){worst[e.k]=pct;where[e.k]={seed,id,pct:+pct.toFixed(0)};}
      }
    }
    return {worst,where};
  };
  const {worst,where}=cover(seeds.slice(0,40));
  check('Pendulums always hang over the bridge they guard, in every course variant',
    worst.pend>=99,where.pend);
  check('The rotating bar still sweeps most of its widened checkpoint platform',
    worst.bar>=80,where.bar);
  // 길이만 늘리고 속도를 그대로 두면 끝이 4배 빨라져 9살이 피할 수 없다.
  const tip=A.HAZ.bar.len/2*A.HAZ.bar.spd;
  check('The bar tip stays at twice the pre-widening speed, not four times',
    Math.abs(tip-6.65*2)<0.01,{tip:+tip.toFixed(2)});
  check('Bar length follows the course width instead of a fixed number',
    Math.abs(A.HAZ.bar.len-7*A.RACE_X)<1e-9,{len:A.HAZ.bar.len,RACE_X:A.RACE_X});
}
/* ═══ 63차 — 쿵쿵 도장. 약속한 네 가지를 코드로 못 박는다 ═══
   ⑴ 길 전체를 덮는다(막대가 넓힌 판의 22%만 덮어 그냥 걸어 지나가졌던 사고의 재발 방지)
   ⑵ 아홉 살이 걸어서 지나갈 만큼 오래 열린다
   ⑶ **진짜 updPlayer** 로 굴려 걸어 들어오면 셋 다 안 맞고 통과한다
   ⑷ 구간 안에 떨어질 구멍이 하나도 없다 */
{
  const K=A.HAZ.stamp, WALK=A.SPD*A.RACE_SPD;      // 경주 걷기 칸/초
  const stampsAt=t=>A.raceHazards(t).filter(h=>h.k==='stamp');
  // ⑴ 덮개율 — 90 seed 전부에서 도장이 그 z 의 발판을 100% 덮는가
  { let worst=101,where=null;
    for(const seed of seeds){ A.raceBuild(seed);
      for(const h of stampsAt(0)){
        const segs=A.RACE_P.filter(p=>Math.abs(p.z-h.z)<=p.d/2).map(p=>[p.x-p.w/2,p.x+p.w/2]);
        const total=segs.reduce((s,[a,b])=>s+(b-a),0); if(!total) continue;
        const cov=segs.reduce((s,[a,b])=>s+Math.max(0,Math.min(h.x+h.w/2,b)-Math.max(h.x-h.w/2,a)),0);
        const pct=cov/total*100; if(pct<worst){worst=pct;where={seed,id:h.id,pct:+pct.toFixed(1)};} } }
    check('Each slam stamp covers the whole deck it guards, in every course variant',worst>=99.9,where); }
  A.raceBuild(4821);
  check('Three stamps stand on the new section and none can be jumped over while pressed',
    stampsAt(0).length===3&&K.h>3.48,{count:stampsAt(0).length,height:K.h,doubleJumpPeak:3.48});
  // ⑵ 열린 창 — 도장 바닥이 키(1.3)보다 높은 연속 시간 vs 위험 띠를 걷어서 지나는 시간
  { const danger=(K.dz*2+0.6)/WALK; let open=0,step=K.per/2400;
    for(let u=0;u<K.per;u+=step) if(A.stampY(u)>1.3) open+=step;
    check('Every stamp stays open far longer than it takes to walk through it',
      open>=1.0&&open>=danger*3&&open<K.per-0.5,
      {openSec:+open.toFixed(2),walkThroughSec:+danger.toFixed(2),period:K.per}); }
  // ⑶ 박자대로 걸어 들어오면 진짜 물리로 셋을 다 통과하는가
  { const S=A.RACE_S[5],deck=A.RACE_P.find(p=>p.sec===5&&p.kind==='pad');
    const runs=[];
    for(const fps of [30,60,120]){
      let best=null;
      for(let k=0;k<48;k++){                                   // 들어오는 순간을 48갈래로 훑는다
        const t0=k*K.per/48; A.reset(0,deck.z-deck.d/2+0.6,100+deck.y); A.RACE.t=t0;
        let hit=false;
        for(let f=0;f<fps*12;f++){ A.tick(false,1/fps);
          for(const h of stampsAt(A.RACE.t)){
            const feet=A.PL.y-100-h.y;
            if(Math.abs(A.PL.z-h.z)<h.dz+A.PL.R&&Math.abs(A.PL.x-h.x)<h.w/2+A.PL.R&&feet>-1.3&&feet<h.h){hit=true;break;} }
          if(hit||A.PL.z>S.z1-0.5) break; }
        if(!hit&&A.PL.z>S.z1-0.5){best={fps,enterPhase:+(t0/K.per).toFixed(3)};break;} }
      runs.push(best||{fps,cleared:false}); }
    check('Walking in on the beat clears all three stamps at 30/60/120 FPS',
      runs.every(r=>r&&r.cleared!==false),runs); }
  /* 그리기 정원 — 넘치면 도장이 **안 보이는데 맞는** 것이 된다(hb < HAZB_MAX 에서 조용히 잘린다).
     실제 raceDraw 를 굴려 상자 뱅크가 정원 안에 들고, 도장 여섯 조각이 다 들어갔는지 본다. */
  { let worst=0;
    for(let t=0;t<=40;t+=0.05){ A.RACE.t=t; A.raceDraw(t); worst=Math.max(worst,A.R_hazB.count); }
    check('Every stamp still fits in the hazard box bank — nothing is silently dropped',
      worst<=A.HAZB_MAX&&worst>=24,{worst,capacity:A.HAZB_MAX}); }
  // ⑷ 떨어질 구멍이 없다 — 몸 반지름 표본으로 구간 전체를 훑는다
  { const S=A.RACE_S[5]; let holes=0,first=null;
    for(let z=S.z0-1;z<=S.z1;z+=0.5) for(let x=-16;x<=16;x+=1){
      if(A.groundUnder(x,z,A.PL.R)<-900){holes++;first??={x,z:+z.toFixed(1)};} }
    check('The stamp deck has no hole to fall into',holes===0,{holes,first}); }
}
A.raceBuild(4821);
fs.mkdirSync(out,{recursive:true});
// Diagram from actual computed platform/art coordinates, not a hand-drawn course.
const sx=x=>360+x*5,sy=z=>1730-(z+30)*5,hex=c=>'#'+(c||0xffffff).toString(16).padStart(6,'0');
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1830"><rect width="720" height="1830" fill="#eef9ff"/><text x="24" y="30" font-family="sans-serif" font-size="20" fill="#244360">Actual race geometry · CPU plan inspection</text>`;
for(const r of artCtx.rows)if(r.z>35&&r.z<320&&r.y>=98&&r.sy>1&&Math.abs(r.x)>20&&r.key==='miMark')svg+=`<rect x="${sx(r.x-r.sx/2)}" y="${sy(r.z+r.sz/2)}" width="${r.sx*5}" height="${r.sz*5}" fill="${hex(r.col)}" opacity=".65"/>`;
svg+=`<circle cx="360" cy="${sy(0)}" r="170" fill="#b9e995"/>`;
for(const p of A.RACE_P){svg+=`<rect x="${sx(p.x+A.raceOff(p,0)-p.w/2)}" y="${sy(p.z+p.d/2)}" width="${p.w*5}" height="${p.d*5}" rx="2" fill="${hex(p.col)}" stroke="#53718a" stroke-width=".8"/>`;}
for(const p of slots)svg+=`<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="3" fill="#4270ca"/>`;
A.RACE_S.forEach((s,i)=>svg+=`<text x="8" y="${sy(s.z0+14)}" font-size="13" font-family="sans-serif" fill="#244360">${i+1}. ${s.n}</text>`);
svg+='</svg>';fs.writeFileSync(path.join(out,'54-race-course.svg'),svg);
try{const require=createRequire(import.meta.url);let sharp;try{sharp=require('sharp');}catch{sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');}await sharp(Buffer.from(svg)).png().toFile(path.join(out,'54-race-course.png'));}catch(e){console.log('PNG unavailable: '+e.message);}
fs.writeFileSync(path.join(out,'54-race-results.json'),JSON.stringify({file,sha256:crypto.createHash('sha256').update(source).digest('hex'),results},null,2));
console.log(`${results.filter(r=>r.pass).length}/${results.length} checks passed`);if(results.some(r=>!r.pass))process.exitCode=1;
