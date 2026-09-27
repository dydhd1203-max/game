// Real bMake/bJoin handlers and their actual Firebase callbacks, in two hidden pages.
// The database is entirely in memory. No request reaches a live Firebase project.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';

const input=process.argv[2]||GAME,out=path.resolve(process.argv[3]||'artifacts/lobby78-network');
fs.mkdirSync(out,{recursive:true});
const results=[],errors=[],clients=new Map(),clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail??'')}`);};
class MemoryFirebase {
  tree={};listeners=[];queue=[];disconnects=new Map();writes=[];reads=[];delivered={};
  parts(p){return p.split('/').filter(Boolean);}
  read(p,tree=this.tree){let v=tree;for(const k of this.parts(p)){v=v?.[k];if(v==null)return null;}return clone(v);}
  put(p,value){const keys=this.parts(p);let v=this.tree;for(const k of keys.slice(0,-1))v=v[k]??={};if(value==null)delete v[keys.at(-1)];else v[keys.at(-1)]=clone(value);}
  event(l,key,value){this.queue.push({client:l.client,id:l.id,event:l.event,key,value:clone(value)});}
  changed(before){for(const l of this.listeners){const a=this.read(l.path,before),b=this.read(l.path);if(JSON.stringify(a)===JSON.stringify(b))continue;
    if(l.event==='value')this.event(l,this.parts(l.path).at(-1),b);
    else for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){
      const av=a?.[key]??null,bv=b?.[key]??null,event=av==null&&bv!=null?'child_added':av!=null&&bv==null?'child_removed':JSON.stringify(av)!==JSON.stringify(bv)?'child_changed':null;
      if(event===l.event)this.event(l,key,event==='child_removed'?av:bv);
    }
  }}
  command(client,op){const {kind,path:p}=op;
    if(kind==='once'){this.reads.push({client,path:p});return this.read(p);}
    if(kind==='on'){
      const l={client,path:p,id:op.id,event:op.event};this.listeners.push(l);
      if(l.event==='value')this.event(l,this.parts(p).at(-1),this.read(p));
      else if(l.event==='child_added')for(const [key,value] of Object.entries(this.read(p)||{}))this.event(l,key,value);
      return true;
    }
    if(kind==='off'){this.listeners=this.listeners.filter(l=>!(l.client===client&&l.path===p&&(!op.event||l.event===op.event)&&(!op.id||l.id===op.id)));return true;}
    if(kind==='disconnect'){let list=this.disconnects.get(client);if(!list)this.disconnects.set(client,list=[]);list.push(p);return true;}
    if(kind==='set'||kind==='update'||kind==='remove'){
      const before=clone(this.tree);if(kind==='update')for(const [k,v] of Object.entries(op.value||{}))this.put(p+'/'+k,v);else this.put(p,kind==='remove'?null:op.value);
      this.writes.push({client,kind,path:p,phase:op.value?.ph});this.changed(before);return true;
    }
    throw Error('Unsupported mock Firebase method: '+kind);
  }
  disconnect(client){this.listeners=this.listeners.filter(l=>l.client!==client);this.queue=this.queue.filter(e=>e.client!==client);
    for(const p of this.disconnects.get(client)||[])this.command(client,{kind:'remove',path:p});this.disconnects.delete(client);
  }
}
const bus=new MemoryFirebase(),server=serve(0,input);let browser,watchdog;
async function drain(){let quiet=0;
  for(let round=0;round<60;round++){
    for(const c of clients.values())await c.page.evaluate(()=>window.__settleDb78());
    const queue=bus.queue.splice(0);if(!queue.length){if(++quiet===2)return;continue;}quiet=0;
    for(const c of clients.values()){
      const events=queue.filter(e=>e.client===c.id);if(!events.length)continue;
      for(const e of events)bus.delivered[e.event]=(bus.delivered[e.event]||0)+1;
      await c.page.evaluate(events=>window.__deliverDb78(events),events);
    }
  }
  throw Error('Mock database listener queue did not settle');
}
async function makeClient(id,uid){
  const context=await browser.newContext({viewport:{width:960,height:640}}),page=await context.newPage(),c={id,uid,context,page};clients.set(id,c);
  page.on('pageerror',e=>errors.push({client:id,error:e.message}));
  await context.route(/(?:firebaseio\.com|firebasedatabase\.app|www\.gstatic\.com\/firebasejs)/,route=>route.abort());
  await context.route(/fonts\.(?:googleapis|gstatic)\.com/,route=>route.abort());
  await context.exposeBinding('__memoryDb78',(_,op)=>bus.command(id,op));
  await context.addInitScript(({uid})=>{
    localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid',uid);
    const callbacks=new Map(),pending=new Set();let seq=0;
    const send=op=>{const p=window.__memoryDb78(op);pending.add(p);p.finally(()=>pending.delete(p));return p;};
    const snapshot=(key,value)=>({key,val:()=>value,exists:()=>value!=null});
    class Ref {
      constructor(path){this.path=path.replace(/^\/+|\/+$/g,'');this.key=this.path.split('/').at(-1);}
      child(p){return new Ref(this.path+'/'+p);}
      set(value){return send({kind:'set',path:this.path,value});}
      update(value){return send({kind:'update',path:this.path,value});}
      remove(){return send({kind:'remove',path:this.path});}
      once(event,callback){if(event!=='value')throw Error('Unexpected once '+event);return send({kind:'once',path:this.path}).then(value=>{const s=snapshot(this.key,value);callback?.(s);return s;});}
      on(event,callback){const id=++seq;callbacks.set(id,callback);send({kind:'on',path:this.path,event,id});return callback;}
      off(event,callback){for(const [id,cb] of callbacks)if(!callback||callback===cb){callbacks.delete(id);send({kind:'off',path:this.path,event,id});}}
      onDisconnect(){return {remove:()=>send({kind:'disconnect',path:this.path})};}
    }
    window.firebase={initializeApp:()=>({}),database:()=>({ref:path=>new Ref(path)})};
    window.__deliverDb78=events=>{for(const e of events)callbacks.get(e.id)?.(snapshot(e.key,e.value));};
    window.__settleDb78=async()=>{for(let i=0;i<30;i++){if(pending.size)await Promise.all([...pending]);await Promise.resolve();if(!pending.size)return;}throw Error('Unsettled Firebase promises');};
    window.__dialogs78=[];window.prompt=message=>{window.__dialogs78.push(message);return String(window.TEACHER_CODE);};window.alert=message=>window.__dialogs78.push(message);window.confirm=message=>{window.__dialogs78.push(message);return true;};
    const realNow=performance.now.bind(performance),raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),ids=new Set();let clock=null;
    performance.now=()=>clock==null?realNow():clock;
    window.requestAnimationFrame=callback=>{if(clock!=null)return 0;const id=raf(t=>{ids.delete(id);callback(t);});ids.add(id);return id;};
    window.__freezeNet78=()=>{clock=realNow();for(const id of ids)cancel(id);ids.clear();window.__DBG().noRender=true;window.__DBG().noInst=true;window.__DBG().noTags=true;};
    window.__advanceNet78=(frames,ms)=>{for(let i=0;i<frames;i++){clock+=ms;window.__loop73();}};
  },{uid});
  await page.goto(`http://127.0.0.1:${server.address().port}/?gfx=mid`,{waitUntil:'load',timeout:180000});
  await page.waitForFunction(()=>window.__READY===true,null,{timeout:180000});
  await page.evaluate(()=>window.__freezeNet78());return c;
}
const state=c=>c.page.evaluate(()=>({uid:__uid,started:__G.started,host:__G.host,phase:__G.phase,t:__G.t,day:__G.day,crystal:__G.crystal,wolves:__G.wolves.length,
  room:__G.room,sid:__G.sid,goal:__G.set.goalDay,title:document.getElementById('storyTitle78').textContent,end:document.getElementById('popEnd').classList.contains('on'),kit:{wpn:__KIT.wpn,ammo:__KIT.ammo},me:__G.me,players:[...__G.players.entries()].map(([uid,p])=>({uid,n:p.n,g:p.g,hat:p.hat,gls:p.gls,clo:p.clo,skin:p.skin,x:p.tx,y:p.ty,z:p.tz})),
  count:document.getElementById('lobbyCount78').textContent,names:document.getElementById('lobbyNames78').textContent,
  lobby:!document.getElementById('lobby78').hidden,story:!document.getElementById('story78').hidden,canStart:!document.getElementById('lobbyStart78').hidden,
  pos:{x:__PL.x,y:__PL.y,z:__PL.z},roomVisible:__lobby78.state().group?.visible??false,base:__base.map(q=>({...q}))}));
async function advance(c,frames=1,ms=100){await c.page.evaluate(({frames,ms})=>__advanceNet78(frames,ms),{frames,ms});await drain();}
async function join(c,code,name){await c.page.evaluate(({code,name})=>{document.getElementById('iName').value=name;document.getElementById('iRoom').value=code;document.getElementById('bJoin').click();},{code,name});await drain();await advance(c,12,50);}
async function leave(c){clients.delete(c.id);await c.context.close();bus.disconnect(c.id);await drain();}
async function goal(c,value){await c.page.evaluate(value=>{document.getElementById('bTeach').click();const s=document.getElementById('sGoal');s.value=value;s.dispatchEvent(new Event('input'));document.querySelector('[data-close=popTeach]').click();},value);await drain();}
try{
  await new Promise(r=>server.once('listening',r));browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});watchdog=setTimeout(()=>void browser.close(),600000);
  const host=await makeClient('host','uhost78');
  await host.page.evaluate(()=>{document.getElementById('iName').value='네트워크 선생님';document.getElementById('bMake').click();});await drain();await advance(host,12,50);
  const made=await state(host),code=made.room,root='sheepnight/'+code;
  check('Actual teacher bMake creates a waiting room',made.started&&made.host&&made.phase==='lobby'&&made.t===0&&made.lobby&&made.canStart&&/^[A-Z2-9]{4}$/.test(code),made);
  let student=await makeClient('student','ustudent78');await join(student,code,'연결 학생');await advance(host,12,50);await advance(student,12,50);
  const entered=[await state(host),await state(student)];
  check('Actual bJoin subscribes and both clients list each other',entered.every(s=>s.phase==='lobby'&&s.players.length===1&&s.count==='2명 모였어요')&&!entered[1].host&&!entered[1].canStart,entered);
  const standing=[];for(const c of [host,student])standing.push(await c.page.evaluate(()=>{__DBG().noInst=false;__advanceNet78(1,16.67);__DBG().noInst=true;return [...__G.players.values()].map(p=>({uid:p.uid,air:p.air,y:p.y,lobbyFloor:__lobby78.state().y}));}));await drain();
  check('Actual avatar update uses lobby floor so standing remote peers are grounded',standing.every(list=>list.length===1&&list.every(p=>p.air===false&&Math.abs(p.y-p.lobbyFloor)<.001)),standing);
  const before=await state(host);await advance(host,30,1000);await advance(student,30,1000);const waited=[await state(host),await state(student)];
  check('Thirty seconds of real loop leave day, countdown, crystal and resources unchanged',waited.every(s=>s.phase==='lobby'&&s.t===0&&s.day===before.day&&s.crystal===before.crystal&&s.wolves===0)&&JSON.stringify(waited[0].base)===JSON.stringify(before.base),waited.map(s=>({phase:s.phase,t:s.t,day:s.day,crystal:s.crystal,wolves:s.wolves})));
  await student.page.evaluate(()=>{document.getElementById('lobbyDress78').click();for(const id of ['hatPick','glsPick','cloPick','skinPick'])document.querySelectorAll('#'+id+' button')[1].click();document.querySelectorAll('#grpPick button')[2].click();document.querySelector('[data-close=popLobby78]').click();});
  await advance(student,12,50);await advance(host,12,50);const dressed=await state(host),sent=bus.read(root+'/p/'+student.uid),seen=dressed.players.find(p=>p.uid===student.uid);
  check('Actual dressing and team buttons reach host playerChanged and roster',seen?.hat===9&&seen.gls===8&&seen.clo===2&&seen.skin===1&&seen.g===2&&sent.ht===9&&sent.gl===8&&sent.cl===2&&sent.sk===1&&sent.g===2&&dressed.names.includes('3모둠'),{seen,sent,names:dressed.names});
  const writesBefore=bus.writes.filter(w=>w.client===student.id&&w.path===root+'/meta').length;
  const refused=await student.page.evaluate(()=>{document.getElementById('lobbyStart78').click();return __lobby78.start();});await drain();
  check('Student cannot start through a hidden button or function invocation',refused===false&&bus.read(root+'/meta').ph==='lobby'&&bus.writes.filter(w=>w.client===student.id&&w.path===root+'/meta').length===writesBefore,{refused,meta:bus.read(root+'/meta').ph});
  await leave(student);await advance(host,12,50);const gone=await state(host);
  check('onDisconnect removes peer through child_removed and updates waiting roster',gone.players.length===0&&gone.count==='1명 모였어요'&&!gone.names.includes('연결 학생')&&bus.read(root+'/p/ustudent78')===null,{count:gone.count,players:gone.players,names:gone.names});
  student=await makeClient('student-rejoin','ustudent78');await join(student,code,'연결 학생');await advance(host,12,50);
  check('Rejoining waiting room restores a single peer without stale duplicates',(await state(host)).players.length===1&&(await state(student)).phase==='lobby');
  await goal(host,12);check('Actual teacher goal setting propagates to guest', (await state(host)).goal===12&&(await state(student)).goal===12);
  await host.page.evaluate(()=>document.getElementById('lobbyStart78').click());await drain();const intro=[await state(host),await state(student)];
  check('Teacher start publishes intro to both actual meta listeners',intro.every(s=>s.phase==='intro'&&s.t===5&&s.story&&!s.lobby&&!s.roomVisible),intro.map(s=>({phase:s.phase,t:s.t,lobby:s.lobby,story:s.story,roomVisible:s.roomVisible})));
  const blocked=await student.page.evaluate(()=>__lobby78.dress('hat',4));const startPos=(await state(student)).pos;
  await student.page.evaluate(()=>__KEY.w=true);await advance(student,20,100);await student.page.evaluate(()=>__KEY.w=false);const endPos=(await state(student)).pos;
  check('Intro rejects dressing and gameplay movement',blocked===false&&Math.hypot(endPos.x-startPos.x,endPos.y-startPos.y,endPos.z-startPos.z)<.001,{blocked,startPos,endPos});
  await advance(host,4,1000);await advance(student,4,1000);const four=[await state(host),await state(student)];
  check('Host countdown remains intro before five seconds',four.every(s=>s.phase==='intro'&&s.t>0&&s.t<=1.01),four.map(s=>({phase:s.phase,t:s.t})));
  check('Both story titles use the teacher-selected twelve-day goal',four.every(s=>s.title==='12일 밤까지 함께 버텨라!'),four.map(s=>s.title));
  await advance(host,1,1100);await advance(student,1,1);const playing=[await state(host),await state(student)];
  check('Host reaches day and guests leave story through actual phase callback',playing.every(s=>s.phase==='day'&&s.t>10&&!s.lobby&&!s.story&&!s.roomVisible&&Math.abs(s.pos.z)<120&&s.pos.y<20),playing.map(s=>({phase:s.phase,t:s.t,pos:s.pos,story:s.story,lobby:s.lobby})));
  await leave(student);await advance(host,12,50);const late=await makeClient('late','ulate78');await join(late,code,'늦게 온 학생');await advance(host,12,50);const lateState=await state(late);
  check('Actual in-progress bJoin enters the village without replaying lobby or intro',lateState.started&&!lateState.host&&lateState.phase==='day'&&!lateState.lobby&&!lateState.story&&!lateState.roomVisible&&lateState.pos.y<20&&Math.abs(lateState.pos.z)<120,lateState);
  // Terminal phases are arranged directly; actual loop, metadata listener and UI own the restart.
  await host.page.evaluate(()=>{__G.phase='win';__lobby78.meta();});await drain();await advance(host,1,1);await advance(late,1,1);
  const ended=[await state(host),await state(late)];check('Both actual loops open the first victory result',ended.every(s=>s.phase==='win'&&s.end),ended.map(s=>({phase:s.phase,end:s.end,sid:s.sid})));
  const oldSid=ended[0].sid;await host.page.evaluate(()=>document.getElementById('bAgain').click());await drain();await advance(host,12,50);await advance(late,12,50);
  const restarted=[await state(host),await state(late)];
  check('Host bAgain creates a new session and closes guest result before waiting',restarted.every(s=>s.phase==='lobby'&&s.t===0&&s.lobby&&!s.story&&!s.end&&s.roomVisible&&s.sid!==oldSid)&&restarted[0].sid===restarted[1].sid,restarted.map(s=>({phase:s.phase,t:s.t,end:s.end,lobby:s.lobby,roomVisible:s.roomVisible,sid:s.sid})));
  await goal(host,18);await host.page.evaluate(()=>document.getElementById('lobbyStart78').click());await drain();await advance(host,4,1000);await advance(late,4,1000);
  const secondIntro=[await state(host),await state(late)];
  check('Restart requires teacher start and displays the new eighteen-day goal',secondIntro.every(s=>s.phase==='intro'&&s.t>0&&s.story&&!s.end&&s.goal===18&&s.title==='18일 밤까지 함께 버텨라!'),secondIntro.map(s=>({phase:s.phase,t:s.t,title:s.title,end:s.end})));
  await advance(host,1,1100);await advance(late,1,1);check('Second five-second story reaches day on both clients',(await state(host)).phase==='day'&&(await state(late)).phase==='day');
  await host.page.evaluate(()=>{__G.phase='win';__lobby78.meta();});await drain();await advance(host,1,1);await advance(late,1,1);
  const secondWin=[await state(host),await state(late)];check('Guest endShown resets so the second victory opens its result again',secondWin.every(s=>s.phase==='win'&&s.end),secondWin.map(s=>({phase:s.phase,end:s.end,sid:s.sid})));
  // A lesson reset during a minigame must not resurrect miniBack's old weapon and ammo.
  await host.page.evaluate(()=>document.getElementById('bAgain').click());await drain();await host.page.evaluate(()=>document.getElementById('lobbyStart78').click());await drain();await advance(host,1,5100);await advance(late,1,1);
  await host.page.evaluate(()=>{__KIT.wpn=3;__KIT.ammo=123;__KIT.ownW[3]=true;__goMini(1);});await drain();
  check('Minigame reset fixture enters through real host/guest mini callbacks',(await state(host)).phase==='mini'&&(await state(late)).phase==='mini');
  const revived=await host.page.evaluate(()=>{__PL.hp=0;__PL.down=true;__PL.downT=9;__PL.biteT=4;__PL.hurtFx=1;__PL.landT=1;document.getElementById('bTeach').click();document.getElementById('tReset').click();return {hp:__PL.hp,maxHP:__maxHP(),down:__PL.down,downT:__PL.downT,biteT:__PL.biteT,hurtFx:__PL.hurtFx,landT:__PL.landT,phase:__G.phase};});await drain();await advance(host,12,50);await advance(late,12,50);
  const miniReset=[await state(host),await state(late)];
  check('Actual teacher reset leaves minigame and clears saved weapon and ammunition',miniReset.every(s=>s.phase==='lobby'&&s.t===0&&s.lobby&&!s.story&&!s.end&&s.kit.wpn===0&&s.kit.ammo===0),miniReset.map(s=>({phase:s.phase,t:s.t,lobby:s.lobby,kit:s.kit,end:s.end})));
  check('Teacher reset immediately revives zero-HP host and clears damage state',revived.hp===revived.maxHP&&revived.hp>0&&!revived.down&&revived.downT===0&&revived.biteT===0&&revived.hurtFx===0&&revived.landT===0&&revived.phase==='lobby',revived);
  const waitingSid=miniReset[0].sid;
  await host.page.evaluate(()=>{document.getElementById('bTeach').click();document.getElementById('tReset').click();});await drain();
  // Inspect immediately after the actual meta callback, before lobbyMove could clamp/heal a bad village spawn.
  const lobbyAgain=await late.page.evaluate(()=>({phase:__G.phase,sid:__G.sid,y:__PL.y,x:__PL.x,z:__PL.z,hallY:__lobby78.state().y,hallZ:__lobby78.state().z,lobby:!document.getElementById('lobby78').hidden,roomVisible:__lobby78.state().group?.visible}));
  const resetHost=await state(host);
  check('Same-phase new session keeps guest on lobby floor before any movement repair',resetHost.phase==='lobby'&&resetHost.sid!==waitingSid&&lobbyAgain.phase==='lobby'&&lobbyAgain.sid===resetHost.sid&&lobbyAgain.lobby&&lobbyAgain.roomVisible&&Math.abs(lobbyAgain.y-lobbyAgain.hallY)<.001&&Math.abs(lobbyAgain.x)<=10.9&&Math.abs(lobbyAgain.z-lobbyAgain.hallZ)<=9.2,lobbyAgain);
  const paths=bus.reads.map(q=>q.path);check('Room entry reads real meta and personal checkpoint paths',paths.includes(root+'/meta')&&paths.includes(root+'/pc/ustudent78')&&paths.includes(root+'/pc/ulate78'),{reads:bus.reads.length,delivered:bus.delivered});
  check('All subscription event kinds ran actual callbacks', ['value','child_added','child_changed','child_removed'].every(k=>bus.delivered[k]>0),bus.delivered);
  check('No browser runtime error',errors.length===0,errors);
}catch(e){errors.push({fatal:e.stack});check('Harness completed',false,e.stack);}
finally{
  clearTimeout(watchdog);await browser?.close();await new Promise(r=>server.close(r));
  const report={source:path.resolve(input),sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),scope:'Actual UI and callbacks in two hidden pages with in-memory Firebase; production security rules and live network latency are not exercised.',results,errors,eventCounts:bus.delivered,writes:bus.writes.length,reads:bus.reads.length};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(`${results.filter(r=>r.pass).length}/${results.length} passed`);if(results.some(r=>!r.pass)||errors.length)process.exitCode=1;
}
