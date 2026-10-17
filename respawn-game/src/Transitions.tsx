import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { irisDiameter, viewSize, type IrisStage } from './display';
import { SPECTRUM } from './sequence';
import { sfx } from './sfx';
import { IS_TOUCH } from './touch';

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/**
 * The circle wipe. A black screen with a round hole whose diameter is tweened in real pixels
 * (from the window's actual size, re-read on resize and zoom), so the circle always opens past
 * every corner and closes to nothing on any screen. A glowing ring in the chapter colour rides the rim.
 */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export function Iris({ stage, ms, color, ring }: { stage: IrisStage; ms: number; color: string; ring: boolean }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const cur = useRef<number | null>(null);   // diameter now, in window px
  const last = useRef({ stage, ms });
  const [size, setSize] = useState(viewSize);
  const sc = Math.min(1, 640 / Math.max(size.w, size.h));   // the canvas is small and stretched by CSS: a phone only fills ~300k pixels

  useEffect(() => {
    const f = () => setSize(viewSize());
    window.addEventListener('resize', f); window.visualViewport?.addEventListener('resize', f); document.addEventListener('fullscreenchange', f);
    return () => { window.removeEventListener('resize', f); window.visualViewport?.removeEventListener('resize', f); document.removeEventListener('fullscreenchange', f); };
  }, []);

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    cv.width = Math.max(1, Math.round(size.w * sc)); cv.height = Math.max(1, Math.round(size.h * sc));
    const g = cv.getContext('2d')!;
    const paint = (d: number) => {
      cur.current = d;
      const w = cv.width, h = cv.height, r = (d / 2) * sc;
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#000';
      if (r < 0.5) { g.fillRect(0, 0, w, h); return; }
      g.beginPath(); g.rect(0, 0, w, h); g.arc(w / 2, h / 2, r, 0, Math.PI * 2, true); g.fill('evenodd');   // black everywhere except the circle
      if (ring) {   // a glowing rim in the chapter colour
        g.strokeStyle = color;
        for (let k = 3; k >= 0; k--) { g.globalAlpha = k === 0 ? 0.95 : 0.16; g.lineWidth = (k === 0 ? 2 : 6 + k * 7) * Math.max(0.6, sc); g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.stroke(); }
        g.globalAlpha = 1;
      }
    };
    const to = irisDiameter(stage, size.w, size.h);
    const changed = last.current.stage !== stage || last.current.ms !== ms;
    last.current = { stage, ms };
    if (ms <= 0 || cur.current === null || !changed) { paint(to); return; }   // jump (also on a resize mid-way)
    const from = cur.current, t0 = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      paint(from + (to - from) * ease(p));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [stage, ms, size.w, size.h, sc, color, ring]);

  return <div className="iris" aria-hidden><canvas ref={cvRef} className="iris-canvas" /></div>;
}

/**
 * The spectrum card between chapters: the V-I-B-G-Y-O-R strip, colours already won lit,
 * the new one flaring up, and its name settling in above.
 * `finale` lights the whole strip one band after another, with no words: the ending
 * sequence (still to come) takes over from there.
 */
export function SpectrumCard({ band, leaving, finale }: { band: number; leaving: boolean; finale?: boolean }) {
  const name = SPECTRUM[band].name;
  return (
    <div className={`card${leaving ? ' leaving' : ''}`} style={vars({ '--c': SPECTRUM[band].color })} aria-live="polite">
      {!finale && (
        <div className="card-name" aria-label={name}>
          {[...name].map((ch, i) => <span key={i} style={vars({ '--i': i })} aria-hidden>{ch}</span>)}
        </div>
      )}
      <div className="strip">
        {SPECTRUM.map((b, i) => {
          const state = finale ? 'ignite' : i < band ? 'lit' : i === band ? 'ignite' : 'off';
          return (
            <div key={b.letter} className={`seg ${state}`} style={vars({ '--c': b.color, '--i': finale ? i : 0 })}>
              <span className="bar" />
              <span className="letter">{b.letter}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hold SPACE (or hold the mouse button, or a finger on a phone) to skip a cutscene. The prompt only
 * shows once the player touches a key, the mouse or the screen, so it never sits on top of the scene uninvited.
 */
export function useHoldSkip(onSkip: () => void, enabled = true) {
  const [prompt, setPrompt] = useState(false);
  const [held, setHeld] = useState(0);
  const cb = useRef(onSkip); cb.current = onSkip;
  useEffect(() => {
    if (!enabled) return;
    let holding = false, start = 0, raf = 0, hide = 0, done = false;
    const HOLD = 900;
    const show = () => { setPrompt(true); clearTimeout(hide); hide = window.setTimeout(() => { if (!holding) setPrompt(false); }, 2200); };
    const tick = () => {
      if (!holding) return;
      const p = Math.min(1, (performance.now() - start) / HOLD);
      setHeld(p);
      if (p >= 1) { holding = false; done = true; setHeld(0); setPrompt(false); sfx.blip(); cb.current(); return; }
      raf = requestAnimationFrame(tick);
    };
    const down = () => { show(); if (holding || done) return; holding = true; start = performance.now(); raf = requestAnimationFrame(tick); };
    const up = () => { holding = false; cancelAnimationFrame(raf); setHeld(0); show(); };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); if (!e.repeat) down(); } else show(); };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') up(); };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); window.addEventListener('pointermove', show);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(hide);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('pointermove', show);
    };
  }, [enabled]);
  return { prompt, held };
}

export function SkipPrompt({ prompt, held }: { prompt: boolean; held: number }) {
  return (
    <div className={`skip${prompt || held > 0 ? ' show' : ''}`} aria-hidden={!prompt}>
      <svg viewBox="0 0 36 36" className="skip-ring">
        <circle cx="18" cy="18" r="15" className="track" />
        <circle cx="18" cy="18" r="15" className="fill" style={{ strokeDashoffset: 94.25 * (1 - held) }} />
      </svg>
      <span>{IS_TOUCH ? 'HOLD TO SKIP' : <>HOLD <kbd>SPACE</kbd> TO SKIP</>}</span>
    </div>
  );
}

/**
 * A video (the intro and outro you add later), letterboxed on black. Fades in once it is actually playing.
 * Hold SPACE (or hold the mouse button) to skip; the prompt only shows once the player
 * touches a key or the mouse, so it never sits on top of the video uninvited.
 * A missing or broken video simply counts as finished, so the run never gets stuck.
 */
export function VideoPlayer({ src, color, fading, onEnd, skipAfter }: { src: string; color: string; fading: boolean; onEnd: () => void; skipAfter?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const ended = useRef(false);
  const end = useRef(onEnd); end.current = onEnd;
  const finish = () => { if (!ended.current) { ended.current = true; end.current(); } };

  // start playback; if the browser refuses sound without a click, ask for one
  useEffect(() => {
    const v = ref.current!;
    const t = setTimeout(() => {
      v.play().catch(() => {
        if (!IS_TOUCH) { setBlocked(true); return; }
        // phones (iPhone especially) may refuse sound this long after the tap: start muted instead
        v.muted = true; setMuted(true);
        v.play().catch(() => { v.muted = false; setMuted(false); setBlocked(true); });
      });
    }, 120);
    return () => clearTimeout(t);
  }, []);

  // with skipAfter, a "SKIP IN 5" countdown (from when the video starts) replaces hold-to-skip
  const { prompt, held } = useHoldSkip(finish, skipAfter === undefined);

  const onTime = () => {
    const v = ref.current!;
    if (v.duration && v.duration - v.currentTime < 0.35) finish();   // start the hand-off just before the last frame
  };

  return (
    <div className={`video-layer${fading ? ' fading' : ''}`} style={vars({ '--c': color })}>
      <video ref={ref} src={src} className={playing ? 'on' : ''} playsInline preload="auto"
        onPlaying={() => setPlaying(true)} onTimeUpdate={onTime} onEnded={finish} onError={finish} />
      {muted && (
        <button type="button" className="tap-sound" onClick={(e) => { e.stopPropagation(); const v = ref.current; if (v) { v.muted = false; void v.play().catch(() => {}); } setMuted(false); }}>
          🔊 TAP FOR SOUND
        </button>
      )}
      {blocked && (
        <button type="button" className="tap-to-play" autoFocus
          onClick={(e) => { e.stopPropagation(); setBlocked(false); void ref.current?.play().catch(() => finish()); }}>
          ▶ PLAY
        </button>
      )}
      {skipAfter === undefined ? <SkipPrompt prompt={prompt} held={held} /> : playing && <SkipCountdown seconds={skipAfter} onSkip={finish} />}
    </div>
  );
}

/** Bottom-right: SKIP IN 5… 4… then a SKIP button; ENTER, SPACE or a click/tap skips once it is open. */
function SkipCountdown({ seconds, onSkip }: { seconds: number; onSkip: () => void }) {
  const [left, setLeft] = useState(seconds);
  const cb = useRef(onSkip); cb.current = onSkip;
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => setLeft(Math.max(0, seconds - Math.floor((performance.now() - t0) / 1000))), 200);
    return () => clearInterval(id);
  }, [seconds]);
  const open = left === 0;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); sfx.blip(); cb.current(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <button type="button" className={`skip-count${open ? ' open' : ''}`} disabled={!open}
      onClick={(e) => { e.stopPropagation(); if (open) { sfx.blip(); cb.current(); } }}>
      {open ? 'SKIP ▶' : `SKIP IN ${left}`}
    </button>
  );
}

/** Shown over a level's own victory screen: a quiet prompt and a bar that runs out the hold. */
export function ContinueHint({ hold, color }: { hold: number; color: string }) {
  return (
    <div className="continue" style={vars({ '--c': color, '--hold': `${hold}ms` })}>
      <span className="continue-label">{IS_TOUCH ? 'TAP TO CONTINUE' : <>CONTINUE <kbd>ENTER</kbd></>}</span>
      <span className="continue-bar"><span /></span>
    </div>
  );
}

/** A soft wash of the new colour blooming out from the centre as the iris opens. */
export function Bloom({ color, onDone }: { color: string; onDone: () => void }) {
  return <div className="bloom" style={vars({ '--c': color })} onAnimationEnd={onDone} />;
}
