/* Phones and tablets: who gets the on-screen controls, and how their presses reach a level.
 *
 * Every level reads the keyboard (window keydown / keyup, by e.key or, in RED's Phaser, by
 * e.keyCode). The levels run in a same-origin iframe, so a press on the touch overlay is sent
 * straight into that iframe as a KeyboardEvent built with the iframe's own constructor. To the
 * level it is the same key a laptop would send, and the level code stays as it is.
 *
 * Touch mode: a coarse primary pointer (a phone or tablet), or `?touch=1` to try it with a mouse.
 * `?touch=0` turns it off. On a laptop with a keyboard none of this is shown.
 */

const forced = new URLSearchParams(window.location.search).get('touch');
export const IS_TOUCH = forced === '1' || (forced !== '0' && !!window.matchMedia?.('(pointer: coarse)').matches);

const KEYS: Record<string, { code: string; keyCode: number }> = {
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ' ': { code: 'Space', keyCode: 32 },
  Enter: { code: 'Enter', keyCode: 13 },
  Escape: { code: 'Escape', keyCode: 27 },
  Shift: { code: 'ShiftLeft', keyCode: 16 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  ',': { code: 'Comma', keyCode: 188 },
  '.': { code: 'Period', keyCode: 190 },
};
function describe(key: string) {
  if (KEYS[key]) return KEYS[key];
  const up = key.toUpperCase();
  return { code: /^[A-Z]$/.test(up) ? `Key${up}` : '', keyCode: up.charCodeAt(0) };
}

/** Sends one key down or up into the level's window, as a real key would arrive. */
export function sendKey(win: Window | null | undefined, key: string, down: boolean) {
  if (!win) return;
  let doc: Document;
  try { doc = win.document; } catch { return; }
  const { code, keyCode } = describe(key);
  const Ctor = (win as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent ?? KeyboardEvent;
  const e = new Ctor(down ? 'keydown' : 'keyup', {
    key, code, bubbles: true, cancelable: true, composed: true, shiftKey: key === 'Shift' && down,
    keyCode, which: keyCode,
  } as KeyboardEventInit);
  // older engines ignore keyCode in the init dictionary; Phaser reads it
  if (e.keyCode !== keyCode) {
    Object.defineProperty(e, 'keyCode', { get: () => keyCode });
    Object.defineProperty(e, 'which', { get: () => keyCode });
  }
  (doc.body ?? doc.documentElement).dispatchEvent(e);
}

/* ---------- fullscreen + landscape (phones) ---------- */

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

export const fullscreenAvailable = () => !!(document.documentElement.requestFullscreen || (document.documentElement as FsEl).webkitRequestFullscreen);
export const isFullscreen = () => !!(document.fullscreenElement || (document as FsDoc).webkitFullscreenElement);

/** Fullscreen, then hold landscape where the browser allows it. Needs a tap (user gesture). */
export function enterFullscreen() {
  const el = document.documentElement as FsEl;
  const lock = () => {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    o?.lock?.('landscape').catch(() => { /* not allowed here: the rotate prompt covers it */ });
  };
  try {
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).then(lock).catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch { /* iPhone Safari: no fullscreen for pages */ }
}

export function exitFullscreen() {
  const d = document as FsDoc;
  if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
  else d.webkitExitFullscreen?.();
}
