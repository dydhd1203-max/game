/* Classroom input, legal navigation and avatar seating. All room artwork is
   supplied separately by QPSchoolRoomScene; this controller draws no map art. */
(() => {
  'use strict';
  const KEYS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
  const SPEED=150, AVATAR_HEIGHT=76, RADIUS=7;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
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
    const scene=typeof source.get==='function'?source.get():source,nav=createNavigation(scene),floorNav=createNavigation(scene,{radius:18}),seats=scene.seats||[],interactions=scene.interactables||scene.interactions||[];
    const zone=options.zone||scene.zone||'campus',playground=zone==='playground',title=options.title||scene.title||(playground?'우리 반 운동장':'우리 반 교실');
    const idleInteractionText=playground?'벤치 · 학교 문 앞에서 E':'의자 · 칠판 앞에서 E';
    const isPortal=item=>item.type==='portal'||item.type==='door'&&Boolean(item.target);
    const portalLabel=item=>item.label||(item.target==='campus'?'교실로 들어가기':'운동장 나가기');
    const seatMap=new Map(seats.map(s=>[s.id,s])),user=options.user||{},uid=String(user.uid||user.k||'local'),avatar=user.avatar||user.av||{};
    const spawn=scene.spawn||{x:1430,y:855},saved=options.checkpoint;
    let state={x:spawn.x,y:spawn.y,direction:'front',facing:'right',pose:'idle',moving:false,seatId:null,zone,height:0};
    if(saved&&nav.canStand(saved.x,saved.y))state.x=saved.x,state.y=saved.y;
    else if(saved){const previous=seats.find(s=>distance({x:finite(saved.x,-1000),y:finite(saved.y,-1000)},{x:finite(s.sitX??s.x),y:finite(s.sitY??s.y)})<12),exit=previous?.exit||previous?.approach;if(exit&&nav.canStand(exit.x,exit.y))state.x=exit.x,state.y=exit.y;}
    const keys=new Set(),actors=new Map();let dead=false,paused=false,raf=0,last=0,path=[],pending=null,gesture=null,phase=0,lastPublish=0,lastCheckpoint=0,claimToken=0,seating=false,presence=options.presence||null,status={mode:'local'},nearest=null;
    let preferredScale=finite(scene.cameraHome?.zoom,.84),scale=preferredScale,minimumScale=0,camera={x:0,y:0},cameraReady=false,autoFollow=Boolean(saved),noticeTimer=0;
    const clockNow=()=>{const time=presence?.getTime?.();return Number.isFinite(time)?time:Date.now();};
    container.classList.add('school-room-host');container.dataset.zone=zone;container.replaceChildren();
    const viewport=element('div','school-room-world');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label',title+'. 방향키나 WASD로 걷기, 바닥 클릭으로 이동, '+(playground?'빈 벤치 앞에서 E로 앉기, G로 바닥에 앉기, 학교 문 앞에서 E로 교실 들어가기.':'빈 의자 앞에서 E로 앉기, G로 바닥에 앉기, 칠판 앞에서 E로 수업 열기.'));
    const world=element('div','sr-world');world.style.width=scene.width+'px';world.style.height=scene.height+'px';world.innerHTML=source.render?source.render():scene.markup||'';viewport.append(world);container.append(viewport);
    const destination=element('span','sr-destination');destination.hidden=true;world.append(destination);
    const hud=element('div','sr-hud');hud.innerHTML='<div class="sr-room-title"><strong></strong><span class="sr-network"></span></div><span class="sr-friend-count">함께 있는 친구 <b>1</b></span>';hud.querySelector('strong').textContent=title;container.append(hud);
    const tools=element('div','sr-tools');tools.innerHTML='<button data-tool="help">조작 안내</button><button data-tool="zoom-out">−</button><button data-tool="zoom-in">＋</button><button data-tool="center"></button><button data-tool="exit"></button>';tools.querySelector('[data-tool="zoom-out"]').setAttribute('aria-label',title+' 축소');tools.querySelector('[data-tool="zoom-in"]').setAttribute('aria-label',title+' 확대');tools.querySelector('[data-tool="center"]').textContent=options.centerLabel||scene.centerLabel||(playground?'운동장 보기':'교실 보기');tools.querySelector('[data-tool="exit"]').textContent=options.exitLabel||scene.exitLabel||(playground?'교실로 돌아가기':'수업 목록');container.append(tools);
    const help=element('div','sr-help');help.hidden=true;help.innerHTML='<b>방향키 · WASD</b> 걷기　<b>바닥 클릭</b> 길 찾아 걷기<br><b>'+(playground?'벤치':'의자')+' 클릭 · E</b> 빈자리 앉기 / 일어서기　<b>G</b> 바닥 앉기<br><b>'+(playground?'학교 문 앞 E</b> 교실 들어가기':'칠판 앞 E</b> 선생님 수업 열기')+'　<b>F</b> 손 흔들기';container.append(help);
    const controls=element('div','sr-controls');controls.innerHTML='<button data-gesture="wave">👋 손 흔들기 <small>F</small></button><button data-gesture="hello">인사</button><button data-gesture="happy">✨ 신나!</button><button data-tool="floor-sit">바닥에 앉기 <small>G</small></button><button class="sr-interact" disabled>의자 · 칠판 앞에서 E</button>';container.append(controls);
    const actionButton=controls.querySelector('.sr-interact'),notice=element('div','sr-notice');actionButton.textContent=idleInteractionText;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');container.append(notice);
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    function announce(message){notice.textContent=message;notice.classList.add('is-visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('is-visible'),2900);}
    const focus=()=>{if(!dead)viewport.focus({preventScroll:true});};
    function blocked(){return paused||document.hidden||options.isPaused?.()||!viewport.isConnected||!viewport.getClientRects().length||Boolean(document.querySelector('#modal.on,[aria-modal="true"]:not([hidden])'));}
    function cleanAvatar(av){const result={...avatar,...av,bg:'',frame:''};return options.validateAvatar?options.validateAvatar(result):result;}
    function updateArt(actor,av){
      const clean=cleanAvatar(av),key=JSON.stringify(clean);if(actor.avatarKey===key)return;
      if(actor.svg)window.QPAvatarPose?.destroy(actor.svg);
      actor.avatarKey=key;actor.art.innerHTML=options.renderAvatar(clean,AVATAR_HEIGHT,3);actor.svg=actor.art.querySelector('svg');
      const view=actor.svg?.viewBox.baseVal,vh=view?.height||56,vw=view?.width||32,foot=Number(actor.svg?.querySelector('.qpx-contact-shadow')?.getAttribute('cy'))||52.37;
      actor.art.style.left=-(AVATAR_HEIGHT*vw/vh)/2+'px';actor.art.style.top=-(AVATAR_HEIGHT*foot/vh)+'px';actor.name.style.top=-(AVATAR_HEIGHT*foot/vh+17)+'px';actor.bubble.style.top=-(AVATAR_HEIGHT*foot/vh+43)+'px';
      window.QPAvatarPose?.prepare(actor.svg);
    }
    function makeActor(player,self){
      const node=element('div','sr-actor'+(self?' is-me':''));node.dataset.uid=String(player.uid);const art=element('div','sr-avatar'),name=element('span','sr-player-name',String(player.name||'친구')+(self?' · 나':'')),bubble=element('span','sr-bubble');bubble.hidden=true;node.append(art,name,bubble);world.append(node);
      const actor={node,art,name,bubble,svg:null,avatarKey:'',current:{x:player.x,y:player.y},target:player,self};updateArt(actor,player.avatar||avatar);
      if(!self){node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',String(player.name||'친구')+'에게 인사하기');node.addEventListener('click',e=>{e.stopPropagation();if(distance(state,actor.current)<110)greet('wave');else moveTo(actor.current.x,actor.current.y);focus();});node.addEventListener('keydown',e=>{if(e.code==='Enter'){e.preventDefault();node.click();}});}
      return actor;
    }
    const local=makeActor({uid,name:user.name||'나',avatar,...state},true);actors.set(uid,local);
    function occupied(id){for(const actor of actors.values())if(!actor.self&&actor.target.seatId===id&&actor.target.pose==='sit')return true;return false;}
    const seatPoint=seat=>({x:finite(seat.sitX??seat.x),y:finite(seat.sitY??seat.y)});
    const approach=seat=>seat.approach||seat.exit||seatPoint(seat);
    function publish(force=false){
      const now=performance.now();if(!force&&now-lastPublish<150)return;lastPublish=now;
      const data={...state,gesture:gesture?{type:gesture.type,at:gesture.at,duration:1500}:null};presence?.update?.(data);options.onState?.({...data});
      if(force||now-lastCheckpoint>1200){lastCheckpoint=now;options.onCheckpoint?.(getCheckpoint());}
    }
    function cancelWalk(){path=[];pending=null;destination.hidden=true;state.moving=false;state.pose=state.seatId?'sit':state.pose==='sit-floor'?'sit-floor':'idle';}
    async function sit(id){
      const seat=seatMap.get(id);if(!seat||dead||blocked()||state.seatId||seating)return false;
      if(state.pose==='sit-floor'&&!stand())return false;
      if(occupied(id)){announce('친구가 앉아 있어요. 다른 빈자리를 골라 주세요.');return false;}
      const point=approach(seat);
      if(distance(state,point)>22)return moveTo(point.x,point.y,{type:'seat',id});
      cancelWalk();gesture=null;seating=true;const token=++claimToken;
      let granted=true;try{if(presence?.claimSeat)granted=await presence.claimSeat(id);}catch(_){granted=false;}
      seating=false;if(dead||token!==claimToken||blocked()){if(granted)presence?.releaseSeat?.(id);return false;}
      if(!granted||occupied(id)){if(granted)presence?.releaseSeat?.(id);announce('친구가 먼저 앉았어요. 다른 빈자리를 골라 주세요.');return false;}
      const anchor=seatPoint(seat);state={...state,...anchor,seatId:id,pose:'sit',moving:false,direction:seat.direction||'back',facing:'right'};publish(true);updateNearby();announce((seat.label||'빈자리')+'에 앉았어요. E나 방향키로 일어나요.');return true;
    }
    function stand(){
      if(state.pose==='sit-floor'){state.pose='idle';state.moving=false;publish(true);updateNearby();return true;}
      if(!state.seatId){if(seating){++claimToken;seating=false;presence?.releaseSeat?.();}return true;}
      const seat=seatMap.get(state.seatId),candidates=[seat?.exit,seat?.approach,seat&&{x:seatPoint(seat).x-43,y:seatPoint(seat).y},seat&&{x:seatPoint(seat).x+43,y:seatPoint(seat).y}].filter(Boolean),exit=candidates.find(p=>nav.canStand(p.x,p.y));
      if(!exit){announce('자리 옆 통로를 확인하고 있어요.');return false;}
      state={...state,x:exit.x,y:exit.y,seatId:null,pose:'idle',moving:false,direction:'front'};presence?.releaseSeat?.();++claimToken;publish(true);return true;
    }
    function floorSit(){
      if(dead||blocked()||seating)return false;if(state.pose==='sit-floor')return stand();
      if(state.seatId&&!stand())return false;
      if(!floorNav.canStand(state.x,state.y)){announce((playground?'사물':'책상과 벽')+'에서 조금 떨어진 넓은 바닥에 앉아 주세요.');return false;}
      cancelWalk();keys.clear();gesture=null;++claimToken;state.pose='sit-floor';state.seatId=null;state.moving=false;publish(true);updateNearby();announce('바닥에 앉았어요. E나 방향키로 일어나요.');focus();return true;
    }
    function moveTo(x,y,goal=null){
      if(dead||blocked())return false;if(!stand())return false;++claimToken;seating=false;gesture=null;cancelWalk();const end={x:finite(x,NaN),y:finite(y,NaN)};
      const route=nav.route(state,end);if(!route){announce((playground?'사물을 피해 바닥이나 빈 벤치를':'책상과 벽을 피해 바닥이나 빈 의자를')+' 눌러 주세요.');return false;}
      path=route;pending=goal;autoFollow=true;destination.style.left=end.x+'px';destination.style.top=end.y+'px';destination.hidden=false;focus();return true;
    }
    function boardNear(board){return distance(state,board)<=finite(board.radius,115);}
    function useBoard(board){
      if(!boardNear(board)){const target=board.approach||board;return moveTo(target.x,target.y,{type:'board',id:board.id});}
      cancelWalk();if(!stand())return false;gesture=null;keys.clear();publish(true);options.onBoard?.(board);return true;
    }
    function usePortal(portal){
      if(!stand())return false;
      if(!boardNear(portal)){const target=portal.approach||portal;return moveTo(target.x,target.y,{type:'portal',id:portal.id});}
      cancelWalk();gesture=null;keys.clear();publish(true);options.onPortal?.(portal);return true;
    }
    function interact(){
      if(dead||blocked())return false;if(state.seatId||state.pose==='sit-floor')return stand();
      if(nearest?.type==='seat')return sit(nearest.id);if(nearest?.type==='board')return useBoard(nearest.value);if(nearest?.type==='portal')return usePortal(nearest.value);announce(playground?'빈 벤치 옆이나 학교 문 앞에서 E를 눌러 주세요.':'빈 의자 옆이나 칠판 앞에서 E를 눌러 주세요.');return false;
    }
    function updateNearby(){
      controls.querySelector('[data-tool="floor-sit"]').textContent=state.pose==='sit-floor'?'바닥에서 일어나기 · G':'바닥에 앉기 · G';
      if(state.pose==='sit-floor'){nearest={type:'stand-floor'};actionButton.disabled=false;actionButton.textContent='일어서기 · E';return;}
      if(state.seatId){nearest={type:'stand'};actionButton.disabled=false;actionButton.textContent='일어서기 · E';return;}
      nearest=null;let score=Infinity;
      for(const seat of seats){const d=distance(state,approach(seat));if(d<46&&d<score&&!occupied(seat.id)){score=d;nearest={type:'seat',id:seat.id,value:seat};}}
      for(const item of interactions){if(((item.type||item.action)==='board'||isPortal(item))&&boardNear(item)&&(!nearest||distance(state,item)<score)){score=distance(state,item);nearest={type:isPortal(item)?'portal':'board',id:item.id,value:item};}}
      actionButton.disabled=!nearest;actionButton.textContent=nearest?.type==='seat'?(nearest.value.kind==='bench'?'벤치에 앉기 · E':'빈자리 앉기 · E'):nearest?.type==='board'?'선생님 수업 열기 · E':nearest?.type==='portal'?portalLabel(nearest.value)+' · E':idleInteractionText;
      viewport.dataset.nearby=nearest?.type||'';
    }
    function greet(type){
      if(dead||blocked())return false;if((state.seatId||state.pose==='sit-floor')&&!stand())return false;cancelWalk();keys.clear();state.direction='front';gesture={type:['wave','hello','happy'].includes(type)?type:'wave',at:clockNow(),started:performance.now()};publish(true);focus();return true;
    }
    function setPlayers(players){
      if(dead)return;const newest=new Map();for(const p of Array.isArray(players)?players:[]){if(!p||!p.uid||p.uid===uid||p.self||(p.zone&&p.zone!==zone)||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const old=newest.get(String(p.uid));if(!old||finite(p.updatedAt)>=finite(old.updatedAt))newest.set(String(p.uid),p);}
      const seen=new Set([uid]);
      for(const [id,raw]of newest){
        const seat=raw.pose==='sit'&&seatMap.get(raw.seatId),p={...raw,uid:id};if(seat)Object.assign(p,seatPoint(seat),{direction:seat.direction||'back'});else if(!(p.pose==='sit-floor'?floorNav:nav).canStand(p.x,p.y))continue;
        seen.add(id);let actor=actors.get(id);if(!actor){actor=makeActor(p,false);actors.set(id,actor);}actor.target=p;actor.name.textContent=String(p.name||'친구');updateArt(actor,p.avatar);
      }
      for(const [id,actor]of actors)if(!seen.has(id)){window.QPAvatarPose?.destroy(actor.svg);actor.node.remove();actors.delete(id);}
      hud.querySelector('b').textContent=String(actors.size);for(const seat of seats)world.querySelector('[data-sr-seat="'+CSS.escape(seat.id)+'"]')?.classList.toggle('is-occupied',occupied(seat.id)||state.seatId===seat.id);
      if(state.seatId&&occupied(state.seatId)){stand();announce('친구가 이용 중인 자리라 옆 통로로 이동했어요.');}updateNearby();
    }
    function setStatus(next={}){status={...next};hud.querySelector('.sr-network').textContent=next.mode==='connected'?'우리 반 친구들과 함께':next.mode==='connecting'?'친구 연결 중':next.mode==='offline'?'연결을 기다리며 둘러보기':'혼자 둘러보기';hud.querySelector('.sr-room-title').dataset.mode=next.mode||'local';}
    function setPresence(value){presence=value||null;publish(true);}
    function zoom(delta){preferredScale=clamp(scale+finite(delta),.68,Math.max(1.12,minimumScale+.4));cameraReady=false;autoFollow=true;updateCamera(0);focus();}
    function center(){cameraReady=false;autoFollow=false;focus();}
    function resize(){cameraReady=false;updateCamera(0);}
    function updateCamera(dt){
      minimumScale=Math.max(viewport.clientWidth/scene.width,viewport.clientHeight/scene.height);
      const nextScale=Math.max(preferredScale,minimumScale);if(Math.abs(nextScale-scale)>.00001)cameraReady=false;scale=nextScale;
      const vw=viewport.clientWidth/scale,vh=viewport.clientHeight/scale,maxX=Math.max(0,scene.width-vw),maxY=Math.max(0,scene.height-vh),home=scene.cameraHome||{x:1430,y:450};
      if(!cameraReady){const target=autoFollow?state:home;camera.x=clamp(target.x-vw/2,0,maxX);camera.y=clamp(target.y-vh/2,0,maxY);cameraReady=true;}
      if(autoFollow){const padX=vw*.27,padY=vh*.22,bottom=vh*.80;let x=camera.x,y=camera.y;if(state.x<x+padX)x=state.x-padX;if(state.x>x+vw-padX)x=state.x-vw+padX;if(state.y<y+padY)y=state.y-padY;if(state.y>y+bottom)y=state.y-bottom;const ease=reduced?.matches?1:Math.min(1,dt*9);camera.x+=(clamp(x,0,maxX)-camera.x)*ease;camera.y+=(clamp(y,0,maxY)-camera.y)*ease;}
      world.style.transform='translate('+(-camera.x*scale).toFixed(2)+'px,'+(-camera.y*scale).toFixed(2)+'px) scale('+scale+')';
      tools.querySelector('[data-tool="zoom-out"]').disabled=scale<=minimumScale+.0001;
    }
    function placeActor(actor,dt,now){
      const p=actor.self?state:actor.target,seat=p.seatId&&p.pose==='sit'&&seatMap.get(p.seatId),target=seat?seatPoint(seat):p;
      if(actor.self||seat||distance(actor.current,target)>250)actor.current={x:target.x,y:target.y};else{const amount=Math.min(1,dt*12);actor.current.x+=(target.x-actor.current.x)*amount;actor.current.y+=(target.y-actor.current.y)*amount;}
      actor.node.style.transform='translate('+actor.current.x.toFixed(2)+'px,'+(actor.current.y+(seat?finite(seat.sitVisualYOffset,0):0)).toFixed(2)+'px)';actor.node.style.zIndex=String(Math.round(seat?(seat.depth??seat.sitDepth??seatPoint(seat).y-3):actor.current.y));actor.node.classList.toggle('is-seated',Boolean(seat));actor.node.classList.toggle('is-floor-seated',p.pose==='sit-floor');actor.node.dataset.seatId=seat?.id||'';
      const g=actor.self?gesture:p.gesture;let progress=g?(actor.self?(now-g.started)/1500:(clockNow()-finite(g.at))/finite(g.duration,1500)):1;
      const active=g&&progress>=0&&progress<1,pose=seat?'sit':p.pose==='sit-floor'?'floor-sit':p.moving?'walk':'idle',kind=active?(g.type==='hello'?'nod':g.type==='happy'?'happy':'wave'):'';
      window.QPAvatarPose?.apply(actor.svg,{action:pose,seatMode:seat?'desk':p.pose==='sit-floor'?'floor':undefined,direction:seat?(seat.direction||'back'):active?'front':p.direction||'front',facing:p.facing===-1?'left':p.facing===1?'right':p.facing||'right',phase:actor.self?phase:now/560,grounded:true,gesture:kind,gestureProgress:progress});
      actor.bubble.hidden=!active;if(active)actor.bubble.textContent=g.type==='hello'?'반가워!':g.type==='happy'?'신난다! ✨':'안녕! 👋';
    }
    function step(dx,dy){
      const length=Math.hypot(dx,dy),count=Math.max(1,Math.ceil(length/3));let moved=0;
      for(let i=0;i<count;i++){const sx=dx/count,sy=dy/count,oldX=state.x,oldY=state.y;if(nav.canStand(state.x+sx,state.y+sy)){state.x+=sx;state.y+=sy;}else if(nav.canStand(state.x+sx,state.y))state.x+=sx;else if(nav.canStand(state.x,state.y+sy))state.y+=sy;moved+=Math.hypot(state.x-oldX,state.y-oldY);}
      if(moved>.001){phase=(phase+moved/45)%1;state.direction=Math.abs(dx)>Math.abs(dy)*.6?(dx<0?'left':'right'):dy<0?'back':'front';if(['left','right'].includes(state.direction))state.facing=state.direction;}
      return moved;
    }
    function tick(now){
      if(dead)return;const dt=Math.min(.035,last?(now-last)/1000:0);last=now;
      if(blocked()){keys.clear();cancelWalk();for(const actor of actors.values())actor.svg?.classList.add('sr-motion-paused');last=0;raf=requestAnimationFrame(tick);return;}
      for(const actor of actors.values())actor.svg?.classList.remove('sr-motion-paused');let dx=0,dy=0;
      if(keys.size){if(stand()){dx=Number(keys.has('right'))-Number(keys.has('left'));dy=Number(keys.has('down'))-Number(keys.has('up'));if(dx||dy){cancelWalk();gesture=null;const len=Math.hypot(dx,dy);dx=dx/len*SPEED*dt;dy=dy/len*SPEED*dt;autoFollow=true;}}}
      else if(path.length){const target=path[0],d=distance(state,target),reach=SPEED*dt;if(d<=reach){dx=target.x-state.x;dy=target.y-state.y;path.shift();}else{dx=(target.x-state.x)/d*reach;dy=(target.y-state.y)/d*reach;}}
      const moved=(dx||dy)?step(dx,dy):0;state.moving=moved>.005;state.pose=state.seatId?'sit':state.pose==='sit-floor'?'sit-floor':state.moving?'walk':'idle';
      if(!path.length&&pending){const goal=pending;pending=null;destination.hidden=true;if(goal.type==='seat')void sit(goal.id);else if(goal.type==='board'||goal.type==='portal'){const item=interactions.find(i=>i.id===goal.id);if(item){if(goal.type==='portal')usePortal(item);else useBoard(item);}}}
      if(dead)return;
      if(!path.length)destination.hidden=true;if(gesture&&now-gesture.started>1500)gesture=null;
      updateNearby();for(const actor of actors.values())placeActor(actor,dt,now);updateCamera(dt);publish();raf=requestAnimationFrame(tick);
    }
    function onDown(e){if(!viewport.contains(e.target)&&!container.contains(document.activeElement))return;if(blocked()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(KEYS[e.code]){e.preventDefault();keys.add(KEYS[e.code]);++claimToken;}else if(e.code==='KeyE'&&!e.repeat){e.preventDefault();void interact();}else if(e.code==='KeyG'&&!e.repeat){e.preventDefault();floorSit();}else if(e.code==='KeyF'&&!e.repeat){e.preventDefault();greet('wave');}}
    function onUp(e){if(KEYS[e.code])keys.delete(KEYS[e.code]);}
    function onPointer(e){
      if(e.button!==0||blocked()||e.target.closest('.sr-actor,button,a,input'))return;
      const seat=e.target.closest('[data-sr-seat]');if(seat){void sit(seat.dataset.srSeat);focus();return;}
      const interaction=e.target.closest('[data-sr-interaction]');if(interaction){const item=interactions.find(i=>i.id===interaction.dataset.srInteraction);if(item){if(isPortal(item))usePortal(item);else if((item.type||item.action)==='board')useBoard(item);}focus();return;}
      const bounds=viewport.getBoundingClientRect(),x=(e.clientX-bounds.left)/scale+camera.x,y=(e.clientY-bounds.top)/scale+camera.y;
      const interactionHit=interactions.find(item=>{if((item.type||item.action)!=='board'&&!isPortal(item))return false;const box=item.hitRect||item.rect;if(!box)return false;const r=rect(box);return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;});
      if(interactionHit){if(isPortal(interactionHit))usePortal(interactionHit);else useBoard(interactionHit);focus();return;}
      const hit=seats.find(s=>{const r=s.rect||s.hitRect;if(!r)return false;const q=rect(r);return x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h;});if(hit)void sit(hit.id);else moveTo(x,y);focus();
    }
    function onBlur(){keys.clear();cancelWalk();publish(true);}
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(viewport);
    document.addEventListener('keydown',onDown);document.addEventListener('keyup',onUp);document.addEventListener('visibilitychange',onBlur);window.addEventListener('blur',onBlur);viewport.addEventListener('pointerdown',onPointer);
    tools.querySelector('[data-tool="help"]').onclick=()=>{help.hidden=!help.hidden;focus();};tools.querySelector('[data-tool="zoom-out"]').onclick=()=>zoom(-.08);tools.querySelector('[data-tool="zoom-in"]').onclick=()=>zoom(.08);tools.querySelector('[data-tool="center"]').onclick=center;tools.querySelector('[data-tool="exit"]').onclick=()=>{cancelWalk();stand();options.onExit?.();};actionButton.onclick=()=>{void interact();focus();};controls.querySelector('[data-tool="floor-sit"]').onclick=floorSit;controls.querySelectorAll('[data-gesture]').forEach(b=>b.onclick=()=>greet(b.dataset.gesture));
    setStatus(options.status||{mode:'local'});setPlayers(options.players||[]);publish(true);updateNearby();updateCamera(0);placeActor(local,0,performance.now());raf=requestAnimationFrame(tick);
    function getCheckpoint(){const seat=state.seatId&&seatMap.get(state.seatId),point=seat&&(seat.exit||seat.approach);return {...state,...(point||{}),seatId:null,pose:'idle',moving:false};}
    function destroy(){if(dead)return;stand();dead=true;++claimToken;cancelAnimationFrame(raf);clearTimeout(noticeTimer);keys.clear();observer?.disconnect();document.removeEventListener('keydown',onDown);document.removeEventListener('keyup',onUp);document.removeEventListener('visibilitychange',onBlur);window.removeEventListener('blur',onBlur);viewport.removeEventListener('pointerdown',onPointer);for(const actor of actors.values())window.QPAvatarPose?.destroy(actor.svg);actors.clear();container.classList.remove('school-room-host');delete container.dataset.zone;container.replaceChildren();}
    return Object.freeze({destroy,getState:()=>({...state,camera:{...camera,scale,preferredScale,minimumScale},path:path.map(p=>({...p})),paused:blocked(),status:{...status},nearest:nearest?{type:nearest.type,id:nearest.id}:null,seatPending:seating}),getCheckpoint,moveTo,canStand:nav.canStand,sit,floorSit,stand,interact,setPlayers,setStatus,setPresence,focus,setPaused(value){paused=Boolean(value);if(paused){onBlur();++claimToken;}},setAvatar(av){updateArt(local,av);const profile={avatar:cleanAvatar(av)};if(presence?.setProfile)presence.setProfile(profile);else presence?.update?.(profile);},gesture:greet,center,zoom,scene,nav});
  }
  window.QPSchoolRoomWorld=Object.freeze({mount,createNavigation});
})();
