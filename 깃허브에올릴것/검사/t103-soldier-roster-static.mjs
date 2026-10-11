// Execute the real hostSim tower/barracks block, comparing the former live-ID scan.
// Synthetic state only: no browser, network, input, or claim about classroom FPS.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {GAME} from './gamefile.mjs';
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
function end(st){let depth=0,quote='',comment='',escape=false,started=false;
 for(let i=st;i<source.length;i++){const c=source[i],n=source[i+1];
  if(comment==='line'){if(c==='\n')comment='';continue;}if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
  if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote='';continue;}
  if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
  if('([{'.includes(c)){depth++;started=true;}else if(')]}'.includes(c))depth--;
  if(c===';'&&depth===0&&started)return i+1;
 }throw Error('Unterminated declaration');}
const dec=n=>{const m=new RegExp('(?:const|let)\\s+'+n+'\\s*=').exec(source);assert.ok(m,n);return source.slice(m.index,end(m.index));};
const ctx=vm.createContext({});vm.runInContext(['BUILD','SOL_COMP','SOL_DEF'].map(dec).join('\n')+'\nglobalThis.data={BUILD,SOL_COMP,SOL_DEF};',ctx);
const defs=JSON.parse(JSON.stringify(ctx.data));
const begin=source.indexOf('  qS();',source.indexOf('// 타워 공격 (피해는 호스트만)'))+'  qS();'.length;
const finish=source.indexOf("  qE('타워');",begin);assert.ok(begin>10&&finish>begin);
const current=source.slice(begin,finish);
// Only restore the former roster lookup; all spawn, cadence and effects code is actual current source.
const reference=current.replace(/\n  let soldierIds;[^\n]*\n/,'\n')
 .replace(/      if\(!soldierIds\)\{ soldierIds = new Set\(\); for\(const s of G\.soldiers\) soldierIds\.add\(s\.id\); \}\r?\n/,'')
 .replace('o.sol = o.sol.filter(id => soldierIds.has(id));','o.sol = o.sol.filter(id => G.soldiers.some(s=>s.id===id));')
 .replace('o.sol.push(s.id); soldierIds.add(s.id);','o.sol.push(s.id);');
assert.ok(!reference.includes('soldierIds'),'Reference must contain only the original nested scan');
assert.notEqual(reference,current,'Optimized source must be exercised');
function compile(block){return new Function('S','dt',`const {G,STRU,BUILD,SOL_COMP,SOL_DEF,BAL,GY,Math,window,burst,towerAttackTick,solDmg,bs,Set}=S;let wid=S.wid;\n${block}\nS.wid=wid;`);}
const original=compile(reference),optimized=compile(current);
function fixture(seed,barracks=10,filled=true){
 const S={...defs,G:{day:12,soldiers:[],players:Array.from({length:21},(_,id)=>({id,x:id%5,z:Math.floor(id/5)}))},STRU:new Map(),GY:9,BAL:{soldierHP:52,soldierHPGrow:7},wid:10000,events:[],sets:0};
 S.Set=class extends Set{constructor(){super();S.sets++;}};
 let r=seed;S.Math=Object.create(Math);S.Math.random=()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296;};S.seed=()=>r;
 S.bs=(t,k,lv)=>Array.isArray(S.BUILD[t][k])?S.BUILD[t][k][Math.min(S.BUILD[t][k].length-1,(lv||1)-1)]:S.BUILD[t][k];
 S.solDmg=(k,lv)=>(12.6+S.G.day*1.36)*S.SOL_DEF[k].dmg*S.bs('barr','sbuff',lv);
 S.burst=(...a)=>S.events.push(['burst',...a]);S.window={__sfxAt:(...a)=>S.events.push(['sound',...a])};S.towerAttackTick=(o,dt)=>{o.cd-=dt;};
 let id=1;for(let i=0;i<barracks;i++){const o={id:'b'+i,t:'barr',lv:7,x:i*4,z:i*3,g:i%5,cd:seed%2?1:-1,sol:[]};S.STRU.set(o.id,o);
  if(filled)for(const k of S.SOL_COMP[o.lv-1]){S.G.soldiers.push({id,bid:o.id,k});o.sol.push(id++);}}
 return S;
}
const snap=S=>JSON.stringify({G:S.G,STRU:[...S.STRU],wid:S.wid,seed:S.seed(),events:S.events});
let cases=0;for(let seed=1;seed<=32;seed++){
 const A=fixture(seed,1+seed%30,seed%3!==0),B=fixture(seed,1+seed%30,seed%3!==0);
 for(const S of [A,B]){let n=0;for(const o of S.STRU.values()){o.lv=1+(seed+n++)%7;o.sol.push(-1);if(o.sol[0])o.sol.push(o.sol[0]);}}
 for(let tick=0;tick<120;tick++){
  if(tick%11===0)for(const S of [A,B]){if(S.G.soldiers.length)S.G.soldiers.splice((seed+tick)%S.G.soldiers.length,1);}
  if(tick%31===0)for(const S of [A,B]){const o=[...S.STRU.values()][tick%S.STRU.size];o.lv=1+(o.lv%7);}
  original(A,[1/30,1/60,1/120][tick%3]);optimized(B,[1/30,1/60,1/120][tick%3]);
  assert.equal(snap(B),snap(A),`seed=${seed},tick=${tick}`);cases++;
 }
}
// A later barracks sees soldiers spawned by an earlier barracks during this very tick.
const spawnA=fixture(2,2,false),spawnB=fixture(2,2,false);
for(const S of [spawnA,spawnB])S.STRU.get('b1').sol=[10000,10000,-99];
original(spawnA,1/60);optimized(spawnB,1/60);assert.equal(snap(spawnB),snap(spawnA));
assert.deepEqual(spawnB.STRU.get('b1').sol,[10000,10000,10001]);
// No barracks: avoid even constructing the membership Set, with soldiers or towers present.
const none=fixture(4,0);none.G.soldiers.push({id:42,bid:'removed',k:0});none.STRU.set('tower',{id:'tower',t:'arrow',cd:1});
optimized(none,1/60);assert.equal(none.sets,0);
const many=fixture(2,30);optimized(many,1/60);assert.equal(many.sets,1);
console.log(`PASS: ${cases} actual-source snapshots match, same-tick spawn visibility, stale/duplicate roster order, zero setup without barracks, one shared Set with 30 barracks`);
