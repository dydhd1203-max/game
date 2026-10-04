/* Local map/atlas. Routes come from the live scene portals, never saved accounts. */
(() => {
  'use strict';
  const root=new URL('assets/world-life/',document.currentScript.src).href;
  const order=['village','forestgarden','treehouse','skyisland','adventure','autumnpark','camp','playground','campus'];
  const names={village:'중앙광장',forestgarden:'비밀정원',treehouse:'달빛 나무집',skyisland:'구름 위 버섯섬',adventure:'반딧불 모험숲',autumnpark:'단풍 소풍공원',camp:'별빛 캠핑장',playground:'학교 운동장',campus:'우리 반 교실'};
  const descriptions={village:'벚나무 아래에서 만나요',forestgarden:'숲속에 숨은 작은 쉼터',treehouse:'사다리를 타고 달빛 데크로',skyisland:'구름 사이 두더지 친구들',adventure:'빛나는 버섯과 비밀 다리',autumnpark:'단풍 아래 소풍 가는 날',camp:'모닥불 옆에서 별 이야기',playground:'삼은초등학교로 가요',campus:'친구들과 함께하는 교실'};
  const getScene=z=>z==='campus'?window.QPSchoolRoomScene.get():z==='playground'?window.QPPlaygroundScene.get():window.QPForestVillageScene.get(z);
  const portals=s=>(s.interactables||[]).filter(p=>order.includes(p.target));
  function route(from,to){const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),z=path.at(-1);if(z===to)return path;for(const p of portals(getScene(z)))if(!seen.has(p.target)){seen.add(p.target);queue.push([...path,p.target]);}}return [];}
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
  const position=(n,p,s)=>{n.style.left=(p.x/s.width*100)+'%';n.style.top=(p.y/s.height*100)+'%';};
  function mount(host,{scene,zone,tools,snapshot,pause,focus}){
    let selected=zone,last=0,open=false,dead=false;const listeners=[];
    const listen=(n,event,fn)=>{n.addEventListener(event,fn);listeners.push(()=>n.removeEventListener(event,fn));};
    const button=el('button','wm-open');button.dataset.tool='map';button.innerHTML='<img src="'+root+'map-scroll.png" alt=""> 지도 <kbd>M</kbd>';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');tools.prepend(button);
    const mini=el('aside','wm-mini');mini.setAttribute('aria-label','현재 위치 작은 지도');
    const miniHead=el('div','wm-mini-head'),miniOpen=el('button','wm-mini-open','주변 지도'),fold=el('button','wm-fold','−');fold.setAttribute('aria-label','작은 지도 접기');fold.setAttribute('aria-expanded','true');miniHead.append(miniOpen,fold);mini.append(miniHead);host.append(mini);
    function board(z,compact=false){const s=getScene(z),box=el('div','wm-board'),picture=el('img','wm-terrain');box.style.aspectRatio=s.width+'/'+s.height;picture.src=root+'thumbnails/'+z+'.webp';picture.alt=names[z]+' 전체 지도';picture.draggable=false;box.append(picture);const dots=el('div','wm-dots');
      portals(s).forEach((p,i)=>{const mark=el(compact?'span':'button','wm-portal',String(i+1));position(mark,p.approach||p,s);mark.title=names[p.target]+' 연결 입구';if(!compact){mark.setAttribute('aria-label',mark.title);mark.onclick=()=>select(p.target);}box.append(mark);});box.append(dots);return{box,dots,s};}
    const miniBoard=board(zone,true);mini.append(miniBoard.box);
    const legend=el('div','wm-legend');legend.innerHTML='<span><i class="wm-self"></i>나</span><span><i class="wm-friend"></i>친구</span><span><i class="wm-door"></i>입구</span>';mini.append(legend);
    const dialog=el('dialog','wm-dialog');dialog.setAttribute('aria-labelledby','wm-title');
    dialog.innerHTML='<header class="wm-header"><div><small>우리들의 숲속 여행</small><h2 id="wm-title">어디로 가 볼까?</h2></div><button class="wm-close" aria-label="지도 닫기">닫기 <kbd>Esc</kbd></button></header><div class="wm-body"><nav class="wm-places" aria-label="장소 선택"></nav><section class="wm-detail"><div class="wm-detail-head"><div><h3></h3><p></p></div><button class="wm-current">내 위치</button></div><div class="wm-map-area"></div><div class="wm-connections" aria-label="연결된 입구"></div><div class="wm-route" role="status" aria-live="polite"></div></section></div><footer class="wm-footer"><span class="wm-footer-legend">● 초록: 나　● 파랑: 친구　◆ 번호: 연결 입구</span><span>입구 화살표를 따라 걸어가면 다음 장소로 이동해요.</span></footer>';
    host.append(dialog);const placeList=dialog.querySelector('.wm-places'),area=dialog.querySelector('.wm-map-area');let large=null;
    for(const z of order){const b=el('button','wm-place');b.dataset.zone=z;b.innerHTML='<img alt="" loading="lazy" src="'+root+'thumbnails/'+z+'.webp"><span><b></b><small></small></span>';b.querySelector('b').textContent=names[z];b.querySelector('small').textContent=z===zone?'지금 여기 있어요':descriptions[z];b.onclick=()=>select(z);placeList.append(b);}
    function drawPeople(board,z,data){if(z!==zone)return;const key=JSON.stringify([Object.values(data.camera).map(v=>Math.round(v)),data.people.map(p=>[Math.round(p.x),Math.round(p.y),p.name,p.self])]);if(board.key===key)return;board.key=key;board.dots.replaceChildren();
      const view=el('span','wm-view');position(view,data.camera,board.s);view.style.width=Math.min(board.s.width,data.camera.width)/board.s.width*100+'%';view.style.height=Math.min(board.s.height,data.camera.height)/board.s.height*100+'%';board.dots.append(view);
      for(const p of data.people){const dot=el('span','wm-person '+(p.self?'wm-self':'wm-friend'));position(dot,p,board.s);dot.title=p.self?'내 위치':p.name;board.dots.append(dot);}
    }
    function update(now=0,force=false){if(dead||(!force&&now-last<180))return;last=now;const data=snapshot();if(!mini.classList.contains('is-folded'))drawPeople(miniBoard,zone,data);if(open&&large)drawPeople(large,selected,data);}
    function select(z){selected=z;for(const b of placeList.children)b.setAttribute('aria-pressed',String(b.dataset.zone===z));dialog.querySelector('h3').textContent=names[z];dialog.querySelector('.wm-detail-head p').textContent=descriptions[z];large=board(z);area.replaceChildren(large.box);const links=dialog.querySelector('.wm-connections');links.replaceChildren();portals(large.s).forEach((p,i)=>{const b=el('button','',String(i+1)+' · '+names[p.target]);b.onclick=()=>select(p.target);links.append(b);});const path=route(zone,z),hint=dialog.querySelector('.wm-route');hint.replaceChildren();if(z===zone)hint.textContent='지금 이곳에 있어요. 번호가 표시된 입구에서 다른 장소로 갈 수 있어요.';else if(path.length){const trail=el('b','',path.map(q=>names[q]).join(' → '));const next=portals(scene).find(p=>p.target===path[1]);hint.append(trail,el('span','','먼저 「'+next.label+'」 입구로 걸어가세요.'));}else hint.textContent='아직 연결된 길이 없어요.';update(0,true);}
    function show(){if(open||dead)return;open=true;pause(true);select(zone);dialog.showModal();button.setAttribute('aria-expanded','true');dialog.querySelector('.wm-close').focus();update(0,true);}
    function close(){if(!open)return;open=false;dialog.close();button.setAttribute('aria-expanded','false');pause(false);focus();}
    listen(button,'click',show);listen(miniOpen,'click',show);listen(fold,'click',()=>{const folded=mini.classList.toggle('is-folded');fold.textContent=folded?'+':'−';fold.setAttribute('aria-expanded',String(!folded));fold.setAttribute('aria-label',folded?'작은 지도 펼치기':'작은 지도 접기');update(0,true);});
    listen(dialog.querySelector('.wm-close'),'click',close);listen(dialog.querySelector('.wm-current'),'click',()=>select(zone));listen(dialog,'cancel',e=>{e.preventDefault();close();});listen(dialog,'click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    listen(document,'keydown',e=>{if(e.code!=='KeyM'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(!open&&(!host.contains(document.activeElement)||document.getElementById('modal')?.classList.contains('on')))return;e.preventDefault();open?close():show();});
    update(0,true);
    return {update,isOpen:()=>open,destroy(){dead=true;open=false;dialog.close();listeners.forEach(fn=>fn());mini.remove();dialog.remove();button.remove();}};
  }
  window.QPWorldMap=Object.freeze({mount,route,names});
})();
