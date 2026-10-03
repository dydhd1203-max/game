/* Classroom input, legal navigation and avatar seating. All room artwork is
   supplied separately by QPSchoolRoomScene; this controller draws no map art. */
(() => {
  'use strict';
  const KEYS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
  const SPEED=225, RUN_SPEED=337.5, AVATAR_HEIGHT=96, RADIUS=7;
  let portalReadyAt=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const textIfChanged=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  const element=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
  const rect=o=>({x:finite(o.x),y:finite(o.y),w:finite(o.width??o.w),h:finite(o.height??o.h)});
  function inPolygon(x,y,points){
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j],ax=finite(a.x??a[0]),ay=finite(a.y??a[1]),bx=finite(b.x??b[0]),by=finite(b.y??b[1]);
      if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside;
  }
  function createNavigation(scene,options={}) {
    const radius=finite(options.radius,RADIUS),step=finite(options.step,12),width=finite(scene.width),height=finite(scene.height);
    const level=finite(options.height)?scene.levels?.find(l=>l.height===finite(options.height)):null;
    if(finite(options.height))scene={...scene,walkAreas:level?.walkAreas||[],solids:level?.solids||[]};
    const solids=Array.isArray(scene.solids)?scene.solids:[], cols=Math.floor(width/step)+1,rows=Math.floor(height/step)+1,walkCache=new Map();
    const buckets=new Map(),bucketSize=96;
    for(const solid of solids){
      if(solid.disabled)continue;const prepared={...solid,...rect(solid)};
      if(solid.points){prepared.points=solid.points.map(p=>({x:finite(p.x??p[0]),y:finite(p.y??p[1])}));prepared.x=Math.min(...prepared.points.map(p=>p.x));prepared.y=Math.min(...prepared.points.map(p=>p.y));prepared.w=Math.max(...prepared.points.map(p=>p.x))-prepared.x;prepared.h=Math.max(...prepared.points.map(p=>p.y))-prepared.y;}
      if(solid.radius!=null){prepared.x=solid.x-solid.radius;prepared.y=solid.y-solid.radius;prepared.w=solid.radius*2;prepared.h=solid.radius*2;prepared.cx=solid.x;prepared.cy=solid.y;}
      for(let by=Math.floor((prepared.y-radius)/bucketSize);by<=Math.floor((prepared.y+prepared.h+radius)/bucketSize);by++)for(let bx=Math.floor((prepared.x-radius)/bucketSize);bx<=Math.floor((prepared.x+prepared.w+radius)/bucketSize);bx++){const key=bx+','+by;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(prepared);}
    }
    const walkAreas=scene.walkAreas||scene.walkableAreas||null;
    function legal(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<radius||y<radius||x>width-radius||y>height-radius)return false;
      if(walkAreas&&!walkAreas.some(area=>{if(area.points)return inPolygon(x,y,area.points);const r=rect(area);return x>=r.x+radius&&x<=r.x+r.w-radius&&y>=r.y+radius&&y<=r.y+r.h-radius;}))return false;
      for(const solid of buckets.get(Math.floor(x/bucketSize)+','+Math.floor(y/bucketSize))||[]){
        if(solid.points){
          if(inPolygon(x,y,solid.points))return false;
          for(let i=0;i<solid.points.length;i++){
            const a=solid.points[i],b=solid.points[(i+1)%solid.points.length],ax=finite(a.x??a[0]),ay=finite(a.y??a[1]),bx=finite(b.x??b[0]),by=finite(b.y??b[1]);
            const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
            if(Math.hypot(x-ax-t*dx,y-ay-t*dy)<radius)return false;
          }
        }else if(solid.radius!=null){if(Math.hypot(x-solid.cx,y-solid.cy)<radius+solid.radius)return false;}
        else if(solid.w>0&&solid.h>0&&Math.hypot(x-clamp(x,solid.x,solid.x+solid.w),y-clamp(y,solid.y,solid.y+solid.h))<radius)return false;
      }
      return true;
    }
    const line=(a,b)=>{const count=Math.ceil(distance(a,b)/Math.max(2,radius*.6));for(let i=0;i<=count;i++)if(!legal(a.x+(b.x-a.x)*i/(count||1),a.y+(b.y-a.y)*i/(count||1)))return false;return true;};
    const gridPoint=id=>({x:(id%cols)*step,y:Math.floor(id/cols)*step});
    const gridLegal=id=>{if(!walkCache.has(id)){const p=gridPoint(id);walkCache.set(id,legal(p.x,p.y));}return walkCache.get(id);};
    function gridNear(point){
      const cx=Math.round(point.x/step),cy=Math.round(point.y/step);let best=null,bestDistance=Infinity;
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=cx+dx,y=cy+dy,id=y*cols+x;if(x<0||y<0||x>=cols||y>=rows||!gridLegal(id))continue;const p=gridPoint(id),d=distance(point,p);if(d<bestDistance&&line(point,p)){bestDistance=d;best=id;}}
      return best;
    }
    function route(start,end){
      if(!legal(start.x,start.y)||!legal(end.x,end.y))return null;
      if(line(start,end))return [{x:end.x,y:end.y}];
      const first=gridNear(start),last=gridNear(end);if(first==null||last==null)return null;
      const scores=new Map([[first,0]]),previous=new Map(),closed=new Set(),heap=[];
      const heuristic=id=>distance(gridPoint(id),gridPoint(last));
      const push=(id,f)=>{const n={id,f};let i=heap.length;heap.push(n);while(i>0){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]=n;};
      const pop=()=>{const head=heap[0],tail=heap.pop();if(heap.length){let i=0;heap[0]=tail;while(true){let child=i*2+1;if(child>=heap.length)break;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=tail.f)break;heap[i]=heap[child];i=child;}heap[i]=tail;}return head;};
      push(first,heuristic(first));let visits=0;
      while(heap.length&&visits++<cols*rows){
        const current=pop().id;if(closed.has(current))continue;
        if(current===last){
          const raw=[end];let id=last;while(id!==first){raw.push(gridPoint(id));id=previous.get(id);if(id==null)return null;}raw.push(gridPoint(first));raw.reverse();
          const result=[];let from=start,i=0;
          while(i<raw.length){let j=i;while(j+1<raw.length&&line(from,raw[j+1]))j++;result.push(raw[j]);from=raw[j];i=j+1;}
          return result;
        }
        closed.add(current);const gx=current%cols,gy=Math.floor(current/cols),p=gridPoint(current);
        for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
          const xx=gx+dx,yy=gy+dy,id=yy*cols+xx;if(xx<0||yy<0||xx>=cols||yy>=rows||closed.has(id)||!gridLegal(id))continue;
          if(dx&&dy&&(!gridLegal(gy*cols+xx)||!gridLegal(yy*cols+gx)))continue;
          if(!line(p,gridPoint(id)))continue;const score=scores.get(current)+step*(dx&&dy?Math.SQRT2:1);
          if(score<(scores.get(id)??Infinity)){scores.set(id,score);previous.set(id,current);push(id,score+heuristic(id));}
        }
      }
      return null;
    }
    return Object.freeze({canStand:legal,lineClear:line,route,radius,step});
  }
  function mount(container,options={}) {
    if(!container||typeof options.renderAvatar!=='function')throw new Error('교실과 아바타 렌더러가 필요해요.');
    const source=options.scene||window.QPSchoolRoomScene;if(!source)throw new Error('교실 에셋을 준비하지 못했어요.');
    const scene=typeof source.get==='function'?source.get():source;
    const navigation=new Map(),sittingNavigation=new Map(),unreachable=Object.freeze({canStand:()=>false,lineClear:()=>false,route:()=>null});
    const navAt=(height=0,sitting=false)=>{const cache=sitting?sittingNavigation:navigation,key=finite(height);if(key&&!scene.levels?.some(l=>l.height===key))return unreachable;if(sitting&&scene.levels?.find(l=>l.height===key)?.allowSit===false)return unreachable;if(!cache.has(key))cache.set(key,createNavigation(scene,{height:key,radius:sitting?18:RADIUS,step:key?6:12}));return cache.get(key);};
    let nav=navAt(),floorNav=navAt(0,true),climbing=null;
    const seats=scene.seats||[],interactions=scene.interactables||scene.interactions||[];
    const zone=options.zone||scene.zone||'campus',playground=zone==='playground',outdoors=zone!=='campus',forest=['village','forestgarden','treehouse','skyisland'].includes(zone),title=options.title||scene.title||(outdoors?'우리 반 운동장':'우리 반 교실');
    const idleInteractionText=forest?'입구 가까이에서 F':playground?'학교 문 앞에서 F':'문 앞 F · 칠판 앞 E';
    const isPortal=item=>item.type==='portal'||item.type==='door'&&Boolean(item.target);
    const portalLabel=item=>item.label||(item.target==='campus'?'교실로 들어가기':'운동장 나가기');
    const seatMap=new Map(seats.map(s=>[s.id,s])),user=options.user||{},uid=String(user.uid||user.k||'local'),avatar=user.avatar||user.av||{};
    const spawn=scene.spawn||{x:1430,y:855},saved=options.checkpoint;
    let state={x:spawn.x,y:spawn.y,direction:'front',facing:'right',pose:'idle',moving:false,seatId:null,zone,height:0};
    if(saved&&navAt(saved.height).canStand(saved.x,saved.y)){state.x=saved.x;state.y=saved.y;state.height=finite(saved.height);nav=navAt(state.height);floorNav=navAt(state.height,true);}
    else if(saved){const previous=seats.find(s=>distance({x:finite(saved.x,-1000),y:finite(saved.y,-1000)},{x:finite(s.sitX??s.x),y:finite(s.sitY??s.y)})<12),exit=previous?.exit||previous?.approach;if(exit&&nav.canStand(exit.x,exit.y))state.x=exit.x,state.y=exit.y;}
    const runInput=window.QPRunInput.create();
    const keys=new Set(),heldMovement=new Set(),suppressedMovement=new Set(),heldActions=new Set(),actors=new Map();let dead=false,paused=false,raf=0,last=0,path=[],pending=null,gesture=null,phase=0,lastPublish=0,lastCheckpoint=0,claimToken=0,seating=false,seatPendingId=null,seatedExit=null,seatClaimQueue=Promise.resolve(),transitioning=false,presence=options.presence||null,status={mode:'local'},nearest=null;
    let preferredScale=finite(scene.cameraHome?.zoom,.84),scale=preferredScale,minimumScale=0,camera={x:0,y:0},cameraReady=false,autoFollow=Boolean(saved)||Boolean(scene.centerOnPlayer),noticeTimer=0,poseTurn=0;
    const clockNow=()=>{const time=presence?.getTime?.();return Number.isFinite(time)?time:Date.now();};
    container.classList.add('school-room-host');container.dataset.zone=zone;container.replaceChildren();
    const viewport=element('div','school-room-world');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label',title+'. 방향키나 WASD로 걷기, 같은 방향키 두 번 누른 채 유지하면 달리기, 바닥 클릭으로 이동, C로 '+(outdoors?'원하는 위치':'의자나 바닥')+'에 앉기와 일어나기, 문 앞에서 F로 공간 이동'+(outdoors?'.':', 칠판 앞 E로 수업 열기.'));
    const world=element('div','sr-world');world.style.width=scene.width+'px';world.style.height=scene.height+'px';world.innerHTML=source.render?source.render():scene.markup||'';viewport.append(world);container.append(viewport);
    const effects=(scene.effects||[]).map(e=>({...e,node:world.querySelector('[data-art="'+e.id+'"]')}));
    const destination=element('span','sr-destination');destination.hidden=true;world.append(destination);
    const hud=element('div','sr-hud');hud.innerHTML='<div class="sr-room-title"><strong></strong><span class="sr-network"></span></div><span class="sr-friend-count">함께 있는 친구 <b>1</b></span>';hud.querySelector('strong').textContent=title;container.append(hud);
    const tools=element('div','sr-tools');tools.innerHTML='<button data-tool="help">조작 안내</button><button data-tool="zoom-out">−</button><button data-tool="zoom-in">＋</button><button data-tool="center"></button><button data-tool="exit"></button>';tools.querySelector('[data-tool="zoom-out"]').setAttribute('aria-label',title+' 축소');tools.querySelector('[data-tool="zoom-in"]').setAttribute('aria-label',title+' 확대');tools.querySelector('[data-tool="center"]').textContent=options.centerLabel||scene.centerLabel||(outdoors?'운동장 보기':'교실 보기');tools.querySelector('[data-tool="exit"]').textContent=options.exitLabel||scene.exitLabel||(outdoors?'교실로 돌아가기':'수업 목록');container.append(tools);
    const help=element('div','sr-help');help.hidden=true;help.innerHTML='<b>방향키 · WASD</b> 걷기　<b>같은 방향키 두 번</b> 달리기　<b>바닥 클릭</b> 길 찾아 걷기<br>'+ (outdoors?'<b>C</b> 원하는 곳에 앉기 / 일어나기'+(forest?'':'<br>벤치가 있는 곳도 자유롭게 걸어요.'):'<b>C</b> 의자 가까이서 앉기 / 넓은 바닥에서 앉기 / 일어나기<br><b>의자 클릭</b> 빈자리로 걸어가 앉기')+'<br><b>문 클릭</b> 문 앞으로 걷기　<b>문 앞 F</b> '+(forest?'표시된 장소로 이동':outdoors?'교실로 들어가기':'운동장으로 나가기')+(scene.climbs?.length?'<br><b>사다리·계단 앞 F</b> 나무 데크 오르내리기':'')+'<br><b>손 흔들기 · 인사 버튼</b> 친구에게 인사'+(outdoors?'':'　<b>칠판 앞 E</b> 선생님 수업 열기');container.append(help);
    const controls=element('div','sr-controls');controls.innerHTML='<button data-gesture="wave">👋 손 흔들기</button><button data-gesture="hello">인사</button><button data-gesture="happy">✨ 신나!</button><button data-tool="sit" class="sr-sit">앉기 <small>C</small></button><button class="sr-interact" disabled></button>';container.append(controls);
    const actionButton=controls.querySelector('.sr-interact'),notice=element('div','sr-notice');actionButton.textContent=idleInteractionText;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');container.append(notice);
    let viewportWidth=viewport.clientWidth,viewportHeight=viewport.clientHeight;
    const sitButton=controls.querySelector('[data-tool="sit"]'),zoomOutButton=tools.querySelector('[data-tool="zoom-out"]');
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    function announce(message){notice.textContent=message;notice.classList.add('is-visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('is-visible'),2900);}
    const focus=()=>{if(!dead)viewport.focus({preventScroll:true});};
    function blocked(){return paused||transitioning||document.hidden||options.isPaused?.()||!viewport.isConnected||!viewportWidth||!viewportHeight||Boolean(document.querySelector('#modal.on,[aria-modal="true"]:not([hidden])'));}
    function cleanAvatar(av){const result={...avatar,...av,bg:'',frame:''};return options.validateAvatar?options.validateAvatar(result):result;}
    function updateArt(actor,av){
      const clean=cleanAvatar(av),key=JSON.stringify(clean);if(actor.avatarKey===key)return;
      if(actor.svg)window.QPAvatarPose?.destroy(actor.svg);
      actor.avatarKey=key;actor.poseKey='';actor.art.innerHTML=options.renderAvatar(clean,AVATAR_HEIGHT,3);actor.svg=actor.art.querySelector('svg');
      const view=actor.svg?.viewBox.baseVal,vh=view?.height||56,vw=view?.width||32,foot=Number(actor.svg?.querySelector('.qpx-contact-shadow')?.getAttribute('cy'))||52.37;
      const paintedHeight=actor.svg?.height.baseVal.value||AVATAR_HEIGHT,paintedWidth=actor.svg?.width.baseVal.value||paintedHeight*vw/vh,footHeight=paintedHeight*foot/vh;
      actor.art.style.left=-paintedWidth/2+'px';actor.art.style.top=-footHeight+'px';actor.name.style.top=-(footHeight+17)+'px';actor.bubble.style.top=-(footHeight+43)+'px';
      window.QPAvatarPose?.prepare(actor.svg);
    }
    function makeActor(player,self){
      const node=element('div','sr-actor'+(self?' is-me':''));node.dataset.uid=String(player.uid);const art=element('div','sr-avatar'),name=element('span','sr-player-name',String(player.name||'친구')+(self?' · 나':'')),bubble=element('span','sr-bubble');bubble.hidden=true;node.append(art,name,bubble);world.append(node);
      const actor={node,art,name,bubble,svg:null,poseKey:'',poseSlot:actors.size%6,avatarKey:'',current:{x:player.x,y:player.y},target:player,self};updateArt(actor,player.avatar||avatar);
      if(!self){node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',String(player.name||'친구')+'에게 인사하기');node.addEventListener('click',e=>{e.stopPropagation();if(distance(state,actor.current)<110)greet('wave');else moveTo(actor.current.x,actor.current.y);focus();});node.addEventListener('keydown',e=>{if(e.code==='Enter'){e.preventDefault();node.click();}});}
      return actor;
    }
    const local=makeActor({uid,name:user.name||'나',avatar,...state},true);actors.set(uid,local);
    function occupied(id){for(const actor of actors.values())if(!actor.self&&actor.target.seatId===id&&actor.target.pose==='sit')return true;return false;}
    const seatPoint=seat=>({x:finite(seat.sitX??seat.x),y:finite(seat.sitY??seat.y)});
    const approach=seat=>seat.approach||seat.exit||seatPoint(seat);
    function seatApproaches(seat){const p=seatPoint(seat),list=[seat.approach,seat.exit,...(seat.approaches||[]),{x:p.x-43,y:p.y},{x:p.x+43,y:p.y}].filter(Boolean);return list.filter((p,i)=>nav.canStand(p.x,p.y)&&list.findIndex(q=>q.x===p.x&&q.y===p.y)===i);}
    function nearbySeat(){let nearestSeat=null,score=Infinity;for(const seat of seats){const d=Math.min(distance(state,seatPoint(seat)),distance(state,approach(seat))+16);if(d<72&&d<score){score=d;nearestSeat=seat;}}return nearestSeat;}
    function stopForAction(){runInput.reset();for(const code of heldMovement)suppressedMovement.add(code);keys.clear();cancelWalk();gesture=null;}
    function publish(force=false){
      const now=performance.now();if(!force&&now-lastPublish<150)return;lastPublish=now;
      const data={...state,gesture:gesture?{type:gesture.type,at:gesture.at,duration:1500}:null};presence?.update?.(data);options.onState?.({...data});
      if(force||now-lastCheckpoint>1200){lastCheckpoint=now;options.onCheckpoint?.(getCheckpoint());}
    }
    function cancelWalk(){if(climbing)return;path=[];pending=null;destination.hidden=true;state.moving=false;state.pose=state.seatId?'sit':state.pose==='sit-floor'?'sit-floor':'idle';}
    async function sit(id){
      const seat=seatMap.get(id);if(!seat||dead||blocked()||state.seatId)return false;
      if(seating){if(seatPendingId===id)return false;stand();}
      if(state.pose==='sit-floor'&&!stand())return false;
      if(occupied(id)){announce('친구가 앉아 있어요. 다른 빈자리를 골라 주세요.');return false;}
      const point=seatApproaches(seat).sort((a,b)=>distance(state,a)-distance(state,b)).find(p=>nav.route(state,p));
      if(!point){announce('그 자리 옆 통로로 갈 수 없어요. 다른 빈자리를 골라 주세요.');return false;}
      stopForAction();
      if(distance(state,point)>22)return moveTo(point.x,point.y,{type:'seat',id});
      seating=true;seatPendingId=id;const token=++claimToken;
      // Keep stale cleanup ahead of the next claim, including retrying the same
      // seat. An old response must never clear or release a newer request.
      const claim=seatClaimQueue.catch(()=>{}).then(async()=>{
        if(dead||token!==claimToken||blocked())return {cancelled:true};
        let granted=true;try{if(presence?.claimSeat)granted=await presence.claimSeat(id);}catch(_){return {failed:true};}
        const cancelled=dead||token!==claimToken||blocked(),taken=occupied(id);
        if(granted&&(cancelled||taken)){try{await presence?.releaseSeat?.(id);}catch(_){}}
        return {granted:granted&&!cancelled&&!taken,cancelled,taken};
      });seatClaimQueue=claim.then(()=>{});
      const result=await claim;if(dead||token!==claimToken)return false;
      seating=false;seatPendingId=null;
      if(result.cancelled){updateNearby();return false;}
      if(!result.granted){announce(result.failed?'자리를 확인하지 못했어요. C로 다시 시도해 주세요.':'친구가 먼저 앉았어요. 다른 빈자리를 골라 주세요.');updateNearby();return false;}
      const anchor=seatPoint(seat);seatedExit={x:state.x,y:state.y};state={...state,...anchor,seatId:id,pose:'sit',moving:false,direction:seat.direction||'back',facing:'right'};publish(true);updateNearby();announce((seat.label||'빈자리')+'에 앉았어요. C나 방향키로 일어나요.');return true;
    }
    function stand(){
      if(state.pose==='sit-floor'){state.pose='idle';state.moving=false;publish(true);updateNearby();return true;}
      if(!state.seatId){if(seating){++claimToken;seating=false;seatPendingId=null;updateNearby();}return true;}
      const seat=seatMap.get(state.seatId),candidates=[seatedExit,...(seat?seatApproaches(seat):[])].filter(Boolean),exit=candidates.find(p=>nav.canStand(p.x,p.y));
      if(!exit){announce('자리 옆 통로를 확인하고 있어요.');return false;}
      const previous=state.seatId;state={...state,x:exit.x,y:exit.y,seatId:null,pose:'idle',moving:false,direction:'front'};seatedExit=null;presence?.releaseSeat?.(previous);++claimToken;publish(true);updateNearby();return true;
    }
    function floorSit(){
      if(dead||blocked()||seating||climbing)return false;if(state.pose==='sit-floor')return stand();
      if(state.seatId&&!stand())return false;
      if(!floorNav.canStand(state.x,state.y)){announce((outdoors?'사물':'책상과 벽')+'에서 조금 떨어진 넓은 바닥에 앉아 주세요.');return false;}
      stopForAction();++claimToken;state.pose='sit-floor';state.seatId=null;state.moving=false;publish(true);updateNearby();announce((outdoors?'앉았어요.':'바닥에 앉았어요.')+' C나 방향키로 일어나요.');focus();return true;
    }
    function toggleSit(){if(dead||blocked()||climbing)return false;const cancelling=seating||pending?.type==='seat';stopForAction();if(state.seatId||state.pose==='sit-floor'||cancelling)return stand();const seat=nearbySeat();return seat?sit(seat.id):floorSit();}
    function moveTo(x,y,goal=null){
      if(dead||blocked()||climbing)return false;if(!stand())return false;++claimToken;seating=false;seatPendingId=null;stopForAction();const end={x:finite(x,NaN),y:finite(y,NaN)};
      const route=nav.route(state,end);if(!route){announce((outdoors?'사물을 피해 이동할 바닥을':'책상과 벽을 피해 바닥이나 빈 의자를')+' 눌러 주세요.');return false;}
      path=route;pending=goal;autoFollow=true;destination.style.left=end.x+'px';destination.style.top=end.y+'px';destination.hidden=false;focus();return true;
    }
    function boardNear(board){if(climbing||finite(board.height)!==state.height)return false;return distance(state,board)<=finite(board.radius,115);}
    function closestInteraction(test){return interactions.filter(item=>test(item)&&boardNear(item)).sort((a,b)=>distance(state,a)-distance(state,b))[0]||null;}
    function useBoard(board){
      if(!boardNear(board)){const target=board.approach||board;return moveTo(target.x,target.y,{type:'board',id:board.id});}
      if(!stand())return false;stopForAction();publish(true);options.onBoard?.(board);return true;
    }
    function usePortal(portal){
      if(dead||blocked()||!boardNear(portal))return false;
      if(performance.now()<portalReadyAt){announce('잠깐 기다린 뒤 F로 다시 이동할 수 있어요.');return false;}
      if(!stand())return false;
      if(!boardNear(portal))return false;
      stopForAction();publish(true);
      if(typeof options.onPortal!=='function'){announce('아직 이 문으로 이동할 수 없어요.');return false;}
      transitioning=true;portalReadyAt=performance.now()+650;
      try{Promise.resolve(options.onPortal(portal)).catch(()=>{if(!dead)announce('문으로 이동하지 못했어요. F로 다시 시도해 주세요.');}).finally(()=>{if(!dead)transitioning=false;});}
      catch(_){transitioning=false;announce('문으로 이동하지 못했어요. F로 다시 시도해 주세요.');return false;}
      return true;
    }
    function walkToPortal(portal){const point=portal.approach||portal;if(boardNear(portal)){stopForAction();announce(portalLabel(portal)+' · F');focus();return true;}return moveTo(point.x,point.y,{type:'portal-approach',id:portal.id});}
    for(const portal of interactions.filter(item=>isPortal(item)&&item.hint)){
      const hint=element('button','sr-door-hint',portal.hintLabel||'교실로 · F');hint.type='button';hint.dataset.srDoorHint=portal.id;
      hint.style.left=portal.hint.x+'px';hint.style.top=portal.hint.y+'px';
      hint.setAttribute('aria-label',(portal.doorName||'학교 문')+' 앞으로 가기. 문 앞에서 F로 '+portalLabel(portal));
      hint.onclick=()=>{walkToPortal(portal);focus();};world.append(hint);
    }
    // Projected x/y remain shared with presence; height chooses the legal deck.
    // Only the supplied ladder/stair corridors permit intermediate heights.
    function validPlayer(p){
      if(navAt(p.height,p.pose==='sit-floor').canStand(p.x,p.y))return true;
      if(p.pose!=='climb')return false;
      return (scene.climbs||[]).some(c=>c.points.slice(1).some((b,i)=>{const a=c.points[i],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<14&&Math.abs(finite(p.height)-(a.height+(b.height-a.height)*t))<18;}));
    }
    function nearbyClimb(){
      if(climbing)return null;
      const candidates=[];
      for(const c of scene.climbs||[]){for(const reverse of [false,true]){const points=reverse?[...c.points].reverse():c.points,from=points[0],to=points[points.length-1];if(state.height!==from.height||distance(state,from)>c.radius||!nav.lineClear(state,from))continue;candidates.push({...c,points,from,to,label:reverse?c.downLabel:c.label});}}
      return candidates.sort((a,b)=>distance(state,a.from)-distance(state,b.from))[0]||null;
    }
    function startClimb(c){
      if(climbing||dead||blocked()||!stand())return false;
      stopForAction();const points=[{x:state.x,y:state.y,height:state.height},...c.points],lengths=points.slice(1).map((b,i)=>distance(points[i],b)),length=lengths.reduce((a,b)=>a+b,0);
      climbing={...c,points,lengths,length,travel:0,progress:0};state.pose='climb';state.moving=true;autoFollow=true;publish(true);return true;
    }
    function advanceClimb(dt){
      const c=climbing;c.travel=Math.min(c.length,c.travel+dt*c.speed);c.progress=c.travel/c.length;let remaining=c.travel,index=0;
      while(index<c.lengths.length-1&&remaining>=c.lengths[index])remaining-=c.lengths[index++];
      const a=c.points[index],b=c.points[index+1],t=c.lengths[index]?remaining/c.lengths[index]:1;
      state.x=a.x+(b.x-a.x)*t;state.y=a.y+(b.y-a.y)*t;state.height=a.height+(b.height-a.height)*t;state.moving=true;state.pose='climb';state.direction=b.y<a.y?'back':'front';phase=(phase+dt/.8)%1;
      if(c.progress===1){Object.assign(state,c.to,{pose:'idle',moving:false,direction:'front'});nav=navAt(state.height);floorNav=navAt(state.height,true);climbing=null;publish(true);announce(state.height?'나무 데크에 도착했어요. 사다리·계단 앞에서 F로 오르내려요.':'광장에 도착했어요.');}
    }
    function enterDoor(){if(dead||blocked()||climbing)return false;const climb=nearbyClimb();if(climb)return startClimb(climb);const portal=closestInteraction(isPortal);return portal?usePortal(portal):false;}
    function interact(){
      if(dead||blocked())return false;const board=closestInteraction(item=>(item.type||item.action)==='board');if(board)return useBoard(board);announce('칠판 가까이에서 E를 눌러 주세요. 앉기는 C, 문 이동은 F예요.');return false;
    }
    function updateNearby(){
      const seat=nearbySeat(),portal=closestInteraction(isPortal),board=closestInteraction(item=>(item.type||item.action)==='board'),cancelling=seating||pending?.type==='seat';
      textIfChanged(sitButton,state.seatId||state.pose==='sit-floor'?'일어서기 · C':cancelling?'앉기 취소 · C':outdoors?'앉기 · C':seat?(seat.kind==='bench'?'벤치에 앉기 · C':'의자에 앉기 · C'):'바닥에 앉기 · C');
      nearest=state.seatId?{type:'stand'}:state.pose==='sit-floor'?{type:'stand-floor'}:portal?{type:'portal',id:portal.id,value:portal}:board?{type:'board',id:board.id,value:board}:seat?{type:'seat',id:seat.id,value:seat}:null;
      const climb=nearbyClimb();if(climb)nearest={type:'climb',id:climb.id};
      const disabled=Boolean(climbing)||!portal&&!board&&!climb;if(actionButton.disabled!==disabled)actionButton.disabled=disabled;
      textIfChanged(actionButton,climbing?'나무를 오르내리는 중':climb?climb.label+' · F':portal?portalLabel(portal)+' · F':board?'선생님 수업 열기 · E':idleInteractionText);
      const nearby=nearest?.type||'';if(viewport.dataset.nearby!==nearby)viewport.dataset.nearby=nearby;
    }
    function greet(type){
      if(dead||blocked()||climbing)return false;if((state.seatId||state.pose==='sit-floor'||seating)&&!stand())return false;stopForAction();gesture={type:['wave','hello','happy'].includes(type)?type:'wave',at:clockNow(),started:performance.now()};publish(true);focus();return true;
    }
    function setPlayers(players){
      if(dead)return;const newest=new Map();for(const p of Array.isArray(players)?players:[]){if(!p||!p.uid||p.uid===uid||p.self||(p.zone&&p.zone!==zone)||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const old=newest.get(String(p.uid));if(!old||finite(p.updatedAt)>=finite(old.updatedAt))newest.set(String(p.uid),p);}
      const seen=new Set([uid]);
      for(const [id,raw]of newest){
        const seat=raw.pose==='sit'&&seatMap.get(raw.seatId),p={...raw,uid:id};if(seat)Object.assign(p,seatPoint(seat),{direction:seat.direction||'back'});else if(!validPlayer(p))continue;
        seen.add(id);let actor=actors.get(id);if(!actor){actor=makeActor(p,false);actors.set(id,actor);}actor.target=p;actor.name.textContent=String(p.name||'친구');updateArt(actor,p.avatar);
      }
      for(const [id,actor]of actors)if(!seen.has(id)){window.QPAvatarPose?.destroy(actor.svg);actor.node.remove();actors.delete(id);}
      hud.querySelector('b').textContent=String(actors.size);for(const seat of seats)world.querySelector('[data-sr-seat="'+CSS.escape(seat.id)+'"]')?.classList.toggle('is-occupied',occupied(seat.id)||state.seatId===seat.id);
      if(state.seatId&&occupied(state.seatId)){stand();announce('친구가 이용 중인 자리라 옆 통로로 이동했어요.');}updateNearby();
    }
    function setStatus(next={}){status={...next};hud.querySelector('.sr-network').textContent=next.mode==='connected'?'우리 반 친구들과 함께':next.mode==='connecting'?'친구 연결 중':next.mode==='offline'?'연결을 기다리며 둘러보기':'혼자 둘러보기';hud.querySelector('.sr-room-title').dataset.mode=next.mode||'local';}
    function setPresence(value){presence=value||null;publish(true);}
    function zoom(delta){preferredScale=clamp(scale+finite(delta),.68,Math.max(1.12,minimumScale+.4));cameraReady=false;autoFollow=true;updateCamera(0);focus();}
    function center(){cameraReady=false;autoFollow=Boolean(scene.centerOnPlayer);focus();}
    function resize(){viewportWidth=viewport.clientWidth;viewportHeight=viewport.clientHeight;cameraReady=false;updateCamera(0);}
    function updateCamera(dt){
      minimumScale=Math.max(viewportWidth/scene.width,viewportHeight/scene.height);
      const nextScale=Math.max(preferredScale,minimumScale);if(Math.abs(nextScale-scale)>.00001)cameraReady=false;scale=nextScale;
      const vw=viewportWidth/scale,vh=viewportHeight/scale,maxX=Math.max(0,scene.width-vw),maxY=Math.max(0,scene.height-vh),home=scene.cameraHome||{x:1430,y:450};
      if(!cameraReady){const target=autoFollow?state:home;camera.x=clamp(target.x-vw/2,0,maxX);camera.y=clamp(target.y-vh*finite(scene.cameraAnchorY,.5),0,maxY);cameraReady=true;}
      if(autoFollow){const padX=vw*.27,padY=vh*.22,bottom=vh*.80;let x=camera.x,y=camera.y;if(state.x<x+padX)x=state.x-padX;if(state.x>x+vw-padX)x=state.x-vw+padX;if(state.y<y+padY)y=state.y-padY;if(state.y>y+bottom)y=state.y-bottom;const ease=reduced?.matches?1:Math.min(1,dt*9);camera.x+=(clamp(x,0,maxX)-camera.x)*ease;camera.y+=(clamp(y,0,maxY)-camera.y)*ease;}
      for(const e of effects)e.node?.classList.toggle('is-outside',e.x+e.width<camera.x||e.x>camera.x+vw||e.y+e.height<camera.y||e.y>camera.y+vh);
      const transform='translate('+(-camera.x*scale).toFixed(2)+'px,'+(-camera.y*scale).toFixed(2)+'px) scale('+scale+')';
      if(world.style.transform!==transform)world.style.transform=transform;
      const disabled=scale<=minimumScale+.0001;if(zoomOutButton.disabled!==disabled)zoomOutButton.disabled=disabled;
    }
    function placeActor(actor,dt,now){
      const p=actor.self?state:actor.target,seat=p.seatId&&p.pose==='sit'&&seatMap.get(p.seatId),target=seat?seatPoint(seat):p;
      if(actor.self||seat||distance(actor.current,target)>250)actor.current={x:target.x,y:target.y};else{const amount=Math.min(1,dt*12);actor.current.x+=(target.x-actor.current.x)*amount;actor.current.y+=(target.y-actor.current.y)*amount;}
      actor.node.style.transform='translate('+actor.current.x.toFixed(2)+'px,'+(actor.current.y+(seat?finite(seat.sitVisualYOffset,0):0)).toFixed(2)+'px)';actor.node.style.zIndex=String(Math.round(seat?(seat.depth??seat.sitDepth??seatPoint(seat).y-3):actor.current.y+(finite(p.height)>0?finite(scene.elevatedDepth,4000):0)));actor.node.dataset.height=String(finite(p.height));actor.node.classList.toggle('is-seated',Boolean(seat));actor.node.classList.toggle('is-floor-seated',p.pose==='sit-floor');if(actor.node.dataset.seatId!==(seat?.id||''))actor.node.dataset.seatId=seat?.id||'';
      const g=actor.self?gesture:p.gesture;let progress=g?(actor.self?(now-g.started)/1500:(clockNow()-finite(g.at))/finite(g.duration,1500)):1;
      const active=g&&progress>=0&&progress<1,pose=seat?'sit':p.pose==='climb'?(scene.climbs?.some(c=>c.motion==='walk'&&finite(p.height)>c.points[0].height&&finite(p.height)<c.points[c.points.length-1].height)?'walk':'climb'):p.pose==='sit-floor'?'floor-sit':p.moving?(p.pose==='run'?'run':'walk'):'idle',kind=active?(g.type==='hello'?'nod':g.type==='happy'?'happy':'wave'):'';
      // Breathing is slow; stagger resting friends over six frames. Input, motion and
      // gestures update immediately, and the local player keeps every frame.
      const poseKey=[pose,seat?.id,active,kind,p.direction,p.facing].join(':');
      if(actor.self||p.moving||active||actor.poseKey!==poseKey||actor.poseSlot===poseTurn){
      window.QPAvatarPose?.apply(actor.svg,{action:pose,seatMode:seat?'desk':p.pose==='sit-floor'?'floor':undefined,direction:seat?(seat.direction||'back'):active?'front':p.direction||'front',facing:p.facing===-1?'left':p.facing===1?'right':p.facing||'right',phase:actor.self?phase:now/(p.pose==='run'?460:720),grounded:true,gesture:kind,gestureProgress:progress});
      actor.poseKey=poseKey;
      }
      actor.bubble.hidden=!active;if(active)textIfChanged(actor.bubble,g.type==='hello'?'반가워!':g.type==='happy'?'신난다! ✨':'안녕! 👋');
    }
    function step(dx,dy){
      const length=Math.hypot(dx,dy),count=Math.max(1,Math.ceil(length/3));let moved=0;
      for(let i=0;i<count;i++){const sx=dx/count,sy=dy/count,oldX=state.x,oldY=state.y;if(nav.canStand(state.x+sx,state.y+sy)){state.x+=sx;state.y+=sy;}else if(nav.canStand(state.x+sx,state.y))state.x+=sx;else if(nav.canStand(state.x,state.y+sy))state.y+=sy;moved+=Math.hypot(state.x-oldX,state.y-oldY);}
      if(moved>.001){phase=(phase+moved/(runInput.isRunning()?RUN_SPEED*.46:SPEED*.72))%1;state.direction=Math.abs(dx)>Math.abs(dy)*.6?(dx<0?'left':'right'):dy<0?'back':'front';if(['left','right'].includes(state.direction))state.facing=state.direction;}
      return moved;
    }
    function tick(now){
      if(dead)return;const dt=Math.min(.035,last?(now-last)/1000:0);last=now;
      world.classList.toggle('sr-effects-paused',blocked());
      if(blocked()){runInput.reset();keys.clear();state.moving=false;if(state.pose==='run'||state.pose==='walk')state.pose='idle';cancelWalk();for(const actor of actors.values())actor.svg?.classList.add('sr-motion-paused');last=0;raf=requestAnimationFrame(tick);return;}
      for(const actor of actors.values())if(actor.svg?.classList.contains('sr-motion-paused'))actor.svg.classList.remove('sr-motion-paused');let dx=0,dy=0;
      if(climbing){advanceClimb(dt);}
      else {
      if(keys.size){if(stand()){dx=Number(keys.has('right'))-Number(keys.has('left'));dy=Number(keys.has('down'))-Number(keys.has('up'));if(dx||dy){cancelWalk();gesture=null;const len=Math.hypot(dx,dy),speed=runInput.isRunning()?RUN_SPEED:SPEED;dx=dx/len*speed*dt;dy=dy/len*speed*dt;autoFollow=true;}}}
      else if(path.length){const target=path[0],d=distance(state,target),reach=SPEED*dt;if(d<=reach){dx=target.x-state.x;dy=target.y-state.y;path.shift();}else{dx=(target.x-state.x)/d*reach;dy=(target.y-state.y)/d*reach;}}
      const moved=(dx||dy)?step(dx,dy):0;state.moving=moved>.005;state.pose=state.seatId?'sit':state.pose==='sit-floor'?'sit-floor':state.moving?(runInput.isRunning()?'run':'walk'):'idle';
      if(!path.length&&pending){const goal=pending;pending=null;destination.hidden=true;if(goal.type==='seat')void sit(goal.id);else if(goal.type==='board'||goal.type==='portal-approach'){const item=interactions.find(i=>i.id===goal.id);if(item){if(goal.type==='portal-approach')announce(portalLabel(item)+' · F');else useBoard(item);}}}
      }
      if(dead)return;
      if(!path.length)destination.hidden=true;if(gesture&&now-gesture.started>1500)gesture=null;
      updateNearby();poseTurn=(poseTurn+1)%6;for(const actor of actors.values())placeActor(actor,dt,now);updateCamera(dt);publish();raf=requestAnimationFrame(tick);
    }
    function onDown(e){if(!viewport.contains(e.target)&&!container.contains(document.activeElement))return;if(blocked()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(KEYS[e.code]){e.preventDefault();if(climbing)return;heldMovement.add(e.code);if(e.repeat&&suppressedMovement.has(e.code))return;runInput.down(e.code,performance.now(),e.repeat);suppressedMovement.delete(e.code);keys.add(KEYS[e.code]);++claimToken;}else if(['KeyC','KeyE','KeyF'].includes(e.code)){e.preventDefault();if(e.repeat||heldActions.has(e.code))return;heldActions.add(e.code);if(e.code==='KeyC')void toggleSit();else if(e.code==='KeyE')void interact();else enterDoor();}}
    function onUp(e){runInput.up(e.code,performance.now());heldActions.delete(e.code);heldMovement.delete(e.code);suppressedMovement.delete(e.code);if(KEYS[e.code]&&![...heldMovement].some(code=>KEYS[code]===KEYS[e.code]))keys.delete(KEYS[e.code]);}
    function onPointer(e){
      if(e.button!==0||blocked()||climbing||e.target.closest('.sr-actor,button,a,input'))return;
      const seat=e.target.closest('[data-sr-seat]');if(seat){void sit(seat.dataset.srSeat);focus();return;}
      const interaction=e.target.closest('[data-sr-interaction]');if(interaction){const item=interactions.find(i=>i.id===interaction.dataset.srInteraction);if(item){if(isPortal(item))walkToPortal(item);else if((item.type||item.action)==='board')useBoard(item);}focus();return;}
      const bounds=viewport.getBoundingClientRect(),x=(e.clientX-bounds.left)/scale+camera.x,y=(e.clientY-bounds.top)/scale+camera.y;
      const interactionHit=interactions.find(item=>{if((item.type||item.action)!=='board'&&!isPortal(item))return false;const box=item.hitRect||item.rect;if(!box)return false;const r=rect(box);return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;});
      if(interactionHit){if(isPortal(interactionHit))walkToPortal(interactionHit);else useBoard(interactionHit);focus();return;}
      const hit=seats.find(s=>{const r=s.rect||s.hitRect;if(!r)return false;const q=rect(r);return x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h;});if(hit)void sit(hit.id);else moveTo(x,y);focus();
    }
    function onBlur(){runInput.reset();keys.clear();state.moving=false;if(state.pose==='run'||state.pose==='walk')state.pose='idle';heldActions.clear();heldMovement.clear();suppressedMovement.clear();cancelWalk();if(seating)stand();publish(true);}
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(viewport);
    document.addEventListener('keydown',onDown);document.addEventListener('keyup',onUp);document.addEventListener('visibilitychange',onBlur);window.addEventListener('blur',onBlur);viewport.addEventListener('pointerdown',onPointer);
    tools.querySelector('[data-tool="help"]').onclick=()=>{help.hidden=!help.hidden;focus();};tools.querySelector('[data-tool="zoom-out"]').onclick=()=>zoom(-.08);tools.querySelector('[data-tool="zoom-in"]').onclick=()=>zoom(.08);tools.querySelector('[data-tool="center"]').onclick=center;tools.querySelector('[data-tool="exit"]').onclick=()=>{stopForAction();stand();options.onExit?.();};actionButton.onclick=()=>{const climb=nearbyClimb();if(climb){startClimb(climb);focus();return;}const portal=closestInteraction(isPortal);if(portal)usePortal(portal);else void interact();focus();};controls.querySelector('[data-tool="sit"]').onclick=()=>{void toggleSit();focus();};controls.querySelectorAll('[data-gesture]').forEach(b=>b.onclick=()=>greet(b.dataset.gesture));
    setStatus(options.status||{mode:'local'});setPlayers(options.players||[]);publish(true);updateNearby();updateCamera(0);placeActor(local,0,performance.now());raf=requestAnimationFrame(tick);
    function getCheckpoint(){if(climbing){const safe=climbing.progress<.5?climbing.from:climbing.to;return {...state,...safe,seatId:null,pose:'idle',moving:false};}const seat=state.seatId&&seatMap.get(state.seatId),point=seat&&(seatedExit||seat.exit||seat.approach);return {...state,...(point||{}),seatId:null,pose:'idle',moving:false};}
    function destroy(){if(dead)return;stand();dead=true;++claimToken;cancelAnimationFrame(raf);clearTimeout(noticeTimer);keys.clear();observer?.disconnect();document.removeEventListener('keydown',onDown);document.removeEventListener('keyup',onUp);document.removeEventListener('visibilitychange',onBlur);window.removeEventListener('blur',onBlur);viewport.removeEventListener('pointerdown',onPointer);for(const actor of actors.values())window.QPAvatarPose?.destroy(actor.svg);actors.clear();container.classList.remove('school-room-host');delete container.dataset.zone;container.replaceChildren();}
    return Object.freeze({destroy,getState:()=>({...state,camera:{...camera,scale,preferredScale,minimumScale},path:path.map(p=>({...p})),paused:blocked(),status:{...status},nearest:nearest?{type:nearest.type,id:nearest.id}:null,climbing:climbing?.id||null,seatPending:seating,seatPendingId,transitioning,portalCooldownRemaining:Math.max(0,portalReadyAt-performance.now())}),getCheckpoint,moveTo,canStand:(x,y,height=state.height)=>navAt(height).canStand(x,y),sit,floorSit,toggleSit,stand,interact,setPlayers,setStatus,setPresence,focus,setPaused(value){paused=Boolean(value);if(paused){onBlur();++claimToken;}},setAvatar(av){updateArt(local,av);const profile={avatar:cleanAvatar(av)};if(presence?.setProfile)presence.setProfile(profile);else presence?.update?.(profile);},gesture:greet,center,zoom,scene,nav});
  }
  window.QPSchoolRoomWorld=Object.freeze({mount,createNavigation});
})();
