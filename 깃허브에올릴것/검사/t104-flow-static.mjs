// Actual world/navigation data. The previous neighbor scan is the byte-level oracle.
// --baseline file uses the exact earlier buildFlow; --bench reports Node CPU only.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fixture} from './zombie79-fixture.mjs';
import {GAME} from './gamefile.mjs';
const args=process.argv.slice(2),file=args[0]&&!args[0].startsWith('--')?args[0]:GAME;
const {A,ctx,fn,decl,source}=fixture(file),bi=args.indexOf('--baseline');
let before;
if(bi>=0){const baseline=fs.readFileSync(args[bi+1],'utf8');
 const parser=fs.readFileSync(new URL('./t54-race-static.mjs',import.meta.url),'utf8');
 before=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return fn("buildFlow");')(baseline);
}else{
 before=fn('buildFlow').replace('  if(fEdgeRev104 !== flowTerrainRev104) buildFlowEdges104();\n','').replace('  if(fEdgeRev104 !== flowTerrainRev104) buildFlowEdges104();\r\n','');
 const start=before.indexOf('    const mask = fEdges104[i];'),finish=before.indexOf('      if(fDone[j]) continue;',start);
 assert.ok(start>=0&&finish>start);
 before=before.slice(0,start)+`    const x = (i%WS)-HW, z = ((i/WS)|0)-HW;
    for(let k=0;k<8;k++){
      const dx=NBX[k], dz=NBZ[k], nx=x+dx, nz=z+dz;
      if(!walkable(nx,nz)) continue;
      if(dx&&dz && (!walkable(x+dx,z)||!walkable(x,z+dz))) continue;
      const j = gi(nx,nz);
`+before.slice(finish);
}
assert.ok(!before.includes('fEdges104')&&!before.includes('buildFlowEdges104'));
vm.runInContext([decl('BUILD'),fn('footprint'),before.replace('function buildFlow(', 'function oldFlow104('),`
 let calls104=0;const realWalk104=walkable;
 walkable=function(x,z){calls104++;return realWalk104(x,z);};
 globalThis.T={old:oldFlow104,now:buildFlow,edges:fEdges104,
   calls:()=>calls104,reset:()=>{calls104=0;},revision:()=>[flowTerrainRev104,fEdgeRev104],
   terrain:genTerrain,gate:gateLayout,castle:castleLayout,
   changeTerrain(x,z,h){terrH[gi(x,z)]=h;flowTerrainRev104++;},
   changeCastle(x,z,k){CASTLE[gi(x,z)]=k;flowTerrainRev104++;}};
`].join('\n'),ctx);
const T=ctx.T,bytes=x=>Buffer.from(x.buffer,x.byteOffset,x.byteLength),checks=[];
function parity(label){
 T.old();const cost=Buffer.from(bytes(A.fCost)),next=Buffer.from(bytes(A.fNext));
 T.now();assert.deepEqual(bytes(A.fCost),cost,label+' fCost');assert.deepEqual(bytes(A.fNext),next,label+' fNext');checks.push(label);
}
parity('Empty actual world');
let seed=1987;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let scenario=0;scenario<24;scenario++){
 A.STRU.clear();for(let i=0;i<50;i++)A.STRU.set(i,{id:i,t:i%3?'swall':'barr',x:Math.floor(random()*80-40),z:Math.floor(random()*80-40),hp:Math.floor(random()*1500)});
 parity('Build/health layout '+scenario);
 for(const o of A.STRU.values())o.hp=Math.max(0,o.hp-100);parity('Damage '+scenario);
 A.STRU.delete(scenario);parity('Destroyed structure '+scenario);
}
// Rebuilding dynamic costs never rebakes static neighbors.
T.reset();T.now();assert.equal(T.calls(),0);const rev=T.revision();
for(const o of A.STRU.values())o.hp+=200;T.now();assert.equal(T.calls(),0);assert.deepEqual(T.revision(),rev);
T.reset();T.old();const oldCalls=T.calls();assert.ok(oldCalls>100000);
T.reset();T.now();const cachedCalls=T.calls();assert.equal(cachedCalls,0);
// Real regeneration entry points invalidate a previously populated cache.
for(const [label,rebuild]of [['genTerrain',T.terrain],['gateLayout',T.gate],['castleLayout',T.castle]]){
 const beforeRev=T.revision()[0];rebuild();assert.ok(T.revision()[0]>beforeRev);assert.notEqual(T.revision()[0],T.revision()[1]);
 T.reset();T.now();assert.ok(T.calls()>100000,label+' rebakes');assert.equal(T.revision()[0],T.revision()[1]);parity(label);
}
T.changeTerrain(8,8,A.GY+7);parity('Changed terrain cell');T.changeTerrain(8,8,A.GY);parity('Restored terrain cell');
T.changeCastle(9,9,A.CK.SOLID);parity('Changed castle cell');T.changeCastle(9,9,0);parity('Restored castle cell');
// Startup order: real terrain and castle functions run before flow arrays exist in the module.
const between=(a,b)=>{const x=source.indexOf(a),y=source.indexOf(b,x+1);assert.ok(x>=0&&y>x);return source.slice(x,y);};
const init=vm.createContext({Math,console});
vm.runInContext([
 between('const FIELD_R = 78;','/* ═══ 33차 세계 마무리'),
 between('const CHAM = 0.60;','/* ═══════════════════════ 텍스처 아틀라스'),
 'const location={search:""},PL={x:0,z:0,y:9},G={phase:"night",t:180},STRU=new Map();',
 between('const terrH = new Int16Array','function genTerrain('),fn('genTerrain'),'genTerrain();',
 between('const GATE_T = 51;','/* ═══════ 성문 그림'),'gateLayout();castleLayout();',fn('solidTop'),
 between('const N2 = WS*WS;','/* ═══════════════════════ 몹 렌더러'),
 'buildFlow();globalThis.startup104={revision:flowTerrainRev104,cached:fEdgeRev104,maskBytes:fEdges104.byteLength};'
].join('\n'),init,{timeout:10000});
assert.deepEqual(JSON.parse(JSON.stringify(init.startup104)),{revision:3,cached:3,maskBytes:A.WS*A.WS});
console.log('PASS '+checks.length+' actual-map fCost/fNext byte comparisons; damaged/destroyed buildings; terrain/gate/castle invalidation; real startup ordering');
console.log('work '+JSON.stringify({maskBytes:T.edges.byteLength,oldWalkableCalls:oldCalls,cachedWalkableCalls:cachedCalls,reachable:A.fCost.filter(Number.isFinite).length}));
if(args.includes('--bench')){
 const runs=[],bench=f=>{for(let i=0;i<3;i++)f();const t=performance.now();for(let i=0;i<15;i++)f();return(performance.now()-t)/15;};
 for(let i=0;i<5;i++){let beforeMs,afterMs;if(i%2){afterMs=bench(T.now);beforeMs=bench(T.old);}else{beforeMs=bench(T.old);afterMs=bench(T.now);}runs.push({beforeMs,afterMs});}
 const median=k=>runs.map(r=>r[k]).sort((a,b)=>a-b)[2];
 console.log('Node actual-flow CPU ms (VM timings, not classroom FPS): '+JSON.stringify({beforeMs:median('beforeMs'),afterMs:median('afterMs'),runs}));
}
