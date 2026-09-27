import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const dir='artifacts/lobby78';fs.mkdirSync(dir,{recursive:true});
const server=serve(20579,process.argv[2]||GAME);let browser;const errors=[];
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/.test(m.text()))errors.push(m.text());});
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{
  const now=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let t=null;
  window.__freeze78=()=>{t=now();};window.__step78=ms=>{t+=ms;window.__loop73();};
  performance.now=()=>t===null?now():t;requestAnimationFrame=f=>t===null?raf(f):1;
  localStorage.setItem('sndOn','0');
 });
 await page.goto('http://127.0.0.1:20579/?gfx=mid',{timeout:240000,waitUntil:'load'});
 await page.waitForFunction(()=>window.__READY===true,null,{timeout:240000});
 await page.evaluate(()=>{document.getElementById('iName').value='선생님';document.getElementById('bSolo').click();window.__freeze78();});
 await page.waitForTimeout(100);
 const first=await page.evaluate(()=>({phase:__G.phase,t:__G.t,started:__G.started,children:__lobby78.state().group?.children.length}));
 assert.equal(first.phase,'lobby');assert.equal(first.t,0);
 const mechanics=await page.evaluate(()=>{
  const G=__G,P=__PL,A=__lobby78;__DBG().noRender=true;
  for(let i=0;i<20;i++)G.players.set('student'+i,{uid:'student'+i,n:'친구'+(i+1),g:i%5,x:(i%7-3)*1.4,y:A.state().y,z:A.state().z+1+Math.floor(i/7)*1.8,ry:0,ph:i,mv:false,hp:100,hat:i%3,gls:0,clo:i%4,skin:0});
  for(let i=0;i<600;i++)__step78(100);const waited={phase:G.phase,t:G.t,day:G.day,zombies:G.wolves.length};
  const p0={x:P.x,z:P.z};__KEY.d=true;for(let i=0;i<30;i++)__step78(16.67);__KEY.d=false;const moved=Math.hypot(P.x-p0.x,P.z-p0.z);
  document.getElementById('lobbyDress78').click();const changed=A.dress('hat',3),packet=A.pack();document.querySelector('[data-close=popLobby78]').click();
  G.host=false;const guestStart=A.start();G.host=true;
  return {waited,moved,changed,hat:packet.ht,guestStart,graphics:__GFX,roomMeshes:A.state().group.children.length};
 });
 assert.deepEqual(mechanics.waited,{phase:'lobby',t:0,day:1,zombies:0});assert.ok(mechanics.moved>1);assert.ok(mechanics.changed);assert.equal(mechanics.hat,3);assert.equal(mechanics.guestStart,false);
 await page.evaluate(()=>{__PL.x=0;__PL.z=__lobby78.state().z+7;__PL.y=__lobby78.state().y;__PL.yaw=0;__PL.pitch=-.16;__DBG().noRender=false;for(let i=0;i<2;i++)__step78(16.67);});
 await page.screenshot({path:dir+'/lobby-21.png'});
 await page.evaluate(()=>document.getElementById('lobbyDress78').click());await page.screenshot({path:dir+'/dress.png'});
 await page.evaluate(()=>{document.querySelector('[data-close=popLobby78]').click();__G.set.goalDay=18;document.getElementById('lobbyStart78').click();});
 for(const [target,name] of [[.8,'approach'],[2.5,'crystal'],[4.1,'goal']]){
  await page.evaluate(t=>{__DBG().noRender=true;while(__lobby78.state().story<t)__step78(100);__DBG().noRender=false;__step78(1);},target);
  await page.screenshot({path:dir+'/intro-'+name+'.png'});
 }
 const ending=await page.evaluate(()=>{const A=__lobby78;__DBG().noRender=true;while(__G.phase==='intro')__step78(10);return {phase:__G.phase,t:__G.t,day:__G.day,goal:document.getElementById('storyTitle78').textContent,hidden:document.getElementById('story78').hidden,roomVisible:A.state().group.visible,blockedDress:A.dress('hat',0),zombies:__G.wolves.length};});
 assert.equal(ending.phase,'day');assert.ok(ending.t>10);assert.equal(ending.goal,'18일 밤까지 함께 버텨라!');assert.equal(ending.hidden,true);assert.equal(ending.roomVisible,false);assert.equal(ending.blockedDress,false);assert.equal(ending.zombies,0);
 const result={first,mechanics,ending,errors};fs.writeFileSync(dir+'/view.json',JSON.stringify(result,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
