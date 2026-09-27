// One hidden browser/context. Capture the actual shared wardrobe models, not concept art.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const dir='artifacts/cosmetic79';fs.mkdirSync(dir,{recursive:true});
const server=serve(20609,process.argv[2]||GAME);let browser;const errors=[],results={};
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{const now=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let t=null;window.__freeze79=()=>t=now();window.__step79=ms=>{t+=ms;__loop73();};performance.now=()=>t===null?now():t;requestAnimationFrame=f=>t===null?raf(f):1;localStorage.setItem('sndOn','0');});
 await page.goto('http://127.0.0.1:20609/?gfx=mid',{timeout:240000,waitUntil:'load'});await page.waitForFunction(()=>window.__READY===true,null,{timeout:240000});
 await page.evaluate(()=>{__freeze79();document.getElementById('iName').value='별빛';document.getElementById('bSolo').click();__step79(16.67);document.getElementById('lobbyDress78').click();__step79(16.67);});
 results.selected=await page.evaluate(()=>{
  const checks=[];
  for(const [kind,ids,picker,key]of [['hat',[14,15,16],'hatPick','ht'],['gls',[9,10,11],'glsPick','gl'],['clo',[11,12,13],'cloPick','cl']])for(const id of ids){
   const index=__cosmetics79.options[kind].indexOf(id);document.querySelectorAll('#'+picker+' button')[index].click();__step79(16.67);
   const packet=__lobby78.pack(),P=__pvw();checks.push({kind,id,packet:packet[key],visible:P.deco.filter(m=>m.visible).length});
  }return checks;
 });for(const c of results.selected){assert.equal(c.packet,c.id);assert.ok(c.visible>0);}
 await page.screenshot({path:dir+'/wardrobe-expanded.png'});
 results.catalog=await page.evaluate(()=>{
  const C=__cosmetics79,P=__pvw(),shots=[],take=(label,d)=>{__avatarPreview.set(P,d);P.grp.rotation.y=.12;P.r.render(P.sc,P.cam);shots.push({label,url:P.r.domElement.toDataURL('image/png')});};
  for(let i=0;i<3;i++)take(['별빛 베레모 · 세일러','아기 오리 · 딸기 후디','데이지 핀 · 오리 멜빵'][i],{g:2,hat:14+i,gls:9+i,clo:11+i,skin:0});
  for(const [hat,clo,label]of [[9,2,'크림 고양이 · 민트 파자마'],[4,6,'토끼 귀 · 라벤더 잠옷'],[6,4,'곰돌이 모자 · 파자마'],[3,10,'딸기 리본 · 원피스'],[8,8,'봄꽃 화관 · 하늘별 잠옷'],[12,5,'나비핀 · 복숭아 나비넥타이']])take(label,{g:2,hat,gls:8,clo,skin:0});
  const g=document.createElement('div');g.id='qaGallery79';g.style='position:fixed;inset:0;z-index:100000;background:#eef2ef;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px;overflow:auto';
  for(const shot of shots){const c=document.createElement('figure');c.style='margin:0;text-align:center;background:linear-gradient(#e0edf4,#f8efd8);border-radius:20px;display:flex;align-items:center;justify-content:center;flex-direction:column';const img=document.createElement('img');img.src=shot.url;img.style='height:238px;width:174px;object-fit:contain';const cap=document.createElement('figcaption');cap.style='font:600 17px sans-serif;color:#233f4d';cap.textContent=shot.label;c.append(img,cap);g.append(c);}document.body.append(g);
  return {parts:Object.fromEntries(Object.entries(C.parts).map(([k,m])=>[k,{capacity:m.count_max,triangles:(m.geometry.index?.count||m.geometry.attributes.position.count)/3}])),catalog:shots.map(s=>s.label)};
 });await page.screenshot({path:dir+'/cosmetic-gallery.png'});
 await page.evaluate(()=>document.getElementById('qaGallery79').remove());
 results.shared=await page.evaluate(()=>{
  const C=__cosmetics79,P=__pvw(),checks=[];
  for(const [name,table,mode]of [['hat',C.hats,1],['gls',C.faces,1],['clo',C.clothes,0]])for(const id of C.options[name].filter(Boolean)){
   const d={g:0,[name==='gls'?'gls':name]:id};__avatarPreview.set(P,d);
   const rows=C.rows(table[id],mode),group=__ICO_DEF()[name+id].make();
   checks.push({name,id,preview:rows.every((row,i)=>P.deco[i].geometry===(C.geo[row.shape]||__Pdeco().geometry)),icon:rows.filter(r=>r.shape).every(r=>group.children.some(m=>m.geometry===C.geo[r.shape]))});
   group.traverse(m=>{if(m.isMesh)m.material.dispose();});
  }return checks;
 });assert.ok(results.shared.every(c=>c.preview&&c.icon),'game/preview/icon share every cosmetic geometry');
 results.crowds=await page.evaluate(()=>{
  const C=__cosmetics79,out=[];for(const [hat,gls,clo]of [[8,10,13],[14,9,11],[15,10,12],[16,11,13]]){
   const actors=Array.from({length:21},(_,i)=>({id:'c'+i,x:i%7,y:9,z:Math.floor(i/7),ry:.4,ph:i,wp:0,we:0,jb:-1,jt:0,hat,gls,clo,skin:i%5,mv:true,run:true}));__drawSheep(actors,10,21,()=>0xffffff,.7);
   out.push({hat,gls,clo,banks:Object.fromEntries(Object.entries(C.parts).map(([key,m])=>[key,{count:m.count,cap:m.count_max,finite:m.instanceMatrix.array.every(Number.isFinite),expected:21*[C.hats[hat],C.faces[gls],C.clothes[clo]].flat().filter(r=>r[7]===key).length}]))});
  }__drawSheep([],10,21,()=>0xffffff,.7);return {sets:out,empty:Object.values(C.parts).every(m=>m.count===0&&!m.visible)};
 });for(const c of results.crowds.sets)for(const b of Object.values(c.banks)){assert.equal(b.count,b.expected);assert.ok(b.count<=b.cap&&b.finite);}assert.ok(results.crowds.empty);
 await page.evaluate(()=>{
  const P=__pvw(),g=document.createElement('div');g.id='qaJobs79';g.style='position:fixed;inset:0;z-index:100000;background:#dce4e9;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px';
  for(let jt=1;jt<=2;jt++)for(let job=0;job<3;job++){__avatarPreview.set(P,{g:0,hat:14,gls:0,clo:12,skin:0,job,jt});P.grp.rotation.y=-.20;__pvwSpin(P,0);P.r.render(P.sc,P.cam);const fig=document.createElement('figure');fig.style='margin:0;text-align:center;border-radius:20px;background:linear-gradient(#d9e9ef,#faf0d9)';const img=document.createElement('img');img.src=P.r.domElement.toDataURL('image/png');img.style='height:360px;object-fit:contain';const label=document.createElement('figcaption');label.style='font:600 18px sans-serif;color:#29404d';label.textContent=['전투','건설','자원'][job]+' · '+jt+'차 전직';fig.append(img,label);g.append(fig);}document.body.append(g);
 });await page.screenshot({path:dir+'/jobs-gallery.png'});
 results.errors=errors;assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));console.log('PASS cosmetics79: nine selectable/networked IDs, shared game-preview-icon geometry,21-player bank capacities, actual cosmetic/job images');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
