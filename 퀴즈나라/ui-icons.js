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
  window.QPCandyIcons = Object.freeze({render(name) {
    return '<svg class="candy-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false" fill="currentColor">' + (paths[name] || paths.star) + '</svg>';
  }});
})();
