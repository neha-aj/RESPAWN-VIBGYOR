# GREEN (web)

The web version of GREEN. The gameplay, AI, maze and artwork match the Python version in `../level5-green/green.py`.

It uses the same stack as BLUE, VIOLET and INDIGO (React + TypeScript + Vite + Tailwind), but it is a separate project so the levels can be merged later.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5176 in a desktop browser.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | 21 tests, covering spec scenarios A–G, the palette, and an autopilot that wins |
| `npm run build` | Builds a static site in `dist/` |

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Move |
| SHIFT | Sprint (makes noise) |
| Mouse | Aim the flashlight |
| ENTER | Start |
| R | Restart |
| P / Esc | Pause (a browser tab can't quit, so Esc pauses instead) |
| M | Mute |
| H | Rules |

The jumpscare lasts 60 ticks of the fixed 60 Hz game clock, which is one second on any monitor. A 144 Hz screen therefore doesn't shorten it.

### Ambient jumpscares

Besides the phantom's catch, the forest lashes out on its own: the first time 45–65 s into play, then every 70–110 s (`SCARE_FIRST` / `SCARE_GAP` in `config.ts`). Each one lasts about a second, costs no life, and freezes the world while it plays. They cycle through three kinds: a face slamming into the screen, a pair of eyes in the dark that lunges, and a strobe of static and faces. The faces are the two reference pictures in `src/assets/` (`ghost-grin.webp`, `ghost-wail.png`), pixelated and mapped onto GREEN's palette when the level loads. Shriek, static and sting sounds are synthesised in `audio.ts`. None fire during the opening grace period, right after a catch, or once the tree ritual has begun. See `scares.ts`.

## Merging into a larger game

```tsx
import GreenLevel from './components/GreenLevel';

<GreenLevel onComplete={() => goToYellow()} onDeath={() => backToCheckpoint()} onExit={() => backToMenu()} />
```

All colour tokens are prefixed `grn-` in `tailwind.config.js`. The fonts are Special Elite (typewriter, for the HUD and text) and IM Fell English SC (for titles).

## Project layout

| File | Contents |
|---|---|
| `config.ts` | Palette, constants, the fixed maze, screen text and the rules placeholder |
| `maze.ts` | Grid, BFS, layout validation and DDA line of sight |
| `sim.ts` | Player, Phantom (WANDER / INVESTIGATE / SEARCH), Flashlight, runes, the tree door and the state machine |
| `art.ts` | Baked forest, top-down Thanos, Thanos portrait, the phantom and the animated jumpscare ghost |
| `render.ts` | Lighting (multiply mask), fog-of-war memory, bloom and HUD |
| `audio.ts` | Synthesized sound effects and the horror ambience |
| `scares.ts` | Ambient jumpscares (timing, the three kinds, the VHS treatment) |
| `engine.ts` | Fixed 60 Hz loop and keyboard and mouse input |
| `GreenLevel.tsx` | Screens and menus |
