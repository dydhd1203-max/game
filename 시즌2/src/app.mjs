import * as sim from './sim.mjs';
import {createScene} from './scene.mjs';
import {createAudio} from './audio.mjs';
import {createNetwork} from './net.mjs';
import {createUI} from './ui.mjs';
import {BUILD,SPAWN} from './content.mjs';
import {PerformanceRecord} from './perf.mjs';
import {migrateCheckpoint} from './save.mjs';
import {SEASON1_CAMERA,season1Zoom} from './camera-season1.mjs';
import {createSeason1Presentation} from './presentation-season1.mjs';
import {createSeason1Prediction} from './prediction-season1.mjs';

const canvas=document.getElementById('game');
const storage={get(k){try{return localStorage.getItem('zns2:'+k);}catch{return null;}},set(k,v){try{localStorage.setItem('zns2:'+k,v);return true;}catch{return false;}}};
let state=sim.createState(),network=null,active=false,isHost=false,localId='',room='',mode='solo',connected=true,notice='';
let inputs={},inputReceived={},roster=[],manual=false,entering=false,initialSnapshot=false;
const view={yaw:0,pitch:SEASON1_CAMERA.pitch,zoom:SEASON1_CAMERA.zoom,aim:false};
const keys=new Set(),pointer={x:innerWidth/2,y:innerHeight/2,attack:false,drag:false};
const presentation=createSeason1Presentation(),prediction=createSeason1Prediction();
let jumpSeq=0;
const perf=new PerformanceRecord(),audio=createAudio();
let scene;
try{scene=createScene(canvas);}catch(e){document.getElementById('ui').textContent='3D 화면을 열지 못했어요. 최신 Chrome에서 다시 열어 주세요. '+e.message;throw e;}
sim.addPlayer(state,{id:'preview',name:'원정대',team:0,hat:0});
let seenEvents=new Set(),lastFeedback='',lastCheckpointPhase='',savedCheckpoint=null;

function id(){let v;try{v=sessionStorage.getItem('zns2:playerId');}catch{}if(!v){v=crypto.randomUUID?.()||'p'+Date.now().toString(36)+Math.random().toString(36).slice(2);try{sessionStorage.setItem('zns2:playerId',v);}catch{}}return v;}
function clone(v){return JSON.parse(JSON.stringify(v));}
function resetMovement(){
  keys.clear();pointer.attack=false;pointer.drag=false;view.aim=false;
  jumpSeq=state.players[localId]?._jumpSeq||0;
  presentation.reset();prediction.reset();scene.resetCamera?.();
}
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
  if(isHost)return processAction(localId,action);
  network?.sendAction(action);
}
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
        if(!isHost || !active){state=next;jumpSeq=Math.max(jumpSeq,next.players[localId]?._jumpSeq||0);if(!initialSnapshot){for(const e of next.events||[])seenEvents.add(e.id);initialSnapshot=true;}}
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
    resetMovement();active=true;ui.hideEntry();savedCheckpoint=null;lastCheckpointPhase=state.phase;perf.reset();
    if(isHost&&!readCheckpoint())captureCheckpoint();
    audio.setScene(state.phase,state.paused);
    toast(mode==='solo'?'혼자서도 첫 보스까지 테스트할 수 있어요.':'친구들과 원정을 준비해 주세요.');
  }catch(e){network?.close();network=null;active=false;isHost=false;ui.showEntry(e.message||'입장하지 못했어요.');}
  finally{entering=false;ui.setBusy(false);}
}
// Read previous village saves without overwriting their stored payload.
const checkpointKey=()=>`checkpoint:${BUILD}:${room||'solo'}`;
const readCheckpoint=()=>storage.get(checkpointKey())||storage.get(`checkpoint:s2-007:${room||'solo'}`)||storage.get('checkpoint:'+(room||'solo'));
function captureCheckpoint(){
  if(!isHost)return;
  // sim stores the expedition-start checkpoint for retries; retain it on mid-battle saves.
  savedCheckpoint=clone(state);
  const payload={version:BUILD,season:2,savedAt:new Date().toISOString(),hostId:localId,state:savedCheckpoint};
  if(!storage.set(checkpointKey(),JSON.stringify(payload)))toast('이 기기에 저장할 공간이 부족해요.');
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
    const saved=JSON.parse(readCheckpoint()||'null');
    const next=migrateCheckpoint(saved);
    if(!validState(next))throw Error('이 방에서 이어갈 수 있는 시즌2 저장이 없어요.');
    const mine=state.players[localId];
    if(saved.hostId!==localId){delete next.players[saved.hostId];next.players[localId]={...mine,x:SPAWN.x,z:SPAWN.z};}
    // A checkpoint must not rewind a connected client's consumed jump counter:
    // its next ordinary input packet would otherwise replay an old jump.
    for(const p of Object.values(next.players)){
      p._jumpSeq=Math.max(p._jumpSeq||0,state.players[p.id]?._jumpSeq||0,inputs[p.id]?.jumpSeq||0);
      p.online=p.id===localId;
    }
    sim.restoreVillagePositions(next);
    state=next;state.paused=false;reconcileRoster();resetMovement();savedCheckpoint=clone(state);seenEvents=new Set((state.events||[]).map(e=>e.id));toast('마지막 확정 지점에서 이어갑니다.');
  }catch(e){toast(e.message);}
}
function leave(){network?.close();network=null;active=false;isHost=false;document.exitPointerLock?.();audio.setScene('lobby',true);state=sim.createState();sim.addPlayer(state,{id:'preview',name:'원정대',team:0,hat:0});resetMovement();ui.showEntry();}
function record(){
  const graphics=scene.stats();
  const data=perf.report({mode,room,viewport:[innerWidth,innerHeight],devicePixelRatio,pixelRatio:graphics.pixelRatio,aaSamples:graphics.aaSamples,host:isHost});
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='시즌2-성능-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('성능 기록을 내려받았어요.');
}
const ui=createUI({enter,action:dispatch,sound(kind,value){audio.setVolume(kind,value);audio.unlock();},leave,save,load,record,cameraReset(){view.yaw=0;view.pitch=SEASON1_CAMERA.pitch;view.zoom=SEASON1_CAMERA.zoom;view.aim=false;scene.resetCamera?.();}});
function interactive(target){return !!target?.closest?.('input,textarea,select,button,[contenteditable=true]');}
window.addEventListener('keydown',e=>{
  if(interactive(e.target)||!active)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space'&&!state.paused&&state.players[localId]?.hp>0&&!['victory','defeat'].includes(state.phase))jumpSeq++;
  if(e.code==='Escape'){pointer.attack=false;view.aim=false;}
  if(e.code==='KeyE')dispatch({type:'interact'});
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function stopInput(){keys.clear();pointer.attack=false;pointer.drag=false;view.aim=false;if(active&&!isHost){network?.sendInput({mx:0,mz:0,yaw:view.yaw,attack:false,sprint:false,jump:false,jumpSeq,aim:false});}}
window.addEventListener('blur',stopInput);
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas)stopInput();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(!active)return;audio.unlock();pointer.x=e.clientX;pointer.y=e.clientY;
  if(e.button===2){view.aim=!view.aim;pointer.drag=document.pointerLockElement!==canvas;canvas.setPointerCapture?.(e.pointerId);return;}
  if(e.button!==0)return;
  const locked=document.pointerLockElement===canvas;
  pointer.attack=true;
  // Only an explicit click requests capture. Tests use pw.mjs, which blocks it.
  if(!locked){try{canvas.requestPointerLock?.()?.catch?.(()=>{});}catch{}}
});
window.addEventListener('pointerup',e=>{if(e.button===0)pointer.attack=false;if(e.button===2)pointer.drag=false;});
window.addEventListener('pointermove',e=>{const locked=document.pointerLockElement===canvas;pointer.x=locked?innerWidth/2:e.clientX;pointer.y=locked?innerHeight/2:e.clientY;if(locked||pointer.drag){view.yaw-=e.movementX*SEASON1_CAMERA.mouseSensitivity;view.pitch=Math.max(-1.5,Math.min(1.5,view.pitch-e.movementY*SEASON1_CAMERA.mouseSensitivity));}});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoom=season1Zoom(view.zoom,e.deltaY);},{passive:false});
document.addEventListener('visibilitychange',()=>{stopInput();last=performance.now();if(document.hidden&&active&&isHost){state.paused=true;state._manualPause=true;network?.publish(state);setTimeout(()=>{if(document.hidden&&active&&isHost)network?.publish(state);},150);}});
function input(){
  const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  const r=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  let mx=-Math.sin(view.yaw)*f+Math.cos(view.yaw)*r,mz=-Math.cos(view.yaw)*f-Math.sin(view.yaw)*r;
  const n=Math.hypot(mx,mz);if(n>1){mx/=n;mz/=n;}
  return {mx,mz,yaw:view.yaw,attack:pointer.attack,sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),jump:keys.has('Space'),jumpSeq,aim:view.aim};
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
    if(isHost&&!manual&&connected){accumulator=Math.min(accumulator+dt,.2);while(accumulator>=1/60){sim.step(state,1/60,inputs);accumulator-=1/60;}}
    inputTimer+=dt;networkTimer+=dt;
    if(!isHost&&inputTimer>=.05){inputTimer=0;network?.sendInput(current);}
    if(isHost&&networkTimer>=.1){networkTimer=0;network?.publish(state);}
    if(state.phase!==lastCheckpointPhase){lastCheckpointPhase=state.phase;if(isHost&&['village','victory'].includes(state.phase))captureCheckpoint();}
    audio.setScene(state.phase,state.paused);
    for(const ev of state.events||[]){if(seenEvents.has(ev.id))continue;seenEvents.add(ev.id);audio.event(ev,state.players[localId]);}
    if(seenEvents.size>160)seenEvents=new Set((state.events||[]).map(e=>e.id));
    const msg=state.feedback?.[localId];if(msg&&msg.id!==lastFeedback){lastFeedback=msg.id;toast(msg.message);}
  }
  const displayId=active?localId:'preview';
  const predicted=active&&!isHost&&!manual&&connected?prediction.sample(state,localId,dt,input()):null;
  const displayed=presentation.sample(state,displayId,dt,{interpolate:active&&!isHost,localPlayer:predicted,time:now/1000});
  scene.render(displayed,displayId,dt,view);
  audio.motion(displayed?.players?.[displayId],dt,{phase:state.phase,paused:!active||state.paused});audio.update(dt);
  const stats=scene.stats();
  if(active&&!state.paused)perf.frame(elapsed,performance.now()-begin,stats,state);
  uiTimer+=dt;if(uiTimer>=.15){uiTimer=0;ui.update(state,{localId,isHost,room,mode,network:connected,fps:perf.fps,stats,volumes:audio.getVolumes(),notice});}
}
requestAnimationFrame(frame);
if(new URLSearchParams(location.search).get('test')==='1')window.__S2={getState:()=>state,getInput:input,view,sim,act:dispatch,step:(dt,all={})=>sim.step(state,dt,all),scene,audio,perf,setState(next){state=next;presentation.reset();prediction.reset();},setManual(v){manual=v;}};
window.addEventListener('beforeunload',()=>network?.close());
