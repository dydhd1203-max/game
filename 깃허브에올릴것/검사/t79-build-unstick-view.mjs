// Building creation -> actual updPlayer regression. Hidden browser, no OS input.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const dir='artifacts/build79';fs.mkdirSync(dir,{recursive:true});
const server=serve(20599,process.argv[2]||GAME);let browser;const errors=[];
try{
 browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1100,height:720}});page.on('pageerror',e=>errors.push(e.message));
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('sndOn','0');const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Set();let stop=false;requestAnimationFrame=f=>{if(stop)return 0;const id=raf(t=>{pending.delete(id);f(t);});pending.add(id);return id;};window.__stopBuild79=()=>{stop=true;for(const id of pending)cancel(id);pending.clear();};});
 await page.goto('http://127.0.0.1:20599/?gfx=mid',{timeout:240000,waitUntil:'load'});await page.waitForFunction(()=>__READY===true,null,{timeout:240000});
 await page.evaluate(()=>{document.getElementById('iName').value='건설 검사';document.getElementById('bSolo').click();__introDone();__stopBuild79();__G.phase='day';__G.paused=false;__DBG().noLogic=true;__clear();__buildApi.clearBuildCoop();__KEY.w=__KEY.a=__KEY.s=__KEY.d=__KEY.shift=false;__setAim(false);__kbReset();__G.players.clear();});
 const results=await page.evaluate(()=>{
  const W=window,P=__PL,G=__G,Y=__GY,R=P.R,out=[];let seq=0,spot=null;
  outer:for(let x=-38;x<38;x++)for(let z=-38;z<38;z++){
   if(__buildApi.canPlaceBuilding('ice',x,z))continue;let safe=true;
   for(let dx=-2;dx<=5&&safe;dx++)for(let dz=-2;dz<=5;dz++)if(Math.abs(__groundUnder(x+dx+.5,z+dz+.5,R,Y,true)-Y)>.01||__solidHit(x+dx+.5,z+dz+.5,Y)||__ceilingOver(x+dx+.5,z+dz+.5,R,Y)<Y+1.4){safe=false;break;}
   if(safe){spot={x,z};break outer;}
  }
  if(!spot)throw Error('No actual flat unobstructed construction area');const {x,z}=spot;
  const add=(t,dx=0,dz=0)=>{const id='unstick79_'+(++seq),hp=__bs(t,'hp',1);const o={id,t,x:x+dx,z:z+dz,lv:1,hp,mx:hp,g:0,n:'검사',by:__uid,born:Date.now(),cd:2,sol:[]};__addStru(o);return o;};
  const place=(dx,dz,y=Y)=>{for(const k of Object.keys(__KEY))__KEY[k]=false;__kbReset();Object.assign(P,{x:x+dx,z:z+dz,y,vx:0,vz:0,vy:0,ground:true,down:false,landT:0,airT:0,flipT:99,jumps:0,yaw:.4,pitch:-.15,_px:x+dx,_pz:z+dz});G.phase='day';G.mini=null;};
  const measure=()=>({x:P.x,z:P.z,y:P.y,floor:__groundUnder(P.x,P.z,R,P.y,true),solid:__solidHit(P.x,P.z,P.y),ceiling:__ceilingOver(P.x,P.z,R,P.y)});
  for(const t of ['wwall','swall','ice','arrow','barr']){
   const size=__BUILD[t].size,lo=size===3?-1:0,hi=size===3?2:size;
   for(const [where,dx,dz,maxDist] of [['center',(lo+hi)/2,(lo+hi)/2,(hi-lo)/2+R+.025],['side',lo-.18,(lo+hi)/2,R+.025-.18],['corner',lo-.08,lo-.08,R+.025-.08]]){
    __clear();place(dx,dz);const before=measure();add(t);const trapped=measure();__updPlayer(1/120);const after=measure();const distance=Math.hypot(after.x-before.x,after.z-before.z);
    out.push({name:t+' '+where,pass:trapped.floor>Y+.7&&after.floor<=after.y+.68&&!after.solid&&after.ceiling>=after.y+1.4&&distance>0&&distance<=maxDist+.002&&Math.abs(after.y-Y)<.02,distance,maxDist,before,trapped,after});
   }
  }
  __clear();place(1.5,1.5);for(let dx=0;dx<3;dx++)for(let dz=0;dz<3;dz++)add('wwall',dx,dz);const clusterStart=measure();__updPlayer(1/120);const clusterEnd=measure();
  out.push({name:'nine adjoining completed walls',pass:clusterEnd.floor<=Y+.68&&!clusterEnd.solid&&Math.hypot(clusterEnd.x-clusterStart.x,clusterEnd.z-clusterStart.z)<=1.5+R+.026,clusterStart,clusterEnd});
  __clear();place(-.18,.5);add('wwall');const solids=__SOLID();solids.push({x:x-.5,z:z+.5,r:.50,top:Y+3});__updPlayer(1/120);const detour=measure();solids.pop();
  out.push({name:'nearest side blocked by a real solid',pass:detour.floor<=Y+.68&&!detour.solid&&Math.hypot(detour.x-(x-.5),detour.z-(z+.5))>=.5,detour});
  for(const t of ['wwall','ice','barr']){__clear();const o=add(t),top=Y+__bs(t,'hi',1),size=__BUILD[t].size;place(size===3?.5:size/2,size===3?.5:size/2,top);const before=measure();__updPlayer(1/120);const after=measure();out.push({name:t+' roof remains valid',pass:Math.hypot(after.x-before.x,after.z-before.z)<1e-7&&Math.abs(after.y-top)<1e-5,before,after});}
  __clear();place(.5,.5);add('wwall');for(const phase of ['lobby','intro','mini']){G.phase=phase;const before={x:P.x,z:P.z};const moved=__buildUnstick79();out.push({name:phase+' skips village construction recovery',pass:moved===false&&P.x===before.x&&P.z===before.z});}G.phase='day';
  // A network update creates exactly the same collision map used by local completion.
  __clear();place(.5,.5);G.host=false;__buildApi.applyNetworkBuilding('remote79',{t:'wwall',x,z,lv:1,hp:__bs('wwall','hp',1),g:0,n:'친구',by:'friend',born:Date.now()});__updPlayer(1/120);const guest=measure();out.push({name:'guest receives a building over their current feet',pass:guest.floor<=Y+.68&&!guest.solid,guest});G.host=true;
  // Continue walking in the newly freed direction, rather than only teleporting one frame.
  const cx=x+.5,cz=z+.5,dx=P.x-cx,dz=P.z-cz;P.yaw=Math.atan2(-dx,-dz);__KEY.w=true;const before=measure();for(let i=0;i<60;i++)__updPlayer(1/120);__KEY.w=false;const after=measure();out.push({name:'movement continues after overlap recovery',pass:Math.hypot(after.x-before.x,after.z-before.z)>1&&!after.solid,before,after});
  return {spot,cases:out};
 });
 for(const r of results.cases)console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.pass?'':' '+JSON.stringify(r)));
 results.errors=errors;fs.writeFileSync(dir+'/unstick-results.json',JSON.stringify(results,null,2));assert.deepEqual(errors,[]);assert.ok(results.cases.every(c=>c.pass));console.log(`${results.cases.length}/${results.cases.length} actual building overlap cases passed.`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
