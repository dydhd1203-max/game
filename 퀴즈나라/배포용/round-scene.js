/* Forest picnic seating. Score updates keep the same SVGs and their pose rigs. */
(function () {
  'use strict';
  const PALETTES = ['rose', 'sky', 'lemon', 'lilac', 'mint', 'peach'];
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const phase = status => ({ lobby: '친구들이 모이고 있어요', playing: '자리에 앉아 함께 풀어요', reveal: '우리 반 정답 공개!', ended: '즐거운 소풍, 수고했어요!' })[status] || '우리 반이 함께하는 퀴즈 소풍';
  function mount(container, initial) {
    if (!container || !container.appendChild) throw new TypeError('QPRoundScene.mount requires a container.');
    const options = { players: [], ownId: '', started: false, status: 'lobby', roundIndex: 0, ...(initial || {}) };
    const records = new Map(), order = [], blanks = [];
    let stopped = false, raf = 0, generation = 0, laidOut = false, ownCentered = false;
    let sceneWidth = 760, sceneHeight = 260, columns = 8, avatarHeight = 62;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = document.createElement('section');
    scene.className = 'qp-round-scene';
    scene.innerHTML = '<header class="qp-round-banner"><span class="qp-round-title">우리 반 숲속 소풍</span><span class="qp-round-phase" role="status"></span></header><div class="qp-round-camera" tabindex="0" aria-label="친구들의 소풍 자리. 방향키로 숲속 자리를 둘러볼 수 있어요."><div class="qp-round-clearing"><div class="qp-round-path" aria-hidden="true"></div></div></div><span class="qp-round-pan-hint" aria-hidden="true">옆으로 움직여 친구들을 찾아봐요 ↔</span>';
    const camera = scene.querySelector('.qp-round-camera'), clearing = scene.querySelector('.qp-round-clearing');
    const phaseText = scene.querySelector('.qp-round-phase');
    container.appendChild(scene);

    function pose(record, action, time) {
      const svg = record.actor.querySelector('.qp-pixel-avatar');
      if (!svg) return;
      record.svg = svg;
      window.QPAvatarPose?.apply(svg, { action, grounded: true, facing: 'right', phase: ((time || 0) / 460) % 1, step: Math.floor((time || 0) / 58) % 8 });
      record.actor.dataset.roundPose = action;
    }
    function actorPosition(record) {
      const density = window.devicePixelRatio || 1;
      const pixel = value => Math.round(value * density) / density;
      record.actor.style.transform = 'translate3d(' + pixel(record.x) + 'px,' + pixel(record.y) + 'px,0)';
      record.actor.style.zIndex = String(Math.floor(record.y));
    }
    function enter(record, now) {
      record.entered = true;
      record.walking = !reduce;
      record.delay = (record.index % columns) * 65 + Math.floor(record.index / columns) * 85;
      record.fromX = record.targetX + ((record.index % 3) - 1) * 18;
      record.fromY = sceneHeight + 22 + Math.floor(record.index / columns) * 10;
      record.startedAt = now;
      record.duration = 1450 + Math.abs(record.fromY - record.targetY) * 1.9;
      record.x = record.walking ? record.fromX : record.targetX;
      record.y = record.walking ? record.fromY : record.targetY;
      pose(record, record.walking ? 'walk' : 'sit', 0);
      actorPosition(record);
    }
    function tick(now) {
      raf = 0;
      if (stopped) return;
      let moving = false;
      records.forEach(record => {
        if (!record.walking) return;
        const elapsed = now - record.startedAt - record.delay;
        const progress = Math.max(0, Math.min(1, elapsed / record.duration));
        const eased = progress * progress * (3 - 2 * progress);
        record.x = record.fromX + (record.targetX - record.fromX) * eased;
        record.y = record.fromY + (record.targetY - record.fromY) * eased;
        actorPosition(record);
        if (progress >= 1) { record.walking = false; pose(record, 'sit', elapsed); }
        else { moving = true; pose(record, elapsed > 0 ? 'walk' : 'idle', elapsed); }
      });
      if (moving) raf = requestAnimationFrame(tick);
      else scene.dataset.entering = 'false';
    }
    function animate() {
      if (!raf && !stopped && [...records.values()].some(record => record.walking)) {
        scene.dataset.entering = 'true';
        raf = requestAnimationFrame(tick);
      }
    }
    function makeMat(index, blank) {
      const seat = document.createElement('div');
      seat.className = 'qp-round-participant' + (blank ? ' qp-round-empty' : '');
      seat.dataset.matColor = PALETTES[index % PALETTES.length];
      seat.innerHTML = '<div class="qp-round-mat" aria-hidden="true"><i></i></div>' + (blank ? '<span class="qp-round-empty-flower" aria-hidden="true">✿</span>' : '<div class="qp-round-board"><b></b><small></small></div>');
      clearing.appendChild(seat);
      return seat;
    }
    function create(player, index) {
      const seat = makeMat(index, false), actor = document.createElement('div');
      actor.className = 'qp-round-avatar';
      actor.setAttribute('aria-hidden', 'true');
      actor.innerHTML = player.avatarHTML || '';
      clearing.appendChild(actor);
      const record = { id: String(player.id), index, seat, actor, name: seat.querySelector('b'), board: seat.querySelector('small'), html: player.avatarHTML || '',
        svg: null, targetX: 0, targetY: 0, x: 0, y: 0, walking: false, entered: false };
      records.set(record.id, record);
      return record;
    }
    function label(record, player) {
      const mine = String(options.ownId) === record.id;
      record.seat.classList.toggle('qp-round-mine', mine);
      record.actor.classList.toggle('qp-round-mine', mine);
      record.name.textContent = player.name || '친구';
      record.name.title = player.name || '친구';
      let text = finite(player.score, 0) + '점', answer = '';
      if (options.status === 'reveal' && player.correct !== undefined && player.correct !== null) {
        answer = player.correct ? 'correct' : 'retry';
        text = player.correct ? '정답 ✓' : '다음에 도전';
      } else if (player.answered) { text = '제출 ✓'; answer = 'answered'; }
      else if (!options.started) text = mine ? '내 자리' : '준비 완료';
      record.board.textContent = text;
      record.seat.dataset.answer = answer;
      record.seat.setAttribute('aria-label', (mine ? '내 자리, ' : '') + (player.name || '친구') + ', ' + text);
      if (player.avatarHTML !== undefined && record.html !== player.avatarHTML) {
        if (record.svg) window.QPAvatarPose?.destroy(record.svg);
        record.html = player.avatarHTML;
        record.actor.innerHTML = record.html;
        pose(record, record.walking ? 'walk' : record.entered ? 'sit' : 'idle', 0);
      }
    }
    function layout() {
      if (stopped) return;
      const width = camera.clientWidth || container.clientWidth || 760;
      sceneWidth = Math.max(760, width);
      columns = sceneWidth >= 1100 ? 10 : 8;
      const slotCount = Math.max(24, order.length);
      const rows = Math.ceil(slotCount / columns);
      avatarHeight = rows <= 3 ? 64 : 54;
      const pitch = rows <= 3 ? 61 : 54;
      const firstY = avatarHeight + 24;
      sceneHeight = Math.max(camera.clientHeight || 260, firstY + (rows - 1) * pitch + 20);
      clearing.style.width = sceneWidth + 'px';
      clearing.style.height = sceneHeight + 'px';
      clearing.style.setProperty('--round-avatar-height', avatarHeight + 'px');
      const horizontal = sceneWidth > width + 1, vertical = sceneHeight > camera.clientHeight + 1;
      scene.classList.toggle('qp-round-pannable', horizontal || vertical);
      scene.querySelector('.qp-round-pan-hint').textContent = horizontal && vertical
        ? '옆·아래로 움직여 친구들을 찾아봐요 ↔ ↓'
        : horizontal ? '옆으로 움직여 친구들을 찾아봐요 ↔' : '아래로 더 많은 친구들을 만나봐요 ↓';
      const cell = (sceneWidth - 120) / columns;
      function seatPosition(index, seat) {
        const row = Math.floor(index / columns), column = index % columns;
        const x = 60 + cell * (column + .5) + (row % 2 ? cell * .25 : -cell * .25);
        const y = firstY + row * pitch;
        seat.style.left = x + 'px'; seat.style.top = y + 'px';
        seat.style.setProperty('--round-seat-layer', String(Math.floor(y)));
        return { x, y };
      }
      order.forEach((id, index) => {
        const record = records.get(id), position = seatPosition(index, record.seat);
        const oldX = record.targetX, oldY = record.targetY;
        record.index = index; record.targetX = position.x; record.targetY = position.y;
        if (record.walking) { record.x += position.x - oldX; record.y += position.y - oldY; record.fromX += position.x - oldX; }
        else { record.x = position.x; record.y = position.y; }
        if (!record.entered && options.started) enter(record, performance.now());
        else { actorPosition(record); if (!record.walking) pose(record, record.entered ? 'sit' : 'idle', 0); }
      });
      while (blanks.length > slotCount - order.length) blanks.pop().remove();
      while (blanks.length < slotCount - order.length) blanks.push(makeMat(order.length + blanks.length, true));
      blanks.forEach((seat, index) => seatPosition(order.length + index, seat));
      if (!ownCentered && camera.clientWidth > 0 && records.has(String(options.ownId))) {
        const own = records.get(String(options.ownId));
        camera.scrollTo({ left: Math.max(0, own.targetX - camera.clientWidth / 2),
          top: Math.max(0, own.targetY - camera.clientHeight * .7), behavior: 'instant' });
        ownCentered = true;
      }
      laidOut = true;
      animate();
    }
    function update(next) {
      if (stopped) return;
      Object.assign(options, next || {});
      const players = Array.isArray(options.players) ? options.players : [];
      const seen = new Set();
      players.forEach((player, index) => {
        if (!player || player.id === undefined || player.id === null) return;
        const id = String(player.id);
        if (seen.has(id)) return;
        seen.add(id);
        if (!records.has(id)) { order.push(id); create(player, index); }
        label(records.get(id), player);
      });
      records.forEach((record, id) => {
        if (seen.has(id)) return;
        if (record.svg) window.QPAvatarPose?.destroy(record.svg);
        record.seat.remove(); record.actor.remove(); records.delete(id);
        const index = order.indexOf(id); if (index >= 0) order.splice(index, 1);
      });
      scene.dataset.status = options.status;
      phaseText.textContent = (options.started ? (finite(options.roundIndex, 0) + 1) + '번째 문제 · ' : '') + phase(options.status);
      layout();
      // An atlas may finish after mounting; prepare the existing SVG instead of replacing it.
      const token = ++generation;
      if (document.fonts?.ready) document.fonts.ready.then(() => { if (!stopped && token === generation && laidOut) layout(); });
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
    observer?.observe(camera);
    if (!observer) window.addEventListener('resize', layout);
    update(initial);
    return Object.freeze({ update, destroy() {
      if (stopped) return;
      stopped = true; generation++; cancelAnimationFrame(raf); observer?.disconnect();
      if (!observer) window.removeEventListener('resize', layout);
      records.forEach(record => { if (record.svg) window.QPAvatarPose?.destroy(record.svg); });
      records.clear(); scene.remove();
    } });
  }
  window.QPRoundScene = Object.freeze({ mount });
})();
