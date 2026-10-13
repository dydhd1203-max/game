// Real cloud generation/update with Three.js r160. This checks Float32 matrices
// and motion, not browser pixels or classroom FPS. Optional --baseline / --bench.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const baselineAt=process.argv.indexOf('--baseline');
const baseline=baselineAt<0?null:fs.readFileSync(process.argv[baselineAt+1],'utf8');
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
function extract(source){return new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);}
// Preserve the game's optimized Float32 copy when measuring its old compose path.
const imStart=source.indexOf('{ const IM = THREE.InstancedMesh.prototype;');
assert.notEqual(imStart,-1);
new Function('THREE',source.slice(imStart,source.indexOf('/* ═══════════════════════ 상수',imStart)))(THREE);
function fixture(src){
  const {fn,decl}=extract(src);
  return new Function('THREE',`
    const scene=new THREE.Scene(),clouds=[],CLOUD_U={},window={__READY:true};
    let cloudMesh,cloudMat,racing=false; const raceOn=()=>racing;
    ${decl('CLOUD_N')}
    ${src.includes('const _cv2=')?decl('_cv2'):''}
    ${fn('rnd')}
    ${fn('updClouds')}
    ${fn('buildClouds')}
    buildClouds();
    return {clouds,mesh:cloudMesh,update:updClouds,race(v){racing=v;},ready(v){window.__READY=v;}};
  `)(THREE);
}
const checks=[];
function check(name,run){run();checks.push(name);console.log('PASS '+name);}
function expected(F,racing){
  const p=new THREE.Vector3(),s=new THREE.Vector3(),q=new THREE.Quaternion(),m=new THREE.Matrix4();
  const out=new Float32Array(F.mesh.instanceMatrix.array.length);let i=0;
  for(const c of F.clouds)for(const puff of c.puffs){
    const high=racing&&c.y>90;
    p.set(c.x+puff.dx,c.y+puff.dy+(high?32:0),c.z+puff.dz);
    s.set(puff.sx,puff.sy*(high?2.5:1),puff.sz);
    m.compose(p,q,s).toArray(out,i++*16);
  }
  assert.equal(Buffer.compare(Buffer.from(F.mesh.instanceMatrix.array.buffer),Buffer.from(out.buffer)),0);
}
check('Actual generation keeps all 158 cloud puffs and exact initial affine matrices',()=>{
  const F=fixture(source);assert.equal(F.mesh.count,158);assert.equal(F.clouds.length,23);expected(F,false);
});
check('Cloud motion, wrap and race height changes match identity-quaternion compose bit for bit',()=>{
  const F=fixture(source);let frames=0;
  for(const dt of [0,1/120,1/60,1/30,.05])for(const ready of [false,true])for(const race of [false,true,false]){
    F.ready(ready);F.race(race);F.clouds[0].x=159.9999;
    for(let i=0;i<50;i++){
      const next=F.clouds.map(c=>{const x=c.x+dt*(c.sp||.55);return x>160?-160:x;});
      F.update(dt);assert.deepEqual(F.clouds.map(c=>c.x),next);expected(F,ready&&race);frames++;
    }
  }
  console.log('  exact Float32 matrix frames: '+frames);
});
check('Zero speed retains the existing fallback and race threshold remains strictly above 90',()=>{
  const F=fixture(source);F.race(true);F.clouds[0].sp=0;F.clouds[0].y=90;F.clouds[1].y=90.0001;
  const x=F.clouds[0].x;F.update(.05);assert.equal(F.clouds[0].x,x+.05*.55);expected(F,true);
});
if(baseline)check('Actual baseline and current updates preserve every buffer byte and cloud state',()=>{
  const A=fixture(baseline),B=fixture(source);
  for(const dt of [0,1/120,1/60,1/30,.05])for(const race of [false,true,false]){
    A.race(race);B.race(race);A.clouds[0].x=B.clouds[0].x=159.9999;
    for(let i=0;i<100;i++){
      A.update(dt);B.update(dt);assert.deepEqual(A.clouds,B.clouds);
      assert.equal(Buffer.compare(Buffer.from(A.mesh.instanceMatrix.array.buffer),Buffer.from(B.mesh.instanceMatrix.array.buffer)),0);
      assert.equal(A.mesh.instanceMatrix.version,B.mesh.instanceMatrix.version);
    }
  }
});
if(process.argv.includes('--bench')){
  assert.ok(baseline,'--bench requires --baseline previous.html');
  function bench(src){
    const F=fixture(src),start=performance.now();
    for(let i=0;i<10000;i++){F.race((i%103)<30);F.update(1/60);}
    return (performance.now()-start)/10000;
  }
  bench(baseline);bench(source);
  const trials=Array.from({length:5},(_,i)=>i%2?{current:bench(source),baseline:bench(baseline)}:{baseline:bench(baseline),current:bench(source)});
  const median=key=>trials.map(t=>t[key]).sort((a,b)=>a-b)[2];
  console.log('  isolated Node CPU ms/frame, 10000 frames per trial: '+JSON.stringify({baselineMedian:median('baseline'),currentMedian:median('current'),trials}));
}
console.log(`${checks.length}/${checks.length}`);
