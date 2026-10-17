/* Player settings for the whole run, kept in localStorage under `respawn:settings`.
 *
 * The shell applies them to its own music and effects. Every level page loads
 * public/respawn-audio.js, which reads the same key (and hears changes through the
 * `storage` event), so SOUND and MASTER VOLUME reach the levels too. */

export type Difficulty = 'easy' | 'hard';

export interface Settings {
  difficulty: Difficulty;   // easy: retry the level you died in (and may skip it) · hard: checkpoints
  sound: boolean;      // everything on / off
  master: number;      // 0..1, the whole game, levels included
  music: number;       // 0..1, the shell's intro and menu music
  effects: number;     // 0..1, the shell's transition and menu sounds
  crt: boolean;        // scanlines over the intro, menu and transitions
}

export const KEY = 'respawn:settings';
const DEFAULTS: Settings = { difficulty: 'easy', sound: true, master: 0.9, music: 0.8, effects: 0.8, crt: true };

function load(): Settings {
  try {
    const s = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
    if (s.difficulty !== 'easy' && s.difficulty !== 'hard') s.difficulty = DEFAULTS.difficulty;
    return s;
  } catch { return { ...DEFAULTS }; }
}

let current = load();
const subs = new Set<(s: Settings) => void>();

export const settings = {
  get: () => current,
  set(patch: Partial<Settings>) {
    current = { ...current, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private mode: this session only */ }
    subs.forEach((f) => f(current));
  },
  subscribe(f: (s: Settings) => void) { subs.add(f); return () => { subs.delete(f); }; },
};

/** The levels' loudness (what respawn-audio.js applies inside each level). */
export const levelVolume = (s: Settings) => (s.sound ? s.master : 0);
