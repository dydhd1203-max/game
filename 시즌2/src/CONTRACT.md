# 구현 계약 — s2-001

각 구현자는 자신의 파일만 수정한다. content.mjs는 root가 관리한다. 모듈은 브라우저 ESM이며 three는 ../vendor/three.module.js를 사용한다. 시즌1 파일은 수정하지 않는다.

## 공통 상태

JSON 상태: {version:'s2-001', phase:'lobby'|'village'|'forest'|'boss'|'victory'|'defeat', paused:false, time:0, stage:0, supplies:600, players:{[id]:{id,name,team:0..4,hat:0..16,face:0..11,clothes:0..13,x,z,yaw,hp,maxHp,online,downUntil}}, towers:[], enemies:[], boss:null, events:[], beacon:false, message:''}.
타워: {id,type:'arrow'|'ice',team,x,z,hp,maxHp,state:'deployed'|'packing'|'carried'|'placing'|'inventory'|'destroyed',carrier:null,progress:0}. 적: {id,x,z,yaw,hp,maxHp,kind:'zombie'|'brute',frost:0}. 보스: {id:'boss',x,z,yaw,hp,maxHp,phase:'idle'|'warn'|'charge'|'recover',timer,dx,dz}. 이벤트: {id,kind,x,z,tx?,tz?} 최대 최근 40개.

## sim.mjs

export createState(), addPlayer(state,profile), setOnline(state,id,bool), applyAction(state,id,action,{teacher:false}), step(state,dt,inputs).
inputs는 {id:{mx,mz,yaw,attack}}이며 mx/mz는 세계 좌표 이동 벡터, yaw는 라디안이다. 호스트가 30Hz step; snapshot은 10Hz 이하. applyAction은 {ok,error?} 반환. 행동 type: start(대기실→마을), depart(마을→숲), pause, retry, return, build({towerType,x,z}), pack({towerId}), deploy({towerId,x,z}), repair({towerId}), interact, cosmetic({hat}), ready. 교사 행동은 start/depart/pause/retry/return. interaction은 근처 봉화·보스 입구·쓰러진 친구. IDs는 모두 호스트가 발급하며 action sequence 중복 방지는 net 계층이다.

## scene.mjs

export createScene(canvas): {render(state,localId,dt,{yaw,pitch,distance,placement}), pick(clientX,clientY), stats(), dispose()}. render는 이동 후 상태를 사용. camera는 지정 yaw/pitch/distance의 3인칭; 전방 벡터는 (-sin(yaw),-cos(yaw)), yaw0은 -z. pick은 지면 {x,z} 반환. placement는 null 또는 {x,z,type,valid}. stats는 {calls,triangles,geometries,textures}. 렌더러 성능 측정은 root에서 감싼다. render 중 새 state 객체를 매 프레임 생성하지 않는다.

## audio.mjs

export createAudio(): {unlock(), setScene(phase,paused), event(event,listener), setVolume(kind,value), getVolumes(), update(dt), dispose()}. phase는 위 게임 phase. event.kind는 shoot/arrow/ice/shatter/hit/down/revive/build/pack/beacon/warn/charge/victory. listener={x,z,yaw}. 볼륨kind='bgm'|'sfx',value=0..100.

## ui.mjs / index.html / style.css

export createUI(handlers): {update(state,context),toast(message),showEntry(error?),hideEntry(),setBusy(bool)}.
handlers: enter({mode:'solo'|'host'|'join',name,team,hat,room,password}), action(action), selectTower(type|null), sound(kind,value), leave(), save(), load(), record(), cameraReset().
context: {localId,isHost,room,mode,network,selectedTower,placementHint,fps,stats:{calls,triangles},volumes:{bgm,sfx},notice}.
HTML은 canvas#game과 root#ui를 포함하며 src/app.mjs로 시작한다. 大기실이동·모둠·꾸미기·교사 시작; teacher buttons; HUD·보스HP·목표·모듈·음량·성능·조작도움·승리/실패. 실제 게임정보 외 개발세부는 사용설명문서에 둔다.

## net.mjs

export createNetwork({onSnapshot,onRoster,onInput,onAction,onStatus}): object with async connect({mode,room,profile}), publish(state), sendInput(input), sendAction(action), close(), isHost, room.
profile={id,name,team,hat,face,clothes}; connect returns {isHost,room}. callbacks roster array profiles with online bool; input(id,input); action(id,action), snapshot(state), status(string). solo means offline host. Host teacher approval is UI/app local; existing public firebase config use separate named app and content.mjs의 DB_ROOT. Network validates version, exclusive host session, presence, reconnect, state delivery, bounded writes/command IDs. Root authorizes teacher actions only if id=hostId.
