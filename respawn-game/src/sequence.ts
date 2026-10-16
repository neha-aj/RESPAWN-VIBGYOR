/* The running order of the full game.
 *
 *   [boot: press any key] → SNaP studios card → INTRO video (skippable after 5 s) → logo reveal
 *   (Thanos's torch finds V I B G Y O R) → main menu → rules card → BnW → for each colour:
 *   spectrum card → torch clip into its letter → the level … → after RED: the strip lights up
 *   → OUTRO + credits video (videos/outro.mp4, when you add it) → back to the menu.
 *
 * Between chapters the shell plays its transitions (victory hold → iris close → spectrum card →
 * letter clip → colour bloom → iris open). Checkpoints are below.
 */

export type LevelId = 'bnw' | 'violet' | 'indigo' | 'blue' | 'green' | 'yellow' | 'orange' | 'red';

export interface Chapter {
  id: LevelId;
  name: string;
  /** Page loaded in the level's iframe. */
  src: string;
  /** Accent colour for the transitions into this chapter. */
  color: string;
  /** Index in the spectrum strip (0 = V … 6 = R); null for BnW. */
  band: number | null;
  /** How long to hold on the level's own victory screen before moving on (ms). */
  hold: number;
}

/** The seven spectrum bands, in rainbow order (the strip on the transition cards). */
export const SPECTRUM = [
  { letter: 'V', name: 'VIOLET', color: '#9B30FF' },
  { letter: 'I', name: 'INDIGO', color: '#6A4BFF' },
  { letter: 'B', name: 'BLUE', color: '#1E90FF' },
  { letter: 'G', name: 'GREEN', color: '#39FF14' },
  { letter: 'Y', name: 'YELLOW', color: '#FFD400' },
  { letter: 'O', name: 'ORANGE', color: '#FF7A00' },
  { letter: 'R', name: 'RED', color: '#FF1E2D' },
] as const;

const band = (i: number, id: LevelId, src: string, hold = 5200): Chapter => ({
  id, name: SPECTRUM[i].name, src, color: SPECTRUM[i].color, band: i, hold,
});

export const CHAPTERS: Chapter[] = [
  { id: 'bnw', name: 'BnW', src: 'bnw.html', color: '#FFFFFF', band: null, hold: 5200 },
  band(0, 'violet', 'levels/violet/index.html'),
  band(1, 'indigo', 'levels/indigo/index.html'),
  band(2, 'blue', 'levels/blue/index.html'),
  band(3, 'green', 'levels/green/index.html'),
  band(4, 'yellow', 'levels/yellow/index.html'),
  band(5, 'orange', 'levels/orange/index.html'),
  // RED types out its own closing cards after the win (~10 s), so it holds longer.
  band(6, 'red', 'levels/red/index.html', 12000),
];

/** Your videos: drop these files into public/videos/ and they play in their slots (skipped while missing). */
export const INTRO_VIDEO = 'videos/intro.mp4';
/** Phones get a 720p copy: a third of the size, and easy for any phone to decode. */
export const INTRO_VIDEO_MOBILE = 'videos/intro-mobile.mp4';
export const OUTRO_VIDEO = 'videos/outro.mp4';
/** The intro can be skipped once it has played this long (seconds): SKIP IN 5… then SKIP. */
export const INTRO_SKIP_AFTER = 5;

/*
 * CHECKPOINTS: BLUE, GREEN and RED. A checkpoint counts as soon as Thanos REACHES that level;
 * dying (a level's Game Over screen; in RED, which has no lives, 10 deaths) sends him back to
 * the last checkpoint reached, or to VIOLET before the first one:
 *   die in VIOLET or INDIGO           → VIOLET
 *   die in BLUE                       → BLUE   (checkpoint)
 *   die in GREEN, YELLOW or ORANGE    → GREEN  (checkpoint)
 *   die in RED                        → RED    (checkpoint)
 * BnW comes before all of this and keeps its own retries.
 */
export const CHECKPOINTS: LevelId[] = ['blue', 'green', 'red'];
export const FIRST_COLOUR: LevelId = 'violet';
export const RED_DEATHS = 10;
export const chapterIndex = (id: LevelId) => CHAPTERS.findIndex((c) => c.id === id);

/** Where a death sends Thanos, given the last checkpoint reached (null: none yet). */
export const respawnAt = (reached: LevelId | null): LevelId => reached ?? FIRST_COLOUR;

/** The last checkpoint reached by chapter i, counting chapter i itself. */
export function reachedBy(i: number): LevelId | null {
  let last: LevelId | null = null;
  CHAPTERS.forEach((c, j) => { if (j <= i && CHECKPOINTS.includes(c.id)) last = c.id; });
  return last;
}

/** The rules, as shown on the menu and the card before BnW. */
export const CHECKPOINT_RULES: { die: string; back: string; color: string }[] = [
  { die: 'VIOLET · INDIGO', back: 'VIOLET', color: SPECTRUM[0].color },
  { die: 'BLUE', back: 'BLUE', color: SPECTRUM[2].color },
  { die: 'GREEN · YELLOW · ORANGE', back: 'GREEN', color: SPECTRUM[3].color },
  { die: 'RED', back: 'RED', color: SPECTRUM[6].color },
];

/** `?chapter=green` starts the run at that chapter, skipping the intro and menu (handy for testing and demos). */
export function startChapter(): number | null {
  const id = new URLSearchParams(window.location.search).get('chapter');
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i < 0 ? null : i;
}
