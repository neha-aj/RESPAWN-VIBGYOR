/* Saved progress, kept in localStorage under `respawn:save`, so a closed tab or a refresh does not
 * cost the player their run. The shell writes it as each chapter begins and clears it once the
 * ending is reached. CONTINUE on the main menu picks the run back up:
 *   EASY  at the level the player was on
 *   HARD  at the last checkpoint reached (VIOLET before the first one), as a death would; BnW stays BnW
 * The mode the run was played in comes back with it. */
import { chapterIndex, CHAPTERS, reachedBy, respawnAt, type LevelId } from './sequence';
import type { Difficulty } from './settings';

export interface Save { chapter: LevelId; mode: Difficulty }
const KEY = 'respawn:save';

export const save = {
  get(): Save | null {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Save | null;
      if (!s || chapterIndex(s.chapter) < 0 || (s.mode !== 'easy' && s.mode !== 'hard')) return null;
      return s;
    } catch { return null; }
  },
  set(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: no saving */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } },
};

/** Where CONTINUE starts (an index into CHAPTERS). */
export function resumeAt(s: Save): number {
  const i = chapterIndex(s.chapter);
  if (s.mode === 'easy' || CHAPTERS[i].id === 'bnw') return i;
  return chapterIndex(respawnAt(reachedBy(i)));
}
