/* The studio reuses the real demo runtime and never writes production data.
   It is the review host of the reference body's garments (stage 3): per-slot
   selectors list the garment index's records, records registered in this
   session (QPFoundationStudio.registerGarment) and shop items without a
   record, each avatar shows what it wears with the fallback reason badge,
   and the choice is kept in the address (shareable). Hosted only: Chrome
   gives every file:// page an opaque origin, so this page cannot reach its
   runtime frame from disk (a Korean note says so). */
(async()=>{
  'use strict';
  const runtime=document.getElementById('runtime'),input=QPRunInput.create(),directionMap={left:'left',right:'right',up:'back',down:'front'},names={idle:'서기',walk:'걷기',run:'달리기','floor-sit':'아빠다리',sit:'책상 앉기',jump:'점프',wave:'인사',nod:'고개 인사',happy:'기뻐하기',climb:'사다리'},gestures=['wave','nod','happy'];
  const SLOTS=['top','bottom','shoes'],SLOT_KO={top:'상의',bottom:'하의',shoes:'신발'},REF_HAIR={m:'short:1',f:'bob:1'};
  // data-foundation-fallback reasons (avatar-foundation-garments.js).
  const REASON_KO={todo:'아직 옮기지 않음',class:'아직 그리지 않는 종류',outfit:'한벌옷 · 아직 옮기지 않음',error:'그림을 불러오지 못함',candidate:'후보 · 검수 화면에서만'};
  const STATUS_KO={approved:'승인',candidate:'후보',retired:'퇴역'};
  const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
  let api,w,avatars=[],registered=new Map(),state={action:'idle',direction:'front',phase:0},playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,last=0,time=0,badgeText={};
  // The selection: '' = the basic outfit (starter records), 'rec:<id>' a record,
  // 'item:<shape>' a shop item of that slot, 'outfit:<shape>' a one-piece (top only).
  const sel={top:params.get('top')||'',bottom:params.get('bottom')||'',shoes:params.get('shoes')||'',hair:{m:params.get('hm')||REF_HAIR.m,f:params.get('hf')||REF_HAIR.f},expression:params.get('ex')||'bright:0'};
  if(params.has('sk'))$('skin').value=String(Math.max(0,Math.min(4,Number(params.get('sk'))||0)));
  if(params.get('body')==='1')$('outfit').checked=false;
  if(params.get('only')==='garment')$('garment-only').checked=true;
  if(names[params.get('act')])state.action=params.get('act');
  if(['front','left','right','back'].includes(params.get('dir')))state.direction=params.get('dir');
  // From disk the runtime frame is an opaque origin: show the note, load nothing.
  if(location.protocol==='file:'){$('file-note').hidden=false;$('wearing').textContent='파일로 열린 화면 · 캐릭터를 불러오지 않았어요';$('status').textContent='미리보기 서버에서 열어 주세요';document.body.classList.add('file-opened');return;}
  runtime.src=runtime.dataset.src;

  const G=()=>w.QPFoundationGarments,catalog=()=>w.QPGame.getCatalog();
  const recordOf=(id,sex)=>G().get(id,sex)?.record||registered.get(id)?.record||w.QPFoundationGarmentRecords?.[id]||null;
  // A record's own shop name, or null when its catalogue entry sells another record's item (a test
  // copy registered for review: a hue-rotated alias, a renamed copy): such a record is named by its id.
  const ownName=(id,sex)=>{const c=recordOf(id,sex)?.catalog?.[sex];return c&&String(c.item||'').startsWith(id+':')?c.name||null:null;};
  const copiedFrom=id=>{for(const sex of ['m','f']){const c=recordOf(id,sex)?.catalog?.[sex];if(c&&!String(c.item||'').startsWith(id+':'))return String(c.item||'').split(':').slice(0,2).join(':');}return null;};
  // The avatar one sex wears for the current selection, and what could not be applied.
  function avFor(sex){
    const av={sex,foundationOutfit:$('outfit').checked?'basic':'body',sk:Number($('skin').value),hair:sel.hair[sex],expression:sel.expression},garments={},missing=[];
    for(const slot of SLOTS){const v=sel[slot];if(!v)continue;const [kind,...rest]=v.split(':'),value=rest.join(':');
      if(kind==='rec')garments[slot]=value;
      else if(kind==='item'||kind==='outfit'){const it=catalog().curatedItem(kind==='outfit'?'outfit':slot,value,sex);if(!it){missing.push(slot);continue;}
        if(kind==='outfit'){const parts=catalog().OUTFIT_PARTS?.[value]?.[sex]||{};Object.assign(av,parts,{outfit:it.shape+':'+it.ci});}else av[slot]=it.shape+':'+it.ci;}}
    if(Object.keys(garments).length)av.foundationGarments=garments;
    return{av,missing};
  }
  function refresh(){
    for(const svg of avatars)api.destroy(svg);avatars=[];badgeText={};
    for(const[sex,name]of[['m','male'],['f','female']])for(const[selector,size]of[['#'+name,280],['#'+name+'-small',120]]){const host=document.querySelector(selector);host.innerHTML=api.render(avFor(sex).av,size);avatars.push(host.firstElementChild);}
    $('studio').classList.toggle('garment-only',$('garment-only').checked);writeAddress();draw();
  }
  // What each large avatar wears (its data-foundation-garments/-fallback,
  // rewritten by the runtime when an atlas fails), as badges and the header.
  function badges(){
    const header=[];
    for(const[sex,name]of[['m','male'],['f','female']]){
      const svg=document.querySelector('#'+name+' svg');if(!svg)continue;const {missing}=avFor(sex),ids=String(svg.dataset.foundationGarments||'').split('|'),reasons=Object.fromEntries(String(svg.dataset.foundationFallback||'').split('|').filter(Boolean).map(p=>p.split(':')));
      const key=[svg.dataset.foundationOutfit,svg.dataset.foundationGarments,svg.dataset.foundationFallback,missing.join()].join('/');if(badgeText[sex]===key)continue;badgeText[sex]=key;
      const host=$(name+'-badges');host.replaceChildren();const worn=[];
      if(svg.dataset.foundationOutfit==='body'){const s=document.createElement('span');s.textContent='옷 없이 몸만';host.append(s);header.push((sex==='m'?'남':'여')+' 몸만');continue;}
      // '상의: 단정한 셔츠', or for a stand-in '상의: 기본 반팔로 대신 (아직
      // 옮기지 않음)'; the record id is in the title (critique 2026-10-12 #20).
      SLOTS.forEach((slot,i)=>{const id=ids[i]||'',record=recordOf(id,sex),reason=reasons[slot],miss=missing.includes(slot),name=ownName(id,sex)||id,s=document.createElement('span');
        const why=[reason&&(REASON_KO[reason]||reason),miss&&'이 성별 상품 아님'].filter(Boolean).join(', ');
        s.textContent=SLOT_KO[slot]+': '+(why?name+'(으)로 대신 ('+why+')':name)+(record?.status==='candidate'&&!why?' · 후보':'');s.title=id;
        s.dataset.slot=slot;s.dataset.garment=id;if(reason||miss){s.className='fallback';s.dataset.reason=reason||'missing';}else if(record?.status==='candidate')s.className='candidate';host.append(s);
        worn.push((record?.source==='registered'?'시험 기록 ':'')+name+(why?'(대신)':''));});
      header.push((sex==='m'?'남 ':'여 ')+worn.join(' · '));
    }
    if(header.length===2)$('wearing').textContent=header.join('  |  ');
  }
  function draw(){if(!api)return;const gesture=gestures.includes(state.action)?state.action:'',jump=state.action==='jump',p=state.phase,view={...state,action:gesture?'idle':state.action,time:time,showBones:$('bones').checked,gesture,gestureProgress:p,grounded:!jump||p<.08||p>.92,jumpCompression:jump?(p<.08?Math.sin(p/.08*Math.PI/2):p>.92?Math.sin((p-.92)/.08*Math.PI):0):0,vy:jump?(.5-p)*960:0,seatMode:state.action==='sit'?'desk':state.action==='floor-sit'?'floor':undefined};for(const svg of avatars){api.apply(svg,view);const mirror=svg.querySelector('[data-foundation-mirror]');if(jump){const lift=view.grounded?0:Math.max(0,Math.sin((p-.08)/.84*Math.PI))*3.6;mirror.setAttribute('transform',(state.direction==='left'?'translate(32 '+(-lift)+') scale(-1 1)':'translate(0 '+(-lift)+')'));}}for(const b of document.querySelectorAll('[data-action]'))b.setAttribute('aria-pressed',String(b.dataset.action===state.action));for(const b of document.querySelectorAll('[data-direction]'))b.setAttribute('aria-pressed',String(b.dataset.direction===state.direction));$('status').textContent=names[state.action]+(state.action==='run'?' · '+QPRunInput.runSpeed+'px/s':state.action==='walk'?' · '+QPRunInput.walkSpeed+'px/s':'');$('phase').value=String(p);$('pause').textContent=playing?'일시 정지':'재생';badges();}
  function action(value){input.reset();state.action=value;state.phase=0;writeAddress();draw();}
  // The address carries the choice (a link to this exact combination).
  function writeAddress(){
    const q=new URLSearchParams();for(const slot of SLOTS)if(sel[slot])q.set(slot,sel[slot]);if(sel.hair.m!==REF_HAIR.m)q.set('hm',sel.hair.m);if(sel.hair.f!==REF_HAIR.f)q.set('hf',sel.hair.f);if(sel.expression!=='bright:0')q.set('ex',sel.expression);
    if($('skin').value!=='0')q.set('sk',$('skin').value);if(!$('outfit').checked)q.set('body','1');if($('garment-only').checked)q.set('only','garment');if(state.action!=='idle')q.set('act',state.action);if(state.direction!=='front')q.set('dir',state.direction);
    const url=location.pathname+(q.toString()?'?'+q:'');$('share').href=url;try{history.replaceState(null,'',url);}catch{}
  }
  const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;o.title=label;return o;};
  const group=(label,options)=>{const g=document.createElement('optgroup');g.label=label;g.append(...options);return g;};
  // Records of a slot: the index's, then this session's registered ones.
  function recordList(slot){
    const index=w.QPFoundationGarmentIndex?.records||{},out=[];
    for(const [id,e] of Object.entries(index))if(e.slot===slot)out.push({id,slot,class:e.class,status:e.status,legacy:e.legacy,sexes:e.sexes,source:'index'});
    for(const [id,r] of registered)if(r.record.slot===slot)out.push({id,slot,class:r.record.class,status:r.record.status,legacy:Boolean(r.record.legacy),sexes:Object.keys(r.record.sexes||{}),source:'registered',states:r.states});
    return out;
  }
  function fillSelectors(){
    const runtimeClasses=w.QPFoundationGarmentIndex?.runtimeClasses||[];
    for(const slot of SLOTS){
      const select=$('slot-'+slot),records=recordList(slot),shapes=new Map();
      for(const sex of ['m','f'])for(const it of catalog().publicItems(slot,sex)){const s=shapes.get(it.shape)||{shape:it.shape,names:{}};s.names[sex]=it.name;shapes.set(it.shape,s);}
      const recLabel=r=>{const copy=copiedFrom(r.id),name=copy?copy+' 복사본':ownName(r.id,'m')||ownName(r.id,'f')||'';return (name||r.id)+' ('+(copy?'검수용':STATUS_KO[r.status]||r.status)+(r.legacy&&r.source==='index'?', 기본 옷 원본':'')+(runtimeClasses.length&&!runtimeClasses.includes(r.class)?', 아직 그리지 않는 종류':'')+(r.source==='registered'&&!copy?', 이번 검수에서 등록':'')+(r.sexes.length<2?', '+(r.sexes[0]==='m'?'남자만':'여자만'):'')+')'+(name?' · '+r.id:'');};
      const groups=[option('','기본 옷 (시작 상품)'),group('기준 옷 기록',records.map(r=>option('rec:'+r.id,recLabel(r)))),group('상점 상품',[...shapes.values()].map(s=>option('item:'+s.shape,(s.names.m===s.names.f||!s.names.f||!s.names.m?(s.names.m||s.names.f):s.names.m+' / '+s.names.f)+' ('+slot+':'+s.shape+')'+(s.names.m&&s.names.f?'':s.names.m?' · 남자만':' · 여자만'))))];
      if(slot==='top'){const outfits=new Map();for(const sex of ['m','f'])for(const it of catalog().publicItems('outfit',sex)){const o=outfits.get(it.shape)||{shape:it.shape,name:it.name};outfits.set(it.shape,o);}groups.push(group('한벌옷 (상점)',[...outfits.values()].map(o=>option('outfit:'+o.shape,o.name+' (outfit:'+o.shape+')'))));}
      select.replaceChildren(...groups);if(![...select.options].some(o=>o.value===sel[slot]))sel[slot]='';select.value=sel[slot];
    }
    for(const sex of ['m','f']){const select=$('hair-'+sex),items=catalog().publicItems('hair',sex),opts=[option(REF_HAIR[sex],(sex==='m'?'짧은 머리':'단발')+' (기준 · '+REF_HAIR[sex]+')')];for(const it of items){const v=it.shape+':'+it.ci;if(v!==REF_HAIR[sex])opts.push(option(v,it.name+' ('+v+')'));}select.replaceChildren(...opts);if(![...select.options].some(o=>o.value===sel.hair[sex]))select.append(option(sel.hair[sex],sel.hair[sex]));select.value=sel.hair[sex];}
    {const select=$('expression');let items=[];try{items=catalog().publicItems('expression','f');}catch{}const opts=[option('bright:0','밝은 표정 (기준)')];for(const it of items){const v=it.shape+':'+it.ci;if(v!=='bright:0')opts.push(option(v,it.name+' ('+v+')'));}select.replaceChildren(...opts);if(![...select.options].some(o=>o.value===sel.expression))select.append(option(sel.expression,sel.expression));select.value=sel.expression;}
  }
  // Test-only (the verifiers, the real-sheet dry run): a garment record (object
  // or JSON text) with its atlases {m,f} (data URLs, canvases or images) is
  // registered in this session's runtime only (QPFoundationGarments.register:
  // ?demo=1&session=foundation-studio). options: catalogue (its shop items
  // resolve to it), wear (select it at once). Returns {m,f} load states.
  async function registerGarment(recordJson,atlases,options={}){
    const record=typeof recordJson==='string'?JSON.parse(recordJson):recordJson;
    const states=await G().register(record,atlases||{},{catalogue:Boolean(options.catalogue)});
    registered.set(record.id,{record:JSON.parse(JSON.stringify(record)),states});fillSelectors();
    if(options.wear)setOutfit({[record.slot]:record.id});else refresh();
    return states;
  }
  // The listed garments: index and registered records with their load state per sex.
  function garments(){const st=G().status();return SLOTS.flatMap(recordList).map(r=>({...r,state:Object.fromEntries(['m','f'].map(sex=>[sex,st[r.id+'|'+sex]||'not loaded']))}));}
  // Select per slot: a record id ('top:tee'), 'item:<shape>', 'outfit:<shape>',
  // '' / null for the basic piece; also hair {m,f}, expression, sk, outfit (bool), garmentOnly.
  function setOutfit(next={}){
    for(const slot of SLOTS)if(slot in next){const v=next[slot];sel[slot]=!v?'':/^(rec|item|outfit):/.test(v)?v:'rec:'+v;}
    if(next.hair)Object.assign(sel.hair,next.hair);if(next.expression)sel.expression=next.expression;if('sk' in next)$('skin').value=String(next.sk);if('outfit' in next)$('outfit').checked=Boolean(next.outfit);if('garmentOnly' in next)$('garment-only').checked=Boolean(next.garmentOnly);
    fillSelectors();refresh();return wearing();
  }
  const wearing=()=>Object.fromEntries([['m','male'],['f','female']].map(([sex,name])=>{const svg=document.querySelector('#'+name+' svg');return[sex,{garments:svg?.dataset.foundationGarments||'',fallback:svg?.dataset.foundationFallback||'',outfit:svg?.dataset.foundationOutfit||'',static:svg?.dataset.foundationStatic||''}];}));
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{state.direction=b.dataset.direction;writeAddress();draw();});$('skin').onchange=refresh;$('outfit').onchange=refresh;$('garment-only').onchange=refresh;$('bones').onchange=draw;$('pause').onclick=()=>{playing=!playing;draw();};$('phase').oninput=e=>{playing=false;state.phase=Number(e.target.value);draw();};
  for(const slot of SLOTS)$('slot-'+slot).onchange=e=>{sel[slot]=e.target.value;refresh();};
  for(const sex of ['m','f'])$('hair-'+sex).onchange=e=>{sel.hair[sex]=e.target.value;refresh();};
  $('expression').onchange=e=>{sel.expression=e.target.value;refresh();};
  // The note has its own place: draw() rewrites the status every frame.
  let shareTimer=0;$('share').onclick=e=>{e.preventDefault();writeAddress();const note=$('share-note');Promise.resolve(navigator.clipboard?.writeText(location.href)).then(()=>{note.textContent='주소를 복사했어요';},()=>{note.textContent='복사하지 못했어요. 주소창의 주소를 쓰세요';});clearTimeout(shareTimer);shareTimer=setTimeout(()=>{note.textContent='';},2000);};
  // Keys only change the state; the picture follows on the next frame (the playing loop draws it), and taps are
  // timed when the key was pressed (e.timeStamp), not when the handler ran: on a slow renderer a draw took
  // 150-230 ms and pushed the second tap of a double tap past QPRunInput's 250 ms window (the run never started).
  let drawQueued=false;const soon=()=>{if(!api||playing||drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;draw();});};
  document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable)return;const d=QPRunInput.directions[e.code];if(d){e.preventDefault();input.down(e.code,e.timeStamp||performance.now(),e.repeat);state.direction=directionMap[d];state.action=input.isRunning()?'run':'walk';playing=true;}else if(!e.repeat&&['KeyC','Space','KeyH'].includes(e.code)){e.preventDefault();action(e.code==='KeyC'?(state.action==='floor-sit'?'idle':'floor-sit'):e.code==='Space'?'jump':'wave');playing=true;}soon();});
  document.addEventListener('keyup',e=>{input.up(e.code,e.timeStamp||performance.now());if(QPRunInput.directions[e.code]){const held=Object.keys(directionMap).find(d=>input.has(d));state.action=held?(input.isRunning()?'run':'walk'):'idle';if(held)state.direction=directionMap[held];soon();}});
  const stop=()=>{input.reset();if(['walk','run'].includes(state.action))state.action='idle';last=0;if(api)draw();};addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);
  const frame=now=>{const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(playing&&!document.hidden){time+=dt;state.phase=(state.phase+dt/(state.action==='run'?QPRunInput.runCycleMs/1000:state.action==='walk'?QPRunInput.walkCycleMs/1000:1.5))%1;draw();}else badges();requestAnimationFrame(frame);};
  try{await new Promise((resolve,reject)=>{const start=performance.now(),timer=setInterval(()=>{try{const x=runtime.contentWindow;if(x?.QPFoundationSkin?.atlas.ready&&x?.QPFoundationOutfit?.atlas.ready&&x?.QPFoundationGarmentIndex&&x?.QPAvatar?.atlas.ready&&x.QPClothes?.atlas.ready&&x.QPShoes?.atlas.ready&&x.QPAvatarDirection?.atlas.ready&&x.QPAvatarDirection.atlas.backReady){clearInterval(timer);x.QPGame.go('login');w=x;resolve();}else if(performance.now()-start>60000){clearInterval(timer);reject(new Error('캐릭터 원화를 불러오지 못했어요. 새로고침해 주세요.'));}}catch(e){clearInterval(timer);reject(e);}},80);});
    // The runtime's own api plus the studio's garment calls (frozen copy).
    api=Object.freeze({...w.QPAvatarFoundation,registerGarment,garments,setOutfit});
    fillSelectors();refresh();
    window.QPFoundationStudio={api,runtime:w,getState:()=>({...state}),setState:next=>{state={...state,...next};playing=false;draw();},avatars:()=>avatars,registerGarment,garments,setOutfit,wearing,selection:()=>JSON.parse(JSON.stringify({...sel,sk:Number($('skin').value),outfit:$('outfit').checked,garmentOnly:$('garment-only').checked})),refresh};
    requestAnimationFrame(frame);}catch(e){const error=$('error');error.hidden=false;error.textContent=e.message;}
})();
