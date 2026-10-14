# RESPAWN: the full game

Every level, back to back, as one continuous run:

| # | Piece | Status |
|---|-------|--------|
| 1 | **PRESS ANY KEY** (lets the browser play sound) | ✓ |
| 2 | Intro video | slot ready: drop `public/videos/intro.mp4` in |
| 3 | Logo reveal: Thanos's torch finds V I B G Y O R, then the whole picture + theme music | ✓ |
| 4 | Main menu: START · SETTINGS · HOW IT WORKS · STOP, with the roadmap | ✓ |
| 5 | Rules card (checkpoints) | ✓ |
| 6 | BnW | ✓ |
| 7–20 | torch clip into V → VIOLET … torch clip into R → RED | ✓ |
| 21 | Outro + credits video | slot ready: drop `public/videos/outro.mp4` in |
| 22 | Back to the main menu | ✓ |

## Play

Double-click **`PLAY.bat`**. The first time, it installs and builds everything (a few
minutes), then opens the game in your browser at http://localhost:4180.

Or from a terminal in `respawn-game/`:

```bash
npm install
npm run build:all
npm run preview
```

The built game is in `dist/`. It must be served over http (as `npm run preview` does);
opening `dist/index.html` straight from disk won't work.

### Jump to a chapter

Add `?chapter=<id>` to the URL to start there, skipping the intro and the menu (handy for
testing and demos): `bnw`, `violet`, `indigo`, `blue`, `green`, `yellow`, `orange`, `red`.
For example: http://localhost:4180/?chapter=green. Checkpoints before that chapter count as beaten.

## Your intro and outro videos

Put them in `public/videos/` (then `npm run build`, or just re-run `PLAY.bat` after deleting `dist/`):

- `intro.mp4` plays first, right after PRESS ANY KEY and before the logo reveal.
- `outro.mp4` plays after RED, once the spectrum strip has lit up (outro + credits), then the game returns to the menu.

While a file is missing, its slot is simply skipped. Hold SPACE skips either one.

## Checkpoints

Checkpoints are **BLUE**, **GREEN** and **RED**. A checkpoint counts once that level is beaten.
Dying sends Thanos back to the last checkpoint beaten, or to VIOLET before the first one:

| Die in | Back to |
|---|---|
| VIOLET, INDIGO, BLUE | VIOLET |
| GREEN | BLUE |
| YELLOW, ORANGE, RED | GREEN |

"Dying" is a level's **Game Over** (out of lives or out of time). RED has no lives, so 10 deaths
there count as one. BnW comes first and keeps its own retries. The rules are shown under
HOW IT WORKS on the menu and again on the card before BnW.

Each level posts `{ type: 'respawn:death' }` to the shell when its Game Over appears (only inside
the full game; on its own a level behaves exactly as before). The shell covers the level's
retry buttons, shows THANOS HAS FALLEN, closes the iris and opens on the checkpoint level with a
short RESPAWN card. The order and rules live in `src/sequence.ts`.

## Main menu

- **START** shows the rules card, then begins at BnW. Always BnW: the roadmap is a picture only.
- **SETTINGS**: sound on/off, master volume, music, effects, CRT scanlines, fullscreen. Saved in
  the browser. Sound and master volume reach every level too (`public/respawn-audio.js`,
  which the level build adds to each level page).
- **HOW IT WORKS**: the checkpoint rules.
- **STOP** ends the session (you can close the tab, or go back to the menu).

Arrow keys or W/S choose, ENTER selects, ESC goes back; the mouse works too.

## Transitions

Between two levels the run never cuts. It goes:

1. **Victory hold**: the level's own win screen stays up with a small *CONTINUE [ENTER]*
   prompt and a bar that runs out (about 5 s; 12 s on RED so its closing cards can play).
   ENTER, SPACE or a click moves on sooner. The level's own replay buttons are blocked here.
2. **Iris out**: a circle closes in on the centre, pauses on a pinhole rimmed in the
   level's colour, then shuts (a soft "whoomp").
3. **Spectrum card**: the V-I-B-G-Y-O-R strip. Colours already won stay lit, the next one
   flares up and its name settles in. Each colour rings one note of a rising scale, so
   the run climbs V → R as you play.
4. **Torch clip**: built live from the VIBGYOR picture. A torch rises at the bottom of the
   screen, its beam sways across the dark wall and settles on the next colour's panel, the panel
   lights up, its letter flares, and the camera dives into the letter. *Hold SPACE* (or hold the
   mouse) to skip. The next level loads quietly behind it.
5. **Bloom and iris in**: a wash of the new colour blooms from the centre as the circle
   opens onto the next level, which gets keyboard focus straight away.

After RED, the whole strip lights up band by band and rings out, then the outro plays.

## How it fits together

- `src/sequence.ts`: the running order, the colours, the checkpoints and the video slots.
- `src/App.tsx`: the director that runs it all. Each level runs in an iframe and posts
  `respawn:complete` / `respawn:death` (see each level's `main.tsx`; BnW's entry is
  `src/bnw/main.jsx`, built straight from `../BnWGame.jsx`).
- `src/LogoIntro.tsx`: the logo reveal. `src/LetterReveal.tsx`: the torch clip into a letter.
  `src/art.ts`: the picture's panel positions and the pixel Thanos.
- `src/music.ts`: the theme (logo score + menu loop), synthesised live. `src/sfx.ts`: the
  transition, menu and checkpoint sounds. `src/audio.ts` + `src/settings.ts`: volume settings.
- `src/Menu.tsx` + `src/menu.css`: menu, roadmap, rules and the other full-screen cards.
  `src/Transitions.tsx` + `src/styles.css`: spectrum card, video player, continue prompt, bloom.
- `scripts/build-levels.mjs` (`npm run levels`) builds every level folder and copies it
  into `public/levels/`. Run it again after changing any level. `--skip-build` only re-copies.
- `public/img/vibgyor.webp` is the picture used by the logo, the clips, the menu and the roadmap.
