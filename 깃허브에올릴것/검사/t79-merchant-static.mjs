import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')));
const extract=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',extract.slice(extract.indexOf('function end('),extract.indexOf('const results=[];'))+';return {fn,decl};')(source);
const c=vm.createContext({THREE});vm.runInContext(decl('lathe')+'\n'+fn('roundBox')+'\n'+decl('NPC_GEO79')+'\n'+fn('npcHuman79')+'\nglobalThis.A={geo:NPC_GEO79,make:npcHuman79};',c);
const {geo,make}=c.A,counts={},summary=[];let triangles=0;
for(const [name,g] of Object.entries(geo)){
 assert.ok([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite),name+' finite');
 g.computeBoundingBox();assert.ok(g.boundingBox.min.y>=-.501&&g.boundingBox.max.y<=.501,name+' centered unit geometry');
}
for(const kind of ['shop','smith','vet']){
 const parts=make(kind);assert.ok(parts.length>40);assert.ok(parts.every(p=>geo[p[9]]&&p.slice(1,8).every(Number.isFinite)&&p.slice(4,7).every(v=>v>0)));
 assert.ok(parts.some(p=>p[0]===1&&p[9]==='head'),'sculpted head');assert.ok(parts.some(p=>p[0]===2)&&parts.some(p=>p[0]===3),'articulated arms');
 for(const p of parts){counts[p[9]]=(counts[p[9]]||0)+1;triangles+=(geo[p[9]].index?.count||geo[p[9]].attributes.position.count)/3;}
 if(kind==='smith'){
  const p=parts.find(p=>p[0]===2&&p[9]==='trim'),angle=-.95,ax=.50,ay=1.18;
  const x=ax+(p[1]-ax)*Math.cos(angle)-(p[2]-ay)*Math.sin(angle),y=ay+(p[1]-ax)*Math.sin(angle)+(p[2]-ay)*Math.cos(angle);
  const bottom=y-Math.abs(Math.sin(angle))*p[4]/2-Math.abs(Math.cos(angle))*p[5]/2;
  assert.ok(Math.abs(x-1.46)<.06&&Math.abs(bottom-1.20)<.05,'hammer striking face still lands on the actual anvil');
 }
 summary.push({kind,parts:parts.length});
}
assert.ok(Object.values(counts).every(n=>n<192),'fixed instance capacities');assert.ok(triangles<45000,'three detailed people have a bounded triangle budget');
assert.equal(Object.keys(geo).length,6,'six shared geometry banks, no per-person materials/lights');
const out='artifacts/merchant79';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/geometry.json',JSON.stringify({summary,counts,triangles},null,2));
console.log('PASS sculpted merchants: finite six shared geometries, articulated people, real hammer/anvil alignment and bounded budget '+JSON.stringify({summary,triangles}));
