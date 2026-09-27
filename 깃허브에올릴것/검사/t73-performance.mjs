// Quality-preserving optimization check. SwiftShader CPU timings are NOT LG Gram FPS.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const server=serve(20574,process.argv[2]||GAME);let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error' && /shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});await p.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await p.addInitScript(()=>{const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null;
  window.__realNow=real;window.__freeze=()=>{time=real();};window.__advance=ms=>{time+=ms;window.__loop73();};
  performance.now=()=>time===null?real():time;requestAnimationFrame=f=>time===null?raf(f):0;localStorage.setItem('sndOn','0');});
 await p.goto('http://127.0.0.1:20574/?gfx=mid&diag=1',{timeout:240000,waitUntil:'load'});
 await p.waitForFunction(()=>window.__READY,null,{timeout:240000});
 await p.evaluate(()=>{const W=window;document.getElementById('iName').value='21명 검사';document.getElementById('bSolo').click();
  document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));W.__introDone();W.__freeze();W.__DBG().noRender=true;
  W.__G.phase='day';W.__G.t=100000;W.__camZoom(0);W.__XP.lv=35;W.__XP.job=0;W.__XP.jt=2;
  const P=W.__PL,G=W.__G;P.pitch=-0.1;
  for(let i=0;i<20;i++){const id='load'+i,x=P.x+(i%5-2)*2,z=P.z-4-Math.floor(i/5)*2;
   G.players.set(id,{uid:id,x,y:P.y,z,tx:x,ty:P.y,tz:z,ry:i*.3,g:i%5,n:'친구'+i,mv:true,hp:100,down:false,ph:i,wp:3,we:6,jb:i%3,jt:2});
   W.__pcMap.set(id,{g:i%5,wp:3,we:6,jb:i%3,jt:2});}
 });
 const result=await p.evaluate(()=>{const W=window,G=W.__G,K=W.__KIT,frames=[];
  for(let i=0;i<180;i++){for(const q of G.players.values()){q.x+=Math.sin(i*.1)*.01;q.z+=.02;q.tx=q.x;q.tz=q.z;}
   const t=W.__realNow();W.__advance(1000/60);if(i>=30)frames.push(W.__realNow()-t);}
  frames.sort((a,b)=>a-b);const overflow=[];W.__scene.traverse(m=>{if(m.isInstancedMesh&&m.count>m.instanceMatrix.count)overflow.push(m.name||m.id);});
  const gl=W.__R.getContext(),width=W.__R.domElement.width,height=W.__R.domElement.height,n=width*height*4,
    before=new Uint8Array(n),after=new Uint8Array(n),comparisons=[];
  for(const wi of [1,3,5,8,13,16,19]){
   K.ownW[wi]=true;K.enh[wi]=6;K.ammo=999;W.__equipW(wi);W.__setAim(true,true);W.__camZoom(0);
   for(let i=0;i<45;i++)W.__advance(1000/60);
   for(const pose of ['idle','reload']){
    if(pose==='reload'){K.mag[wi]=0;W.__rlStart(wi);for(let i=0;i<35;i++)W.__advance(1000/60);}
    // Reuse precisely the same glow texture and backdrop. Rendering the whole scene
    // again is not a control: coplanar environment edges can vary between draws.
    W.__drawFrame();const R=W.__R,old=R.getClearColor(new W.__THREE.Color()).clone();
    R.setClearColor(0x345678,1);R.clear();W.__perf73.glowScissor=false;W.__glowCompose73();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,before);
    R.clear();W.__glowCompose73();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,after);
    let control=0;for(let j=0;j<n;j++)if(before[j]!==after[j])control++;
    before.set(after);
    W.__perf73.glowScissor=true;R.clear();W.__glowCompose73();gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,after);R.setClearColor(old,1);
    let pixels=0,max=0;for(let j=0;j<n;j+=4){let d=0;for(let k=0;k<3;k++)d=Math.max(d,Math.abs(before[j+k]-after[j+k]));if(d)pixels++;max=Math.max(max,d);}
    comparisons.push({wi,pose,pixels,max,control,area:W.__perf73.glowArea});
   }
  }
  W.__drawFrame();window.__framePNG=W.__R.domElement.toDataURL('image/png');return {players:G.players.size+1,cpuMs:{p50:frames[75],p95:frames[Math.floor(frames.length*.95)]},overflow,comparisons,graphics:{...W.__GFX,width,height}};
 });
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(path.join('artifacts','t73-performance.json'),JSON.stringify(result,null,2));
 const png=await p.evaluate(()=>window.__framePNG);fs.writeFileSync('artifacts/t73-unchanged-graphics.png',Buffer.from(png.split(',')[1],'base64'));
 console.log(JSON.stringify(result,null,2));assert.equal(result.players,21);assert.deepEqual(result.overflow,[]);
 assert.ok(result.comparisons.every(r=>r.pixels===0),'Scissor must preserve every pixel');
 assert.ok(result.comparisons.some(r=>r.area<.9),'Must skip some empty pixels');
 assert.deepEqual(errors,[]);console.log('PASS: 21 avatars, bounded instance capacity, identical glow pixels, unchanged quality');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
