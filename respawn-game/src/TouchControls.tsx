import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import type { LevelId } from './sequence';
import { enterFullscreen, exitFullscreen, fullscreenAvailable, isFullscreen, sendKey } from './touch';

/*
 * The on-screen controls laid over a level on phones and tablets (touch mode only, see touch.ts).
 *
 *   stick     bottom left: LEFT / RIGHT only ('lr') or eight ways ('8'), sent as the arrow keys
 *   buttons   bottom right: each one is a key, held down for as long as the thumb stays on it
 *   keyboard  ORANGE (a typing game): a full on-screen keyboard under the level
 *   top right PAUSE (Esc), any level extras (RED: restart room) and FULLSCREEN
 *
 * Taps that the levels already understand (VIOLET's shots, BLUE's objects, the menus and buttons
 * inside every level, BnW's chess board) go through to the level untouched: the overlay only
 * catches touches on its own controls.
 */

interface Btn { label: string; key: string }
interface Layout { stick?: 'lr' | '8'; buttons?: Btn[]; keyboard?: boolean; extras?: Btn[]; hint?: string; ownPause?: boolean }

const PAUSE: Btn = { label: 'II', key: 'Escape' };

/** Per level: which keys it reads, as the buttons a thumb can reach. BnW is played by tapping the board. */
export const LAYOUTS: Partial<Record<LevelId, Layout>> = {
  violet: { stick: 'lr', buttons: [{ label: 'JUMP', key: ' ' }], hint: 'DRAG TO AIM · DOUBLE TAP TO SHOOT' },
  indigo: { stick: '8', buttons: [{ label: 'FIRE', key: ' ' }] },
  blue: { stick: 'lr', buttons: [{ label: 'USE', key: 'e' }, { label: 'JUMP', key: ' ' }], hint: 'OR TAP A THING TO USE IT', ownPause: true },   // BLUE's header has its own pause button
  green: { stick: '8', buttons: [{ label: 'RUN', key: 'Shift' }], hint: 'TOUCH THE FOREST TO AIM' },
  yellow: {
    stick: 'lr',
    buttons: [   // two columns, read top to bottom: the attacks sit lowest, under the thumb
      { label: 'CHRG', key: 'l' }, { label: 'FLASH', key: 'i' },
      { label: 'DODGE', key: 'Shift' }, { label: 'JUMP', key: 'w' },
      { label: 'SWORD', key: 'k' }, { label: 'JAB', key: 'j' },
    ],
  },
  orange: { keyboard: true },
  red: { stick: 'lr', buttons: [{ label: 'JUMP', key: ' ' }], extras: [{ label: 'RETRY', key: 'r' }] },
};

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM,.'];

export function TouchControls({ level, color, target }: { level: LevelId; color: string; target: () => Window | null | undefined }) {
  const layout = LAYOUTS[level];
  const held = useRef(new Map<string, number>());
  const targetRef = useRef(target); targetRef.current = target;

  const press = (key: string) => {
    const n = held.current.get(key) ?? 0;
    held.current.set(key, n + 1);
    if (n === 0) sendKey(targetRef.current(), key, true);
  };
  const release = (key: string) => {
    const n = held.current.get(key) ?? 0;
    if (n <= 0) return;
    if (n === 1) { held.current.delete(key); sendKey(targetRef.current(), key, false); }
    else held.current.set(key, n - 1);
  };

  // nothing stays held down when the controls go away or the page is hidden
  useEffect(() => {
    const releaseAll = () => { for (const k of [...held.current.keys()]) { held.current.set(k, 1); release(k); } };
    const onVis = () => { if (document.hidden) releaseAll(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', releaseAll);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', releaseAll); releaseAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fs, setFs] = useState(isFullscreen());
  useEffect(() => {
    const f = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f);
    return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
  }, []);

  if (!layout) return null;
  return (
    <div className={`touch lvl-${level}${layout.keyboard ? ' with-kb' : ''}`} style={{ '--c': color } as CSSProperties} aria-hidden>
      <div className="touch-top">
        {layout.extras?.map((b) => <Key key={b.key} b={b} press={press} release={release} className="t-sys" />)}
        {!layout.ownPause && <Key b={PAUSE} press={press} release={release} className="t-sys" />}
        {fullscreenAvailable() && (
          <button type="button" className="t-sys t-fs" onClick={() => (fs ? exitFullscreen() : enterFullscreen())}>{fs ? '⤡' : '⤢'}</button>
        )}
      </div>
      {layout.hint && <div className="touch-hint">{layout.hint}</div>}
      {layout.stick && <Stick mode={layout.stick} press={press} release={release} />}
      {layout.buttons && (
        <div className={`touch-btns n${layout.buttons.length}`}>
          {layout.buttons.map((b) => <Key key={b.key} b={b} press={press} release={release} className="t-btn" />)}
        </div>
      )}
      {layout.keyboard && (
        <div className="touch-kb">
          {ROWS.map((row) => (
            <div key={row} className="kb-row">
              {[...row].map((ch) => <Key key={ch} b={{ label: ch, key: /[A-Z]/.test(ch) ? ch.toLowerCase() : ch }} press={press} release={release} className="kb-key" />)}
              {row === ROWS[2] && <Key b={{ label: '⌫', key: 'Backspace' }} press={press} release={release} className="kb-key wide" />}
            </div>
          ))}
          <div className="kb-row">
            <Key b={{ label: 'SPACE', key: ' ' }} press={press} release={release} className="kb-key space" />
            <Key b={{ label: 'ENTER', key: 'Enter' }} press={press} release={release} className="kb-key wide" />
          </div>
        </div>
      )}
    </div>
  );
}

type PR = { press: (k: string) => void; release: (k: string) => void };

/** One key: down while a finger (or the mouse) is on it, up when it lifts or slides off the screen. */
function Key({ b, press, release, className }: PR & { b: Btn; className: string }) {
  const [on, setOn] = useState(false);
  const isOn = useRef(false);   // pointerup and lostpointercapture both arrive: release once
  const down = (e: RPointerEvent<HTMLElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    if (!isOn.current) { isOn.current = true; setOn(true); press(b.key); }
  };
  const up = () => { if (isOn.current) { isOn.current = false; setOn(false); release(b.key); } };
  return (
    <button type="button" tabIndex={-1} className={`${className}${on ? ' on' : ''}`}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={(e) => e.preventDefault()}>
      {b.label}
    </button>
  );
}

const DIRS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;

/** The thumbstick: where the knob sits decides which arrow keys are down. */
function Stick({ mode, press, release }: PR & { mode: 'lr' | '8' }) {
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const keys = useRef(new Set<string>());
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const apply = (next: Set<string>) => {
    for (const k of DIRS) {
      if (next.has(k) && !keys.current.has(k)) press(k);
      else if (!next.has(k) && keys.current.has(k)) release(k);
    }
    keys.current = next;
  };
  const move = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect(), R = r.width / 2;
    let dx = cx - (r.left + R), dy = mode === 'lr' ? 0 : cy - (r.top + R);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    setKnob({ x: dx, y: dy });
    const next = new Set<string>(), dead = R * 0.3;
    if (mode === 'lr') {
      if (dx < -dead) next.add('ArrowLeft'); else if (dx > dead) next.add('ArrowRight');
    } else if (Math.hypot(dx, dy) > dead) {
      const a = Math.atan2(dy, dx), s = Math.PI / 8;   // eight 45° sectors
      if (Math.abs(a) < 3 * s) next.add('ArrowRight');
      if (Math.abs(a) > 5 * s) next.add('ArrowLeft');
      if (a < -s && a > -7 * s) next.add('ArrowUp');
      if (a > s && a < 7 * s) next.add('ArrowDown');
    }
    apply(next);
  };
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); apply(new Set()); };

  return (
    <div ref={base} className={`touch-stick ${mode}`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (active.current !== null) return;
        active.current = e.pointerId;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (e.pointerId === active.current) move(e.clientX, e.clientY); }}
      onPointerUp={(e) => { if (e.pointerId === active.current) end(); }}
      onPointerCancel={(e) => { if (e.pointerId === active.current) end(); }}
      onLostPointerCapture={(e) => { if (e.pointerId === active.current) end(); }}>
      <div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
