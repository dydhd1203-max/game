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
let uid='kid00',KEY={},mvx=0,mvz=0,wantJump=false,camDip=0,gaitMe=0,sprinting=false;
const miniOn=()=>true,raceOn=()=>true,raceHold=()=>false,solidHit=()=>false,sheepBump=()=>{},
  spdMul=()=>1,sprintMul=()=>1,jobTier=()=>0,burst=()=>{},fovPunch=()=>{},rampSeen=true,window={},
  JOB_SPD=[1],XP={jt:0},touchJumpHeld=false,GY=0;
const R_trim={instanceMatrix:{},rows:[]},R_plat={instanceMatrix:{},rows:[],count:0},
  R_rock={instanceMatrix:{},rows:[]},R_hazB={instanceMatrix:{},rows:[]},landShow=()=>{};
function setIR(m,i,x,y,z,ry,rx,sx,sy,sz,col){m.rows[i]={x,y,z,ry,rx,sx,sy,sz,col};}
function setIR3(m,i,x,y,z,ry,rx,rz,sx,sy,sz,col){setIR(m,i,x,y,z,ry,rx,sx,sy,sz,col);m.rows[i].rz=rz;}
`;
let move=fn('updPlayer');move=move.slice(0,move.indexOf('  recoilTick(dt);'))+'\n}';
const declarations=['RACE_X','RACE_S','RACE_Z_FIN','RACE_ROWZ','RACE_P','RACE','FADE_T','ROCK','HAZ',
  'STEP','GRAV','GRAV_V','gravNow','jumpNow','jump2Now','RACE_SPD','ACC_UP','JOB_JMP','GLIDE_T','GLIDE_VY','STRIDE_WALK'];
const functions=['mulberry','furLight','raceBuild','raceOff','raceAlive','raceTopAt','raceUnder','raceSlotXZ',
  'raceCheckpointXZ','rockU','raceRocks','raceHazards','raceDrawTrim','raceDraw','groundUnder'];
const code=[fixtures,...declarations.map(decl),...functions.map(fn),move,`globalThis.A={RACE,RACE_P,RACE_S,RACE_Z_FIN,RACE_X,PL,G,MINE,R_trim,R_plat,R_rock,R_hazB,
  raceBuild,raceOff,raceAlive,raceTopAt,raceUnder,raceCheckpointXZ,raceRocks,raceHazards,raceDraw,groundUnder,
  spawn(id){uid=id;return raceSlotXZ();}, cp(id,p){uid=id;return raceCheckpointXZ(p);},
  reset(x,z,y){Object.assign(PL,{x,z,y,vy:0,yaw:Math.PI,ground:true,jumps:0,vx:0,vz:0,_px:undefined,_pz:undefined,down:false});KEY={w:true};},
  tick(jump=false){wantJump=jump;updPlayer(1/120);RACE.t+=1/120;}
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
A.raceBuild(4821);check('Six sections and a 36-unit course extension',A.RACE_S.length===6&&A.RACE_Z_FIN===294&&A.RACE_P.filter(p=>p.kind==='rainbow').length===6);
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
// Actual static race art construction, with bpush as a matrix recorder. Material
// and box-geometry fixtures isolate this from unrelated village texture loading.
const art=source.slice(source.indexOf('  const Rp = h =>'),source.indexOf('  /* 네 귀퉁이 등불 */',source.indexOf('  const Rp = h =>')));
const artCtx=vm.createContext({THREE,console,RACE_S:A.RACE_S,RACE_Z_FIN:A.RACE_Z_FIN,RACE_Y_FIN:8.1,MINI_Y:100,MINI_R:34,MINI_PADZ:-19});
new vm.Script(`const MAT={},WMAT={},EMITC={},gMark=new THREE.BoxGeometry(),gEdge=gMark,gGlow=gMark,WGEO=gMark,TRUNKG=new THREE.CylinderGeometry(.5,.5,1,8),CONEG=new THREE.ConeGeometry(.5,1,8),miParts={race:[]},rows=[],TQ=2.6,nq=14;
function bpush(key,geo,mat,x,y,z,ry=0,sx=1,sy=1,sz=1,rz=0,col=0){rows.push({key,x,y,z,ry,sx,sy,sz,rz,col});return rows.length-1;}
${fn('furLight')}
function buildArt(){${art}}buildArt();globalThis.rows=rows;`).runInContext(artCtx,{timeout:10000});
check('Actual race scenery builds with finite instance transforms',artCtx.rows.every(p=>['x','y','z','sx','sy','sz'].every(k=>Number.isFinite(p[k]))),{instances:artCtx.rows.length});
check('Street buildings lie outside expanded track',artCtx.rows.filter(r=>r.z>60&&r.z<280&&r.key==='miMark'&&r.sx===11.8).every(r=>Math.abs(r.x)-r.sx/2>26));
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
