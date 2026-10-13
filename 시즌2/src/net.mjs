/** Season 2 classroom transport. The public Firebase project is not a security boundary. */
import {BUILD,DB_ROOT} from './content.mjs';
export const NETWORK_VERSION = BUILD;
export {DB_ROOT};
export const NET_STATUS = Object.freeze({connected:'연결됨', disconnected:'연결 끊김', hostLost:'호스트 연결 끊김', replaced:'다른 창에서 접속됨'});
const CONFIG = Object.freeze({
  apiKey:'AIzaSyDhSjj0njnKPrtQVbxyol_ipjIUxUkqb0A',
  authDomain:'sheep-night.firebaseapp.com',
  databaseURL:'https://sheep-night-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:'sheep-night', storageBucket:'sheep-night.firebasestorage.app',
  messagingSenderId:'113615361729', appId:'1:113615361729:web:5472c874a949dcb82de640',
});
const MAX_PLAYERS = 21;
let sdkPromise;

async function loadSDK() {
  if (globalThis.firebase?.database) return globalThis.firebase;
  if (!sdkPromise) sdkPromise = (async () => {
    if (!globalThis.document) throw new Error('온라인 연결은 브라우저에서 열어 주세요.');
    for (const file of ['firebase-app-compat.js', 'firebase-database-compat.js']) {
      if (file.startsWith('firebase-app') && globalThis.firebase?.initializeApp) continue;
      await new Promise((resolve,reject) => {
        const script=document.createElement('script');
        script.src=`https://www.gstatic.com/firebasejs/9.23.0/${file}`;
        script.async=true;
        const timeout=setTimeout(() => {script.remove();reject(new Error('연결 도구를 불러오지 못했어요. 인터넷을 확인해 주세요.'));},15000);
        script.onload=() => {clearTimeout(timeout);resolve();};
        script.onerror=() => {clearTimeout(timeout);script.remove();reject(new Error('연결 도구를 불러오지 못했어요.'));};
        document.head.appendChild(script);
      });
    }
    return globalThis.firebase;
  })().catch(error => {sdkPromise=null;throw error;});
  return sdkPromise;
}

function localStore() { try {return globalThis.localStorage;} catch {return null;} }
function randomId() {
  const bytes=new Uint8Array(24);
  if (!globalThis.crypto?.getRandomValues) throw new Error('안전한 접속 주소(HTTPS 또는 localhost)로 열어 주세요.');
  crypto.getRandomValues(bytes);
  return Array.from(bytes,n => n.toString(16).padStart(2,'0')).join('');
}
async function tokenHash(token) {
  if (!globalThis.crypto?.subtle) throw new Error('온라인 방은 HTTPS 또는 localhost에서 열어 주세요.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),n => n.toString(16).padStart(2,'0')).join('');
}
function cleanRoom(value) {
  const room=String(value || '').trim().toUpperCase();
  if (!/^[A-Z0-9가-힣_-]{1,24}$/.test(room)) throw new Error('방 이름은 한글·영문·숫자·밑줄로 1~24자 입력해 주세요.');
  return room;
}
function cleanProfile(value) {
  const id=String(value?.id || '');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('참가자 정보가 올바르지 않아요. 다시 입장해 주세요.');
  const choice=(v,max)=>Math.max(0,Math.min(max,Math.trunc(Number(v)||0)));
  return {id,name:String(value.name || '원정대원').trim().slice(0,20) || '원정대원',team:choice(value.team,4),hat:choice(value.hat,16),face:choice(value.face,11),clothes:choice(value.clothes,13)};
}
function cleanInput(value) {
  const finite=(n) => Number.isFinite(n) ? n : 0;
  return {mx:Math.max(-1,Math.min(1,finite(value?.mx))),mz:Math.max(-1,Math.min(1,finite(value?.mz))),
    yaw:finite(value?.yaw) % (Math.PI*2),attack:!!value?.attack,
    sprint:value?.sprint===true,jump:value?.jump===true,aim:value?.aim===true,
    jumpSeq:Number.isSafeInteger(value?.jumpSeq)&&value.jumpSeq>=0?value.jumpSeq:0};
}
function cleanAction(value) {
  if (!value || typeof value.type!=='string' || value.type.length>24) return null;
  const action={type:value.type};
  for (const key of ['towerType','towerId','x','z','hat','face','clothes']) {
    const v=value[key];
    if (typeof v==='string' && v.length<=100 || typeof v==='number' && Number.isFinite(v)) action[key]=v;
  }
  return action;
}
const activeMember = member => !!(member?.session && member.sessions?.[member.session]);
const validSnapshot = value => value?.version===NETWORK_VERSION && value.state?.version===NETWORK_VERSION && typeof value.state.players==='object' && typeof value.state.phase==='string';
function bounded(promise) {
  let timer;
  return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('연결 시간이 길어지고 있어요. 인터넷을 확인한 뒤 다시 입장해 주세요.')),15000);})]).finally(()=>clearTimeout(timer));
}

/** database/storage/clock/timers are injection seams for deterministic offline tests. */
export function createNetwork({onSnapshot=()=>{},onRoster=()=>{},onInput=()=>{},onAction=()=>{},onStatus=()=>{},database,storage=localStore(),clock=()=>Date.now(),timers=globalThis}={}) {
  let mode=null,room='',profile=null,session='',meta=null,db=null,base=null,host=false,closed=true,epoch=0;
  let members={},lastStatus='',connected=false,lastHeartbeat=0,inputSeq=0,actionSeq=0,snapshotSeq=0,lastSnapshotSeq=-1;
  let lastInputAt=-Infinity,lastPublishAt=-Infinity,publishing=false,pendingState=null,inputPublishing=false,pendingInput=null,heartbeatTimer=null,watchdogTimer=null;
  const listeners=[],disconnects=[],inputSeen=new Map(),actionSeen=new Map(),pendingWrites=new Set();

  const status=value => {if(value!==lastStatus){lastStatus=value;onStatus(value);}};
  const listen=(ref,event,fn) => {
    const generation=epoch;
    const callback=snapshot => {if (!closed && epoch===generation) fn(snapshot);};
    const cancel=error => {if (!closed && epoch===generation) status(`연결 실패: ${error.message || '접근 권한을 확인해 주세요.'}`);};
    listeners.push({ref,event,callback});ref.on(event,callback,cancel);
  };
  const write=promise => {
    const generation=epoch;
    const tracked=Promise.resolve(promise).catch(error => {if(!closed && epoch===generation) status(`전송 실패: ${error.message || '인터넷을 확인해 주세요.'}`);}).finally(()=>pendingWrites.delete(tracked));
    pendingWrites.add(tracked);return tracked;
  };
  function emitRoster() {
    const roster=Object.values(members).filter(m=>m?.id).map(m=>({id:m.id,name:m.name,team:m.team,hat:m.hat,face:m.face ?? 0,clothes:m.clothes ?? 0,online:activeMember(m)}));
    onRoster(roster);
    if (!connected || !meta) return;
    if (profile && members[profile.id]?.session && members[profile.id].session!==session) {status(NET_STATUS.replaced);return;}
    const teacher=members[meta.hostId];
    if (!teacher || !activeMember(teacher) || teacher.session!==meta.session) status(NET_STATUS.hostLost);
    else status(NET_STATUS.connected);
  }
  function senderValid(id,packet) {
    return packet && packet.hostSession===meta?.session && packet.session===members[id]?.session && activeMember(members[id]) && Number.isSafeInteger(packet.seq) && packet.seq>0;
  }
  function receiveInput(snap) {
    if (!host || meta?.session!==session) return;
    const packet=snap.val(),id=snap.key;
    if (!senderValid(id,packet)) return;
    const previous=inputSeen.get(id);
    if (previous?.session===packet.session && previous.seq>=packet.seq) return;
    inputSeen.set(id,{session:packet.session,seq:packet.seq});onInput(id,cleanInput(packet.input));
  }
  function receiveAction(snap) {
    if (!host || meta?.session!==session) return;
    const packet=snap.val(),id=packet?.id;
    if (senderValid(id,packet)) {
      const key=`${id}:${packet.session}`,previous=actionSeen.get(key)||0;
      if (packet.seq>previous) {
        actionSeen.set(key,packet.seq);
        const action=cleanAction(packet.action);
        if (action) onAction(id,action);
      }
    }
    // Remove processed/stale commands so the room never accumulates an event log.
    write(snap.ref.remove());
  }
  function checkGeneration(generation) {if(closed || epoch!==generation) throw new Error('입장이 취소되었어요.');}

  async function connect(options) {
    await close();
    const generation=++epoch;
    closed=false;lastStatus='';mode=options?.mode;profile=cleanProfile(options?.profile);
    host=mode==='host'||mode==='solo';session=randomId();
    inputSeq=actionSeq=snapshotSeq=0;lastSnapshotSeq=-1;lastInputAt=lastPublishAt=-Infinity;
    inputSeen.clear();actionSeen.clear();members={};meta=null;
    try {
      if (mode==='solo') {
        room='';connected=true;meta={hostId:profile.id,session,version:NETWORK_VERSION};
        onRoster([{...profile,online:true}]);status('혼자 플레이');
        return {isHost:true,room:'',hostId:profile.id,localId:profile.id,snapshot:null,resumed:false};
      }
      if (mode!=='host' && mode!=='join') throw new Error('입장 방식을 선택해 주세요.');
      room=cleanRoom(options.room);status('연결 중');
      if (database) db=database;
      else {
        const sdk=await loadSDK();checkGeneration(generation);
        const app=sdk.apps.find(app=>app.name==='zombie-night-season2') || sdk.initializeApp(CONFIG,'zombie-night-season2');
        db=app.database();
      }
      base=db.ref(`${DB_ROOT}/${room}`);
      let savedSnapshot=null,resumed=false;
      if (host) {
        let token;
        try {token=storage?.getItem(`zns2:host:${room}`);} catch {}
        if (!/^[a-f0-9]{48}$/.test(token || '')) {
          token=randomId();
          try {if(!storage) throw new Error();storage.setItem(`zns2:host:${room}`,token);} catch {throw new Error('방을 다시 열 수 있도록 브라우저 저장 공간을 허용해 주세요.');}
        }
        const key=await tokenHash(token);checkGeneration(generation);
        const result=await bounded(base.child('meta').transaction(current=> {
          if (closed || epoch!==generation) return;
          if (current && (current.version!==NETWORK_VERSION || current.hostKey!==key)) return;
          return {...current,version:NETWORK_VERSION,hostId:current?.hostId || profile.id,hostKey:key,session,heartbeat:clock(),createdAt:current?.createdAt || clock()};
        }));
        checkGeneration(generation);
        if (!result.committed) throw new Error('이미 사용 중이거나 다른 버전의 방이에요. 원래 선생님 기기로 열거나 새 방 이름을 사용해 주세요.');
        meta=result.snapshot.val();profile={...profile,id:meta.hostId};
        const old=(await bounded(base.child('snapshot').once('value'))).val();checkGeneration(generation);
        if (validSnapshot(old)) {savedSnapshot=old.state;resumed=true;onSnapshot(savedSnapshot);}
      } else {
        meta=(await bounded(base.child('meta').once('value'))).val();checkGeneration(generation);
        if (!meta) throw new Error('아직 없는 방이에요. 선생님이 방을 연 뒤 입장해 주세요.');
        if (meta.version!==NETWORK_VERSION) throw new Error('방의 게임 버전이 달라요. 모두 같은 주소를 새로 열어 주세요.');
        if (profile.id===meta.hostId) throw new Error('이 기기는 선생님으로 방을 열어 다시 입장해 주세요.');
        const latest=(await bounded(base.child('snapshot').once('value'))).val();checkGeneration(generation);
        if (latest && !validSnapshot(latest)) throw new Error('저장된 게임 버전이 달라요. 모두 같은 주소를 새로 열어 주세요.');
        if (latest && latest.hostSession===meta.session && Number.isSafeInteger(latest.seq)) {
          savedSnapshot=latest.state;lastSnapshotSeq=latest.seq;onSnapshot(savedSnapshot);
        }
      }
      const presenceRef=base.child(`members/${profile.id}/sessions/${session}`);
      const disconnected=presenceRef.onDisconnect();disconnects.push(disconnected);await bounded(disconnected.remove());checkGeneration(generation);
      const admission=await bounded(base.child('members').transaction(current => {
        if (closed || epoch!==generation) return;
        const next=current || {};
        const active=Object.values(next).filter(activeMember).length;
        if (!activeMember(next[profile.id]) && active>=MAX_PLAYERS) return;
        return {...next,[profile.id]:{...profile,session,sessions:{[session]:{joinedAt:clock()}}}};
      }));
      checkGeneration(generation);
      if (!admission.committed) throw new Error(`이 방은 최대 ${MAX_PLAYERS}명까지 입장할 수 있어요.`);
      members=admission.snapshot.val() || {};
      listen(db.ref('.info/connected'),'value',snap=> {
        connected=snap.val()===true;
        if (!connected) {status(NET_STATUS.disconnected);return;}
        // onDisconnect is one-shot; reconnect arms it before restoring our own session.
        const hook=presenceRef.onDisconnect();disconnects.push(hook);
        write(hook.remove().then(async()=> {
          if (closed || epoch!==generation) return;
          const own=(await base.child(`members/${profile.id}`).once('value')).val();
          if (closed || epoch!==generation) return;
          if (own?.session!==session) {status(NET_STATUS.replaced);return;}
          await presenceRef.set({joinedAt:clock()});
          if (!closed && epoch===generation) emitRoster();
        }));
      });
      listen(base.child('members'),'value',snap => {members=snap.val() || {};emitRoster();});
      listen(base.child('meta'),'value',snap=> {
        const next=snap.val();
        if (!next || next.version!==NETWORK_VERSION) {status('연결 실패: 방이 닫혔거나 버전이 달라요.');return;}
        if (host && next.session!==session) {meta=next;status(NET_STATUS.replaced);return;}
        if (next.session!==meta?.session) {lastSnapshotSeq=-1;inputSeen.clear();actionSeen.clear();}
        meta=next;lastHeartbeat=clock();emitRoster();
      });
      if (host) {
        listen(base.child('inputs'),'child_added',receiveInput);
        listen(base.child('inputs'),'child_changed',receiveInput);
        listen(base.child('commands'),'child_added',receiveAction);
        heartbeatTimer=timers.setInterval(()=> {
          if (closed || !connected || meta?.session!==session) return;
          write(base.child('meta').transaction(current=>current?.session===session ? {...current,heartbeat:clock()} : undefined));
        },5000);
      } else {
        listen(base.child('snapshot'),'value',snap=> {
          const packet=snap.val();
          if (!packet) return;
          if (!validSnapshot(packet)) {status('연결 실패: 저장된 게임 버전이 달라요.');return;}
          if (packet.hostSession!==meta?.session || !Number.isSafeInteger(packet.seq) || packet.seq<=lastSnapshotSeq) return;
          lastSnapshotSeq=packet.seq;onSnapshot(packet.state);
        });
        watchdogTimer=timers.setInterval(()=> {
          if (!closed && connected && clock()-lastHeartbeat>20000) status(NET_STATUS.hostLost);
        },5000);
      }
      return {isHost:host,room,hostId:meta.hostId,localId:profile.id,snapshot:savedSnapshot,resumed};
    } catch(error) {
      if (epoch===generation) {await close();status(`연결 실패: ${error.message}`);}
      throw error;
    }
  }

  function publish(state) {
    if (closed || !host || mode==='solo' || !connected || meta?.session!==session || state?.version!==NETWORK_VERSION) return;
    const now=clock();
    if (now-lastPublishAt<100) return;
    lastPublishAt=now;
    // Only one Firebase write is in flight, with one newest state waiting behind it.
    // Snapshot clone freezes the mutable simulation at its publication instant.
    pendingState=JSON.parse(JSON.stringify(state));
    if (publishing) return;
    publishing=true;const generation=epoch;
    write((async()=> {
      try {
        while (pendingState && !closed && epoch===generation && connected && meta?.session===session) {
          const next=pendingState;pendingState=null;
          await base.child('snapshot').set({version:NETWORK_VERSION,hostSession:session,seq:++snapshotSeq,state:next});
        }
      } finally {if(epoch===generation) publishing=false;}
    })());
  }
  function sendInput(value) {
    if (closed || !connected || lastStatus===NET_STATUS.replaced) return;
    const input=cleanInput(value);
    if (host) {if(mode==='solo'||meta?.session===session) onInput(profile.id,input);return;}
    const now=clock();if(now-lastInputAt<50)return;lastInputAt=now;
    pendingInput=input;
    if (inputPublishing) return;
    inputPublishing=true;const generation=epoch;
    write((async()=> {
      try {
        while(pendingInput && !closed && epoch===generation && connected) {
          const next=pendingInput;pendingInput=null;
          await base.child(`inputs/${profile.id}`).set({session,hostSession:meta.session,seq:++inputSeq,input:next});
        }
      } finally {if(epoch===generation)inputPublishing=false;}
    })());
  }
  function sendAction(value) {
    const action=cleanAction(value);
    if (!action || closed || !connected || lastStatus===NET_STATUS.replaced) return;
    if (host) {if(mode==='solo'||meta?.session===session)onAction(profile.id,action);return;}
    if (pendingWrites.size>=16) {status('전송 대기 중이에요. 잠시 후 다시 눌러 주세요.');return;}
    const seq=++actionSeq;
    write(base.child(`commands/${session}_${String(seq).padStart(10,'0')}`).set({id:profile.id,session,hostSession:meta.session,seq,action}));
  }
  async function close() {
    if (closed) return;
    closed=true;++epoch;connected=false;pendingState=pendingInput=null;publishing=inputPublishing=false;
    for(const {ref,event,callback} of listeners.splice(0)) ref.off(event,callback);
    if(heartbeatTimer!==null)timers.clearInterval(heartbeatTimer);
    if(watchdogTimer!==null)timers.clearInterval(watchdogTimer);
    heartbeatTimer=watchdogTimer=null;
    const hooks=disconnects.splice(0);
    // An offline Firebase write can stay pending indefinitely. Detach immediately;
    // retain the server disconnect hook until the presence removal is acknowledged.
    const removal=base && profile && session ? base.child(`members/${profile.id}/sessions/${session}`).remove() : Promise.resolve();
    Promise.resolve(removal).then(()=>Promise.allSettled(hooks.map(hook=>hook.cancel()))).catch(()=>{});
    pendingWrites.clear();
    base=null;db=null;host=false;mode=null;members={};inputSeen.clear();actionSeen.clear();
  }
  return {connect,publish,sendInput,sendAction,close,get isHost(){return host;},get room(){return room;},get hostId(){return meta?.hostId || null;},get localId(){return profile?.id || null;}};
}
