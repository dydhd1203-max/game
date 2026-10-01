/* Original painted props share one transparent atlas. SVG viewBoxes clip each frame
   at render time, so the source image and its fine brushwork stay untouched. */
(function () {
  'use strict';
  const frames = Object.freeze({
    cottage: { source: [0, 0, 665, 718], anchor: [347, 691] },
    oak: { source: [665, 0, 589, 720], anchor: [292, 714] },
    rock: { source: [0, 720, 675, 534], anchor: [352, 477] },
    well: { source: [715, 720, 539, 534], anchor: [227, 482] }
  });
  function sprite(kind, options) {
    const frame = frames[kind];
    if (!frame) return '';
    options = options || {};
    const width = Number.isFinite(options.width) ? Math.max(12, Math.min(480, options.width)) : 160;
    const x = Number.isFinite(options.x) ? options.x : 0, y = Number.isFinite(options.y) ? options.y : 0;
    const scale = width / frame.source[2], height = frame.source[3] * scale;
    return '<svg data-painted-prop="' + kind + '" x="' + (x - frame.anchor[0] * scale).toFixed(2) + '" y="' +
      (y - frame.anchor[1] * scale).toFixed(2) + '" width="' + width.toFixed(2) + '" height="' + height.toFixed(2) +
      '" viewBox="' + frame.source.join(' ') + '" overflow="hidden" aria-hidden="true" focusable="false">' +
      '<image href="./assets/painted-forest-props.png" width="1254" height="1254"/></svg>';
  }
  function paintTrees(svg, terrain) {
    svg.querySelectorAll('defs g[id$="-tree"],defs g[id$="-pine"]').forEach(tree => {
      tree.innerHTML = sprite('oak', { x: 0, y: 14, width: terrain === 'adventure' ? 126 : 146 });
      if (terrain === 'autumn') {
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.id = tree.id + '-autumn';
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        // Turn green highlights into warm foliage while retaining the brown bark
        // and cool shadow values; a hue rotation also turns the trunk pink.
        filter.innerHTML = '<feColorMatrix type="matrix" values=".8 .45 -.18 0 0 .2 .45 .05 0 0 -.1 .06 .7 0 0 0 0 0 1 0"/>';
        tree.parentElement.appendChild(filter);
        tree.querySelector('image').style.filter = 'url(#' + filter.id + ')';
      }
    });
  }
  window.QPMapPainted = Object.freeze({ sprite, paintTrees });
})();
