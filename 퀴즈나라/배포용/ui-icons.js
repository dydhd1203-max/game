/* Original, shared game icons. Decorative SVGs keep each button's Korean name. */
(() => {
  'use strict';
  const paths = {
    home: '<path d="M3 14 16 3l13 11-3 3-3-3v14h-6v-8h-4v8H7V14l-3 3z"/>',
    shop: '<path d="m8 4 5-2c0 5 6 5 6 0l5 2 6 8-6 4-3-4v17H11V12l-3 4-6-4z"/>',
    trophy: '<path d="M8 3h16v4h6v6c0 5-4 8-9 8l-3 3v3h6v3H8v-3h6v-3l-3-3c-5 0-9-3-9-8V7h6zm0 8H6v2c0 2 1 4 4 4L8 11zm16 0-2 6c3 0 4-2 4-4v-2z"/>',
    sound: '<path d="M3 11h6l8-7v24l-8-7H3z"/><path d="M21 10c4 3 4 9 0 12m4-17c7 6 7 16 0 22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    mute: '<path d="M3 11h6l8-7v24l-8-7H3z"/><path d="m22 11 7 10m0-10-7 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    book: '<path d="M3 5c5-2 9-1 13 2 4-3 8-4 13-2v22c-5-2-9-1-13 2-4-3-8-4-13-2zm11 5c-2-2-5-3-8-2v16c3-1 6 0 8 1zm4 0v15c2-1 5-2 8-1V8c-3-1-6 0-8 2z"/>',
    play: '<path d="M9 4c-1 0-2 1-2 3v18c0 2 1 3 3 2l18-9c2-1 2-3 0-4L11 5z"/>',
    star: '<path d="m16 1 4.6 9.3L31 12l-7.5 7.3L25.3 30 16 25l-9.3 5 1.8-10.7L1 12l10.4-1.7z"/>',
    expression: '<circle cx="16" cy="16" r="13"/><path d="M9 12h2m10 0h2M9 20q7 8 14 0" fill="none" stroke="var(--candy-bottom, #149ccb)" stroke-width="3" stroke-linecap="round"/>',
    hair: '<path d="M4 26V13C3-2 30-3 28 15v11h-6V13l-5 4-4-6-3 7v8z"/>',
    top: '<path d="m8 4 5-2c0 5 6 5 6 0l5 2 6 8-6 4-3-4v17H11V12l-3 4-6-4z"/>',
    bottom: '<path d="M7 3h18l2 26H17l-1-14-1 14H5z"/>',
    shoes: '<path d="M3 12h11l4 6 10 3v7H3z"/><path d="M5 9h8v4H5z"/>',
    hat: '<path d="M8 19V11c0-12 16-12 16 0v8h5v7H3v-7z"/>',
    glass: '<path d="M2 11h12v3h4v-3h12v11H18v-5h-4v5H2zm4 4v4h4v-4zm16 0v4h4v-4z"/>',
    face: '<path d="m16 3 4 8 9 2-7 6 2 10-8-5-8 5 2-10-7-6 9-2z"/>',
    ear: '<path d="M16 3a8 8 0 0 0-8 8h5a3 3 0 1 1 4 3c-4 2-5 4-5 8h5c0-3 2-3 4-4a8 8 0 0 0-5-15z"/><circle cx="14.5" cy="27" r="4"/>',
    neck: '<path d="M3 5h4c0 13 18 13 18 0h4c0 11-5 16-11 17v2l3 3-5 5-5-5 3-3v-2C8 21 3 16 3 5z"/>',
    back: '<path d="M15 13C10 2 2 1 2 10c0 9 7 13 13 15zm2 0c5-11 13-12 13-3 0 9-7 13-13 15z"/>',
    pet: '<ellipse cx="16" cy="23" rx="9" ry="7"/><circle cx="6" cy="13" r="4"/><circle cx="14" cy="7" r="4"/><circle cx="23" cy="8" r="4"/><circle cx="28" cy="16" r="4"/>',
    effect: '<path d="m17 0 4 11 10 4-10 4-4 12-4-12-10-4 10-4zm-11 0 1.5 4L11 5.5 7.5 7 6 11 4.5 7 1 5.5 4.5 4z"/>',
    bg: '<path d="M2 4h28v24H2zm4 20h20L19 14l-5 6-4-4z"/><circle cx="10" cy="11" r="3"/>',
    frame: '<path d="M2 2h28v28H2zm5 5v18h18V7z"/>',
    undo: '<path d="m13 2-11 9 11 9v-6h7a6 6 0 0 1 0 12h-6v5h6a11 11 0 0 0 0-22h-7z"/>',
  };
  /* Keep navigation's arrow distinct from the wardrobe's wings. */
  paths.arrow = '<path d="m14 3-12 13 12 13 4-4-6-6h18v-6H12l6-6z"/>';
  /* Original toy-like navigation objects. Each highlight is a small solid shape,
     so repeated icons have no shared SVG IDs, filters or remote assets. */
  const speaker =
    '<path d="M2.5 12.5h6L20 5v23L8.5 21h-6z" fill="#754ca8" stroke="#fff4cf" stroke-width="1.3" stroke-linejoin="round"/>' +
    '<path d="M3.5 12.7h6v8.2h-6z" fill="#9064ca"/>' +
    '<path d="M3.5 13h6v2.1h-6z" fill="#c4a3ec"/>' +
    '<path d="M8.4 21.3h5l1.5 6.6c.2.7-.4 1.2-1.1 1.2h-3.2c-.5 0-.9-.3-1-.8z" fill="#70459e"/>' +
    '<path d="M9.5 12.3 18.6 6v21.5l-9.1-6.6z" fill="#29bfd3"/>' +
    '<path d="m10.4 12.7 6.8-4.8v2.8l-6.8 4.4z" fill="#8bf1ee"/>' +
    '<path d="m10.4 18.5 8.2 4.8v4.2l-9.1-6.6z" fill="#169db8"/>' +
    '<path d="M18.1 5.5c0-1.3 2.7-1.3 2.7 0v21.7c0 1.3-2.7 1.3-2.7 0z" fill="#dc8739"/>' +
    '<path d="M18.4 5.5c0-.5 1.3-.5 1.3 0v18.3h-1.3z" fill="#ffd681"/>';
  const rich = {
    home:
      '<path d="M6 15v13c0 1.2 1 2 2.2 2h15.6c1.2 0 2.2-.8 2.2-2V15L16 6z" fill="#247ea8" stroke="#fff7d9" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M7.4 15v12.3h17.2V15L16 8.1z" fill="#fff0bb"/>' +
      '<path d="M7.4 15.4h17.2v3L16 12.1l-8.6 6.3z" fill="#e2bc79"/>' +
      '<path d="M22.1 4.8h3v7.6h-3z" fill="#d57631" stroke="#8a4923" stroke-width=".8"/>' +
      '<path d="M22.5 5.2h2.2v2.1h-2.2z" fill="#ffcd73"/>' +
      '<path d="m2.5 14.4 12-11c.8-.7 2.2-.7 3 0l12 11c1 1 .2 2.6-1.2 2.6-.4 0-.7-.1-1-.4L16 6.6 4.7 16.6c-1.5 1.3-3.6-.7-2.2-2.2z" fill="#cc542c" stroke="#fff7d9" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="m3.8 14.6 11.4-10c.5-.5 1.1-.5 1.6 0l11.3 10-1.2.7L16 6 5 15.3z" fill="#ff9a42"/>' +
      '<path d="m5.4 13.1 9.8-8.5c.5-.5 1.1-.5 1.6 0l4.6 4.1-5.5-2.4z" fill="#ffd376"/>' +
      '<path d="M12 20.3a4 4 0 0 1 8 0v7h-8z" fill="#127fa4"/>' +
      '<path d="M13 20.1a3 3 0 0 1 6 0v6.5h-6z" fill="#37c0d2"/>' +
      '<path d="M13.6 20.4c0-1.8 1.3-2.2 2.2-2.1v7.8h-2.2z" fill="#95f1e8"/>' +
      '<circle cx="18.1" cy="23" r=".9" fill="#ffe269"/>' +
      '<path d="M10.7 27h10.6v2H10.7z" fill="#8961b0"/><path d="M10.7 27h10.6v.7H10.7z" fill="#c3a6e1"/>',
    shop:
      '<path d="m9 4 5-2c0 4 4 4 4 0l5 2 7 8-5 5-3-4v15c0 1-1 2-2 2h-8c-1 0-2-1-2-2V13l-3 4-5-5z" fill="#bc376a" stroke="#fff3d2" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="m9.5 4.8 3.9-1.6c1.1 4 4.1 4 5.2 0l3.9 1.6 6 7.1-3.3 3.2-4.3-4v17H11v-17l-4.3 4-3.3-3.2z" fill="#fb7bab"/>' +
      '<path d="m9.5 4.8 3.9-1.6c1.1 4 4.1 4 5.2 0l3.9 1.6-1.5 4.3h-10z" fill="#ffc4d9"/>' +
      '<path d="m3.4 11.9 3.3 3.2 1.4-1.3-3.4-3.6zm21.9 3.2 3.3-3.2-1.3-1.5-3.4 3.4zM11 25.1h10v3H11z" fill="#df518e"/>' +
      '<path d="m12.8 3.4 3.2 2.9-2.1 3.3-3.2-3.2zm6.4 0L16 6.3l2.1 3.3 3.2-3.2z" fill="#fff5b6" stroke="#e7ac5c" stroke-width=".5"/>' +
      '<path d="M15.5 9.1h1v17h-1z" fill="#ffe2ea"/>' +
      '<circle cx="16" cy="12" r=".6" fill="#b94776"/><circle cx="16" cy="16" r=".6" fill="#b94776"/><circle cx="16" cy="20" r=".6" fill="#b94776"/>' +
      '<path d="m20.7 15.9.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="#ffe774" stroke="#c68825" stroke-width=".5"/>' +
      '<path d="m10.4 11.5-.1 7.3" stroke="#fff0f5" stroke-width="1.1" stroke-linecap="round"/>',
    trophy:
      '<path d="m7.5 19.7 3.7-1.4 2.8 5.6-3.6 4.3-1-3.9-3.6.6zm17 0-3.7-1.4-2.8 5.6 3.6 4.3 1-3.9 3.6.6z" fill="#2589d2" stroke="#fff2c5" stroke-width=".7" stroke-linejoin="round"/>' +
      '<path d="M8.8 7H3.6v4.8c0 5.3 3.9 8 8.2 8m11.4-12.8h5.2v4.8c0 5.3-3.9 8-8.2 8" fill="none" stroke="#c27a20" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M8.8 6.2H3.6v4.8c0 5.3 3.9 8 8.2 8m11.4-12.8h5.2v4.8c0 5.3-3.9 8-8.2 8" fill="none" stroke="#ffe37d" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M8 3h16v7.6c0 6.1-3.7 9.4-6.7 10.3v4.2h5.2V29h-13v-3.9h5.2v-4.2C11.7 20 8 16.7 8 10.6z" fill="#d18a19" stroke="#fff3c8" stroke-width="1" stroke-linejoin="round"/>' +
      '<path d="M9.3 4.1h13.4v6.5c0 5-2.9 8.2-6.7 8.7-3.8-.5-6.7-3.7-6.7-8.7z" fill="#ffc933"/>' +
      '<path d="M9.3 4.1h13.4v2.4H9.3z" fill="#fff29b"/>' +
      '<path d="M10.7 7.3v3.3c0 3.2 1.3 5.4 2.9 6.3-1.4-3.1-1.2-6.5-1.2-9.6z" fill="#fff6b1"/>' +
      '<path d="M22.7 7.3v3.3c0 5-2.9 8.2-6.7 8.7 4.4-3.2 4.5-7.7 4.5-12z" fill="#f0a51b"/>' +
      '<path d="m16 8.2 1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4z" fill="#fff3a7" stroke="#dd961b" stroke-width=".7"/>' +
      '<path d="M15.4 21.2h1.2v4h-1.2zM10.4 26.1h11.2v1.3H10.4z" fill="#ffe776"/>',
    sound: speaker +
      '<path d="M24 12.1c2 2.1 2 5.4 0 7.6m3.1-11.2c4 4 4 10.9 0 15" fill="none" stroke="#24689b" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M24 11.3c2 2.1 2 5.4 0 7.6m3.1-11.2c4 4 4 10.9 0 15" fill="none" stroke="#96eff5" stroke-width="1.8" stroke-linecap="round"/>',
    mute: speaker +
      '<path d="m23 11 6.2 10m0-10L23 21" fill="none" stroke="#fff1dd" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="m23 11.5 6.2 10m0-10L23 21.5" fill="none" stroke="#b63845" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="m23 10.7 6.2 10m0-10L23 20.7" fill="none" stroke="#ff7879" stroke-width="2.8" stroke-linecap="round"/>',
    coin:
      '<ellipse cx="16" cy="17.7" rx="13.7" ry="13.1" fill="#b77419" stroke="#fff7cf" stroke-width="1.2"/>' +
      '<ellipse cx="16" cy="15.8" rx="13.5" ry="12.6" fill="#edaa24"/>' +
      '<ellipse cx="16" cy="14.6" rx="12.6" ry="12.1" fill="#ffe781"/>' +
      '<path d="M4.1 16.4c1.2 6 5.9 10.3 11.9 10.3s10.7-4.3 11.9-10.3c.8 7.1-4.8 12.7-11.9 12.7S3.3 23.5 4.1 16.4z" fill="#d18a1b"/>' +
      '<ellipse cx="16" cy="14.7" rx="9.8" ry="9.4" fill="#e7a625"/>' +
      '<ellipse cx="16" cy="15.5" rx="9" ry="8.5" fill="#ffcc3c"/>' +
      '<path d="M8.7 10.2c1.6-2.5 4.5-3.9 7.4-3.7" fill="none" stroke="#fff7bf" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="m16 8.7 2.1 4.3 4.8.7-3.4 3.4.8 4.7-4.3-2.3-4.3 2.3.8-4.7-3.4-3.4 4.8-.7z" fill="#c18722"/>' +
      '<path d="m16 7.7 2.1 4.3 4.8.7-3.4 3.4.8 4.7-4.3-2.3-4.3 2.3.8-4.7-3.4-3.4 4.8-.7z" fill="#ffef99"/>' +
      '<path d="m16 8.8 1.6 3.5 3.7.6-2.7 2.6.6 3.6-3.2-1.7z" fill="#ffe16d"/>' +
      '<ellipse cx="8.3" cy="6.3" rx="3.6" ry="1.3" transform="rotate(-34 8.3 6.3)" fill="#ffffdf"/>',
  };
  window.QPCandyIcons = Object.freeze({render(name) {
    const object = rich[name];
    return '<svg class="candy-icon' + (object ? ' rich-icon' : '') + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="' + (object ? 'none' : 'currentColor') + '">' + (object || paths[name] || paths.star) + '</svg>';
  }});
})();
