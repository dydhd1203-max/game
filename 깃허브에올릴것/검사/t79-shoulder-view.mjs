// Shared source geometry; rendered pose cards and fixed 21-player before/after.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const source=path.resolve(process.argv[2]||GAME),candidate=process.argv[3]&&path.resolve(process.argv[3]),baseline=candidate&&fs.existsSync(candidate)?candidate:null;
const out='artifacts/race79/shoulder-art';fs.mkdirSync(out,{recursive:true});const results=[],errors=[];let browser;
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 for(const [label,file]of [...(baseline?[['before',baseline]]:[]),['after',source]]){
  const server=serve(20619,file);let page;
  try{
   page=await browser.newPage({viewport:{width:1200,height:820}});page.on('pageerror',e=>errors.push({label,message:e.message}));
   await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
   await page.addInitScript(()=>{let t=null,seed=197;const now=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);performance.now=()=>t===null?now():t;requestAnimationFrame=f=>t===null?raf(f):0;window.__freeze79=()=>t=100000;window.__time79=v=>t=v*1000;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);localStorage.setItem('sndOn','0');});
   await page.goto('http://127.0.0.1:20619/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
   await page.evaluate(()=>{const W=window;document.getElementById('iName').value='전직 견갑 검수';document.getElementById('bSolo').click();W.__introDone();W.__freeze79();W.__DBG().noRender=true;W.__DBG().noSim=true;W.__G.phase='day';W.__G.host=false;W.__G.paused=false;document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
    W.__actors79=Array.from({length:21},(_,i)=>({id:'armor'+i,x:20+(i%7-3)*1.10,y:W.__GY,z:-5+Math.floor(i/7)*1.45,ry:0,ph:i,wp:0,we:0,jb:i%3,jt:2,hat:0,gls:0,clo:0,mv:false,run:false,skin:i%5}));
    W.__armorCamera79=(mode='crowd',angle=0)=>{W.__held.visible=false;W.__setGunT(0);const c=W.__cam;c.fov=mode==='crowd'?58:45;c.updateProjectionMatrix();
     if(mode==='crowd'){c.position.set(20,W.__GY+4.3,-13);c.lookAt(20,W.__GY+.7,-3.5);}else{c.position.set(20-Math.sin(angle)*2.5,W.__GY+1.3,-5-Math.cos(angle)*2.5);c.lookAt(20,W.__GY+.73,-5);}c.updateMatrixWorld(true);W.__setSky(0);W.__updSky(0,false);W.__R.shadowMap.autoUpdate=true;W.__R.shadowMap.needsUpdate=true;};
    W.__shot79=(mode,angle)=>{if(mode==='crowd')W.__drawSheep(W.__actors79,100,21,()=>0x88aaaa,.7);W.__armorCamera79(mode,angle);W.__drawFrame();const R=W.__R;return {png:R.domElement.toDataURL('image/png'),calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},camera:W.__cam.position.toArray(),banks:Object.fromEntries(Object.entries(W.__P_jobParts()).filter(([,m])=>m.count).map(([k,m])=>[k,{n:m.count,cap:m.count_max,tris:(m.geometry.index?.count||m.geometry.attributes.position.count)/3}]))};};
    W.__drawSheep(W.__actors79,100,21,()=>0x88aaaa,.7);for(let i=0;i<3;i++)W.__shot79('crowd');
   });
   const crowd=await page.evaluate(()=>window.__shot79('crowd'));fs.writeFileSync(out+'/'+label+'-crowd.png',Buffer.from(crowd.png.split(',')[1],'base64'));delete crowd.png;results.push({label,crowd});
   if(label==='after'){
    const cards=[];
    for(const angle of [0,.72])for(let jt=1;jt<=2;jt++)for(let jb=0;jb<3;jb++){
     const r=await page.evaluate(({jb,jt,angle})=>{const W=window,s={id:'review',x:20,y:W.__GY,z:-5,ry:0,ph:0,wp:0,we:0,jb,jt,mv:false,hat:0,gls:0,clo:0};W.__drawSheep([s],101,21,()=>0x88aaaa,.7);return W.__shot79('detail',angle);},{jb,jt,angle});
     const name=['combat','build','resource'][jb]+'-'+jt+'-'+(angle?'angle':'front');fs.writeFileSync(out+'/'+name+'.png',Buffer.from(r.png.split(',')[1],'base64'));cards.push({name,label:['전투','건설','자원'][jb]+' '+jt+'차'+(angle?' · 45도':' · 정면'),url:r.png});
    }
    await page.evaluate(cards=>{const g=document.createElement('div');g.id='armorGallery79';g.style='position:fixed;inset:0;z-index:100000;background:#dce8e4;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:8px;padding:10px';for(const c of cards){const f=document.createElement('figure');f.style='margin:0;position:relative;overflow:hidden;border-radius:14px;background:#bdd6d6';const img=document.createElement('img');img.src=c.url;img.style='width:100%;height:100%;object-fit:cover';const cap=document.createElement('figcaption');cap.textContent=c.label;cap.style='position:absolute;left:10px;bottom:10px;background:#fff6de;color:#29404d;border-radius:10px;padding:7px 12px;font:600 17px sans-serif';f.append(img,cap);g.append(f);}document.body.append(g);},cards.filter(c=>c.name.endsWith('front')));await page.screenshot({path:out+'/jobs-front-gallery.png'});
    await page.evaluate(cards=>{document.querySelectorAll('#armorGallery79 img').forEach((m,i)=>m.src=cards[i].url);document.querySelectorAll('#armorGallery79 figcaption').forEach((m,i)=>m.textContent=cards[i].label);},cards.filter(c=>c.name.endsWith('angle')));await page.screenshot({path:out+'/jobs-angle-gallery.png'});await page.evaluate(()=>document.getElementById('armorGallery79').remove());
    const motions=[];
    for(const [name,pose]of [['run',{mv:true,run:true}],['aim',{wp:3}],['glide',{air:true,vy:-2,glide:true}]]){
     const r=await page.evaluate(({name,pose})=>{const W=window,arr=[0,1,2].map((jb,i)=>({id:name+i,x:20+(i-1)*1.7,y:W.__GY,z:-5,ry:0,ph:i,wp:0,we:0,jb,jt:2,hat:0,gls:0,clo:0,...pose}));
      for(let i=0;i<90;i++){const t=110+i/60;for(const s of arr){s.gp=t*6;if(s.mv){const g=W.__sheepGait(s,t);g.v=8;g.vx=0;g.vz=8;}}W.__time79(t);W.__drawSheep(arr,t,21,()=>0x88aaaa,.7);W.__wingFxPeople(arr,1/60,t);W.__wingFxTick(1/60);}
      W.__held.visible=false;W.__setGunT(0);W.__cam.fov=50;W.__cam.updateProjectionMatrix();W.__cam.position.set(20,W.__GY+1.75,-10.3);W.__cam.lookAt(20,W.__GY+.8,-5);W.__cam.updateMatrixWorld(true);W.__R.shadowMap.needsUpdate=true;W.__drawFrame();
      return {name,png:W.__R.domElement.toDataURL('image/png'),calls:W.__R.info.render.calls,tris:W.__R.info.render.triangles,anchors:arr.map(s=>Array.from(s.jsh79||[]))};},{name,pose});
     fs.writeFileSync(out+'/jobs-'+name+'.png',Buffer.from(r.png.split(',')[1],'base64'));delete r.png;motions.push(r);
    }results.find(r=>r.label==='after').motions=motions;
   }
  }finally{await page?.close();await new Promise(r=>server.close(r));}
 }
}finally{await browser?.close();}
const a=results.find(r=>r.label==='before')?.crowd,b=results.find(r=>r.label==='after').crowd,delta=a?{draws:b.calls-a.calls,triangles:b.triangles-a.triangles,textures:b.memory.textures-a.memory.textures}:null;
fs.writeFileSync(out+'/view.json',JSON.stringify({results,delta,comparison:baseline?'same21-before-after':'no-baseline-absolute-checks-only',errors},null,2));assert.deepEqual(errors,[]);
for(const side of ['R','L']){assert.equal(b.banks['armorRim'+side].n,21);assert.equal(b.banks['armorShell'+side].n,28);}
if(a){assert.deepEqual(a.camera,b.camera);assert.equal(delta.textures,0);assert.ok(delta.draws>0&&delta.draws<=6);assert.ok(delta.triangles>0&&delta.triangles<220000);}
for(const [key,x]of Object.entries(b.banks)){assert.ok(x.n<=x.cap);if(key.startsWith('armor'))assert.ok(x.tris<=300);}
console.log('PASS shoulder actual geometry gallery, run/aim/glide and 21-player capacities; '+(a?'measured before/after '+JSON.stringify(delta):'baseline not supplied; no comparative performance claim'));
