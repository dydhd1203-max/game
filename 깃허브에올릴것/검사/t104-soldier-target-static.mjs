// Actual host soldier loop and attack/effect functions, with deterministic state.
// Optional --baseline file compares the exact prior source; --bench adds Node CPU timings.
// This is not a browser, network, or real 21-device FPS measurement.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2);
const file=args[0]&&!args[0].startsWith('--')?args[0]:GAME,source=fs.readFileSync(file,'utf8');
const bi=args.indexOf('--baseline'),baseline=bi>=0?fs.readFileSync(args[bi+1],'utf8'):null;
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const extract=src=>new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(src);
const current=extract(source);
function loop(src){const start=src.indexOf('  // 병정',src.indexOf('function hostSim('));
 const a=src.indexOf('  qS();',start)+'  qS();'.length,b=src.indexOf("  qE('병정');",a);assert.ok(start>=0&&b>a);return src.slice(a,b);}
const optimizedLoop=loop(source);
const restoredLoop=optimizedLoop.replace(/\n  let soldierTargets;[^\n]*\n/,'\n')
 .replace(/    let candidates;\r?\n[\s\S]*?    const t = nearestWolf/, '    const t = nearestWolf')
 .replace('s.y : undefined, candidates);','s.y : undefined);');
const restoredNearest=current.fn('nearestWolf').replace(', candidates){','){')
 .replace('candidates || G.wolves','G.wolves').replace('!candidates && Math.hypot','Math.hypot');
assert.ok(!restoredLoop.includes('candidates')&&!restoredLoop.includes('soldierTargets'));
const oldLoop=baseline?loop(baseline):restoredLoop,oldNearest=baseline?extract(baseline).fn('nearestWolf'):restoredNearest;
const definitions=['SOL_DEF','DN_KIND','DN_MAX'].map(current.decl).join('\n');
const defsCtx=vm.createContext({});vm.runInContext(definitions+'\nglobalThis.data={SOL_DEF,DN_KIND,DN_MAX};',defsCtx);
const defs=JSON.parse(JSON.stringify(defsCtx.data));
function make(state,body,nearest,instrument=false){
 if(instrument){
  body=body.replace('Math.hypot(w.x-hx, w.z-hz)','rangeDist(w.x-hx, w.z-hz)');
  nearest=nearest.replace('Math.hypot(w.x-x, w.z-z)','rangeDist(w.x-x, w.z-z)');
 }
 const code=`const {G,STRU,GY,SHEEP_REACH_Y,Math,Map,SOL_DEF,DN_KIND,DN_MAX,PL,parts,PN,orbs,ON,dnums,window,performance,events}=S;
 let pI=0,oI=0,dnNext=0;const dnLayer={},critForce=-1;${current.decl('CRIT_P')}
 const rangeDist=(x,z)=>{S.counts.range++;return Math.hypot(x,z);};
 const blockedAt=(x,z,r)=>x-r<3&&x+r>3.15&&z>4&&z<10;
 const solidTop=(x,z)=>x===6&&z===6?GY+1:GY;
 ${['burst','popDmg','shootOrb','rollCrit','zombieHit79'].map(current.fn).join('\n')}
 ${nearest}
 return {step(dt){${body}},nearest:nearestWolf};`;
 return new Function('S',code)(state);
}
function fixture(seed,barracks=15,per=5,wolves=92,layout='spread'){
 const S={...defs,G:{soldiers:[],wolves:[],players:Array.from({length:21},(_,id)=>({id}))},STRU:new Map(),GY:9,SHEEP_REACH_Y:2.2,
  PL:{x:0,z:0},counts:{range:0,maps:0},events:[],clock:0,PN:64,ON:16};
 let rng=seed;S.Math=Object.create(Math);S.Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};S.seed=()=>rng;
 S.Map=class extends Map{constructor(){super();S.counts.maps++;}};
 S.performance={now:()=>S.clock};S.window={__sfxAt:(...a)=>S.events.push(a)};
 S.parts=Array.from({length:S.PN},()=>({t:0,c:{v:0,set(v){this.v=v;}}}));S.orbs=Array.from({length:S.ON},()=>({t:0}));
 S.dnums=Array.from({length:S.DN_MAX},()=>({el:{className:'',textContent:''}}));
 let id=0;for(let i=0;i<barracks;i++){const a=i*2.399963229728653,r=layout==='dense'?0:20+(i%3)*8;
  const h={id:'b'+i,x:Math.sin(a)*r-.5,z:Math.cos(a)*r-.5,sol:[]};S.STRU.set(h.id,h);
  for(let n=0;n<per;n++){S.G.soldiers.push({id:++id,bid:h.id,k:n%3,x:h.x+.5+(n-2)*.4,z:h.z+.5+.7,y:9,ry:0,hp:100,mx:100,atkT:0,hurt:0,dmg:17});h.sol.push(id);}}
 for(let i=0;i<wolves;i++){const a=i*2.399963229728653,r=layout==='dense'?1+(i%10)*.5:4+(i%15)*3;
  S.G.wolves.push({id:i+1,k:i%3,x:Math.sin(a)*r,z:Math.cos(a)*r,y:i%11===0?17:9,ly:i%11===0?1:0,ry:a,hp:i%19===0?0:100,mx:100,atkT:0,dmg:5});}
 return S;
}
const snap=S=>JSON.stringify({G:S.G,seed:S.seed(),events:S.events,parts:S.parts,orbs:S.orbs,dnums:S.dnums});
let snapshots=0;for(let seed=1;seed<=24;seed++){
 const A=fixture(seed,1+seed%15,1+seed%5,seed%2?92:33,seed%3?'spread':'dense'),B=fixture(seed,1+seed%15,1+seed%5,seed%2?92:33,seed%3?'spread':'dense');
 const before=make(A,oldLoop,oldNearest),after=make(B,optimizedLoop,current.fn('nearestWolf'));
 for(let tick=0;tick<100;tick++){
  for(const S of [A,B]){
   S.clock=tick*1000/60;
   // Every next tick must use fresh movement, membership, layer, and height state.
   if(tick%7===0)for(const w of S.G.wolves){w.x+=.11;w.z-=.17;w.y=tick%14?9:17;w.ly=tick%14?0:1;}
   if(tick===21)S.G.wolves.reverse();
   if(tick===31&&S.G.wolves.length)S.G.wolves.splice(0,1);
   if(tick===41)S.G.wolves.push({id:1000,k:0,x:2,z:2,y:9,ly:0,ry:0,hp:100,mx:100,atkT:0,dmg:5});
   if(tick===51&&S.G.soldiers.length)S.G.soldiers[0].hp=0;
   if(tick===61)S.STRU.delete('b0');
   if(tick===71)for(const h of S.STRU.values()){h.x+=4;h.z-=3;}
   if(tick===81)S.G.wolves.length=0;
  }
  const dt=[1/30,1/60,1/120][tick%3];before.step(dt);after.step(dt);
  assert.equal(snap(B),snap(A),`combat/random/effect parity seed=${seed} tick=${tick}`);snapshots++;
 }
}
// Exact boundary, ordered ties, dead targets, and melee-height exclusion.
const edgeCases=[
 [{x:22,z:0,y:9,ly:0},{x:22+1e-12,z:0,y:9,ly:0},{x:22-1e-12,z:0,y:9,ly:0}],
 [{x:-1,z:0,y:9,ly:0,hp:0},{x:1,z:0,y:9,ly:0,hp:100}],
 [{x:0,z:0,y:17,ly:1},{x:2,z:0,y:11.2000000001,ly:0},{x:3,z:0,y:11.2,ly:0}],
 [{x:0,z:0,y:0,ly:0},{x:0,z:0,y:undefined,ly:0},{x:1,z:0,y:9,ly:0}],
 []
];
for(const ws of edgeCases)for(const k of [0,1,2]){
 const A=fixture(7,1,5,0,'dense'),B=fixture(7,1,5,0,'dense');
 for(const S of [A,B]){S.G.wolves=ws.map((w,i)=>({id:i+1,k:0,hp:100,mx:100,atkT:0,dmg:5,ry:0,...w}));for(const s of S.G.soldiers){s.k=k;s.x=s.z=0;s.atkT=0;}}
 make(A,oldLoop,oldNearest).step(1/60);make(B,optimizedLoop,current.fn('nearestWolf')).step(1/60);assert.equal(snap(B),snap(A));
}
// The roster only enables sharing. Missing/short/stale/duplicate rosters must never alter combat.
for(const roster of [undefined,[],[1],[1,1],[-1,-2],[1,-1]]){
 const A=fixture(17,1,5,92,'dense'),B=fixture(17,1,5,92,'dense');
 for(const S of [A,B])S.STRU.get('b0').sol=roster?.slice();
 make(A,oldLoop,oldNearest).step(1/60);make(B,optimizedLoop,current.fn('nearestWolf')).step(1/60);assert.equal(snap(B),snap(A),'roster fallback '+JSON.stringify(roster));
 assert.equal(B.counts.maps,roster?.length>1?1:0);
}
// Ordinary nearestWolf calls (including client effects) retain the old uncached behavior.
const plain=fixture(8),O=make(plain,oldLoop,oldNearest),N=make(plain,optimizedLoop,current.fn('nearestWolf'));
for(let i=0;i<500;i++){const x=i%51-25,z=i%43-21,range=i%30;for(const y of [undefined,9,11.2,17])assert.equal(N.nearest(x,z,range,x+1,z-2,y),O.nearest(x,z,range,x+1,z-2,y));}
const work=[];for(const [b,p,w]of [[0,0,92],[1,1,92],[1,5,0],[15,1,92],[15,5,92]]){
 const A=fixture(2,b,p,w,'dense'),B=fixture(2,b,p,w,'dense');for(const S of [A,B])for(const q of S.G.wolves){q.y=9;q.ly=0;}
 make(A,oldLoop,oldNearest,true).step(0);make(B,optimizedLoop,current.fn('nearestWolf'),true).step(0);assert.equal(snap(A),snap(B));
 work.push({barracks:b,soldiers:b*p,wolves:w,before:{...A.counts},after:{...B.counts}});
 if(p<=1||!w)assert.equal(B.counts.maps,0);if(p>1&&w)assert.equal(B.counts.maps,1);
}
assert.equal(work.at(-1).before.range,6900);assert.equal(work.at(-1).after.range,1380);
console.log('PASS '+snapshots+' exact combat/random/effect snapshots; boundary/ties/dead/layer/roster cases; 2,000 uncached queries; fresh membership per tick');
console.log('work '+JSON.stringify(work));
if(args.includes('--bench')){
 const results=[];
 for(const [b,p,w,layout]of [[0,0,92,'spread'],[1,1,92,'spread'],[1,5,0,'spread'],[15,1,92,'spread'],[15,5,92,'spread'],[15,5,92,'dense']]){
  const samples=[];for(let round=0;round<5;round++){
   const A=fixture(3,b,p,w,layout),B=fixture(3,b,p,w,layout);for(const S of [A,B])for(const s of S.G.soldiers)s.atkT=1;
   const O=make(A,oldLoop,oldNearest),N=make(B,optimizedLoop,current.fn('nearestWolf'));
   const bench=api=>{for(let j=0;j<100;j++)api.step(0);const t=performance.now();for(let j=0;j<1000;j++)api.step(0);return (performance.now()-t)/1000;};
   let beforeMs,afterMs;if(round%2){afterMs=bench(N);beforeMs=bench(O);}else{beforeMs=bench(O);afterMs=bench(N);}samples.push({beforeMs,afterMs});
  }
  const median=k=>samples.map(s=>s[k]).sort((a,b)=>a-b)[2];results.push({barracks:b,soldiers:b*p,wolves:w,layout,beforeMs:median('beforeMs'),afterMs:median('afterMs')});
 }
 console.log('Node actual-soldier-loop CPU ms (not classroom FPS): '+JSON.stringify(results));
}
