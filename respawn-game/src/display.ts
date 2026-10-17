/* The pre-game display check, run every time a game starts.
 *
 * The circle wipe between levels (the iris) is sized in real pixels from the window's actual size,
 * never from viewport units, so it cannot be too small or too big on any laptop. This check proves
 * it on the player's own screen before they begin: it builds the open and shut circles at their real
 * size, measures them, and makes sure they cover the whole window / uncover it. It also checks that
 * the animation clock is running and that the window is a playable size.
 */

export type IrisStage = 'open' | 'peek' | 'shut';

/** Diameter in px of the iris at each stage, for a window of w x h. */
export function irisDiameter(stage: IrisStage, w: number, h: number): number {
  if (stage === 'shut') return 0;
  if (stage === 'peek') return Math.round(Math.min(w, h) * 0.2);
  return Math.ceil(Math.hypot(w, h)) + 48;   // the whole diagonal, plus a margin: every corner is inside the circle
}

export const viewSize = () => ({
  w: Math.max(1, Math.round(window.visualViewport?.width ?? window.innerWidth)),
  h: Math.max(1, Math.round(window.visualViewport?.height ?? window.innerHeight)),
});

const raf = (ms: number) => new Promise<boolean>((res) => {
  let done = false;
  const t = setTimeout(() => { if (!done) { done = true; res(false); } }, ms);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!done) { done = true; clearTimeout(t); res(true); } }));
});

/** Returns a list of problems found (empty = all clear). */
export async function checkDisplay(): Promise<string[]> {
  const issues: string[] = [];
  const { w, h } = viewSize();
  const phone = !!window.matchMedia?.('(pointer: coarse)').matches;   // phones: the shell asks for landscape itself, and zoom is fixed
  if (!phone && (w < 640 || h < 360)) issues.push(`THE WINDOW IS TOO SMALL (${w}x${h}). MAKE IT BIGGER OR PRESS F11 FOR FULLSCREEN.`);

  // browser zoom far from 100% squeezes or blows up the layout
  const zoom = window.outerWidth > 0 ? window.outerWidth / window.innerWidth : 1;
  if (!phone && Number.isFinite(zoom) && (zoom > 1.6 || zoom < 0.6) && !document.fullscreenElement) issues.push('BROWSER ZOOM LOOKS OFF. PRESS CTRL + 0 TO RESET IT.');

  // build the iris at real size, open and shut, and measure what the browser actually lays out
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;visibility:hidden;z-index:-1';
  document.body.appendChild(probe);
  try {
    const half = Math.hypot(w, h) / 2;
    probe.style.width = probe.style.height = `${irisDiameter('open', w, h)}px`;
    const open = probe.getBoundingClientRect();
    if (!(open.width / 2 >= half) || Math.abs(open.left + open.width / 2 - w / 2) > 2 || Math.abs(open.top + open.height / 2 - h / 2) > 2) {
      issues.push('THE CIRCLE TRANSITION DOES NOT FIT THIS SCREEN. TRY RELOADING THE PAGE.');
    }
    probe.style.width = probe.style.height = `${irisDiameter('shut', w, h)}px`;
    if (probe.getBoundingClientRect().width > 1) issues.push('THE CIRCLE TRANSITION CANNOT CLOSE FULLY ON THIS SCREEN.');
  } finally { probe.remove(); }

  // animation clock: a tab that is hidden or throttled would freeze every transition
  if (!(await raf(800))) issues.push('THE BROWSER IS NOT ANIMATING. KEEP THIS TAB IN FRONT AND TRY AGAIN.');
  return issues;
}
