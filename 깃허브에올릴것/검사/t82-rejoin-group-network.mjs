// 82차 — 다시 접속할 때 첫 화면에서 고른 모둠으로 들어오는가(선생님: "다시 접속할 때 선택한 모둠으로 안 들어와지는 버그").
// Actual bMake/bJoin, actual Firebase callbacks and a real page reload in the same browser profile
// (uid, sheepG and the checkpoint survive). The database is the in-memory mock of t78-lobby-network; nothing reaches live Firebase.
// Covers: waiting room (different/same team), mid-game day (different/same team: team totals, personal progress,
// first purchase charges the new team), and a new lesson after the teacher's restart.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';

const input=process.argv[2]||GAME,out=path.resolve(process.argv[3]||'artifacts/rejoin82-network');
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
      this.writes.push({client,kind,path:p});this.changed(before);return true;
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
async function boot(page){
  await page.waitForFunction(()=>window.__READY===true,null,{timeout:180000});
  await page.evaluate(()=>window.__freezeNet78());
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
  await boot(page);return c;
}
// A real reload in the same profile: the socket drops (onDisconnect runs), localStorage (uid, sheepG, checkpoint) survives.
async function reload(c){bus.disconnect(c.id);await c.page.reload({waitUntil:'load',timeout:180000});await boot(c.page);await drain();}
async function advance(c,frames=1,ms=100){await c.page.evaluate(({frames,ms})=>__advanceNet78(frames,ms),{frames,ms});await drain();}
async function both(host,c,frames=12,ms=50){await advance(c,frames,ms);await advance(host,frames,ms);await advance(c,2,50);}
// Choose a team on the actual entry screen, then press the actual join button.
async function join(c,code,name,g){
  await c.page.evaluate(({code,name,g})=>{document.getElementById('iName').value=name;document.getElementById('iRoom').value=code;
    if(g!=null)document.querySelectorAll('#grpPick button')[g].click();document.getElementById('bJoin').click();},{code,name,g});
  await drain();await advance(c,12,50);
}
const kidState=c=>c.page.evaluate(()=>({g:__G.me.g,phase:__G.phase,sid:__G.sid,lv:__XP.lv,ammo:__KIT.ammo,
  pc:{g:__myPC().g,w:__myPC().w|0,s:__myPC().s|0,o:__myPC().o|0},res:__G.res.map(r=>({w:r.w,s:r.s,g:r.g}))}));
const hostState=(host,uid)=>host.page.evaluate(uid=>({p:__G.players.get(uid)?.g,pc:__pcMap.get(uid)?.g,res:__G.res.map(r=>({w:r.w,s:r.s,g:r.g})),
  base:__base.map(b=>({w:b.w,s:b.s,o:b.o})),names:document.getElementById('lobbyNames78').textContent}),uid);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
try{
  await new Promise(r=>server.once('listening',r));
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});watchdog=setTimeout(()=>void browser.close(),900000);
  const host=await makeClient('host','uhost82');
  await host.page.evaluate(()=>{document.getElementById('iName').value='선생님';document.getElementById('bMake').click();});await drain();await advance(host,12,50);
  const code=await host.page.evaluate(()=>__G.room),root='sheepnight/'+code,S='urejoin82';
  const kid=await makeClient('kid',S);

  // A. Waiting room. Enter 1모둠, change to 2모둠 in the dress window (this writes pc/<uid>.g=1), then reload.
  await join(kid,code,'다시온아이',0);
  await kid.page.evaluate(()=>{document.getElementById('lobbyDress78').click();document.querySelectorAll('#grpPick button')[1].click();document.querySelector('[data-close=popLobby78]').click();});
  await both(host,kid);
  const a0=await kidState(kid),a0pc=bus.read(root+'/pc/'+S);
  check('Fixture: waiting-room team change is stored in pc/<uid> for this lesson',a0.g===1&&a0pc?.g===1&&a0pc.sid===a0.sid,{kid:a0.g,pc:a0pc&&{g:a0pc.g,sid:a0pc.sid}});
  await reload(kid);await join(kid,code,'다시온아이',3);await both(host,kid);
  const a1=await kidState(kid),a1h=await hostState(host,S);
  check('Waiting-room rejoin enters the newly selected team, not the stored one',a1.phase==='lobby'&&a1.g===3&&a1h.p===3&&a1h.pc===3&&a1h.names.includes('4모둠'),{kid:a1.g,hostP:a1h.p,hostPC:a1h.pc,roster:a1h.names});
  await reload(kid);
  const pre=await kid.page.evaluate(()=>[...document.querySelectorAll('#grpPick button')].findIndex(b=>b.classList.contains('on')));
  await join(kid,code,'다시온아이',null);await both(host,kid);
  const a2=await kidState(kid),a2h=await hostState(host,S);
  check('Waiting-room rejoin without touching the picker keeps the preselected current team',pre===3&&a2.g===3&&a2h.p===3,{preselected:pre,kid:a2.g,hostP:a2h.p});

  // B. Mid-game. Start, then let the kid mine, level and hold ammo in its team.
  await host.page.evaluate(()=>document.getElementById('lobbyStart78').click());await drain();await advance(host,1,5100);await advance(kid,1,1);await both(host,kid);
  await kid.page.evaluate(()=>{__gain('w',40);__gain('s',25);__gain('g',7);__xpGain(400);__KIT.ammo=55;});await both(host,kid,24,50);
  const b0=await kidState(kid),b0h=await hostState(host,S),oldG=b0.g,newG=oldG===1?2:1;
  check('Fixture: day phase and the kid ledger reached the host',b0.phase==='day'&&b0h.pc===oldG&&bus.read(root+'/pc/'+S)?.w===40&&b0.lv>1,{phase:b0.phase,g:oldG,lv:b0.lv});
  await reload(kid);await join(kid,code,'다시온아이',newG);await both(host,kid,24,50);
  const b1=await kidState(kid),b1h=await hostState(host,S),b1pc=bus.read(root+'/pc/'+S);
  check('Mid-game rejoin enters the newly selected team on kid, players and pc',b1.phase==='day'&&b1.g===newG&&b1h.p===newG&&b1h.pc===newG&&b1pc?.g===newG,{selected:newG,kid:b1.g,hostP:b1h.p,hostPC:b1h.pc});
  check('Old team keeps what the kid mined and the new team gets nothing for free',same(b1h.res,b0h.res),{before:b0h.res,after:b1h.res});
  check('Old share moved into the old team base and the new pc ledger starts at zero',
    b1h.base[oldG].w-b0h.base[oldG].w===40&&b1h.base[oldG].s-b0h.base[oldG].s===25&&b1h.base[oldG].o-b0h.base[oldG].o===7&&b1pc.w===0&&b1pc.s===0&&b1pc.o===0,{baseBefore:b0h.base[oldG],baseAfter:b1h.base[oldG],pc:{w:b1pc.w,s:b1pc.s,o:b1pc.o}});
  check('Kid screen agrees with the host team totals',same(b1.res,b1h.res),{kid:b1.res,host:b1h.res});
  check('Personal level and ammunition follow the kid into the new team',b1.lv===b0.lv&&b1.ammo===55,{lv:[b0.lv,b1.lv],ammo:b1.ammo});
  await host.page.evaluate(()=>document.getElementById('tGift').click());await drain();await both(host,kid);
  const gold0=(await hostState(host,S)).res;
  await kid.page.evaluate(()=>__session73.purchaseRequest('ammo',{gld:3}));await drain();await both(host,kid);
  const b2=await kidState(kid),gold1=(await hostState(host,S)).res;
  check('First purchase after the switch is charged to the new team',b2.ammo===55+18&&gold1[newG].g===gold0[newG].g-3&&gold1[oldG].g===gold0[oldG].g,{ammo:b2.ammo,newTeam:[gold0[newG].g,gold1[newG].g],oldTeam:[gold0[oldG].g,gold1[oldG].g]});
  await kid.page.evaluate(()=>__gain('w',11));await both(host,kid,24,50);
  const b3pre=await kidState(kid),b3preh=await hostState(host,S);
  await reload(kid);await join(kid,code,'다시온아이',newG);await both(host,kid,24,50);
  const b3=await kidState(kid),b3h=await hostState(host,S);
  check('Mid-game rejoin with the same team keeps team, ledger, totals and level',b3.g===newG&&b3h.pc===newG&&b3.pc.w===b3pre.pc.w&&same(b3h.res,b3preh.res)&&b3.lv===b3pre.lv,{g:b3.g,pcW:[b3pre.pc.w,b3.pc.w],res:[b3preh.res,b3h.res]});

  // B'. Same switch when the local checkpoint is missing or rejected: the selected team must still reach pc/<uid> at once.
  await kid.page.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('sheepSave:'))localStorage.removeItem(k);});
  const d0h=await hostState(host,S),dG=0;
  await reload(kid);await kid.page.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('sheepSave:'))localStorage.removeItem(k);});
  await join(kid,code,'다시온아이',dG);await both(host,kid,24,50);
  const d1=await kidState(kid),d1h=await hostState(host,S);
  check('Without a checkpoint the switch still reaches pc and keeps every team total',d1.g===dG&&d1h.p===dG&&d1h.pc===dG&&same(d1h.res,d0h.res)&&same(d1.res,d1h.res),{kid:d1.g,hostP:d1h.p,hostPC:d1h.pc,before:d0h.res,after:d1h.res});
  const dGold0=d1h.res;await kid.page.evaluate(()=>__session73.purchaseRequest('ammo',{gld:2}));await drain();await both(host,kid);
  const d2=await kidState(kid),dGold1=(await hostState(host,S)).res;
  check('Without a checkpoint the first purchase is charged to the new team',d2.ammo===d1.ammo+12&&dGold1[dG].g===dGold0[dG].g-2&&dGold1[newG].g===dGold0[newG].g,{ammo:[d1.ammo,d2.ammo],newTeam:[dGold0[dG].g,dGold1[dG].g],oldTeam:[dGold0[newG].g,dGold1[newG].g]});

  // C. New lesson after the teacher's restart: the new-sid pc record must not pin the old team either.
  await host.page.evaluate(()=>{__G.phase='win';__lobby78.meta();});await drain();await advance(host,1,1);await advance(kid,1,1);
  await host.page.evaluate(()=>document.getElementById('bAgain').click());await drain();await both(host,kid,24,50);
  const c0=await kidState(kid),c0pc=bus.read(root+'/pc/'+S);
  check('Fixture: new lesson waiting room with a new-sid pc record for the old team',c0.phase==='lobby'&&c0pc?.sid===c0.sid&&c0pc.g===dG,{phase:c0.phase,pc:c0pc&&{g:c0pc.g,sid:c0pc.sid},sid:c0.sid});
  await reload(kid);await join(kid,code,'다시온아이',4);await both(host,kid);
  const c1=await kidState(kid),c1h=await hostState(host,S);
  check('New-lesson rejoin enters the newly selected team',c1.phase==='lobby'&&c1.g===4&&c1h.p===4&&c1h.pc===4&&c1h.names.includes('5모둠'),{kid:c1.g,hostP:c1h.p,hostPC:c1h.pc,roster:c1h.names});
  check('No browser runtime error',errors.length===0,errors);
}catch(e){errors.push({fatal:e.stack});check('Harness completed',false,e.stack);}
finally{
  clearTimeout(watchdog);await browser?.close();await new Promise(r=>server.close(r));
  const report={source:path.resolve(input),sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),scope:'Actual entry/join UI, page reloads and room callbacks with in-memory Firebase; live network and security rules are not exercised.',results,errors,eventCounts:bus.delivered};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(`${results.filter(r=>r.pass).length}/${results.length} passed`);if(results.some(r=>!r.pass)||errors.length)process.exitCode=1;
}
