// Grass changes must not change pond waves, cloud masks or per-frame geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import crypto from 'node:crypto';
import { GAME } from './gamefile.mjs';
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const baselineFile=process.argv[3];
const extract=(s,n)=>{const at=s.indexOf('function '+n+'('),to=s.indexOf('\n}',at);assert.ok(at>=0&&to>at,n);return s.slice(at,to+2);};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function bake(s){
  const canvases=[];
  const document={createElement(){const cv={width:0,height:0,data:null,getContext(){return {
    createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData:img=>{cv.data=new Uint8ClampedArray(img.data);},
    getImageData:()=>({data:new Uint8ClampedArray(cv.data)})};}};canvases.push(cv);return cv;}};
  const THREE={CanvasTexture:class{constructor(image){this.image=image;this.userData={};}},RepeatWrapping:1000,NoColorSpace:'',LinearMipmapLinearFilter:1008,LinearFilter:1006};
  const context=vm.createContext({document,THREE,console});
  const rnd=/function rnd\(s\)\{[^\n]+/.exec(s)[0];
  vm.runInContext([rnd,extract(s,'mkGrainTex'),extract(s,'grGrainGB'),'globalThis.tex=mkGrainTex("grass");grGrainGB(tex);'].join('\n'),context);
  const tex=context.tex,channels=Array.from({length:4},(_,c)=>Uint8Array.from({length:128*128},(_,i)=>tex.image.data[i*4+c]));
  return {tex,channels,hashes:channels.map(hash)};
}
const result=bake(source),repeat=bake(source),G=result.channels[1];
assert.deepEqual(result.hashes,repeat.hashes,'The grass tile is deterministic');
assert.equal(result.hashes[0],'c8c708fffd730a7a732a52536eb7b498e200533e3e5bfe44161c07c00cc1a077','Preserve the 76 shared pond-wave channel');
assert.equal(result.hashes[2],'eebd0d96dde49b7aeb16dddfca15cc07dd3b2eeced45ee6b1c0e907c44ffce7b','Preserve the 76 cloud/moisture channel');
assert.equal(result.tex.image.width,128);assert.equal(result.tex.image.height,128);
assert.equal(result.tex.minFilter,1008);assert.equal(result.tex.magFilter,1006);assert.equal(result.tex.anisotropy,4);
assert.ok(result.channels[3].every(v=>v===255),'Opaque pixels avoid premultiplication changes to the wave channel');
const mean=G.reduce((a,b)=>a+b,0)/G.length,sd=Math.sqrt(G.reduce((a,b)=>a+(b-mean)**2,0)/G.length);
assert.ok(mean>115&&mean<145&&sd>10&&sd<38,'Baked leaf shading remains varied without darkening the whole field');
const ground=/const GR_GROUND_GLSL = `([\s\S]*?)`;/.exec(source)[1];
const taps=(ground.match(/texture2D\(/g)||[]).length;
assert.equal(taps,2,'Ground keeps its own two texture reads; 81차 reuses the shared grain read (ggv) instead of sampling the same texel again');
assert.ok(ground.includes('smoothstep(12.0, 30.0, gdist)'),'Fine leaves fade continuously by 30 m');
const tip=/float tip = ([^;]+);/.exec(ground)[1];
assert.ok(!/uTime|sin\(|cos\(/.test(tip),'Leaf detail never animates in screen space');
assert.equal((source.match(/grGrainGB\(GRAIN\.grass\)/g)||[]).length,1,'Texture baking remains a single world-build operation');
assert.ok(!/Math\.random|new THREE\.(Mesh|Texture|DataTexture)/.test(extract(source,'grGrainGB')),'Baking adds no geometry, texture or random state');
let preserved;
if(baselineFile){const old=bake(fs.readFileSync(baselineFile,'utf8'));
  preserved=[0,2,3].every(c=>result.hashes[c]===old.hashes[c]);assert.ok(preserved,'R waves, B cloud/moisture and alpha must be byte-identical to the previous build');
  assert.notEqual(result.hashes[1],old.hashes[1],'The leaf texture must actually change');
  assert.ok(G.every((v,i)=>(v/255>=.83)===(old.channels[1][i]/255>=.83)),'Keep the existing soil-pebble pixels in place');
}
const summary={hashes:result.hashes,mean,sd,taps,size:128,preservedBaselineChannels:preserved??'Pass a baseline HTML to compare R/B/alpha'};
fs.mkdirSync('artifacts/grass77',{recursive:true});fs.writeFileSync('artifacts/grass77/static.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));console.log('PASS: deterministic opaque grass detail, preserved sampler/size/fade budget');
