import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const THREE=await import(pathToFileURL(path.join(here,'node_modules/three/build/three.module.js')).href);
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
const ctx=vm.createContext({THREE});
vm.runInContext(`${fn('chamferBox')}\n${decl('WGEO')}\n${decl('withAMt')}\n${fn('geoMerge')}\n${decl('M4')}\n${decl('segM')}\n${decl('CYL6')}\n${decl('lathe')}\n${decl('SHIELDG')}\n${decl('VOUSG')}\n${['marketCanopy79','marketWood79','marketBasket79','forgeCraft79'].map(fn).join('\n')}
const DIRS=[{a:-Math.PI/2},{a:0},{a:Math.PI/2}];${['SHOP_A','SHOP_X','VET_OFF','VET_X','FORGE_A','FORGE_X'].map(decl).join('\n')}
globalThis.A={geos:{shopWood:marketWood79(),shopCanvas:marketCanopy79(),vetWood:marketWood79(true),vetCanvas:marketCanopy79(true),basket:marketBasket79(),...forgeCraft79()},positions:[['shop',SHOP_X,SHOP_Z,2.8],['vet',VET_X,VET_Z,2.4],['forge',FORGE_X,FORGE_Z,2.8]]};`,ctx);
const summary=[];
for(const [key,g]of Object.entries(ctx.A.geos)){
 const p=g.attributes.position;assert.ok([...p.array,...g.attributes.normal.array,...g.attributes.color.array].every(Number.isFinite),key+' finite geometry');
 let reach=0;for(let i=0;i<p.count;i++)reach=Math.max(reach,Math.hypot(p.getX(i),p.getZ(i)));
 const limit=key.startsWith('vet')?2.4:key==='basket'?1:2.8;assert.ok(reach<limit,key+' stays inside its reserved building footprint');
 if(/Canvas|stone|roof/.test(key))assert.ok(g.attributes.aMt,'non-mountain baked stone/canvas has aMt0');
 summary.push({key,triangles:(g.index?.count||p.count)/3,reach});
}
const farms=[[0,-46],[46,0],[13,46],[-13,46],[-46,0]].map(([x,z])=>{const r=14/Math.hypot(x,z);return[x*r,z*r];});
const clearance=ctx.A.positions.map(([name,x,z,r])=>{const nearest=Math.min(...farms.map(([fx,fz])=>Math.hypot(x-fx,z-fz)-4.6-r));assert.ok(nearest>0,name+' reservation does not overlap a fully grown farm');return {name,x,z,nearest};});
assert.ok(Math.hypot(ctx.A.positions[0][1]-ctx.A.positions[1][1],ctx.A.positions[0][2]-ctx.A.positions[1][2])>=4.1-1e-9,'two stalls have a visible gap');
// Actual vault triangles must leave a deep firebox opening; its back wall is solid.
const g=ctx.A.geos.stone,mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
const hits=new THREE.Raycaster(new THREE.Vector3(.9,.43,.3),new THREE.Vector3(0,0,-1),0,3).intersectObject(mesh);assert.ok(hits.length&&hits[0].point.z<-.9,'arched opening is a real recess');
assert.ok(fn('buildForge').includes('1.50, 0.80, 0.42')&&fn('villageLife').includes('FY + 3.79'),'anvil and chimney smoke anchors preserved');
const out='artifacts/merchant79';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/market-geometry.json',JSON.stringify({summary,clearance,fireboxFrontHit:hits[0].point.z},null,2));
console.log('PASS real curved canopies and hollow basket, finite baked shells, recessed forge, existing anchors and expanded-farm clearance '+JSON.stringify({summary,clearance}));
