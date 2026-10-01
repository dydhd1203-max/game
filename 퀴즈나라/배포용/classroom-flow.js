/* Shared classroom navigation. Storage and avatar rendering are injected by the game. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const modes = {
    sequence: {name:'순서풀이',icon:'🍯',text:'정해진 길을 따라 문제를 풀어요. 정답을 맞히면 사물이 열려 다음 길로 갈 수 있어요.',scene:'숲속 꿀통 길'},
    free: {name:'자유풀이',icon:'🧭',text:'맵을 자유롭게 탐험해요. NPC나 사물에 다가가 원하는 순서로 문제를 풀어요.',scene:'성 · 숲 · 사막 · 용암 탐험'},
    round: {name:'라운드전',icon:'🏆',text:'모두 같은 문제를 시간 안에 풀어요. 정답 공개 뒤 점수를 얻고 마지막에 순위를 확인해요.',scene:'우리 반 퀴즈 무대'},
    team: {name:'팀전',icon:'🚩',text:'각자 돌아다니며 문제를 풀고, 팀원들의 점수를 합쳐 경쟁해요. 팀 색으로 친구를 알아봐요.',scene:'우리 팀 탐험'},
    coop: {name:'협동전',icon:'🌟',text:'각자 푼 정답을 합쳐요. 제한 시간 안에 반 전체 목표에 도달하면 함께 성공해요.',scene:'우리 반 공동 도전'}
  };
  const count = s => (s.questions || []).length;
  const correctCount = p => Object.values(p && p.completed || {}).filter(Boolean).length;
  const totalCorrect = s => Object.values(s.players || {}).reduce((n,p)=>n+correctCount(p),0);
  const label = s => modes[s.mode]?.name || '퀴즈';
  const phaseLabel = s => ({lobby:'입장 대기',playing:'진행 중',reveal:'정답 공개',ended:'종료'})[s.status] || '준비';
  const clean = controller => () => controller?.destroy?.();
  function mountTeacherChooser(container, opts) {
    let selected = 'sequence', stopped = false;
    const sets = Object.entries(opts.bank || {}).filter(([,s]) => !(s.qs || []).length || !(s.qs || []).every(q=>!q.type && /^[OX]$/i.test(String(q.a || '').trim())));
    function paint() {
      const m = modes[selected];
      container.innerHTML = `<section class="class-picker">
        <header class="class-flow-heading"><div><span class="class-step">1 게임 방식 → 2 문제 작성 → 3 수업 설정</span><h2>어떤 방식으로 퀴즈를 낼까요?</h2><p>같은 문제 묶음을 여러 게임 방식으로 사용할 수 있어요.</p></div></header>
        <div class="class-picker-grid ${opts.showBank===false?'class-picker-new':''}"><nav class="class-mode-list" aria-label="퀴즈 방식">${Object.entries(modes).map(([key,v])=>`<button class="class-mode ${key===selected?'selected':''}" data-class-mode="${key}" aria-pressed="${key===selected}"><span>${v.icon}</span><b>${v.name}</b></button>`).join('')}</nav>
        <section class="class-mode-preview"><div class="class-map-preview ${selected}"><span>${m.icon}</span><b>${m.scene}</b><i>문제 · 탐험 · 우리 반</i></div><h3>${m.name}</h3><p>${m.text}</p><p class="class-note">각 학생이 따로 풀어요. 사물 문제는 틀려도 다시 도전할 수 있어요.</p><button class="btn g big" data-class-new>이 방식으로 새 퀴즈 만들기</button></section>
        ${opts.showBank===false?'':`<section class="class-bank-list"><h3>저장한 문제로 만들기</h3><p class="hint">묶음을 고르면 작성 창에서 내용을 확인·수정할 수 있어요.</p>${sets.map(([id,s])=>`<button class="class-set-button" data-class-set="${esc(id)}"><b>${esc(s.title || '이름 없는 퀴즈')}</b><span>${(s.qs || []).length}문제 · ${modes[s.mode]?.name || '문제 묶음'}</span></button>`).join('') || '<div class="class-empty">새 퀴즈를 만들어 문제를 직접 입력해 주세요.</div>'}</section>`}</div>
      </section>`;
      container.querySelectorAll('[data-class-mode]').forEach(b=>b.onclick=()=>{selected=b.dataset.classMode;paint();});
      container.querySelector('[data-class-new]').onclick=()=>!stopped&&opts.onChoose(selected);
      container.querySelectorAll('[data-class-set]').forEach(b=>b.onclick=()=>!stopped&&opts.onChoose(selected,b.dataset.classSet));
    }
    paint(); return {destroy(){stopped=true;}};
  }
  function sessionCards(sessions, onOpen, user, teacher) {
    return Object.entries(sessions || {}).filter(([,s])=>window.QPClassroom.validSession(s)).sort((a,b)=>(b[1].createdAt || b[1].made || 0)-(a[1].createdAt || a[1].made || 0)).map(([id,s])=>{
      const p=user&&s.players?.[user.id || user.k];
      const progress=p?`${correctCount(p)} / ${count(s)} 완료`:s.delivery==='solo'?'내 속도로 풀기':phaseLabel(s);
      return `<button class="class-session-card" data-session="${esc(id)}"><span class="class-session-icon">${modes[s.mode]?.icon || '📚'}</span><div><b>${esc(s.title)}</b><small>${label(s)} · ${s.delivery==='solo'?'나중에 혼자 풀기':'실시간 수업'}</small></div><span>${teacher?phaseLabel(s):progress}</span></button>`;
    }).join('');
  }
  function mountTeacherHub(container, opts) {
    let stopped=false, showEnded=false, sessions={};
    container.innerHTML='<section class="class-hub"><h2>수업 관리</h2><p>불러오는 중…</p></section>';
    const ref=opts.store.ref('quiz/classrooms');
    function paint() {
      if(stopped)return;
      const active=Object.fromEntries(Object.entries(sessions).filter(([,s])=>window.QPClassroom.validSession(s)&&s.status!=='ended'));
      const ended=Object.fromEntries(Object.entries(sessions).filter(([,s])=>window.QPClassroom.validSession(s)&&s.status==='ended'));
      container.innerHTML=`<section class="class-hub"><div class="class-flow-heading"><div><h2>수업 관리</h2><p>내 퀴즈에서 연 수업과 혼자 풀기의 진행·배포 현황을 확인하세요.</p></div><button class="btn g" data-new>내 퀴즈 열기</button></div><div class="class-session-list">${sessionCards(active,opts.onOpen,null,true)||'<div class="class-empty">열린 수업이 없어요. 내 퀴즈에서 수업을 열어 주세요.</div>'}</div><button class="btn sm gray" data-ended-toggle aria-expanded="${showEnded}">종료한 수업 ${Object.keys(ended).length}개 ${showEnded?'접기':'보기'}</button>${showEnded?`<div class="class-session-list" data-ended-list>${sessionCards(ended,opts.onOpen,null,true)||'<p class="class-empty">종료한 수업이 없어요.</p>'}</div>`:''}</section>`;
      container.querySelector('[data-new]').onclick=opts.onNew;
      container.querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>opts.onOpen(b.dataset.session));
      container.querySelector('[data-ended-toggle]').onclick=()=>{showEnded=!showEnded;paint();};
    }
    const cb=ref.on('value',snap=>{sessions=snap.val()||{};paint();},error=>{if(!stopped)container.textContent='수업 목록을 불러오지 못했어요: '+error.message;});
    return {destroy(){stopped=true;ref.off('value',cb);}};
  }
  function link(id) {
    const url=new URL(location.href);
    url.searchParams.delete('role'); url.searchParams.delete('user'); url.searchParams.delete('scene');
    url.searchParams.set('classroom',id);
    return url.href;
  }
  async function copyLink(id, toast) {
    const address=link(id);
    try { await navigator.clipboard.writeText(address); toast?.('학생 접속 주소를 복사했어요.'); }
    catch { window.prompt('학생에게 공유할 주소를 복사해 주세요.',address); }
  }
  function mountHost(container, opts) {
    let current=null, dashboard=null, stopped=false, busy=false;
    const portraits=new Map();
    const renderAvatar=opts.renderAvatar?(player,height)=>{const key=(player.id||player.name)+'|'+height+'|'+JSON.stringify(player.av||{});if(!portraits.has(key))portraits.set(key,opts.renderAvatar(player,height));return portraits.get(key);}:undefined;
    container.innerHTML='<div class="class-empty">수업을 불러오는 중…</div>';
    const act=async action=>{
      if(busy || stopped)return;busy=true;
      try {
        if(action==='back'){opts.onBack();return;}
        const fn=window.QPClassroom[action];
      if(typeof fn==='function'){
        const result=await fn(opts.store,opts.id);
        if(result?.accepted===false)throw new Error(result.message || result.reason);
        return result;
      }
      } catch(e){opts.toast?.('진행하지 못했어요: '+e.message,3000);}finally{busy=false;}
    };
    const stop=window.QPClassroom.watch(opts.store,opts.id,s=>{
      if(stopped)return;current=s;
      if(!s){container.innerHTML='<div class="class-empty">이 수업을 찾을 수 없어요.</div>';return;}
      if(!dashboard) dashboard=window.QPTeacherClassroom.mountDashboard(container,{session:s,onAction:act,onCopyLink:()=>copyLink(opts.id,opts.toast),onBack:opts.onBack,renderAvatar});
      else dashboard.update(s);
    });
    const clock=setInterval(()=>{
      if(!current || current.delivery==='solo' || stopped || busy)return;
      const expired=current.status==='playing' && current.deadline && Date.now()>=current.deadline;
      const reached=current.mode==='coop' && current.status==='playing' && totalCorrect(current)>=Number(current.settings.coopGoal);
      if(expired || reached)act(current.mode==='round'?'reveal':'end');
    },250);
    return {destroy(){stopped=true;stop();clearInterval(clock);dashboard?.destroy();}};
  }
  function mountStudentHub(container, opts) {
    let stopped=false;
    const ref=opts.store.ref('quiz/classrooms');
    const cb=ref.on('value',snap=>{
      if(stopped)return;
      const all=snap.val() || {}, live={}, solo={};
      Object.entries(all).forEach(([id,s])=>{if(!window.QPClassroom.validSession(s)||s.status==='ended')return;if(s.delivery==='solo')solo[id]=s;else live[id]=s;});
      container.innerHTML=`<section class="class-hub"><h2>오늘은 어떤 퀴즈를 풀까요?</h2><h3>실시간 수업</h3><div class="class-session-list">${sessionCards(live,opts.onOpen,opts.user,false)||'<p class="class-empty">선생님이 수업을 열면 여기에 표시돼요.</p>'}</div><h3>나중에 혼자 풀기</h3><div class="class-session-list">${sessionCards(solo,opts.onOpen,opts.user,false)||'<p class="class-empty">선생님이 준비한 혼자 풀기 퀴즈가 아직 없어요.</p>'}</div></section>`;
      container.querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>opts.onOpen(b.dataset.session));
    },e=>{if(!stopped)container.textContent='목록을 불러오지 못했어요: '+e.message;});
    return {destroy(){stopped=true;ref.off('value',cb);}};
  }
  function solution(q) {
    if(q.type==='match')return (q.pairs || []).map(p=>p.left+' → '+p.right).join(' / ');
    if(q.type==='order')return (q.items || []).join(' → ');
    return String(q.a || '').split('/')[0];
  }
  function mountStudent(container, opts) {
    const uid=opts.user.k || opts.user.id;
    let stopped=false, joined=false, session=null, map=null, roundScene=null, answerUI=null, stopWatch=null, phaseKey='', submitting=false, modalUI=null, modalTimer=null, sweepBusy=false;
    const avatars=new Map();
    const avatar=person=>{const key=(person.id||person.k||person.name)+'|'+JSON.stringify(person.av || {});if(!avatars.has(key))avatars.set(key,opts.avatar(person.av));return avatars.get(key);};
    container.innerHTML='<div class="class-empty">퀴즈에 들어가는 중…</div>';
    const mine=()=>session?.players?.[uid] || {};
    const myIndices=()=>Object.keys(mine().completed || {}).filter(k=>mine().completed[k]).map(Number);
    function clearScene(keepRound) {map?.destroy();map=null;if(!keepRound){roundScene?.destroy();roundScene=null;}answerUI?.destroy();answerUI=null;}
    function errorMessage(e){opts.toast?.('저장하지 못했어요. 다시 시도해 주세요: '+e.message,3000);}
    function forgetBrokenLink() {
      const url=new URL(location.href);
      if(url.searchParams.get('classroom')===opts.id){url.searchParams.delete('classroom');history.replaceState(history.state,'',url.href);}
    }
    function unavailable(message, missing) {
      if(stopped)return;
      if(missing){joined=false;forgetBrokenLink();}
      session=null;opts.onSession?.(null);clearScene();modalUI?.destroy();opts.closeModal?.();
      container.innerHTML=`<div class="class-empty" role="alert">${esc(message)}<button class="btn" data-exit>퀴즈 목록</button></div>`;
      container.querySelector('[data-exit]').onclick=()=>{forgetBrokenLink();opts.onExit();};
    }
    function interact(index) {
      if(stopped || submitting || session?.status!=='playing' || myIndices().includes(index))return;
      modalUI?.destroy();clearTimeout(modalTimer);
      const q=session.questions[index];
      opts.modal(`문제 ${index+1}`,`<div class="class-question-modal"><h2 class="class-question-text">${esc(q.q)}</h2><div id="classAnswerWidget"></div><p class="class-answer-message" id="classAnswerMessage" role="status"></p><button class="btn sm gray" id="classQuestionClose">맵으로 돌아가기</button></div>`,()=>{
        const box=document.getElementById('classAnswerWidget');
        document.getElementById('classQuestionClose').onclick=()=>{modalUI?.destroy();modalUI=null;opts.closeModal();};
        modalUI=window.QPQuizQuestions.mountAnswer(box,q,{onSubmit:async answer=>{
          if(submitting || stopped)return;submitting=true;
          box.querySelectorAll('button,input').forEach(e=>e.disabled=true);
          try {
            const result=await window.QPClassroom.submit(opts.store,opts.id,uid,index,answer);
            if(stopped)return;
            const message=document.getElementById('classAnswerMessage');
            if(result.accepted && result.correct){
              if(message){message.className='class-answer-message correct';message.textContent='정답! 이 사물을 완료했어요.';}
              modalTimer=setTimeout(()=>{if(document.getElementById('classAnswerWidget')===box){modalUI?.destroy();modalUI=null;opts.closeModal();}},650);
            } else {
              if(message){message.className='class-answer-message wrong';message.textContent=result.accepted?'아직 정답이 아니에요. 사물이 그대로 있으니 다시 도전해 봐요.':result.message || '지금은 답을 제출할 수 없어요.';}
              box.querySelectorAll('button,input').forEach(e=>e.disabled=false);
            }
          } catch(e){errorMessage(e);box.querySelectorAll('button,input').forEach(e=>e.disabled=false);}
          finally{submitting=false;}
        }});
        box.querySelector('input,button')?.focus({preventScroll:true});
      });
    }
    function ranking() {
      const rows=Object.entries(session.players || {}).sort((a,b)=>(b[1].score || 0)-(a[1].score || 0));
      const teams=session.mode==='team'?Array.from({length:session.settings.teamCount},(_,team)=>({team,score:rows.filter(([,p])=>Number(p.team)===team).reduce((n,[,p])=>n+(p.score || 0),0)})).sort((a,b)=>b.score-a.score):[];
      return `${teams.length?`<h3>팀 순위</h3>${teams.map(t=>`<div class="class-result-row" style="--team-color:${window.QPClassroom.teamColor(t.team)}"><b>${esc(window.QPClassroom.teamLabel(t.team))}</b><span>${t.score}점</span></div>`).join('')}`:''}<h3>${session.delivery==='solo'?'내 기록':'개인 순위'}</h3>${rows.filter(([id])=>session.delivery!=='solo'||id===uid).map(([id,p],i)=>`<div class="class-result-row ${id===uid?'mine':''}"><b>${session.delivery==='solo'?'완료':rows.findIndex(([,r])=>(r.score||0)===(p.score||0))+1+'위'} · ${esc(p.name)}</b><span>${p.score || 0}점 · ${correctCount(p)}/${count(session)} 완료</span></div>`).join('')}`;
    }
    function paint() {
      if(stopped || !session)return;
      opts.onSession?.(session);
      const p=mine(), solo=session.delivery==='solo';
      const personalEnded=solo&&(p.status==='ended'||p.finishedAt||(session.mode!=='round'&&correctCount(p)>=count(session)));
      const status=personalEnded?'ended':session.status;
      const needsTeam=session.mode==='team'&&!personalEnded&&session.status==='playing'&&p.team==null&&session.settings.teamAssign==='choose';
      const qi=solo?Number(p.roundIndex ?? p.currentIndex ?? 0):Number(session.roundIndex || 0);
      const roundPhase=solo?(p.status==='reveal'?'reveal':status):status;
      const key=needsTeam?'teamchoose':status==='lobby'?'lobby':status==='ended'?'ended':session.mode==='round'?`round:${qi}:${roundPhase}`:'map';
      if(key!==phaseKey) {
        const keepRound=key.startsWith('round:')&&phaseKey.startsWith('round:')&&roundScene;
        const roundHost=keepRound?container.querySelector('[data-round-scene]'):null;
        phaseKey=key;clearScene(keepRound);
        container.innerHTML=`<section class="class-student"><header class="class-student-hud"><div><b>${esc(session.title)}</b><small>${label(session)} · ${solo?'혼자 풀기':'실시간 수업'}</small></div><span class="class-player-progress" data-my-progress></span><span data-my-score></span><strong data-class-clock></strong></header><div class="class-student-content" data-content></div><footer class="class-student-footer"><div class="class-team-scores" data-team-scores></div><span data-class-goal></span><span>내 정답은 내 진행에만 반영돼요.</span></footer></section>`;
        const body=container.querySelector('[data-content]');
        if(status==='lobby'||needsTeam) {
          body.innerHTML=`<div class="class-lobby"><h2>${needsTeam?'함께할 팀을 골라 주세요':'친구들이 모이고 있어요'}</h2><p>${needsTeam?'팀을 고르면 맵에서 퀴즈를 풀 수 있어요.':'선생님이 시작하면 퀴즈가 열려요.'}</p><div data-team-picker></div><div class="class-lobby-players" data-lobby-players></div></div>`;
        } else if(status==='ended') {
          if(document.getElementById('classAnswerWidget')){modalUI?.destroy();modalUI=null;opts.closeModal();}
          const won=session.mode==='coop'&&totalCorrect(session)>=Number(session.settings.coopGoal);
          body.innerHTML=`<div class="class-results"><h2>${session.mode==='coop'?(won?'우리 반 함께 성공!':'다음에 다시 도전해요'):'퀴즈 결과'}</h2><div data-rank>${ranking()}</div><button class="btn g big" data-exit>퀴즈 목록으로</button></div>`;
          body.querySelector('[data-exit]').onclick=opts.onExit;
        } else if(session.mode==='round') {
          const q=session.questions[qi];
          body.innerHTML=`<section class="class-round"><div class="class-round-no">${qi+1} / ${count(session)} 문제</div><div class="class-round-layout"><div data-round-scene></div><div><div class="class-round-question" data-round-answer></div><p class="class-answer-message" data-round-feedback role="status"></p></div></div></section>`;
          if(roundHost)body.querySelector('[data-round-scene]').replaceWith(roundHost);
          else roundScene=window.QPRoundScene.mount(body.querySelector('[data-round-scene]'),{players:[],ownId:uid,started:true,status:roundPhase,roundIndex:qi});
          const box=body.querySelector('[data-round-answer]');
          if(roundPhase==='reveal') {
            box.innerHTML=`<h2>${esc(q?.q || '')}</h2><p class="class-revealed-answer">정답: ${esc(solution(q || {}))}</p><p>${p.answers?.[qi]?.correct?'정답이에요!':'이번 문제는 아쉬워요. 다음 문제에 도전해요.'}</p>${solo?'<button class="btn g" data-solo-next>다음 문제</button>':'<p class="hint">선생님이 다음 문제를 내면 함께 시작해요.</p>'}`;
            const next=box.querySelector('[data-solo-next]');if(next)next.onclick=()=>window.QPClassroom.advanceSolo(opts.store,opts.id,uid).catch(errorMessage);
          } else if(q) {
            box.innerHTML=`<h2 class="class-question-text">${esc(q.q)}</h2><div data-answer-widget></div>`;
            answerUI=window.QPQuizQuestions.mountAnswer(box.querySelector('[data-answer-widget]'),q,{onSubmit:async answer=>{
              if(submitting)return;submitting=true;
              try {
                const result=await window.QPClassroom.submit(opts.store,opts.id,uid,qi,answer);
                if(stopped)return;
                const message=container.querySelector('[data-round-feedback]');
                if(message&&!solo)message.textContent=result.accepted?'답을 제출했어요. 정답 공개를 기다려요.':result.message || '지금은 답을 제출할 수 없어요.';
                if(solo&&result.accepted)opts.toast?.(result.correct?'정답! 정답을 확인한 뒤 다음 문제로 가요.':'이번 문제는 아쉬워요. 정답을 확인해 봐요.');
                if(result.accepted)box.querySelectorAll('button,input').forEach(e=>e.disabled=true);
              }catch(e){errorMessage(e);}finally{submitting=false;}
            }});
          }
        } else {
          map=window.QPQuizMap.mount(body,{mode:session.mode,questions:session.questions,playerId:uid,position:p.position,name:opts.user.name,teamColor:session.mode==='team'?window.QPClassroom.teamColor(p.team):'',avatarHTML:avatar(opts.user),completed:myIndices(),onInteract:interact,
            onPosition:position=>{if(!stopped && session?.status==='playing')opts.store.ref(`quiz/classrooms/${opts.id}/players/${uid}/position`).set(position).catch(()=>{});}});
          body.querySelector('.qp-map-viewport')?.focus({preventScroll:true});
        }
      }
      const setText=(selector,text)=>{const e=container.querySelector(selector);if(e)e.textContent=text;};
      setText('[data-my-progress]',`${correctCount(p)} / ${count(session)} 완료`);
      const progress=container.querySelector('[data-my-progress]');if(progress)progress.style.setProperty('--class-progress',Math.min(100,correctCount(p)/Math.max(1,count(session))*100)+'%');
      setText('[data-my-score]',`${p.score || 0}점`);
      setText('[data-class-goal]',session.mode==='coop'?`우리 반 ${totalCorrect(session)} / ${session.settings.coopGoal} 정답`:session.mode==='team'?`${p.team==null?'팀 선택 중':window.QPClassroom.teamLabel(p.team)} · 내 점수가 팀에 더해져요`:'틀린 사물 문제는 다시 풀 수 있어요.');
      const teamScores=container.querySelector('[data-team-scores]');if(teamScores)teamScores.innerHTML=session.mode==='team'?(session.metrics?.teams || []).map(t=>`<span style="--team-color:${t.color}"><b>${esc(t.name)}</b> ${t.score}점</span>`).join(''):'';
      if(status==='lobby'||needsTeam) {
        const picker=container.querySelector('[data-team-picker]');
        if(session.mode==='team' && session.settings.teamAssign==='choose') {
          picker.innerHTML=`<p>원하는 팀을 골라 주세요.</p><div class="class-team-buttons">${Array.from({length:session.settings.teamCount},(_,i)=>`<button class="btn ${p.team!=null&&Number(p.team)===i?'selected':''}" data-team="${i}" style="--team-color:${window.QPClassroom.teamColor(i)}" aria-pressed="${p.team!=null&&Number(p.team)===i}">${esc(window.QPClassroom.teamLabel(i))}</button>`).join('')}</div>`;
          picker.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>window.QPClassroom.selectTeam(opts.store,opts.id,uid,Number(b.dataset.team)).then(result=>{if(!result.accepted)opts.toast?.(result.message);}).catch(errorMessage));
        } else if(picker)picker.textContent=session.mode==='team'?'선생님이 인원을 맞춰 팀을 배정해요.':'';
        const players=container.querySelector('[data-lobby-players]');
        players.innerHTML=Object.entries(session.players || {}).map(([id,person])=>`<div style="--team-color:${session.mode==='team'?window.QPClassroom.teamColor(person.team):'#5cbaa0'}">${avatar(person)}<b>${esc(person.name)}</b>${session.mode==='team'?`<small>${person.team==null?'선택 중':window.QPClassroom.teamLabel(person.team)}</small>`:''}</div>`).join('');
      }
      if(session.mode==='round') {
        roundScene?.update({players:Object.entries(session.players || {}).map(([id,person])=>({id,name:person.name,avatarHTML:avatar(person),score:person.score||0,answered:!!person.answers?.[qi],correct:roundPhase==='reveal'?person.answers?.[qi]?.correct:undefined})),status:roundPhase,roundIndex:qi});
        if(roundPhase==='playing' && p.answers?.[qi])container.querySelectorAll('[data-round-answer] button,[data-round-answer] input').forEach(e=>e.disabled=true);
      }
      if(status==='ended'){const rank=container.querySelector('[data-rank]');if(rank)rank.innerHTML=ranking();}
      if(map) {
        map.setCompleted(myIndices());
        map.setTeam?.(session.mode==='team'?window.QPClassroom.teamColor(p.team):'',opts.user.name);
        map.setPeers(Object.entries(session.players || {}).filter(([id,person])=>id!==uid&&person.online!==false&&person.position).map(([id,person])=>({id,name:person.name,avatarHTML:avatar(person),...person.position,team:person.team,color:session.mode==='team'?window.QPClassroom.teamColor(person.team):''})));
      }
      paintClock();
    }
    function paintClock() {
      if(!session)return;
      const p=mine(), deadline=session.delivery==='solo'?(p.deadline || 0):(session.deadline || 0);
      const e=container.querySelector('[data-class-clock]');
      if(e)e.textContent=session.delivery==='solo'&&p.status==='reveal'?'정답 확인':deadline&&session.status==='playing'?Math.max(0,Math.ceil((deadline-Date.now())/1000))+'초':phaseLabel(session);
      const totalDeadline=session.settings?.duration&&p.startedAt?p.startedAt+session.settings.duration*1000:0;
      const expired=deadline&&Date.now()>=deadline&&p.status!=='reveal';
      if(session.delivery==='solo'&&session.status==='playing'&&(expired||totalDeadline&&Date.now()>=totalDeadline)&&!sweepBusy&&p.status!=='ended'){
        sweepBusy=true;window.QPClassroom.sweep(opts.store,opts.id,uid).catch(errorMessage).finally(()=>sweepBusy=false);
      }
    }
    window.QPClassroom.join(opts.store,opts.id,{id:uid,name:opts.user.name,av:opts.user.av}).then(result=>{
      if(stopped){if(result.accepted)window.QPClassroom.leave(opts.store,opts.id,uid).catch(()=>{});return;}
      if(!result.accepted&&result.reason!=='ended'){
        unavailable(result.reason==='missing'?'이 퀴즈는 더 이상 열려 있지 않아요. 목록에서 다른 퀴즈를 골라 주세요.':'퀴즈에 들어가지 못했어요: '+result.message,result.reason==='missing');
        return;
      }
      joined=Boolean(result.accepted);
      if(joined)opts.store.ref(`quiz/classrooms/${opts.id}/players/${uid}`).onDisconnect().update({online:false}).catch(()=>{});
      stopWatch=window.QPClassroom.watch(opts.store,opts.id,s=>{if(stopped)return;session=s;if(s)paint();else unavailable('이 퀴즈는 더 이상 열려 있지 않아요. 목록에서 다른 퀴즈를 골라 주세요.',true);},e=>unavailable('퀴즈를 불러오지 못했어요: '+e.message));
    }).catch(e=>unavailable('퀴즈에 들어가지 못했어요: '+e.message));
    const timer=setInterval(paintClock,250);
    return {getMap:()=>map,destroy(){stopped=true;stopWatch?.();clearInterval(timer);clearTimeout(modalTimer);modalUI?.destroy();clearScene();if(joined)window.QPClassroom.leave(opts.store,opts.id,uid).catch(()=>{});}};
  }
  window.QPClassroomFlow=Object.freeze({modes,mountTeacherChooser,mountTeacherHub,mountHost,mountStudentHub,mountStudent,link});
})();
