import * as sim from './sim.mjs';
import {createScene} from './scene.mjs';
import {createAudio} from './audio.mjs';
import {createNetwork} from './net.mjs';
import {createUI} from './ui.mjs';
import {BUILD,SPAWN,TOWERS,zoneAt,walkable} from './content.mjs';
import {PerformanceRecord} from './perf.mjs';
import {migrateCheckpoint} from './save.mjs';

const canvas=document.getElementById('game');
const storage={get(k){try{return localStorage.getItem('zns2:'+k);}catch{return null;}},set(k,v){try{localStorage.setItem('zns2:'+k,v);return true;}catch{return false;}}};
let state=sim.createState(),network=null,active=false,isHost=false,localId='',room='',mode='solo',connected=true,notice='',selectedTower=null,deployId=null;
let inputs={},inputReceived={},roster=[],manual=false,entering=false,initialSnapshot=false;
const view={yaw:0,pitch:.62,distance:20,placement:null};
const keys=new Set(),pointer={x:innerWidth/2,y:innerHeight/2,attack:false,drag:false};
const perf=new PerformanceRecord(),audio=createAudio();
let scene;
try{scene=createScene(canvas);}catch(e){document.getElementById('ui').textContent='3D 화면을 열지 못했어요. 최신 Chrome에서 다시 열어 주세요. '+e.message;throw e;}
sim.addPlayer(state,{id:'preview',name:'원정대',team:0,hat:0});
let seenEvents=new Set(),lastFeedback='',lastCheckpointPhase='',savedCheckpoint=null;

function id(){let v;try{v=sessionStorage.getItem('zns2:playerId');}catch{}if(!v){v=crypto.randomUUID?.()||'p'+Date.now().toString(36)+Math.random().toString(36).slice(2);try{sessionStorage.setItem('zns2:playerId',v);}catch{}}return v;}
function clone(v){return JSON.parse(JSON.stringify(v));}
function toast(s){ui.toast(s);}
function teacherAction(type){return ['start','depart','pause','retry','return'].includes(type);}
function processAction(playerId,action){
  if(!state.players[playerId]||!state.players[playerId].online)return;
  if(teacherAction(action.type)&&playerId!==localId)return;
  const result=sim.applyAction(state,playerId,action,{teacher:playerId===localId&&isHost});
  if(result?.ok===false){
    const error=result.error||'지금은 할 수 없어요.';
    if(playerId===localId)toast(error);
    else {state.feedback??={};state.feedback[playerId]={id:Date.now(),message:error};}
  }
  if(result?.ok!==false && ['depart','start','return','retry'].includes(action.type))captureCheckpoint();
  return result;
}
function dispatch(action){
  if(!active||!connected)return;
  audio.unlock();
  if(action.type==='deploy'&&!Number.isFinite(action.x)){deployId=action.towerId;selectedTower=state.towers.find(t=>t.id===deployId)?.type||'arrow';return;}
  if(action.type==='pack'||action.type==='repair'){
    if(!action.towerId){const near=nearestTower();if(!near){toast('가까운 타워로 이동해 주세요.');return;}action={...action,towerId:near.id};}
  }
  if(isHost)return processAction(localId,action);
  network?.sendAction(action);
}
function nearestTower(){const p=state.players[localId];if(!p)return null;return state.towers.filter(t=>t.state==='deployed'&&t.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||null;}
function selectTower(type){deployId=null;selectedTower=type;view.placement=null;audio.unlock();}
function reconcileRoster(){
  if(!isHost)return;
  const ids=new Set();
  for(const p of roster){ids.add(p.id);if(!state.players[p.id]||(!state.players[p.id].online&&p.online!==false))sim.addPlayer(state,p);sim.setOnline(state,p.id,p.online!==false);}
  for(const pid of Object.keys(state.players))if(!ids.has(pid)&&pid!==localId)sim.setOnline(state,pid,false);
}
async function enter(values){
  if(entering)return;entering=true;ui.setBusy(true);notice='';
  try{
    if(values.mode==='host'&&values.password!==String(window.S2_TEACHER_CODE||'1234'))throw Error('선생님 암호를 확인해 주세요.');
    await audio.unlock();
    const profile={id:id(),name:String(values.name||'').trim().slice(0,12),team:Math.max(0,Math.min(4,Math.trunc(Number(values.team)||0))),hat:Math.max(0,Math.min(16,Math.trunc(Number(values.hat)||0))),face:Math.max(0,Math.min(11,Math.trunc(Number(values.face)||0))),clothes:Math.max(0,Math.min(13,Math.trunc(Number(values.clothes)||0)))};
    if(!profile.name)throw Error('이름을 입력해 주세요.');
    storage.set('profile',JSON.stringify({name:profile.name,team:profile.team,hat:profile.hat,face:profile.face,clothes:profile.clothes}));
    state=sim.createState();inputs={};inputReceived={};roster=[];seenEvents.clear();initialSnapshot=false;localId=profile.id;mode=values.mode;isHost=mode!=='join';connected=true;
    network=createNetwork({
      onSnapshot(next){
        if(!next||next.version!==BUILD)return;
        if(!isHost || !active){state=next;if(!initialSnapshot){for(const e of next.events||[])seenEvents.add(e.id);initialSnapshot=true;}}
      },
      onRoster(next){roster=next;reconcileRoster();},
      onInput(pid,input){if(state.players[pid]?.online){inputs[pid]=input;inputReceived[pid]=performance.now();}},
      onAction(pid,action){if(isHost)processAction(pid,action);},
      onStatus(status){
        notice=String(status);
        const lost=/연결 끊김|다른 창|연결 실패|전송 실패/.test(notice);
        connected=!lost;
        if(lost&&active){state.paused=true;state._manualPause=true;pointer.attack=false;keys.clear();}
      }
    });
    const result=await network.connect({mode,room:values.room,profile});
    isHost=result.isHost;room=result.room||'';localId=result.localId||profile.id;
    if(isHost&&result.snapshot)state=result.snapshot;
    if(isHost&&!state.players[localId])sim.addPlayer(state,{...profile,id:localId});
    if(isHost){state.players[localId].online=true;reconcileRoster();sim.restoreVillagePositions(state);}
    active=true;ui.hideEntry();savedCheckpoint=null;lastCheckpointPhase=state.phase;perf.reset();
    if(isHost&&!storage.get('checkpoint:'+(room||'solo')))captureCheckpoint();
    audio.setScene(state.phase,state.paused);
    toast(mode==='solo'?'혼자서도 첫 보스까지 테스트할 수 있어요.':'친구들과 원정을 준비해 주세요.');
  }catch(e){network?.close();network=null;active=false;isHost=false;ui.showEntry(e.message||'입장하지 못했어요.');}
  finally{entering=false;ui.setBusy(false);}
}
function captureCheckpoint(){
  if(!isHost)return;
  // sim stores the expedition-start checkpoint for retries; retain it on mid-battle saves.
  savedCheckpoint=clone(state);
  const payload={version:BUILD,season:2,savedAt:new Date().toISOString(),hostId:localId,state:savedCheckpoint};
  if(!storage.set('checkpoint:'+(room||'solo'),JSON.stringify(payload)))toast('이 기기에 저장할 공간이 부족해요.');
}
function save(){
  if(!isHost)return;
  if(['lobby','village','victory','defeat'].includes(state.phase))captureCheckpoint();
  else if(!savedCheckpoint){toast('저장된 출발 지점이 없어요.');return;}
  toast('저장했어요. 이어하기는 마지막 마을 또는 원정 출발 지점부터예요.');
}
function validState(s){
  if(!s||s.version!==BUILD||!['lobby','village','forest','boss','victory','defeat'].includes(s.phase)||!s.players||!Array.isArray(s.towers)||!Array.isArray(s.enemies))return false;
  if(Object.keys(s.players).length>40||s.towers.length>40||s.enemies.length>150)return false;
  return Object.values(s.players).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.hp))&&Number.isFinite(s.time)&&Number.isFinite(s.supplies);
}
function load(){
  if(!isHost)return;
  if(!['lobby','village','victory','defeat'].includes(state.phase)){toast('마을이나 결과 화면에서 이어하기를 선택해 주세요.');return;}
  try{
    const saved=JSON.parse(storage.get('checkpoint:'+(room||'solo'))||'null');
    const next=migrateCheckpoint(saved);
    if(!validState(next))throw Error('이 방에서 이어갈 수 있는 시즌2 저장이 없어요.');
    const mine=state.players[localId];
    if(saved.hostId!==localId){delete next.players[saved.hostId];next.players[localId]={...mine,x:SPAWN.x,z:SPAWN.z};}
    for(const p of Object.values(next.players))p.online=p.id===localId;
    sim.restoreVillagePositions(next);
    state=next;state.paused=false;reconcileRoster();savedCheckpoint=clone(state);seenEvents=new Set((state.events||[]).map(e=>e.id));toast('마지막 확정 지점에서 이어갑니다.');
  }catch(e){toast(e.message);}
}
function leave(){network?.close();network=null;active=false;isHost=false;keys.clear();pointer.attack=false;selectedTower=null;deployId=null;audio.setScene('lobby',true);state=sim.createState();sim.addPlayer(state,{id:'preview',name:'원정대',team:0,hat:0});ui.showEntry();}
function record(){
  const graphics=scene.stats();
  const data=perf.report({mode,room,viewport:[innerWidth,innerHeight],devicePixelRatio,pixelRatio:graphics.pixelRatio,aaSamples:graphics.aaSamples,host:isHost});
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='시즌2-성능-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('성능 기록을 내려받았어요.');
}
const ui=createUI({enter,action:dispatch,selectTower,sound(kind,value){audio.setVolume(kind,value);audio.unlock();},leave,save,load,record,cameraReset(){view.yaw=0;view.pitch=.62;view.distance=20;}});
function interactive(target){return !!target?.closest?.('input,textarea,select,button,[contenteditable=true]');}
window.addEventListener('keydown',e=>{
  if(interactive(e.target)||!active)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='Digit1')selectTower('arrow');if(e.code==='Digit2')selectTower('ice');
  if(e.code==='Escape'){selectTower(null);pointer.attack=false;}
  if(e.code==='KeyE')dispatch({type:'interact'});
  if(e.code==='KeyT'){const carried=state.towers.find(t=>t.carrier===localId&&t.state==='carried');if(carried)dispatch({type:'deploy',towerId:carried.id});else dispatch({type:'pack'});}
  if(e.code==='KeyR')dispatch({type:'repair'});
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function stopInput(){keys.clear();pointer.attack=false;pointer.drag=false;if(active&&!isHost){network?.sendInput({mx:0,mz:0,yaw:view.yaw,attack:false});}}
window.addEventListener('blur',stopInput);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(!active)return;audio.unlock();pointer.x=e.clientX;pointer.y=e.clientY;
  if(e.button===2){pointer.drag=true;canvas.setPointerCapture?.(e.pointerId);return;}
  if(e.button!==0)return;
  if(selectedTower){const pos=scene.pick(e.clientX,e.clientY);if(pos){dispatch(deployId?{type:'deploy',towerId:deployId,x:pos.x,z:pos.z}:{type:'build',towerType:selectedTower,x:pos.x,z:pos.z});if(deployId){deployId=null;selectedTower=null;}}}
  else pointer.attack=true;
});
window.addEventListener('pointerup',e=>{if(e.button===0)pointer.attack=false;if(e.button===2)pointer.drag=false;});
window.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;if(pointer.drag){view.yaw-=e.movementX*.006;view.pitch=Math.max(.2,Math.min(1.05,view.pitch+e.movementY*.004));}});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.distance=Math.max(6,Math.min(24,view.distance+e.deltaY*.01));},{passive:false});
document.addEventListener('visibilitychange',()=>{stopInput();last=performance.now();if(document.hidden&&active&&isHost){state.paused=true;state._manualPause=true;network?.publish(state);setTimeout(()=>{if(document.hidden&&active&&isHost)network?.publish(state);},150);}});
function input(){
  const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  const r=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  let mx=-Math.sin(view.yaw)*f+Math.cos(view.yaw)*r,mz=-Math.cos(view.yaw)*f-Math.sin(view.yaw)*r;
  const n=Math.hypot(mx,mz);if(n>1){mx/=n;mz/=n;}
  return {mx,mz,yaw:view.yaw,attack:pointer.attack||keys.has('Space')};
}
let last=performance.now(),accumulator=0,networkTimer=0,uiTimer=0,inputTimer=0;
function frame(now){
  requestAnimationFrame(frame);
  const elapsed=now-last;last=now;if(document.hidden)return;
  const dt=Math.min(.1,Math.max(0,elapsed/1000)),begin=performance.now();
  if(active){
    const current=input();inputs[localId]=current;
    // Lost/hidden guests must not keep moving or firing on their last packet.
    if(isHost)for(const pid of Object.keys(inputs))if(pid!==localId&&now-(inputReceived[pid]||0)>350)inputs[pid]={mx:0,mz:0,yaw:inputs[pid].yaw,attack:false};
    if(isHost&&!manual&&connected){accumulator=Math.min(accumulator+dt,.2);while(accumulator>=1/30){sim.step(state,1/30,inputs);accumulator-=1/30;}}
    inputTimer+=dt;networkTimer+=dt;
    if(!isHost&&inputTimer>=.05){inputTimer=0;network?.sendInput(current);}
    if(isHost&&networkTimer>=.1){networkTimer=0;network?.publish(state);}
    if(state.phase!==lastCheckpointPhase){lastCheckpointPhase=state.phase;if(isHost&&['village','victory'].includes(state.phase))captureCheckpoint();selectedTower=null;deployId=null;}
    audio.setScene(state.phase,state.paused);
    for(const ev of state.events||[]){if(seenEvents.has(ev.id))continue;seenEvents.add(ev.id);audio.event(ev,state.players[localId]);}
    if(seenEvents.size>160)seenEvents=new Set((state.events||[]).map(e=>e.id));
    const msg=state.feedback?.[localId];if(msg&&msg.id!==lastFeedback){lastFeedback=msg.id;toast(msg.message);}
  }
  view.placement=null;
  if(active&&selectedTower){const pos=scene.pick(pointer.x,pointer.y),p=state.players[localId];if(pos&&p)view.placement={...pos,type:selectedTower,valid:typeof sim.placementError==='function'?!sim.placementError(state,localId,pos.x,pos.z,deployId):!!zoneAt(pos.x,pos.z,state.stage)&&walkable(pos.x,pos.z,1.5)&&Math.abs(pos.x)>=3.4&&Math.hypot(pos.x-p.x,pos.z-p.z)<=8};}
  scene.render(state,active?localId:'preview',dt,view);audio.update(dt);
  const stats=scene.stats();
  if(active&&!state.paused)perf.frame(elapsed,performance.now()-begin,stats,state);
  uiTimer+=dt;if(uiTimer>=.15){uiTimer=0;ui.update(state,{localId,isHost,room,mode,network:connected,selectedTower,placementHint:view.placement?.valid?'좌클릭으로 설치':'청색 지대 안, 통로 바깥에 설치해 주세요.',fps:perf.fps,stats,volumes:audio.getVolumes(),notice});}
}
requestAnimationFrame(frame);
if(new URLSearchParams(location.search).get('test')==='1')window.__S2={getState:()=>state,sim,act:dispatch,step:(dt,all={})=>sim.step(state,dt,all),scene,audio,perf,setState(next){state=next;},setManual(v){manual=v;}};
window.addEventListener('beforeunload',()=>network?.close());
