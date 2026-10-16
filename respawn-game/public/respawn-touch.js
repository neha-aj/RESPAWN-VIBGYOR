/* RESPAWN touch bridge, loaded by every level page before its own code (the full game adds it).
 *
 * Standing alone, each level shows a "made for desktop" notice on phones, because it has no
 * on-screen controls of its own. Inside the full game the shell lays its touch controls over the
 * level (src/TouchControls.tsx) and sends their presses in as key events, so here, and only when
 * the page runs inside the game's iframe, the level's "(any-pointer: fine)" check is answered yes.
 * On a laptop that check is already yes, so nothing changes there. */
(function () {
  if (window.parent === window || !window.matchMedia) return;
  var real = window.matchMedia.bind(window);
  window.matchMedia = function (q) {
    return /any-pointer\s*:\s*fine/.test(String(q)) ? real('all') : real(q);
  };
})();
