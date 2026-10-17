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

/* Phones: mark the page (levels use html.phone for their phone layouts), and make the glow cheap.
 * Several levels blur whole canvases every frame (ctx.filter = 'blur(..)'), which a phone's GPU cannot
 * keep up with. Here the blur is dropped and each blurred glow is drawn once, dimmed, instead. */
(function () {
  try {
    if (window.parent === window || !window.parent.document.documentElement.classList.contains('is-touch')) return;
    document.documentElement.classList.add('phone');
    var proto = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    var d = proto && Object.getOwnPropertyDescriptor(proto, 'filter');
    if (!d || !d.set) return;
    Object.defineProperty(proto, 'filter', {
      configurable: true,
      get: function () { return this.__f || 'none'; },
      set: function (v) { this.__f = v; this.__b = /blur/.test(String(v)); },
    });
    var draw = proto.drawImage;
    proto.drawImage = function () {
      if (this.__b) { var a = this.globalAlpha; this.globalAlpha = a * 0.45; draw.apply(this, arguments); this.globalAlpha = a; return; }
      return draw.apply(this, arguments);
    };
  } catch (e) { /* not in the phone build */ }
})();
