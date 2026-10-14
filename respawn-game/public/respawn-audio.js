/* RESPAWN sound bridge, loaded by every level page before its own code (the full game adds it).
 *
 * Every AudioContext a level makes is given a master volume stage in front of its speakers,
 * set from the main menu's SOUND and MASTER VOLUME (localStorage 'respawn:settings').
 * Changes made while the level is open arrive through the `storage` event.
 * The levels' own mute keys keep working underneath this. */
(function () {
  var KEY = 'respawn:settings';
  function volume() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (s.sound === false) return 0;
      return typeof s.master === 'number' ? Math.max(0, Math.min(1, s.master)) : 0.9;
    } catch (e) { return 0.9; }
  }
  var vol = volume(), stages = [];
  var Real = window.AudioContext || window.webkitAudioContext;
  if (Real) {
    var Patched = function (opts) {
      var ctx = opts === undefined ? new Real() : new Real(opts);
      var g = ctx.createGain();
      g.gain.value = vol;
      g.connect(ctx.destination);
      Object.defineProperty(ctx, 'destination', { value: g, configurable: true });
      stages.push({ ctx: ctx, g: g });
      return ctx;
    };
    Patched.prototype = Real.prototype;
    window.AudioContext = Patched;
    if (window.webkitAudioContext) window.webkitAudioContext = Patched;
  }
  function apply() {
    vol = volume();
    for (var i = 0; i < stages.length; i++) {
      var st = stages[i];
      try { st.g.gain.setTargetAtTime(vol, st.ctx.currentTime, 0.05); } catch (e) { st.g.gain.value = vol; }
    }
    var media = document.querySelectorAll('audio, video');
    for (var j = 0; j < media.length; j++) media[j].volume = vol;
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  window.addEventListener('message', function (e) { if (e.data && e.data.type === 'respawn:settings') apply(); });
})();
