/* Original illustrated forest additions. These landmarks sit beside existing
   playable trails; their footprints are returned to the map's collision system. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const mounted = new WeakMap();

  function decorate(options) {
    options = options || {};
    const svg = options.svg;
    if (!svg || !svg.appendChild) return { obstacles: [], details: {} };
    if (mounted.has(svg)) return mounted.get(svg);
    const terrain = options.terrain || 'forest';
    if (!['forest-path', 'forest', 'autumn'].includes(terrain)) return { obstacles: [], details: {} };
    const width = Math.max(400, Number(options.width) || 1280);
    const height = Math.max(400, Number(options.height) || 920);
    const sequence = terrain === 'forest-path', autumn = terrain === 'autumn';
    const prefix = String(options.uid || 'qp-forest-detail').replace(/[^a-zA-Z0-9_-]/g, '-') + '-detail';
    const objects = Array.isArray(options.objects) ? options.objects : [];
    const spawn = options.spawn || { x: autumn ? 640 : 245, y: 255 };
    if (sequence && typeof options.routeDistance !== 'function') return { obstacles: [], details: {} };
    const routeDistance = typeof options.routeDistance === 'function' ? options.routeDistance : () => Infinity;
    const obstacles = [], scenes = [], details = {};
    const number = n => Number(n).toFixed(1);
    const paint = (kind, x, y, scale, content, order) => {
      details[kind] = (details[kind] || 0) + 1;
      scenes.push({ y: order === undefined ? y : order, html: '<g data-art-detail="' + kind + '" transform="translate(' + number(x) + ' ' + number(y) + ') scale(' + number(scale) + ')">' + content + '</g>' });
    };
    // Test the whole visual envelope, rather than only a landmark's centre. The
    // route's distance field is 1-Lipschitz; the sampling margin covers its cells.
    function safe(x, y, bounds, solid) {
      const step = 16, allowance = Math.SQRT2 * step / 2;
      const nx = Math.max(1, Math.ceil(bounds.w / step)), ny = Math.max(1, Math.ceil(bounds.h / step));
      for (let ix = 0; ix <= nx; ix++) {
        const px = bounds.x + bounds.w * ix / nx;
        for (let iy = 0; iy <= ny; iy++) {
          const py = bounds.y + bounds.h * iy / ny;
          const tx = x + px, ty = y + py;
          if (sequence && routeDistance(tx, ty) <= (solid ? 180 : 82) + allowance) return false;
          const clearance = solid ? 170 : 68;
          if (objects.some(o => Math.hypot(tx - o.x, ty - o.y) <= clearance + allowance)) return false;
          if (Math.hypot(tx - spawn.x, ty - spawn.y) <= clearance + allowance) return false;
        }
      }
      // Samples also include the far edges when dimensions are not a multiple.
      for (const px of [bounds.x, bounds.x + bounds.w]) for (const py of [bounds.y, bounds.y + bounds.h]) {
        const tx = x + px, ty = y + py;
        if (sequence && routeDistance(tx, ty) <= (solid ? 180 : 82) + allowance) return false;
        if (objects.some(o => Math.hypot(tx - o.x, ty - o.y) <= (solid ? 170 : 68) + allowance)) return false;
        if (Math.hypot(tx - spawn.x, ty - spawn.y) <= (solid ? 170 : 68) + allowance) return false;
      }
      return true;
    }
    const scaled = (b, s) => ({ x: b.x * s, y: b.y * s, w: b.w * s, h: b.h * s });
    function solid(kind, x, y, scale, visualBounds, footprint, content) {
      const visual = scaled(visualBounds, scale);
      const ground = footprint.radius ? { x: ((footprint.x || 0) - footprint.radius) * scale, y: ((footprint.y || 0) - footprint.radius) * scale, w: footprint.radius * 2 * scale, h: footprint.radius * 2 * scale } : scaled(footprint, scale);
      if (x + visual.x < 0 || y + visual.y < 0 || x + visual.x + visual.w > width || y + visual.y + visual.h > height) return false;
      if (!safe(x, y, ground, true) || !safe(x, y, visual, false)) return false;
      paint(kind, x, y, scale, content);
      if (footprint.radius) obstacles.push({ x: x + (footprint.x || 0) * scale, y: y + (footprint.y || 0) * scale, radius: footprint.radius * scale });
      else obstacles.push({ rect: { x: x + footprint.x * scale, y: y + footprint.y * scale, w: footprint.w * scale, h: footprint.h * scale } });
      return true;
    }
    const leafLight = autumn ? '#f5d762' : '#bee96e';
    const leafMid = autumn ? '#d9a442' : '#82c45b';
    const leafDeep = autumn ? '#94753c' : '#377f54';
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<linearGradient id="' + prefix + '-roof" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#aba4d3"/><stop offset=".5" stop-color="#797fb1"/><stop offset="1" stop-color="#4b5a8d"/></linearGradient>' +
      '<linearGradient id="' + prefix + '-wood" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#d3ab71"/><stop offset=".55" stop-color="#af804c"/><stop offset="1" stop-color="#86613c"/></linearGradient>' +
      '<linearGradient id="' + prefix + '-stone" x1=".2" y1="0" x2=".9" y2="1"><stop stop-color="#a1adb1"/><stop offset=".55" stop-color="#748692"/><stop offset="1" stop-color="#495e70"/></linearGradient>' +
      '<linearGradient id="' + prefix + '-water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a9efcf"/><stop offset=".5" stop-color="#77ccbd"/><stop offset="1" stop-color="#478f9c"/></linearGradient>' +
      '<radialGradient id="' + prefix + '-crown" cx=".32" cy=".18" r=".85"><stop stop-color="' + leafLight + '"/><stop offset=".48" stop-color="' + leafMid + '"/><stop offset="1" stop-color="' + leafDeep + '"/></radialGradient>' +
      '<pattern id="' + prefix + '-tile" width="32" height="23" patternUnits="userSpaceOnUse"><rect width="32" height="23" fill="url(#' + prefix + '-roof)"/><path d="M-16 4Q0 19 16 4Q32 19 48 4M0 4V-5M16 20V12" fill="none" stroke="#4f618f" stroke-width="3"/><path d="M-12 3Q0 10 12 3M20 3Q32 10 44 3M4 18Q16 25 28 18" fill="none" stroke="#b2afd1" stroke-width="2"/></pattern>' +
      '<g id="' + prefix + '-flower"><path d="M0 0L1 11M1 8Q-8 9-6 3Q-2 3 1 8M1 6Q7 0 9 4Q8 9 1 8" stroke="#568849" stroke-width="1.3" fill="#85b65a"/><path d="M0 0Q-9-1-6-6Q-3-10 0-4Q2-12 7-8Q10-4 4-1Q12 2 7 7Q2 9 1 3Q-5 10-8 4Q-9 0 0 0Z" fill="currentColor"/><path d="M-2-1Q0-5 3-2L2 2L-1 2Z" fill="#ffd36c"/></g>' +
      '<g id="' + prefix + '-mushroom"><path d="M-3-2L-5 12Q0 16 6 11L4-3Z" fill="#f3dab2" stroke="#b99a78" stroke-width="1.7"/><path d="M-14-3Q-12-17 1-16Q13-14 15-4Q1 3-14-3Z" fill="#d96659" stroke="#a94d45" stroke-width="1.7"/><path d="M-11-6Q-5-15 3-13" fill="none" stroke="#f6a586" stroke-width="2.5" stroke-linecap="round"/><path d="M-6-10l4-1m7 3l3 1M-1-5l3-1" stroke="#fff0cb" stroke-width="3.4" stroke-linecap="round"/></g>' +
      '<g id="' + prefix + '-pine"><ellipse cx="3" cy="11" rx="42" ry="16" fill="#315d4836"/><path d="M-8-52L-10 8L-18 16L-1 11L12 17L8 9L6-51" fill="url(#' + prefix + '-wood)" stroke="#65543c" stroke-width="2.5"/><path d="M-3-40L-1 9M4-14L9 9" stroke="#e2b985" stroke-width="2" fill="none"/><path d="M0-158Q13-127 31-111L20-108Q34-84 48-75L32-72Q43-53 60-42L44-38Q59-14 72-8L38 0L25-8L4 0L-17-9L-33-1L-68-11Q-51-27-43-41L-57-43Q-38-57-30-74L-45-76Q-21-95-15-112L-26-112Q-11-126 0-158Z" fill="url(#' + prefix + '-crown)" stroke="#427254" stroke-width="3" stroke-linejoin="round"/><path d="M0-144Q-4-123-15-115L-3-117Q-8-95-26-80L-11-84Q-19-55-42-42L-28-43Q-34-25-48-17L-25-14L-9-22L4-12L21-18L40-14" fill="#d0e584" opacity=".32"/><path d="M-21-108Q1-104 20-108M-30-73Q-12-68 0-74Q15-67 31-73M-42-38Q-24-33-8-42Q10-29 28-40Q41-35 50-38" fill="none" stroke="#397252" stroke-width="4" stroke-linecap="round" opacity=".6"/><path d="M-8-111l8-15M-16-79l10-14M-23-43l10-15M-26-20l8-8" stroke="#d5ec9e" stroke-width="3.2" stroke-linecap="round" opacity=".75"/></g>' +
      '<g id="' + prefix + '-broadleaf"><ellipse cy="13" rx="63" ry="23" fill="#345b4933"/><path d="M-12-67L-14 9L-31 19L-11 15L2 8L18 18L13 3L13-70" fill="url(#' + prefix + '-wood)" stroke="#6a513a" stroke-width="3"/><path d="M-6-40L-3 6L-15 12M5-17L10 5" fill="none" stroke="#e4b980" stroke-width="2.5"/><path d="M-62-58L-54-77L-61-88L-47-103L-41-122L-20-129L-9-142L15-135L30-137L43-124L61-116L61-97L75-84L70-66L77-53L57-40L47-24L26-24L6-16L-11-25L-34-23L-45-36L-66-42Z" fill="url(#' + prefix + '-crown)" stroke="#467550" stroke-width="3.1" stroke-linejoin="round"/><path d="M-44-98L-29-112L-12-109L-4-125L13-123L26-111L40-113L53-98L38-96L27-89L14-98L-1-93L-14-99L-29-89Z" fill="' + leafLight + '" opacity=".65"/><path d="M-53-66L-39-78L-25-75L-17-88L-2-78L13-82L25-69L38-78L54-66L45-50L29-54L16-41L-3-46L-14-56L-32-48L-41-58Z" fill="' + leafMid + '"/><path d="M-46-39L-30-32L-12-40L3-27L23-29L35-38M44-97L53-89L60-72M-35-119L-28-130M-1-136L11-132" fill="none" stroke="' + leafDeep + '" stroke-width="4" stroke-linecap="round"/><path d="M-29-111l10-4M2-121l11 2M-41-76l8-4M19-63l10-4M-19-52l9 2" stroke="#e4efaa" stroke-width="3.5" stroke-linecap="round" opacity=".75"/></g>';
    svg.appendChild(defs);

    function cottage(x, y, scale) {
      // A timber front, a shaded side, and two separately tiled roof planes.
      const house = '<ellipse cx="10" cy="17" rx="111" ry="31" fill="#3c604134"/><path d="M-92-8L-45-31L100-11L72 20L-72 27Z" fill="#537b45"/><path d="M-76-19L14-41L83-9L-3 13Z" fill="#a4b987" stroke="#677d60" stroke-width="3"/>' +
        '<path d="M-58-76L22-59V2L-58-14Z" fill="#e3cda0" stroke="#76583c" stroke-width="4"/><path d="M22-59L89-87V-20L22 2Z" fill="#b3966c" stroke="#76583c" stroke-width="4"/><path d="M-58-74L-10-112L22-57Z" fill="#ead6ac" stroke="#846242" stroke-width="3"/>' +
        '<path d="M-55-73L-54-15M20-56V-1M-56-35L20-17M-45-16L-15-29L17 0M-51-72L-11-40L16-57M28-57V-2M81-82V-21M26-34L84-55" stroke="#956a3b" stroke-width="7" stroke-linejoin="round" fill="none"/><path d="M-52-65V-44M-44-28L-26-22M34-49L72-66" stroke="#d4a970" stroke-width="2" fill="none"/>' +
        '<path d="M-30-45Q-13-53-1-37V-7L-29-13Z" fill="#594c3c" stroke="#946f44" stroke-width="4"/><path d="M-24-41L-22-12M-16-43L-14-10M-8-38L-7-9" stroke="#89714d" stroke-width="2.5"/><path d="M-11-26l5 1" stroke="#f0c46c" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M38-59L65-70V-41L38-30Z" fill="#496a78" stroke="#735338" stroke-width="4"/><path d="M40-55L61-64M51-63V-37M39-43L64-53" stroke="#efd299" stroke-width="3"/><path d="M41-51L48-54M55-59L60-61" stroke="#b9e2dc" stroke-width="2"/><path d="M36-31L68-44L70-35L39-22Z" fill="#a17542" stroke="#735638" stroke-width="2"/><path d="M42-27Q39-40 49-37Q51-47 59-44L66-37L58-27Z" fill="#80b756" stroke="#5c9147" stroke-width="1.5"/>' +
        '<path d="M-76-82L-12-127L48-111L-10-64Z" fill="url(#' + prefix + '-tile)" stroke="#4f6087" stroke-width="5"/><path d="M-12-127L64-141L104-98L48-111L-10-64Z" fill="url(#' + prefix + '-tile)" stroke="#4f6087" stroke-width="5"/><path d="M-12-128L63-141" stroke="#a4a5c7" stroke-width="8" stroke-linecap="round"/><path d="M-75-83L-11-65L49-110L104-98" stroke="#c6b8c3" stroke-width="4" fill="none" stroke-linejoin="round"/><path d="M-72-77L-10-59L50-104L100-93" stroke="#79633f" stroke-width="6" fill="none"/>' +
        '<path d="M16-129L29-134L40-122L29-111L17-118Z" fill="#bfa88d" stroke="#746a61" stroke-width="2.5"/><path d="M17-129L16-150L29-156L29-134M29-156L41-144V-122" fill="#c9ba9f" stroke="#807a6c" stroke-width="2.5"/><path d="M16-150L28-155L40-144L28-138Z" fill="#eee0bb" stroke="#81776a" stroke-width="2"/><path d="M23-147L28-149L33-144L28-142Z" fill="#77796e"/>' +
        '<path d="M-8-126Q-3-139 8-132L19-134L27-126L15-121L6-123L-3-119Z" fill="#8dc65b" stroke="#619448" stroke-width="2"/><path d="M44-137Q49-149 60-144L65-136L58-131Z" fill="#9bcc5f"/>' +
        '<path d="M-29-8L-8-3L-14 5L-37 0Z" fill="#d5ceaa" stroke="#888f78" stroke-width="2"/><path d="M-37 0L-14 5L-21 13L-46 8Z" fill="#b9c0a3" stroke="#7e8975" stroke-width="2"/>';
      const painted = window.QPMapPainted && window.QPMapPainted.sprite('cottage', { x: 0, y: 0, width: 180 });
      return solid('timber-cottage', x, y, scale, painted ? { x: -94, y: -188, w: 180, h: 195 } : { x: -104, y: -160, w: 222, h: 190 }, { x: -74, y: -42, w: 146, h: 48 }, painted || house);
    }
    function terrace(x, y, scale) {
      const rock = '<ellipse cx="7" cy="14" rx="139" ry="34" fill="#36554930"/><path d="M-128-40L-111-84L-60-106L-20-94L28-108L80-85L122-44L100 8L39 27L-9 13L-70 25L-118 8Z" fill="url(#' + prefix + '-stone)" stroke="#586f79" stroke-width="3.5" stroke-linejoin="round"/>' +
        '<path d="M-110-78L-75-62L-73 15L-116 2L-123-36Z" fill="#748d96"/><path d="M-70-76L-31-67L-40-30L-27 10L-68 20L-73-25Z" fill="#536b7d"/><path d="M-23-76L17-78L31-41L16-2L-9 10L-36-25Z" fill="#839ba4"/><path d="M39-79L74-67L95-26L78 15L38 21L31-28Z" fill="#627c8b"/><path d="M80-67L116-39L99 1L82 7L91-29Z" fill="#435d71"/>' +
        '<path d="M-121-44L-75-33L-39-47L-11-35L26-44L60-26L94-38M-110-3L-83-2M-49 6L-39-13M9-65L13-42M38 9L54 5L67-14" stroke="#c0c8b3" stroke-width="3" fill="none" opacity=".65"/><path d="M-74-57L-78-36M-33-44L-22-28L-26-8M53-63L57-42M75-30L68-19L71-3" stroke="#405b6c" stroke-width="4" fill="none" stroke-linejoin="round"/>' +
        '<path d="M-126-47L-104-81L-57-99L-22-88L24-100L76-78L120-43L84-29L41-41L5-31L-32-41L-69-31Z" fill="' + (autumn ? '#b7c374' : '#a1cc6a') + '" stroke="#6d9453" stroke-width="3"/><path d="M-105-78L-75-88L-48-81L-22-84L2-77L34-86L62-74L96-55L84-51L45-62L18-60L-11-67L-40-63L-68-71Z" fill="' + (autumn ? '#dde19b' : '#c6e789') + '" opacity=".8"/>' +
        '<path d="M-122-42L-111-26L-99-40L-88-22L-79-38M-29-38L-19-22L-11-34L0-18L10-32M51-39L58-20L69-27L79-14L89-28" fill="#749b50" stroke="#608943" stroke-width="1.5"/><path d="M-84-49l-3-12m3 12l7-11M31-60l-2-10m2 10l8-9M70-47l5-13m-5 13l-3-10" stroke="#537e43" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M-26-59L-19-78L-4-83L12-70L9-58L-11-52Z" fill="#b9c3af" stroke="#7c9383" stroke-width="2"/><path d="M-20-73L-4-78L9-68L-5-64Z" fill="#e2dfbf"/><path d="M-5-64L-9-54" stroke="#8b9f8d" stroke-width="2"/>';
      const painted = window.QPMapPainted && window.QPMapPainted.sprite('rock', { x: 0, y: 0, width: 180 });
      return solid('mossy-terrace', x, y, scale, painted ? { x: -94, y: -128, w: 180, h: 144 } : { x: -144, y: -110, w: 290, h: 144 }, { x: -81, y: -42, w: 162, h: 55 }, painted || rock);
    }
    function well(x, y, scale) {
      if (!window.QPMapPainted) return false;
      return solid('village-well', x, y, scale, { x: -51, y: -108, w: 120, h: 120 }, { x: -41, y: -24, w: 85, h: 31 }, window.QPMapPainted.sprite('well', { x: 0, y: 0, width: 120 }));
    }
    function tree(x, y, scale, kind) {
      return solid(kind === 'pine' ? 'sculpted-conifer' : 'leafy-tree', x, y, scale,
        { x: -78, y: -160, w: 160, h: 183 }, { x: 0, y: 5, radius: 17 }, '<use href="#' + prefix + '-' + (kind === 'pine' ? 'pine' : 'broadleaf') + '"/>');
    }
    function meadow(x, y, scale, warm) {
      if ((details['flower-meadow'] || 0) >= 18) return;
      const envelope = { x: -75 * scale, y: -34 * scale, w: 155 * scale, h: 76 * scale };
      if (!safe(x, y, envelope, false)) return;
      let html = '<path d="M-75 9L-63-9L-39-16L-26-26L-8-19L14-30L34-14L54-17L78 3L65 22L38 27L21 36L-7 25L-27 32L-39 20L-65 23Z" fill="' + (autumn ? '#c1c887' : '#b4d775') + '" opacity=".73"/><path d="M-57 8Q-47-9-34-8M-19 20Q-9 9 3 16M21-12Q31-23 43-15" stroke="' + (autumn ? '#dfdfa0' : '#d6eaa0') + '" stroke-width="8" fill="none" stroke-linecap="round" opacity=".6"/>';
      const positions = [[-51,-3],[-40,11],[-28,-8],[-15,2],[7,11],[20,-10],[35,1],[43,17],[55,6]];
      const colors = warm ? ['#ec9295','#fff2bf','#ebb565'] : ['#f3a5c4','#fdf6d5','#9eafd5'];
      positions.forEach((p, i) => { html += '<use href="#' + prefix + '-flower" transform="translate(' + p[0] + ' ' + p[1] + ') scale(' + (i % 3 === 0 ? '.85' : '.65') + ')" style="color:' + colors[i % 3] + '"/>'; });
      html += '<path d="M-61 17l-6-8m6 8l-1-14m1 14l6-9M-6-10l-5-7m5 7l2-13m-2 13l7-5M61-6l-2-10m2 10l7-9" fill="none" stroke="#668d47" stroke-width="2.4" stroke-linecap="round"/><path d="M-42 21l5-2M12 24l4 1M28-18l5-1" stroke="#e8edab" stroke-width="3" stroke-linecap="round"/>';
      paint('flower-meadow', x, y, scale, html, y - 80);
    }
    function stump(x, y, scale) {
      const art = '<ellipse cx="5" cy="14" rx="43" ry="16" fill="#3e61432b"/><path d="M-29-17L-35 17L-18 21L-9 14L6 19L26 15L23-18Z" fill="url(#' + prefix + '-wood)" stroke="#795937" stroke-width="2.5"/><path d="M-22-9L-24 10M-9-8L-12 13M5-7V14M16-7L17 8" stroke="#765436" stroke-width="3" stroke-linecap="round"/><path d="M-29-20Q-4-34 24-19L24-11Q-2 2-30-12Z" fill="#c9ad74" stroke="#85633c" stroke-width="2.5"/><ellipse cx="-3" cy="-16" rx="19" ry="7" fill="none" stroke="#a6834a" stroke-width="2"/><ellipse cx="-3" cy="-16" rx="10" ry="3.5" fill="none" stroke="#977840" stroke-width="1.5"/><path d="M-2-26L2-16L9-11" stroke="#82613d" stroke-width="1.8" fill="none"/><use href="#' + prefix + '-mushroom" transform="translate(32 12) scale(.6)"/><use href="#' + prefix + '-mushroom" transform="translate(43 16) scale(.4)"/><path d="M-30 20Q-47 14-48 22Q-40 32-29 23M17 19Q25 29 32 23Q31 16 17 19" fill="#91b758" stroke="#60864a" stroke-width="1.5"/>';
      return solid('mushroom-stump', x, y, scale, { x: -50, y: -35, w: 106, h: 71 }, { x: -27, y: -14, w: 54, h: 36 }, art);
    }
    function log(x, y, scale) {
      const art = '<ellipse cy="17" rx="72" ry="18" fill="#35583f28"/><path d="M-59-15L30-29Q49-24 60-7L-30 14Q-52 15-59-15Z" fill="#87613b" stroke="#654b33" stroke-width="2.5"/><path d="M-52-15L30-27L45-20L-43-1Z" fill="#c1995c"/><path d="M-49-10L34-23M-39-1L42-17M-29 7L51-8" fill="none" stroke="#5f4b33" stroke-width="2.5"/><path d="M-58-15Q-68-6-48 10Q-26 23-21 3Q-18-11-39-21Q-53-26-58-15Z" fill="#d2b47a" stroke="#805c35" stroke-width="3"/><ellipse cx="-42" cy="-2" rx="13" ry="18" transform="rotate(-44 -42 -2)" fill="none" stroke="#a1824a" stroke-width="2"/><path d="M-49-9Q-40-14-33-3Q-31 3-39 7" stroke="#987543" stroke-width="1.8" fill="none"/><path d="M6-25L15-41L24-36L20-27" fill="#8e6e43" stroke="#654f34" stroke-width="2.5"/><path d="M12-40L20-37" stroke="#d8b279" stroke-width="3"/><path d="M-9-10Q-3-24 9-19L18-13L33-19L43-11L23-4L10-8L-3-2Z" fill="#8aa958" stroke="#648243" stroke-width="1.5"/><use href="#' + prefix + '-mushroom" transform="translate(60 5) scale(.55)"/>';
      return solid('fallen-log', x, y, scale, { x: -73, y: -44, w: 155, h: 82 }, { x: -55, y: -20, w: 120, h: 36 }, art);
    }
    function creek(x, y, scale) {
      // A contained edge pool; no river is drawn through a playable trail. The
      // bridge stays decorative because this pocket introduces no new route.
      const bounds = scaled({ x: -124, y: -56, w: 255, h: 130 }, scale);
      if (!safe(x, y, bounds, false)) return false;
      if (sequence && !safe(x, y, bounds, true)) return false;
      const water = '<path d="M-124-11L-109-37L-76-46L-33-33L-2-50L37-40L79-46L122-12L126 26L107 57L72 65L34 47L5 61L-29 49L-67 60L-109 39Z" fill="#6a9365"/><path d="M-113-13Q-98-42-69-34Q-33-20-6-39Q29-50 51-28Q83-38 106-13Q132 17 105 43Q78 67 46 38Q27 33 7 49Q-21 53-37 38Q-65 51-89 35Q-120 25-113-13Z" fill="url(#' + prefix + '-water)" stroke="#548f8c" stroke-width="2.5"/><path d="M-103-12Q-76-5-65 15Q-48 34-28 13Q-6-1 10 10Q30 24 48 4Q69-13 99 4M-92-26Q-65-33-49-18M59 33Q76 45 96 30M-5 35L9 32" fill="none" stroke="#dbf8df" stroke-width="3.5" stroke-linecap="round" opacity=".85"/><path d="M-51-32Q-44-15-53-5M4-32Q22-20 15-9M82-17Q79-9 70-6" fill="none" stroke="#b6ead4" stroke-width="2"/>' +
        '<path d="M-36-32L-20-40L24 24L8 33Z" fill="#7e958d" stroke="#5a786f" stroke-width="2.5"/><path d="M-38-36L-20-45L27 20L8 30Z" fill="#dfdec2" stroke="#8a9e89" stroke-width="2.5"/><path d="M-33-29L-16-37M-23-15L-7-23M-13-1L3-9M-3 13L13 5" stroke="#9bae9b" stroke-width="2.5"/><path d="M-34-31L-28-33M-9 2L-4 0M3 20L10 16" stroke="#fff0c9" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M-98 42L-106 31L-91 24L-73 33L-76 48Z" fill="#a0af9a" stroke="#778e7e" stroke-width="2"/><path d="M-100 31L-89 28L-77 34L-91 37Z" fill="#d1d5b7"/><path d="M89-32L102-43L121-32L126-17L107-12Z" fill="#94a89a" stroke="#738d82" stroke-width="2"/><path d="M102-39L120-30L108-26L95-29Z" fill="#d9dbbd"/>' +
        '<path d="M-119 15l-7-15m7 15l4-26m-4 26l10-14M56 57l-4-14m4 14l4-22m-4 22l10-11M76-42l-4-12m4 12l5-16" stroke="#5f8e4f" stroke-width="3" fill="none" stroke-linecap="round"/><use href="#' + prefix + '-flower" transform="translate(-106 -35) scale(.7)" style="color:#f3a3b5"/><use href="#' + prefix + '-flower" transform="translate(65 56) scale(.8)" style="color:#fff2bd"/>';
      paint('creek-and-stone-bridge', x, y, scale, water, y - 100);
      return true;
    }

    // Deliberate edge landmarks leave the main lawn and question approaches open.
    // A short top-left village glimpse and separate rocky clearing form a readable
    // silhouette; they are not an even scatter of interchangeable tree stamps.
    if (sequence) {
      cottage(width * .35, 152, .78);
      cottage(width * .68, height - 13, .84);
      cottage(width * .95, height - 12, .62);
      terrace(width * .73, 120, .62);
      terrace(width * .10, height - 22, .68);
      well(width * .50, 146, .70);
      creek(width * .9, 24, .55);
      tree(width * .07, 112, .62, 'pine');
      tree(width * .19, 42, .58, 'broadleaf');
      tree(width * .55, 40, .61, 'pine');
      tree(width * .93, 48, .6, 'broadleaf');
      stump(width * .56, 61, .65);
      log(width * .16, height - 30, .67);
    } else {
      cottage(width * .49, 147, .78);
      cottage(width * .92, 161, .72);
      cottage(width * .66, height - 16, 1.10);
      terrace(width * .77, 142, .72);
      well(width * .79, 181, .80);
      terrace(width * .07, height - 40, .78);
      terrace(width * .94, height - 49, .82);
      if (!autumn) creek(width * .13, 85, .64);
      else creek(width * .78, height - 30, .63);
      [[.08,125,.72,'pine'],[.25,91,.8,'broadleaf'],[.77,81,.64,'pine'],[.91,84,.66,'broadleaf'],[.035,height*.42,.76,'pine'],[.968,height*.5,.68,'broadleaf'],[.13,height-55,.7,'broadleaf'],[.3,height-43,.69,'pine'],[.75,height-32,.73,'pine']].forEach(t => tree(width * t[0], t[1], t[2], t[3]));
      stump(width * .86, 150, .85);
      log(width * .40, height - 54, .76);
    }
    const rows = Math.max(2, Math.min(8, Math.ceil(height / 230)));
    for (let row = 0; row < rows; row++) {
      const y = 145 + row * (height - 220) / Math.max(1, rows - 1);
      // Cluster candidates are chosen for clearings, not spread as tiny dots over
      // the whole map. Rejected groups leave useful quiet space around the quiz.
      [.115,.31,.54,.77,.93].forEach((column, index) => meadow(width * column + (row % 2 ? 27 : -18), y + (index % 2 ? 37 : -14), .65 + ((index + row) % 3) * .13, autumn || index % 2 === 0));
    }
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('data-forest-detail', prefix);
    group.setAttribute('aria-hidden', 'true'); group.setAttribute('pointer-events', 'none');
    scenes.sort((a, b) => a.y - b.y);
    group.innerHTML = scenes.map(scene => scene.html).join('');
    svg.appendChild(group);
    const result = { obstacles, details };
    mounted.set(svg, result);
    return result;
  }
  window.QPForestDetail = Object.freeze({ decorate });
})();
