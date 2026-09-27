// Actual-source zombie material/pose/intro regression. Browser appearance is a separate check.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||path.resolve(here,'../../클로드/index.html'),'utf8');
const baseline=JSON.parse(fs.readFileSync(path.join(here,'zombie76-art-baseline.json'),'utf8'));
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
const harness=fs.readFileSync(path.join(here,'t54-zombie-static.mjs'),'utf8');
const load=harness.slice(harness.indexOf('function scanEnd('),harness.indexOf('const results=[];'));
const actual=s=>new Function('source','THREE','vm',load+'\nreturn {A,context,fn,declaration};')(s,THREE,vm),N=actual(source);
const checks=[],check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
const actor=(k,i=3)=>({k,id:i,ph:.31+i*.03,x:0,z:0,y:0,ry:0,mv:true,shT:false,atkT:0,hurt:0,hp:40,mx:40});
const col=mesh=>Array.from(mesh.instanceColor.array.slice(0,3));
let counts=true,finite=true,paler=0,bodyTwist=0,unchangedWorld=true;
for(let k=0;k<13;k++){
 const a=actor(k),b=baseline.cases[k];for(let f=0;f<90;f++){a.z=(f+1)*.035;N.A.drawWolves([a],4+f/60,1/60);}
 for(const name of Object.keys(N.A.meshes)){const x=N.A.meshes[name],y=b.counts[name];counts&&=x.count===y[0]&&x.count_max===y[1];finite&&=Array.from(x.instanceMatrix.array.slice(0,x.count*16)).every(Number.isFinite);}
 const nc=col(N.A.meshes.W_head),bc=b.headColor;if(nc.reduce((x,y)=>x+y)>bc.reduce((x,y)=>x+y)*1.15)paler++;
 const m=new THREE.Matrix4();N.A.meshes.W_body.getMatrixAt(0,m);bodyTwist=Math.max(bodyTwist,...m.elements.map((v,i)=>Math.abs(v-b.bodyMatrix[i])));
 unchangedWorld&&=a.x===b.world[0]&&a.y===b.world[1]&&a.z===b.world[2]&&a.hp===b.world[3];
}
check('All 13 types keep the same geometry instances and capacities',counts);
check('Updated poses are finite and never change world position or health',finite&&unchangedWorld);
check('Ordinary zombies have visibly paler skin while bosses retain their palettes',paler>=8,{palerTypes:paler});
check('Existing skeleton gives a measurable shoulder twist without extra meshes',bodyTwist>.025,{maximumMatrixDelta:bodyTwist});
check('Night outfits and all combat definitions are unchanged',JSON.stringify(N.A.ZOMBIE_NIGHT)===JSON.stringify(baseline.ZOMBIE_NIGHT)&&JSON.stringify(N.A.WOLF_T)===JSON.stringify(baseline.WOLF_T));
const sh={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'};N.A.ZSKIN.onBeforeCompile(sh);
check('Skin adds no sampler, texture lookup, animated wound uniform or extra noise calls',!(/sampler|texture2D|uTime/.test(sh.fragmentShader))&&(sh.fragmentShader.match(/zN\(/g)||[]).length===baseline.noiseCalls);
check('Wounds keep per-instance stable seeds and trouser/white-flash exclusion',sh.vertexShader.includes('step(0.0, instanceColor.r)')&&sh.vertexShader.includes('min(ic.r, min(ic.g, ic.b))')&&sh.fragmentShader.includes('mix(c0, c, vZW)'));
vm.runInContext('globalThis.GMOUTH=[[0,-45]];globalThis.wolfY=w=>.12*Math.sin(w.z*.1);globalThis.story=storyWolves78;',N.context);
const first=N.context.story(0),refs=[...first],positions=first.map(w=>[w.x,w.z]);let safe=true,forward=true,reused=true;
for(let frame=1;frame<=300;frame++){
 const actors=N.context.story(frame/60);N.A.drawWolves(actors,frame/60,1/60);reused&&=actors===first&&actors.every((w,i)=>w===refs[i]);
 for(let i=0;i<9;i++){const w=actors[i];safe&&=w.hp===1&&w.mx===1&&w.hurt===0&&w.atkT===0&&w.shT===false&&Number.isFinite(w.y);forward&&=w.z>positions[i][1];positions[i]=[w.x,w.z];}
}
check('Five-second story uses nine pooled actors moving toward gate zero on real floor',first.length===9&&safe&&forward&&reused);
check('Story actors never register real enemies, rewards, attacks or particles',!(/G\.wolves|spawnWolf|burst|hp\s*[+\-]=|xp|reward/.test(N.fn('storyWolves78'))));
const restart=N.context.story(0);check('Replaying story resets animation state and deterministic starting positions',restart.length===9&&restart[0]!==refs[0]&&restart[0].z===-49.6&&restart[0].gp===0);
const out=path.resolve(here,'../../artifacts/zombie78');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'static.json'),JSON.stringify(checks,null,2));
assert.ok(checks.every(c=>c.pass),`${checks.filter(c=>c.pass).length}/${checks.length} zombie art checks`);
