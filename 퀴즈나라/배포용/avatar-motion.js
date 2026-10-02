/* Reusable avatar movement. Positions are CSS pixels above the world's floor.
   The controller moves the wrapper; QPAvatarPose handles the SVG's limb poses. */
(function () {
  'use strict';
  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyC: 'sit', ArrowDown: 'sit', KeyS: 'sit' };
  const ACTIONS = ['left', 'right', 'jump', 'sit'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const number = (value, fallback) => Number.isFinite(value) ? value : fallback;

  function create(options) {
    const opts = options || {}, element = opts.element, world = opts.world;
    if (!element || !world || !element.style || !world.addEventListener)
      throw new TypeError('QPAvatarMotion.create requires element and world DOM elements.');
    const speed = Math.max(1, number(opts.speed, 210));
    const jumpSpeed = Math.max(1, number(opts.jumpSpeed, 480));
    const gravity = Math.max(1, number(opts.gravity, 1400));
    const groundBottom = Math.max(0, number(opts.groundBottom, 32));
    const stride = Math.max(1, number(opts.stride, 96));
    const inputs = Object.fromEntries(ACTIONS.map(action => [action, new Set()]));
    const cleanups = [], controlRoots = new Set();
    const original = { position: element.style.position, left: element.style.left,
      bottom: element.style.bottom, transform: element.style.transform,
      phase: element.style.getPropertyValue('--motion-phase'),
      motion: element.getAttribute('data-motion'), facing: element.getAttribute('data-facing') };
    let enabled = opts.enabled !== false, destroyed = false, raf = 0, lastTime = 0, controlId = 0;
    let minX = 0, maxX = 0, firstMeasure = true, poseSVG = null;
    const state = { action: 'idle', facing: opts.facing === 'left' ? 'left' : 'right',
      x: 0, y: 0, vx: 0, vy: 0, grounded: true, phase: 0, step: 0 };
    let lastNotification = '';
    element.style.position = 'absolute';
    element.style.left = '0px';
    element.style.bottom = groundBottom + 'px';

    const held = action => inputs[action].size > 0;
    const blocked = () => typeof opts.isBlocked === 'function' ? !!opts.isBlocked()
      : !!document.querySelector('#modal.on,dialog[open]');
    const snapshot = () => ({ ...state });
    function paint() {
      const ratio = Math.max(.1, number(window.devicePixelRatio, 1));
      const pixel = value => Math.round(value * ratio) / ratio;
      element.style.transform = `translate3d(${pixel(state.x)}px,${-pixel(state.y)}px,0)`;
      element.dataset.motion = state.action;
      element.dataset.facing = state.facing;
      element.style.setProperty('--motion-phase', String(state.phase));
      if (!poseSVG || !element.contains(poseSVG))
        poseSVG = element.matches('.qp-pixel-avatar') ? element : element.querySelector('.qp-pixel-avatar');
      const applyPose = opts.pose || window.QPAvatarPose?.apply;
      if (applyPose && poseSVG) applyPose(poseSVG, state);
      const key = `${state.action}/${state.facing}/${pixel(state.x)}/${pixel(state.y)}/${state.grounded}`;
      if (key !== lastNotification) {
        lastNotification = key;
        if (typeof opts.onState === 'function') opts.onState(snapshot());
      }
    }

    function measure() {
      if (destroyed) return;
      const oldSpan = maxX - minX;
      const fraction = oldSpan ? (state.x - minX) / oldSpan : .5;
      const bounds = typeof opts.bounds === 'function' ? opts.bounds(world, element) : opts.bounds || {};
      const width = element.offsetWidth || element.getBoundingClientRect().width;
      minX = Math.max(0, number(bounds.minX, number(bounds.left, 0)));
      maxX = Math.max(minX, Math.min(world.clientWidth - width,
        number(bounds.maxX, world.clientWidth - width - number(bounds.right, 0))));
      if (firstMeasure) {
        state.x = clamp(number(opts.x, minX + (maxX - minX) / 2), minX, maxX);
        firstMeasure = false;
      } else state.x = minX + clamp(fraction, 0, 1) * (maxX - minX);
      paint();
    }

    function updateAction() {
      const direction = Number(held('right')) - Number(held('left'));
      const sitting = held('sit') && state.grounded;
      state.vx = enabled && !sitting ? direction * speed : 0;
      if (state.vx) state.facing = state.vx < 0 ? 'left' : 'right';
      state.action = !state.grounded ? 'jump' : sitting ? 'sit' : state.vx ? 'walk' : 'idle';
      state.step = Math.floor(state.phase * 8) % 8;
    }

    function setInput(action, pressed, source = 'api') {
      if (destroyed || !ACTIONS.includes(action) || (pressed && (!enabled || blocked()))) return false;
      const wasHeld = held(action), wasSourceHeld = inputs[action].has(source);
      if (pressed) inputs[action].add(source); else inputs[action].delete(source);
      if (action === 'jump' && pressed && !wasSourceHeld && !wasHeld
          && state.grounded && !held('sit')) {
        state.vy = jumpSpeed;
        state.grounded = false;
      }
      updateAction();
      paint();
      return true;
    }

    function clearInputs(prefix) {
      for (const action of ACTIONS) for (const source of inputs[action])
        if (!prefix || source.startsWith(prefix)) inputs[action].delete(source);
      updateAction();
      paint();
    }

    function tick(time) {
      if (destroyed) return;
      const dt = lastTime ? clamp((time - lastTime) / 1000, 0, .04) : 0;
      lastTime = time;
      if (enabled && !document.hidden) {
        if (blocked() && ACTIONS.some(held)) clearInputs();
        updateAction();
        state.x = clamp(state.x + state.vx * dt, minX, maxX);
        if (!state.grounded) {
          state.y += state.vy * dt - gravity * dt * dt / 2;
          state.vy -= gravity * dt;
          if (state.y <= 0 && state.vy <= 0) { state.y = 0; state.vy = 0; state.grounded = true; }
        }
        if (state.action === 'walk') state.phase = (state.phase + speed * dt / stride) % 1;
        updateAction();
        paint();
      }
      raf = requestAnimationFrame(tick);
    }

    const focused = () => world.contains(document.activeElement)
      || [...controlRoots].some(root => root.contains(document.activeElement));
    const editable = target => target instanceof Element
      && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    function onKeyDown(event) {
      const action = KEYS[event.code];
      if (!enabled || blocked() || !action || event.defaultPrevented || !focused() || editable(event.target)
          || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      if (!event.repeat) setInput(action, true, 'key:' + event.code);
    }
    function onKeyUp(event) {
      const action = KEYS[event.code];
      if (!action) return;
      const source = 'key:' + event.code;
      if (inputs[action].has(source)) event.preventDefault();
      setInput(action, false, source);
    }
    function onBlur() { clearInputs(); lastTime = 0; }
    function onVisibility() { if (document.hidden) clearInputs(); lastTime = 0; }
    function onFocusOut(event) {
      const next = event.relatedTarget;
      if (!next || !(world.contains(next) || [...controlRoots].some(root => root.contains(next))))
        clearInputs('key:');
    }
    const listen = (target, name, handler, options) => {
      target.addEventListener(name, handler, options);
      return () => target.removeEventListener(name, handler, options);
    };
    if (opts.keyboard !== false) {
      cleanups.push(listen(document, 'keydown', onKeyDown), listen(document, 'keyup', onKeyUp),
        listen(world, 'focusout', onFocusOut));
    }
    cleanups.push(listen(window, 'blur', onBlur), listen(document, 'visibilitychange', onVisibility));

    function bindControls(root) {
      if (!root || destroyed) return () => {};
      const localCleanups = [], pointers = new Map();
      const controlSource = 'control:' + (++controlId) + ':';
      controlRoots.add(root);
      function release(event) {
        const action = pointers.get(event.pointerId);
        if (!action) return;
        pointers.delete(event.pointerId);
        setInput(action, false, 'pointer:' + event.pointerId);
      }
      for (const button of root.querySelectorAll('[data-motion]')) {
        const action = button.dataset.motion;
        if (!ACTIONS.includes(action)) continue;
        localCleanups.push(listen(button, 'pointerdown', event => {
          if (!enabled || button.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
          event.preventDefault();
          world.focus({ preventScroll: true });
          pointers.set(event.pointerId, action);
          try { button.setPointerCapture(event.pointerId); } catch (_) { /* Document release still works. */ }
          setInput(action, true, 'pointer:' + event.pointerId);
        }, { passive: false }), listen(button, 'lostpointercapture', release),
          listen(button, 'keydown', event => {
            if (!enabled || button.disabled || !['Enter', 'Space'].includes(event.code)) return;
            event.preventDefault();
            if (!event.repeat) setInput(action, true, controlSource + action + ':' + event.code);
          }), listen(button, 'keyup', event => {
            if (!['Enter', 'Space'].includes(event.code)) return;
            event.preventDefault();
            setInput(action, false, controlSource + action + ':' + event.code);
          }), listen(button, 'blur', () => {
            setInput(action, false, controlSource + action + ':Enter');
            setInput(action, false, controlSource + action + ':Space');
          }));
      }
      localCleanups.push(listen(document, 'pointerup', release), listen(document, 'pointercancel', release),
        listen(root, 'focusout', onFocusOut));
      let bound = true;
      const unbind = () => {
        if (!bound) return;
        bound = false;
        for (const [pointer, action] of pointers) setInput(action, false, 'pointer:' + pointer);
        pointers.clear();
        clearInputs(controlSource);
        localCleanups.forEach(cleanup => cleanup());
        controlRoots.delete(root);
      };
      cleanups.push(unbind);
      return unbind;
    }

    function reset(position) {
      if (destroyed) return;
      clearInputs();
      state.x = clamp(number(position?.x, minX + (maxX - minX) / 2), minX, maxX);
      state.y = 0; state.vx = 0; state.vy = 0; state.grounded = true;
      state.phase = 0; state.step = 0; state.action = 'idle'; lastTime = 0;
      if (position?.facing === 'left' || position?.facing === 'right') state.facing = position.facing;
      paint();
    }
    function setEnabled(value) {
      if (destroyed) return;
      enabled = !!value;
      if (!enabled) clearInputs();
      lastTime = 0;
    }
    function destroy() {
      if (destroyed) return;
      reset();
      destroyed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach(cleanup => cleanup());
      const clearPose = opts.destroyPose || window.QPAvatarPose?.destroy;
      if (poseSVG && typeof clearPose === 'function') clearPose(poseSVG);
      for (const key of ['position', 'left', 'bottom', 'transform']) element.style[key] = original[key];
      if (original.phase) element.style.setProperty('--motion-phase', original.phase);
      else element.style.removeProperty('--motion-phase');
      for (const name of ['motion', 'facing']) {
        if (original[name] === null) element.removeAttribute('data-' + name);
        else element.setAttribute('data-' + name, original[name]);
      }
    }
    measure();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure);
      observer.observe(world); observer.observe(element);
      cleanups.push(() => observer.disconnect());
    } else cleanups.push(listen(window, 'resize', measure));
    if (opts.controls) bindControls(opts.controls);
    raf = requestAnimationFrame(tick);
    return Object.freeze({ setInput, bindControls, getState: snapshot, reset, setEnabled, destroy,
      move(direction) {
        setInput('left', direction < 0); setInput('right', direction > 0);
      },
      jump() { setInput('jump', true); setInput('jump', false); },
      sit(value = true) { setInput('sit', !!value); } });
  }
  window.QPAvatarMotion = Object.freeze({ create });
})();
