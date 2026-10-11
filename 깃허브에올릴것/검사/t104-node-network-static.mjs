// Execute the real resource-node snapshot callback and occupancy builder.
// Optional: --baseline previous.html --bench. Node timings are isolated CPU
// diagnostics, not Firebase load, browser render time or classroom FPS.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {GAME} from './gamefile.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const baselineAt=process.argv.indexOf('--baseline');
const baseline=baselineAt<0?null:fs.readFileSync(process.argv[baselineAt+1],'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
function extract(source){
  const {fn,end}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,end};')(source);
  const marker="net.child('nd').on('value', s=>";
  const at=source.indexOf(marker);
  assert.notEqual(at,-1,'resource-node value listener exists');
  const start=source.indexOf('{',at+marker.length);
  return {body:source.slice(start+1,end(start,true)-1),refresh:fn('refreshNodeCells'),respawn:fn('nodeRespawn')};
}
function fixture(src){
  const {body,refresh,respawn}=extract(src);
  // Adjacent footprints deliberately overlap, so a dead node must not clear
  // cells that another live node still occupies.
  const nodes=Array.from({length:110},(_,i)=>({type:['tree','rock','gold'][i%3],x:i%11*2,z:Math.floor(i/11)*2,alive:true,hp:10,max:10,hs:[i*2,i*2+1],shown:2}));
  const counts={refresh:0,adds:0},visual=[];
  const cells=new Set(),add=cells.add.bind(cells);
  cells.add=value=>{counts.adds++;return add(value);};
  const bset=(h,v)=>visual.push([h,v]);
  const run=new Function('NODES','nodeCells','bset','counts',`
    const net=null;
    ${refresh.replace('nodeCells.clear();','counts.refresh++;nodeCells.clear();')}
    ${respawn}
    refreshNodeCells();
    return {receive:s=>{${body}},refresh:refreshNodeCells,respawn:nodeRespawn};
  `)(nodes,cells,bset,counts);
  counts.refresh=counts.adds=0;
  const F={nodes,cells,counts,visual,...run,
    snapshot(){return {nodes:structuredClone(nodes),cells:[...cells],visual:structuredClone(visual)};},
    apply(value){run.receive({val:()=>value});},
    localDeath(i){const n=nodes[i];n.hp=0;n.alive=false;for(const h of n.hs)bset(h,false);n.shown=0;run.refresh();},
    resetCounts(){counts.refresh=counts.adds=0;},
  };
  return F;
}
function expectedCells(nodes){
  const out=new Set();
  for(const n of nodes)if(n.alive)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)out.add(`${n.x+dx},${n.z+dz}`);
  return [...out];
}
function checkCells(F){assert.deepEqual([...F.cells],expectedCells(F.nodes));}
const checks=[];
function check(name,run){run();checks.push(name);console.log('PASS '+name);}

check('Missing, empty and unknown-node snapshots preserve occupancy without rebuilding',()=>{
  const F=fixture(source),initial=F.snapshot();
  for(const value of [null,undefined,{}, {999:0}, {999:10}])F.apply(value);
  assert.deepEqual(F.snapshot(),initial);assert.deepEqual(F.counts,{refresh:0,adds:0});
});
check('Nonlethal hits and duplicate snapshots update hp without visual or occupancy work',()=>{
  const F=fixture(source),initial=[...F.cells];
  for(let hp=9;hp>0;hp--){F.apply({0:hp});F.apply({0:hp});assert.equal(F.nodes[0].hp,hp);}
  assert.equal(F.nodes[0].alive,true);assert.deepEqual([...F.cells],initial);
  assert.deepEqual(F.visual,[]);assert.deepEqual(F.counts,{refresh:0,adds:0});
});
check('Death and revival rebuild once per snapshot and preserve overlapping live footprints',()=>{
  const F=fixture(source);
  F.apply({0:0,1:0,2:5});assert.equal(F.counts.refresh,1);checkCells(F);
  assert.equal(F.cells.has('3,0'),true);assert.equal(F.cells.has('-1,0'),false);
  assert.deepEqual(F.visual,[[0,false],[1,false],[2,false],[3,false]]);
  assert.deepEqual(F.nodes.slice(0,3).map(n=>[n.hp,n.alive,n.shown]),[[0,false,0],[0,false,0],[5,true,2]]);
  F.apply({0:0,1:0,2:4});assert.equal(F.counts.refresh,1);checkCells(F);
  F.apply({0:10,1:0,2:4});assert.equal(F.counts.refresh,2);checkCells(F);
  assert.deepEqual(F.visual.slice(4),[[0,true],[1,true]]);
});
check('Optimistic local death and duplicate server echo need no second occupancy rebuild',()=>{
  const F=fixture(source);F.localDeath(0);F.resetCounts();const before=F.snapshot();
  F.apply({0:0});F.apply({0:0});assert.deepEqual(F.snapshot(),before);
  assert.deepEqual(F.counts,{refresh:0,adds:0});checkCells(F);
});
check('Initial join applies dead nodes and actual day respawn survives an empty reset snapshot',()=>{
  const F=fixture(source);F.apply({0:0,4:0,7:3,999:0});checkCells(F);
  assert.equal(F.nodes[0].alive,false);assert.equal(F.nodes[4].alive,false);
  assert.equal(F.nodes[7].hp,3);assert.equal(F.counts.refresh,1);
  // Removing /nd alone never revives nodes; the existing phase reset owns it.
  const dead=F.snapshot();F.apply({});assert.deepEqual(F.snapshot(),dead);
  F.respawn();checkCells(F);assert.ok(F.nodes.every(n=>n.alive&&n.hp===n.max&&n.shown===n.hs.length));
  F.resetCounts();const reset=F.snapshot();F.apply(null);F.apply({});assert.deepEqual(F.snapshot(),reset);
  assert.deepEqual(F.counts,{refresh:0,adds:0});
});
check('10000 received hp snapshots with unchanged occupancy allocate no cell keys',()=>{
  const F=fixture(source),value=Object.fromEntries(F.nodes.map((n,i)=>[i,n.hp]));
  for(let i=0;i<10000;i++){value[i%110]=7+(i&1);F.apply(value);}
  checkCells(F);assert.deepEqual(F.counts,{refresh:0,adds:0});assert.deepEqual(F.visual,[]);
});

if(baseline)check('Actual baseline/current callbacks keep node, cell order and bset sequence identical',()=>{
  const A=fixture(baseline),B=fixture(source);let count=0;
  const parity=()=>assert.deepEqual(B.snapshot(),A.snapshot(),'snapshot '+count);
  const apply=value=>{A.apply(value);B.apply(value);count++;parity();};
  apply(null);apply({});apply({999:0});apply({999:10});
  A.localDeath(0);B.localDeath(0);parity();apply({0:0});apply({0:0});
  A.respawn();B.respawn();parity();apply(null);
  let value={};
  for(let cycle=0;cycle<3;cycle++){
    for(let hp=9;hp>=0;hp--)for(let i=0;i<110;i++){value[i]=hp;apply(value);}
    for(let i=0;i<110;i++){value[i]=10;apply(value);}
    apply({});
  }
  assert.ok(B.counts.refresh<A.counts.refresh);assert.ok(B.counts.adds<A.counts.adds);
  console.log('  exact parity snapshots: '+count+'; baseline '+JSON.stringify(A.counts)+'; current '+JSON.stringify(B.counts));
});

if(process.argv.includes('--bench')){
  assert.ok(baseline,'--bench requires --baseline previous.html');
  function bench(src){
    const F=fixture(src),value=Object.fromEntries(F.nodes.map((n,i)=>[i,7]));
    const start=performance.now();
    for(let i=0;i<10000;i++){value[i%110]=7+(i&1);F.apply(value);}
    return {ms:Math.round((performance.now()-start)*100)/100,...F.counts};
  }
  bench(baseline);bench(source);
  const trials=Array.from({length:5},(_,i)=>i%2?{current:bench(source),baseline:bench(baseline)}:{baseline:bench(baseline),current:bench(source)});
  const median=key=>trials.map(t=>t[key].ms).sort((a,b)=>a-b)[2];
  console.log('  isolated Node CPU / 10000 unchanged-occupancy snapshots: '+JSON.stringify({baselineMedianMs:median('baseline'),currentMedianMs:median('current'),trials}));
}
console.log(`${checks.length}/${checks.length}`);
