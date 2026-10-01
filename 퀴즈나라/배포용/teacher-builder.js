/* Teacher question authoring. Persistence belongs to the host's onSave/onNext callbacks. */
(function (global) {
  'use strict';
  const MODES = {
    sequence: { name: '차례차례 탐험', icon: 'route', description: '정해진 길을 따라 한 문제씩 해결해요.' },
    free: { name: '자유 탐험', icon: 'compass', description: '마음에 드는 문제부터 자유롭게 찾아 풀어요.' },
    round: { name: '라운드 퀴즈', icon: 'clock', description: '선생님이 한 문제씩 함께 보여 줘요.' },
    team: { name: '팀 대항 탐험', icon: 'flag', description: '각자 문제를 풀며 우리 팀의 점수를 모아요.' },
    coop: { name: '우리 반 협동', icon: 'people', description: '각자 해결한 문제로 우리 반 목표를 채워요.' }
  };
  const TYPES = {
    choice: { name: '객관식', icon: 'check', description: '보기 중 정답 하나를 골라요.' },
    short: { name: '주관식', icon: 'pencil', description: '정답을 직접 써요. 여러 정답도 받을 수 있어요.' },
    match: { name: '선 잇기', icon: 'link', description: '서로 맞는 두 항목을 선으로 연결해요.' },
    order: { name: '순서 맞추기', icon: 'sort', description: '섞인 항목을 올바른 순서로 놓아요.' }
  };
  const icons = {
    route: '<path d="M5 5h12v6H7v8h12M5 5l2-2M5 5l2 2M19 19l-2-2M19 19l-2 2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    flag: '<path d="M5 21V3c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
    people: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2 20v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',
    pencil: '<path d="m4 16 12-12 4 4-12 12-5 1zM14 6l4 4M4 16l4 4"/>',
    link: '<circle cx="4" cy="5" r="2"/><circle cx="20" cy="19" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="5" r="2"/><path d="m6 6 12 12M6 18 18 6"/>',
    sort: '<path d="M8 4v16m-4-4 4 4 4-4M15 5h6M15 12h4M15 19h2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    save: '<path d="M4 3h13l4 4v14H3V3zM7 3v7h10V3M7 21v-7h10v7"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>'
  };
  const icon = name => '<svg class="qpb-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (icons[name] || icons.pencil) + '</svg>';
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const copy = value => JSON.parse(JSON.stringify(value));
  let serial = 0;
  const newId = () => 'q_' + Date.now().toString(36) + '_' + (++serial).toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  function mount(container, options) {
    if (!container || !global.QPQuizQuestions) throw new Error('문제 편집기를 준비할 수 없어요.');
    const opts = options || {}, questions = global.QPQuizQuestions;
    const source = opts.set || {};
    const data = Object.assign({}, copy(source), {
      id: source.id || 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
      made: source.made || Date.now(), title: String(source.title || ''),
      qs: (source.qs || []).map(q => questions.normalize(q))
    });
    const ids = new Set();
    data.qs.forEach(q => { if (ids.has(q.id)) q.id = newId(); ids.add(q.id); });
    let mode = MODES[opts.mode] ? opts.mode : MODES[data.mode] ? data.mode : null;
    let selected = data.qs.length ? 0 : -1, preview = true, busy = false, destroyed = false;
    let answerView = null, previewTimer = null, undo = null, dragIndex = null, dirty = !source.id;
    const node = document.createElement('section');
    node.className = 'qpb-builder';
    container.appendChild(node);
    const find = selector => node.querySelector(selector);
    const selectedQ = () => data.qs[selected] || null;
    const stopPreview = () => { if (answerView) answerView.destroy(); answerView = null; clearTimeout(previewTimer); };

    function blankQuestion(type) {
      const q = { id: newId(), type, q: '' };
      if (type === 'choice') Object.assign(q, { a: '', c: ['', '', ''] });
      if (type === 'short') Object.assign(q, { a: '', aliases: [] });
      if (type === 'match') Object.assign(q, { pairs: [{ left: '', right: '' }, { left: '', right: '' }] });
      if (type === 'order') Object.assign(q, { items: ['', '', ''] });
      return q;
    }
    function markDirty() {
      dirty = true;
      const state = find('[data-save-state]');
      if (state) { state.textContent = '아직 저장하지 않은 변경'; state.className = 'qpb-save-state'; }
    }
    function status(message, error) {
      const box = find('[data-status]');
      if (box) { box.textContent = message; box.classList.toggle('is-error', !!error); }
    }
    function revealSelected() {
      if (destroyed) return;
      const list = find('[data-question-list]'), active = list && list.querySelector('.is-selected');
      if (!active) return;
      const bounds = list.getBoundingClientRect(), card = active.getBoundingClientRect();
      if (card.bottom > bounds.bottom) list.scrollTop += card.bottom - bounds.bottom + 4;
      if (card.top < bounds.top) list.scrollTop += card.top - bounds.top - 4;
      if (card.right > bounds.right) list.scrollLeft += card.right - bounds.right + 4;
      if (card.left < bounds.left) list.scrollLeft += card.left - bounds.left - 4;
    }
    function updateSidebar(savedScroll) {
      const list = find('[data-question-list]');
      if (!list) return;
      const scroll = savedScroll === undefined ? list.scrollTop : savedScroll;
      list.innerHTML = data.qs.length ? data.qs.map((q, i) => {
        const type = TYPES[q.type] || TYPES.short, error = questions.validate(q);
        return '<button type="button" class="qpb-question-card ' + (i === selected ? 'is-selected' : '') + '" data-select="' + i + '" draggable="true" aria-current="' + (i === selected ? 'true' : 'false') + '" aria-label="' + (i + 1) + '번 ' + escape(q.q || '새 문제') + '">' +
          '<span class="qpb-question-number">' + (i + 1) + '</span><span class="qpb-question-summary"><span>' + escape(q.q || '문제를 입력해 주세요') + '</span><small>' + type.name + (error ? ' · 작성 중' : ' · 준비 완료') + '</small></span>' +
          '<span class="qpb-card-indicator ' + (error ? 'is-incomplete' : '') + '" aria-hidden="true">' + (error ? '·' : '✓') + '</span></button>';
      }).join('') : '<div class="qpb-empty-list">아래에서 문제 유형을 골라<br>첫 문제를 만들어 주세요.</div>';
      list.scrollTop = scroll;
      revealSelected();
      const count = find('[data-count]');
      if (count) count.textContent = data.qs.length + '문제';
    }
    function field(label, value, attributes, helper) {
      return '<label class="qpb-field"><span>' + label + '</span><input class="inp" value="' + escape(value) + '" ' + attributes + '>' + (helper ? '<small>' + helper + '</small>' : '') + '</label>';
    }
    function answerFields(q) {
      if (q.type === 'choice') return '<div class="qpb-section-title">보기 만들기 <small>학생에게는 순서를 섞어서 보여 줘요.</small></div>' +
        '<div class="qpb-option-row is-correct"><span class="qpb-option-badge">정답</span><input class="inp" data-field="a" value="' + escape(q.a) + '" placeholder="정답 보기" maxlength="500" aria-label="정답 보기"></div>' +
        (q.c || []).map((a, i) => '<div class="qpb-option-row"><span class="qpb-option-badge">오답 ' + (i + 1) + '</span><input class="inp" data-field="choice" data-row="' + i + '" value="' + escape(a) + '" placeholder="오답 보기" maxlength="500" aria-label="오답 보기 ' + (i + 1) + '"><button class="qpb-mini" data-action="remove-choice" data-row="' + i + '" ' + (q.c.length <= 1 ? 'disabled' : '') + ' aria-label="오답 보기 ' + (i + 1) + ' 삭제">×</button></div>').join('') +
        '<button class="qpb-add-row" data-action="add-choice">' + icon('plus') + ' 보기 추가</button>';
      if (q.type === 'short') return field('정답', q.a, 'data-field="a" maxlength="800" placeholder="예) 한글 / 훈민정음"', '같은 뜻의 정답은 / 로 나누어 적어 주세요. 띄어쓰기와 대소문자를 구분하지 않아요.') +
        field('추가로 인정할 답 (선택)', (q.aliases || []).join(', '), 'data-field="aliases" placeholder="예) 우리글, 한글 문자" maxlength="800"', '추가 답은 쉼표 또는 / 로 나누어 적을 수 있어요.');
      if (q.type === 'match') return '<div class="qpb-section-title">정답 짝 만들기 <small>같은 줄의 왼쪽과 오른쪽이 정답이에요.</small></div><div class="qpb-pair-head"><span>왼쪽 항목</span><span>오른쪽 짝</span></div>' +
        (q.pairs || []).map((pair, i) => '<div class="qpb-pair-row"><span class="qpb-row-number">' + (i + 1) + '</span><input class="inp" data-field="left" data-row="' + i + '" value="' + escape(pair.left) + '" placeholder="예) 강아지" maxlength="500" aria-label="' + (i + 1) + '번 왼쪽 항목"><span class="qpb-pair-arrow" aria-hidden="true">↔</span><input class="inp" data-field="right" data-row="' + i + '" value="' + escape(pair.right) + '" placeholder="예) 멍멍" maxlength="500" aria-label="' + (i + 1) + '번 오른쪽 짝"><button class="qpb-mini" data-action="remove-pair" data-row="' + i + '" ' + (q.pairs.length <= 2 ? 'disabled' : '') + ' aria-label="' + (i + 1) + '번 짝 삭제">×</button></div>').join('') +
        '<button class="qpb-add-row" data-action="add-pair">' + icon('plus') + ' 짝 추가</button><p class="qpb-note">학생은 섞인 오른쪽 항목을 골라 실제 선으로 연결해요.</p>';
      return '<div class="qpb-section-title">정답 순서 만들기 <small>첫 번째부터 올바른 순서대로 적어 주세요.</small></div>' +
        (q.items || []).map((item, i) => '<div class="qpb-order-row"><span class="qpb-row-number">' + (i + 1) + '</span><input class="inp" data-field="item" data-row="' + i + '" value="' + escape(item) + '" placeholder="' + (i + 1) + '번째 항목" maxlength="500" aria-label="정답 순서 ' + (i + 1) + '번"><button class="qpb-mini" data-action="item-up" data-row="' + i + '" ' + (i === 0 ? 'disabled' : '') + ' aria-label="' + (i + 1) + '번 항목 위로 이동">↑</button><button class="qpb-mini" data-action="item-down" data-row="' + i + '" ' + (i === q.items.length - 1 ? 'disabled' : '') + ' aria-label="' + (i + 1) + '번 항목 아래로 이동">↓</button><button class="qpb-mini" data-action="remove-item" data-row="' + i + '" ' + (q.items.length <= 2 ? 'disabled' : '') + ' aria-label="' + (i + 1) + '번 항목 삭제">×</button></div>').join('') +
        '<button class="qpb-add-row" data-action="add-item">' + icon('plus') + ' 항목 추가</button><p class="qpb-note">학생에게는 항목을 섞어서 보여 주고 직접 순서를 바꾸게 해요.</p>';
    }
    function renderModes() {
      stopPreview();
      node.innerHTML = '<div class="qpb-mode-page"><button class="btn gray sm" data-action="back">' + icon('back') + ' 묶음 목록</button><div class="qpb-mode-heading"><span class="qpb-step-label">1 / 3 · 놀이 방식</span><h1>어떻게 퀴즈를 풀까요?</h1><p>놀이 방식을 고르면 바로 문제를 만들 수 있어요.</p></div><div class="qpb-mode-grid">' +
        Object.keys(MODES).map(key => '<button class="qpb-mode-card" data-mode="' + key + '"><span class="qpb-mode-icon">' + icon(MODES[key].icon) + '</span><h2>' + MODES[key].name + '</h2><p>' + MODES[key].description + '</p><span class="qpb-mode-start">문제 만들기 ' + icon('arrow') + '</span></button>').join('') +
        '</div><p class="qpb-mode-note">모든 방식은 실시간 수업과 나중에 혼자 풀기에서 사용할 수 있어요.<br>틀린 문제는 남아 있으니 다시 도전할 수 있어요.</p></div>';
    }
    function render() {
      if (destroyed) return;
      if (!mode) { renderModes(); return; }
      const previousList = find('[data-question-list]'), previousEditor = find('.qpb-editor');
      const listScroll = previousList ? previousList.scrollTop : 0;
      const editorScroll = previousEditor && selectedQ() && previousEditor.dataset.questionId === selectedQ().id ? previousEditor.scrollTop : 0;
      stopPreview();
      const q = selectedQ(), info = q && (TYPES[q.type] || TYPES.short);
      node.innerHTML = '<header class="qpb-toolbar"><button class="btn gray sm qpb-back" data-action="back" aria-label="묶음 목록으로">' + icon('back') + '</button><div class="qpb-title-area"><label class="qpb-title-label">퀴즈 제목<input class="inp qpb-title" data-field="title" value="' + escape(data.title) + '" placeholder="퀴즈 제목을 적어 주세요" maxlength="80" aria-label="퀴즈 제목"></label><span data-save-state class="qpb-save-state ' + (!dirty ? 'is-saved' : '') + '">' + (dirty ? '아직 저장하지 않은 변경' : '저장된 문제 묶음') + '</span></div><div class="qpb-toolbar-actions"><button class="btn gray sm" data-action="preview" aria-pressed="' + preview + '">' + icon('eye') + ' 미리보기</button><button class="btn sm" data-action="save">' + icon('save') + ' 저장</button><button class="btn g" data-action="next">설정으로 다음 ' + icon('arrow') + '</button></div></header>' +
        '<div class="qpb-stepbar"><span class="qpb-step-done">1 놀이 방식</span><span class="qpb-step-current">2 문제 만들기</span><span>3 수업 설정</span><button class="qpb-mode-chip" data-action="mode">' + icon(MODES[mode].icon) + ' ' + MODES[mode].name + ' 변경</button></div>' +
        '<div class="qpb-layout"><aside class="qpb-sidebar"><div class="qpb-sidebar-title"><h2>문제 목록</h2><span data-count></span></div><div class="qpb-question-list" data-question-list></div><div class="qpb-add-types"><h3>문제 추가</h3>' +
        Object.keys(TYPES).map(type => '<button class="qpb-type-add" data-add="' + type + '">' + icon(TYPES[type].icon) + '<span>' + TYPES[type].name + '</span>' + icon('plus') + '</button>').join('') +
        '</div></aside><div class="qpb-workspace ' + (preview ? 'has-preview' : '') + '"><main class="qpb-editor" data-question-id="' + escape(q && q.id || '') + '">' + (q ?
          '<div class="qpb-editor-heading"><div><span class="qpb-step-label">' + (selected + 1) + '번 문제</span><h2>' + icon(info.icon) + ' ' + info.name + '</h2></div><div class="qpb-question-tools"><button class="qpb-mini" data-action="up" ' + (selected <= 0 ? 'disabled' : '') + ' aria-label="문제 위로 이동" title="문제 위로 이동">↑</button><button class="qpb-mini" data-action="down" ' + (selected >= data.qs.length - 1 ? 'disabled' : '') + ' aria-label="문제 아래로 이동" title="문제 아래로 이동">↓</button><button class="qpb-mini" data-action="duplicate" aria-label="문제 복제" title="문제 복제">' + icon('copy') + '</button><button class="qpb-mini is-danger" data-action="delete" aria-label="문제 삭제" title="문제 삭제">' + icon('trash') + '</button></div></div><label class="qpb-field qpb-type-field"><span>문제 유형</span><select class="inp" data-field="type">' + Object.keys(TYPES).map(type => '<option value="' + type + '" ' + (q.type === type ? 'selected' : '') + '>' + TYPES[type].name + '</option>').join('') + '</select></label><label class="qpb-field"><span>문제 <small>학생에게 보여 줄 질문을 적어 주세요.</small></span><textarea class="inp qpb-question-input" data-field="q" placeholder="예) 물이 얼면 무엇이 될까요?" maxlength="2000" rows="3">' + escape(q.q) + '</textarea></label><div class="qpb-answer-fields">' + answerFields(q) + '</div><div class="qpb-question-validation" data-validation role="status"></div>' :
          '<div class="qpb-empty-editor"><span class="qpb-empty-icon">' + icon('pencil') + '</span><h2>첫 문제를 만들어 볼까요?</h2><p>왼쪽에서 객관식, 주관식, 선 잇기,<br>순서 맞추기 중 하나를 골라 주세요.</p><button class="btn g" data-add="choice">' + icon('plus') + ' 객관식 문제 추가</button></div>') +
        '</main>' + (preview ? '<aside class="qpb-preview-panel"><div class="qpb-preview-heading">' + icon('eye') + '<h2>학생 화면 미리보기</h2></div><p class="qpb-note">직접 답하며 문제를 확인해 보세요.</p><div class="qpb-preview-content" data-preview></div><div class="qpb-preview-feedback" data-preview-feedback role="status"></div></aside>' : '') +
        '</div></div><footer class="qpb-footer"><div data-status role="status">' + (undo ? '문제를 삭제했어요. 되돌릴 수 있어요.' : '문제 카드로 이동하거나 끌어서 순서를 바꿀 수 있어요.') + '</div>' + (undo ? '<button class="qpb-undo" data-action="undo">삭제 되돌리기</button>' : '') + '<span>실시간 수업 · 나중에 혼자 풀기</span></footer>';
      updateSidebar(listScroll); updateValidation(); renderPreview();
      const editor = find('.qpb-editor'); if (editor) editor.scrollTop = editorScroll;
    }
    function updateValidation() {
      const box = find('[data-validation]'), q = selectedQ();
      if (box && q) { const error = questions.validate(q); box.textContent = error || '이 문제는 준비됐어요.'; box.classList.toggle('is-ready', !error); }
    }
    function renderPreview() {
      stopPreview();
      const panel = find('[data-preview]'), q = selectedQ();
      if (!panel) return;
      panel.innerHTML = '';
      const feedback = find('[data-preview-feedback]');
      if (feedback) { feedback.textContent = ''; feedback.className = 'qpb-preview-feedback'; }
      if (!q) { panel.innerHTML = '<div class="qpb-preview-empty">문제를 추가하면<br>학생 화면이 여기에 보여요.</div>'; return; }
      const heading = document.createElement('h3');
      heading.className = 'qpb-preview-question'; heading.textContent = q.q || '질문을 입력해 주세요.'; panel.appendChild(heading);
      const error = questions.validate(q);
      if (error) { const message = document.createElement('p'); message.className = 'qpb-preview-empty'; message.textContent = '문제와 정답을 채우면 직접 풀어 볼 수 있어요.'; panel.appendChild(message); return; }
      const answer = document.createElement('div'); panel.appendChild(answer);
      answerView = questions.mountAnswer(answer, copy(q), { onSubmit(value) {
        if (destroyed) return;
        const correct = questions.grade(q, value);
        const box = find('[data-preview-feedback]');
        if (box) { box.className = 'qpb-preview-feedback ' + (correct ? 'is-correct' : 'is-wrong'); box.textContent = correct ? '정답이에요! 실제 수업에서는 이 문제가 완료돼요.' : '아직 정답이 아니에요. 답을 바꿔 다시 도전해 보세요.'; }
      } });
    }
    function focusQuestion() { const input = find('[data-field="q"]'); if (input) input.focus(); }
    function moveQuestion(from, to) {
      if (from < 0 || to < 0 || from >= data.qs.length || to >= data.qs.length || from === to) return;
      const chosen = selectedQ();
      data.qs.splice(to, 0, data.qs.splice(from, 1)[0]);
      selected = data.qs.indexOf(chosen); markDirty(); render();
    }
    function snapshot() {
      const result = Object.assign({}, copy(data), { title: data.title.trim(), mode, qs: data.qs.map(q => questions.normalize(q)) });
      if (!result.id) result.id = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      if (!result.made) result.made = Date.now();
      return result;
    }
    function validateAll() {
      if (!data.title.trim()) { status('퀴즈 제목을 적어 주세요.', true); const title = find('[data-field="title"]'); if (title) title.focus(); return false; }
      if (!data.qs.length) { status('문제를 하나 이상 만들어 주세요.', true); return false; }
      const bad = data.qs.findIndex(q => questions.validate(q));
      if (bad >= 0) { selected = bad; render(); status((bad + 1) + '번 문제: ' + questions.validate(data.qs[bad]), true); focusQuestion(); return false; }
      return true;
    }
    async function persist(next) {
      if (busy || !validateAll()) return;
      const callback = next ? opts.onNext : opts.onSave;
      if (typeof callback !== 'function') { status(next ? '수업 설정 연결이 준비되지 않았어요.' : '저장 연결이 준비되지 않았어요.', true); return; }
      busy = true;
      node.setAttribute('aria-busy', 'true');
      const controls = Array.from(node.querySelectorAll('button, input, textarea, select')).filter(control => !control.disabled);
      controls.forEach(control => { control.disabled = true; });
      status(next ? '문제를 확인하고 설정 화면을 준비해요…' : '문제 묶음을 저장하고 있어요…');
      const updated = snapshot();
      try {
        await callback(copy(updated));
        if (destroyed) return;
        Object.assign(data, updated); dirty = false;
        const state = find('[data-save-state]');
        if (state) { state.textContent = '모든 변경을 저장했어요'; state.className = 'qpb-save-state is-saved'; }
        status(next ? '문제가 준비됐어요.' : '문제 묶음을 저장했어요.');
      } catch (error) {
        if (!destroyed) status((next ? '설정을 열지 못했어요. ' : '저장하지 못했어요. ') + '입력한 내용은 그대로 있어요. ' + String(error && error.message || '연결을 확인하고 다시 시도해 주세요.').slice(0, 180), true);
      } finally {
        busy = false;
        if (!destroyed) { node.removeAttribute('aria-busy'); controls.forEach(control => { if (node.contains(control)) control.disabled = false; }); }
      }
    }
    function input(event) {
      if (busy) return;
      const target = event.target, key = target.dataset.field;
      if (!key || key === 'type') return;
      if (key === 'title') { data.title = target.value; markDirty(); return; }
      const q = selectedQ(); if (!q) return;
      const row = Number(target.dataset.row);
      if (key === 'q' || key === 'a') q[key] = target.value;
      if (key === 'aliases') q.aliases = target.value.split(/[,/\n]/).map(value => value.trim()).filter(Boolean);
      if (key === 'choice') q.c[row] = target.value;
      if (key === 'left' || key === 'right') q.pairs[row][key] = target.value;
      if (key === 'item') q.items[row] = target.value;
      markDirty(); updateSidebar(); updateValidation();
      clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 220);
    }
    function change(event) {
      if (busy || event.target.dataset.field !== 'type') return;
      const q = selectedQ(), type = event.target.value;
      if (!q || !TYPES[type] || type === q.type) return;
      const replacement = blankQuestion(type); replacement.id = q.id; replacement.q = q.q;
      if ((type === 'short' || type === 'choice') && q.a) replacement.a = q.a;
      data.qs[selected] = replacement; markDirty(); render();
    }
    function click(event) {
      const button = event.target.closest('button');
      if (!button || !node.contains(button) || button.disabled || busy) return;
      if (button.dataset.mode) { mode = button.dataset.mode; data.mode = mode; markDirty(); render(); return; }
      if (button.dataset.select !== undefined) { selected = Number(button.dataset.select); render(); return; }
      if (button.dataset.add) { const type = button.dataset.add; if (!TYPES[type]) return; data.qs.push(blankQuestion(type)); selected = data.qs.length - 1; markDirty(); render(); focusQuestion(); return; }
      const action = button.dataset.action, q = selectedQ(), row = Number(button.dataset.row);
      if (action === 'back') { if (typeof opts.onBack === 'function') opts.onBack(copy(data)); return; }
      if (action === 'mode') { mode = null; render(); return; }
      if (action === 'preview') { preview = !preview; render(); return; }
      if (action === 'save' || action === 'next') { persist(action === 'next'); return; }
      if (action === 'undo' && undo) { data.qs.splice(Math.min(undo.index, data.qs.length), 0, undo.question); selected = data.qs.indexOf(undo.question); undo = null; markDirty(); render(); return; }
      if (!q) return;
      if (action === 'up' || action === 'down') { moveQuestion(selected, selected + (action === 'up' ? -1 : 1)); return; }
      if (action === 'duplicate') { const duplicate = copy(q); duplicate.id = newId(); data.qs.splice(selected + 1, 0, duplicate); selected++; markDirty(); render(); return; }
      if (action === 'delete') { undo = { index: selected, question: data.qs.splice(selected, 1)[0] }; selected = Math.min(selected, data.qs.length - 1); markDirty(); render(); return; }
      if (action === 'add-choice') q.c.push('');
      if (action === 'remove-choice' && q.c.length > 1) q.c.splice(row, 1);
      if (action === 'add-pair') q.pairs.push({ left: '', right: '' });
      if (action === 'remove-pair' && q.pairs.length > 2) q.pairs.splice(row, 1);
      if (action === 'add-item') q.items.push('');
      if (action === 'remove-item' && q.items.length > 2) q.items.splice(row, 1);
      if (action === 'item-up' && row > 0) [q.items[row - 1], q.items[row]] = [q.items[row], q.items[row - 1]];
      if (action === 'item-down' && row < q.items.length - 1) [q.items[row + 1], q.items[row]] = [q.items[row], q.items[row + 1]];
      if (/^(add-|remove-|item-)/.test(action || '')) { markDirty(); render(); }
    }
    function dragStart(event) {
      const card = event.target.closest('[data-select]');
      if (!card || busy) return;
      dragIndex = Number(card.dataset.select);
      if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(dragIndex)); }
      card.classList.add('is-dragging');
    }
    function dragOver(event) { if (dragIndex !== null && event.target.closest('[data-select]')) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; } }
    function drop(event) { const card = event.target.closest('[data-select]'); if (dragIndex !== null && card) { event.preventDefault(); moveQuestion(dragIndex, Number(card.dataset.select)); } dragIndex = null; }
    function dragEnd() { dragIndex = null; node.querySelectorAll('.is-dragging').forEach(card => card.classList.remove('is-dragging')); }
    const listeners = { input, change, click, dragstart: dragStart, dragover: dragOver, drop, dragend: dragEnd };
    Object.keys(listeners).forEach(type => node.addEventListener(type, listeners[type]));
    const resizeObserver = typeof global.ResizeObserver === 'function' ? new global.ResizeObserver(revealSelected) : null;
    if (resizeObserver) resizeObserver.observe(node);
    global.addEventListener('resize', revealSelected);
    render();
    return { destroy() { if (destroyed) return; destroyed = true; stopPreview(); if (resizeObserver) resizeObserver.disconnect(); global.removeEventListener('resize', revealSelected); Object.keys(listeners).forEach(type => node.removeEventListener(type, listeners[type])); node.remove(); } };
  }
  global.QPTeacherBuilder = Object.freeze({ mount });
})(window);
