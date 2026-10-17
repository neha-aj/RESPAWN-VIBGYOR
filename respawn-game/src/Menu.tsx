import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PANELS, PIC_URL } from './art';
import { CHECKPOINT_RULES, CHECKPOINTS, RED_DEATHS, SPECTRUM, type LevelId } from './sequence';
import { settings, type Difficulty, type Settings } from './settings';
import { sfx } from './sfx';

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const BAND_IDS: LevelId[] = ['violet', 'indigo', 'blue', 'green', 'yellow', 'orange', 'red'];

/** VIBGYOR in the seven colours, one letter each. */
export function Title({ small }: { small?: boolean }) {
  return (
    <h1 className={`title${small ? ' small' : ''}`} aria-label="VIBGYOR">
      {[...'VIBGYOR'].map((ch, i) => <span key={i} style={vars({ '--c': SPECTRUM[i].color, '--i': i })} aria-hidden>{ch}</span>)}
    </h1>
  );
}

/** One panel of the picture, cropped to a tall thumbnail. */
function Thumb({ band, h = 104 }: { band: number; h?: number }) {
  const p = PANELS[band], s = h / 600, w = Math.round(h * 0.38), pw = (p.x1 - p.x0) * s;
  return <span className="thumb" style={{ width: w, height: h, backgroundImage: `url(${PIC_URL})`, backgroundSize: `${1600 * s}px ${900 * s}px`, backgroundPosition: `${-(p.x0 * s + (pw - w) / 2)}px ${-10 * s}px` }} />;
}

const Flag = ({ color }: { color: string }) => (
  <svg className="flag" viewBox="0 0 10 12" aria-hidden><rect x="1" y="0" width="1" height="12" fill="#ddd" /><path d="M2 0h7l-2 2.5L9 5H2z" fill={color} /></svg>
);

/** The road ahead, as a picture only: nothing on it can be clicked or chosen. */
export function Roadmap({ compact, mode = 'hard' }: { compact?: boolean; mode?: Difficulty }) {
  return (
    <div className={`roadmap${compact ? ' compact' : ''}`} role="img"
      aria-label={mode === 'hard' ? 'The road ahead: BnW, then Violet, Indigo, Blue (checkpoint), Green (checkpoint), Yellow, Orange and Red (checkpoint).' : 'The road ahead: BnW, then Violet, Indigo, Blue, Green, Yellow, Orange and Red.'}>
      <div className="road">
        <div className="node bnw" style={vars({ '--c': '#ffffff' })}>
          <span className="flag-slot"><span className="here">YOU</span></span>
          <span className="thumb bnw-thumb"><span>♞</span></span>
          <span className="node-letter">BnW</span>
        </div>
        {SPECTRUM.map((b, i) => {
          const cp = mode === 'hard' && CHECKPOINTS.includes(BAND_IDS[i]);
          return (
            <div key={b.letter} className={`node${cp ? ' cp' : ''}`} style={vars({ '--c': b.color, '--i': i + 1 })}>
              <span className="flag-slot">{cp && <Flag color={b.color} />}</span>
              <Thumb band={i} h={compact ? 78 : 104} />
              <span className="node-letter">{b.letter}</span>
            </div>
          );
        })}
        <div className="node end" style={vars({ '--c': '#ffffff', '--i': 8 })}>
          <span className="flag-slot" />
          <span className="thumb end-thumb"><span>★</span></span>
          <span className="node-letter">END</span>
        </div>
      </div>
      {mode === 'hard' && <div className="legend"><Flag color="#ffffff" /> CHECKPOINT</div>}
    </div>
  );
}

/** The checkpoint rules, in full. */
export function CheckpointRules() {
  return (
    <div className="rules">
      <p className="rules-lead"><span className="mode-tag hard">HARD</span> CHECKPOINTS: <b style={{ color: SPECTRUM[2].color }}>BLUE</b> · <b style={{ color: SPECTRUM[3].color }}>GREEN</b> · <b style={{ color: SPECTRUM[6].color }}>RED</b></p>
      <p className="rules-note">A checkpoint is yours as soon as you <b>reach</b> that level. Before BLUE, you go back to VIOLET.</p>
      <ul className="rules-list">
        {CHECKPOINT_RULES.map((r) => (
          <li key={r.die}><span className="die">DIE IN {r.die}</span><span className="arrow">→</span><span className="back" style={{ color: r.color }}>BACK TO {r.back}</span></li>
        ))}
      </ul>
      <p className="rules-note">DYING = a level's GAME OVER (out of lives or out of time). RED has no lives: {RED_DEATHS} deaths there count as one.</p>
      <p className="rules-note">No skipping: on HARD you must clear a level to move on.</p>
      <p className="rules-note">BnW comes first, before any of this, and keeps its own retries.</p>
    </div>
  );
}

/** The EASY rules, in full. */
export function EasyRules() {
  return (
    <div className="rules">
      <p className="rules-lead"><span className="mode-tag easy">EASY</span> NO CHECKPOINTS AT ALL</p>
      <ul className="rules-list">
        <li><span className="die">DIE IN <b style={{ color: SPECTRUM[1].color }}>INDIGO</b></span><span className="arrow">→</span><span className="back" style={{ color: SPECTRUM[1].color }}>RESTART INDIGO</span></li>
        <li><span className="die">DIE IN ANY LEVEL</span><span className="arrow">→</span><span className="back" style={{ color: '#39FF14' }}>RESTART THAT LEVEL</span></li>
      </ul>
      <p className="rules-note">After every death you CHOOSE: <b>TRY AGAIN</b> from the start of that level, or <b>SKIP</b> it and move on to the next one (die at INDIGO, go on to BLUE) without clearing it.</p>
      <p className="rules-note">DYING = a level's GAME OVER (out of lives or out of time). RED has no lives: {RED_DEATHS} deaths there count as one.</p>
      <p className="rules-note">BnW comes first, before any of this, and keeps its own retries.</p>
    </div>
  );
}

export const ModeRules = ({ mode }: { mode: Difficulty }) => (mode === 'easy' ? <EasyRules /> : <CheckpointRules />);

/** The chosen difficulty, kept in step with the saved setting. */
function useMode() {
  const [mode, setMode] = useState<Difficulty>(settings.get().difficulty);
  useEffect(() => settings.subscribe((s) => setMode(s.difficulty)), []);
  return mode;
}

/* ---------------------------------------------------------------- the menu */

type Item = { id: string; label: string };
const MAIN: Item[] = [{ id: 'start', label: 'START' }, { id: 'mode', label: 'MODE' }, { id: 'settings', label: 'SETTINGS' }, { id: 'how', label: 'HOW IT WORKS' }, { id: 'stop', label: 'STOP' }];

/** Keyboard + mouse list navigation with a blinking ▶ cursor. */
function useList(n: number, onPick: (i: number) => void, onBack?: () => void, onLR?: (i: number, d: number) => void, initial = 0) {
  const [sel, setSel] = useState(initial);
  const st = useRef({ sel, onPick, onBack, onLR }); st.current = { sel, onPick, onBack, onLR };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key, s = st.current;
      if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); setSel((v) => (v + 1) % n); sfx.move(); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); setSel((v) => (v - 1 + n) % n); sfx.move(); }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { if (s.onLR) { e.preventDefault(); s.onLR(s.sel, -1); } }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { if (s.onLR) { e.preventDefault(); s.onLR(s.sel, 1); } }
      else if ((k === 'Enter' || k === ' ') && !e.repeat) { e.preventDefault(); s.onPick(s.sel); }
      else if ((k === 'Escape' || k === 'Backspace') && s.onBack) { e.preventDefault(); sfx.move(); s.onBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n]);
  return [sel, setSel] as const;
}

function Row({ i, sel, setSel, onClick, children, className = '' }: { i: number; sel: number; setSel: (i: number) => void; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <li className={`mi${sel === i ? ' on' : ''} ${className}`} onMouseEnter={() => { if (sel !== i) { setSel(i); sfx.move(); } }} onClick={onClick}>
      <span className="cursor" aria-hidden>▶</span>{children}
    </li>
  );
}

export function MainMenu({ onStart, onStop }: { onStart: () => void; onStop: () => void }) {
  const [view, setView] = useState<'main' | 'settings' | 'how'>('main');
  const mode = useMode();
  return (
    <div className="menu-layer">
      <div className="menu-bg" style={{ backgroundImage: `url(${PIC_URL})` }} />
      <div className="menu-embers" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={vars({ '--x': `${(i * 37) % 100}%`, '--d': `${6 + (i % 5) * 1.7}s`, '--delay': `${-(i * 1.3)}s`, '--c': SPECTRUM[i % 7].color })} />)}</div>
      <div className={`menu-wrap${view === 'how' ? ' wide' : ''}`}>
        <div className="menu-head"><Title /></div>
        <div className="menu-body">
          {view === 'main' && <MainList onStart={onStart} onStop={onStop} open={setView} />}
          {view === 'settings' && <SettingsList back={() => setView('main')} />}
          {view === 'how' && <HowItWorks back={() => setView('main')} />}
        </div>
        <section className="menu-road" aria-label="Roadmap">
          <h2>THE ROAD AHEAD</h2>
          <Roadmap mode={mode} />
        </section>
      </div>
      <div className="menu-hint">UP / DOWN CHOOSE · ENTER SELECT{view !== 'main' && ' · ESC BACK'}</div>
    </div>
  );
}

let lastMain = 0;
function MainList({ onStart, onStop, open }: { onStart: () => void; onStop: () => void; open: (v: 'settings' | 'how') => void }) {
  const mode = useMode();
  const toggle = () => settings.set({ difficulty: settings.get().difficulty === 'easy' ? 'hard' : 'easy' });
  const pick = (i: number) => {
    const id = MAIN[i].id; sfx.select();
    if (id === 'start') onStart(); else if (id === 'stop') onStop(); else if (id === 'mode') toggle(); else open(id as 'settings' | 'how');
  };
  const [sel, setSel] = useList(MAIN.length, pick, undefined, (i) => { if (MAIN[i].id === 'mode') { toggle(); sfx.move(); } }, lastMain);
  lastMain = sel;   // coming back from SETTINGS / HOW IT WORKS keeps the cursor where it was
  return (
    <>
      <ul className="menu-list" role="menu">
        {MAIN.map((m, i) => (
          <Row key={m.id} i={i} sel={sel} setSel={setSel} onClick={() => { setSel(i); pick(i); }} className={m.id}>
            {m.id === 'mode' ? <><span className="mode-lbl">MODE</span><span className={`mode-val ${mode}`}>◀ {mode.toUpperCase()} ▶</span></> : m.label}
          </Row>
        ))}
      </ul>
      <div className={`mode-note ${mode}`} aria-live="polite">
        {mode === 'easy' ? (
          <>
            <b>EASY</b> · NO CHECKPOINTS
            <span>Die anywhere and you restart <u>that same level</u>. Then pick: TRY AGAIN, or SKIP to the next level.</span>
          </>
        ) : (
          <>
            <b>HARD</b> · CHECKPOINTS
            <span>Die and you go back to the last checkpoint (<u>BLUE · GREEN · RED</u>). No skipping.</span>
          </>
        )}
      </div>
    </>
  );
}

function Bar({ v, onSet }: { v: number; onSet: (v: number) => void }) {
  return (
    <span className="vbar" onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onSet(Math.round(((e.clientX - r.left) / r.width) * 10) / 10); }}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.round(v * 10) ? 'f' : ''} />)}
    </span>
  );
}

function SettingsList({ back }: { back: () => void }) {
  const [s, setS] = useState<Settings>(settings.get());
  const [fs, setFs] = useState(!!document.fullscreenElement);
  useEffect(() => settings.subscribe(setS), []);
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  const toggleFs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); };
  const vol = (k: 'master' | 'music' | 'effects', d: number) => { settings.set({ [k]: Math.max(0, Math.min(1, Math.round((s[k] + d) * 10) / 10)) }); sfx.move(); };
  const rows: { label: string; value: ReactNode; pick: () => void; lr?: (d: number) => void }[] = [
    { label: 'SOUND', value: <span className="val">{s.sound ? 'ON' : 'OFF'}</span>, pick: () => settings.set({ sound: !s.sound }) },
    { label: 'MASTER VOLUME', value: <Bar v={s.master} onSet={(v) => settings.set({ master: v })} />, pick: () => {}, lr: (d) => vol('master', d / 10) },
    { label: 'MUSIC', value: <Bar v={s.music} onSet={(v) => settings.set({ music: v })} />, pick: () => {}, lr: (d) => vol('music', d / 10) },
    { label: 'EFFECTS', value: <Bar v={s.effects} onSet={(v) => settings.set({ effects: v })} />, pick: () => {}, lr: (d) => vol('effects', d / 10) },
    { label: 'CRT SCANLINES', value: <span className="val">{s.crt ? 'ON' : 'OFF'}</span>, pick: () => settings.set({ crt: !s.crt }) },
    { label: 'FULLSCREEN', value: <span className="val">{fs ? 'ON' : 'OFF'}</span>, pick: toggleFs },
    { label: 'BACK', value: null, pick: back },
  ];
  const [sel, setSel] = useList(rows.length, (i) => { sfx.select(); rows[i].pick(); }, back, (i, d) => rows[i].lr?.(d));
  return (
    <div className="panel">
      <h2>SETTINGS</h2>
      <ul className="menu-list settings" role="menu">
        {rows.map((r, i) => <Row key={r.label} i={i} sel={sel} setSel={setSel} onClick={() => { setSel(i); sfx.select(); r.pick(); }}><span className="lbl">{r.label}</span>{r.value}</Row>)}
      </ul>
      <p className="panel-note">SOUND and MASTER VOLUME apply to every level too. LEFT / RIGHT changes a volume.</p>
    </div>
  );
}

function HowItWorks({ back }: { back: () => void }) {
  useList(1, () => { sfx.select(); back(); }, back);
  return (
    <div className="panel how">
      <h2>HOW IT WORKS</h2>
      <p className="rules-note">Eight levels in a row, one after another: BnW first, then the seven colours. Each level shows its own rules and controls on its title screen.</p>
      <EasyRules />
      <CheckpointRules />
      <p className="rules-note">ENTER moves on after a level is won. Hold SPACE to skip a cutscene.</p>
      <ul className="menu-list"><li className="mi on" onClick={() => { sfx.select(); back(); }}><span className="cursor">▶</span>BACK</li></ul>
    </div>
  );
}

/* ---------------------------------------------------------------- the other screens */

/** Before anything can make a sound, the browser needs one key press or click. */
export function BootScreen({ onGo }: { onGo: () => void }) {
  useEffect(() => {
    const go = (e: Event) => { if (e instanceof KeyboardEvent && e.repeat) return; onGo(); };
    window.addEventListener('keydown', go); window.addEventListener('mousedown', go);
    return () => { window.removeEventListener('keydown', go); window.removeEventListener('mousedown', go); };
  }, [onGo]);
  return (
    <div className="boot">
      <p className="blink">▶ PRESS ANY KEY</p>
      <p className="boot-note">BEST WITH SOUND ON · KEYBOARD AND MOUSE</p>
    </div>
  );
}

/** After START: the rules, once more, before BnW. */
export function RulesCard({ onGo }: { onGo: () => void }) {
  const [ready, setReady] = useState(false);
  const mode = useMode();
  useEffect(() => { const t = setTimeout(() => setReady(true), 900); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!ready) return;
    const go = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); sfx.select(); onGo(); } };
    window.addEventListener('keydown', go);
    return () => window.removeEventListener('keydown', go);
  }, [ready, onGo]);
  return (
    <div className="rules-card" onClick={() => { if (ready) { sfx.select(); onGo(); } }}>
      <h2>BEFORE YOU BEGIN</h2>
      <ModeRules mode={mode} />
      <Roadmap compact mode={mode} />
      <p className={`press${ready ? ' blink' : ''}`}>{ready ? 'PRESS ENTER TO BEGIN' : ' '}</p>
    </div>
  );
}

export function StoppedScreen({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    const go = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.repeat) { sfx.select(); onBack(); } };
    window.addEventListener('keydown', go); return () => window.removeEventListener('keydown', go);
  }, [onBack]);
  return (
    <div className="boot stopped">
      <Title small />
      <p className="boot-title">GAME STOPPED</p>
      <p className="boot-note">YOU CAN CLOSE THIS TAB NOW.</p>
      <button type="button" className="pix-btn" autoFocus onClick={() => { sfx.select(); onBack(); }}>▶ BACK TO MENU</button>
    </div>
  );
}

/** Over a lost level: Thanos has fallen, and where he will wake. */
export function FallenOverlay({ back, easy, next, onRetry, onSkip }: { back: LevelId; easy: boolean; next: string | null; onRetry: () => void; onSkip: () => void }) {
  const b = BAND_IDS.indexOf(back);
  const [sel, setSel] = useState(0);   // 0 = TRY AGAIN, 1 = SKIP
  const live = useRef(false), st = useRef({ sel, onRetry, onSkip }); st.current = { sel, onRetry, onSkip };
  useEffect(() => {
    if (!easy) return;
    const t = setTimeout(() => { live.current = true; }, 700);   // keys mashed while dying must not pick for the player
    const onKey = (e: KeyboardEvent) => {
      const k = e.key, s = st.current;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'A', 'D', 'w', 's', 'W', 'S', 'Tab'].includes(k)) { e.preventDefault(); setSel((v) => 1 - v); sfx.move(); }
      else if ((k === 'Enter' || k === ' ') && !e.repeat) { e.preventDefault(); if (live.current) { sfx.select(); if (s.sel === 0) s.onRetry(); else s.onSkip(); } }
      else if ((k === 'r' || k === 'R') && live.current) { e.preventDefault(); sfx.select(); s.onRetry(); }
      else if ((k === 'n' || k === 'N') && live.current) { e.preventDefault(); sfx.select(); s.onSkip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [easy]);
  if (easy) {
    const here = SPECTRUM[b].name;
    return (
      <div className="fallen" style={vars({ '--c': SPECTRUM[b].color })}>
        <p className="fallen-title">THANOS HAS FALLEN</p>
        <p className="fallen-sub">YOU FELL IN <b>{here}</b></p>
        <div className="fallen-choices">
          <button type="button" className={`pix-btn go${sel === 0 ? ' on' : ''}`} onMouseEnter={() => setSel(0)} onClick={() => { if (live.current) { sfx.select(); onRetry(); } }}>
            ▶ TRY {here} AGAIN
          </button>
          <button type="button" className={`pix-btn pass${sel === 1 ? ' on' : ''}`} onMouseEnter={() => setSel(1)} onClick={() => { if (live.current) { sfx.select(); onSkip(); } }}>
            {next ? `SKIP TO ${next} ▶▶` : 'SKIP TO THE ENDING ▶▶'}
          </button>
        </div>
        <p className="fallen-hint">LEFT / RIGHT CHOOSE · ENTER SELECT · OR TAP</p>
      </div>
    );
  }
  return (
    <div className="fallen" style={vars({ '--c': SPECTRUM[b].color })}>
      <p className="fallen-title">THANOS HAS FALLEN</p>
      <p className="fallen-sub">{CHECKPOINTS.includes(back) ? 'BACK TO CHECKPOINT ' : 'BACK TO THE START · '}<b>{SPECTRUM[b].name}</b></p>
    </div>
  );
}

/** Before every game: the display check found something. */
export function DisplayCheck({ issues, onGo, onRetry }: { issues: string[]; onGo: () => void; onRetry: () => void }) {
  useEffect(() => {
    const go = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Enter') { e.preventDefault(); sfx.select(); onGo(); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); sfx.select(); onRetry(); }
    };
    window.addEventListener('keydown', go); return () => window.removeEventListener('keydown', go);
  }, [onGo, onRetry]);
  return (
    <div className="boot check">
      <p className="boot-title">DISPLAY CHECK</p>
      <ul className="check-list">{issues.map((m) => <li key={m}>{m}</li>)}</ul>
      <div className="fallen-choices">
        <button type="button" className="pix-btn go" autoFocus onClick={() => { sfx.select(); onRetry(); }}>▶ CHECK AGAIN [R]</button>
        <button type="button" className="pix-btn pass" onClick={() => { sfx.select(); onGo(); }}>PLAY ANYWAY [ENTER]</button>
      </div>
    </div>
  );
}

/** Black card while the respawn level loads: its panel, its letter, RESPAWN. */
export function RespawnCard({ band }: { band: number }) {
  return (
    <div className="respawn-card" style={vars({ '--c': SPECTRUM[band].color })}>
      <Thumb band={band} h={210} />
      <p className="respawn-word">RESPAWN</p>
      <p className="respawn-sub">{settings.get().difficulty === 'easy' ? 'TRY AGAIN' : CHECKPOINTS.includes(BAND_IDS[band]) ? 'CHECKPOINT' : 'START'} · {SPECTRUM[band].name}</p>
    </div>
  );
}

/** After the last colour (and the outro, once it exists). */
export function EndScreen({ onMenu }: { onMenu: () => void }) {
  useEffect(() => {
    const go = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.repeat) { sfx.select(); onMenu(); } };
    window.addEventListener('keydown', go); return () => window.removeEventListener('keydown', go);
  }, [onMenu]);
  return (
    <div className="boot end">
      <Title />
      <p className="boot-title">EVERY COLOUR IS BACK</p>
      <button type="button" className="pix-btn" autoFocus onClick={() => { sfx.select(); onMenu(); }}>▶ MAIN MENU</button>
    </div>
  );
}
