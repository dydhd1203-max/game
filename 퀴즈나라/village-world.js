/* A shared, walkable forest town. The scene owns terrain and solid objects;
   this controller owns input, continuous height, camera and avatar animation. */
(() => {
  'use strict';
  const KEYS = {ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
  const SPEED=190, STEP=3, GRID=20, AVATAR_SIZE=88;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
  const cleanAvatar=av=>({...av,bg:'',frame:''});
  const zoneNames={village:'숲속 마을',tailor:'옷 가게',catalog:'옷 고르기',school:'수업 게시판',classroom:'퀴즈 수업',practice:'혼자 연습',home:'내 정보',motion:'움직임 연습',fashion:'패션왕'};
  const gestureNames={wave:'안녕! 👋',hello:'반가워!',happy:'신난다! ✨',heart:'고마워! 💛'};
  let serial=0;
  function mount(container,options={}) {
    const scene=options.scene||window.QPVillageScene, zone=options.zone||'village';
    if(!scene)throw new Error('숲속 마을 그림을 준비하지 못했어요.');
    const data=scene.build('vt'+(++serial)), user=options.user||{}, me=String(user.k||user.uid||'');
    const project=(x,y,h)=>scene.project(x,y,h);
    const saved=options.checkpoint;
    let state={...scene.spawn,facing:'right',direction:'front',moving:false,pose:'idle',jump:0,vy:0};
    if(!saved){
      let hash=0;for(const c of me)hash=(hash*31+c.charCodeAt(0))>>>0;
      for(let i=0;i<15;i++){const slot=(hash+i)%15,x=scene.spawn.x+(slot%5-2)*52,y=scene.spawn.y+(Math.floor(slot/5)-1)*28;
        if(scene.canStand(x,y,scene.spawn.height)&&!(options.players||[]).some(p=>p.uid!==me&&p.zone===zone&&Math.hypot(p.x-x,p.y-y)<42)){state.x=x;state.y=y;break;}}
    }
    if(saved&&scene.canStand(saved.x,saved.y,saved.height))state={...state,...saved,jump:0,vy:0};
    const keys=new Set(),actors=new Map(),found=new Set(options.discovered||[]);
    let dead=false,raf=0,last=0,phase=0,path=[],goal=null,gesture=null,roster=[],nearest=null,scale=1,travel=null;
    const travelLinks=data.travelLinks||scene.travelLinks||[],npcData=data.npcs||[],interactions=[...data.portals,...travelLinks.map(link=>({...link,...link.from,action:'travel',link:link.id}))];
    let camera={x:0,y:0},cameraReady=false,status='connecting',lastReport=0,lastAnnouncement='',blockedAt=0;
    container.classList.add('vt-host');
    container.dataset.zone=zone;
    container.innerHTML='';
    const viewport=el('div','vt-viewport');viewport.tabIndex=0;
    viewport.setAttribute('role','region');viewport.setAttribute('aria-label',zone==='tailor'?'옷 가게. 방향키로 걷고 진열대와 거울 앞에서 E로 이용해요.':'숲속 마을. 방향키와 WASD로 이동, 계단으로 오르내리기, E로 건물 입장, F로 인사, 스페이스로 점프.');
    const world=el('div','vt-world');world.style.width=scene.width+'px';world.style.height=scene.height+'px';
    const ground=el('div','vt-ground');ground.innerHTML=/^\s*<svg\b/.test(data.ground)?data.ground:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}">${data.ground}</svg>`;world.appendChild(ground);
    const objects=el('div','vt-objects');world.appendChild(objects);
    for(const obj of data.objects){
      const node=el('div','vt-object');node.dataset.object=obj.id;
      const p=project(obj.x,obj.y,obj.height||0);
      node.style.cssText=`left:${p.x-(obj.anchorX??obj.width/2)}px;top:${p.y-(obj.anchorY??obj.heightPixels)}px;width:${obj.width}px;height:${obj.heightPixels}px;z-index:${obj.layer==='front'?8000:Math.round(obj.depth??obj.y)};`;
      node.innerHTML=obj.markup;objects.appendChild(node);
    }
    const labels=el('div','vt-labels');world.appendChild(labels);
    for(const portal of interactions){
      const p=project(portal.x,portal.y,portal.height||0),button=el('button','vt-landmark',portal.label);
      button.dataset.portal=portal.id;button.style.left=(p.x+(portal.labelOffsetX||0))+'px';button.style.top=(p.y+28+(portal.labelOffsetY||0))+'px';
      button.setAttribute('aria-label',portal.label+'까지 걸어가기');
      button.onclick=e=>{e.stopPropagation();if(distanceTo(portal)<=portal.radius)interact(portal);else navigate(portal);};
      labels.appendChild(button);
    }
    const destination=el('div','vt-destination');destination.hidden=true;world.appendChild(destination);
    viewport.appendChild(world);container.appendChild(viewport);
    const ambience=window.QPVillageAmbience?.mount(world,{zone,viewport});
    const hud=el('div','vt-hud');hud.innerHTML='<div class="vt-place"><strong></strong><span class="vt-connection"></span></div><button class="vt-friends-toggle" aria-expanded="false">우리 반 친구 <b>1</b></button>';
    hud.querySelector('strong').textContent=zone==='tailor'?'새잎 옷 가게':'햇살숲 마을';container.appendChild(hud);
    const friends=el('div','vt-friends');friends.hidden=true;friends.setAttribute('aria-label','접속한 우리 반 친구');container.appendChild(friends);
    hud.querySelector('button').onclick=()=>{friends.hidden=!friends.hidden;hud.querySelector('button').setAttribute('aria-expanded',String(!friends.hidden));};
    const tools=el('div','vt-tools');tools.innerHTML='<button data-tool="map">마을 지도</button><button data-tool="profile">내 정보</button><button data-tool="help" title="조작 안내">조작 안내</button><button data-tool="zoom-out" aria-label="마을 축소">−</button><button data-tool="zoom-in" aria-label="마을 확대">＋</button><button data-tool="reset">광장으로</button>';
    if(zone==='tailor')tools.querySelector('[data-tool="reset"]').textContent='입구로';container.appendChild(tools);
    const help=el('div','vt-help');help.hidden=true;help.innerHTML='<b>방향키 / WASD</b> 걷기 · <b>바닥 클릭</b> 길 찾아 걷기<br><b>E</b> 입장·이용 · <b>F</b> 손 흔들기 · <b>Space</b> 점프<br>계단과 밧줄로 높은 곳을 탐험해요.';container.appendChild(help);
    const map=el('div','vt-map');map.hidden=true;map.append(el('strong','','어디로 가 볼까요?'));
    for(const portal of interactions){if(portal.id?.endsWith('-down'))continue;const button=el('button','vt-map-stop',portal.label);button.onclick=()=>{map.hidden=true;navigate(portal);};map.appendChild(button);}
    container.appendChild(map);
    if(zone==='tailor')tools.querySelector('[data-tool="map"]').hidden=true;
    const dialogue=el('div','vt-dialogue');dialogue.hidden=true;dialogue.setAttribute('role','dialog');dialogue.setAttribute('aria-label','가게 직원과 이야기');container.appendChild(dialogue);
    const controls=el('div','vt-controls');controls.innerHTML='<div class="vt-emotes"><button data-gesture="wave">👋 손 흔들기 <small>F</small></button><button data-gesture="hello">인사</button><button data-gesture="happy">✨ 신나!</button><button data-gesture="heart">💛 고마워</button></div><button class="vt-enter" disabled>건물 앞에서 E</button>';
    container.appendChild(controls);
    const notice=el('div','vt-notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');container.appendChild(notice);
    const levelBadge=el('div','vt-level');container.appendChild(levelBadge);
    let noticeTimer;
    function announce(text){if(text===lastAnnouncement)return;lastAnnouncement=text;notice.textContent=text;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),3300);}
    tools.querySelector('[data-tool="help"]').onclick=()=>{help.hidden=!help.hidden;};
    tools.querySelector('[data-tool="map"]').onclick=()=>{map.hidden=!map.hidden;};
    tools.querySelector('[data-tool="profile"]').onclick=()=>options.onMenu?.('home');
    tools.querySelector('[data-tool="zoom-in"]').onclick=()=>zoom(.1);
    tools.querySelector('[data-tool="zoom-out"]').onclick=()=>zoom(-.1);
    tools.querySelector('[data-tool="reset"]').onclick=()=>{path=[];goal=null;gesture=null;travel=null;dialogue.hidden=true;state={...state,...scene.spawn,jump:0,vy:0,moving:false};cameraReady=false;send();announce(zone==='tailor'?'옷 가게 입구로 돌아왔어요.':'친구들이 모이는 광장으로 돌아왔어요.');viewport.focus({preventScroll:true});};
    controls.querySelectorAll('[data-gesture]').forEach(b=>b.onclick=()=>{greet(b.dataset.gesture);viewport.focus({preventScroll:true});});
    const enter=controls.querySelector('.vt-enter');enter.onclick=()=>{if(nearest)interact(nearest);viewport.focus({preventScroll:true});};
    function zoom(delta){scale=clamp(scale+delta,.65,1.15);cameraReady=false;viewport.focus({preventScroll:true});}
    function resize(){if(!cameraReady)scale=zone==='tailor'?clamp(Math.min(viewport.clientWidth/scene.width,viewport.clientHeight/scene.height)*.98,.65,1):viewport.clientWidth<1100?.8:.88;cameraReady=false;}
    const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
    function makeActor(player,self){
      const node=el('div','vt-actor'+(self?' is-me':''));node.dataset.uid=player.uid;
      const shadow=el('div','vt-contact'),art=el('div','vt-avatar'),name=el('span','vt-name',self?(user.name||player.name)+' · 나':player.name),bubble=el('span','vt-bubble');bubble.hidden=true;
      node.append(shadow,art,name,bubble);objects.appendChild(node);
      const actor={node,art,name,bubble,shadow,svg:null,avatarKey:'',current:{x:player.x,y:player.y,height:player.height||0},target:player,self};
      if(!self){node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',player.name+'에게 다가가 인사하기');node.onclick=e=>{e.stopPropagation();if(distanceTo(player)<100)greet('wave',player.uid);else navigate(player);};node.onkeydown=e=>{if(e.code==='Enter'){e.stopPropagation();node.click();}};}
      updateArt(actor,player.avatar||user.av);return actor;
    }
    function updateArt(actor,av){
      const clean=cleanAvatar(av||{}),key=JSON.stringify(clean);
      if(actor.avatarKey===key)return;
      if(actor.svg)window.QPAvatarPose?.destroy(actor.svg);
      actor.avatarKey=key;actor.art.innerHTML=options.renderAvatar(options.validateAvatar?options.validateAvatar(clean):{...user.av,...clean},AVATAR_SIZE,3);
      actor.svg=actor.art.querySelector('svg');
      const view=actor.svg?.viewBox.baseVal,foot=Number(actor.svg?.querySelector('.qpx-contact-shadow')?.getAttribute('cy'))||52.37;
      actor.art.style.left=-(AVATAR_SIZE*(view?.width||32)/(view?.height||56))/2+'px';
      actor.art.style.top=-AVATAR_SIZE*foot/(view?.height||56)+'px';
      actor.name.style.top=-(AVATAR_SIZE*foot/(view?.height||56)+20)+'px';
      actor.bubble.style.top=-(AVATAR_SIZE*foot/(view?.height||56)+50)+'px';
      window.QPAvatarPose?.prepare(actor.svg);
    }
    const self=makeActor({uid:me,name:user.name,avatar:user.av,...state},true);actors.set(me,self);
    for(const npc of npcData){const actor=makeActor({...npc,uid:'npc_'+npc.id,avatar:npc.avatar,moving:false,facing:'right'},false);actor.npc=npc;actor.node.dataset.npc=npc.id;actor.node.setAttribute('aria-label',npc.name+'에게 말 걸기');actor.node.onclick=e=>{e.stopPropagation();const portal=interactions.find(p=>p.npc===npc.id)||{...npc,action:'talk',npc:npc.id,radius:65};distanceTo(portal)<(portal.radius||65)?talk(npc):navigate(portal);};actors.set('npc_'+npc.id,actor);}
    function setPlayers(players){
      if(dead)return;const newest=new Map();for(const p of Array.isArray(players)?players:[]){const old=newest.get(p.uid);if(!old||p.updatedAt>old.updatedAt||p.updatedAt===old.updatedAt&&p.connectionId>old.connectionId)newest.set(p.uid,p);}roster=[...newest.values()];
      const seen=new Set([me]);
      for(const player of roster){
        if(player.self||player.uid===me||player.zone!==zone)continue;
        if(!scene.canStand(player.x,player.y,player.height,0)&&!(player.pose==='climb'&&onTravelCorridor(player)))continue;
        seen.add(player.uid);let actor=actors.get(player.uid);
        if(!actor){actor=makeActor(player,false);actors.set(player.uid,actor);}
        actor.target=player;actor.name.textContent=player.name;updateArt(actor,player.avatar);
      }
      for(const [uid,actor]of actors)if(!actor.npc&&!seen.has(uid)){window.QPAvatarPose?.destroy(actor.svg);actor.node.remove();actors.delete(uid);}
      const unique=new Map();for(const p of roster){const old=unique.get(p.uid);if(!old||p.updatedAt>old.updatedAt)unique.set(p.uid,p);}if(!unique.has(me))unique.set(me,{uid:me,name:user.name,zone,self:true});
      hud.querySelector('b').textContent=String(unique.size);
      friends.replaceChildren();
      for(const player of unique.values()){
        const row=el('button','vt-friend-row');row.append(el('strong','',player.uid===me?(user.name||player.name)+' · 나':player.name),el('span','',zoneNames[player.zone]||'활동 중'));
        row.disabled=player.uid===me||player.zone!==zone;
        row.onclick=()=>{friends.hidden=true;hud.querySelector('button').setAttribute('aria-expanded','false');navigate(player);};friends.appendChild(row);
      }
    }
    function setStatus(value){if(dead)return;status=value?.mode||'connecting';hud.querySelector('.vt-connection').textContent=status==='connected'?'우리 반과 함께':status==='connecting'?'친구를 찾는 중…':'연결 대기 · 마을 탐험 가능';hud.querySelector('.vt-connection').dataset.status=status;}
    const ownPresence=!options.presence;
    const presence=options.presence||window.QPVillagePresence?.connect({db:options.db,uid:me,name:user.name,avatar:user.av,classId:options.classId,onPlayers:setPlayers,onStatus:setStatus});
    const clock=()=>presence?.getTime?.()||Date.now();
    function send(extra={}){presence?.update({x:state.x,y:state.y,height:state.height,zone,facing:state.facing,direction:state.direction,moving:state.moving,pose:travel?'climb':state.jump>0?'jump':state.moving?'walk':'idle',...extra});}
    setPlayers(options.players||[]);setStatus(options.status);presence?.setProfile({name:user.name,avatar:user.av});send();
    function distanceTo(p){return Math.hypot(state.x-p.x,state.y-p.y)+Math.abs(state.height-(p.height||0))*2;}
    function greet(type,to){
      if(travel||!dialogue.hidden)return;
      const now=clock();if(gesture&&now-gesture.at<1200)return;
      path=[];goal=null;state.moving=false;
      const close=roster.filter(p=>p.uid!==me&&p.zone===zone&&distanceTo(p)<115).sort((a,b)=>distanceTo(a)-distanceTo(b))[0];
      gesture={type,at:now,duration:1500,to:to||close?.uid};
      send({gesture});if(close&&!to)announce(close.name+'에게 '+(type==='wave'?'손을 흔들었어요.':'인사했어요.'));
      viewport.focus({preventScroll:true});
    }
    function interact(portal){
      if(distanceTo(portal)>(portal.radius||60)){navigate(portal);return;}
      path=[];goal=null;keys.clear();state.moving=false;
      if(portal.action==='talk'){const npc=npcData.find(n=>n.id===portal.npc);if(npc)talk(npc);return;}
      if(portal.action==='travel'){const link=travelLinks.find(l=>l.id===portal.link);if(link){if(distanceTo(link.from)>2)navigate({...link.from,id:link.id,label:link.label,autoTravel:link.id});else startTravel(link);}return;}
      send();options.onPortal?.(portal,{...state});
    }
    function startTravel(link){if(!link)return;gesture=null;travel={...link,at:performance.now(),phase:0};announce(link.label+' · 밧줄을 단단히 잡고 이동해요.');}
    function talk(npc){
      path=[];goal=null;keys.clear();state.moving=false;gesture=null;send();dialogue.replaceChildren();dialogue.append(el('strong','',npc.name));for(const line of npc.lines||['어서 와요!'])dialogue.append(el('p','',line));
      const buttons=el('div','vt-dialogue-choices');for(const choice of npc.choices||[]){const button=el('button','',choice.label);button.onclick=()=>{dialogue.hidden=true;if(choice.action!=='close')options.onPortal?.({action:choice.action,id:npc.id},{...state});else viewport.focus({preventScroll:true});};buttons.appendChild(button);}
      const close=el('button','vt-dialogue-close','나중에 이야기할게요');close.onclick=()=>{dialogue.hidden=true;viewport.focus({preventScroll:true});};buttons.appendChild(close);dialogue.appendChild(buttons);dialogue.hidden=false;
      const actor=actors.get('npc_'+npc.id);if(actor){actor.target={...actor.target,gesture:{type:'hello',at:clock(),duration:2200}};actor.bubble.textContent=(npc.lines||['어서 와요!'])[0];}
      dialogue.querySelector('button')?.focus({preventScroll:true});
    }
    function travelProgress(point){
      // The first matching physical rope is the common pose reference in both
      // directions, including a friend first seen halfway through a descent.
      for(const link of travelLinks){const a=link.from,b=link.to,dh=b.height-a.height;if(!dh)continue;const t=(point.height-a.height)/dh;if(t<-.04||t>1.04)continue;if(Math.hypot(point.x-a.x-(b.x-a.x)*t,point.y-a.y-(b.y-a.y)*t)<30)return clamp(t,0,1);}return null;
    }
    function onTravelCorridor(point){return travelProgress(point)!==null;}
    function passable(x,y,h){return scene.canStand(x,y,h,11);}
    function passableSegment(ax,ay,ah,bx,by){
      const steps=Math.ceil(Math.hypot(bx-ax,by-ay)/STEP)||1;let height=ah;
      for(let i=1;i<=steps;i++){const x=ax+(bx-ax)*i/steps,y=ay+(by-ay)*i/steps;if(!passable(x,y,height))return null;height=scene.surfaceAt(x,y,height).height;}return height;
    }
    function moveBy(dx,dy){
      const count=Math.ceil(Math.hypot(dx,dy)/STEP)||1;let moved=false;
      for(let i=0;i<count;i++){
        let x=state.x+dx/count,y=state.y+dy/count;
        if(passable(x,y,state.height)){const s=scene.surfaceAt(x,y,state.height);state.x=x;state.y=y;state.height=s.height;moved=true;}
        else if(dx&&passable(x,state.y,state.height)){const s=scene.surfaceAt(x,state.y,state.height);state.x=x;state.height=s.height;moved=true;}
        else if(dy&&passable(state.x,y,state.height)){const s=scene.surfaceAt(state.x,y,state.height);state.y=y;state.height=s.height;moved=true;}
      }
      return moved;
    }
    // Bounded A*: the same terrain/solid-body rules govern both keyboard movement
    // and click-to-walk. It never jumps a cliff, cuts diagonally through a wall,
    // or teleports an avatar to a destination.
    function findPath(target){
      const cols=Math.ceil(scene.width/GRID),rows=Math.ceil(scene.height/GRID),key=(x,y)=>y*cols+x;
      const cell=(x,y)=>({cx:clamp(Math.round(x/GRID),1,cols-2),cy:clamp(Math.round(y/GRID),1,rows-2)});
      const start=cell(state.x,state.y),end=cell(target.x,target.y),nodes=new Map(),open=[];
      const first={...start,x:state.x,y:state.y,h:state.height,g:0,f:0,parent:null,k:key(start.cx,start.cy)};nodes.set(first.k,first);open.push(first);
      let best=first,iterations=0;
      const heuristic=n=>Math.hypot(n.x-target.x,n.y-target.y)+Math.abs(n.h-(target.height||0));
      first.f=heuristic(first);
      while(open.length&&iterations++<16000){
        let index=0;for(let i=1;i<open.length;i++)if(open[i].f<open[index].f)index=i;
        const n=open.splice(index,1)[0];if(n.closed)continue;n.closed=true;
        if(heuristic(n)<heuristic(best))best=n;
        if(Math.hypot(n.x-target.x,n.y-target.y)<GRID*1.5&&Math.abs(n.h-(target.height||0))<12){best=n;break;}
        for(const [sx,sy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
          const cx=n.cx+sx,cy=n.cy+sy;if(cx<1||cy<1||cx>=cols-1||cy>=rows-1)continue;
          const x=cx*GRID,y=cy*GRID,h=passableSegment(n.x,n.y,n.h,x,y);if(h===null)continue;
          if(sx&&sy&&(passableSegment(n.x,n.y,n.h,n.x,y)===null||passableSegment(n.x,n.y,n.h,x,n.y)===null))continue;
          const k=key(cx,cy),g=n.g+GRID*(sx&&sy?Math.SQRT2:1),old=nodes.get(k);
          if(old&&(old.closed||old.g<=g))continue;
          const next={cx,cy,x,y,h,g,f:g+heuristic({x,y,h}),parent:n,k};nodes.set(k,next);open.push(next);
        }
      }
      if(Math.hypot(best.x-target.x,best.y-target.y)>Math.max(38,target.radius||40))return [];
      const points=[];for(let n=best;n.parent;n=n.parent)points.unshift({x:n.x,y:n.y,height:n.h});
      if(passableSegment(best.x,best.y,best.h,target.x,target.y)!==null)points.push({x:target.x,y:target.y,height:target.height||best.h});
      return points;
    }
    function navigate(target){
      if(travel)return false;
      dialogue.hidden=true;
      gesture=null;keys.clear();const next=findPath(target);
      if(!next.length){announce('여기서는 바로 갈 수 없어요. 길과 계단을 따라가 보세요.');return false;}
      path=next;goal={...target};destination.hidden=false;const p=project(target.x,target.y,target.height||0);destination.style.left=p.x+'px';destination.style.top=p.y+'px';
      announce((target.label||target.name||'선택한 곳')+'까지 걸어가요. 방향키를 누르면 직접 움직여요.');viewport.focus({preventScroll:true});return true;
    }
    viewport.addEventListener('click',event=>{
      if(event.target.closest('button,.vt-actor'))return;
      const rect=world.getBoundingClientRect(),x=(event.clientX-rect.left)/scale,screenY=(event.clientY-rect.top)/scale;
      // Choose the visible surface, highest first, then apply its matching floor.
      for(const start of [...(scene.heights||[120,72,0])].sort((a,b)=>b-a)){let h=start,s;for(let i=0;i<12;i++){s=scene.surfaceAt(x,screenY+h);if(!s.allowed)break;h=s.height;}const y=screenY+h;s=scene.surfaceAt(x,y);if(s.allowed&&Math.abs(y-s.height-screenY)<1){navigate({x,y,height:s.height});return;}}
      announce('물이나 절벽으로는 갈 수 없어요. 가까운 길을 골라 주세요.');
    });
    const suspended=()=>document.hidden||!!options.isBlocked?.()||!!document.querySelector('#modal.on');
    const keydown=event=>{
      if(event.target.closest('input,textarea,select,[contenteditable="true"]')||suspended()||travel||!dialogue.hidden)return;
      if((event.code==='Space'||event.code==='Enter')&&event.target.closest('button,[role="button"]'))return;
      if(KEYS[event.code]){event.preventDefault();keys.add(KEYS[event.code]);path=[];goal=null;gesture=null;}
      else if(event.code==='KeyE'){event.preventDefault();if(!event.repeat&&nearest)interact(nearest);}
      else if(event.code==='KeyF'){event.preventDefault();if(!event.repeat)greet('wave');}
      else if(event.code==='Space'){event.preventDefault();if(!event.repeat&&state.jump===0){gesture=null;state.vy=230;}}
    };
    const keyup=event=>{if(event.code==='Escape'&&!dialogue.hidden){dialogue.hidden=true;viewport.focus({preventScroll:true});}if(KEYS[event.code]){event.preventDefault();keys.delete(KEYS[event.code]);}};
    viewport.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);
    const clearKeys=()=>{keys.clear();state.moving=false;send();};window.addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',clearKeys);
    function tick(time){
      if(dead)return;const dt=Math.min(.045,last?(time-last)/1000:0);last=time;
      const isSuspended=suspended();ambience?.setPaused(isSuspended);
      if(isSuspended){clearKeys();last=0;raf=requestAnimationFrame(tick);return;}
      if(travel){
        travel.phase=clamp(travel.phase+dt*1000/(travel.duration||3000),0,1);const t=travel.phase,a=travel.from,b=travel.to;
        state.x=a.x+(b.x-a.x)*t;state.y=a.y+(b.y-a.y)*t;state.height=a.height+(b.height-a.height)*t;state.moving=false;state.jump=0;state.vy=0;
        if(t===1){const done=travel;travel=null;state={...state,...done.to};if(!scene.canStand(state.x,state.y,state.height)){state={...state,...done.from};announce('착지할 곳이 막혀 있어요. 밧줄 아래로 돌아왔어요.');}else announce(done.arrivalText||'도착! 높은 곳에서 마을을 둘러보세요.');send();}
      }
      let dx=(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=(keys.has('down')?1:0)-(keys.has('up')?1:0);
      if(!dx&&!dy&&path.length){
        const point=path[0],dist=Math.hypot(point.x-state.x,point.y-state.y);
        if(dist<Math.max(2,SPEED*dt)){const accepted=moveBy(point.x-state.x,point.y-state.y);if(accepted||dist<2)path.shift();else path=[];}
        else{dx=(point.x-state.x)/dist;dy=(point.y-state.y)/dist;}
      }
      if(!path.length&&goal){const reached=goal;goal=null;destination.hidden=true;if(reached.autoTravel&&distanceTo(reached)<3)startTravel(travelLinks.find(link=>link.id===reached.autoTravel));else if(reached.action&&distanceTo(reached)<(reached.radius||60))announce(reached.label+' 앞에 도착했어요. E로 이용해요.');}
      if(travel){dx=0;dy=0;}
      const length=Math.hypot(dx,dy);if(length>1){dx/=length;dy/=length;}
      const wasMoving=state.moving;state.moving=length>0&&moveBy(dx*SPEED*dt,dy*SPEED*dt);
      if(dx)state.facing=dx<0?'left':'right';
      if(state.moving)state.direction=Math.abs(dx)>=Math.abs(dy)?state.facing:'front';
      if(state.moving){phase=(phase+dt*2.2)%1;gesture=null;}
      if(length&&!state.moving&&Date.now()-blockedAt>3500){blockedAt=Date.now();announce('길이 막혀 있어요. 열린 길이나 계단 쪽으로 돌아가요.');path=[];goal=null;destination.hidden=true;}
      if(state.vy||state.jump){state.vy-=690*dt;state.jump+=state.vy*dt;if(state.jump<=0){state.jump=0;state.vy=0;}}
      if(gesture&&clock()>gesture.at+gesture.duration)gesture=null;
      const p=project(state.x,state.y,state.height),vw=viewport.clientWidth/scale,vh=viewport.clientHeight/scale;
      const target={x:clamp(p.x-vw/2,0,Math.max(0,scene.width-vw)),y:clamp(p.y-vh*(zone==='village'?.58:.72),0,Math.max(0,scene.height-vh))};
      const lerp=cameraReady?1-Math.exp(-dt*10):1;camera.x+=(target.x-camera.x)*lerp;camera.y+=(target.y-camera.y)*lerp;cameraReady=true;
      const offsetX=Math.max(0,(viewport.clientWidth-scene.width*scale)/2),offsetY=Math.max(0,(viewport.clientHeight-scene.height*scale)/2);
      world.style.transform=`translate(${offsetX-camera.x*scale}px,${offsetY-camera.y*scale}px) scale(${scale})`;
      self.current={x:state.x,y:state.y,height:state.height};self.target={...state,pose:travel?'climb':state.pose,gesture,facing:state.facing};
      for(const actor of actors.values())renderActor(actor,dt,time);
      if(time-lastReport>130||wasMoving!==state.moving){send();lastReport=time;}
      const choices=interactions.filter(portal=>distanceTo(portal)<(portal.radius||60));nearest=travel?null:choices.sort((a,b)=>distanceTo(a)-distanceTo(b))[0]||null;
      const enterLabel=nearest?nearest.label+' · E':zone==='tailor'?'진열대·거울 앞에서 E':'건물 앞에서 E';
      if(enter.textContent!==enterLabel)enter.textContent=enterLabel;enter.disabled=!nearest;
      const surface=scene.surfaceAt(state.x,state.y,state.height);const levelText=surface.label||zoneNames[zone];if(levelBadge.textContent!==levelText)levelBadge.textContent=levelText;
      for(const discovery of data.discoveries||[]){if(!found.has(discovery.id)&&distanceTo(discovery)<(discovery.radius||65)){found.add(discovery.id);announce('발견! '+discovery.label);options.onDiscover?.(discovery,[...found]);}}
      raf=requestAnimationFrame(tick);
    }
    function renderActor(actor,dt,time){
      const target=actor.target;if(!target)return;
      if(!actor.self){const f=1-Math.exp(-dt*14);actor.current.x+=(target.x-actor.current.x)*f;actor.current.y+=(target.y-actor.current.y)*f;actor.current.height+=((target.height||0)-actor.current.height)*f;}
      const p=project(actor.current.x,actor.current.y,actor.current.height),jump=actor.self?state.jump:target.pose==='jump'?12:0;
      actor.node.style.transform=`translate(${p.x}px,${p.y}px)`;actor.node.style.zIndex=String(Math.round(actor.current.y)+1);
      actor.art.style.transform=`translateY(${-jump}px)`;
      const labelLift=jump?`translate(-50%, ${-jump}px)`:'';
      actor.name.style.transform=labelLift;actor.bubble.style.transform=labelLift;
      actor.shadow.style.opacity=String(.23*(1-jump/100));
      const g=target.gesture,now=clock(),live=g&&now>=g.at&&now<g.at+g.duration;
      actor.bubble.hidden=!live;if(live){const msg=actor.npc?(actor.npc.lines||['어서 와요!'])[0]:gestureNames[g.type]||'안녕!';if(actor.bubble.textContent!==msg)actor.bubble.textContent=msg;}
      const action=target.pose==='climb'?'climb':jump?'jump':target.moving?'walk':'idle';
      // Climbing hands follow the same physical progress for local and remote
      // students. A free-running remote clock would cycle the arms too quickly.
      const posePhase=action==='climb'?(travelProgress(actor.current)??0):actor.self?phase:(time/450)%1;
      window.QPAvatarPose?.apply(actor.svg,{action,facing:target.facing===-1||target.facing==='left'?'left':'right',direction:actor.npc?'front':target.direction,phase:posePhase,grounded:!jump,vy:actor.self?state.vy:-1,
        gesture:live?(g.type==='wave'?'wave':g.type==='hello'?'nod':'happy'):null,gestureProgress:live?(now-g.at)/g.duration:0});
    }
    raf=requestAnimationFrame(tick);viewport.focus({preventScroll:true});
    return {
      setPlayers,setStatus,navigate,greet,
      getState:()=>({...state,zone,scale,camera:{...camera},pathLength:path.length,nearPortal:nearest?.id||null,travel:travel?{id:travel.id,phase:travel.phase}:null,players:roster.map(p=>({...p})),discovered:[...found]}),
      getScene:()=>scene,
      focus:()=>viewport.focus({preventScroll:true}),
      destroy(){if(dead)return;dead=true;clearKeys();cancelAnimationFrame(raf);clearTimeout(noticeTimer);observer.disconnect();ambience?.destroy();document.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearKeys);document.removeEventListener('visibilitychange',clearKeys);
        options.onCheckpoint?.({...state,jump:0,vy:0,moving:false});presence?.update({moving:false,pose:'idle'});if(ownPresence)presence?.disconnect();for(const actor of actors.values())window.QPAvatarPose?.destroy(actor.svg);container.replaceChildren();container.classList.remove('vt-host');}
    };
  }
  window.QPForestVillage=Object.freeze({mount});
})();
