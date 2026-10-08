/* Rounded candy lettering for big titles, after the QPlay logo: every glyph has
   a dark outline layer, a two-tone glossy fill and a small sparkle. Screen
   readers hear the plain text once; the decorated letters are hidden from them.

   QPCandy.html('숲속 옷 가게')                          gold letters
   QPCandy.html('숲속 옷 가게', {arc: .22})              letters follow an arched ribbon
   QPCandy.html([{text: 'QUIZ', variant: 'sky'}, '나라']) two-tone title */
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const LATIN = /[A-Za-z0-9!?]/;

  function html(parts, options = {}) {
    const segments = (Array.isArray(parts) ? parts : [parts]).map(p => typeof p === 'string' ? {text: p} : p);
    const glyphs = [];
    segments.forEach(s => [...String(s.text ?? '')].forEach(c => glyphs.push({c, variant: s.variant || ''})));
    const plain = glyphs.map(g => g.c).join('');
    const arc = Number(options.arc) || 0, last = Math.max(1, glyphs.length - 1);
    const letters = glyphs.map((g, i) => {
      if (/\s/.test(g.c)) return '<span class="ct-sp"></span>';
      const u = glyphs.length > 1 ? i / last * 2 - 1 : 0;
      const style = arc ? ` style="--ct-y:${(-arc * (1 - u * u)).toFixed(3)}em;--ct-r:${(u * arc * 30).toFixed(1)}deg"` : '';
      const cls = 'ct-l' + (g.variant ? ' ct-' + g.variant : '') + (LATIN.test(g.c) ? ' ct-latin' : '');
      return `<span class="${cls}" data-c="${esc(g.c)}"${style}><i>${esc(g.c)}</i></span>`;
    }).join('');
    const cls = ['qp-candy', options.variant ? 'ct-' + options.variant : '', options.className || ''].filter(Boolean).join(' ');
    return `<span class="${cls}"><span class="ct-sr">${esc(options.label || plain)}</span><span class="ct-w" aria-hidden="true">${letters}</span></span>`;
  }

  window.QPCandy = {html};
})();
