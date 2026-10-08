/* QUIZQUIZ: QPlay-style lobby, waiting room and stage quiz in the forest palette.
   The room creator's browser runs the clock, grading and phases; anyone can make a
   room. Data lives under <base>/qq: list (room cards), rooms/<id>, chat, online.
   Everything the page needs from index.html comes through ctx. */
(function () {
  'use strict';
  const MAX = 30, BEAT = 5000, STALE = 16000, LIST_STALE = 90000, ONLINE_TTL = 45000;
  const INTRO_MS = 2600, REVEAL_MS = 4200, END_MS = 9000;
  const MODES = { stage: { name: '무대 QUIZ', short: '무대' }, ox: { name: '서바이벌 OX', short: 'OX' } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
  const pad3 = n => String(n).padStart(3, '0');

  /* Hand-drawn props, flat colours and thick outlines. */
  const ART = {
    clock: '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#4a2c10" stroke-width="3" stroke-linejoin="round"><path d="M9 20a11 11 0 0 1 17-12z" fill="#e0553c"/><path d="M55 20a11 11 0 0 0-17-12z" fill="#e0553c"/><path d="M17 56l5-8M47 56l-5-8" fill="none" stroke-linecap="round"/><circle cx="32" cy="35" r="20" fill="#fff6dc"/><path d="M32 35V22M32 35l9 5" fill="none" stroke-linecap="round"/></g><circle cx="32" cy="35" r="2.6" fill="#4a2c10"/><path d="M19 26a16 16 0 0 1 8-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    o: '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="40" fill="none" stroke="#0b4740" stroke-width="30"/><circle cx="60" cy="60" r="40" fill="none" stroke="#2fb8a8" stroke-width="20"/><path d="M33 44a34 34 0 0 1 22-17" stroke="#c9fff6" stroke-width="7" fill="none" stroke-linecap="round"/></svg>',
    x: '<svg viewBox="0 0 120 120" aria-hidden="true"><g stroke-linecap="round"><path d="M28 28l64 64M92 28L28 92" stroke="#6b1d12" stroke-width="32"/><path d="M28 28l64 64M92 28L28 92" stroke="#e8584a" stroke-width="20"/></g><path d="M31 34l14 14" stroke="#ffd2c8" stroke-width="6" stroke-linecap="round"/></svg>',
    leaf: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17C3 8 9 3 17 3c0 8-5 14-14 14z" fill="#7cc23e" stroke="#2f5e22" stroke-width="1.6"/><path d="M4 16L14 6" stroke="#2f5e22" stroke-width="1.2"/></svg>'
  };

  function ambient(count) {
    let html = '<div class="qq-ambient" aria-hidden="true"><i class="qq-ray r1"></i><i class="qq-ray r2"></i><i class="qq-ray r3"></i>';
    for (let i = 0; i < count; i++) {
      const x = (i * 37 + 11) % 100, y = (i * 53 + 23) % 70 + 10, d = (i * 0.83) % 7;
      html += `<b class="qq-fly" style="left:${x}%;top:${y}%;animation-delay:-${d.toFixed(2)}s,-${(d * 1.7).toFixed(2)}s"></b>`;
    }
    for (let i = 0; i < 4; i++) html += `<span class="qq-fall" style="left:${12 + i * 23}%;animation-delay:-${i * 3.1}s">${ART.leaf}</span>`;
    return html + '</div>';
  }

  /* Four choices for any question: its own wrong answers, else other answers in the set. */
  function stageChoices(question, all, seed) {
    const answer = String(question.a).split('/')[0].trim();
    let options = Array.isArray(question.c) ? question.c.map(c => String(c).trim()).filter(Boolean) : [];
    if (options.length < 3) {
      const others = all.map(q => String(q.a).split('/')[0].trim()).filter(a => a && a !== answer && !options.includes(a));
      options = options.concat(others).filter((v, i, list) => list.indexOf(v) === i);
    }
    const choices = [answer].concat(options.filter(o => o !== answer).slice(0, 3));
    let s = (seed >>> 0) || 7;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = choices.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [choices[i], choices[j]] = [choices[j], choices[i]]; }
    return { choices, correct: choices.indexOf(answer) };
  }

  function refs(ctx) {
    const root = ctx.db.ref(ctx.base + '/qq');
    return { root, list: root.child('list'), rooms: root.child('rooms'), chat: root.child('chat'), online: root.child('online') };
  }
  function playersOf(room) {
    return Object.keys(room && room.p || {}).map(k => Object.assign({ k }, room.p[k])).sort((a, b) => (a.joined || 0) - (b.joined || 0) || a.k.localeCompare(b.k));
  }
  const onlinePlayers = room => playersOf(room).filter(p => p.online !== false);

  /* ───────────────────────────── Lobby ───────────────────────────── */
  const ICON = {
    stage: '<svg viewBox="0 0 48 48" aria-hidden="true"><g stroke="#4a2c10" stroke-width="2.4" stroke-linejoin="round"><path d="M10 40h28l-3-15H13z" fill="#c08546"/><path d="M13 25h22v-4H13z" fill="#e2b37d"/><path d="M16 40v4M32 40v4" stroke-linecap="round"/><path d="M24 4l3 6 6.5 1-4.7 4.6 1.1 6.4L24 19l-5.9 3 1.1-6.4-4.7-4.6 6.5-1z" fill="#ffd84a"/></g><path d="M16 30h16" stroke="#fff4" stroke-width="2"/></svg>',
    ox: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="15" cy="24" r="9" fill="none" stroke="#0b4740" stroke-width="7"/><circle cx="15" cy="24" r="9" fill="none" stroke="#2fb8a8" stroke-width="4"/><g stroke-linecap="round"><path d="M29 16l12 16M41 16L29 32" stroke="#6b1d12" stroke-width="7"/><path d="M29 16l12 16M41 16L29 32" stroke="#e8584a" stroke-width="4"/></g></svg>',
    post: '<svg viewBox="0 0 160 120" aria-hidden="true"><g stroke="#4a2c10" stroke-width="3" stroke-linejoin="round"><path d="M74 22h12v92H74z" fill="#9a6431"/><path d="M28 30h96l14 13-14 13H28z" fill="#e2b37d"/><path d="M34 64h86l-12 12 12 12H34z" fill="#c08546"/></g><path d="M58 108c8-10 36-10 44 0" fill="#7cc23e" stroke="#2f5e22" stroke-width="2.5"/><circle cx="46" cy="104" r="5" fill="#ffd84a" stroke="#8a5a10" stroke-width="2"/><text x="78" y="49" text-anchor="middle" font-family="QuizLatin,QuizRound,sans-serif" font-weight="700" font-size="17" fill="#3b2a1a">QUIZ</text><text x="76" y="82" text-anchor="middle" font-family="QuizRound,sans-serif" font-size="14" fill="#fff">광장</text></svg>'
  };
  /* A string of fairy lights sagging across the plaza; bulbs twinkle one by one. */
  function fairyLights(count) {
    let bulbs = '';
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1), x = 4 + u * 92, y = 10 + Math.sin(u * Math.PI) * 26;
      bulbs += '<i class="qq-bulb b' + (i % 3) + '" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + 'px;animation-delay:-' + ((i * 0.53) % 3).toFixed(2) + 's"></i>';
    }
    return '<div class="qq-lights" aria-hidden="true"><svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0 6 Q50 66 100 6" fill="none" stroke="#3b2510" stroke-width=".6" vector-effect="non-scaling-stroke"/></svg>' + bulbs + '</div>';
  }
  const head = (ctx, av) => '<i class="qq-head" aria-hidden="true">' + ctx.avatarSVG(av || {}, 70, 1) + '</i>';

  function mountLobby(container, ctx) {
    const R = refs(ctx), me = ctx.me, subs = [];
    const S = { list: {}, chat: {}, online: {}, filter: 'all' };
    let destroyed = false;
    const daily = Math.max(0, me.daily || 0), cap = Math.max(1, me.cap || 300);
    const plates = ctx.isTeacher
      ? '<span class="qq-num teacher">수업 방을 만들어 학생을 불러요</span>'
      : '<span class="qq-num"><i class="qq-coin-ico"></i><b>' + (me.gold || 0).toLocaleString() + '</b>골드</span>'
        + '<span class="qq-cap" title="오늘 연습으로 모은 골드"><i style="width:' + Math.min(100, daily / cap * 100) + '%"></i><b>오늘의 연습 ' + daily + ' / ' + cap + '</b></span>';
    const filters = [['all', '전체'], ['stage', '무대 QUIZ'], ['ox', '서바이벌 OX']]
      .map(([k, t]) => '<button class="qq-chip' + (k === 'all' ? ' on' : '') + '" data-filter="' + k + '" aria-pressed="' + (k === 'all') + '">' + t + '</button>').join('');
    container.innerHTML = `<div class="qq-lobby">${ambient(16)}
      <section class="qq-plaza" aria-label="친구 광장">${fairyLights(17)}
        <div class="qq-sign" aria-hidden="true"><i class="qq-rope l"></i><i class="qq-rope r"></i><div class="qq-sign-board">${ctx.candy([{ text: 'QUIZ', variant: 'sky' }, ' 광장'], { label: '퀴즈 광장' })}<small>친구들이 모이는 곳</small></div></div>
        <div class="qq-plaza-row" id="qqPlaza"></div><p class="qq-plaza-empty" id="qqPlazaEmpty">친구들이 들어오면 여기 모여요</p>
        <div class="qq-me"><div class="qq-me-stage"><div class="qq-hang"><i></i><i></i><b>${esc(me.name)}</b></div><div class="qq-me-avatar">${ctx.avatarSVG(me.av, 140, 3)}</div><i class="qq-stump" aria-hidden="true"></i></div>
          <div class="qq-me-plates">${plates}</div></div>
      </section>
      <section class="qq-wall" aria-labelledby="qqRoomsTitle">
        <header class="qq-wall-h"><h2 id="qqRoomsTitle">${ctx.candy('방 게시판', { className: 'ct-small' })}</h2><div class="qq-filter" role="group" aria-label="게임 종류">${filters}</div><span class="qq-count" id="qqRoomCount"></span></header>
        <div class="qq-room-grid" id="qqRoomGrid"></div>
        <div class="qq-room-actions"><p class="qq-room-tip">선생님 방은 맨 앞에 금별을 달고 붙어요</p><button class="btn g" id="qqCreate">방 만들기</button><button class="btn y" id="qqQuick">바로 시작</button></div>
      </section>
      <section class="qq-win qq-online"><header class="qq-win-h"><h2>출석부</h2><span class="qq-count" id="qqOnlineCount"></span></header><ul class="qq-online-list" id="qqOnline"></ul></section>
      <section class="qq-chatbar" aria-label="로비 채팅">
        <div class="qq-chat-log" id="qqChatLog" role="log" aria-live="polite"></div>
        <form class="qq-chat-form" id="qqChatForm"><input class="inp" id="qqChatIn" maxlength="60" autocomplete="off" placeholder="친구들에게 한마디" aria-label="로비 채팅"><button class="btn sm">보내기</button></form>
      </section></div>`;
    const el = id => container.querySelector('#' + id);

    function rooms() {
      const now = ctx.svNow();
      return Object.keys(S.list).map(id => Object.assign({ id }, S.list[id])).filter(r => r && r.title && now - (r.t || 0) < LIST_STALE)
        .sort((a, b) => (b.teacher ? 1 : 0) - (a.teacher ? 1 : 0) || (a.created || 0) - (b.created || 0));
    }
    function card(r, no) {
      const full = (r.n || 0) >= (r.max || MAX), playing = r.phase && r.phase !== 'lobby';
      const heads = (Array.isArray(r.heads) ? r.heads : Object.values(r.heads || {})).slice(0, 5);
      const more = (r.n || 0) > heads.length ? '<em>+' + ((r.n || 0) - heads.length) + '</em>' : '';
      const state = full ? '가득 찼어요' : playing ? '게임 중' : '모집 중';
      return `<button class="qq-room mode-${esc(r.mode)} ${full ? 'full' : playing ? 'playing' : 'waiting'} ${r.teacher ? 'teacher' : ''}" data-room="${esc(r.id)}" ${full ? 'disabled' : ''} aria-label="${esc(r.title)}, ${esc(MODES[r.mode]?.name || '')}, ${r.n || 0}명, ${state}">
        <i class="qq-pin" aria-hidden="true"></i>${r.teacher ? '<span class="qq-ribbon">선생님 방</span>' : ''}
        <span class="qq-room-icon">${ICON[r.mode] || ICON.stage}</span>
        <span class="qq-room-no">${pad3(no)}</span><b class="qq-room-title">${esc(r.title)}</b>
        <span class="qq-room-sub">${esc(MODES[r.mode]?.name || '')} · ${esc(r.hostName || '')}</span>
        <span class="qq-room-heads">${heads.map(av => head(ctx, av)).join('')}${more}</span>
        <span class="qq-room-state">${state}</span><span class="qq-room-n">${r.n || 0}<small>/${r.max || MAX}</small></span></button>`;
    }
    function paintRooms() {
      const all = rooms(), list = all.filter(r => S.filter === 'all' || r.mode === S.filter), grid = el('qqRoomGrid');
      el('qqRoomCount').textContent = all.length + '개';
      grid.innerHTML = list.length ? list.map(r => card(r, all.indexOf(r) + 1)).join('')
        : `<div class="qq-empty">${ICON.post}<b>${all.length ? '이 종류의 방이 없어요' : '아직 붙은 방이 없어요'}</b><p>방 만들기를 눌러 첫 방을 붙여 보세요.</p></div>`;
      grid.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { ctx.sound?.click?.(); ctx.go('qqroom', b.dataset.room); });
    }
    container.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
      S.filter = b.dataset.filter;
      container.querySelectorAll('[data-filter]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      paintRooms();
    });
    const plazaNodes = new Map();
    function paintPlaza(people) {
      const row = el('qqPlaza'), shown = people.filter(p => p.k !== me.k).slice(0, 9), keep = new Set(shown.map(p => p.k)), now = ctx.svNow();
      for (const [k, node] of plazaNodes) if (!keep.has(k)) { node.remove(); plazaNodes.delete(k); }
      const said = {};
      Object.keys(S.chat).map(k => S.chat[k]).filter(m => m && now - (m.t || 0) < 6000).sort((a, b) => a.t - b.t).forEach(m => { said[m.k] = m.text; });
      shown.forEach((p, i) => {
        let node = plazaNodes.get(p.k);
        const avKey = JSON.stringify(p.av || {});
        if (!node) {
          node = document.createElement('div'); node.className = 'qq-pal'; node.style.setProperty('--i', i);
          node.innerHTML = '<span class="qq-say"></span><div class="qq-pal-avatar"></div><b></b>';
          plazaNodes.set(p.k, node);
        }
        if (node.dataset.av !== avKey) { node.querySelector('.qq-pal-avatar').innerHTML = ctx.avatarSVG(p.av || {}, 108, 3); node.dataset.av = avKey; }
        node.classList.toggle('away', !!(p.where && p.where !== 'lobby'));
        node.querySelector('b').textContent = p.name || '';
        const say = node.querySelector('.qq-say'); say.textContent = said[p.k] || ''; say.classList.toggle('on', !!said[p.k]);
        node.style.order = i;
        if (!node.isConnected) row.appendChild(node);
      });
      el('qqPlazaEmpty').hidden = shown.length > 0;
      const mine = container.querySelector('.qq-me .qq-say');
      if (said[me.k]) {
        let bubble = mine;
        if (!bubble) { bubble = document.createElement('span'); bubble.className = 'qq-say'; container.querySelector('.qq-me-stage').appendChild(bubble); }
        bubble.textContent = said[me.k]; bubble.classList.add('on');
      } else if (mine) mine.classList.remove('on');
    }
    function paintOnline() {
      const now = ctx.svNow(), people = Object.keys(S.online).map(k => Object.assign({ k }, S.online[k])).filter(p => p && now - (p.t || 0) < ONLINE_TTL)
        .sort((a, b) => (b.teacher ? 1 : 0) - (a.teacher ? 1 : 0) || String(a.name).localeCompare(String(b.name), 'ko'));
      el('qqOnlineCount').textContent = people.length + '명';
      paintPlaza(people);
      const html = people.map(p => '<li class="' + (p.k === me.k ? 'me' : '') + '">' + head(ctx, p.av) + '<b>' + esc(p.name) + '</b>'
        + (p.teacher ? '<span class="qq-tag teacher">선생님</span>' : '')
        + '<small class="' + (p.where && p.where !== 'lobby' ? 'busy' : '') + '"><i class="qq-dot"></i>' + (p.where && p.where !== 'lobby' ? '게임 중' : '광장') + '</small></li>').join('');
      const list = el('qqOnline'); if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
    }
    function paintChat() {
      const log = el('qqChatLog'), lines = Object.keys(S.chat).map(k => S.chat[k]).filter(Boolean).sort((a, b) => (a.t || 0) - (b.t || 0)).slice(-40);
      log.innerHTML = '<p class="qq-chat-hint">[알림] QUIZ 광장에 오신 것을 환영해요! 게시판의 방을 누르거나 방을 만들어요.</p>'
        + lines.map(m => '<p class="' + (m.k === me.k ? 'me' : '') + '"><b class="qq-name-chip">' + esc(m.name) + '</b>' + esc(m.text) + '</p>').join('');
      log.scrollTop = log.scrollHeight;
    }
    const sub = (ref, fn) => { const h = ref.on('value', snap => { if (!destroyed) fn(snap.val() || {}); }); subs.push(() => ref.off('value', h)); };
    sub(R.list, v => { S.list = v; paintRooms(); });
    sub(R.chat, v => { S.chat = v; paintChat(); paintOnline(); });
    sub(R.online, v => { S.online = v; paintOnline(); });
    const here = () => R.online.child(me.k).set({ name: me.name, av: ctx.publicAvatar(me.av), t: ctx.svNow(), where: 'lobby', teacher: !!ctx.isTeacher }).catch(() => {});
    here(); R.online.child(me.k).onDisconnect().remove();
    const beat = setInterval(() => { here(); paintRooms(); cleanupStale(); }, 15000);
    const bubbleTimer = setInterval(paintOnline, 2000);
    function cleanupStale() {
      const now = ctx.svNow();
      Object.keys(S.list).forEach(id => { const r = S.list[id]; if (r && now - (r.t || 0) > LIST_STALE * 2) { R.list.child(id).remove(); R.rooms.child(id).remove(); } });
    }
    el('qqChatForm').onsubmit = e => {
      e.preventDefault();
      const input = el('qqChatIn'), text = clean(input.value, 60); if (!text) return;
      input.value = '';
      R.chat.push({ k: me.k, name: me.name, text, t: ctx.svNow() });
      const keys = Object.keys(S.chat).sort((a, b) => (S.chat[a].t || 0) - (S.chat[b].t || 0));
      keys.slice(0, Math.max(0, keys.length - 60)).forEach(k => R.chat.child(k).remove());
    };
    el('qqCreate').onclick = () => openCreate(ctx, R);
    el('qqQuick').onclick = () => {
      const open = rooms().find(r => r.phase === 'lobby' && (r.n || 0) < (r.max || MAX));
      if (open) ctx.go('qqroom', open.id); else openCreate(ctx, R);
    };
    return { destroy() { destroyed = true; subs.forEach(f => f()); clearInterval(beat); clearInterval(bubbleTimer); R.online.child(me.k).remove().catch(() => {}); } };
  }

  /* Room settings: title, game, question set, count and seconds. */
  function openCreate(ctx, R) {
    const me = ctx.me, sets = ctx.setList().filter(s => s.n > 0);
    if (!sets.length) { ctx.toast('선생님이 만든 문제 묶음이 아직 없어요.'); return; }
    let mode = 'stage';
    const oxCount = id => ctx.pickQs(id, 1, 999, true).length;
    ctx.modal('방 만들기', `<form class="qq-create" id="qqCreateForm">
      <label>방 제목<input class="inp" id="qqTitle" maxlength="20" value="${esc(me.name + '의 방')}"></label>
      <fieldset class="qq-mode-pick"><legend>게임</legend>
        <button type="button" class="qq-mode on" data-mode="stage"><b>무대 QUIZ</b><small>1~4번 중 정답을 골라요</small></button>
        <button type="button" class="qq-mode" data-mode="ox"><b>서바이벌 OX</b><small>O·X 구역으로 걸어가요</small></button>
      </fieldset>
      <label>문제 묶음<select class="inp" id="qqSet"></select></label>
      <div class="qq-create-row"><label>문제 수<select class="inp" id="qqCount"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label>
      <label>한 문제 시간<select class="inp" id="qqSec"></select></label></div>
      <p class="hint" id="qqCreateHint"></p>
      <div class="qq-create-actions"><button type="button" class="btn gray" id="qqCancel">닫기</button><button class="btn y">방 만들기</button></div></form>`, () => {
      const $ = id => document.getElementById(id);
      function paint() {
        document.querySelectorAll('#qqCreateForm [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
        const usable = mode === 'ox' ? sets.filter(s => oxCount(s.id) >= 3) : sets;
        $('qqSet').innerHTML = usable.map(s => `<option value="${esc(s.id)}">${esc(s.title)} · ${mode === 'ox' ? oxCount(s.id) + 'OX문제' : s.n + '문제'}</option>`).join('') || '<option value="">O·X 문제가 3개 이상인 묶음이 없어요</option>';
        $('qqSec').innerHTML = (mode === 'ox' ? [8, 10, 12, 15] : [10, 15, 20, 30]).map(v => `<option ${v === (mode === 'ox' ? 12 : 15) ? 'selected' : ''} value="${v}">${v}초</option>`).join('');
        $('qqCreateHint').textContent = ctx.isTeacher ? '선생님 방은 정답마다 골드를 주고 마지막에 순위 보너스를 줘요.' : '친구 방은 오늘의 연습 골드 안에서 정답 골드를 받아요.';
      }
      document.querySelectorAll('#qqCreateForm [data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; paint(); });
      $('qqCancel').onclick = ctx.closeModal;
      paint();
      $('qqCreateForm').onsubmit = async e => {
        e.preventDefault();
        const setId = $('qqSet').value; if (!setId) return;
        const pool = mode === 'ox' ? ctx.pickQs(setId, 1, 999, true) : ctx.pickQs(setId, 1, 999, false);
        const count = Math.min(Number($('qqCount').value) || 10, pool.length), sec = Number($('qqSec').value) || 15;
        if (!count) { ctx.toast('이 묶음에는 쓸 수 있는 문제가 없어요.'); return; }
        const now = ctx.svNow(), id = 'r' + now.toString(36) + Math.random().toString(36).slice(2, 6);
        const title = clean($('qqTitle').value, 20) || me.name + '의 방';
        const meta = { id, title, mode, host: me.k, hostName: me.name, teacher: !!ctx.isTeacher, setId, count, sec, seed: (now & 0x7fffffff) || 1,
          session: 's' + now.toString(36), phase: 'lobby', qi: -1, startedAt: 0, tEnd: 0, phaseAt: now, created: now, beat: now, max: MAX };
        await R.rooms.child(id).set({ meta, p: { [me.k]: { name: me.name, av: ctx.publicAvatar(me.av), sc: 0, ok: 0, online: true, joined: now } } });
        await R.list.child(id).set({ title, mode, n: 1, max: MAX, phase: 'lobby', hostName: me.name, teacher: !!ctx.isTeacher, created: now, t: now, heads: [ctx.publicAvatar(me.av)] });
        ctx.closeModal(); ctx.go('qqroom', id);
      };
      setTimeout(() => $('qqTitle').focus(), 30);
    });
  }

  /* ───────────────────────────── Room session ─────────────────────────────
     Shared by the stage quiz and Survival OX: subscription, joining, the host's
     heartbeat and room card, host hand-over, teacher-room gold, chat, leaving. */
  function roomSession(ctx, roomId, hooks) {
    const R = refs(ctx), me = ctx.me, roomRef = R.rooms.child(roomId), listRef = R.list.child(roomId);
    const S = { room: null, joined: false, missingSince: 0, paid: new Set() };
    let destroyed = false;
    const meta = () => S.room && S.room.meta;
    const isHost = () => !!meta() && meta().host === me.k;
    const tx = fn => roomRef.transaction(fn, undefined, false).catch(e => ctx.toast('방 연결을 확인해 주세요: ' + e.message, 2500));
    function join() {
      if (S.joined || destroyed) return;
      S.joined = true;
      tx(room => {
        if (!room || !room.meta) return;
        room.p = room.p || {};
        const others = Object.keys(room.p).filter(k => room.p[k].online !== false && k !== me.k).length;
        if (!room.p[me.k] && others >= (room.meta.max || MAX)) return;
        const prev = room.p[me.k] || { sc: 0, ok: 0, joined: ctx.svNow(), alive: room.meta.phase === 'lobby' };
        room.p[me.k] = Object.assign(prev, { name: me.name, av: ctx.publicAvatar(me.av), online: true });
        return room;
      }).then(r => {
        if (destroyed) return;
        if (r && !r.committed) { ctx.toast('방이 가득 찼어요.'); ctx.go('quizquiz'); return; }
        roomRef.child('p/' + me.k + '/online').onDisconnect().set(false);
        R.online.child(me.k).set({ name: me.name, av: ctx.publicAvatar(me.av), t: ctx.svNow(), where: roomId, teacher: !!ctx.isTeacher }).catch(() => {});
      });
    }
    function deliverRewards(room) {
      if (!room.meta.teacher) return;
      playersOf(room).forEach(p => Object.keys(p.rewards || {}).forEach(id => {
        const r = p.rewards[id], key = p.k + '/' + id;
        if (r.delivered || S.paid.has(key)) return;
        S.paid.add(key);
        ctx.userRef(p.k).transaction(u => {
          if (!u) return;
          u.liveClaims = u.liveClaims || {};
          if (u.liveClaims['qq_' + id]) return u;
          u.liveClaims['qq_' + id] = true; u.gold = (Number(u.gold) || 0) + (Number(r.gold) || 0);
          u.stat = u.stat || {}; u.stat.solved = (u.stat.solved || 0) + (r.solved || 0); u.stat.correct = (u.stat.correct || 0) + (r.correct || 0);
          return u;
        }, undefined, false).then(res => {
          if (res.snapshot && res.snapshot.val()) return roomRef.child('p/' + p.k + '/rewards/' + id + '/delivered').set(true);
        }).catch(() => S.paid.delete(key));
      }));
    }
    function heartbeat(room) {
      const m = room.meta, now = ctx.svNow(), online = onlinePlayers(room);
      if (now - (m.beat || 0) > BEAT) {
        roomRef.child('meta/beat').set(now);
        listRef.update({ n: online.length, phase: m.phase, t: now, title: m.title, mode: m.mode, hostName: m.hostName, teacher: !!m.teacher, heads: online.slice(0, 5).map(p => p.av || {}) });
      }
      deliverRewards(room);
    }
    function maybeTakeOver(room) {
      const m = room.meta, host = room.p && room.p[m.host];
      if (ctx.svNow() - (m.beat || 0) < STALE && host && host.online !== false) return;
      const next = onlinePlayers(room).find(p => p.k !== m.host);
      if (!next || next.k !== me.k) return;
      tx(r => {
        if (!r || !r.meta || r.meta.host === me.k) return;
        const h = r.p && r.p[r.meta.host];
        if (ctx.svNow() - (r.meta.beat || 0) < STALE && h && h.online !== false) return;
        Object.assign(r.meta, { host: me.k, hostName: me.name, teacher: !!ctx.isTeacher, beat: ctx.svNow() });
        return r;
      });
    }
    const listener = roomRef.on('value', snap => {
      if (destroyed) return;
      S.room = snap.val();
      if (!S.room || !S.room.meta) {
        if (!S.missingSince) S.missingSince = Date.now();
        if (Date.now() - S.missingSince > 1500) { ctx.toast('방이 닫혔어요. 로비로 돌아가요.'); ctx.go('quizquiz'); }
        return;
      }
      S.missingSince = 0;
      join();
      hooks.onRoom(S.room);
    });
    const timer = setInterval(() => {
      const room = S.room; if (!room || !room.meta || destroyed) return;
      if (isHost()) { heartbeat(room); hooks.onHostTick && hooks.onHostTick(room); } else maybeTakeOver(room);
    }, 250);
    function setPhase(room, phase, extra) { Object.assign(room.meta, { phase, phaseAt: ctx.svNow() }, extra || {}); return room; }
    function reward(p, id, gold, solved, correct) { p.rewards = p.rewards || {}; if (!p.rewards[id]) p.rewards[id] = { gold, solved, correct, delivered: false }; }
    function say(text) {
      text = clean(text, 40); if (!text) return;
      roomRef.child('chat').push({ k: me.k, name: me.name, text, t: ctx.svNow() });
      roomRef.child('p/' + me.k).update({ say: text, sayAt: ctx.svNow() });
      const chat = S.room && S.room.chat || {}, keys = Object.keys(chat);
      if (keys.length > 40) keys.sort((a, b) => chat[a].t - chat[b].t).slice(0, keys.length - 30).forEach(k => roomRef.child('chat/' + k).remove());
    }
    let questionCache = null;
    function questions(m) {
      const key = m.setId + '_' + m.seed + '_' + m.count + '_' + m.mode;
      if (!questionCache || questionCache.key !== key) {
        const all = ctx.pickQs(m.setId, m.seed, 999, m.mode === 'ox');
        questionCache = { key, all, list: all.slice(0, m.count) };
      }
      return questionCache;
    }
    return {
      ref: roomRef, get room() { return S.room; }, meta, isHost, tx, setPhase, reward, say, questions,
      destroy() {
        destroyed = true;
        clearInterval(timer);
        roomRef.off('value', listener);
        roomRef.child('p/' + me.k + '/online').onDisconnect().cancel?.();
        const room = S.room;
        if (!room || !room.meta) return;
        const others = onlinePlayers(room).filter(p => p.k !== me.k);
        if (!others.length) { roomRef.remove(); listRef.remove(); return; }
        roomRef.transaction(r => {
          if (!r || !r.meta) return;
          if (r.p && r.p[me.k]) { if (r.meta.phase === 'lobby') delete r.p[me.k]; else r.p[me.k].online = false; }
          if (r.meta.host === me.k) { const next = onlinePlayers(r).find(p => p.k !== me.k); if (next) Object.assign(r.meta, { host: next.k, hostName: next.name, teacher: false, beat: ctx.svNow() }); }
          return r;
        }, undefined, false).catch(() => {});
      }
    };
  }

  /* Shared HUD bits: room chat, title splash, personal O/X stamp, alarm clock. */
  function roomChat(el, room, me) {
    const lines = Object.keys(room.chat || {}).map(k => room.chat[k]).sort((a, b) => (a.t || 0) - (b.t || 0)).slice(-6);
    const html = lines.map(c => `<p class="${c.k === me.k ? 'me' : ''}"><b class="qq-name-chip">${esc(c.name)}</b>${esc(c.text)}</p>`).join('') || '<p class="qq-chat-hint">[알림] 방에 들어왔어요. 친구들에게 인사해요!</p>';
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; el.scrollTop = el.scrollHeight; }
  }
  function replay(node, cls, html) { node.innerHTML = html; node.className = cls; void node.offsetWidth; node.classList.add('on'); }
  const hudChat = '<section class="qq-chat-mini"><div class="qq-chat-log" data-chat role="log"></div><form data-chat-form><input class="inp" maxlength="40" autocomplete="off" placeholder="모두에게" aria-label="방 채팅"><button class="btn sm">말하기</button></form></section>';
  const hudClock = `<div class="qq-clock" data-clock hidden>${ART.clock}<b data-sec>0</b><span class="qq-hurry">서둘러요!</span></div>`;
  function tickClock(root, m, ctx, S) {
    const clock = root.querySelector('[data-clock]'), bar = root.querySelector('[data-timebar]');
    const asking = m && m.phase === 'ask';
    clock.hidden = !asking; if (bar) bar.hidden = !asking;
    if (!asking) { root.classList.remove('hurry'); return { left: 0 }; }
    const left = Math.max(0, m.tEnd - ctx.svNow()), secs = Math.ceil(left / 1000);
    clock.querySelector('[data-sec]').textContent = secs;
    if (bar) bar.querySelector('i').style.width = Math.max(0, Math.min(100, left / (m.sec * 1000) * 100)) + '%';
    const hurry = secs > 0 && secs <= 3;
    root.classList.toggle('hurry', hurry);
    const mark = m.session + '_' + m.qi + '_' + secs;
    if (hurry && S.lastHurry !== mark) { S.lastHurry = mark; ctx.sound?.hurry?.(); }
    return { left };
  }

  /* ───────────────────────────── Stage quiz ───────────────────────────── */
  function mountRoom(container, ctx, roomId) {
    const me = ctx.me, S = { lastPhaseKey: '', lastHurry: '', selfPaid: new Set(), booths: new Map() };
    container.innerHTML = `<div class="qq-stage" data-phase="lobby">
      <div class="qq-stage-bg"></div>${ambient(12)}
      <header class="qq-stage-top"><div class="qq-room-name" data-name></div><span class="qq-room-meta" data-meta></span></header>
      <section class="qq-board" data-board aria-live="polite"></section>
      ${hudClock}<div class="qq-timebar" data-timebar hidden><i></i></div>
      <section class="qq-booths" data-booths aria-label="참가자"></section>
      <aside class="qq-win qq-rank"><header class="qq-win-h"><h2>점수판</h2></header><ol data-rank></ol></aside>
      <div class="qq-console" data-console role="group" aria-label="답 고르기">${[1, 2, 3, 4].map(n => `<button class="qq-key" data-key="${n - 1}" aria-label="${n}번" disabled><b>${n}</b></button>`).join('')}</div>
      ${hudChat}<div class="qq-stamp" data-stamp aria-hidden="true"></div><div class="qq-splash" data-splash aria-hidden="true"></div></div>`;
    const stage = container.querySelector('.qq-stage'), q$ = s => container.querySelector(s);
    const session = roomSession(ctx, roomId, { onRoom: render, onHostTick: hostTick });
    const { tx, setPhase, reward, questions, isHost } = session;

    function startGame() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase !== 'lobby') return;
        const now = ctx.svNow();
        Object.assign(room.meta, { session: 's' + now.toString(36), seed: (now & 0x7fffffff) || 1 });
        Object.keys(room.p || {}).forEach(k => Object.assign(room.p[k], { sc: 0, ok: 0, last: null, bonus: 0 }));
        delete room.ans; delete room.q; delete room.reveal;
        return setPhase(room, 'intro', { qi: -1 });
      });
    }
    function startQuestion(index) {
      tx(room => {
        if (!room || room.meta.host !== me.k) return;
        const m = room.meta, set = questions(m), q = set.list[index];
        if (!q) return setPhase(room, 'end');
        const pick = stageChoices(q, set.all, m.seed + index * 97);
        room.q = { t: String(q.q || ''), c: pick.choices, n: index + 1, tot: set.list.length };
        delete room.ans; delete room.reveal;
        Object.keys(room.p || {}).forEach(k => { room.p[k].last = null; });
        const now = ctx.svNow();
        return setPhase(room, 'ask', { qi: index, startedAt: now, tEnd: now + m.sec * 1000 });
      });
    }
    function reveal() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase !== 'ask') return;
        const m = room.meta, set = questions(m), q = set.list[m.qi]; if (!q) return;
        const pick = stageChoices(q, set.all, m.seed + m.qi * 97), ans = room.ans || {};
        let answered = 0, right = 0;
        Object.keys(room.p || {}).forEach(k => {
          const p = room.p[k], a = ans[k];
          if (!(a && a.qi === m.qi && Number(a.t) <= m.tEnd + 400)) { p.last = p.online === false ? null : 'none'; return; }
          answered++;
          if (Number(a.v) === pick.correct) {
            right++;
            const elapsed = Math.max(0, Math.min(m.sec * 1000, Number(a.t) - m.startedAt));
            p.sc = (p.sc || 0) + 100 + Math.round(50 * (1 - elapsed / (m.sec * 1000)));
            p.ok = (p.ok || 0) + 1; p.last = 'o';
            if (m.teacher) reward(p, m.session + '_q' + m.qi, ctx.rules.livePerQ || 25, 1, 1);
          } else { p.last = 'x'; if (m.teacher) reward(p, m.session + '_q' + m.qi, 0, 1, 0); }
        });
        room.reveal = { ci: pick.correct, a: pick.choices[pick.correct], rate: answered ? Math.round(right / answered * 100) : 0, qi: m.qi };
        return setPhase(room, 'reveal');
      });
    }
    function finish() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase === 'end') return;
        const rows = playersOf(room).sort((a, b) => (b.sc || 0) - (a.sc || 0));
        if (room.meta.teacher) rows.forEach(p => {
          const rank = rows.findIndex(x => (x.sc || 0) === (p.sc || 0)), bonus = (ctx.rules.liveRankBonus || [])[rank] || 0;
          room.p[p.k].bonus = bonus; reward(room.p[p.k], room.meta.session + '_end', bonus, 0, 0);
        });
        return setPhase(room, 'end');
      });
    }
    function backToLobby() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase !== 'end') return;
        delete room.ans; delete room.q; delete room.reveal;
        Object.keys(room.p || {}).forEach(k => { if (room.p[k].online === false) delete room.p[k]; else room.p[k].last = null; });
        return setPhase(room, 'lobby', { qi: -1 });
      });
    }
    function hostTick(room) {
      const m = room.meta, now = ctx.svNow(), online = onlinePlayers(room);
      if (m.phase === 'intro' && now - m.phaseAt > INTRO_MS) startQuestion(0);
      else if (m.phase === 'ask') {
        const answered = online.filter(p => room.ans && room.ans[p.k] && room.ans[p.k].qi === m.qi).length;
        if (now >= m.tEnd || (online.length && answered >= online.length && now - m.startedAt > 1500)) reveal();
      } else if (m.phase === 'reveal' && now - m.phaseAt > REVEAL_MS) {
        if (m.qi + 1 < (room.q && room.q.tot || m.count)) startQuestion(m.qi + 1); else finish();
      } else if (m.phase === 'end' && now - m.phaseAt > END_MS) backToLobby();
    }

    function answer(index) {
      const m = session.meta(); if (!m || m.phase !== 'ask' || ctx.svNow() > m.tEnd) return;
      session.ref.child('ans/' + me.k).set({ v: index, t: ctx.svNow(), qi: m.qi });
      ctx.sound?.pick?.();
    }
    function onKey(e) {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.repeat) return;
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
      if (n != null && session.meta()?.phase === 'ask') { e.preventDefault(); answer(n); }
    }
    document.addEventListener('keydown', onKey);
    q$('[data-console]').addEventListener('click', e => { const b = e.target.closest('[data-key]'); if (b && !b.disabled) answer(Number(b.dataset.key)); });
    q$('[data-board]').addEventListener('click', e => {
      const c = e.target.closest('[data-choice]'); if (c) answer(Number(c.dataset.choice));
      if (e.target.closest('[data-start]')) startGame();
    });
    q$('[data-chat-form]').onsubmit = e => { e.preventDefault(); const input = e.target.querySelector('input'); session.say(input.value); input.value = ''; };

    function seatCount(n, max) { return Math.min(max || MAX, Math.max(10, Math.ceil(Math.max(n, 1) / 10) * 10)); }
    function paintBooths(room) {
      const m = room.meta, players = onlinePlayers(room), seats = seatCount(players.length, m.max), box = q$('[data-booths]');
      box.style.setProperty('--cols', Math.min(10, seats));
      box.style.setProperty('--rows', Math.ceil(seats / 10));
      const wanted = new Set(players.map(p => p.k));
      for (const [k, node] of S.booths) if (!wanted.has(k)) { node.remove(); S.booths.delete(k); }
      players.forEach((p, i) => {
        let node = S.booths.get(p.k);
        const avKey = JSON.stringify(p.av || {});
        if (!node) {
          node = document.createElement('div'); node.className = 'qq-booth'; node.dataset.k = p.k;
          node.innerHTML = '<span class="qq-say"></span><span class="qq-mark"></span><div class="qq-avatar"></div><span class="qq-plate"><b></b><small></small></span><span class="qq-leaves" aria-hidden="true"></span>';
          S.booths.set(p.k, node);
        }
        if (node.dataset.av !== avKey) { node.querySelector('.qq-avatar').innerHTML = ctx.avatarSVG(p.av || {}, 96, 3); node.dataset.av = avKey; }
        node.style.order = i;
        node.classList.toggle('me', p.k === me.k);
        node.classList.toggle('host', p.k === m.host);
        node.querySelector('.qq-plate b').textContent = p.name || '';
        node.querySelector('.qq-plate small').textContent = (p.sc || 0) + '점';
        const answered = m.phase === 'ask' && room.ans && room.ans[p.k] && room.ans[p.k].qi === m.qi;
        const state = m.phase === 'reveal' ? (p.last === 'o' ? 'right' : p.last === 'x' || p.last === 'none' ? 'wrong' : '') : answered ? 'thinking' : '';
        if (node.dataset.state !== state) {
          node.dataset.state = state;
          node.querySelector('.qq-mark').innerHTML = state === 'thinking' ? '<i class="qq-coin">?</i>' : state === 'right' ? ART.o : state === 'wrong' ? ART.x : '';
          node.querySelector('.qq-leaves').innerHTML = state === 'wrong' ? [0, 1, 2, 3, 4].map(i => `<i style="--i:${i}">${ART.leaf}</i>`).join('') : '';
        }
        const fresh = p.say && ctx.svNow() - (p.sayAt || 0) < 5000;
        const bubble = node.querySelector('.qq-say'); bubble.textContent = fresh ? p.say : ''; bubble.classList.toggle('on', !!fresh);
        if (!node.isConnected) box.appendChild(node);
      });
      box.querySelectorAll('.qq-booth.empty').forEach(n => n.remove());
      for (let i = players.length; i < seats; i++) {
        const empty = document.createElement('div'); empty.className = 'qq-booth empty'; empty.style.order = i;
        empty.innerHTML = '<div class="qq-avatar"></div><span class="qq-plate"><b>빈 자리</b></span>'; box.appendChild(empty);
      }
    }
    function paintBoard(room) {
      const m = room.meta, players = onlinePlayers(room), q = room.q, mine = room.ans && room.ans[me.k], board = q$('[data-board]');
      let html = '';
      if (m.phase === 'lobby') {
        html = `<p class="qq-board-kicker">[대기 중] 현재 ${players.length}명이 모였어요</p><h3>${esc(m.hostName)}님이 시작하면 바로 시작해요.</h3>
          <p class="qq-board-note">${esc(ctx.setTitle(m.setId))} · ${m.count}문제 · 한 문제 ${m.sec}초 · 숫자 1~4로 답해요</p>
          ${isHost() ? '<button class="btn y big" data-start>시작하기</button>' : '<p class="qq-board-wait">방장을 기다리는 중…</p>'}`;
      } else if (m.phase === 'intro') {
        html = '<p class="qq-board-kicker">무대 QUIZ에 오신 것을 환영해요!</p><h3>문제를 보고 1~4번 중 정답을 골라요.</h3><p class="qq-board-note">빨리 맞힐수록 점수가 커요 · 마지막 3초에는 자명종이 울려요</p>';
      } else if ((m.phase === 'ask' || m.phase === 'reveal') && q) {
        const shown = m.phase === 'reveal' && room.reveal;
        html = `<p class="qq-board-kicker">[문제 ${q.n}] <span>${q.n} / ${q.tot}</span></p><h3 class="qq-question">${esc(q.t)}</h3>
          <div class="qq-choices">${(q.c || []).map((c, i) => `<button class="qq-choice ${mine && mine.qi === m.qi && Number(mine.v) === i ? 'picked' : ''} ${shown ? (i === room.reveal.ci ? 'answer' : 'dim') : ''}" data-choice="${i}" ${m.phase !== 'ask' ? 'disabled' : ''}><i>${i + 1}</i><span>${esc(c)}</span></button>`).join('')}</div>
          ${shown ? `<p class="qq-board-result">[정답] ${room.reveal.ci + 1}번 ${esc(room.reveal.a)} <small>우리 방 정답률 ${room.reveal.rate}%</small></p>` : ''}`;
      } else if (m.phase === 'end') {
        const rows = onlinePlayers(room).sort((a, b) => (b.sc || 0) - (a.sc || 0)).slice(0, 3), mine2 = room.p && room.p[me.k];
        html = `<div class="qq-podium">${rows.map((p, i) => `<div class="qq-podium-${i + 1}"><div class="qq-avatar">${ctx.avatarSVG(p.av || {}, i ? 70 : 88, 3)}</div><b>${['1등', '2등', '3등'][i]} ${esc(p.name)}</b><small>${p.sc || 0}점</small></div>`).join('')}</div>
          <p class="qq-board-note">내 점수 ${mine2 ? mine2.sc || 0 : 0}점${m.teacher && mine2 && mine2.bonus ? ' · 순위 보너스 ' + mine2.bonus + '골드' : ''} · 잠시 뒤 대기실로 돌아가요</p>`;
      }
      if (board.dataset.html !== html) { board.innerHTML = html; board.dataset.html = html; }
    }
    function paintRank(room) {
      const rows = onlinePlayers(room).sort((a, b) => (b.sc || 0) - (a.sc || 0)).slice(0, 10);
      const html = rows.map(p => `<li class="${p.k === me.k ? 'me' : ''}"><i>${rows.findIndex(x => (x.sc || 0) === (p.sc || 0)) + 1}</i><b>${esc(p.name)}</b><span>${p.sc || 0}</span></li>`).join('');
      const list = q$('[data-rank]'); if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
    }
    function paintConsole(room) {
      const m = room.meta, mine = room.ans && room.ans[me.k], open = m.phase === 'ask' && ctx.svNow() <= m.tEnd;
      q$('[data-console]').querySelectorAll('[data-key]').forEach(b => {
        b.disabled = !open || !(room.q && room.q.c && room.q.c[Number(b.dataset.key)] != null);
        b.classList.toggle('picked', !!((m.phase === 'ask' || m.phase === 'reveal') && mine && mine.qi === m.qi && Number(mine.v) === Number(b.dataset.key)));
      });
    }
    function phaseEffects(room) {
      const m = room.meta, key = m.session + '_' + m.phase + '_' + m.qi;
      if (key === S.lastPhaseKey) return;
      S.lastPhaseKey = key;
      stage.dataset.phase = m.phase;
      ctx.sound?.gameState?.({ phase: m.phase === 'intro' ? 'ask' : m.phase, qi: 0, session: m.session, mode: 'quiz' });
      if (m.phase === 'intro') replay(q$('[data-splash]'), 'qq-splash', ctx.candy([{ text: '무대 ' }, { text: 'QUIZ', variant: 'sky' }], { label: '무대 퀴즈' }));
      if (m.phase === 'end') replay(q$('[data-splash]'), 'qq-splash', ctx.candy([{ text: 'QUIZ', variant: 'sky' }, ' 챔피언!'], { label: '퀴즈 챔피언!' }));
      if (m.phase === 'reveal') {
        const p = room.p && room.p[me.k];
        if (p && (p.last === 'o' || p.last === 'x')) {
          replay(q$('[data-stamp]'), 'qq-stamp ' + p.last, p.last === 'o' ? ART.o : ART.x);
          if (p.last === 'o') ctx.sound?.ok?.(); else ctx.sound?.no?.();
          if (!m.teacher && !ctx.isTeacher) {
            const claim = 'qq_' + m.session + '_' + m.qi;
            if (!S.selfPaid.has(claim)) { S.selfPaid.add(claim); ctx.rewardPractice(p.last === 'o', claim).catch(() => {}); }
          }
        }
      }
    }
    function render(room) {
      const m = room.meta;
      q$('[data-name]').innerHTML = ctx.candy(m.title, { className: 'ct-small' });
      q$('[data-meta]').textContent = (MODES[m.mode]?.name || '') + (m.teacher ? ' · 선생님 방' : '') + ' · ' + onlinePlayers(room).length + '/' + (m.max || MAX) + '명';
      paintBoard(room); paintBooths(room); paintRank(room); roomChat(q$('[data-chat]'), room, me); paintConsole(room);
      tickClock(stage, m, ctx, S); phaseEffects(room);
    }
    const uiTimer = setInterval(() => {
      const room = session.room; if (!room || !room.meta) return;
      const { left } = tickClock(stage, room.meta, ctx, S);
      if (room.meta.phase === 'ask' && left <= 0) q$('[data-console]').querySelectorAll('[data-key]').forEach(b => b.disabled = true);
      paintConsole(room); paintBooths(room);
    }, 500);
    return { destroy() { clearInterval(uiTimer); document.removeEventListener('keydown', onKey); session.destroy(); } };
  }

  /* ───────────────────────────── Survival OX ─────────────────────────────
     On the school playground: a chalk O on the dirt infield, a chalk X on the
     soccer pitch, spectator steps for those who are out. Everyone walks with
     their own avatar (the shared map engine); positions sync per room. */
  const OX = {
    o: [[1760, 985], [2195, 778], [2470, 893], [2035, 1118]],
    x: [[2555, 612], [2748, 520], [3150, 707], [2958, 800]],
    stands: { x: 1530, y: 930 },
    spawn: { x: 1680, y: 868 },
    camera: { x: 2330, y: 700, zoom: .56 }
  };
  function inside(pt, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt.y) !== (yj > pt.y) && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }
  const zoneAt = pt => inside(pt, OX.o) ? 'o' : inside(pt, OX.x) ? 'x' : null;
  const answerOX = a => /^(o|ㅇ|맞)/i.test(String(a == null ? '' : a).trim()) ? 'o' : 'x';
  function oxChalk() {
    const pts = p => p.map(q => q.join(',')).join(' ');
    const cx = p => p.reduce((s, q) => s + q[0], 0) / 4, cy = p => p.reduce((s, q) => s + q[1], 0) / 4;
    const ox = cx(OX.o), oy = cy(OX.o), xx = cx(OX.x), xy = cy(OX.x);
    const ring = `<ellipse cx="${ox}" cy="${oy}" rx="190" ry="96"/>`;
    const cross = `<path d="M${xx - 150} ${xy - 34} L${xx + 150} ${xy + 34} M${xx + 64} ${xy - 78} L${xx - 64} ${xy + 78}"/>`;
    return `<svg class="qq-ox-chalk" viewBox="0 0 3714 1808" width="3714" height="1808" aria-hidden="true">
      <polygon class="qq-zone z-o" points="${pts(OX.o)}"/><polygon class="qq-zone z-x" points="${pts(OX.x)}"/>
      <g class="qq-chalk o">${ring}</g><g class="qq-chalk x">${cross}</g>
      <g class="qq-puffs z-o">${[0, 1, 2, 3, 4].map(i => `<circle cx="${ox - 160 + i * 80}" cy="${oy + (i % 2 ? -30 : 26)}" r="46" style="--i:${i}"/>`).join('')}</g>
      <g class="qq-puffs z-x">${[0, 1, 2, 3, 4].map(i => `<circle cx="${xx - 160 + i * 80}" cy="${xy + (i % 2 ? -26 : 22)}" r="44" style="--i:${i}"/>`).join('')}</g>
      <text class="qq-stands-label" x="${OX.stands.x}" y="${OX.stands.y - 70}">관중석</text></svg>`;
  }

  function mountOxRoom(container, ctx, roomId) {
    const me = ctx.me, S = { lastPhaseKey: '', lastHurry: '', selfPaid: new Set(), zone: undefined, zoneQi: null, roster: [], sentOff: '' };
    container.innerHTML = `<div class="qq-ox" data-phase="lobby">
      <div class="qq-ox-world" data-world></div>
      <div class="qq-ox-marks" data-marks aria-hidden="true"></div>
      <section class="qq-board qq-ox-board" data-board aria-live="polite"></section>
      <div class="qq-ox-tally" data-tally hidden><span class="o">O <b>0</b></span><span class="vs">:</span><span class="x"><b>0</b> X</span></div>
      ${hudClock}
      <aside class="qq-win qq-rank qq-ox-rank"><header class="qq-win-h"><h2>살아남은 친구</h2><span class="qq-count" data-alive></span></header><ol data-rank></ol></aside>
      ${hudChat}<div class="qq-stamp" data-stamp aria-hidden="true"></div><div class="qq-splash" data-splash aria-hidden="true"></div></div>`;
    const root = container.querySelector('.qq-ox'), q$ = s => container.querySelector(s);
    // The roster carries the room space name; the map engine plays it as the playground.
    // Everyone starts near the spectator steps, a little apart so friends do not stack.
    const spawn = { x: OX.spawn.x + Math.round((Math.random() - .5) * 220), y: OX.spawn.y + Math.round((Math.random() - .5) * 70) };
    const scene = ctx.oxScene(Object.assign({}, OX, { spawn }));
    let world = null;
    const presence = ctx.oxPresence(roomId, scene, spawn, players => { S.roster = players.map(p => Object.assign({}, p, { zone: 'playground' })); if (world) world.setPlayers(S.roster); }, status => { S.status = status; if (world) world.setStatus(status); });
    world = ctx.mountWorld(q$('[data-world]'), { scene, presence, onExit: () => ctx.go('quizquiz') });
    world.setPlayers(S.roster); if (S.status) world.setStatus(S.status);
    window.QPQuizQuiz.active = { world, presence, roster: () => S.roster, zone: () => zoneAt(world.getState() || {}) };
    const layer = q$('[data-world]').querySelector('.sr-world');
    if (layer) layer.insertAdjacentHTML('afterbegin', oxChalk());
    const chalk = q$('.qq-ox-chalk');
    const session = roomSession(ctx, roomId, { onRoom: render, onHostTick: hostTick });
    const { tx, setPhase, reward, questions, isHost } = session;

    function startGame() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase !== 'lobby') return;
        const now = ctx.svNow();
        Object.assign(room.meta, { session: 's' + now.toString(36), seed: (now & 0x7fffffff) || 1 });
        const online = onlinePlayers(room);
        room.meta.started = online.length;
        Object.keys(room.p || {}).forEach(k => Object.assign(room.p[k], { sc: 0, ok: 0, last: null, bonus: 0, alive: room.p[k].online !== false, zone: null, out: null }));
        delete room.q; delete room.reveal;
        return setPhase(room, 'intro', { qi: -1 });
      });
    }
    function ask(index) {
      tx(room => {
        if (!room || room.meta.host !== me.k) return;
        const m = room.meta, set = questions(m), q = set.list[index];
        if (!q) return setPhase(room, 'end');
        room.q = { t: String(q.q || ''), n: index + 1, tot: set.list.length };
        delete room.reveal;
        Object.keys(room.p || {}).forEach(k => { room.p[k].zone = null; room.p[k].last = null; });
        const now = ctx.svNow();
        return setPhase(room, 'ask', { qi: index, startedAt: now, tEnd: now + m.sec * 1000 });
      });
    }
    function reveal() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase !== 'ask') return;
        const m = room.meta, set = questions(m), q = set.list[m.qi]; if (!q) return;
        const correct = answerOX(q.a), players = onlinePlayers(room), alive = players.filter(p => p.alive !== false);
        const wrong = alive.filter(p => p.zone !== correct), revived = !!alive.length && wrong.length === alive.length;
        players.forEach(p => {
          const rec = room.p[p.k], right = p.zone === correct;
          rec.last = right ? 'o' : p.zone ? 'x' : 'none';
          if (p.alive === false) return;
          if (right) {
            rec.sc = (rec.sc || 0) + 100; rec.ok = (rec.ok || 0) + 1;
            if (m.teacher) reward(rec, m.session + '_q' + m.qi, ctx.rules.livePerQ || 25, 1, 1);
          } else if (!revived) { rec.alive = false; rec.out = m.qi; if (m.teacher) reward(rec, m.session + '_q' + m.qi, 0, 1, 0); }
        });
        const answered = players.filter(p => p.zone).length, right = players.filter(p => p.zone === correct).length;
        room.reveal = { a: correct, qi: m.qi, out: revived ? 0 : wrong.length, revived, rate: answered ? Math.round(right / answered * 100) : 0 };
        return setPhase(room, 'reveal');
      });
    }
    function finish() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase === 'end') return;
        if (room.meta.teacher) onlinePlayers(room).filter(p => p.alive !== false).forEach(p => { const bonus = (ctx.rules.liveRankBonus || [])[0] || 0; room.p[p.k].bonus = bonus; reward(room.p[p.k], room.meta.session + '_end', bonus, 0, 0); });
        return setPhase(room, 'end');
      });
    }
    function backToLobby() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase !== 'end') return;
        delete room.q; delete room.reveal;
        Object.keys(room.p || {}).forEach(k => { if (room.p[k].online === false) delete room.p[k]; else Object.assign(room.p[k], { alive: true, zone: null, last: null, out: null }); });
        return setPhase(room, 'lobby', { qi: -1 });
      });
    }
    function hostTick(room) {
      const m = room.meta, now = ctx.svNow();
      if (m.phase === 'intro' && now - m.phaseAt > INTRO_MS + 800) ask(0);
      else if (m.phase === 'ask' && now >= m.tEnd) reveal();
      else if (m.phase === 'reveal' && now - m.phaseAt > REVEAL_MS + 600) {
        const alive = onlinePlayers(room).filter(p => p.alive !== false).length;
        const over = (m.started || 0) >= 2 ? alive <= 1 : alive === 0;
        if (over || m.qi + 1 >= (room.q && room.q.tot || m.count)) finish(); else ask(m.qi + 1);
      } else if (m.phase === 'end' && now - m.phaseAt > END_MS) backToLobby();
    }

    /* My zone follows where I stand while the question is open. */
    function trackZone() {
      const room = session.room, m = room && room.meta; if (!m) return;
      const st = world.getState(); if (!st) return;
      const z = zoneAt(st);
      chalk && chalk.classList.toggle('mine-o', z === 'o' && m.phase !== 'reveal');
      chalk && chalk.classList.toggle('mine-x', z === 'x' && m.phase !== 'reveal');
      if (m.phase !== 'ask' || ctx.svNow() > m.tEnd) return;
      if (S.zoneQi !== m.qi) { S.zoneQi = m.qi; S.zone = undefined; }
      if (z !== S.zone) { S.zone = z; session.ref.child('p/' + me.k).update({ zone: z, zt: ctx.svNow() }); }
    }
    q$('[data-board]').addEventListener('click', e => { if (e.target.closest('[data-start]')) startGame(); });
    q$('[data-chat-form]').onsubmit = e => { e.preventDefault(); const input = e.target.querySelector('input'); session.say(input.value); input.value = ''; world.focus && world.focus(); };

    function paintBoard(room) {
      const m = room.meta, players = onlinePlayers(room), mineRec = room.p && room.p[me.k], out = mineRec && mineRec.alive === false && m.phase !== 'lobby';
      const where = zoneAt(world.getState() || {});
      let html = '';
      if (m.phase === 'lobby') {
        html = `<p class="qq-board-kicker">[대기 중] 운동장에 ${players.length}명이 모였어요</p><h3>방향키로 걸어 다니며 기다려요.</h3>
          <p class="qq-board-note">${esc(ctx.setTitle(m.setId))} · ${m.count}문제 · ${m.sec}초 안에 O 또는 X 구역으로</p>
          ${isHost() ? '<button class="btn y big" data-start>시작하기</button>' : '<p class="qq-board-wait">' + esc(m.hostName) + '님이 시작하면 시작해요…</p>'}`;
      } else if (m.phase === 'intro') {
        html = '<p class="qq-board-kicker">서바이벌 OX에 오신 것을 환영해요!</p><h3>맞으면 흙마당의 O, 틀리면 축구장의 X로 걸어가요.</h3><p class="qq-board-note">틀리면 관중석으로! 끝까지 살아남으면 우승이에요</p>';
      } else if (m.phase === 'ask' && room.q) {
        const status = out ? '관중석에서도 계속 맞혀 볼 수 있어요' : where === 'o' ? 'O 구역에 서 있어요' : where === 'x' ? 'X 구역에 서 있어요' : '아직 구역 밖이에요!';
        html = `<p class="qq-board-kicker">[문제 ${room.q.n}] <span>${room.q.n} / ${room.q.tot}</span></p><h3 class="qq-question">${esc(room.q.t)}</h3>
          <p class="qq-ox-rule">맞으면 <b class="o">O</b> · 틀리면 <b class="x">X</b></p><p class="qq-ox-status ${out ? 'out' : where || 'none'}">${status}</p>`;
      } else if (m.phase === 'reveal' && room.q && room.reveal) {
        const r = room.reveal;
        html = `<p class="qq-board-kicker">[문제 ${room.q.n}] ${esc(room.q.t)}</p><p class="qq-board-result">[정답] <b class="qq-ox-answer ${r.a}">${r.a === 'o' ? 'O' : 'X'}</b> <small>우리 방 정답률 ${r.rate}%</small></p>
          <p class="qq-board-note">${r.revived ? '모두 틀려서 모두 살아남았어요! 다시 도전!' : r.out ? r.out + '명이 관중석으로 가요' : '모두 살아남았어요!'}</p>`;
      } else if (m.phase === 'end') {
        const winners = players.filter(p => p.alive !== false).slice(0, 5);
        html = `<p class="qq-board-kicker">끝까지 살아남은 친구</p><div class="qq-podium">${winners.map((p, i) => `<div class="qq-podium-${Math.min(3, i + 1)}"><div class="qq-avatar">${ctx.avatarSVG(p.av || {}, 70, 3)}</div><b>${esc(p.name)}</b><small>${p.sc || 0}점</small></div>`).join('') || '<p class="qq-board-note">이번에는 모두 관중석에서 응원했어요</p>'}</div>
          <p class="qq-board-note">잠시 뒤 다시 모여요${m.teacher && mineRec && mineRec.bonus ? ' · 우승 보너스 ' + mineRec.bonus + '골드' : ''}</p>`;
      }
      const board = q$('[data-board]'); if (board.dataset.html !== html) { board.innerHTML = html; board.dataset.html = html; }
    }
    function paintTally(room) {
      const m = room.meta, alive = onlinePlayers(room).filter(p => p.alive !== false), tally = q$('[data-tally]');
      tally.hidden = !(m.phase === 'ask' || m.phase === 'reveal');
      tally.querySelector('.o b').textContent = alive.filter(p => p.zone === 'o').length;
      tally.querySelector('.x b').textContent = alive.filter(p => p.zone === 'x').length;
    }
    function paintRank(room) {
      const rows = onlinePlayers(room).sort((a, b) => (b.alive !== false) - (a.alive !== false) || (b.sc || 0) - (a.sc || 0));
      q$('[data-alive]').textContent = rows.filter(p => p.alive !== false).length + '명';
      const html = rows.map(p => `<li class="${p.k === me.k ? 'me' : ''} ${p.alive === false ? 'out' : ''}"><i>${p.alive === false ? '관' : '♥'}</i><b>${esc(p.name)}</b><span>${p.sc || 0}</span></li>`).join('');
      const list = q$('[data-rank]'); if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
    }
    function phaseEffects(room) {
      const m = room.meta, key = m.session + '_' + m.phase + '_' + m.qi;
      if (key === S.lastPhaseKey) return;
      S.lastPhaseKey = key;
      root.dataset.phase = m.phase;
      if (chalk) { chalk.classList.remove('win-o', 'win-x', 'fail-o', 'fail-x'); }
      ctx.sound?.gameState?.({ phase: m.phase === 'intro' ? 'ask' : m.phase, qi: 0, session: m.session, mode: 'ox' });
      if (m.phase === 'intro') replay(q$('[data-splash]'), 'qq-splash', ctx.candy([{ text: '서바이벌 ' }, { text: 'OX', variant: 'sky' }], { label: '서바이벌 OX' }));
      if (m.phase === 'end') replay(q$('[data-splash]'), 'qq-splash', ctx.candy('생존 성공!'));
      if (m.phase === 'reveal' && room.reveal) {
        const a = room.reveal.a, wrongZone = a === 'o' ? 'x' : 'o';
        if (chalk) { chalk.classList.add('win-' + a); if (!room.reveal.revived) chalk.classList.add('fail-' + wrongZone); }
        const p = room.p && room.p[me.k];
        if (p && (p.last === 'o' || p.last === 'x')) {
          replay(q$('[data-stamp]'), 'qq-stamp ' + p.last, p.last === 'o' ? ART.o : ART.x);
          if (p.last === 'o') ctx.sound?.ok?.(); else ctx.sound?.no?.();
          if (!m.teacher && !ctx.isTeacher) {
            const claim = 'qqox_' + m.session + '_' + m.qi;
            if (!S.selfPaid.has(claim)) { S.selfPaid.add(claim); ctx.rewardPractice(p.last === 'o', claim).catch(() => {}); }
          }
        }
        if (p && p.alive === false && p.out === m.qi && S.sentOff !== m.session + '_' + m.qi) {
          S.sentOff = m.session + '_' + m.qi;
          setTimeout(() => { world.moveTo && world.moveTo(OX.stands.x + (Math.random() - .5) * 160, OX.stands.y + (Math.random() - .5) * 60); ctx.toast('관중석에서 계속 맞혀 봐요!'); }, 1600);
        }
      }
    }
    /* Marks above heads (O/X at the reveal, a 관중 tag for spectators). */
    function paintMarks() {
      const room = session.room, m = room && room.meta, layer = q$('[data-marks]');
      if (!m) return;
      const st = world.getState(); if (!st || !st.camera) return;
      const cam = st.camera, scale = cam.scale || OX.camera.zoom;
      const spots = [{ uid: me.k, x: st.x, y: st.y }].concat(S.roster.filter(p => p.uid !== me.k).map(p => ({ uid: p.uid, x: p.x, y: p.y })));
      let html = '';
      spots.forEach(s => {
        const rec = room.p && room.p[s.uid]; if (!rec || !Number.isFinite(s.x)) return;
        const left = (s.x - cam.x) * scale, top = (s.y - cam.y) * scale - 112;
        if (m.phase === 'reveal' && (rec.last === 'o' || rec.last === 'x')) html += `<span class="qq-ox-mark" style="left:${left.toFixed(0)}px;top:${top.toFixed(0)}px">${rec.last === 'o' ? ART.o : ART.x}</span>`;
        else if (rec.alive === false && m.phase !== 'lobby') html += `<span class="qq-ox-tag" style="left:${left.toFixed(0)}px;top:${(top + 18).toFixed(0)}px">관중</span>`;
      });
      if (layer.dataset.html !== html) { layer.innerHTML = html; layer.dataset.html = html; }
    }
    function render(room) {
      paintBoard(room); paintTally(room); paintRank(room); roomChat(q$('[data-chat]'), room, me); tickClock(root, room.meta, ctx, S); phaseEffects(room);
    }
    let raf = 0, last = 0;
    const loop = now => {
      raf = requestAnimationFrame(loop);
      if (now - last < 120) return; last = now;
      trackZone(); paintMarks();
      const room = session.room; if (room && room.meta) { tickClock(root, room.meta, ctx, S); if (room.meta.phase === 'ask') paintBoard(room); }
    };
    raf = requestAnimationFrame(loop);
    return {
      destroy() { cancelAnimationFrame(raf); if (window.QPQuizQuiz.active && window.QPQuizQuiz.active.world === world) window.QPQuizQuiz.active = null; session.destroy(); try { world.destroy(); } catch (e) {} presence.disconnect && presence.disconnect(); }
    };
  }

  /* Opens the stage or the OX playground depending on the room. */
  function mountAnyRoom(container, ctx, roomId) {
    let view = null, gone = false;
    refs(ctx).rooms.child(roomId).child('meta').once('value').then(snap => {
      if (gone) return;
      const m = snap && snap.val();
      if (!m) { ctx.toast('방이 닫혔어요. 로비로 돌아가요.'); ctx.go('quizquiz'); return; }
      view = m.mode === 'ox' && ctx.oxScene ? mountOxRoom(container, ctx, roomId) : mountRoom(container, ctx, roomId);
    }).catch(e => { console.error('QUIZQUIZ room failed to open', e); if (!gone) { ctx.toast('방을 열지 못했어요. 로비로 돌아가요.'); ctx.go('quizquiz'); } });
    return { destroy() { gone = true; view && view.destroy(); } };
  }

  window.QPQuizQuiz = { mountLobby, mountRoom: mountAnyRoom, stageChoices, MODES, zoneAt, answerOX };
})();
