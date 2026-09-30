const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
function between(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,'Account function markers must exist');return html.slice(a,b);}
const accountSource=between('const saveQueues = new Map();','/* ═══════════════════════════════════════════════════════════════════\n   5) 화면');
const liveRewardSource=between('  function deliverRewards(room){','  async function openRoom(');
const buyStart='const result=await uref(buyerKey).transaction(user=>{';
const buyBody=between(buyStart,'},undefined,false);').slice(buyStart.length);
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const snapshot=v=>({val:()=>copy(v)});

function runtime(initialGold=300,dayGold=0){
  const users={alice:{name:'앨리스',gold:initialGold,av:{hair:'short:0'},stat:{solved:0,correct:0},day:{d:'2026-09-30',g:dayGold}},
    bob:{name:'보비',gold:700,av:{hair:'bob:1'},stat:{solved:0,correct:0},day:{d:'2026-09-30',g:0}}};
  const jobs=[],timers=new Map(),listeners=new Map();let nextTimer=0;
  const room={meta:{session:'economy-race'},p:{alice:{name:'앨리스',rewards:{live_q0:{gold:25,solved:1,correct:1,delivered:false}}}}};
  function emit(k){for(const cb of listeners.get(k)||[])cb(snapshot(users[k]));}
  function userRef(k){return{
    update(p){return new Promise(resolve=>jobs.push(()=>{users[k]=Object.assign({},users[k],copy(p));emit(k);resolve();}));},
    transaction(fn){return new Promise(resolve=>jobs.push(()=>{const next=fn(copy(users[k])),committed=next!==undefined;if(committed){users[k]=copy(next);emit(k);}resolve({committed,snapshot:snapshot(users[k])});}));},
    on(event,cb){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(cb);queueMicrotask(()=>cb(snapshot(users[k])));return cb;},
    off(event,cb){listeners.get(k)?.delete(cb);}
  };}
  const ctx={console,ME:{k:'alice',...copy(users.alice)},IS_TEACHER:false,FB:{ok:true},R:{practicePerQ:10,practiceCap:300},
    today:()=> '2026-09-30',el:()=>null,toast(){},SND:{coin(){}},uref:userRef,
    setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
    players:r=>Object.keys(r.p||{}).map(k=>({k,...r.p[k]})),paying:new Set(),
    tx:async fn=>{const next=fn(copy(room));if(next)Object.assign(room,next);return{committed:!!next,snapshot:snapshot(room)};},
    newAvatar:()=>({hair:'short:0'}),it:{id:'expression:happy:0',price:220,cat:'expression',shape:'happy',ci:0}};
  vm.createContext(ctx);vm.runInContext(accountSource+'\n'+liveRewardSource+'\nconst purchaseCallback=user=>{'+buyBody+'};',ctx);
  const evaluate=source=>vm.runInContext(source,ctx);
  async function microtasks(){for(let i=0;i<20;i++)await Promise.resolve();}
  async function drain(){for(let i=0;i<100;i++){await microtasks();if(!jobs.length)return;jobs.shift()();}throw new Error('Unexpected non-draining operation queue');}
  function fireTimers(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}
  return{ctx,users,room,jobs,evaluate,drain,microtasks,fireTimers,userRef};
}

const passed=[];
(async()=>{
  {
    const r=runtime();r.evaluate('watchMe();save({av:{hair:"long:1"}});');
    const practice=r.evaluate('recordPracticeAnswer(true,"practice_overlap","alice")');
    r.ctx.deliverRewards(r.room);await r.drain();const receipt=await practice;
    assert.equal(receipt.gold,10);assert.equal(r.users.alice.gold,335);
    assert.deepEqual(r.users.alice.stat,{solved:2,correct:2});assert.equal(r.users.alice.av.hair,'long:1');
    assert.equal(r.users.alice.liveClaims.live_q0,true);assert.equal(r.room.p.alice.rewards.live_q0.delivered,true);
    r.ctx.deliverRewards(r.room);await r.drain();assert.equal(r.users.alice.gold,335);
    passed.push('Real host live reward overlaps pending avatar save and practice: both money and stats survive; no duplicate live payout');
  }
  {
    const r=runtime(),practice=r.evaluate('recordPracticeAnswer(true,"practice_first","alice")');
    await r.microtasks();r.ctx.deliverRewards(r.room);await r.drain();await practice;
    assert.equal(r.users.alice.gold,335);assert.deepEqual(r.users.alice.stat,{solved:2,correct:2});
    passed.push('Reverse transaction order keeps both practice and live payouts');
  }
  {
    const r=runtime(),a=r.evaluate('recordPracticeAnswer(true,"same_answer","alice")'),b=r.evaluate('recordPracticeAnswer(true,"same_answer","alice")');
    await r.drain();await Promise.all([a,b]);assert.equal(r.users.alice.gold,310);assert.deepEqual(r.users.alice.stat,{solved:1,correct:1});
    passed.push('Retry of the same practice answer cannot duplicate money or stats');
  }
  {
    const r=runtime(300,295),a=r.evaluate('recordPracticeAnswer(true,"cap_a","alice")'),b=r.evaluate('recordPracticeAnswer(true,"cap_b","alice")');
    await r.drain();const receipts=await Promise.all([a,b]);assert.deepEqual(receipts.map(x=>x.gold),[5,0]);
    assert.equal(r.users.alice.gold,305);assert.equal(r.users.alice.day.g,300);assert.deepEqual(r.users.alice.stat,{solved:2,correct:2});
    const wrong=r.evaluate('recordPracticeAnswer(false,"wrong","alice")');await r.drain();assert.equal((await wrong).gold,0);
    assert.deepEqual(r.users.alice.stat,{solved:3,correct:2});
    passed.push('Two overlapping practice answers share the stored daily cap; wrong answers record one attempt without money');
  }
  {
    const r=runtime();r.evaluate('save({av:{hair:"long:2"}});');
    r.ctx.ME={k:'bob',...copy(r.users.bob)};r.evaluate('save({av:{hair:"short:3"}});');r.fireTimers();await r.drain();
    assert.equal(r.users.alice.av.hair,'long:2');assert.equal(r.users.bob.av.hair,'short:3');
    assert.equal(r.users.alice.gold,300);assert.equal(r.users.bob.gold,700);
    passed.push('Delayed saves retain their original account keys after a login switch');
  }
  {
    const r=runtime(),practice=r.evaluate('recordPracticeAnswer(true,"logout_pending","alice")');
    r.ctx.ME={k:'bob',...copy(r.users.bob)};r.ctx.deliverRewards(r.room);await r.drain();await practice;
    assert.equal(r.users.alice.gold,335);assert.equal(r.users.bob.gold,700);assert.equal(r.ctx.ME.k,'bob');assert.equal(r.ctx.ME.gold,700);
    passed.push('Practice finishing after an account switch credits only the original account');
  }
  {
    const r=runtime(),practice=r.evaluate('recordPracticeAnswer(true,"buy_overlap","alice")');
    const buy=r.evaluate('uref("alice").transaction(purchaseCallback)');r.ctx.deliverRewards(r.room);
    await r.drain();await Promise.all([practice,buy]);assert.equal(r.users.alice.gold,115);
    assert.equal(r.users.alice.owned['expression:happy:0'],1);assert.equal(r.users.alice.av.expression,'happy:0');
    const duplicate=r.evaluate('uref("alice").transaction(purchaseCallback)');await r.drain();await duplicate;assert.equal(r.users.alice.gold,115);
    passed.push('Actual purchase callback, live payout and practice overlap without lost money; repeated purchase is charged once');
  }
  console.log(JSON.stringify({passed,errors:[]},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
