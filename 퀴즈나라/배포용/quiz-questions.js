(function (global) {
  'use strict';

  const rawIds = new WeakMap();
  const mounted = new WeakMap();
  let nextId = 0;
  const types = ['choice', 'short', 'match', 'order'];
  const asText = value => value == null ? '' : String(value);
  const trimText = value => asText(value).trim();
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function questionId(source) {
    const supplied = trimText(source.id);
    if (supplied) return supplied;
    if (rawIds.has(source)) return rawIds.get(source);
    const id = global.crypto && typeof global.crypto.randomUUID === 'function'
      ? 'q-' + global.crypto.randomUUID()
      : 'q-' + Date.now().toString(36) + '-' + (++nextId).toString(36) + '-' + Math.random().toString(36).slice(2, 9);
    rawIds.set(source, id);
    return id;
  }

  // Keep unfinished editor rows, and never change the caller's stored question.
  function normalize(question) {
    const source = record(question) ? question : {};
    const c = Array.isArray(source.c) ? Array.from(source.c, trimText) : [];
    const type = trimText(source.type).toLowerCase() || (c.length ? 'choice' : 'short');
    const result = Object.assign({}, source, {
      id: questionId(source), type, q: trimText(source.q), a: trimText(source.a), c
    });
    if (type === 'short') {
      result.aliases = Array.isArray(source.aliases) ? Array.from(source.aliases, trimText) : [];
    } else if (type === 'match') {
      result.a = '';
      result.c = [];
      result.pairs = Array.isArray(source.pairs) ? Array.from(source.pairs, pair => ({
        left: trimText(record(pair) ? pair.left : ''),
        right: trimText(record(pair) ? pair.right : '')
      })) : [];
    } else if (type === 'order') {
      result.a = '';
      result.c = [];
      result.items = Array.isArray(source.items) ? Array.from(source.items, trimText) : [];
    }
    return result;
  }

  // Match the existing classroom's forgiving short-answer comparison.
  function answerKey(value) {
    return asText(value)
      .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/[\s\u200b]/g, '')
      .replace(/[.,!?~"'`·…“”‘’(){}\[\]<>]/g, '')
      .toLowerCase();
  }

  function answerAliases(question) {
    return question.a.split('/').concat(question.type === 'short' ? question.aliases : [])
      .flatMap(value => asText(value).split('/')).map(answerKey).filter(Boolean);
  }

  function unique(values) {
    return new Set(values).size === values.length;
  }

  function validate(question) {
    const q = normalize(question);
    if (!types.includes(q.type)) return '문제 유형을 선택해 주세요.';
    if (!q.q) return '문제 내용을 입력해 주세요.';
    if (q.type === 'choice' || q.type === 'short') {
      if (!answerAliases(q).length || !answerKey(q.a.split('/')[0])) return '정답을 입력해 주세요.';
      if (q.type === 'short') {
        if (q.aliases.some(alias => !answerKey(alias))) return '추가 정답의 빈칸을 채우거나 삭제해 주세요.';
        return null;
      }
      if (!q.c.length) return '오답 보기를 한 개 이상 입력해 주세요.';
      if (q.c.some(option => !answerKey(option))) return '오답 보기의 빈칸을 채워 주세요.';
      const wrongKeys = q.c.map(answerKey);
      if (!unique(wrongKeys) || wrongKeys.some(key => answerAliases(q).includes(key))) {
        return '정답과 오답 보기는 서로 달라야 합니다.';
      }
      return null;
    }
    if (q.type === 'match') {
      if (q.pairs.length < 2) return '연결할 짝을 두 개 이상 입력해 주세요.';
      if (q.pairs.some(pair => !pair.left || !pair.right)) return '모든 짝의 왼쪽과 오른쪽 내용을 입력해 주세요.';
      if (!unique(q.pairs.map(pair => answerKey(pair.left))) || !unique(q.pairs.map(pair => answerKey(pair.right)))) {
        return '왼쪽 항목과 오른쪽 항목은 각각 서로 달라야 합니다.';
      }
      return null;
    }
    if (q.items.length < 2) return '순서를 맞출 항목을 두 개 이상 입력해 주세요.';
    if (q.items.some(item => !item)) return '순서 항목의 빈칸을 채워 주세요.';
    if (!unique(q.items.map(answerKey))) return '순서 항목은 서로 달라야 합니다.';
    return null;
  }

  function grade(question, answer) {
    const q = normalize(question);
    if (validate(q)) return false;
    if (q.type === 'choice' || q.type === 'short') {
      if (typeof answer !== 'string' && typeof answer !== 'number') return false;
      const key = answerKey(answer);
      return Boolean(key) && answerAliases(q).includes(key);
    }
    const count = q.type === 'match' ? q.pairs.length : q.items.length;
    if (!Array.isArray(answer) || answer.length !== count) return false;
    for (let index = 0; index < count; index++) {
      if (!Object.prototype.hasOwnProperty.call(answer, index) || !Number.isInteger(answer[index]) || answer[index] !== index) return false;
    }
    return true;
  }

  function shuffledIndices(length) {
    const indices = Array.from({length}, (_, index) => index);
    for (let index = length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [indices[index], indices[other]] = [indices[other], indices[index]];
    }
    if (length > 1 && indices.every((value, index) => value === index)) indices.push(indices.shift());
    return indices;
  }

  function mountAnswer(container, question, options) {
    if (!container || typeof container.replaceChildren !== 'function') throw new TypeError('답안 영역이 필요합니다.');
    const previous = mounted.get(container);
    if (previous) previous.destroy();
    const q = normalize(question);
    const settings = options || {};
    const doc = container.ownerDocument;
    const view = doc.defaultView || global;
    const cleanup = [];
    let destroyed = false;
    const disabled = () => destroyed || Boolean(settings.disabled);

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = asText(text);
      return node;
    }
    function listen(node, event, callback) {
      node.addEventListener(event, callback);
      cleanup.push(() => node.removeEventListener(event, callback));
    }
    function button(className, text, callback) {
      const node = element('button', className, text);
      node.type = 'button';
      node.disabled = disabled();
      if (callback) listen(node, 'click', event => {
        if (!disabled() && !node.disabled) callback(event);
      });
      return node;
    }
    function submit(answer) {
      if (!disabled() && typeof settings.onSubmit === 'function') settings.onSubmit(answer);
    }
    function help(text) {
      root.appendChild(element('p', 'qpq-help', text));
    }

    const root = element('div', 'qpq-answer qpq-type-' + (types.includes(q.type) ? q.type : 'invalid'));
    root.dataset.questionId = q.id;
    root.setAttribute('aria-disabled', String(disabled()));
    container.replaceChildren(root);
    const controller = {
      destroy() {
        if (destroyed) return;
        destroyed = true;
        cleanup.splice(0).forEach(dispose => dispose());
        root.remove();
        if (mounted.get(container) === controller) mounted.delete(container);
      }
    };
    mounted.set(container, controller);

    if (!types.includes(q.type)) {
      help('문제 유형을 확인해 주세요.');
      return controller;
    }

    if (q.type === 'choice') {
      help('정답 보기를 눌러 답을 보내세요.');
      const list = element('div', 'qpq-choice-list');
      const choices = [q.a.split('/')[0].trim()].concat(q.c);
      const buttons = [];
      shuffledIndices(choices.length).forEach((originalIndex, displayIndex) => {
        const option = choices[originalIndex];
        const choice = button('qpq-choice ch', '', () => {
          buttons.forEach(node => {
            node.classList.toggle('is-selected', node === choice);
            node.setAttribute('aria-pressed', String(node === choice));
          });
          submit(option);
        });
        choice.setAttribute('aria-pressed', 'false');
        choice.appendChild(element('span', 'qpq-choice-number n', displayIndex + 1));
        choice.appendChild(element('span', 'qpq-choice-text', option));
        buttons.push(choice);
        list.appendChild(choice);
      });
      root.appendChild(list);
      return controller;
    }

    if (q.type === 'short') {
      help('답을 쓰고 Enter 또는 답 보내기를 누르세요.');
      const actions = element('div', 'qpq-actions');
      const input = element('input', 'qpq-short-input inp');
      input.type = 'text';
      input.autocomplete = 'off';
      input.placeholder = '답을 여기에 쓰세요';
      input.setAttribute('aria-label', '정답 입력');
      input.disabled = disabled();
      const send = button('qpq-submit btn y', '답 보내기', () => {
        if (!input.disabled && input.value.trim()) submit(input.value);
      });
      listen(input, 'keydown', event => {
        if (event.key === 'Enter' && !event.isComposing && !input.disabled && !send.disabled && !disabled()) {
          event.preventDefault();
          if (input.value.trim()) submit(input.value);
        }
      });
      actions.append(input, send);
      root.appendChild(actions);
      return controller;
    }

    if (q.type === 'match') {
      help('왼쪽 항목과 짝이 되는 오른쪽 항목을 눌러 선으로 연결하세요. 다시 연결할 수 있어요.');
      const board = element('div', 'qpq-match-board');
      board.style.position = 'relative';
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'qpq-match-svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.position = 'absolute';
      svg.style.inset = '0';
      svg.style.pointerEvents = 'none';
      const columns = element('div', 'qpq-match-columns');
      const leftColumn = element('div', 'qpq-match-column qpq-match-left');
      const rightColumn = element('div', 'qpq-match-column qpq-match-right');
      leftColumn.setAttribute('role', 'group');
      leftColumn.setAttribute('aria-label', '왼쪽 항목');
      rightColumn.setAttribute('role', 'group');
      rightColumn.setAttribute('aria-label', '오른쪽 항목');
      const leftButtons = [], rightButtons = [];
      const connections = q.pairs.map(() => null);
      let selectedLeft = null, selectedRight = null, frame = null;
      const status = element('p', 'qpq-match-status');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const actions = element('div', 'qpq-actions');
      const send = button('qpq-submit btn y', '답 보내기', () => {
        if (connections.length >= 2 && connections.every(Number.isInteger)) submit(connections.slice());
      });
      const clear = button('qpq-clear btn ghost', '연결 지우기', () => {
        connections.fill(null);
        selectedLeft = selectedRight = null;
        update();
      });

      function draw() {
        frame = null;
        if (destroyed) return;
        const bounds = board.getBoundingClientRect();
        svg.setAttribute('viewBox', '0 0 ' + Math.max(1, bounds.width) + ' ' + Math.max(1, bounds.height));
        svg.replaceChildren();
        connections.forEach((rightIndex, leftIndex) => {
          if (!Number.isInteger(rightIndex)) return;
          const left = leftButtons[leftIndex].getBoundingClientRect();
          const right = rightButtons[rightIndex].getBoundingClientRect();
          const x1 = left.right - bounds.left, y1 = left.top + left.height / 2 - bounds.top;
          const x2 = right.left - bounds.left, y2 = right.top + right.height / 2 - bounds.top;
          const middle = (x1 + x2) / 2;
          const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'qpq-match-line');
          path.setAttribute('fill', 'none');
          path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + middle + ' ' + y1 + ' ' + middle + ' ' + y2 + ' ' + x2 + ' ' + y2);
          path.dataset.connectionLeft = String(leftIndex);
          path.dataset.connectionRight = String(rightIndex);
          svg.appendChild(path);
        });
      }
      function queueDraw() {
        if (destroyed || frame !== null) return;
        if (typeof view.requestAnimationFrame === 'function') frame = view.requestAnimationFrame(draw);
        else draw();
      }
      function update() {
        leftButtons.forEach((node, index) => {
          node.classList.toggle('is-selected', selectedLeft === index);
          node.classList.toggle('is-connected', Number.isInteger(connections[index]));
          node.setAttribute('aria-pressed', String(selectedLeft === index));
          const rightIndex = connections[index];
          node.setAttribute('aria-label', '왼쪽 ' + (index + 1) + ' ' + q.pairs[index].left + (Number.isInteger(rightIndex) ? ', 연결: ' + q.pairs[rightIndex].right : ''));
        });
        rightButtons.forEach((node, index) => {
          node.classList.toggle('is-selected', selectedRight === index);
          node.classList.toggle('is-connected', connections.includes(index));
          node.setAttribute('aria-pressed', String(selectedRight === index));
          const leftIndex = connections.indexOf(index);
          node.setAttribute('aria-label', '오른쪽 ' + q.pairs[index].right + (leftIndex >= 0 ? ', 연결: ' + q.pairs[leftIndex].left : ''));
        });
        const count = connections.filter(Number.isInteger).length;
        status.textContent = '연결 ' + count + ' / ' + connections.length + (selectedLeft !== null ? ' · 오른쪽 짝을 선택하세요.' : selectedRight !== null ? ' · 왼쪽 짝을 선택하세요.' : '');
        send.disabled = disabled() || connections.length < 2 || count !== connections.length;
        queueDraw();
      }
      function connect() {
        if (selectedLeft === null || selectedRight === null) return;
        const previousLeft = connections.indexOf(selectedRight);
        if (previousLeft >= 0) connections[previousLeft] = null;
        connections[selectedLeft] = selectedRight;
        selectedLeft = selectedRight = null;
      }
      q.pairs.forEach((pair, index) => {
        const node = button('qpq-match-item qpq-match-left-item', pair.left, () => {
          selectedLeft = selectedLeft === index ? null : index;
          connect();
          update();
        });
        node.dataset.left = String(index);
        leftButtons[index] = node;
        leftColumn.appendChild(node);
      });
      shuffledIndices(q.pairs.length).forEach(index => {
        const node = button('qpq-match-item qpq-match-right-item', q.pairs[index].right, () => {
          selectedRight = selectedRight === index ? null : index;
          connect();
          update();
        });
        node.dataset.right = String(index);
        rightButtons[index] = node;
        rightColumn.appendChild(node);
      });
      columns.append(leftColumn, rightColumn);
      board.append(svg, columns);
      actions.append(clear, send);
      root.append(board, status, actions);
      if (typeof view.ResizeObserver === 'function') {
        const observer = new view.ResizeObserver(queueDraw);
        observer.observe(board);
        cleanup.push(() => observer.disconnect());
      }
      listen(view, 'resize', queueDraw);
      cleanup.push(() => {
        if (frame !== null && typeof view.cancelAnimationFrame === 'function') view.cancelAnimationFrame(frame);
      });
      update();
      return controller;
    }

    help('항목을 끌거나 위·아래 버튼을 눌러 올바른 순서로 놓으세요.');
    const list = element('ol', 'qpq-order-list');
    list.setAttribute('aria-label', '순서를 맞출 항목');
    const order = shuffledIndices(q.items.length);
    const rows = new Map();
    let dragged = null;
    const status = element('p', 'qpq-order-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const actions = element('div', 'qpq-actions');
    const send = button('qpq-submit btn y', '답 보내기', () => {
      if (order.length >= 2) submit(order.slice());
    });
    send.disabled = disabled() || order.length < 2;

    function updateOrder(movedIndex) {
      order.forEach((originalIndex, position) => {
        const row = rows.get(originalIndex);
        row.number.textContent = String(position + 1);
        row.up.disabled = disabled() || position === 0;
        row.down.disabled = disabled() || position === order.length - 1;
        row.node.draggable = !disabled();
        row.node.setAttribute('aria-label', (position + 1) + '번째: ' + q.items[originalIndex]);
        list.appendChild(row.node);
      });
      if (movedIndex != null) status.textContent = q.items[movedIndex] + ' · ' + (order.indexOf(movedIndex) + 1) + '번째로 이동했어요.';
    }
    function move(originalIndex, newPosition) {
      if (disabled() || send.disabled) return;
      const oldPosition = order.indexOf(originalIndex);
      if (oldPosition < 0 || newPosition < 0 || newPosition >= order.length || oldPosition === newPosition) return;
      order.splice(oldPosition, 1);
      order.splice(newPosition, 0, originalIndex);
      updateOrder(originalIndex);
    }
    order.forEach(originalIndex => {
      const row = element('li', 'qpq-order-item');
      row.dataset.index = String(originalIndex);
      const number = element('span', 'qpq-order-number');
      const grip = element('span', 'qpq-order-grip', '↕');
      grip.setAttribute('aria-hidden', 'true');
      const text = element('span', 'qpq-order-text', q.items[originalIndex]);
      const controls = element('div', 'qpq-order-controls');
      const up = button('qpq-move-up btn sm', '↑', () => move(originalIndex, order.indexOf(originalIndex) - 1));
      const down = button('qpq-move-down btn sm', '↓', () => move(originalIndex, order.indexOf(originalIndex) + 1));
      up.setAttribute('aria-label', q.items[originalIndex] + ' 위로 이동');
      down.setAttribute('aria-label', q.items[originalIndex] + ' 아래로 이동');
      controls.append(up, down);
      row.append(number, grip, text, controls);
      rows.set(originalIndex, {node: row, number, up, down});
      listen(row, 'dragstart', event => {
        if (disabled() || send.disabled || !row.draggable || (event.target.closest && event.target.closest('button'))) {
          event.preventDefault();
          return;
        }
        dragged = originalIndex;
        row.classList.add('is-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(originalIndex));
        }
      });
      listen(row, 'dragover', event => {
        if (!disabled() && !send.disabled && dragged !== null && dragged !== originalIndex) {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        }
      });
      listen(row, 'drop', event => {
        if (disabled() || send.disabled || dragged === null) return;
        event.preventDefault();
        move(dragged, order.indexOf(originalIndex));
        dragged = null;
        rows.forEach(value => value.node.classList.remove('is-dragging'));
      });
      listen(row, 'dragend', () => {
        dragged = null;
        rows.forEach(value => value.node.classList.remove('is-dragging'));
      });
    });
    actions.appendChild(send);
    root.append(list, status, actions);
    updateOrder();
    return controller;
  }

  global.QPQuizQuestions = Object.freeze({normalize, validate, grade, mountAnswer});
})(typeof window !== 'undefined' ? window : globalThis);
