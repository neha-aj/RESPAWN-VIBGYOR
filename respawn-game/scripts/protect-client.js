/* VIBGYOR page guard. Loaded first on every page of the RELEASE build (added by scripts/protect.mjs,
 * then scrambled with the rest of the code). It is a deterrent, not a vault: it stops casual copying,
 * re-hosting and re-embedding. Nothing here touches the game's own keys or mouse. */
(function () {
  'use strict';
  var HOSTS = __HOSTS__, HOME = __HOME__;
  var host = String(location.hostname || '');

  function hostOk() {
    for (var i = 0; i < HOSTS.length; i++) if (host === HOSTS[i]) return true;
    return false;
  }
  function block(why) {
    try { window.stop(); } catch (e) { /* ignore */ }
    document.documentElement.innerHTML = '<body style="margin:0;background:#000;color:#fff;font:14px/1.8 monospace;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">' +
      '<div><p style="letter-spacing:.2em">' + why + '</p><p><a style="color:#39FF14" href="' + HOME + '">PLAY THE REAL GAME &raquo;</a></p></div></body>';
    throw new Error('blocked');
  }

  // 1) only run on our own site
  if (!hostOk()) block('THIS IS NOT THE OFFICIAL GAME');

  // 2) only run inside our own pages (a foreign site embedding us in a frame is refused)
  if (window.top !== window.self) {
    var ok = false;
    try { ok = window.top.location.hostname === host; } catch (e) { ok = false; }
    if (!ok) block('THIS GAME CANNOT BE EMBEDDED');
  }

  // 3) no right-click menu, view-source / save / dev-tools shortcuts, text selection or dragging
  var typing = function (t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
  document.addEventListener('selectstart', function (e) { if (!typing(e.target)) e.preventDefault(); }, true);
  document.addEventListener('dragstart', function (e) { e.preventDefault(); }, true);
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase(), c = e.ctrlKey || e.metaKey;
    if (e.key === 'F12' || (c && e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || k === 'k')) ||
        (c && !e.shiftKey && (k === 'u' || k === 's')) || (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'u'))) {
      e.preventDefault(); e.stopPropagation();
    }
  }, true);

  // 4) a notice for anyone who opens the console
  try {
    console.log('%cSTOP', 'color:#FF1E2D;font:700 40px monospace');
    console.log('%cVIBGYOR is protected. Copying, re-hosting or re-publishing it without permission is not allowed.', 'font:14px monospace');
  } catch (e) { /* ignore */ }
})();
