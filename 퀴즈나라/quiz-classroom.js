/* Reusable classroom controller. All persistence goes through the supplied store. */
(() => {
  'use strict';
  const ROOT = 'quiz/classrooms';
  const COLORS = ['#ef6555', '#359ae9', '#78bc43', '#f1b934', '#a574df', '#36bfb6'];
  const TEAM_NAMES = ['빨강', '파랑', '초록', '노랑', '보라', '민트'];
  const MODES = {
    sequence: { title: '순서대로 풀기', description: '문제를 하나씩 차례대로 풀고 마지막 칸까지 도착해요.' },
    free: { title: '자유롭게 풀기', description: '원하는 문제를 골라 풀어요. 틀린 문제는 다시 도전해요.' },
    round: { title: '다 함께 한 문제', description: '모두 같은 문제에 답하고 선생님이 정답을 공개해요.' },
    team: { title: '팀 대결', description: '각자 푼 정답을 팀 점수에 더해 함께 경쟁해요.' },
    coop: { title: '우리 반 함께', description: '우리 반의 정답을 모아 제한 시간 안에 공동 목표를 달성해요.' }
  };
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const int = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback));
  const safeKey = value => {
    const key = String(value == null ? '' : value);
    if (!key || /[.#$\[\]/]/.test(key)) throw new Error('사용자 또는 수업 번호가 올바르지 않아요.');
    return key;
  };
  const ref = (store, id, suffix = '') => store.ref(ROOT + '/' + safeKey(id) + suffix);
  const readRaw = async (store, id) => (await ref(store, id).once('value')).val();
  // Firebase can initially call a transaction updater with an empty local cache.
  // Prime the parent snapshot before an updater that aborts on a missing session.
  async function sessionTransaction(store, id, updater) {
    const target = ref(store, id);
    await target.once('value');
    return target.transaction(updater);
  }
  const now = () => Date.now();
  const fail = (reason, message) => ({ accepted: false, correct: false, reason, message });
  const firstRemaining = (player, count) => {
    for (let index = 0; index < count; index++) if (!player.completed?.[index]) return index;
    return count;
  };
  const completedCount = player => Object.values(player.completed || {}).filter(Boolean).length;
  function teamIndex(team) { return int(team, 0, 0, COLORS.length - 1); }
  function teamColor(team) { return COLORS[teamIndex(team)]; }
  function teamLabel(team) { return TEAM_NAMES[teamIndex(team)] + ' 팀'; }
  function settingsFor(settings, set, mode) {
    const questions = set?.qs || set?.questions || [];
    const count = int(settings?.count, questions.length, 1, Math.max(1, questions.length));
    return {
      title: String(settings?.title || set?.title || MODES[mode].title).trim().slice(0, 100),
      count,
      delivery: settings?.delivery === 'solo' ? 'solo' : 'live',
      timer: int(settings?.timer, 30, 5, 300),
      duration: int(settings?.duration, 600, 0, 86400),
      teamCount: int(settings?.teamCount, 2, 2, 6),
      teamAssign: settings?.teamAssign === 'choose' ? 'choose' : 'random',
      coopGoal: int(settings?.coopGoal, count * 5, 1, 100000),
      points: int(settings?.points, 100, 1, 10000)
    };
  }
  function decorate(session) {
    if (!session) return null;
    const result = clone(session);
    result.players = result.players || {};
    const players = Object.values(result.players);
    const teams = Array.from({ length: result.settings?.teamCount || 2 }, (_, index) => ({ id: String(index), name: teamLabel(index), color: teamColor(index), score: 0, completed: 0, count: 0 }));
    let totalCorrect = 0;
    for (const player of players) {
      player.completed = player.completed || {};
      player.answers = player.answers || {};
      player.progress = completedCount(player);
      totalCorrect += player.progress;
      if (player.team != null && teams[Number(player.team)]) {
        const team = teams[Number(player.team)];
        team.score += Number(player.score) || 0;
        team.completed += player.progress;
        team.count++;
      }
    }
    result.metrics = { playerCount: players.length, totalCorrect, teams, goal: result.settings?.coopGoal || 1, success: result.mode === 'coop' && totalCorrect >= (result.settings?.coopGoal || 1) };
    return result;
  }
  function sessionGate(session, player, timestamp) {
    const solo = session.delivery === 'solo';
    const startedAt = solo ? (player?.startedAt || timestamp) : session.startedAt;
    let deadline = session.deadline || 0;
    if (solo) deadline = session.settings.duration ? startedAt + session.settings.duration * 1000 : 0;
    if (solo && session.mode === 'round') deadline = Math.min(deadline || Infinity, timestamp + session.settings.timer * 1000);
    return { status: session.status, epoch: session.epoch || 0, roundIndex: session.roundIndex || 0, deadline: Number.isFinite(deadline) ? deadline : 0, startedAt: startedAt || timestamp };
  }
  function stampPlayers(session, timestamp) {
    for (const player of Object.values(session.players || {})) {
      player.gate = sessionGate(session, player, timestamp);
      player.deadline = player.gate.deadline;
      player.status = player.finished || player.timedOut ? 'ended' : session.status;
      player.roundIndex = session.mode === 'round' && session.delivery === 'live' ? session.roundIndex : player.currentIndex || 0;
    }
  }
  function lowestTeam(session) {
    const counts = Array(session.settings.teamCount).fill(0);
    for (const player of Object.values(session.players || {})) if (player.team != null && counts[Number(player.team)] !== undefined) counts[Number(player.team)]++;
    return String(counts.indexOf(Math.min(...counts)));
  }
  function distributeTeams(session) {
    const players = Object.values(session.players || {});
    for (let index = players.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [players[index], players[other]] = [players[other], players[index]];
    }
    players.forEach((player, index) => { player.team = String(index % session.settings.teamCount); });
  }
  function balancedTeams(session) {
    const counts = Array(session.settings.teamCount).fill(0);
    for (const player of Object.values(session.players || {})) {
      const index = Number(player.team);
      if (player.team == null || !Number.isInteger(index) || counts[index] === undefined) return false;
      counts[index]++;
    }
    return Math.max(...counts) - Math.min(...counts) <= 1;
  }
  function grade(question, answer) {
    if (!window.QPQuizQuestions?.grade) throw new Error('문제 도구를 먼저 불러와 주세요.');
    return Boolean(window.QPQuizQuestions.grade(question, answer));
  }
  async function create(store, options) {
    const mode = MODES[options?.mode] ? options.mode : 'sequence';
    const settings = settingsFor(options?.settings, options?.set, mode);
    const rawQuestions = options?.set?.qs || options?.set?.questions || [];
    if (!rawQuestions.length) throw new Error('문제를 한 개 이상 만들어 주세요.');
    const normalize = window.QPQuizQuestions?.normalize;
    if (!normalize) throw new Error('문제 도구를 먼저 불러와 주세요.');
    const questions = rawQuestions.slice(0, settings.count).map(question => normalize(question));
    for (const [index, question] of questions.entries()) {
      const error = window.QPQuizQuestions.validate?.(question);
      if (error) throw new Error((index + 1) + '번 문제: ' + error);
    }
    const sessionRef = store.ref(ROOT).push();
    const id = sessionRef.key;
    const timestamp = now();
    const solo = settings.delivery === 'solo';
    const session = {
      id, title: settings.title, teacherId: String(options?.teacherId || '__teacher'),
      mode, delivery: settings.delivery, questions, settings, createdAt: timestamp,
      status: solo ? 'playing' : 'lobby', roundIndex: 0, epoch: solo ? 1 : 0,
      startedAt: solo ? timestamp : 0, deadline: 0, players: {}
    };
    await sessionRef.set(session);
    if (!solo) await store.ref('quiz/classroomActive').set(id);
    return id;
  }
  async function read(store, id) { return decorate(await readRaw(store, id)); }
  function watch(store, id, onUpdate, onError) {
    const target = ref(store, id);
    const listener = snapshot => onUpdate(decorate(snapshot.val()));
    target.on('value', listener, onError);
    return () => target.off('value', listener);
  }
  async function join(store, id, input) {
    const uid = safeKey(input?.id);
    let result = fail('missing', '수업을 찾을 수 없어요.');
    await sessionTransaction(store, id, session => {
      if (!session) return;
      if (session.status === 'ended') { result = fail('ended', '끝난 수업이에요.'); return; }
      session.players = session.players || {};
      const existing = session.players[uid];
      const timestamp = now();
      const player = existing || { id: uid, name: String(input.name || '학생').slice(0, 30), av: clone(input.av || {}), score: 0, completed: {}, answers: {}, currentIndex: 0, joinedAt: timestamp, startedAt: session.delivery === 'solo' ? timestamp : 0 };
      player.name = String(input.name || player.name || '학생').slice(0, 30);
      player.av = clone(input.av || player.av || {});
      player.online = true;
      player.lastSeen = timestamp;
      if (session.mode === 'team' && player.team == null) {
        if (session.settings.teamAssign === 'random') player.team = lowestTeam(session);
        else if (input.team != null) player.team = String(int(input.team, 0, 0, session.settings.teamCount - 1));
      }
      if (!existing || !player.gate || player.gate.epoch !== session.epoch || (session.delivery !== 'solo' && player.gate.status !== session.status)) player.gate = sessionGate(session, player, timestamp);
      player.deadline = player.gate.deadline;
      player.status = player.finished || player.timedOut ? 'ended' : session.delivery === 'solo' && player.gate.status === 'reveal' ? 'reveal' : session.status;
      player.roundIndex = player.currentIndex || 0;
      session.players[uid] = player;
      result = { accepted: true, player: clone(player) };
      return session;
    });
    return result;
  }
  async function selectTeam(store, id, playerId, team) {
    const uid = safeKey(playerId);
    let result = fail('locked', '수업이 시작되면 팀을 바꿀 수 없어요.');
    await sessionTransaction(store, id, session => {
      if (!session || session.mode !== 'team' || session.settings.teamAssign !== 'choose' || !session.players?.[uid]) return;
      const player = session.players[uid];
      const noAnswers = Object.keys(player.answers || {}).length === 0 && !player.teamLocked;
      const canChoose = session.status === 'lobby' || (session.status === 'playing' && noAnswers && (session.delivery === 'solo' || player.team == null));
      if (!canChoose) return;
      const index = Number(team);
      if (!Number.isInteger(index) || index < 0 || index >= session.settings.teamCount) { result = fail('team', '팀을 골라 주세요.'); return; }
      session.players[uid].team = String(index);
      result = { accepted: true, team: String(index) };
      return session;
    });
    return result;
  }
  async function assignTeams(store, id) {
    let result = fail('locked', '대기 중에만 팀을 나눌 수 있어요.');
    await sessionTransaction(store, id, session => {
      if (!session || session.mode !== 'team' || session.status !== 'lobby' || session.settings.teamAssign !== 'random') return;
      distributeTeams(session);
      session.teamsAssignedAt = now();
      result = { accepted: true };
      return session;
    });
    return result;
  }
  async function start(store, id) {
    let result = fail('state', '시작할 수 없는 수업이에요.');
    await sessionTransaction(store, id, session => {
      if (!session || session.status !== 'lobby') return;
      if (session.mode === 'team') {
        if (session.settings.teamAssign === 'random') {
          if (!balancedTeams(session)) distributeTeams(session);
          session.teamsAssignedAt = now();
        }
        else if (Object.values(session.players || {}).some(player => player.team == null)) { result = fail('team', '모든 학생이 팀을 고르면 시작할 수 있어요.'); return; }
      }
      const timestamp = now();
      session.status = 'playing'; session.startedAt = timestamp; session.roundIndex = 0; session.epoch = (session.epoch || 0) + 1;
      session.deadline = timestamp + (session.mode === 'round' ? session.settings.timer : session.settings.duration) * 1000;
      if (session.mode !== 'round' && !session.settings.duration) session.deadline = 0;
      for (const player of Object.values(session.players || {})) player.startedAt = timestamp;
      stampPlayers(session, timestamp);
      for (const player of Object.values(session.players || {})) { player.deadline = player.gate.deadline; player.status = 'playing'; }
      result = { accepted: true };
      return session;
    });
    return result;
  }
  async function submit(store, id, playerId, questionIndex, answer) {
    const uid = safeKey(playerId);
    const session = await readRaw(store, id);
    if (!session) return fail('missing', '수업을 찾을 수 없어요.');
    if (session.status !== 'playing') return fail('state', session.status === 'lobby' ? '선생님이 시작할 때까지 기다려 주세요.' : '지금은 답을 보낼 수 없어요.');
    const index = Number(questionIndex);
    if (!Number.isInteger(index) || !session.questions[index]) return fail('question', '문제 번호가 올바르지 않아요.');
    const liveRound = session.mode === 'round' && session.delivery === 'live';
    const soloRound = session.mode === 'round' && session.delivery === 'solo';
    if (liveRound && index !== session.roundIndex) return fail('round', '현재 문제에 답해 주세요.');
    const correct = grade(session.questions[index], answer);
    const answerValue = clone(answer);
    if (answerValue === undefined) return fail('answer', '답을 입력해 주세요.');
    let result = fail('player', '먼저 수업에 참가해 주세요.');
    await ref(store, id, '/players/' + uid).transaction(player => {
      if (!player) return;
      const timestamp = now();
      const gate = player.gate;
      if (!gate || gate.status !== 'playing' || gate.epoch !== session.epoch) { result = fail('state', '문제가 바뀌었어요. 화면을 확인해 주세요.'); return; }
      if (gate.deadline && timestamp >= gate.deadline) { result = fail('deadline', '답을 보낼 시간이 끝났어요.'); return; }
      if (player.finished || player.status === 'ended') { result = fail('finished', '모든 문제를 풀었어요.'); return; }
      if (liveRound && gate.roundIndex !== index) { result = fail('round', '현재 문제에 답해 주세요.'); return; }
      if (session.mode === 'team' && player.team == null) { result = fail('team', '팀을 먼저 골라 주세요.'); return; }
      player.completed = player.completed || {};
      player.answers = player.answers || {};
      if (player.completed[index]) { result = fail('completed', '이미 맞힌 문제예요.'); return; }
      if (liveRound && player.answers[index]?.epoch === session.epoch) { result = fail('answered', '이미 답을 보냈어요. 정답 공개를 기다려 주세요.'); return; }
      if (session.mode === 'sequence' && index !== firstRemaining(player, session.questions.length)) { result = fail('order', '앞의 문제부터 차례대로 풀어 주세요.'); return; }
      if (session.mode === 'round' && session.delivery === 'solo' && index !== (player.currentIndex || 0)) { result = fail('order', '현재 문제를 풀어 주세요.'); return; }
      const attempts = (player.answers[index]?.attempts || 0) + 1;
      if (session.mode === 'team') player.teamLocked = true;
      player.answers[index] = { answer: answerValue, at: timestamp, epoch: session.epoch, attempts, pending: liveRound };
      if (!liveRound) {
        player.answers[index].correct = correct;
        if (correct) { player.completed[index] = true; player.score = (Number(player.score) || 0) + session.settings.points; }
        if (soloRound) {
          player.currentIndex = index; player.roundIndex = index;
          player.status = 'reveal'; player.gate.status = 'reveal';
          player.gate.deadline = 0; player.deadline = 0;
        } else {
          player.currentIndex = firstRemaining(player, session.questions.length);
          player.roundIndex = player.currentIndex;
        }
      }
      player.lastSeen = timestamp;
      player.finished = soloRound ? false : completedCount(player) >= session.questions.length;
      if (player.finished) player.finishedAt = timestamp;
      if (player.finished) player.status = 'ended';
      result = { accepted: true, pending: liveRound, correct: liveRound ? null : correct, completed: !liveRound && correct, finished: player.finished, currentIndex: player.currentIndex, status: player.status, score: player.score };
      return player;
    });
    if (result.accepted && session.mode === 'coop' && !result.pending) {
      await sessionTransaction(store, id, current => {
        if (!current || current.status !== 'playing') return;
        const total = Object.values(current.players || {}).reduce((sum, player) => sum + completedCount(player), 0);
        if (total < current.settings.coopGoal) return;
        current.status = 'ended'; current.endedAt = now(); current.outcome = 'success';
        stampPlayers(current, current.endedAt);
        return current;
      });
    }
    return result;
  }
  async function reveal(store, id) {
    let result = fail('state', '공개할 문제가 없어요.');
    await sessionTransaction(store, id, session => {
      if (!session || session.status !== 'playing' || session.mode !== 'round' || session.delivery !== 'live') return;
      const timestamp = now();
      const cutoff = Math.min(timestamp, session.deadline || timestamp);
      const index = session.roundIndex;
      for (const player of Object.values(session.players || {})) {
        const attempt = player.answers?.[index];
        if (!attempt || attempt.epoch !== session.epoch || !attempt.pending) continue;
        attempt.pending = false;
        attempt.correct = attempt.at <= cutoff && grade(session.questions[index], attempt.answer);
        if (attempt.correct && !player.completed?.[index]) {
          player.completed = player.completed || {}; player.completed[index] = true;
          player.score = (Number(player.score) || 0) + session.settings.points;
        }
        player.currentIndex = index + 1;
      }
      session.status = 'reveal'; session.revealedAt = timestamp; session.closedAt = cutoff;
      stampPlayers(session, timestamp);
      result = { accepted: true };
      return session;
    });
    return result;
  }
  async function next(store, id) {
    let result = fail('state', '정답을 공개한 뒤 다음 문제로 넘어가요.');
    await sessionTransaction(store, id, session => {
      if (!session || session.mode !== 'round' || session.delivery !== 'live' || session.status !== 'reveal') return;
      const timestamp = now();
      if (session.roundIndex + 1 >= session.questions.length) {
        session.status = 'ended'; session.endedAt = timestamp; session.outcome = 'complete';
      } else {
        session.roundIndex++; session.epoch++; session.status = 'playing';
        session.deadline = timestamp + session.settings.timer * 1000;
      }
      stampPlayers(session, timestamp);
      result = { accepted: true };
      return session;
    });
    return result;
  }
  async function end(store, id, reason = 'teacher') {
    let result = fail('state', '수업을 찾을 수 없어요.');
    await sessionTransaction(store, id, session => {
      if (!session) return;
      if (session.status === 'ended') { result = { accepted: true }; return; }
      const timestamp = now();
      session.status = 'ended'; session.endedAt = timestamp;
      const total = Object.values(session.players || {}).reduce((sum, player) => sum + completedCount(player), 0);
      session.outcome = session.mode === 'coop' ? (total >= session.settings.coopGoal ? 'success' : 'unfinished') : reason;
      stampPlayers(session, timestamp);
      result = { accepted: true };
      return session;
    });
    return result;
  }
  async function leave(store, id, playerId) {
    await ref(store, id, '/players/' + safeKey(playerId)).update({ online: false, lastSeen: now() });
  }
  async function advanceSolo(store, id, playerId) {
    const session = await readRaw(store, id);
    if (!session || session.delivery !== 'solo' || session.mode !== 'round' || session.status !== 'playing') return fail('state', '혼자 하는 문제에서만 다음 문제로 넘어갈 수 있어요.');
    let result = fail('state', '아직 답할 시간이 남아 있어요.');
    await ref(store, id, '/players/' + safeKey(playerId)).transaction(player => {
      const timestamp = now();
      if (!player || player.finished || player.status === 'ended' || !player.gate || player.gate.epoch !== session.epoch) return;
      const revealed = player.status === 'reveal' && player.gate.status === 'reveal';
      if (!revealed && (player.gate.status !== 'playing' || !player.gate.deadline || timestamp < player.gate.deadline)) return;
      const index = player.currentIndex || 0;
      player.answers = player.answers || {};
      if (!revealed) player.answers[index] = { answer: '', correct: false, pending: false, timedOut: true, at: player.gate.deadline, epoch: session.epoch, attempts: 0 };
      player.currentIndex = index + 1; player.roundIndex = player.currentIndex;
      const totalDeadline = session.settings.duration ? player.startedAt + session.settings.duration * 1000 : Infinity;
      player.finished = player.currentIndex >= session.questions.length || timestamp >= totalDeadline;
      player.timedOut = timestamp >= totalDeadline;
      player.status = player.finished ? 'ended' : 'playing';
      player.gate.status = player.status;
      player.gate.roundIndex = player.currentIndex;
      player.deadline = player.finished ? 0 : Math.min(totalDeadline, timestamp + session.settings.timer * 1000);
      player.gate.deadline = player.deadline;
      if (player.finished) { player.finishedAt = timestamp; player.gate.status = 'ended'; }
      result = { accepted: true, correct: Boolean(player.answers[index]?.correct), timedOut: !revealed || player.timedOut, finished: player.finished, currentIndex: player.currentIndex, status: player.status, score: player.score };
      return player;
    });
    return result;
  }
  async function sweep(store, id, playerId) {
    const session = await readRaw(store, id);
    if (!session || session.status !== 'playing') return { accepted: false, reason: 'state' };
    if (session.delivery === 'live' && session.deadline && now() >= session.deadline) return session.mode === 'round' ? reveal(store, id) : end(store, id, 'deadline');
    let changed = false;
    if (session.delivery === 'solo') {
      const ids = playerId == null ? Object.keys(session.players || {}) : [safeKey(playerId)];
      if (session.mode === 'round') {
        for (const uid of ids) {
          const player = session.players?.[uid];
          const totalDeadline = player && session.settings.duration ? player.startedAt + session.settings.duration * 1000 : 0;
          const due = player?.status === 'reveal' ? totalDeadline && now() >= totalDeadline : player?.gate?.deadline && now() >= player.gate.deadline;
          if (player && !player.finished && player.status !== 'ended' && due) {
            const result = await advanceSolo(store, id, uid);
            changed = changed || result.accepted;
          }
        }
        return { accepted: true, changed };
      }
      await sessionTransaction(store, id, current => {
        if (!current || current.status !== 'playing') return;
        const timestamp = now();
        for (const uid of ids) {
          const player = current.players?.[uid];
          if (!player) continue;
          if (player.finished || player.status === 'ended') continue;
          const totalDeadline = current.settings.duration ? player.startedAt + current.settings.duration * 1000 : 0;
          if (totalDeadline && timestamp >= totalDeadline) {
            player.status = 'ended'; player.finishedAt = timestamp; player.timedOut = true;
            player.gate.status = 'ended'; changed = true;
          }
        }
        if (changed) return current;
      });
    }
    return { accepted: true, changed };
  }
  window.QPClassroom = { create, read, watch, join, selectTeam, assignTeams, submit, start, reveal, next, end, leave, advanceSolo, sweep, decorate, settingsFor, teamColor, teamLabel, colors: COLORS.slice(), modes: clone(MODES) };

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const button = (label, action, extra = '') => {
    const classes=extra.match(/\bclass="([^"]*)"/);
    return '<button type="button" class="'+(classes?classes[1]:'qpc-button')+'" data-action="'+action+'" '+extra.replace(/\bclass="[^"]*"/,'')+'>'+label+'</button>';
  };
  function mountSetup(container, options) {
    const mode = MODES[options.mode] ? options.mode : 'sequence';
    const initial = settingsFor(options.settings, options.set, mode);
    const count = (options.set?.qs || options.set?.questions || []).length;
    let destroyed = false;
    container.innerHTML = '<section class="qpc-setup qpc-panel"><header class="qpc-heading"><span class="qpc-eyebrow">문제 만들기 완료 · 수업 설정</span><h2>' + esc(MODES[mode].title) + '</h2><p>' + esc(MODES[mode].description) + '</p></header><form class="qpc-form"><label class="qpc-field qpc-wide">수업 이름<input name="title" maxlength="100" required value="' + esc(initial.title) + '"></label><fieldset class="qpc-delivery"><legend>진행 방식</legend><label><input type="radio" name="delivery" value="live" ' + (initial.delivery === 'live' ? 'checked' : '') + '><strong>실시간 수업</strong><span>모두 모여 선생님과 함께 시작해요.</span></label><label><input type="radio" name="delivery" value="solo" ' + (initial.delivery === 'solo' ? 'checked' : '') + '><strong>혼자 하는 과제</strong><span>참여 링크로 각자 시작하고 이어서 풀어요.</span></label></fieldset><label class="qpc-field">사용할 문제 수<input name="count" type="number" min="1" max="' + Math.max(1, count) + '" value="' + initial.count + '" required><small>직접 만든 ' + count + '문제 중 앞에서부터 사용해요.</small></label><label class="qpc-field" data-round-timer>한 문제 제한 시간<select name="timer">' + [10, 15, 20, 30, 45, 60, 90, 120, 180, 300].map(seconds => '<option value="' + seconds + '" ' + (initial.timer === seconds ? 'selected' : '') + '>' + seconds + '초</option>').join('') + '</select></label><label class="qpc-field" data-total-timer>전체 제한 시간 (분)<input name="durationMinutes" type="number" min="0" max="1440" step="1" value="' + Math.ceil(initial.duration / 60) + '" required><small>0은 제한 없음이에요. 협동 수업은 제한 시간을 정해요.</small></label>' + (mode === 'team' ? '<label class="qpc-field">팀 수<select name="teamCount">' + [2, 3, 4, 5, 6].map(number => '<option value="' + number + '" ' + (initial.teamCount === number ? 'selected' : '') + '>' + number + '팀</option>').join('') + '</select></label><fieldset class="qpc-field qpc-team-assignment"><legend>팀 나누기</legend><label><input type="radio" name="teamAssign" value="random" ' + (initial.teamAssign === 'random' ? 'checked' : '') + '>무작위로 고르게 배정</label><label><input type="radio" name="teamAssign" value="choose" ' + (initial.teamAssign === 'choose' ? 'checked' : '') + '>학생이 원하는 팀 선택</label></fieldset>' : '') + (mode === 'coop' ? '<label class="qpc-field qpc-wide">우리 반 공동 목표<input name="coopGoal" type="number" min="1" max="100000" value="' + initial.coopGoal + '" required><small>학생마다 맞힌 문제 수를 모두 더해 이 목표에 도전해요. 같은 학생의 같은 정답은 한 번만 더해요.</small></label>' : '') + '<p class="qpc-form-note qpc-wide" data-delivery-note></p><p class="qpc-error qpc-wide" role="alert" hidden></p><footer class="qpc-form-actions qpc-wide">' + button('← 문제 수정', 'back') + '<button class="qpc-button qpc-primary" type="submit">수업 만들기 →</button></footer></form></section>';
    const form = container.querySelector('form');
    const error = container.querySelector('.qpc-error');
    function refresh() {
      const delivery = new FormData(form).get('delivery');
      container.querySelector('[data-round-timer]').hidden = mode !== 'round';
      container.querySelector('[data-total-timer]').hidden = mode === 'round' && delivery === 'live';
      container.querySelector('[data-delivery-note]').textContent = delivery === 'solo' ? '과제 링크와 학생별 진도는 저장돼요. 학생이 다시 들어오면 풀던 자리에서 이어서 해요.' : '수업을 만들면 학생 대기실이 열려요. 참가자를 확인하고 시작해 주세요.';
      form.querySelector('[type="submit"]').textContent = delivery === 'solo' ? '과제 만들기 →' : '수업 만들기 →';
    }
    form.addEventListener('change', refresh);
    container.querySelector('[data-action="back"]').onclick = () => options.onBack?.();
    form.onsubmit = async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const settings = settingsFor({ ...initial, title: values.get('title'), count: values.get('count'), delivery: values.get('delivery'), timer: values.get('timer'), duration: Number(values.get('durationMinutes')) * 60, teamCount: values.get('teamCount') || initial.teamCount, teamAssign: values.get('teamAssign') || initial.teamAssign, coopGoal: values.get('coopGoal') || initial.coopGoal }, options.set, mode);
      if (mode === 'coop' && !settings.duration) { error.hidden = false; error.textContent = '공동 목표에 도전할 제한 시간을 정해 주세요.'; return; }
      const launch = form.querySelector('[type="submit"]');
      launch.disabled = true; error.hidden = true;
      try { await options.onLaunch?.(settings); }
      catch (failure) { if (!destroyed) { error.hidden = false; error.textContent = failure.message || '수업을 만들지 못했어요. 다시 시도해 주세요.'; } }
      finally { if (!destroyed) launch.disabled = false; }
    };
    refresh();
    return { destroy() { destroyed = true; container.innerHTML = ''; } };
  }
  function mountDashboard(container, options) {
    let session = decorate(options.session);
    let destroyed = false;
    let busy = false;
    let lastMarkup = '';
    let clock;
    const escapeAvatar = player => options.renderAvatar ? options.renderAvatar(player, 42) : '<span class="qpc-player-initial" aria-hidden="true">' + esc(String(player.name || '학').slice(0, 1)) + '</span>';
    function render() {
      if (destroyed || !session) return;
      const players = Object.entries(session.players || {}).sort((a, b) => (b[1].score || 0) - (a[1].score || 0) || (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
      const statusLabels = { lobby: '학생을 기다리는 중', playing: session.delivery === 'solo' ? '과제 진행 중' : '수업 진행 중', reveal: '정답 공개', ended: '수업 결과' };
      const teams = session.metrics.teams;
      const question = session.questions[session.roundIndex];
      let actions = session.status === 'lobby' ? button('수업 시작', 'start', 'class="qpc-button qpc-primary"') : '';
      if (session.mode === 'round' && session.delivery === 'live') {
        if (session.status === 'playing') actions += button('정답 공개', 'reveal');
        if (session.status === 'reveal') actions += button(session.roundIndex + 1 < session.questions.length ? '다음 문제 →' : '결과 보기', 'next');
      }
      if (session.status !== 'ended') actions += button(session.delivery === 'solo' ? '과제 마감' : '수업 종료', 'end');
      if (session.mode === 'team' && session.status === 'lobby' && session.settings.teamAssign === 'random') actions += button('팀 다시 나누기', 'assignTeams');
      const summary = session.mode === 'team' ? '<div class="qpc-team-summary">' + teams.map(team => '<article style="--team-color:' + team.color + '"><span>' + esc(team.name) + ' · ' + team.count + '명</span><strong>' + team.score + '<small>점</small></strong><small>정답 ' + team.completed + '개</small></article>').join('') + '</div>' : session.mode === 'coop' ? '<div class="qpc-coop-goal"><div><strong>우리 반 함께 ' + session.metrics.totalCorrect + ' / ' + session.metrics.goal + '</strong><span>' + (session.metrics.success ? '공동 목표 달성! 🎉' : '각자 맞힌 정답이 우리 반의 힘이 돼요') + '</span></div><progress value="' + Math.min(session.metrics.totalCorrect, session.metrics.goal) + '" max="' + session.metrics.goal + '"></progress></div>' : '';
      const markup = '<section class="qpc-dashboard"><header class="qpc-panel qpc-dash-heading"><div><span class="qpc-eyebrow">' + esc(MODES[session.mode]?.title) + ' · ' + (session.delivery === 'solo' ? '혼자 하는 과제' : '실시간 수업') + '</span><h2>' + esc(session.title) + '</h2><p><span class="qpc-status qpc-status-' + session.status + '">' + statusLabels[session.status] + '</span><span class="qpc-clock" data-session-clock></span></p></div><div class="qpc-header-tools"><div class="qpc-link-actions">' + (options.onBack ? button('← 수업 목록', 'back') : '') + (options.onCopyLink ? button('참여 링크 복사', 'copy') : '') + (options.onEdit ? button('새 수업 만들기', 'edit') : '') + '</div><div class="qpc-dashboard-actions qpc-header-actions">' + actions + '</div></div></header><div class="qpc-panel qpc-class-summary"><div><strong>' + players.length + '</strong><span>참가 학생</span></div><div><strong>' + session.questions.length + '</strong><span>수업 문제</span></div><div><strong>' + session.metrics.totalCorrect + '</strong><span>함께 맞힌 정답</span></div></div>' + summary + (session.mode === 'round' && session.delivery === 'live' ? '<article class="qpc-panel qpc-round-summary"><span class="qpc-eyebrow">' + (session.roundIndex + 1) + ' / ' + session.questions.length + ' 문제</span><h3>' + esc(question?.q || '') + '</h3><p>' + (session.status === 'reveal' ? '정답과 학생별 결과가 공개됐어요.' : session.status === 'playing' ? '답을 보낸 학생 ' + players.filter(([, player]) => player.answers?.[session.roundIndex]?.epoch === session.epoch).length + ' / ' + players.length + '명' : '학생들이 모이면 첫 문제를 함께 시작해요.') + '</p></article>' : '') + '<section class="qpc-panel qpc-roster"><header><h3>학생별 진도</h3><span>정답은 한 번만 점수에 더해져요</span></header>' + (players.length ? '<div class="qpc-table-wrap"><table><thead><tr><th>학생</th>' + (session.mode === 'team' ? '<th>팀</th>' : '') + '<th>맞힌 문제</th><th>점수</th><th>상태</th></tr></thead><tbody>' + players.map(([uid, player]) => '<tr data-player="' + esc(uid) + '"><td><div class="qpc-player">' + escapeAvatar(player) + '<strong>' + esc(player.name) + '</strong></div></td>' + (session.mode === 'team' ? '<td><span class="qpc-team-badge" style="--team-color:' + (player.team != null ? teamColor(player.team) : '#999') + '">' + (player.team != null ? esc(teamLabel(player.team)) : '팀 선택 중') + '</span></td>' : '') + '<td><div class="qpc-student-progress"><progress value="' + player.progress + '" max="' + session.questions.length + '"></progress><span>' + player.progress + ' / ' + session.questions.length + '</span></div></td><td class="qpc-score">' + (Number(player.score) || 0) + '</td><td>' + (player.finished ? '완료 ✓' : player.status === 'ended' ? '시간 종료' : session.mode === 'round' && session.delivery === 'live' && player.answers?.[session.roundIndex]?.pending ? '답변 완료' : session.status === 'reveal' && player.answers?.[session.roundIndex] ? (player.answers[session.roundIndex].correct ? '정답 ✓' : '다음에 도전') : player.online === false ? '자리 비움' : session.status === 'lobby' ? '준비 완료' : '풀고 있어요') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="qpc-empty"><strong>학생을 기다리고 있어요</strong><p>참여 링크를 알려 주면 이곳에 학생이 나타나요.</p></div>') + '</section><footer class="qpc-dashboard-actions"><p class="qpc-error" role="alert" hidden></p></footer></section>';
      if (markup !== lastMarkup) { container.innerHTML = markup; lastMarkup = markup; }
      container.querySelectorAll('[data-action]').forEach(element => { element.disabled = busy; });
      tick();
    }
    function tick() {
      const element = container.querySelector('[data-session-clock]');
      if (!element || !session) return;
      if (session.status !== 'playing') { element.textContent = ''; return; }
      if (!session.deadline) { element.textContent = session.delivery === 'solo' ? '학생마다 자신의 속도로 진행해요' : '시간 제한 없음'; return; }
      const seconds = Math.max(0, Math.ceil((session.deadline - now()) / 1000));
      element.textContent = seconds ? '남은 시간 ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : '제한 시간이 끝났어요';
      element.classList.toggle('qpc-clock-expired', !seconds);
    }
    async function click(event) {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action || busy) return;
      busy = true; render();
      try {
        const result = action === 'back' ? await options.onBack?.(session) : action === 'copy' ? await options.onCopyLink?.(session) : action === 'edit' ? await options.onEdit?.(session) : await options.onAction?.(action, session);
        if (result?.accepted === false) throw new Error(result.message || '지금은 이 동작을 할 수 없어요.');
      } catch (failure) {
        const element = container.querySelector('.qpc-dashboard-actions .qpc-error');
        if (element) { element.hidden = false; element.textContent = failure.message || '다시 시도해 주세요.'; }
      } finally { busy = false; if (!destroyed) container.querySelectorAll('[data-action]').forEach(element => { element.disabled = false; }); }
    }
    container.addEventListener('click', click);
    clock = setInterval(tick, 1000);
    render();
    return { update(value) { session = decorate(value); render(); }, destroy() { destroyed = true; clearInterval(clock); container.removeEventListener('click', click); container.innerHTML = ''; } };
  }
  window.QPTeacherClassroom = { mountSetup, mountDashboard, modes: clone(MODES) };
})();
