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

  /* ───────────────────────────── Lobby ─────────────────────────────
     QPlay channel lobby (디자인기준/27): room cards in two columns with their
     buttons underneath, the user list top right, my card bottom right and the
     channel chat along the bottom. */
  const head = (ctx, av) => '<i class="qq-head" aria-hidden="true">' + ctx.avatarSVG(av || {}, 70, 1) + '</i>';

  function mountLobby(container, ctx) {
    const R = refs(ctx), me = ctx.me, subs = [];
    const S = { list: {}, chat: {}, online: {}, filter: 'all', page: 0 };
    let destroyed = false;
    const PER = 8;
    container.innerHTML = `<div class="qq-lobby">${ambient(8)}
      <section class="qq-rooms" aria-labelledby="qqRoomsTitle"><span class="qq-channel">${ctx.isTeacher ? '선생님' : '3학년 3반'} 채널</span>
        <h2 class="sr-only" id="qqRoomsTitle">대기실 목록</h2>
        <div class="qq-room-grid" id="qqRoomGrid"></div>
        <div class="qq-pager"><button class="qq-arrow" id="qqPrev" aria-label="이전 방 목록">▲</button><span id="qqPage"></span><button class="qq-arrow" id="qqNext" aria-label="다음 방 목록">▼</button></div>
        <div class="qq-room-actions">
          <button class="btn qq-make" id="qqCreate"><svg class="qq-bico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4l9-2v19z" fill="#ffe08a" stroke="#0b2f74" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 4h5v17h-5" fill="#9ddcff" stroke="#0b2f74" stroke-width="1.6" stroke-linejoin="round"/><circle cx="11" cy="12.5" r="1.3" fill="#0b2f74"/></svg>방만들기</button><button class="btn y" id="qqQuick"><svg class="qq-bico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h9V4l9 8-9 8v-5H3z" fill="#fff6c8" stroke="#7a2a03" stroke-width="1.6" stroke-linejoin="round"/></svg>바로시작</button>
          <div class="qq-filter" role="group" aria-label="게임 종류">${[['all', '전체보기'], ['stage', '무대 QUIZ'], ['ox', '서바이벌 OX']].map(([k, t]) => '<button class="qq-chip' + (k === 'all' ? ' on' : '') + '" data-filter="' + k + '" aria-pressed="' + (k === 'all') + '">' + t + '</button>').join('')}</div>
        </div>
      </section>
      <section class="qq-users" aria-labelledby="qqUsersTitle">
        <div class="qq-utabs"><span class="qq-utab">우리 반</span><span class="qq-utab on" id="qqUsersTitle">대기실 <b id="qqOnlineCount"></b></span></div>
        <div class="qq-uhead"><span>상태</span><span>아이디</span><span>점수</span></div>
        <ul class="qq-online-list" id="qqOnline"></ul>
        <div class="qq-banner" aria-hidden="true"><svg viewBox="23 35.4 10.6 12">${ctx.pet ? ctx.pet('dino', '#5fbf3f') : ''}</svg><b>${ctx.candy([{ text: 'QUIZ', variant: 'sky' }, ' 한 판?'], { className: 'ct-small', label: '퀴즈 한 판?' })}</b><svg viewBox="23 35.4 10.6 12">${ctx.pet ? ctx.pet('rabbit', '#f28ac0') : ''}</svg></div>
      </section>
      <section class="qq-mecard" aria-label="내 정보">
        <div class="qq-me-pic">${ctx.avatarSVG(me.av, 132, 3)}</div>
        <div class="qq-me-info"><b class="qq-me-name">${esc(me.name)}</b>
          <dl><dt>${ctx.isTeacher ? '역할' : '골드'}</dt><dd>${ctx.isTeacher ? '선생님' : (me.gold || 0).toLocaleString()}</dd>
          <dt>오늘 연습</dt><dd>${ctx.isTeacher ? '-' : Math.max(0, me.daily || 0) + ' / ' + (me.cap || 300)}</dd></dl></div>
      </section>
      <section class="qq-chatbox" aria-label="로비 채팅">
        <div class="qq-chat-log" id="qqChatLog" role="log" aria-live="polite"></div>
        <form class="qq-chat-form" id="qqChatForm"><span class="qq-to">모두에게</span><input class="inp" id="qqChatIn" maxlength="60" autocomplete="off" placeholder="친구들에게 한마디" aria-label="로비 채팅"><button class="btn sm">보내기</button></form>
      </section></div>`;
    const el = id => container.querySelector('#' + id);

    function rooms() {
      const now = ctx.svNow();
      return Object.keys(S.list).map(id => Object.assign({ id }, S.list[id])).filter(r => r && r.title && now - (r.t || 0) < LIST_STALE)
        .sort((a, b) => (b.teacher ? 1 : 0) - (a.teacher ? 1 : 0) || (a.created || 0) - (b.created || 0));
    }
    function card(r, no) {
      const full = (r.n || 0) >= (r.max || MAX), playing = r.phase && r.phase !== 'lobby';
      return `<button class="qq-room mode-${esc(r.mode)} ${playing ? 'playing' : 'waiting'} ${r.teacher ? 'teacher' : ''}" data-room="${esc(r.id)}" ${full ? 'disabled' : ''} aria-label="${esc(r.title)}, ${esc(MODES[r.mode]?.name || '')}, ${r.n || 0}명, ${playing ? '게임 중' : '기다리는 중'}">
        <span class="qq-room-no">${pad3(no)}</span><span class="qq-room-mode">${esc(MODES[r.mode]?.short || '')}</span>
        <span class="qq-room-state">${playing ? 'PLAYING' : 'WAITING'}</span><span class="qq-room-n">${r.n || 0}/${r.max || MAX}</span>
        <b class="qq-room-title">${r.teacher ? '<i class="qq-tstar" aria-hidden="true">★</i>' : ''}${esc(r.title)}</b></button>`;
    }
    function paintRooms() {
      const all = rooms(), list = all.filter(r => S.filter === 'all' || r.mode === S.filter), grid = el('qqRoomGrid');
      const pages = Math.max(1, Math.ceil(list.length / PER)); S.page = Math.min(S.page, pages - 1);
      const shown = list.slice(S.page * PER, S.page * PER + PER);
      let html = shown.map(r => card(r, all.indexOf(r) + 1)).join('');
      for (let i = shown.length; i < PER; i++) html += '<div class="qq-room empty" aria-hidden="true"><span class="qq-room-no">---</span></div>';
      grid.innerHTML = html;
      el('qqPage').textContent = (S.page + 1) + '/' + pages;
      el('qqPrev').disabled = S.page === 0; el('qqNext').disabled = S.page >= pages - 1;
      grid.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { ctx.sound?.click?.(); ctx.go('qqroom', b.dataset.room); });
    }
    el('qqPrev').onclick = () => { S.page = Math.max(0, S.page - 1); paintRooms(); };
    el('qqNext').onclick = () => { S.page++; paintRooms(); };
    container.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
      S.filter = b.dataset.filter; S.page = 0;
      container.querySelectorAll('[data-filter]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      paintRooms();
    });
    function paintOnline() {
      const now = ctx.svNow(), people = Object.keys(S.online).map(k => Object.assign({ k }, S.online[k])).filter(p => p && now - (p.t || 0) < ONLINE_TTL)
        .sort((a, b) => (b.teacher ? 1 : 0) - (a.teacher ? 1 : 0) || String(a.name).localeCompare(String(b.name), 'ko'));
      el('qqOnlineCount').textContent = people.length + '명';
      const html = people.map(p => '<li class="' + (p.k === me.k ? 'me' : '') + '"><i class="qq-dot ' + (p.where && p.where !== 'lobby' ? 'busy' : '') + '" title="' + (p.where && p.where !== 'lobby' ? '게임 중' : '대기실') + '"></i>' + head(ctx, p.av) + '<b>' + esc(p.name) + '</b>' + (p.teacher ? '<span class="qq-tag teacher">선생님</span>' : '<span>' + (p.where && p.where !== 'lobby' ? '게임 중' : '대기') + '</span>') + '</li>').join('');
      const list = el('qqOnline'); if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
    }
    function paintChat() {
      const log = el('qqChatLog'), lines = Object.keys(S.chat).map(k => S.chat[k]).filter(Boolean).sort((a, b) => (a.t || 0) - (b.t || 0)).slice(-40);
      log.innerHTML = '<p class="qq-chat-hint">[알림] QUIZQUIZ 대기실에 오신 것을 환영해요! 방을 고르거나 방만들기를 눌러요.</p>'
        + Object.keys(S.online).filter(k => k !== me.k).slice(0, 3).map(k => '<p class="qq-chat-hint">[알림] ' + esc(S.online[k].name) + '님 입장</p>').join('')
        + lines.map(m => '<p class="' + (m.k === me.k ? 'me' : '') + '"><b>[' + esc(m.name) + ']</b> ' + esc(m.text) + '</p>').join('');
      log.scrollTop = log.scrollHeight;
    }
    const sub = (ref, fn) => { const h = ref.on('value', snap => { if (!destroyed) fn(snap.val() || {}); }); subs.push(() => ref.off('value', h)); };
    sub(R.list, v => { S.list = v; paintRooms(); });
    sub(R.chat, v => { S.chat = v; paintChat(); });
    sub(R.online, v => { S.online = v; paintOnline(); paintChat(); });
    const here = () => R.online.child(me.k).set({ name: me.name, av: ctx.publicAvatar(me.av), t: ctx.svNow(), where: 'lobby', teacher: !!ctx.isTeacher }).catch(() => {});
    here(); R.online.child(me.k).onDisconnect().remove();
    const beat = setInterval(() => { here(); paintRooms(); paintOnline(); cleanupStale(); }, 15000);
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
    return { destroy() { destroyed = true; subs.forEach(f => f()); clearInterval(beat); R.online.child(me.k).remove().catch(() => {}); } };
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
     A one-screen forest arena after QPlay's Survival OX: an O stump on the left,
     a ? clearing in the middle, an X stump on the right and log benches for
     those who are out. Click or use the arrow keys to walk; when time is up,
     a wooden lid slams onto the wrong stump. Positions sync through the room. */
  const ARENA = { w: 1000, h: 600, field: { x0: 40, x1: 960, y0: 70, y1: 450 }, bench: { x0: 120, x1: 880, y0: 520, y1: 566 },
    o: { x: 215, y: 270, r: 132 }, x: { x: 785, y: 270, r: 132 }, mid: { x: 500, y: 280 }, speed: 300 };
  const zoneAt = pt => {
    const d = (c) => Math.hypot(pt.x - c.x, (pt.y - c.y) * 1.25);
    return d(ARENA.o) <= ARENA.o.r ? 'o' : d(ARENA.x) <= ARENA.x.r ? 'x' : null;
  };
  const answerOX = a => /^(o|ㅇ|맞)/i.test(String(a == null ? '' : a).trim()) ? 'o' : 'x';
  const STUMP = mark => `<svg viewBox="0 0 300 260" aria-hidden="true">
    <ellipse cx="150" cy="162" rx="148" ry="96" fill="#2c1a08" opacity=".3"/>
    <path d="M6 128v24c0 56 64 96 144 96s144-40 144-96v-24z" fill="#7a4a22" stroke="#3b2510" stroke-width="5"/>
    <g stroke="#4a2c10" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75"><path d="M30 150q4 34 8 58M62 160q2 36 4 66M100 166q0 34-2 70M150 168v76M196 166q2 36 0 70M238 160q-2 34-6 64M270 150q-4 30-10 54"/></g>
    <g stroke="#a8703a" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"><path d="M46 156q2 30 6 52M128 166q2 32 0 66M216 164q0 30-4 60"/></g>
    <path d="M18 150q20 30 40 34q-6 22 -26 8z" fill="#5aa02a" stroke="#2f5e22" stroke-width="3"/>
    <path d="M236 182q24-6 40-34q8 26-12 40z" fill="#7cc23e" stroke="#2f5e22" stroke-width="3"/>
    <ellipse cx="150" cy="128" rx="146" ry="102" fill="#9a6431" stroke="#3b2510" stroke-width="5"/>
    <path d="M150 34c70 0 128 38 128 92s-56 94-128 94S22 180 22 126 80 34 150 34z" fill="#e8bd84" stroke="#8a5a2b" stroke-width="4"/>
    <g fill="none" stroke="#c08546" stroke-width="3" opacity=".85"><path d="M150 56c56 0 104 30 104 70s-46 74-104 74-104-32-104-74 48-70 104-70z"/><path d="M150 78c42 2 78 22 78 50s-34 52-78 52-80-22-80-52 38-50 80-50z"/><path d="M152 100c26 0 50 12 50 28s-22 32-50 32-52-14-52-32 24-28 52-28z"/></g>
    <path d="M150 128l-48 58M150 128l64 34" stroke="#8a5a2b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M44 94q36-38 100-46" stroke="#fff6e2" stroke-width="6" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="M226 46q30 6 42 30q-26 6-42-30z" fill="#7cc23e" stroke="#2f5e22" stroke-width="3"/><circle cx="254" cy="60" r="5" fill="#ffd84a" stroke="#8a5a10" stroke-width="2"/>
    ${mark.replace('<svg ', '<svg x="88" y="78" width="124" height="96" preserveAspectRatio="none" ')}</svg>`;
  const LID = `<svg viewBox="0 0 300 260" aria-hidden="true"><ellipse cx="150" cy="150" rx="150" ry="110" fill="#2c1a08" opacity=".35"/>
    <ellipse cx="150" cy="130" rx="148" ry="104" fill="#c98e4f" stroke="#3b2510" stroke-width="6"/>
    <g stroke="#7a4a22" stroke-width="4"><path d="M64 44v172M106 30v200M150 26v208M194 30v200M236 44v172"/></g>
    <g stroke="#a8703a" stroke-width="2.5" fill="none" opacity=".8"><path d="M78 70q8 30 0 60t4 60M122 52q-8 40 2 80t-4 70M170 50q10 36 0 76t6 78M214 66q-8 34 2 64t-4 60"/><ellipse cx="88" cy="150" rx="6" ry="10"/><ellipse cx="206" cy="96" rx="5" ry="8"/></g>
    <ellipse cx="150" cy="130" rx="148" ry="104" fill="none" stroke="#5f5c58" stroke-width="13"/><ellipse cx="150" cy="130" rx="148" ry="104" fill="none" stroke="#b5b0a6" stroke-width="4"/>
    <g fill="#3b3936"><circle cx="20" cy="130" r="5"/><circle cx="280" cy="130" r="5"/><circle cx="150" cy="28" r="5"/><circle cx="150" cy="232" r="5"/></g>
    <path d="M56 80q40-44 110-48" stroke="#fff3d6" stroke-width="7" fill="none" stroke-linecap="round" opacity=".5"/><rect x="124" y="114" width="52" height="20" rx="7" fill="#5f5c58" stroke="#2c1a08" stroke-width="3"/></svg>`;
  /* Painted flowers, grass and stones from the supplied grass sheets ring the pit
     (assets/ox-arena, cut by tools/build-ox-arena-props.cjs). [id, x, y, scale, sway] */
  // The question board covers the top middle, so the rim is dressed at the corners, sides and front.
  const RIM = [['tuft-13', 50, 86, .38, 1], ['daisy-2', 130, 66, .36, 1], ['redflower-6', 900, 70, .36, 1], ['daisy-1', 960, 104, .36, 1],
    ['rock-8', 6, 236, .36, 0], ['bush-14', 22, 392, .36, 1], ['flower-0', -6, 300, .3, 1], ['rock-11', 994, 250, .36, 0], ['tuft-12', 982, 404, .38, 1], ['clover-17', 1004, 330, .3, 0],
    ['rock-7', 70, 512, .34, 0], ['clover-18', 168, 490, .34, 0], ['bush-16', 300, 508, .26, 0], ['daisy-2', 700, 506, .28, 1], ['bush-15', 846, 490, .34, 1], ['rock-10', 950, 512, .34, 0]];
  function rimProps() {
    const atlas = window.QPOxProps; if (!atlas) return '';
    const byId = Object.fromEntries(atlas.props.map(p => [p.id, p.r]));
    return RIM.map(([id, x, y, k, sway], i) => {
      const r = byId[id]; if (!r) return '';
      const w = r[2] * k, h = r[3] * k;
      return '<i class="qq-prop' + (sway ? ' sway' : '') + '" style="left:' + (x - w / 2).toFixed(1) + 'px;top:' + (y - h).toFixed(1) + 'px;width:' + w.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px;z-index:' + y + ';'
        + 'background-size:' + (atlas.size[0] * k).toFixed(1) + 'px ' + (atlas.size[1] * k).toFixed(1) + 'px;background-position:' + (-r[0] * k).toFixed(1) + 'px ' + (-r[1] * k).toFixed(1) + 'px;animation-delay:-' + (i * .7 % 4).toFixed(1) + 's"></i>';
    }).join('');
  }
  const BUTTERFLY = '<svg viewBox="0 0 40 30" aria-hidden="true"><g class="w"><path d="M20 15C12 2 2 4 4 12s10 6 16 3z" fill="#ffd84a" stroke="#8a5a10" stroke-width="2"/><path d="M20 15c-6 4-14 6-12 12s10 0 12-12z" fill="#ffb15c" stroke="#8a5a10" stroke-width="2"/></g><g class="w r"><path d="M20 15c8-13 18-11 16-3s-10 6-16 3z" fill="#ffd84a" stroke="#8a5a10" stroke-width="2"/><path d="M20 15c6 4 14 6 12 12s-10 0-12-12z" fill="#ffb15c" stroke="#8a5a10" stroke-width="2"/></g><path d="M20 8v16" stroke="#4a2c10" stroke-width="2.5" stroke-linecap="round"/></svg>';

  function mountOxRoom(container, ctx, roomId) {
    const me = ctx.me;
    const S = { lastPhaseKey: '', lastHurry: '', selfPaid: new Set(), pos: { x: ARENA.mid.x + (Math.random() - .5) * 160, y: ARENA.mid.y + 80 + (Math.random() - .5) * 60 },
      target: null, keys: new Set(), facing: 1, moving: false, lastSent: 0, sentPos: '', nodes: new Map(), sentOff: '', zone: undefined, zoneQi: null };
    container.innerHTML = `<div class="qq-ox" data-phase="lobby">${ambient(10)}
      <section class="qq-board qq-ox-board" data-board aria-live="polite"></section>
      <div class="qq-ox-tally" data-tally><span class="o">O</span><b data-o>00</b><i>vs</i><b data-x>00</b><span class="x">X</span></div>
      ${hudClock}
      <div class="qq-arena-wrap" data-wrap><div class="qq-arena" data-arena tabindex="0" aria-label="OX 경기장. 방향키나 마우스로 걸어가요">
        <div class="qq-pit"></div>
        <div class="qq-stump o" data-stump="o">${STUMP(ART.o)}<div class="qq-lid">${LID}</div><div class="qq-dust">${'<i></i>'.repeat(6)}</div></div>
        <div class="qq-stump x" data-stump="x">${STUMP(ART.x)}<div class="qq-lid">${LID}</div><div class="qq-dust">${'<i></i>'.repeat(6)}</div></div>
        <div class="qq-qmark">${ctx.candy('?', { label: '고민 구역' })}</div>
        <div class="qq-bench"><span class="qq-bench-sign">${ctx.candy('관중석', { className: 'ct-small' })}</span><span class="qq-bench-guess o">O 찍기</span><span class="qq-bench-guess x">X 찍기</span></div>
        <div class="qq-actors" data-actors>${rimProps()}</div><span class="qq-fly-b b1">${BUTTERFLY}</span><span class="qq-fly-b b2">${BUTTERFLY}</span></div></div>
      <aside class="qq-win qq-rank qq-ox-rank"><header class="qq-win-h"><h2>살아남은 친구</h2><span class="qq-count" data-alive></span></header><ol data-rank></ol></aside>
      ${hudChat}<div class="qq-stamp" data-stamp aria-hidden="true"></div><div class="qq-splash" data-splash aria-hidden="true"></div></div>`;
    const root = container.querySelector('.qq-ox'), q$ = s => container.querySelector(s), arena = q$('[data-arena]'), wrap = q$('[data-wrap]');
    const session = roomSession(ctx, roomId, { onRoom: render, onHostTick: hostTick });
    const { tx, setPhase, reward, questions, isHost } = session;
    const mine = () => session.room && session.room.p && session.room.p[me.k];
    const out = () => { const p = mine(), m = session.meta(); return !!(p && p.alive === false && m && m.phase !== 'lobby'); };

    /* Fit the 1000×600 arena into the space left under the board. */
    function fit() {
      const r = wrap.getBoundingClientRect(), k = Math.min(r.width / ARENA.w, r.height / ARENA.h);
      arena.style.transform = `translate(${((r.width - ARENA.w * k) / 2).toFixed(1)}px, ${((r.height - ARENA.h * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`;
      S.scale = k;
    }
    const ro = new ResizeObserver(fit); ro.observe(wrap); fit();

    /* Host: phases and judging. */
    function startGame() {
      tx(room => {
        if (!room || room.meta.host !== me.k || room.meta.phase !== 'lobby') return;
        const now = ctx.svNow();
        Object.assign(room.meta, { session: 's' + now.toString(36), seed: (now & 0x7fffffff) || 1, started: onlinePlayers(room).length });
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
        Object.keys(room.p || {}).forEach(k => { room.p[k].last = null; });
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
        const answered = alive.filter(p => p.zone).length, right = alive.filter(p => p.zone === correct).length;
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
      else if (m.phase === 'reveal' && now - m.phaseAt > REVEAL_MS + 1200) {
        const alive = onlinePlayers(room).filter(p => p.alive !== false).length;
        const over = (m.started || 0) >= 2 ? alive <= 1 : alive === 0;
        if (over || m.qi + 1 >= (room.q && room.q.tot || m.count)) finish(); else ask(m.qi + 1);
      } else if (m.phase === 'end' && now - m.phaseAt > END_MS) backToLobby();
    }

    /* Walking: click a spot or hold the arrow keys. Spectators stay on the benches. */
    const clampTo = (p, box) => ({ x: Math.max(box.x0, Math.min(box.x1, p.x)), y: Math.max(box.y0, Math.min(box.y1, p.y)) });
    const area = () => out() ? ARENA.bench : ARENA.field;
    function toArena(e) { const r = arena.getBoundingClientRect(); return { x: (e.clientX - r.left) / S.scale, y: (e.clientY - r.top) / S.scale }; }
    arena.addEventListener('pointerdown', e => { if (e.button) return; S.target = clampTo(toArena(e), area()); arena.focus({ preventScroll: true }); });
    const KEYS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };
    function onKeyDown(e) {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (KEYS[e.code]) { e.preventDefault(); S.keys.add(e.code); S.target = null; }
    }
    function onKeyUp(e) { S.keys.delete(e.code); }
    const onBlur = () => S.keys.clear();
    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);
    q$('[data-board]').addEventListener('click', e => { if (e.target.closest('[data-start]')) startGame(); });
    q$('[data-chat-form]').onsubmit = e => { e.preventDefault(); const input = e.target.querySelector('input'); session.say(input.value); input.value = ''; arena.focus({ preventScroll: true }); };

    function step(dt) {
      let dx = 0, dy = 0;
      for (const k of S.keys) { dx += KEYS[k][0]; dy += KEYS[k][1]; }
      if (!dx && !dy && S.target) {
        const vx = S.target.x - S.pos.x, vy = S.target.y - S.pos.y, d = Math.hypot(vx, vy);
        if (d < 3) S.target = null; else { dx = vx / d; dy = vy / d; }
      }
      const len = Math.hypot(dx, dy);
      S.moving = len > 0;
      if (len) {
        const v = ARENA.speed * dt / len;
        S.pos = clampTo({ x: S.pos.x + dx * v, y: S.pos.y + dy * v }, area());
        if (Math.abs(dx) > .1) S.facing = dx < 0 ? -1 : 1;
      } else S.pos = clampTo(S.pos, area());
      const now = performance.now(), key = Math.round(S.pos.x) + ',' + Math.round(S.pos.y) + ',' + (S.moving ? 1 : 0) + ',' + S.facing;
      if (key !== S.sentPos && now - S.lastSent > 150) {
        S.sentPos = key; S.lastSent = now;
        const m = session.meta(), z = out() ? (S.pos.x < 500 ? 'o' : 'x') : zoneAt(S.pos);
        const patch = { x: Math.round(S.pos.x), y: Math.round(S.pos.y), mv: S.moving ? 1 : 0, f: S.facing };
        if (m && m.phase === 'ask' && ctx.svNow() <= m.tEnd) { patch.zone = z; patch.zt = ctx.svNow(); }
        session.ref.child('p/' + me.k).update(patch);
      }
    }
    /* Make sure the last spot before the bell is what gets judged. */
    function sendZoneNow() {
      const m = session.meta(); if (!m || m.phase !== 'ask') return;
      if (S.zoneQi !== m.qi) { S.zoneQi = m.qi; S.zone = undefined; }
      const z = out() ? (S.pos.x < 500 ? 'o' : 'x') : zoneAt(S.pos);
      if (z !== S.zone && ctx.svNow() <= m.tEnd) { S.zone = z; session.ref.child('p/' + me.k).update({ zone: z, zt: ctx.svNow() }); }
    }

    /* Actors: everyone in the room, with name plates, chat bubbles and marks. */
    function paintActors(dt) {
      const room = session.room; if (!room || !room.meta) return;
      const m = room.meta, players = onlinePlayers(room), box = q$('[data-actors]'), seen = new Set();
      players.forEach(p => {
        seen.add(p.k);
        let n = S.nodes.get(p.k);
        if (!n) {
          const el = document.createElement('div'); el.className = 'qq-actor';
          el.innerHTML = '<span class="qq-say"></span><span class="qq-mark"></span><div class="qq-actor-body"></div><b class="qq-actor-name"></b>';
          box.appendChild(el);
          n = { el, x: Number.isFinite(p.x) ? p.x : ARENA.mid.x, y: Number.isFinite(p.y) ? p.y : ARENA.mid.y + 80, av: '' };
          S.nodes.set(p.k, n);
        }
        const self = p.k === me.k, avKey = JSON.stringify(p.av || {});
        if (n.av !== avKey) { n.el.querySelector('.qq-actor-body').innerHTML = ctx.avatarSVG(p.av || {}, 72, 3); n.av = avKey; }
        const tx2 = self ? S.pos.x : Number.isFinite(p.x) ? p.x : n.x, ty2 = self ? S.pos.y : Number.isFinite(p.y) ? p.y : n.y;
        const ease = self ? 1 : Math.min(1, dt * 10);
        n.x += (tx2 - n.x) * ease; n.y += (ty2 - n.y) * ease;
        const moving = self ? S.moving : !!p.mv && Math.hypot(tx2 - n.x, ty2 - n.y) > .5 || !!p.mv;
        const facing = self ? S.facing : (p.f || 1);
        n.el.style.transform = `translate(${n.x.toFixed(1)}px, ${n.y.toFixed(1)}px)`;
        n.el.style.zIndex = Math.round(n.y);
        n.el.classList.toggle('me', self);
        n.el.classList.toggle('walking', moving);
        n.el.classList.toggle('left', facing < 0);
        n.el.classList.toggle('spectator', p.alive === false && m.phase !== 'lobby');
        // Only while still standing on the losing stump; once on the benches they show again.
        const fall = m.phase === 'reveal' && room.reveal && !room.reveal.revived && p.out === m.qi && zoneAt(n) === (room.reveal.a === 'o' ? 'x' : 'o');
        n.el.classList.toggle('falling', !!fall);
        n.el.querySelector('.qq-actor-name').textContent = p.name || '';
        const state = m.phase === 'reveal' && (p.last === 'o' || p.last === 'x') ? p.last : '';
        if (n.el.dataset.mark !== state) { n.el.dataset.mark = state; n.el.querySelector('.qq-mark').innerHTML = state === 'o' ? ART.o : state === 'x' ? ART.x : ''; }
        const fresh = p.say && ctx.svNow() - (p.sayAt || 0) < 5000, b = n.el.querySelector('.qq-say');
        if (b.textContent !== (fresh ? p.say : '')) b.textContent = fresh ? p.say : '';
        b.classList.toggle('on', !!fresh);
      });
      for (const [k, n] of S.nodes) if (!seen.has(k)) { n.el.remove(); S.nodes.delete(k); }
    }

    function paintBoard(room) {
      const m = room.meta, players = onlinePlayers(room), rec = mine(), isOut = out(), where = zoneAt(S.pos);
      let html = '';
      if (m.phase === 'lobby') {
        html = `<p class="qq-board-kicker">[대기 중] 현재 ${players.length}명이 모였어요</p><h3>마우스로 누르거나 방향키로 걸어 다녀요.</h3>
          <p class="qq-board-note">${esc(ctx.setTitle(m.setId))} · ${m.count}문제 · ${m.sec}초 안에 O 또는 X 그루터기로</p>
          ${isHost() ? '<button class="btn y big" data-start>시작하기</button>' : '<p class="qq-board-wait">' + esc(m.hostName) + '님이 시작하면 시작해요…</p>'}`;
      } else if (m.phase === 'intro') {
        html = '<p class="qq-board-kicker">서바이벌 OX에 오신 것을 환영해요!</p><h3>맞으면 왼쪽 O, 틀리면 오른쪽 X 그루터기에 올라가요.</h3><p class="qq-board-note">틀리면 뚜껑이 쾅! 관중석으로 가요. 끝까지 살아남으면 우승이에요</p>';
      } else if (m.phase === 'ask' && room.q) {
        const status = isOut ? (S.pos.x < 500 ? '관중석에서 O를 찍었어요' : '관중석에서 X를 찍었어요') : where === 'o' ? 'O 그루터기에 올라섰어요' : where === 'x' ? 'X 그루터기에 올라섰어요' : '아직 고민 중이에요!';
        html = `<p class="qq-board-kicker">[문제 ${room.q.n}] <span>${room.q.n} / ${room.q.tot}</span></p><h3 class="qq-question">${esc(room.q.t)}</h3>
          <p class="qq-ox-rule">맞으면 <b class="o">O</b>, 틀리면 <b class="x">X</b>. <span class="qq-ox-status ${isOut ? 'out' : where || 'none'}">${status}</span></p>`;
      } else if (m.phase === 'reveal' && room.q && room.reveal) {
        const r = room.reveal;
        html = `<p class="qq-board-kicker">[문제 ${room.q.n}] ${esc(room.q.t)}</p><p class="qq-board-result">[정답] 정답은 <b class="qq-ox-answer ${r.a}">${r.a === 'o' ? 'O' : 'X'}</b> <small>정답률 ${r.rate}%</small></p>
          <p class="qq-board-note">${r.revived ? '모두 틀려서 모두 살아남았어요! 다시 도전!' : r.out ? r.out + '명이 관중석으로 가요' : '모두 살아남았어요!'}${rec && rec.out === m.qi && !r.revived ? ' · 관중석에서도 O·X를 계속 찍어 볼 수 있어요' : ''}</p>`;
      } else if (m.phase === 'end') {
        const winners = players.filter(p => p.alive !== false).slice(0, 5);
        html = `<p class="qq-board-kicker">끝까지 살아남은 친구</p><div class="qq-podium">${winners.map((p, i) => `<div class="qq-podium-${Math.min(3, i + 1)}"><div class="qq-avatar">${ctx.avatarSVG(p.av || {}, 62, 3)}</div><b>${esc(p.name)}</b><small>${p.sc || 0}점</small></div>`).join('') || '<p class="qq-board-note">이번에는 모두 관중석에서 응원했어요</p>'}</div>
          <p class="qq-board-note">잠시 뒤 다시 모여요${m.teacher && rec && rec.bonus ? ' · 우승 보너스 ' + rec.bonus + '골드' : ''}</p>`;
      }
      const board = q$('[data-board]'); if (board.dataset.html !== html) { board.innerHTML = html; board.dataset.html = html; }
    }
    function paintTally(room) {
      const alive = onlinePlayers(room).filter(p => p.alive !== false || room.meta.phase === 'lobby');
      const ask = room.meta.phase === 'ask' || room.meta.phase === 'reveal';
      const count = z => ask ? alive.filter(p => p.zone === z).length : 0;
      q$('[data-o]').textContent = String(count('o')).padStart(2, '0');
      q$('[data-x]').textContent = String(count('x')).padStart(2, '0');
    }
    function paintRank(room) {
      const rows = onlinePlayers(room).sort((a, b) => (b.alive !== false) - (a.alive !== false) || (b.sc || 0) - (a.sc || 0));
      q$('[data-alive]').textContent = rows.filter(p => p.alive !== false).length + '명';
      const html = rows.map(p => `<li class="${p.k === me.k ? 'me' : ''} ${p.alive === false && room.meta.phase !== 'lobby' ? 'out' : ''}"><i>${p.alive === false && room.meta.phase !== 'lobby' ? '관' : '♥'}</i><b>${esc(p.name)}</b><span>${p.sc || 0}</span></li>`).join('');
      const list = q$('[data-rank]'); if (list.dataset.html !== html) { list.innerHTML = html; list.dataset.html = html; }
    }
    function phaseEffects(room) {
      const m = room.meta, key = m.session + '_' + m.phase + '_' + m.qi;
      if (key === S.lastPhaseKey) return;
      S.lastPhaseKey = key;
      root.dataset.phase = m.phase;
      ctx.sound?.gameState?.({ phase: m.phase === 'intro' ? 'ask' : m.phase, qi: 0, session: m.session, mode: 'ox' });
      arena.classList.remove('lid-o', 'lid-x', 'win-o', 'win-x');
      if (m.phase === 'intro') replay(q$('[data-splash]'), 'qq-splash', ctx.candy([{ text: '서바이벌 ' }, { text: 'OX', variant: 'sky' }], { label: '서바이벌 OX' }));
      if (m.phase === 'end') replay(q$('[data-splash]'), 'qq-splash', ctx.candy('생존 성공!'));
      if (m.phase === 'lobby') { S.pos = clampTo(S.pos, ARENA.field); }
      if (m.phase === 'reveal' && room.reveal) {
        const a = room.reveal.a;
        arena.classList.add('win-' + a);
        if (!room.reveal.revived) setTimeout(() => arena.classList.add('lid-' + (a === 'o' ? 'x' : 'o')), 450);
        const p = mine();
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
          setTimeout(() => {
            S.target = null;
            S.pos = { x: ARENA.bench.x0 + 40 + Math.random() * (ARENA.bench.x1 - ARENA.bench.x0 - 80), y: (ARENA.bench.y0 + ARENA.bench.y1) / 2 };
          }, 1700);
        }
      }
    }
    function render(room) { paintBoard(room); paintTally(room); paintRank(room); roomChat(q$('[data-chat]'), room, me); tickClock(root, room.meta, ctx, S); phaseEffects(room); }

    let raf = 0, last = performance.now(), slow = 0;
    const loop = now => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      step(dt); paintActors(dt); sendZoneNow();
      if ((slow += dt) > .2) { slow = 0; const room = session.room; if (room && room.meta) { tickClock(root, room.meta, ctx, S); paintTally(room); if (room.meta.phase === 'ask') paintBoard(room); } }
    };
    raf = requestAnimationFrame(loop);
    setTimeout(() => arena.focus({ preventScroll: true }), 50);
    window.QPQuizQuiz.active = { pos: () => ({ ...S.pos }), walkTo: (x, y) => { S.target = clampTo({ x, y }, area()); }, zone: () => zoneAt(S.pos) };
    return {
      destroy() {
        cancelAnimationFrame(raf); ro.disconnect();
        document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
        window.QPQuizQuiz.active = null;
        session.destroy();
      }
    };
  }

  /* Opens the stage or the OX arena depending on the room. */
  function mountAnyRoom(container, ctx, roomId) {
    let view = null, gone = false;
    refs(ctx).rooms.child(roomId).child('meta').once('value').then(snap => {
      if (gone) return;
      const m = snap && snap.val();
      if (!m) { ctx.toast('방이 닫혔어요. 로비로 돌아가요.'); ctx.go('quizquiz'); return; }
      view = m.mode === 'ox' ? mountOxRoom(container, ctx, roomId) : mountRoom(container, ctx, roomId);
    }).catch(e => { console.error('QUIZQUIZ room failed to open', e); if (!gone) { ctx.toast('방을 열지 못했어요. 로비로 돌아가요.'); ctx.go('quizquiz'); } });
    return { destroy() { gone = true; view && view.destroy(); } };
  }

  window.QPQuizQuiz = { mountLobby, mountRoom: mountAnyRoom, stageChoices, MODES, zoneAt, answerOX, ARENA };
})();
