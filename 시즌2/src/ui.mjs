import {TOWERS, TEAM_COLORS, BEACON, GATE} from './content.mjs';
import {APPEARANCE_OPTIONS} from './avatar-season1.mjs';

const svg=(body)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON={
  arrow:svg('<path d="M5 19h14M8 19v-6h8v6M6 12h12L12 5zM12 5V2M8 6l8-3"/>'),
  ice:svg('<path d="m12 2 5 7-5 7-5-7zM12 2v14M7 9h10M6 21h12M8 21v-5h8v5"/>'),
  crate:svg('<path d="m3 7 9-4 9 4v12l-9 3-9-3zM3 7l9 4 9-4M12 11v11M7 5l9 4"/>'),
  settings:svg('<path d="M4 7h16M4 17h16M9 4v6M16 14v6"/><circle cx="9" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="17" r="2" fill="currentColor"/>'),
  help:svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 8.4a2.5 2.5 0 1 1 4.2 2.5c-1.5.8-1.8 1.4-1.8 2.6M12 17h.01"/>'),
  performance:svg('<path d="M3 18V6M3 18h18M6 14l4-5 4 3 6-7"/>'),
  compass:svg('<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6zM12 1v3M12 20v3M1 12h3M20 12h3"/>'),
  hand:svg('<path d="M8 13V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8c0 5-3 7-7 7-3 0-5-2-7-5l-3-4a2 2 0 0 1 3-2l2 2"/>')
};
const APPEARANCE_FIELDS=[['hat','hats','모자'],['face','faces','얼굴'],['clothes','clothes','옷']];
const appearanceChoices=(prefix)=>`<div class="appearance-grid" role="group" aria-label="내 캐릭터 꾸미기">${APPEARANCE_FIELDS.map(([field,,label])=>`<label for="${prefix}-${field}">${label}<select id="${prefix}-${field}" name="${field}" aria-label="${label} 고르기"></select></label>`).join('')}</div>`;
const TEAM_NAMES=['산호 모둠','하늘 모둠','새싹 모둠','햇살 모둠','라벤더 모둠'];
const PHASES={lobby:['대기실','친구들과 모여 원정을 준비해요.'],village:['정박 마을','타워 작업장과 광장을 둘러보고 숲으로 출발해요.'],forest:['안개 숲','앞길을 열고 봉화에 불을 밝혀요.'],boss:['가시등 멧돼지','돌진을 옆으로 피하고, 멈춘 틈에 함께 공격해요.'],victory:['첫 원정 성공','숲길 파수꾼을 물리쳤어요!'],defeat:['원정 재정비','다시 준비하고 함께 도전해요.']};
const ROLES={solo:'혼자 시작',host:'교사 방 만들기',join:'학생 입장'};
const TEMPLATE=`
<section id="entry" class="screen entry" aria-label="원정대 입장">
  <div class="entry-story">
    <div class="entry-brand"><span class="crest">${ICON.compass}</span>좀비의 밤 · 시즌 2</div>
    <h1>함께 여는<span>새로운 새벽.</span></h1>
    <p class="lead">따뜻한 마을을 떠나, 안개 너머로.<br>친구와 타워를 옮기고<br>숲의 첫 번째 수호자를 만나세요.</p>
    <ol class="entry-route"><li><b>01 · GATHER</b>정박 마을에서 준비</li><li><b>02 · EXPLORE</b>숲길을 따라 전진</li><li><b>03 · TOGETHER</b>첫 보스 함께 공략</li></ol>
    <p class="entry-footer">새벽 원정대 — 첫 번째 원정</p>
  </div>
  <form id="entry-form" class="entry-form">
    <p class="eyebrow muted">DAWN EXPEDITION</p><h2>원정대에 합류하기</h2><p class="form-intro">익숙한 친구들과, 새로운 모험을 시작해요.</p>
    <div class="mode-tabs" role="group" aria-label="입장 방법"><label><input type="radio" name="mode" value="solo" checked><span>혼자 체험</span></label><label><input type="radio" name="mode" value="host"><span>선생님</span></label><label><input type="radio" name="mode" value="join"><span>학생</span></label></div>
    <div class="fields-row"><label class="field" for="player-name">이름<input id="player-name" name="name" maxlength="12" placeholder="이름을 알려 주세요" autocomplete="nickname" required></label><label class="field" for="team-select">모둠<select id="team-select" name="team">${TEAM_NAMES.map((n,i)=>`<option value="${i}">${i+1} · ${n.split(' ')[0]}</option>`).join('')}</select></label></div>
    <label id="room-field" class="field" for="room-code" hidden>접속 코드<input id="room-code" name="room" maxlength="16" placeholder="선생님이 알려 준 코드" autocomplete="off" spellcheck="false"></label>
    <label id="password-field" class="field" for="teacher-password" hidden>교사 암호<input id="teacher-password" name="password" type="password" placeholder="시즌1에서 사용한 교사 암호" autocomplete="current-password"></label>
    <div class="field" style="margin-top:14px"><span class="section-label">내 캐릭터 꾸미기</span>${appearanceChoices('entry')}</div>
    <button id="enter-button" class="primary entry-submit" type="submit">혼자 시작</button><p id="entry-note" class="entry-note">혼자서도 대기실부터 첫 보스까지 체험할 수 있어요.</p><p id="entry-error" class="entry-error" role="alert" hidden></p>
  </form>
</section>
<div id="game-hud" class="game-hud" hidden>
  <header class="topbar"><section class="panel phase-panel"><p class="eyebrow muted">좀비의 밤 시즌 2 · 새벽 원정대</p><div class="phase-heading"><span id="phase-number" class="phase-number">01</span><h1 id="phase-name">대기실</h1></div><p id="goal" class="goal"></p><div class="progress-line" aria-hidden="true"><i></i><i></i><i></i><i></i></div></section><div class="panel supplies">${ICON.crate}<div><small>공동 보급</small><strong id="supplies">600</strong></div></div></header>
  <nav class="top-tools" aria-label="게임 도구"><span class="panel room-label"><i id="network-dot" class="network-dot"></i><span id="room-label">혼자 체험</span></span><button type="button" id="performance-toggle" class="tool-button" aria-label="성능 측정 보기" title="성능 측정" aria-expanded="false">${ICON.performance}</button><button type="button" id="help-toggle" class="tool-button" aria-label="조작 방법 보기" title="조작 방법" aria-expanded="false">${ICON.help}</button><button type="button" id="settings-toggle" class="tool-button" aria-label="소리 설정 보기" title="소리 설정" aria-expanded="false">${ICON.settings}</button></nav>
  <section id="lobby-panel" class="panel side-panel"><div class="row"><h2>오늘의 원정대</h2><span class="spacer"></span><span id="lobby-count" class="badge">1명</span></div><p>광장을 자유롭게 걸으며 친구들을 기다려요.</p><div id="roster" class="roster"></div><span class="section-label">내 캐릭터 꾸미기</span>${appearanceChoices('lobby')}<div class="lobby-controls"><button type="button" id="ready-button">준비 완료</button><button type="button" id="start-game" class="primary">마을로 출발</button></div><p id="lobby-wait" class="muted" hidden>선생님이 출발하면 함께 마을로 이동해요.</p></section>
  <section id="village-panel" class="panel side-panel village-prep" hidden><button type="button" id="depart-game" class="primary wide">안개 숲으로 출격</button><p id="village-wait" hidden>선생님의 출격 신호를 기다려요.</p><details><summary>이번 원정 안내</summary><p>작업장과 보급 천막이 있는 안전한 마을이에요. 숲으로 나가 타워를 전진 배치하고, 가시등 멧돼지의 돌진을 피해 함께 공략하세요.</p></details></section>
  <section id="boss-panel" class="boss-panel" hidden aria-label="보스 상태"><div class="boss-heading"><strong>가시등 멧돼지</strong><span id="boss-hp"></span></div><div class="boss-track"><div id="boss-fill" class="boss-fill"></div></div><p id="boss-phase" class="boss-phase"></p></section>
  <section id="health-panel" class="panel health-panel"><div class="health-title"><strong id="health-name" class="health-name"></strong><span id="health-value"></span></div><div class="health-track"><div id="health-fill" class="health-fill"></div></div><div id="health-detail" class="health-detail"></div></section>
  <div id="bottom-help" class="bottom-help"><span class="key">W A S D</span> 이동 · 좌클릭 / Space 공격<br>우클릭 드래그 시점 · 휠 확대</div>
  <nav id="tower-dock" class="panel tower-dock" aria-label="타워와 상호작용"><button type="button" id="tower-arrow" class="tower-button" aria-pressed="false"><span class="key">1</span>${ICON.arrow}<strong>화살탑</strong><small>보급 ${TOWERS.arrow.cost}</small></button><button type="button" id="tower-ice" class="tower-button ice" aria-pressed="false"><span class="key">2</span>${ICON.ice}<strong>얼음탑</strong><small id="ice-cost">보급 ${TOWERS.ice.cost}</small></button><span class="dock-divider"></span><button type="button" id="modules-toggle" class="dock-action" aria-expanded="false">${ICON.crate}<span id="modules-label">보관함</span></button><button type="button" id="interact-button" class="dock-action" title="E · 상호작용">${ICON.hand}<span id="interact-label">도움 · E</span></button></nav>
  <section id="inventory-panel" class="panel inventory" hidden><div class="row"><h2>우리 모둠의 타워 보관함</h2><span class="spacer"></span><button type="button" id="inventory-close" class="ghost small" aria-label="보관함 닫기">닫기</button></div><p id="inventory-empty" class="inventory-empty">옮길 타워 가까이에서 T로 포장해 보세요.</p><div id="module-list" class="inventory-list"></div></section>
  <section id="context-card" class="panel context-card" hidden><div><strong id="context-title"></strong><small id="context-detail"></small></div><div class="row"><button type="button" id="pack-button">포장 T</button><button type="button" id="repair-button">수리 R</button></div></section>
  <div id="placement-note" class="placement-note" hidden><strong id="placement-label"></strong><span>좌클릭으로 설치 · Esc 취소</span></div>
  <nav id="teacher-bar" class="panel teacher-bar" aria-label="원정 운영"><button type="button" id="pause-button">일시정지</button><button type="button" id="save-button">저장</button><button type="button" id="load-button">불러오기</button></nav>
  <section id="settings-panel" class="panel settings-panel" hidden><h2>마을과 원정의 소리</h2><label for="bgm-volume">배경음<div class="slider-line"><input type="range" id="bgm-volume" min="0" max="100" value="35"><output id="bgm-output" for="bgm-volume">35</output></div></label><label for="sfx-volume">효과음<div class="slider-line"><input type="range" id="sfx-volume" min="0" max="100" value="65"><output id="sfx-output" for="sfx-volume">65</output></div></label><div class="row"><button type="button" id="camera-reset" class="small">시점 초기화</button><button type="button" id="leave-button" class="small danger">나가기</button></div></section>
  <section id="help-panel" class="panel help-panel" hidden><h2>원정 수첩</h2><dl><dt>W A S D · 방향키</dt><dd>이동하기</dd><dt>좌클릭 · Space</dt><dd>공격하기 · 설치는 좌클릭</dd><dt>우클릭 드래그</dt><dd>시점 돌리기 · 휠로 확대</dd><dt>1 · 2</dt><dd>화살탑 · 얼음탑 고르기</dd><dt>T · R</dt><dd>가까운 탑 포장 · 수리</dd><dt>E</dt><dd>봉화 밝히기 · 친구 돕기</dd><dt>Esc</dt><dd>타워 배치 취소</dd></dl><p class="tip">얼음탑과 화살탑의 사거리를 겹쳐 보세요. 서리 묻은 적에게 화살이 맞으면 <strong>쇄빙</strong>이 발동해요.<br>청색 설치 지대에서 타워를 옮겨 전진하세요.</p></section>
  <section id="performance-panel" class="panel performance-panel" hidden><h2>원정 성능 기록</h2><dl><dt>화면 속도</dt><dd id="perf-fps">—</dd><dt>함께하는 친구</dt><dd id="perf-players">—</dd><dt>현장 타워 / 적</dt><dd id="perf-actors">—</dd><dt>그리기 호출</dt><dd id="perf-calls">—</dd><dt>삼각형</dt><dd id="perf-triangles">—</dd></dl><button type="button" id="record-button" class="small record-button">측정 기록 저장</button></section>
  <div id="notice" class="notice" role="status" hidden></div>
  <section id="pause-screen" class="screen modal-screen" hidden><div class="modal-card pause-card"><p class="eyebrow muted">TAKE A BREATH</p><h2>잠깐, 숨 고르기</h2><p id="pause-text">선생님이 원정을 잠시 멈췄어요.</p><button type="button" id="resume-button" class="primary">원정 계속하기</button></div></section>
  <section id="endgame-screen" class="screen modal-screen" hidden><div class="modal-card"><div id="endgame-seal" class="victory-seal" aria-hidden="true">✦</div><p id="endgame-eyebrow" class="eyebrow muted">OUR FIRST DAWN</p><h2 id="endgame-title">첫 번째 새벽을 열었어요!</h2><p id="endgame-description">숲길 파수꾼을 물리쳤어요.<br>친구들과 타워를 옮기며 함께 만든 승리예요.</p><div id="victory-stats" class="victory-stats"><span><strong id="victory-players">1</strong>함께한 원정대</span><span><strong id="victory-towers">0</strong>남은 타워</span><span><strong id="victory-supplies">0</strong>공동 보급</span></div><div id="endgame-actions" class="row"><button type="button" id="retry-game">다시 도전</button><button type="button" id="return-game" class="primary">마을로 돌아가기</button></div><p id="endgame-wait" class="endgame-wait" hidden>선생님과 함께 다음 여정을 준비해요.</p></div></section>
</div>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>`;

/** DOM changes are keyed; hot per-frame updates do not rebuild panels or the roster. */
export function createUI(handlers){
  const root=document.getElementById('ui');
  if(!root)throw new Error('원정대 화면을 준비하지 못했습니다.');
  root.innerHTML=TEMPLATE;
  const elements=new Map(), cache=new Map();
  const el=id=>{if(!elements.has(id))elements.set(id,root.querySelector(`#${id}`));return elements.get(id);};
  const write=(id,value)=>{const text=String(value??'');if(cache.get(`text:${id}`)!==text){el(id).textContent=text;cache.set(`text:${id}`,text);}};
  const visible=(id,show)=>{if(el(id).hidden===!!show)el(id).hidden=!show;};
  const pressed=(id,yes)=>{const value=String(!!yes);if(el(id).getAttribute('aria-pressed')!==value)el(id).setAttribute('aria-pressed',value);};
  const disabled=(id,yes)=>{if(el(id).disabled!==!!yes)el(id).disabled=!!yes;};
  const fill=(id,ratio)=>{const value=`scaleX(${Math.max(0,Math.min(1,Number(ratio)||0)).toFixed(3)})`;if(cache.get(`fill:${id}`)!==value){el(id).style.transform=value;cache.set(`fill:${id}`,value);}};
  const on=(id,event,fn)=>el(id).addEventListener(event,fn);
  let state=null, context={}, entryAppearance={hat:0,face:0,clothes:0}, entryMode='solo', busy=false, activePanel=null, inventoryOpen=false, toastTimer=0, nearestTower=null;
  const call=(name,...args)=>handlers[name]?.(...args);
  const focusGame=()=>document.getElementById('game')?.focus({preventScroll:true});
  const action=(type,extra={})=>{const result=call('action',{type,...extra});focusGame();return result;};
  const togglePanel=id=>{activePanel=activePanel===id?null:id;for(const name of ['settings','help','performance']){visible(`${name}-panel`,activePanel===name);el(`${name}-toggle`).setAttribute('aria-expanded',String(activePanel===name));}};
  const setInventory=(open)=>{inventoryOpen=!!open;visible('inventory-panel',inventoryOpen);el('modules-toggle').setAttribute('aria-expanded',String(inventoryOpen));visible('context-card',!inventoryOpen&&!!nearestTower&&!context.selectedTower);};
  function updateEntryMode(){
    entryMode=root.querySelector('input[name="mode"]:checked')?.value||'solo';
    visible('room-field',entryMode!=='solo');visible('password-field',entryMode==='host');
    el('room-code').required=entryMode==='join';el('teacher-password').required=entryMode==='host';
    el('room-code').placeholder=entryMode==='host'?'원하는 코드 · 비워 두면 자동 생성':'선생님이 알려 준 코드';
    write('enter-button',busy?'원정대 준비 중…':ROLES[entryMode]);
    write('entry-note',entryMode==='solo'?'혼자서도 대기실부터 첫 보스까지 체험할 수 있어요.':entryMode==='host'?'접속 코드를 나누고 친구들이 모이면 출발해요.':'이름과 모둠을 고르고 선생님의 코드로 들어오세요.');
    visible('entry-error',false);
  }
  function chooseEntryAppearance(field,value){const collection=APPEARANCE_FIELDS.find(row=>row[0]===field)?.[1];const limit=APPEARANCE_OPTIONS[collection]?.length||1;const index=Math.max(0,Math.min(limit-1,Math.trunc(Number(value)||0)));entryAppearance[field]=index;el(`entry-${field}`).value=String(index);}
  for(const [field,collection] of APPEARANCE_FIELDS){for(const prefix of ['entry','lobby']){const select=el(`${prefix}-${field}`);for(const [index,name] of APPEARANCE_OPTIONS[collection].entries()){const option=document.createElement('option');option.value=String(index);option.textContent=name;select.append(option);}}on(`entry-${field}`,'change',()=>chooseEntryAppearance(field,el(`entry-${field}`).value));on(`lobby-${field}`,'change',()=>action('cosmetic',{[field]:Number(el(`lobby-${field}`).value)}));}
  root.querySelectorAll('input[name="mode"]').forEach(r=>r.addEventListener('change',updateEntryMode));
  try{const saved=JSON.parse(localStorage.getItem('zns2:profile')||'null');if(saved){el('player-name').value=String(saved.name||'').slice(0,12);el('team-select').value=String(Math.max(0,Math.min(4,Number(saved.team)||0)));for(const [field] of APPEARANCE_FIELDS)chooseEntryAppearance(field,saved[field]);}}catch{}
  on('entry-form','submit',async event=>{
    event.preventDefault();if(busy)return;
    const name=el('player-name').value.trim();if(!name){showEntry('원정에서 부를 이름을 입력해 주세요.');el('player-name').focus();return;}
    const profile={mode:entryMode,name,team:Number(el('team-select').value),...entryAppearance,room:el('room-code').value.trim(),password:el('teacher-password').value};
    try{localStorage.setItem('zns2:profile',JSON.stringify({name:profile.name,team:profile.team,hat:profile.hat,face:profile.face,clothes:profile.clothes}));}catch{}
    setBusy(true);visible('entry-error',false);
    try{await call('enter',profile);}catch(error){showEntry(error?.message||'입장하지 못했어요. 접속 정보를 확인하고 다시 시도해 주세요.');}finally{setBusy(false);}
  });
  on('start-game','click',()=>action('start'));on('depart-game','click',()=>action('depart'));on('ready-button','click',()=>action('ready'));
  on('pause-button','click',()=>action('pause'));on('resume-button','click',()=>action('pause'));on('retry-game','click',()=>action('retry'));on('return-game','click',()=>action('return'));
  on('tower-arrow','click',()=>{setInventory(false);call('selectTower',context.selectedTower==='arrow'?null:'arrow');focusGame();});
  on('tower-ice','click',()=>{setInventory(false);call('selectTower',context.selectedTower==='ice'?null:'ice');focusGame();});
  on('modules-toggle','click',()=>{call('selectTower',null);setInventory(!inventoryOpen);});on('inventory-close','click',()=>setInventory(false));
  on('interact-button','click',()=>action('interact'));
  on('pack-button','click',()=>{if(nearestTower)action('pack',{towerId:nearestTower.id});});
  on('repair-button','click',()=>{if(nearestTower)action('repair',{towerId:nearestTower.id});});
  on('save-button','click',()=>call('save'));on('load-button','click',()=>call('load'));on('record-button','click',()=>call('record'));
  on('leave-button','click',()=>{activePanel=null;visible('settings-panel',false);call('leave');});on('camera-reset','click',()=>call('cameraReset'));
  for(const name of ['settings','help','performance'])on(`${name}-toggle`,'click',()=>togglePanel(name));
  for(const kind of ['bgm','sfx'])on(`${kind}-volume`,'input',()=>{const value=Number(el(`${kind}-volume`).value);write(`${kind}-output`,value);call('sound',kind,value);});
  function renderRoster(players,localId){
    const key=players.map(p=>[p.id,p.name,p.team,!!p.ready,p.online!==false,p.id===localId].join(':')).join('|');
    if(cache.get('roster')===key)return;cache.set('roster',key);
    const fragment=document.createDocumentFragment();
    for(let team=0;team<5;team++){
      const members=players.filter(p=>p.team===team);if(!members.length)continue;
      const row=document.createElement('div');row.className='roster-team';
      const title=document.createElement('strong'),dot=document.createElement('i');dot.className='team-dot';dot.style.setProperty('--team',`#${TEAM_COLORS[team].toString(16).padStart(6,'0')}`);title.append(dot,document.createTextNode(`${team+1}모둠`));
      const list=document.createElement('div');list.className='roster-names';
      for(const p of members){const badge=document.createElement('span');badge.className=`roster-name${p.id===localId?' is-me':''}${p.ready?' is-ready':''}${p.online===false?' is-offline':''}`;badge.textContent=p.name||'원정대원';badge.title=`${p.name||'원정대원'}${p.online===false?' · 잠시 연결 끊김':p.ready?' · 준비 완료':''}`;list.append(badge);}
      row.append(title,list);fragment.append(row);
    }
    el('roster').replaceChildren(fragment);
  }
  function renderModules(towers,me){
    const modules=towers.filter(t=>(t.team===me?.team||t.carrier===context.localId)&&['carried','inventory'].includes(t.state));
    write('modules-label',modules.length?`보관함 ${modules.length}`:'보관함');
    const combat=['forest','boss'].includes(state.phase);
    const key=modules.map(t=>[t.id,t.type,t.state,Math.ceil(t.hp),t.carrier,t.carrier===context.localId].join(':')).join('|')+combat;
    if(cache.get('modules')===key)return;cache.set('modules',key);
    const fragment=document.createDocumentFragment();
    for(const tower of modules){
      const button=document.createElement('button');button.type='button';button.className='module-button';button.dataset.towerId=tower.id;
      const info=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small'),label=document.createElement('span');
      name.textContent=TOWERS[tower.type]?.name||'타워';detail.textContent=`체력 ${Math.ceil(tower.hp)} / ${tower.maxHp} · ${tower.state==='carried'?'운반 중':'보관 중'}`;label.textContent='다시 설치';
      button.disabled=!combat||(tower.state==='carried'&&tower.carrier!==context.localId);info.append(name,detail);button.append(info,label);
      button.addEventListener('click',()=>{action('deploy',{towerId:tower.id});setInventory(false);});fragment.append(button);
    }
    el('module-list').replaceChildren(fragment);visible('inventory-empty',modules.length===0);
  }
  function update(nextState,nextContext={}){
    if(!nextState)return;state=nextState;context=nextContext;
    const players=Object.values(state.players||{}),me=state.players?.[context.localId],online=players.filter(p=>p.online!==false),towers=state.towers||[];
    const phase=state.phase||'lobby',isHost=!!context.isHost,inCombat=phase==='forest'||phase==='boss',isEnd=phase==='victory'||phase==='defeat';
    const phaseName=PHASES[phase]||PHASES.lobby;
    write('phase-name',phaseName[0]);write('phase-number',String(phase==='lobby'?1:phase==='village'?2:phase==='forest'?3:4).padStart(2,'0'));
    let goal=phaseName[1];if(phase==='forest'){goal=state.beacon?'봉화가 켜졌어요. 북쪽 입구에서 E를 눌러 보스에게 도전하세요.':state.stage>=1?'봉화 곁의 적을 정리하고 E로 불을 밝혀요.':'청색 지대에 타워를 펼치고 숲길을 열어요.';}
    write('goal',goal);write('supplies',Math.floor(state.supplies||0).toLocaleString('ko-KR'));
    const progress=phase==='lobby'?0:phase==='village'?1:phase==='forest'?2:3;
    if(cache.get('progress')!==progress){root.querySelectorAll('.progress-line i').forEach((node,i)=>node.classList.toggle('done',i<=progress));cache.set('progress',progress);}
    write('room-label',context.mode==='solo'?'혼자 체험':context.room?`접속 코드 ${context.room}`:'원정대');
    el('network-dot').classList.toggle('offline',context.mode==='solo'||context.network===false||/끊|재연결|중단|오프라인/.test(context.network||''));el('room-label').title=typeof context.network==='string'?context.network:context.network===false?'다시 연결하는 중':'원정대 연결됨';
    visible('lobby-panel',phase==='lobby');visible('village-panel',phase==='village');visible('start-game',isHost);visible('lobby-wait',!isHost);visible('depart-game',isHost);visible('village-wait',!isHost);
    write('lobby-count',`${online.length}명`);write('ready-button',me?.ready?'준비 완료 ✓':'준비 완료');pressed('ready-button',me?.ready);
    if(phase==='lobby'){renderRoster(players,context.localId);for(const [field] of APPEARANCE_FIELDS){const value=String(me?.[field]||0);if(el(`lobby-${field}`).value!==value)el(`lobby-${field}`).value=value;}}
    write('health-name',me?.name||'원정대원');write('health-value',`${Math.max(0,Math.ceil(me?.hp||0))} / ${me?.maxHp||100}`);fill('health-fill',(me?.hp||0)/(me?.maxHp||100));
    el('health-fill').classList.toggle('low',me?.hp<(me?.maxHp||100)*.3);el('health-panel').classList.toggle('down',!!me&&me.hp<=0);
    const carrying=towers.find(t=>t.state==='carried'&&t.carrier===context.localId);
    write('health-detail',me?.hp<=0?'친구의 도움을 기다리는 중':carrying?`${TOWERS[carrying.type]?.name||'타워'} 운반 중 · 보관함에서 펼치기`:`${TEAM_NAMES[me?.team||0]} · ${inCombat?'함께 앞으로':'안전한 장소'}`);
    for(const type of ['arrow','ice']){pressed(`tower-${type}`,context.selectedTower===type);disabled(`tower-${type}`,!inCombat||!me||me.hp<=0||state.paused||(state.supplies||0)<TOWERS[type].cost||(type==='ice'&&!state.beacon));}
    write('ice-cost',state.beacon?`보급 ${TOWERS.ice.cost}`:'봉화 탈환 후');
    disabled('interact-button',!inCombat||!me||me.hp<=0||state.paused);
    let interactLabel='도움 · E';
    if(me&&phase==='forest'&&!state.beacon&&Math.hypot(me.x-BEACON.x,me.z-BEACON.z)<=5)interactLabel='봉화 · E';
    else if(me&&phase==='forest'&&state.beacon&&Math.hypot(me.x-GATE.x,me.z-GATE.z)<=5)interactLabel='보스 · E';
    else if(me&&players.some(p=>p.id!==me.id&&p.online!==false&&p.hp<=0&&Math.hypot(me.x-p.x,me.z-p.z)<=4))interactLabel='구조 · E';
    write('interact-label',interactLabel);
    visible('tower-dock',phase!=='lobby');visible('teacher-bar',isHost&&!isEnd);disabled('pause-button',phase==='lobby');write('pause-button',state.paused?'계속하기':'일시정지');
    renderModules(towers,me);
    nearestTower=null;let best=4.01;
    if(inCombat&&me){for(const tower of towers){if(!['deployed','packing','placing'].includes(tower.state))continue;const distance=Math.hypot(tower.x-me.x,tower.z-me.z);if(distance<best){nearestTower=tower;best=distance;}}}
    const placement=!!context.selectedTower;
    visible('context-card',!!nearestTower&&!placement&&!inventoryOpen&&!state.paused&&me?.hp>0);
    if(nearestTower){const tower=nearestTower;write('context-title',`${TOWERS[tower.type]?.name||'타워'} · ${tower.team+1}모둠`);write('context-detail',`체력 ${Math.ceil(tower.hp)} / ${tower.maxHp}${tower.state==='packing'?` · 포장 ${Math.min(3,tower.progress||0).toFixed(1)} / 3초`:tower.state==='placing'?` · 설치 ${Math.min(2,tower.progress||0).toFixed(1)} / 2초`:''}`);const cancellable=tower.carrier===context.localId&&['packing','placing'].includes(tower.state);write('pack-button',cancellable?'작업 취소':'포장 T');disabled('pack-button',(!cancellable&&tower.state!=='deployed')||(!isHost&&tower.team!==me?.team));disabled('repair-button',tower.hp>=tower.maxHp||tower.state!=='deployed');}
    visible('placement-note',placement&&!inventoryOpen&&inCombat);write('placement-label',context.placementHint||'청색 설치 지대에서 타워 위치를 골라 주세요.');
    const boss=state.boss;visible('boss-panel',phase==='boss'&&!!boss);
    if(boss&&phase==='boss'){write('boss-hp',`${Math.max(0,Math.ceil(boss.hp))} / ${boss.maxHp}`);fill('boss-fill',boss.hp/boss.maxHp);el('boss-panel').classList.toggle('warning',['warn','charge'].includes(boss.phase));el('boss-panel').classList.toggle('opening',boss.phase==='recover');write('boss-phase',boss.phase==='warn'?'돌진 예고! 붉은 길의 옆으로 피해요.':boss.phase==='charge'?'돌진 중 · 옆으로 이동하세요!':boss.phase==='recover'?'지금이에요! 멈춘 동안 집중 공격하세요.':'거리를 두고 다음 움직임을 살펴요.');}
    visible('pause-screen',!!state.paused&&!isEnd);visible('resume-button',isHost);write('pause-text',isHost?'준비가 되면 원정을 이어가세요.':'선생님이 원정을 잠시 멈췄어요.');
    visible('endgame-screen',isEnd);visible('retry-game',phase==='defeat');visible('endgame-actions',isHost);visible('endgame-wait',!isHost);visible('victory-stats',phase==='victory');
    if(isEnd){const won=phase==='victory';write('endgame-title',won?'첫 번째 새벽을 열었어요!':'잠시 물러나, 다시 함께.');write('endgame-eyebrow',won?'OUR FIRST DAWN':'ONE MORE ADVENTURE');write('endgame-seal',won?'✦':'↻');write('endgame-description',won?'숲길 파수꾼을 물리쳤어요. 친구들과 타워를 옮기며 함께 만든 승리예요.':'원정대가 모두 쓰러졌어요. 타워의 위치와 조합을 바꿔 다시 도전해 보세요.');write('victory-players',online.length);write('victory-towers',towers.filter(t=>t.hp>0).length);write('victory-supplies',Math.floor(state.supplies||0));}
    const notice=context.notice||'';visible('notice',!!notice&&!isEnd&&!activePanel);write('notice',notice);
    if(context.volumes){for(const kind of ['bgm','sfx']){const volume=Math.max(0,Math.min(100,Math.round(context.volumes[kind]??50)));if(document.activeElement!==el(`${kind}-volume`))el(`${kind}-volume`).value=String(volume);write(`${kind}-output`,volume);}}
    if(activePanel==='performance'){write('perf-fps',Number.isFinite(context.fps)?`${Math.round(context.fps)} FPS`:'—');write('perf-players',`${online.length}명`);write('perf-actors',`${towers.filter(t=>t.state==='deployed').length} / ${(state.enemies||[]).filter(e=>e.hp>0).length}`);write('perf-calls',Math.round(context.stats?.calls||0));write('perf-triangles',Math.round(context.stats?.triangles||0).toLocaleString('ko-KR'));}
  }
  function toast(message){if(!message)return;write('toast',message);visible('toast',true);clearTimeout(toastTimer);toastTimer=setTimeout(()=>visible('toast',false),4000);}
  function showEntry(error){visible('entry',true);visible('game-hud',false);if(error){write('entry-error',error);visible('entry-error',true);}setBusy(false);}
  function hideEntry(){visible('entry',false);visible('game-hud',true);visible('entry-error',false);el('teacher-password').value='';document.getElementById('game')?.focus({preventScroll:true});}
  function setBusy(value){busy=!!value;disabled('enter-button',busy);write('enter-button',busy?'원정대 준비 중…':ROLES[entryMode]);el('entry-form').setAttribute('aria-busy',String(busy));}
  updateEntryMode();
  return {update,toast,showEntry,hideEntry,setBusy};
}
